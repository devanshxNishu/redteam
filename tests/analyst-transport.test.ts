import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { setImmediate as nextTurn } from "node:timers/promises";
import { WorkspaceStore } from "../src/workspace.ts";
import { createReviewBrief } from "../src/review-briefs.ts";
import { readAnalyticalPacket } from "../src/analytical-review.ts";
import { prepareAnalystRun } from "../src/analyst-config.ts";
import { AnalystTask } from "../src/analyst-task.ts";
import { AnalystInvocations } from "../src/analyst-invocation.ts";
import { BudgetLedger } from "../src/budget.ts";
import { createOpenAIAnalystTransport } from "../src/analyst-transport.ts";
import { sha256 } from "../src/evidence.ts";
const key = "OWNED_FAKE_ANALYST_KEY_NEVER_REAL", model = "authored-exact-model";
const endpoint = "https://api.openai.com/v1/responses";
const count = () => Response.json({ object: "response.input_tokens", input_tokens: 500 });
async function fixture(work: (context: { workspace: string; preparation: Awaited<ReturnType<typeof prepareAnalystRun>>; task: AnalystTask; phases: AnalystInvocations; budget: () => ReturnType<BudgetLedger["snapshot"]>; candidate: () => Record<string, unknown>; envelope: (change?: Record<string, unknown>) => Record<string, unknown>; deny: () => void }) => Promise<void>, kind = "idea", timeoutMs = 5000) {
  const workspace = await mkdtemp(resolve(tmpdir(), "redteam-analyst-http-")), store = new WorkspaceStore(workspace); let task: AnalystTask | undefined, phases: AnalystInvocations | undefined, allowed = true;
  try {
    const brief = await createReviewBrief(store, JSON.parse(await readFile(resolve(import.meta.dirname, `../examples/${kind}-review-brief.input.json`), "utf8"))), packet = await readAnalyticalPacket(store, brief.id);
    const preparation = await prepareAnalystRun(store, brief.id, { schemaVersion: "1.0", kind: "analyst_configuration", provider: "openai", model, pricing: { inputUsdPerMillion: "1.25", outputUsdPerMillion: "5" }, processing: { mode: "external", provider: "openai", scope: "exact_brief_packet_and_generation", briefId: brief.id, packetSha256: packet.packetSha256, authorized: true, basis: "Authored software processing declaration only.", expiresAt: new Date(Date.now() + 600000).toISOString() }, limits: { maximumInputTokens: 1000, maximumOutputTokens: 100, count: { tokens: 1000, costMicrousd: 1250 }, generation: { tokens: 1100, costMicrousd: 1750 }, timeoutMs, finalizationMs: 1000 }, taskPolicy: { leaseMs: 2000, heartbeatMs: 200 } });
    const manifest = preparation.manifest;
    task = new AnalystTask(workspace, { taskId: manifest.taskId, runId: manifest.runId, questionKey: manifest.questionKey, manifestHash: preparation.manifestSha256, deadlineAt: manifest.coordinatorDeadlineAt, owner: "authored-http-coordinator" }, () => { if (!allowed) throw new Error("PRIVATE_SOURCE_REASON"); }, manifest.configuration.taskPolicy);
    phases = new AnalystInvocations(workspace, preparation, task);
    const budget = () => { const ledger = new BudgetLedger(workspace); try { return ledger.snapshot(manifest.runId); } finally { ledger.close(); } };
    const candidate = () => ({ schemaVersion: "1.0", kind: "analytical_review_response", mode: "analytical_only", reviewStatus: "unreviewed", briefId: brief.id, packetSha256: packet.packetSha256, concerns: [], abstention: "Authored software fixture; no substantive analytical review was performed." });
    const envelope = (change: Record<string, unknown> = {}) => ({ object: "response", id: "authored-response", model, status: "completed", error: null, incomplete_details: null, output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(candidate()), annotations: [] }] }], usage: { input_tokens: 500, output_tokens: 50, total_tokens: 550 }, ...change });
    await work({ workspace, preparation, task, phases, budget, candidate, envelope, deny: () => { allowed = false; } });
  } finally { phases?.close(); task?.close(); store.close(); await rm(workspace, { recursive: true, force: true }); }
}
function fake(implementation: (url: string, init: RequestInit) => Promise<Response>): typeof fetch { return (async (input, init) => implementation(String(input), init!)) as typeof fetch; }
function routed(envelope: () => Record<string, unknown>): typeof fetch { return fake(async url => url.endsWith("/input_tokens") ? count() : Response.json(envelope())); }

test("idea/app HTTP phases bind complete payloads and exact request hashes through real ownership/budgets", async () => {
  for (const kind of ["idea", "app"]) await fixture(async ({ preparation, phases, task, budget, envelope }) => {
    const calls: { url: string; init: RequestInit }[] = [];
    const transport = createOpenAIAnalystTransport(preparation, key, fake(async (url, init) => { calls.push({ url, init }); return url.endsWith("/input_tokens") ? count() : Response.json(envelope()); }));
    assert.equal(calls.length, 0); const result = await transport.run(phases);
    assert.equal(result.status, "checked_unreviewed"); assert.equal(result.check?.checks.semanticReview, "unreviewed"); assert.equal(result.check?.checks.researchValidity, "not_established"); assert.equal(result.generationLiability, "settled"); assert.equal(result.countedInputTokens, 500); assert.equal(result.countResponseSha256, sha256(JSON.stringify({ object: "response.input_tokens", input_tokens: 500 }))); assert(!Object.hasOwn(result.check ?? {}, "boundaries"));
    assert.deepEqual(calls.map(call => call.url), [endpoint + "/input_tokens", endpoint]);
    const first = JSON.parse(String(calls[0]!.init.body)), second = JSON.parse(String(calls[1]!.init.body)), { max_output_tokens, store, stream, background, ...common } = second;
    assert.deepEqual(first, common); assert.equal(first.model, model); assert.equal(first.instructions, preparation.generation.instructions); assert.equal(first.input, preparation.generation.input); assert.deepEqual(first.text, preparation.generation.text); assert.deepEqual(first.tools, []); assert.equal(first.tool_choice, "none"); assert.equal(first.truncation, "disabled"); assert.equal(max_output_tokens, 100); assert.equal(store, false); assert.equal(stream, false); assert.equal(background, false);
    for (const call of calls) { assert.equal(call.init.method, "POST"); assert.equal(call.init.redirect, "error"); assert.equal((call.init.headers as Record<string, string>).Authorization, "Bearer " + key); assert(call.init.signal instanceof AbortSignal); assert(!String(call.init.body).includes(key)); }
    assert.equal(result.metadata.countRequestSha256, sha256(String(calls[0]!.init.body))); assert.equal(result.metadata.generationRequestSha256, sha256(String(calls[1]!.init.body))); assert(!JSON.stringify(result).includes(key)); assert(Object.isFrozen(result));
    assert.equal(budget().pools[0]?.held.costMicrousd, "1250"); assert.equal(budget().pools[0]?.spent.costMicrousd, "875"); assert.equal(task.snapshot().record.state, "running"); assert.equal(task.snapshot().record.output, null);
  }, kind);
});

test("explicit credential and exact preparation validation happen before requests", async () => fixture(async ({ preparation, phases }) => {
  let calls = 0; const fetcher = fake(async () => { calls++; return count(); });
  for (const value of ["", "short", "has whitespace", "x".repeat(2049), "invalid\nkey"]) assert.throws(() => createOpenAIAnalystTransport(preparation, value, fetcher));
  assert.throws(() => createOpenAIAnalystTransport({ ...preparation, manifestSha256: "a".repeat(64) }, key, fetcher));
  assert.equal(calls, 0); assert.equal((await createOpenAIAnalystTransport(preparation, key, fetcher).run(phases)).status, "rejected"); // Count reply cannot act as generation output.
}));

test("another prepared run cannot use this task's phase accounting", async () => fixture(async ({ preparation, phases }) => {
  let calls = 0; const manifest = { ...preparation.manifest, runId: "22222222-2222-4222-8222-222222222222" as const }, changed = { ...preparation, manifest, manifestSha256: sha256(JSON.stringify(manifest)) };
  const result = await createOpenAIAnalystTransport(changed, key, fake(async () => { calls++; return count(); })).run(phases);
  assert.equal(result.status, "failed"); assert.equal(result.reason, "phase_denied"); assert.equal(calls, 0);
}));

test("transport and durable phases both reject a second attempt without another request", async () => fixture(async ({ preparation, phases, envelope }) => {
  let calls = 0; const transport = createOpenAIAnalystTransport(preparation, key, fake(async url => { calls++; return url.endsWith("/input_tokens") ? count() : Response.json(envelope()); }));
  assert.equal((await transport.run(phases)).status, "checked_unreviewed"); assert.equal((await transport.run(phases)).reason, "phase_denied");
  assert.equal((await createOpenAIAnalystTransport(preparation, key, routed(envelope)).run(phases)).reason, "phase_denied"); assert.equal(calls, 2);
}));

test("count identity, type and configured bounds fail without generation and keep liability", async () => {
  for (const body of [{ input_tokens: 500 }, { object: "response.input_tokens", input_tokens: 0 }, { object: "response.input_tokens", input_tokens: 1001 }, { object: "response.input_tokens", input_tokens: "500" }]) await fixture(async ({ preparation, phases, budget }) => {
    let calls = 0; const result = await createOpenAIAnalystTransport(preparation, key, fake(async () => { calls++; return Response.json(body); })).run(phases);
    assert.equal(result.reason, "invalid_count"); assert.equal(calls, 1); assert.equal(budget().invocations[0]?.state, "uncertain"); assert.equal(budget().pools[0]?.held.costMicrousd, "1250");
  });
});

test("HTTP and network errors stay redacted and never retry", async () => {
  for (const generation of [false, true]) await fixture(async ({ preparation, phases, budget }) => {
    let calls = 0; const result = await createOpenAIAnalystTransport(preparation, key, fake(async url => { calls++; return generation && url.endsWith("/input_tokens") ? count() : new Response("PRIVATE_PROVIDER_BODY " + key, { status: 429 }); })).run(phases);
    assert.equal(result.reason, "http_error"); assert.equal(calls, generation ? 2 : 1); assert(!JSON.stringify(result).includes(key)); assert(!JSON.stringify(result).includes("PRIVATE_PROVIDER_BODY")); assert.equal(budget().invocations.at(-1)?.state, "uncertain");
  });
  await fixture(async ({ preparation, phases }) => {
    let calls = 0; const result = await createOpenAIAnalystTransport(preparation, key, fake(async () => { calls++; throw new Error(key); })).run(phases);
    assert.equal(result.reason, "request_failed"); assert.equal(calls, 1); assert(!JSON.stringify(result).includes(key));
  });
});

test("redirect statuses and unexpected response URLs cannot deliver a candidate", async () => {
  for (const response of [new Response(null, { status: 302, headers: { Location: "https://example.invalid" } }), (() => { const result = count(); Object.defineProperty(result, "url", { value: "https://example.invalid" }); return result; })()]) await fixture(async ({ preparation, phases }) => {
    const result = await createOpenAIAnalystTransport(preparation, key, fake(async (_, init) => { assert.equal(init.redirect, "error"); return response; })).run(phases);
    assert.equal(result.reason, "redirect_denied"); assert.equal(result.check, null);
  });
});

test("strict UTF-8, JSON object and response-size limits apply to both phases", async () => {
  for (const [body, reason] of [[new Uint8Array([0xff]), "invalid_utf8"], ["not JSON", "invalid_json"], ["[]", "invalid_envelope"], ["x".repeat(16385), "response_too_large"]] as const) await fixture(async ({ preparation, phases }) => {
    const result = await createOpenAIAnalystTransport(preparation, key, fake(async () => new Response(body))).run(phases); assert.equal(result.reason, reason);
  });
  await fixture(async ({ preparation, phases }) => {
    const result = await createOpenAIAnalystTransport(preparation, key, fake(async url => url.endsWith("/input_tokens") ? count() : new Response("x".repeat(1000001)))).run(phases); assert.equal(result.reason, "response_too_large");
  });
});

test("an empty-chunk stream is bounded and cancellation is never awaited", async () => fixture(async ({ preparation, phases }) => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array()); }, cancel() { cancelled = true; return new Promise(() => {}); } });
  const result = await createOpenAIAnalystTransport(preparation, key, fake(async () => new Response(body))).run(phases);
  assert.equal(result.reason, "response_too_large"); assert.equal(cancelled, true);
}));

test("refusal and incomplete output preserve known usage without a checked candidate", async () => {
  for (const reason of ["refused", "incomplete"]) await fixture(async ({ preparation, phases, budget, envelope }) => {
    const response = reason === "incomplete" ? envelope({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }) : envelope({ output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "refusal", refusal: key }] }] });
    const result = await createOpenAIAnalystTransport(preparation, key, routed(() => response)).run(phases);
    assert.equal(result.status, "rejected"); assert.equal(result.reason, reason); assert.equal(result.check, null); assert.equal(result.generationLiability, "settled"); assert.equal(budget().pools[0]?.spent.costMicrousd, "875"); assert(!JSON.stringify(result).includes(key));
  });
});

test("missing or contradictory usage and provider model changes retain generation liability", async () => {
  for (const change of [{ usage: null }, { usage: { input_tokens: 500, output_tokens: 50, total_tokens: 1 } }, { model: "unverified-alias-snapshot" }]) await fixture(async ({ preparation, phases, budget, envelope }) => {
    const result = await createOpenAIAnalystTransport(preparation, key, routed(() => envelope(change))).run(phases);
    assert.equal(result.status, "rejected"); assert.equal(result.reason, change.model ? "provider_model_mismatch" : "usage_unavailable"); assert.equal(result.generationLiability, "uncertain"); assert.equal(budget().pools[0]?.held.costMicrousd, "3000");
  });
});

test("count/usage mismatch rejects output while settling known spend", async () => fixture(async ({ preparation, phases, budget, envelope }) => {
  const result = await createOpenAIAnalystTransport(preparation, key, routed(() => envelope({ usage: { input_tokens: 501, output_tokens: 50, total_tokens: 551 } }))).run(phases);
  assert.equal(result.reason, "preflight_mismatch"); assert.equal(result.check, null); assert.equal(budget().pools[0]?.spent.costMicrousd, "877");
}));

test("known usage overrun is recorded and closes dispatch", async () => fixture(async ({ preparation, phases, budget, envelope }) => {
  const result = await createOpenAIAnalystTransport(preparation, key, routed(() => envelope({ usage: { input_tokens: 2000, output_tokens: 100, total_tokens: 2100 } }))).run(phases);
  assert.equal(result.reason, "budget_overrun"); assert.equal(result.check, null); assert.equal(budget().run.closeReason, "receipt_overrun"); assert.equal(budget().invocations.at(-1)?.overrun, true);
}));

test("invalid analytical JSON, wrong citations and unknown output/tool items cannot pass structure checks", async () => {
  for (const problem of ["json", "citation", "tool", "status", "annotations", "secret"]) await fixture(async ({ preparation, phases, envelope, candidate, budget }) => {
    const response = envelope();
    if (problem === "tool") response.output = [{ type: "function_call", name: "shell", arguments: "PRIVATE" }];
    else if (problem === "status") response.status = "failed";
    else {
      const value = candidate(); if (problem === "citation") value.packetSha256 = "a".repeat(64); if (problem === "secret") value.abstention = key;
      response.output = [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: problem === "json" ? "invalid" : JSON.stringify(value), annotations: problem === "annotations" ? [{ type: "url_citation", url: "https://example.invalid" }] : [] }] }];
    }
    const result = await createOpenAIAnalystTransport(preparation, key, routed(() => response)).run(phases);
    assert.equal(result.status, "rejected"); assert.equal(result.reason, problem === "status" ? "provider_failed" : "invalid_output"); assert.equal(result.check, null); assert.equal(budget().pools[0]?.spent.costMicrousd, "875"); assert(!JSON.stringify(result).includes(key));
  });
});

test("decoded analytical text has its own UTF-8 byte bound", async () => fixture(async ({ preparation, phases, envelope, candidate }) => {
  const value = candidate(); value.abstention = "界".repeat(11000);
  const result = await createOpenAIAnalystTransport(preparation, key, routed(() => envelope({ output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(value) }] }] }))).run(phases);
  assert.equal(result.reason, "invalid_output"); assert.equal(result.check, null);
}));

test("source withdrawal before transmission prevents all fetch calls", async () => fixture(async ({ preparation, phases, deny }) => {
  let calls = 0; const transport = createOpenAIAnalystTransport(preparation, key, fake(async () => { calls++; return count(); })); deny();
  const result = await transport.run(phases); assert.equal(result.status, "failed"); assert.equal(calls, 0); assert.equal(result.check, null);
}));

test("a stalled fetch returns at the inference deadline and a late response is cancelled without a candidate", { timeout: 3000 }, async () => fixture(async ({ preparation, phases, budget }) => {
  let finish!: (response: Response) => void, cancelled = false;
  const transport = createOpenAIAnalystTransport(preparation, key, fake(() => new Promise(done => { finish = done; }))), keepAlive = setTimeout(() => {}, 1500);
  try { const result = await transport.run(phases); assert.equal(result.reason, "interrupted"); assert.equal(result.check, null); assert.equal(budget().invocations[0]?.state, "uncertain"); }
  finally { clearTimeout(keepAlive); }
  finish(new Response(new ReadableStream({ cancel() { cancelled = true; } }))); await nextTurn(); assert.equal(cancelled, true);
}, "idea", 150));

test("a stalled body read cannot delay cancellation and cannot release spend", async () => fixture(async ({ preparation, phases, task, budget }) => {
  let reading!: () => void, cancelled = false; const started = new Promise<void>(done => { reading = done; });
  const transport = createOpenAIAnalystTransport(preparation, key, fake(async url => url.endsWith("/input_tokens") ? count() : new Response(new ReadableStream({ pull() { reading(); return new Promise(() => {}); }, cancel() { cancelled = true; return new Promise(() => {}); } }))));
  const pending = transport.run(phases); await started; task.stop("cancelled"); const result = await pending; await nextTurn();
  assert.equal(result.reason, "interrupted"); assert.equal(result.check, null); assert.equal(cancelled, true); assert.equal(budget().pools[0]?.held.costMicrousd, "3000");
}));

test("known parsed generation usage survives final source denial without candidate delivery", async () => fixture(async ({ preparation, phases, budget, deny, envelope }) => {
  const response = Response.json(envelope()), responseBody = response.body!, original = responseBody.getReader.bind(responseBody); let emitted = false;
  responseBody.getReader = (() => { const reader = original(); const read = reader.read.bind(reader); reader.read = (async () => { const value = await read(); if (value.done && !emitted) { emitted = true; deny(); } return value; }) as typeof reader.read; return reader; }) as typeof responseBody.getReader;
  const result = await createOpenAIAnalystTransport(preparation, key, fake(async url => url.endsWith("/input_tokens") ? count() : response)).run(phases);
  assert.equal(result.status, "failed"); assert.equal(result.check, null); assert.equal(budget().pools[0]?.spent.costMicrousd, "875");
}));


test("source withdrawal after count blocks generation without releasing count liability", async () => fixture(async ({ preparation, phases, budget, deny }) => {
  let calls = 0;
  const result = await createOpenAIAnalystTransport(preparation, key, fake(async () => { calls++; deny(); return count(); })).run(phases);
  assert.equal(result.reason, "interrupted"); assert.equal(calls, 1); assert.equal(result.check, null); assert.equal(budget().invocations.length, 1); assert.equal(budget().pools[0]?.held.costMicrousd, "1250");
}));

test("reported output allowance and unrepresentable cost cannot yield a checked candidate", async () => {
  for (const usage of [{ input_tokens: 500, output_tokens: 101, total_tokens: 601 }, { input_tokens: Number.MAX_SAFE_INTEGER, output_tokens: 0, total_tokens: Number.MAX_SAFE_INTEGER }]) await fixture(async ({ preparation, phases, budget, envelope }) => {
    const result = await createOpenAIAnalystTransport(preparation, key, routed(() => envelope({ usage }))).run(phases);
    assert.equal(result.reason, usage.output_tokens ? "preflight_mismatch" : "usage_unavailable"); assert.equal(result.check, null);
    assert.equal(budget().invocations.at(-1)?.state, usage.output_tokens ? "settled" : "uncertain");
  });
});

test("reasoning metadata is excluded from otherwise checked analytical output", async () => fixture(async ({ preparation, phases, envelope }) => {
  const response = envelope(); response.output = [{ type: "reasoning", summary: [{ type: "summary_text", text: "HIDDEN_REASONING_MARKER" }] }, ...(response.output as unknown[])];
  const result = await createOpenAIAnalystTransport(preparation, key, routed(() => response)).run(phases);
  assert.equal(result.status, "checked_unreviewed"); assert(!JSON.stringify(result).includes("HIDDEN_REASONING_MARKER"));
}));

test("a known credential embedded in model input is refused before any request", async () => fixture(async ({ preparation }) => {
  const generation = { ...preparation.generation, instructions: preparation.generation.instructions + key }, manifest = { ...preparation.manifest, instructionsSha256: sha256(generation.instructions), generationSha256: sha256(JSON.stringify(generation)) };
  assert.throws(() => createOpenAIAnalystTransport({ ...preparation, generation, manifest, manifestSha256: sha256(JSON.stringify(manifest)) }, key, routed(() => ({}))), /contains its credential/);
}));
