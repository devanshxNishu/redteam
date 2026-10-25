import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { WorkspaceStore } from "../src/workspace.ts";
import { createReviewBrief } from "../src/review-briefs.ts";
import { readAnalyticalPacket } from "../src/analytical-review.ts";
import { parseAnalystConfiguration, prepareAnalystRun, AnalystConfigurationError } from "../src/analyst-config.ts";
import type { AnalystConfiguration } from "../src/analyst-config.ts";
import { sha256 } from "../src/evidence.ts";
const project = resolve(import.meta.dirname, ".."), id = "11111111-1111-4111-8111-111111111111", digest = "a".repeat(64);
const configuration = (briefId = id, packetSha256 = digest): AnalystConfiguration => ({ schemaVersion: "1.0", kind: "analyst_configuration", provider: "openai", model: "authored-model-not-live-verified", pricing: { inputUsdPerMillion: "1.25", outputUsdPerMillion: "5" }, processing: { mode: "external", provider: "openai", scope: "exact_brief_packet_and_generation", briefId, packetSha256, authorized: true, basis: "Authored operator declaration fixture; no real external permission.", expiresAt: new Date(Date.now() + 600000).toISOString() }, limits: { maximumInputTokens: 1000, maximumOutputTokens: 200, count: { tokens: 1000, costMicrousd: 2000 }, generation: { tokens: 1200, costMicrousd: 2250 }, timeoutMs: 10000, finalizationMs: 1000 }, taskPolicy: { leaseMs: 5000, heartbeatMs: 1000 } });
async function fixture(work: (workspace: string, store: WorkspaceStore) => Promise<void>) {
  const workspace = await mkdtemp(resolve(tmpdir(), "redteam-analyst-config-")), store = new WorkspaceStore(workspace);
  try { await work(workspace, store); } finally { store.close(); await rm(workspace, { recursive: true, force: true }); }
}
const briefInput = async (kind = "idea") => JSON.parse(await readFile(resolve(project, `examples/${kind}-review-brief.input.json`), "utf8"));

test("analyst configuration copies and deeply freezes exact public data with canonical decimal rates", () => {
  const input = configuration(); input.pricing.inputUsdPerMillion = "0001.250000"; input.pricing.outputUsdPerMillion = "0005.000000";
  const parsed = parseAnalystConfiguration(input); assert.equal(parsed.pricing.inputUsdPerMillion, "1.25"); assert.equal(parsed.pricing.outputUsdPerMillion, "5");
  input.model = "changed"; input.limits.count.costMicrousd = 999; input.processing.basis = "changed";
  assert.equal(parsed.model, "authored-model-not-live-verified"); assert.equal(parsed.limits.count.costMicrousd, 2000);
  assert.notEqual(parsed.processing.basis, "changed"); assert(Object.isFrozen(parsed)); assert(Object.isFrozen(parsed.limits)); assert(Object.isFrozen(parsed.limits.count)); assert(Object.isFrozen(parsed.taskPolicy));
  assert.throws(() => { parsed.pricing.outputUsdPerMillion = "1"; }, TypeError);
});

test("missing, unknown, credential, accessor and serializer fields cannot enter public analyst configuration", () => {
  const base = configuration();
  for (const key of Object.keys(base)) { const value = { ...base } as Record<string, unknown>; delete value[key]; assert.throws(() => parseAnalystConfiguration(value), AnalystConfigurationError); }
  for (const key of ["apiKey", "apiKeyEnv", "tools", "endpoint", "toJSON"]) assert.throws(() => parseAnalystConfiguration({ ...base, [key]: "OWNED_FAKE_SECRET" }), AnalystConfigurationError);
  for (const key of ["pricing", "processing", "limits", "taskPolicy"] as const) assert.throws(() => parseAnalystConfiguration({ ...base, [key]: { ...base[key], unsupported: true } }), AnalystConfigurationError);
  let called = false;
  assert.throws(() => parseAnalystConfiguration({ ...base, get model() { called = true; return "secret"; } }), AnalystConfigurationError);
  const nested = { ...base.pricing }; Object.defineProperty(nested, "inputUsdPerMillion", { get() { called = true; return "1"; }, enumerable: true });
  assert.throws(() => parseAnalystConfiguration({ ...base, pricing: nested }), AnalystConfigurationError);
  const hidden = { ...base }; Object.defineProperty(hidden, "model", { value: "hidden", enumerable: false }); assert.throws(() => parseAnalystConfiguration(hidden), AnalystConfigurationError);
  assert.throws(() => parseAnalystConfiguration({ ...base, [Symbol("hidden")]: true }), AnalystConfigurationError);
  assert.equal(called, false);
});

test("processing is explicit exact-packet operator attestation with bounded basis and canonical UTC expiry", () => {
  const base = configuration();
  for (const change of [{ authorized: false }, { provider: "other" }, { mode: "local" }, { scope: "all_research" }, { briefId: "all" }, { packetSha256: "*" }, { basis: "" }, { basis: "x".repeat(501) }, { basis: "first\nsecond" }, { expiresAt: "2026-10-26" }, { expiresAt: "2026-02-30T00:00:00.000Z" }, { expiresAt: "invalid" }]) assert.throws(() => parseAnalystConfiguration({ ...base, processing: { ...base.processing, ...change } }), AnalystConfigurationError);
  assert.throws(() => parseAnalystConfiguration({ ...base, provider: "other" }), AnalystConfigurationError);
  for (const model of ["", "has whitespace", "x".repeat(121), null]) assert.throws(() => parseAnalystConfiguration({ ...base, model }), AnalystConfigurationError);
});

test("separate count and generation caps cannot assume free counting or impossible token allowances", () => {
  const base = configuration();
  for (const change of [{ count: { tokens: 1000, costMicrousd: 0 } }, { count: { tokens: 999, costMicrousd: 2000 } }, { generation: { tokens: 1199, costMicrousd: 2250 } }, { generation: { tokens: 1200, costMicrousd: 2249 } }, { maximumOutputTokens: 15 }, { maximumInputTokens: 0 }, { maximumInputTokens: 1000001 }, { maximumOutputTokens: 1000001 }, { timeoutMs: 300001 }, { finalizationMs: 10001 }, { timeoutMs: 0 }, { finalizationMs: 0 }, { count: { tokens: 1000, costMicrousd: Number.MAX_SAFE_INTEGER } }]) assert.throws(() => parseAnalystConfiguration({ ...base, limits: { ...base.limits, ...change } }), AnalystConfigurationError);
  for (const taskPolicy of [{ leaseMs: 0, heartbeatMs: 1 }, { leaseMs: 60001, heartbeatMs: 1 }, { leaseMs: 1000, heartbeatMs: 1000 }, { leaseMs: 5000, heartbeatMs: NaN }]) assert.throws(() => parseAnalystConfiguration({ ...base, taskPolicy }), AnalystConfigurationError);
});

test("rate precision and integer ceiling reject underfunding and unsafe overflow", () => {
  const base = configuration();
  for (const rate of ["0", "-1", "1e2", "1.0000001", " 1", ".5", "9".repeat(33), "9007199254.740992", 1, NaN]) assert.throws(() => parseAnalystConfiguration({ ...base, pricing: { inputUsdPerMillion: rate, outputUsdPerMillion: "1" } }), AnalystConfigurationError);
  const tiny = { ...base, pricing: { inputUsdPerMillion: "0.000001", outputUsdPerMillion: "0.000001" }, limits: { ...base.limits, maximumInputTokens: 1, maximumOutputTokens: 16, count: { tokens: 1, costMicrousd: 1 }, generation: { tokens: 17, costMicrousd: 1 } } };
  assert.equal(parseAnalystConfiguration(tiny).limits.generation.costMicrousd, 1);
  assert.throws(() => parseAnalystConfiguration({ ...base, pricing: { inputUsdPerMillion: "9007199254.740991", outputUsdPerMillion: "9007199254.740991" }, limits: { ...base.limits, maximumInputTokens: 1000000, maximumOutputTokens: 1000000, count: { tokens: 1000000, costMicrousd: 1 }, generation: { tokens: 2000000, costMicrousd: Number.MAX_SAFE_INTEGER - 1 } } }), AnalystConfigurationError);
});

test("idea/app preparations bind exact checked source, configuration, generation and conservative phase sum without creating state", async t => fixture(async (workspace, store) => {
  const transport = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected network"); });
  for (const kind of ["idea", "app"]) {
    const saved = await createReviewBrief(store, await briefInput(kind)), packet = await readAnalyticalPacket(store, saved.id), raw = configuration(saved.id, packet.packetSha256), audit = store.auditLog(), files = await readdir(store.directory), sourceBytes = await readFile(resolve(saved.directory, "report.json"));
    const preparation = await prepareAnalystRun(store, saved.id, raw), manifest = preparation.manifest;
    assert.equal(preparation.state, "not_started"); assert.equal(manifest.kind, "analyst_run_manifest"); assert.equal(manifest.maximumAttempts, 1); assert.notEqual(manifest.runId, manifest.taskId);
    for (const value of [manifest.runId, manifest.taskId]) assert.match(value, /^[a-f0-9-]{36}$/);
    assert.deepEqual(manifest.source, packet.brief); assert.equal(manifest.packetSha256, packet.packetSha256); assert.equal(manifest.configurationSha256, sha256(JSON.stringify(parseAnalystConfiguration(raw))));
    assert.equal(preparation.manifestSha256, sha256(JSON.stringify(manifest))); assert.equal(manifest.generationSha256, sha256(JSON.stringify(preparation.generation)));
    assert.equal(manifest.instructionsSha256, sha256(preparation.generation.instructions)); assert.equal(manifest.schemaSha256, sha256(JSON.stringify(preparation.generation.text.format.schema))); assert.deepEqual(JSON.parse(preparation.generation.input), packet);
    assert.equal(Date.parse(manifest.inferenceDeadlineAt) - Date.parse(manifest.preparedAt), 10000); assert.equal(Date.parse(manifest.coordinatorDeadlineAt) - Date.parse(manifest.inferenceDeadlineAt), 1000);
    assert.deepEqual(manifest.budget.cap, { tokens: 2200, costMicrousd: 4250 }); assert.equal(manifest.budget.maximumConfiguredGenerationCostMicrousd, 2250);
    assert.equal(manifest.budget.countCostBasis, "explicit_operator_liability_cap_not_assumed_free"); assert.equal(manifest.boundaries.processingAuthority, "operator_declared_not_independently_verified");
    assert.equal(manifest.boundaries.liveCompatibility, "not_checked"); assert.equal(manifest.boundaries.taskCreated, false); assert.equal(manifest.boundaries.budgetCreated, false); assert.equal(manifest.boundaries.resultPublished, false); assert.equal(manifest.boundaries.semanticReview, "unreviewed");
    assert(!Object.hasOwn(preparation.generation, "model")); assert(!Object.hasOwn(preparation.generation, "tools")); assert(!JSON.stringify(preparation).includes(workspace)); assert(Buffer.byteLength(JSON.stringify(preparation, null, 2) + "\n") <= 220000);
    assert(Object.isFrozen(preparation)); assert(Object.isFrozen(preparation.generation.text.format.schema));
    assert.deepEqual(await readdir(store.directory), files); assert.deepEqual(store.auditLog(), audit); assert((await readFile(resolve(saved.directory, "report.json"))).equals(sourceBytes));
  }
  assert.deepEqual(store.jobs(), []); assert.deepEqual(store.actorRuns(), []); assert.deepEqual(store.grants(), []); assert.equal(transport.mock.callCount(), 0);
}));

test("expired or too-short processing declaration and another brief/packet cannot authorize preparation", async () => fixture(async (_, store) => {
  const a = await createReviewBrief(store, await briefInput()), b = await createReviewBrief(store, await briefInput()), packet = await readAnalyticalPacket(store, a.id), base = configuration(a.id, packet.packetSha256);
  for (const change of [{ briefId: b.id }, { packetSha256: digest }, { expiresAt: new Date(0).toISOString() }, { expiresAt: new Date(Date.now() + 1000).toISOString() }]) await assert.rejects(prepareAnalystRun(store, a.id, { ...base, processing: { ...base.processing, ...change } }), AnalystConfigurationError);
  await assert.rejects(prepareAnalystRun(store, b.id, base), AnalystConfigurationError);
}));

test("caller changes during async source reads cannot change a prepared model, limits or processing declaration", async () => fixture(async (_, store) => {
  const saved = await createReviewBrief(store, await briefInput()), packet = await readAnalyticalPacket(store, saved.id), raw = configuration(saved.id, packet.packetSha256), expected = parseAnalystConfiguration(raw);
  const pending = prepareAnalystRun(store, saved.id, raw); raw.model = "changed-model"; raw.limits.generation.costMicrousd = 999999; raw.processing.authorized = false as true;
  const prepared = await pending; assert.deepEqual(prepared.manifest.configuration, expected); assert.equal(prepared.manifest.configurationSha256, sha256(JSON.stringify(expected)));
}));

test("changed saved source denies preparation and leaves the checked brief and catalogs unchanged on restoration", async () => fixture(async (_, store) => {
  const saved = await createReviewBrief(store, await briefInput()), packet = await readAnalyticalPacket(store, saved.id), raw = configuration(saved.id, packet.packetSha256), path = resolve(saved.directory, "report.json"), bytes = await readFile(path), audit = store.auditLog();
  await writeFile(path, "AUTHORED_SOURCE_TAMPER"); await assert.rejects(prepareAnalystRun(store, saved.id, raw));
  await writeFile(path, bytes); assert.equal((await prepareAnalystRun(store, saved.id, raw)).manifest.packetSha256, packet.packetSha256); assert.deepEqual(store.auditLog(), audit);
}));


test("source loss after the first checked generation read is denied by the second full packet read", async t => fixture(async (_, store) => {
  const saved = await createReviewBrief(store, await briefInput()), packet = await readAnalyticalPacket(store, saved.id), raw = configuration(saved.id, packet.packetSha256), path = resolve(saved.directory, "report.json"), bytes = await readFile(path);
  const original = store.reviewBrief.bind(store); let lookups = 0, changed = false;
  t.mock.method(store, "reviewBrief", (id: string) => {
    const summary = original(id);
    // Initial packet: summary, full-read summary, contract check, final catalog guard.
    // Change bytes immediately after that final synchronous guard, before the next read.
    if (++lookups === 4) queueMicrotask(() => { changed = true; writeFileSync(path, "AUTHORED_BETWEEN_READS_CHANGE"); });
    return summary;
  });
  try { await assert.rejects(prepareAnalystRun(store, saved.id, raw)); assert.equal(changed, true); assert(lookups >= 5); }
  finally { await writeFile(path, bytes); }
}));
