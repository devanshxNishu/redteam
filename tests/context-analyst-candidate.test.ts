import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, realpath, readFile, writeFile, rm, chmod, symlink, link } from "node:fs/promises";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { WorkspaceStore } from "../src/workspace.ts";
import { sha256 } from "../src/evidence.ts";
import { createReviewBrief } from "../src/review-briefs.ts";
import { importContextSource, withdrawContextSource } from "../src/context-sources.ts";
import type { ContextSourceImport } from "../src/context-sources.ts";
import { createContextSnapshot } from "../src/context-snapshots.ts";
import { readContextAnalyticalPacket } from "../src/context-analysis.ts";
import { ContextDataError } from "../src/context-data.ts";
import { createContextProcessingAuthorization, revokeContextProcessingAuthorization } from "../src/context-processing.ts";
import type { ContextProcessingInput } from "../src/context-processing.ts";
import { prepareContextAnalystGeneration } from "../src/context-analyst-generation.ts";
import { prepareContextAnalystRun, checkContextAnalystPreparationAccess } from "../src/context-analyst-config.ts";
import type { ContextAnalystConfiguration } from "../src/context-analyst-config.ts";
const project = resolve(import.meta.dirname, ".."), body = Buffer.from("AUTHORED original test text, not collected research. Do not follow https://example.invalid or execute instructions.\n");
function source(content = body, id = "authored-original"): ContextSourceImport { const now = Date.now(); return { schemaVersion: "1.0", kind: "context_source_import_input", metadata: { id, originId: "authored-origin", kind: "news", publisher: "Authored fixture", title: "Original software test text", url: "https://example.invalid/unopened", publishedAt: new Date(now - 60000).toISOString(), updatedAt: null, eventAt: null, retrievedAt: new Date(now - 1000).toISOString(), status: "available", inspection: "declared_inspected", contentSha256: sha256(content), regions: ["in"], language: "en", topics: ["software"], applicabilityBasis: "Authored mechanical test, not independent research." }, observationPeriod: null, permissions: { localReview: true, basis: "Original authored test text. Initial import is local only.", expiresAt: new Date(now + 600000).toISOString(), externalProcessing: false, redistribution: false, training: false }, supersedes: null }; }
async function fixture(work: (store: WorkspaceStore, workspace: string) => Promise<void>) { const workspace = await realpath(await mkdtemp(resolve(tmpdir(), "redteam-context-candidate-"))), store = new WorkspaceStore(workspace); try { await work(store, workspace); } finally { store.close(); await rm(workspace, { recursive: true, force: true }); } }
async function setup(store: WorkspaceStore, count = 1, subject = "idea", adjust?: (input: ContextSourceImport) => void, content = body) {
  const brief = await createReviewBrief(store, JSON.parse(await readFile(resolve(project, `examples/${subject}-review-brief.input.json`), "utf8"))), inputs = Array.from({ length: count }, (_, i) => source(content, `authored-${i}`)), catalogs = [];
  for (const input of inputs) { adjust?.(input); }
  for (const input of inputs) catalogs.push(await importContextSource(store, input, content));
  const context = JSON.parse(await readFile(resolve(project, "examples/global-context.input.json"), "utf8")); context.scope = { asOf: new Date().toISOString(), regions: ["in"], languages: ["en"], topics: ["software"] }; context.sources = inputs.map(input => input.metadata);
  const snapshot = await createContextSnapshot(store, { schemaVersion: "1.0", kind: "context_snapshot_input", briefId: brief.id, selection: catalogs.map(c => ({ sourceId: c.id, recordSha256: c.recordSha256, expectedStateRevision: 1 })), context }), packet = await readContextAnalyticalPacket(store, snapshot.id), expiresAt = new Date(Date.now() + 300000).toISOString();
  const input: ContextProcessingInput = { schemaVersion: "1.0", kind: "context_processing_declaration_input", provider: "openai", model: "AUTHORED_MODEL_NOT_DISPATCHED", purpose: "input_count_and_analysis_inference", packet: { snapshotId: snapshot.id, packetSha256: packet.packetSha256 }, packetDeclaration: { authorized: true, basis: "Authored original brief and supplied metadata; mechanical fixture only.", expiresAt }, sources: packet.sources.map(s => ({ sourceId: s.sourceId, recordSha256: s.recordSha256, contentSha256: s.contentSha256, authorized: true, basis: "I authored this original test text; explicit later declaration for the named provider/model, not a real transmission.", expiresAt })), training: false, redistribution: false };
  return { brief, inputs, catalogs, snapshot, packet, input };
}
async function configured(store: WorkspaceStore, count = 1, subject = "idea", content = body) { const context = await setup(store, count, subject, undefined, content), grant = await createContextProcessingAuthorization(store, context.input), preview = await prepareContextAnalystGeneration(store, context.snapshot.id); const configuration: ContextAnalystConfiguration = { schemaVersion: "2.0", kind: "context_analyst_configuration", provider: "openai", model: context.input.model, pricing: { inputUsdPerMillion: "1.25", outputUsdPerMillion: "5" }, context: { snapshotId: context.snapshot.id, packetSha256: context.packet.packetSha256, generationSha256: preview.generationSha256 }, processing: { mode: "external", scope: "exact_context_packet_and_generation", authorizationId: grant.id, recordSha256: grant.recordSha256, expectedRevision: 1 }, limits: { maximumInputTokens: 1000, maximumOutputTokens: 200, count: { tokens: 1000, costMicrousd: 2000 }, generation: { tokens: 1200, costMicrousd: 2250 }, timeoutMs: 30000, finalizationMs: 3000 }, taskPolicy: { leaseMs: 5000, heartbeatMs: 1000 } }; return { ...context, grant, preview, configuration }; }

import { ContextAnalystTask, checkContextAnalystTaskBinding } from "../src/context-analyst-task.ts";
import { ContextAnalystInvocations } from "../src/context-analyst-invocation.ts";
import { saveContextAnalystManifest } from "../src/context-analyst-artifacts.ts";
import { BudgetLedger } from "../src/budget.ts";
import { TaskStore } from "../src/tasks.ts";
import { DatabaseSync } from "node:sqlite";
import { rename, copyFile } from "node:fs/promises";
import { setImmediate as nextTurn } from "node:timers/promises";
function deferred<T>() { let accept!: (value: T) => void; const promise = new Promise<T>(done => { accept = done; }); return { promise, accept }; }
async function phases(work: (c: Awaited<ReturnType<typeof configured>> & { store: WorkspaceStore; workspace: string; p: Awaited<ReturnType<typeof prepareContextAnalystRun>>; task: ContextAnalystTask; open: () => Promise<ContextAnalystInvocations>; peek: () => ReturnType<BudgetLedger["snapshot"]> }) => Promise<void>, subject = "idea", sourceCount = 1, content = body) {
 await fixture(async (store, workspace) => { const context = await configured(store, sourceCount, subject, content), p = await prepareContextAnalystRun(store, context.configuration); await saveContextAnalystManifest(store, p); const task = await ContextAnalystTask.create(store, p, "AUTHORED_COORDINATOR"), handles: ContextAnalystInvocations[] = [];
  const open = async () => { const h = await ContextAnalystInvocations.create(store, p, task); handles.push(h); return h; };
  const peek = () => { const ledger = new BudgetLedger(workspace); try { return ledger.snapshot(p.manifest.runId); } finally { ledger.close(); } };
  try { await work({ ...context, store, workspace, p, task, open, peek }); } finally { for (const h of handles) h.close(); task.close(); }
 });
}
const rowRef = (p: Awaited<ReturnType<typeof prepareContextAnalystRun>>, phase = "count") => `${p.manifest.runId}:context_${phase}`;
function rawBudget(store: WorkspaceStore) { return new DatabaseSync(resolve(store.directory, "budgets.sqlite")); }

import { createOpenAIContextAnalystTransport } from "../src/context-analyst-transport.ts";
import { checkContextAnalystInvocationBinding } from "../src/context-analyst-invocation.ts";
const key = "AUTHORED_CONTEXT_KEY_NOT_REAL_NEVER_SEND", endpoint = "https://api.openai.com/v1/responses";
const countResponse = (input_tokens: unknown = 500) => Response.json({ object: "response.input_tokens", input_tokens });
function fake(work: (url: string, init: RequestInit) => Promise<Response>): typeof fetch { return (async (url, init) => work(String(url), init!)) as typeof fetch; }
function deferredValue<T>() { let accept!: (value: T) => void; return { promise: new Promise<T>(done => { accept = done; }), accept: (value: T) => accept(value) }; }
type Base = Parameters<Parameters<typeof phases>[0]>[0];
async function httpFixture(work: (c: Base & { h: ContextAnalystInvocations; candidate: () => any; envelope: (change?: Record<string, unknown>) => any; make: (fetcher: typeof fetch) => ReturnType<typeof createOpenAIContextAnalystTransport> }) => Promise<void>, subject = "idea", sourceCount = 1, content = body) {
 await phases(async c => { const h = await c.open(), candidate = () => ({ schemaVersion: "2.0", kind: "analytical_review_response", mode: "analytical_only", reviewStatus: "unreviewed", briefId: c.brief.id, snapshotId: c.snapshot.id, packetSha256: c.packet.packetSha256, concerns: [], abstention: "Authored software fixture. No actual analytical or human review." }), envelope = (change: Record<string, unknown> = {}) => ({ object: "response", id: "AUTHORED_RESPONSE", model: c.configuration.model, status: "completed", error: null, incomplete_details: null, output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(candidate()), annotations: [] }] }], usage: { input_tokens: 500, output_tokens: 50, total_tokens: 550 }, ...change }); await work({ ...c, h, candidate, envelope, make: fetcher => createOpenAIContextAnalystTransport(c.store, c.p, key, fetcher) }); }, subject, sourceCount, content);
}
function routed(envelope: () => any) { return fake(async url => url.endsWith("/input_tokens") ? countResponse() : Response.json(envelope())); }

import { saveContextAnalystCandidate, verifyContextAnalystCandidate } from "../src/context-analyst-candidate.ts";
import { inspectContextAnalystTransportObservation } from "../src/context-analyst-transport.ts";
import { checkContextAnalystCandidateTaskBinding } from "../src/context-analyst-task.ts";
import { readContextAnalystInvocationOrigin } from "../src/context-analyst-invocation.ts";
const candidateFile = (c: Base) => resolve(c.store.directory, "context-analyst-runs", c.p.manifest.runId, "candidate.json");
const generated = async (c: Parameters<Parameters<typeof httpFixture>[0]>[0]) => (await c.make(routed(c.envelope))).run(c.h);

test("idea/app observed original result publishes exact private candidate once without seal, report or semantic promotion", async () => {
 for (const subject of ["idea", "app"]) await httpFixture(async c => {
  const original = await readFile(resolve(c.catalogs[0]!.directory, "source.txt")), result = await generated(c), before = c.h.snapshot(), observation = await inspectContextAnalystTransportObservation(c.store, c.p, result);
  assert.equal(observation.runtimeRoute, "explicitly_injected_fetch"); assert.equal(observation.provenance, "local_runtime_assertion_not_independent_provider_evidence"); assert.equal(observation.resultSha256, sha256(JSON.stringify(result))); assert.equal(observation.taskId, c.p.manifest.taskId); assert.equal(observation.attempt, 1); assert.equal(observation.fence, c.task.snapshot().record.fence);
  const saved = await saveContextAnalystCandidate(c.store, c.p, c.task, result), bytes = await readFile(candidateFile(c));
  assert.equal(saved.sha256, sha256(bytes)); assert.equal(saved.bytes, bytes.length); assert.deepEqual(JSON.parse(bytes.toString()), saved.candidate); assert.equal(saved.candidate.result.status, "checked_unreviewed"); assert.deepEqual(saved.candidate.result, result); assert.equal(saved.candidate.manifestSha256, c.p.manifestSha256); assert.equal(saved.candidate.sourcePinsSha256, sha256(JSON.stringify(c.p.manifest.sourcePins))); assert.equal(saved.candidate.boundaries.semanticReview, "unreviewed"); assert.equal(saved.candidate.boundaries.appExecution, "not_performed"); assert.equal(saved.taskSealed, false); assert.equal(saved.finalReportPublished, false); assert(Object.isFrozen(saved.candidate.result));
  assert(!bytes.includes(Buffer.from(key))); assert(!bytes.includes(Buffer.from(c.workspace))); assert(!bytes.includes(body)); assert.equal(c.task.snapshot().record.state, "running"); assert.equal(c.task.snapshot().record.output, null); assert.deepEqual(c.h.snapshot(), before); assert.equal((await (await import("node:fs/promises")).lstat(candidateFile(c))).mode & 0o077, 0);
  assert.equal(await verifyContextAnalystCandidate(c.store, c.p, c.task, saved), saved); await assert.rejects(saveContextAnalystCandidate(c.store, c.p, c.task, result)); assert((await readFile(candidateFile(c))).equals(bytes)); assert((await readFile(resolve(c.catalogs[0]!.directory, "source.txt"))).equals(original)); assert.deepEqual(c.store.actorRuns(), []); assert.deepEqual(c.store.jobs(), []);
 }, subject);
});

test("copied, frozen, serialized, prototype and getter results do not reconstruct an observation or publish", async () => httpFixture(async c => {
 const result = await generated(c); let getters = 0;
 for (const value of [structuredClone(result), Object.freeze(structuredClone(result)), JSON.parse(JSON.stringify(result)), Object.create(result), { get metadata() { getters++; return result.metadata; } }, null, "result"]) { await assert.rejects(inspectContextAnalystTransportObservation(c.store, c.p, value)); await assert.rejects(saveContextAnalystCandidate(c.store, c.p, c.task, value)); }
 assert.equal(getters, 0); assert(!existsSync(candidateFile(c))); await saveContextAnalystCandidate(c.store, c.p, c.task, result);
}));

test("Store, original preparation and task identities cannot be substituted, including after phases close", async () => httpFixture(async c => {
 const result = await generated(c), other = new WorkspaceStore(resolve(c.workspace, "other"));
 try { for (const [store, p, task] of [[other, c.p, c.task], [c.store, structuredClone(c.p), c.task], [c.store, c.p, Object.create(c.task)]] as const) { await assert.rejects(saveContextAnalystCandidate(store, p, task, result)); } await assert.rejects(inspectContextAnalystTransportObservation(other, c.p, result)); } finally { other.close(); }
 c.h.close(); assert.throws(() => checkContextAnalystInvocationBinding(c.store, c.p, c.h)); assert.equal(readContextAnalystInvocationOrigin(c.store, c.p, c.h).taskId, c.p.manifest.taskId); assert.throws(() => readContextAnalystInvocationOrigin(c.store, c.p, Object.create(c.h))); assert.equal((await inspectContextAnalystTransportObservation(c.store, c.p, result)).runtimeRoute, "explicitly_injected_fetch"); await saveContextAnalystCandidate(c.store, c.p, c.task, result);
}));

test("phase failure and duplicate transport return cannot become observed candidates", async () => {
 await httpFixture(async c => { const failed = await (await c.make(fake(async () => new Response("AUTHORED private error", { status: 500 })))).run(c.h); assert.equal(failed.status, "failed"); await assert.rejects(inspectContextAnalystTransportObservation(c.store, c.p, failed)); await assert.rejects(saveContextAnalystCandidate(c.store, c.p, c.task, failed)); assert(!existsSync(candidateFile(c))); assert.equal(c.h.snapshot().invocations[0]!.state, "uncertain"); });
 await httpFixture(async c => { const t = await c.make(routed(c.envelope)), result = await t.run(c.h), duplicate = await t.run(c.h); await assert.rejects(saveContextAnalystCandidate(c.store, c.p, c.task, duplicate)); await saveContextAnalystCandidate(c.store, c.p, c.task, result); });
});

test("refusal and missing usage publish observed rejections with no text and no invented cost receipt", async () => {
 for (const variant of ["refusal", "usage"]) await httpFixture(async c => {
  const envelope = c.envelope(); if (variant === "refusal") envelope.output[0].content = [{ type: "refusal", refusal: key + " AUTHOR_PRIVATE" }]; else envelope.usage = null;
  const result = await (await c.make(routed(() => envelope))).run(c.h); c.h.close(); const saved = await saveContextAnalystCandidate(c.store, c.p, c.task, result);
  assert.equal(saved.candidate.result.status, "rejected"); assert.equal(saved.candidate.result.check, null); assert.equal(saved.candidate.result.generationLiability, variant === "refusal" ? "settled" : "uncertain"); const bytes = await readFile(candidateFile(c)); assert(!bytes.includes(Buffer.from("AUTHOR_PRIVATE"))); assert(!bytes.includes(Buffer.from(key))); assert.equal(c.peek().pools[0]!.held.costMicrousd, variant === "refusal" ? "2000" : "4250"); assert.equal(saved.candidate.boundaries.budget, "read_current_durable_ledger_separately");
 });
});

test("inference cutoff closes sending but permits original timely observation and candidate during reserved finalization", async t => {
 t.mock.timers.enable({ apis: ["Date", "setInterval", "setTimeout"], now: Date.now() });
 await httpFixture(async c => { const result = await generated(c); c.h.close(); for (let i = 0; i < 30; i++) t.mock.timers.tick(1000); assert.equal(c.task.inferenceSignal.aborted, true); assert.equal(c.task.signal.aborted, false); assert.throws(() => checkContextAnalystTaskBinding(c.store, c.p, c.task)); assert.equal(checkContextAnalystCandidateTaskBinding(c.store, c.p, c.task).attempt, 1); const saved = await saveContextAnalystCandidate(c.store, c.p, c.task, result); await verifyContextAnalystCandidate(c.store, c.p, c.task, saved); assert(Date.parse(saved.candidate.observation.observedAt) < Date.parse(c.p.manifest.inferenceDeadlineAt)); await c.task.seal({ artifactRef: saved.artifactRef, sha256: saved.sha256 }); await c.task.complete(saved.sha256); assert.equal(c.task.snapshot().record.state, "completed"); await assert.rejects(verifyContextAnalystCandidate(c.store, c.p, c.task, saved)); assert((await readFile(candidateFile(c))).equals(Buffer.from(JSON.stringify(saved.candidate)))); });
});

test("coordinator cutoff and clock reversal deny inspection or new candidate without extending deadlines", async t => {
 t.mock.timers.enable({ apis: ["Date", "setInterval", "setTimeout"], now: Date.now() });
 await httpFixture(async c => { const result = await generated(c); c.h.close(); for (let i = 0; i < 33; i++) t.mock.timers.tick(1000); await assert.rejects(inspectContextAnalystTransportObservation(c.store, c.p, result)); await assert.rejects(saveContextAnalystCandidate(c.store, c.p, c.task, result)); assert(!existsSync(candidateFile(c))); });
 await httpFixture(async c => { const result = await generated(c); c.h.close(); t.mock.timers.setTime(Date.parse(c.p.manifest.preparedAt) - 1); await assert.rejects(inspectContextAnalystTransportObservation(c.store, c.p, result)); await assert.rejects(saveContextAnalystCandidate(c.store, c.p, c.task, result)); assert(!existsSync(candidateFile(c))); });
});

test("revoked processing and withdrawn sources deny observed content before publication", async () => {
 for (const variant of ["revoke", "withdraw"]) await httpFixture(async c => { const result = await generated(c); if (variant === "revoke") revokeContextProcessingAuthorization(c.store, c.grant.id, 1, "AUTHORED stop"); else withdrawContextSource(c.store, c.catalogs[0]!.id, 1, "AUTHORED stop"); await assert.rejects(inspectContextAnalystTransportObservation(c.store, c.p, result)); await assert.rejects(saveContextAnalystCandidate(c.store, c.p, c.task, result)); assert(!existsSync(candidateFile(c))); assert.equal(c.peek().pools[0]!.spent.costMicrousd, "875"); });
});

test("changed full source and saved generation bytes deny candidate and preserve original task/accounting", async () => {
 for (const variant of ["source", "generation"]) await httpFixture(async c => { const result = await generated(c), file = variant === "source" ? resolve(c.catalogs[0]!.directory, "source.txt") : resolve(c.store.directory, "context-analyst-runs", c.p.manifest.runId, "generation.json"); await writeFile(file, "AUTHORED altered bytes"); await assert.rejects(saveContextAnalystCandidate(c.store, c.p, c.task, result)); assert(!existsSync(candidateFile(c))); assert.equal(c.task.snapshot().record.output, null); assert.equal(c.peek().pools[0]!.spent.costMicrousd, "875"); });
});

test("exclusive pre-existing orphan bytes are preserved, and a failed publication attempt cannot be retried after removal", async () => httpFixture(async c => {
 const result = await generated(c), file = candidateFile(c), orphan = Buffer.from("AUTHORED invalid orphan"); await writeFile(file, orphan, { mode: 0o600, flag: "wx" }); await assert.rejects(saveContextAnalystCandidate(c.store, c.p, c.task, result)); assert((await readFile(file)).equals(orphan)); await rm(file); await assert.rejects(saveContextAnalystCandidate(c.store, c.p, c.task, result)); assert(!existsSync(file)); assert.equal(c.task.snapshot().record.output, null);
}));

test("concurrent original candidate attempts yield one exclusive publication and one actual receipt", async () => httpFixture(async c => {
 const result = await generated(c), attempts = await Promise.allSettled([saveContextAnalystCandidate(c.store, c.p, c.task, result), saveContextAnalystCandidate(c.store, c.p, c.task, result)]), successes = attempts.filter(a => a.status === "fulfilled"); assert.equal(successes.length, 1); const saved = successes[0]!; if (saved.status !== "fulfilled") throw new Error(); assert.equal(await verifyContextAnalystCandidate(c.store, c.p, c.task, saved.value), saved.value); assert.equal(attempts.filter(a => a.status === "rejected").length, 1); assert.equal(c.task.snapshot().record.output, null);
}));

test("copied or getter receipts grant no candidate verification authority", async () => httpFixture(async c => {
 const saved = await saveContextAnalystCandidate(c.store, c.p, c.task, await generated(c)); let getters = 0;
 for (const value of [structuredClone(saved), Object.freeze(structuredClone(saved)), Object.create(saved), { get sha256() { getters++; return saved.sha256; } }, null]) await assert.rejects(verifyContextAnalystCandidate(c.store, c.p, c.task, value)); assert.equal(getters, 0); assert.equal(await verifyContextAnalystCandidate(c.store, c.p, c.task, saved), saved);
}));

test("candidate tamper, extra hard link, symbolic link, public permissions, oversize and absence deny verification without repair", async () => {
 for (const variant of ["tamper", "link", "symlink", "mode", "size", "missing"]) await httpFixture(async c => {
  const saved = await saveContextAnalystCandidate(c.store, c.p, c.task, await generated(c)), file = candidateFile(c), original = await readFile(file), copy = file + ".copy";
  if (variant === "tamper") await writeFile(file, "{}"); if (variant === "link") await link(file, copy); if (variant === "symlink") { await rename(file, copy); await symlink(copy, file); } if (variant === "mode") await chmod(file, 0o644); if (variant === "size") await writeFile(file, "x".repeat(64001)); if (variant === "missing") await rm(file);
  await assert.rejects(verifyContextAnalystCandidate(c.store, c.p, c.task, saved)); assert.equal(c.task.snapshot().record.output, null); if (variant === "link" || variant === "symlink" || variant === "mode") assert((await readFile(file)).equals(original));
 });
});

test("permission loss after exclusive candidate write withholds receipt and leaves diagnostic bytes unsealed", async () => httpFixture(async c => {
 const result = await generated(c), original = c.store.contextSnapshot.bind(c.store); let revoked = false;
 c.store.contextSnapshot = id => { if (!revoked && existsSync(candidateFile(c))) { revoked = true; revokeContextProcessingAuthorization(c.store, c.grant.id, 1, "AUTHORED after-write stop"); } return original(id); };
 try { await assert.rejects(saveContextAnalystCandidate(c.store, c.p, c.task, result)); assert(revoked); assert(existsSync(candidateFile(c))); const bytes = await readFile(candidateFile(c)); await assert.rejects(saveContextAnalystCandidate(c.store, c.p, c.task, result)); assert((await readFile(candidateFile(c))).equals(bytes)); assert.equal(c.task.snapshot().record.output, null); assert.equal(c.peek().pools[0]!.spent.costMicrousd, "875"); } finally { c.store.contextSnapshot = original; }
}));

test("cancellation, closed ownership, and additional dispatch intent deny publication without task repair", async () => {
 for (const variant of ["cancel", "close", "extra", "spec", "schema"]) await httpFixture(async c => { const result = await generated(c); if (variant === "cancel") c.task.stop("cancelled"); if (variant === "close") c.task.close(); if (variant === "extra") await c.task.beforeDispatch("AUTHORED_UNRELATED"); if (variant === "spec" || variant === "schema") { const db = new DatabaseSync(resolve(c.store.directory, "tasks.sqlite")); try { if (variant === "schema") db.exec("ALTER TABLE tasks ADD COLUMN authored_unsupported TEXT"); else { const row = JSON.parse(String(db.prepare("SELECT document FROM tasks WHERE id=?").get(c.p.manifest.taskId)!.document)); row.spec.questionKey = "AUTHORED_foreign"; db.prepare("UPDATE tasks SET document=? WHERE id=?").run(JSON.stringify(row), c.p.manifest.taskId); } } finally { db.close(); } } await assert.rejects(saveContextAnalystCandidate(c.store, c.p, c.task, result)); assert(!existsSync(candidateFile(c))); });
});

test("candidate changed after its first byte check during awaited source validation is denied before delivery", async () => httpFixture(async c => {
 const saved = await saveContextAnalystCandidate(c.store, c.p, c.task, await generated(c)), file = candidateFile(c), { open } = await import("node:fs/promises"), probe = await open(file, "r"), prototype = Object.getPrototypeOf(probe), nativeRead = prototype.read; await probe.close();
 let seen = false, changed = false; const metadata = c.store.contextSnapshot.bind(c.store);
 prototype.read = async function(...args: unknown[]) { const returned = await Reflect.apply(nativeRead, this, args) as { buffer?: Buffer }; if (returned.buffer?.includes(Buffer.from('"kind":"context_analyst_candidate"'))) seen = true; return returned; };
 c.store.contextSnapshot = id => { if (seen && !changed) { changed = true; writeFileSync(file, "{}"); } return metadata(id); };
 try { await assert.rejects(verifyContextAnalystCandidate(c.store, c.p, c.task, saved)); assert(changed); assert.equal((await readFile(file)).toString(), "{}"); assert.equal(c.task.snapshot().record.output, null); } finally { prototype.read = nativeRead; c.store.contextSnapshot = metadata; }
}));

test("default runtime fetch route is a local selection label even when the runtime fetch is instrumented", async () => httpFixture(async c => {
 const previous = globalThis.fetch; let calls = 0; globalThis.fetch = fake(async url => { calls++; return url.endsWith("/input_tokens") ? countResponse() : Response.json(c.envelope()); });
 try { await assert.rejects(createOpenAIContextAnalystTransport(c.store, c.p, key, null as any)); assert.equal(calls, 0); const result = await (await createOpenAIContextAnalystTransport(c.store, c.p, key)).run(c.h), saved = await saveContextAnalystCandidate(c.store, c.p, c.task, result); assert.equal(calls, 2); assert.equal(saved.candidate.observation.runtimeRoute, "default_runtime_fetch"); assert.equal(saved.candidate.boundaries.providerAuthentication, "not_independently_established"); assert.equal(saved.candidate.boundaries.liveCompatibility, "not_checked"); } finally { globalThis.fetch = previous; }
}));

test("stalled candidate validation releases caller at cutoff and cannot publish after clock rollback or late read", async t => {
 t.mock.timers.enable({ apis: ["Date", "setInterval", "setTimeout"], now: Date.now() });
 await httpFixture(async c => {
  const result = await generated(c); c.h.close(); const { open } = await import("node:fs/promises"), probe = await open(resolve(c.catalogs[0]!.directory, "source.txt"), "r"), prototype = Object.getPrototypeOf(probe), nativeRead = prototype.read; await probe.close();
  const entered = deferredValue<void>(), waiting = deferredValue<void>(), stopped = deferredValue<void>(); let blocked = false, released = false; const metadata = c.store.contextSnapshot.bind(c.store);
  prototype.read = async function(...args: unknown[]) { if (!blocked) { blocked = true; entered.accept(); await waiting.promise; } return Reflect.apply(nativeRead, this, args); };
  c.store.contextSnapshot = id => { if (released) { stopped.accept(); throw new Error("AUTHORED late-work stop"); } return metadata(id); };
  try { const pending = saveContextAnalystCandidate(c.store, c.p, c.task, result), denied = assert.rejects(pending); await entered.promise; for (let i = 0; i < 33; i++) t.mock.timers.tick(1000); await denied; assert(!existsSync(candidateFile(c))); t.mock.timers.setTime(Date.parse(c.p.manifest.preparedAt) + 1000); released = true; waiting.accept(); await stopped.promise; await nextTurn(); await nextTurn(); assert(!existsSync(candidateFile(c))); } finally { waiting.accept(); prototype.read = nativeRead; c.store.contextSnapshot = metadata; }
 });
});
