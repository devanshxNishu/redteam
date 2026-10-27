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
async function fixture(work: (store: WorkspaceStore, workspace: string) => Promise<void>) { const workspace = await realpath(await mkdtemp(resolve(tmpdir(), "redteam-context-candidate-reader-"))), store = new WorkspaceStore(workspace); try { await work(store, workspace); } finally { store.close(); await rm(workspace, { recursive: true, force: true }); } }
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

import { readContextAnalystCandidate } from "../src/context-analyst-candidate-reader.ts";
const readRows = (c: Base) => { const db = new DatabaseSync(resolve(c.store.directory, "tasks.sqlite"), { readOnly: true }); try { return { rows: db.prepare("SELECT * FROM tasks ORDER BY id").all(), events: db.prepare("SELECT * FROM task_events ORDER BY id").all() }; } finally { db.close(); } };
async function sealedFixture(work: (c: Parameters<Parameters<typeof httpFixture>[0]>[0] & { saved: Awaited<ReturnType<typeof saveContextAnalystCandidate>> }) => Promise<void>, subject = "idea", completed = true, output?: (c: Parameters<Parameters<typeof httpFixture>[0]>[0]) => any) { await httpFixture(async c => { const result = output ? await (await c.make(routed(() => output(c)))).run(c.h) : await generated(c); c.h.close(); const saved = await saveContextAnalystCandidate(c.store, c.p, c.task, result); await c.task.seal({ artifactRef: saved.artifactRef, sha256: saved.sha256 }); if (completed) await c.task.complete(saved.sha256); await work({ ...c, saved }); }, subject); }
function alterTask(c: Base, change: (record: any) => void) { const db = new DatabaseSync(resolve(c.store.directory, "tasks.sqlite")); try { const record = JSON.parse(String(db.prepare("SELECT document FROM tasks WHERE id=?").get(c.p.manifest.taskId)!.document)); change(record); db.prepare("UPDATE tasks SET document=? WHERE id=?").run(JSON.stringify(record), c.p.manifest.taskId); } finally { db.close(); } }

test("historical idea/app sealed/completed candidates preserve exact source, candidate and task bytes with no receipt or acceptance", async () => {
 for (const subject of ["idea", "app"]) for (const completed of [false, true]) await sealedFixture(async c => {
  const before = readRows(c), bytes = await readFile(candidateFile(c)), sourceBytes = await readFile(resolve(c.catalogs[0]!.directory, "source.txt"));
  const value = await readContextAnalystCandidate(c.store, c.p.manifest.taskId); assert.equal(value.kind, "checked_historical_context_candidate"); assert.equal(value.sha256, c.saved.sha256); assert.deepEqual(value.candidate, c.saved.candidate); assert.equal(value.task.state, completed ? "completed" : "sealed"); assert.equal(value.boundaries.executionAuthority, "not_granted"); assert.equal(value.boundaries.runtimeObservation, "not_recreated"); assert.equal(value.boundaries.finalReport, "not_verified"); assert.equal(value.boundaries.semanticReview, "unreviewed"); assert(Object.isFrozen(value.candidate)); assert(!JSON.stringify(value).includes(c.workspace)); assert(!JSON.stringify(value).includes(key)); assert(!JSON.stringify(value).includes(body.toString()));
  await assert.rejects(verifyContextAnalystCandidate(c.store, c.p, c.task, value)); await assert.rejects(inspectContextAnalystTransportObservation(c.store, c.p, value.candidate.result)); assert.throws(() => checkContextAnalystPreparationAccess(c.store, value as any)); assert.deepEqual(readRows(c), before); assert((await readFile(candidateFile(c))).equals(bytes)); assert((await readFile(resolve(c.catalogs[0]!.directory, "source.txt"))).equals(sourceBytes));
  c.task.close(); const other = new WorkspaceStore(c.workspace); try { assert.deepEqual(await readContextAnalystCandidate(other, c.p.manifest.taskId), value); } finally { other.close(); }
 }, subject, completed);
});

test("historical candidate remains data after task cutoff while current processing/source rights permit, then expiry denies", async t => {
 t.mock.timers.enable({ apis: ["Date", "setInterval", "setTimeout"], now: Date.now() }); await sealedFixture(async c => { const before = readRows(c), bytes = await readFile(candidateFile(c)); for (let i = 0; i < 34; i++) t.mock.timers.tick(1000); assert.throws(() => checkContextAnalystPreparationAccess(c.store, c.p)); const value = await readContextAnalystCandidate(c.store, c.p.manifest.taskId); assert.equal(value.task.state, "completed"); assert.equal(value.boundaries.finalReport, "not_verified"); t.mock.timers.setTime(Date.parse(c.grant.expiresAt) + 1); await assert.rejects(readContextAnalystCandidate(c.store, c.p.manifest.taskId)); assert.deepEqual(readRows(c), before); assert((await readFile(candidateFile(c))).equals(bytes)); });
});

test("valid unsealed candidate, wrong task/run identifier and absent database grant no historical result or new records", async () => {
 await httpFixture(async c => { const saved = await saveContextAnalystCandidate(c.store, c.p, c.task, await generated(c)); c.task.close(); const before = readRows(c); await assert.rejects(readContextAnalystCandidate(c.store, c.p.manifest.taskId)); await assert.rejects(readContextAnalystCandidate(c.store, c.p.manifest.runId)); await assert.rejects(readContextAnalystCandidate(c.store, randomUUID())); assert.deepEqual(readRows(c), before); assert.equal(sha256(await readFile(candidateFile(c))), saved.sha256); });
 await fixture(async (store, workspace) => { await assert.rejects(readContextAnalystCandidate(store, randomUUID())); for (const name of ["tasks.sqlite", "budgets.sqlite", "context-analyst-runs"]) assert(!existsSync(resolve(store.directory, name))); assert.deepEqual(store.jobs(), []); });
});

test("complete canonical candidate grammar rejects altered declarations even with an operator-rehashed seal", async () => sealedFixture(async c => {
 const original = await readFile(candidateFile(c)), before = readRows(c);
 const changes: ((r: any) => void)[] = [r => r.kind = "accepted_analysis", r => r.extra = true, r => r.manifestSha256 = "b".repeat(64), r => r.packetSha256 = "b".repeat(64), r => r.sourcePinsSha256 = "b".repeat(64), r => r.processingRecordSha256 = "b".repeat(64), r => r.observation.runtimeRoute = "authenticated_provider", r => r.observation.provenance = "independent_provider_evidence", r => r.observation.observedAt = c.p.manifest.inferenceDeadlineAt, r => r.observation.observedAt = new Date(Date.parse(c.p.manifest.preparedAt) - 1).toISOString(), r => r.observation.attempt = 2, r => r.observation.fence = 2, r => r.observation.resultSha256 = "b".repeat(64), r => r.result.metadata.generationRequestSha256 = "b".repeat(64), r => r.result.metadata.limits.requestBytes++, r => r.result.metadata.liveVerification = "performed", r => r.result.metadata.context.asOf = new Date(Date.parse(r.result.metadata.context.asOf) + 1).toISOString(), r => r.result.requestsStarted.generation = false, r => r.result.countedInputTokens = 0, r => r.result.countedInputTokens = 1001, r => r.result.countResponseSha256 = null, r => r.result.generationLiability = "uncertain", r => r.result.status = "failed", r => r.result.reason = "refused", r => r.result.provider.model = "OTHER_AUTHORED_MODEL", r => r.result.provider.status = "incomplete", r => r.result.provider.responseId = "invalid id", r => r.result.provider.responseSha256 = "invalid", r => r.result.check.checks.semanticReview = "approved", r => r.result.check.response.packetSha256 = "b".repeat(64), r => r.boundaries.publication = "final_report", r => r.boundaries.appExecution = "passed"];
 try { for (const change of changes) { const value = JSON.parse(original.toString()); change(value); const bytes = Buffer.from(JSON.stringify(value)); await writeFile(candidateFile(c), bytes); alterTask(c, row => row.output.sha256 = sha256(bytes)); await assert.rejects(readContextAnalystCandidate(c.store, c.p.manifest.taskId)); } }
 finally { await writeFile(candidateFile(c), original); alterTask(c, row => row.output.sha256 = c.saved.sha256); }
 assert.deepEqual(readRows(c), before); assert.equal((await readContextAnalystCandidate(c.store, c.p.manifest.taskId)).sha256, c.saved.sha256);
}));

test("noncanonical JSON, duplicate keys, escaped spelling, invalid UTF-8 and oversized input remain unavailable despite rehashed output pins", async () => sealedFixture(async c => {
 const original = await readFile(candidateFile(c)), variants = [Buffer.from(JSON.stringify(c.saved.candidate, null, 2)), Buffer.from(original.toString().replace('"schemaVersion":"2.0"', '"schemaVersion":"2.0","schemaVersion":"2.0"')), Buffer.from(original.toString().replace('"unreviewed"', '"\\u0075nreviewed"')), Buffer.from("null"), Buffer.from("[]"), Buffer.from([0xc3,0x28]), Buffer.alloc(64001,0x78)];
 try { for (const bytes of variants) { await writeFile(candidateFile(c), bytes); alterTask(c, row => row.output.sha256 = sha256(bytes)); await assert.rejects(readContextAnalystCandidate(c.store, c.p.manifest.taskId)); } } finally { await writeFile(candidateFile(c), original); alterTask(c, row => row.output.sha256 = c.saved.sha256); }
 assert.equal((await readContextAnalystCandidate(c.store, c.p.manifest.taskId)).sha256, c.saved.sha256);
}));

test("task state, attempt, fence, timing, lease, spec, intent and output mutations cannot promote historical content", async () => sealedFixture(async c => {
 const original = JSON.parse(String(readRows(c).rows[0]!.document));
 const changes: ((r: any) => void)[] = [r => r.state = "running", r => r.state = "cancelled", r => r.attempt = 2, r => r.fence = 2, r => r.lease = { owner: "AUTHORED" }, r => r.stopReason = "AUTHORED", r => r.spec.questionKey = "supplied-brief-analysis", r => r.spec.kind = "actor", r => r.spec.maximumAttempts = 2, r => r.spec.deadlineAt = new Date(Date.parse(r.spec.deadlineAt)+1).toISOString(), r => r.spec.manifestHash = "b".repeat(64), r => r.dispatchIntents.pop(), r => r.dispatchIntents.reverse(), r => r.dispatchIntents[0].attempt = 2, r => r.output.artifactRef = "OTHER", r => r.output.sha256 = "b".repeat(64), r => r.createdAt = c.p.manifest.inferenceDeadlineAt, r => r.updatedAt = c.p.manifest.coordinatorDeadlineAt, r => r.createdAt = new Date(Date.parse(c.p.manifest.preparedAt)-1).toISOString()];
 try { for (const change of changes) { alterTask(c, r => { Object.assign(r, structuredClone(original)); change(r); }); await assert.rejects(readContextAnalystCandidate(c.store, c.p.manifest.taskId)); } } finally { alterTask(c, r => Object.assign(r, original)); }
 assert.equal((await readContextAnalystCandidate(c.store, c.p.manifest.taskId)).sha256, c.saved.sha256);
}));

test("observed rejected candidates preserve refusal, incomplete, failed, mismatch, invalid and unknown usage without inventing receipt facts", async () => {
 for (const variant of ["refusal", "refusal_unknown", "incomplete", "failed", "error", "model", "invalid", "usage", "drift"]) await sealedFixture(async c => { const value = await readContextAnalystCandidate(c.store, c.p.manifest.taskId); assert.equal(value.candidate.result.status, "rejected"); assert.equal(value.candidate.result.check, null); assert.equal(value.boundaries.budget, "read_current_durable_ledger_separately"); assert.deepEqual(value.candidate, c.saved.candidate); }, "idea", true, c => { const value = c.envelope(); if (variant === "refusal" || variant === "refusal_unknown") value.output[0].content = [{ type: "refusal", refusal: "AUTHORED private text" }]; if (variant === "incomplete" || variant === "failed") value.status = variant; if (variant === "model") value.model = "OTHER_AUTHORED_MODEL"; if (variant === "invalid") value.output[0].content[0].text = "{}"; if (variant === "usage" || variant === "refusal_unknown") value.usage = null; if (variant === "error") value.error = { code: "AUTHORED_PRIVATE_ERROR" }; if (variant === "drift") { value.usage.input_tokens++; value.usage.total_tokens++; } return value; });
});

test("source withdrawal and processing revocation deny historical inspection without altering saved bytes or task rows", async () => {
 for (const variant of ["withdraw", "revoke"]) await sealedFixture(async c => { const before = readRows(c), bytes = await readFile(candidateFile(c)); if (variant === "withdraw") withdrawContextSource(c.store, c.catalogs[0]!.id, 1, "AUTHORED historical stop"); else revokeContextProcessingAuthorization(c.store, c.grant.id, 1, "AUTHORED historical stop"); await assert.rejects(readContextAnalystCandidate(c.store, c.p.manifest.taskId)); assert.deepEqual(readRows(c), before); assert((await readFile(candidateFile(c))).equals(bytes)); });
});

test("candidate or task mutation after initial read during awaited source validation is denied at final delivery", async () => {
 for (const variant of ["candidate", "task"]) await sealedFixture(async c => {
  const { open } = await import("node:fs/promises"), probe = await open(candidateFile(c), "r"), prototype = Object.getPrototypeOf(probe), nativeRead = prototype.read; await probe.close(); let seen = false, changed = false; const metadata = c.store.contextSnapshot.bind(c.store);
  prototype.read = async function(...args: unknown[]) { const value = await Reflect.apply(nativeRead,this,args) as { buffer?: Buffer }; if (value.buffer?.includes(Buffer.from('"kind":"context_analyst_candidate"'))) seen = true; return value; };
  c.store.contextSnapshot = id => { if (seen && !changed) { changed = true; if (variant === "candidate") writeFileSync(candidateFile(c), "{}"); else alterTask(c, row => { row.state = "cancelled"; row.fence++; }); } return metadata(id); };
  try { await assert.rejects(readContextAnalystCandidate(c.store, c.p.manifest.taskId)); assert(changed); } finally { prototype.read = nativeRead; c.store.contextSnapshot = metadata; }
 });
});

test("source and processing rights lost during the final candidate read are checked synchronously before delivery", async () => {
 for (const variant of ["withdraw", "revoke"]) await sealedFixture(async c => {
  const { open } = await import("node:fs/promises"), probe = await open(candidateFile(c), "r"), prototype = Object.getPrototypeOf(probe), nativeRead = prototype.read; await probe.close(); let candidateReads = 0, changed = false;
  prototype.read = async function(...args: unknown[]) { const value = await Reflect.apply(nativeRead,this,args) as { bytesRead: number; buffer?: Buffer }; if (value.bytesRead && value.buffer?.includes(Buffer.from('"kind":"context_analyst_candidate"')) && ++candidateReads === 2) { changed = true; if (variant === "withdraw") withdrawContextSource(c.store, c.catalogs[0]!.id, 1, "AUTHORED final read stop"); else revokeContextProcessingAuthorization(c.store, c.grant.id, 1, "AUTHORED final read stop"); } return value; };
  try { await assert.rejects(readContextAnalystCandidate(c.store, c.p.manifest.taskId)); assert(changed); assert.equal(c.task.snapshot().record.state, "completed"); } finally { prototype.read = nativeRead; }
 });
});

test("unsafe candidate bytes, paths and current source files are denied without permission normalization or row repair", async () => sealedFixture(async c => {
 const file = candidateFile(c), original = await readFile(file), before = readRows(c), copy = file + ".copy", source = resolve(c.catalogs[0]!.directory, "source.txt"), sourceBytes = await readFile(source);
 for (const variant of ["mode", "link", "symlink", "missing", "source"]) {
  try { if (variant === "mode") await chmod(file,0o644); if (variant === "link") await link(file,copy); if (variant === "symlink") { await rename(file,copy); await symlink(copy,file); } if (variant === "missing") await rename(file,copy); if (variant === "source") await writeFile(source,"AUTHORED changed source bytes"); await assert.rejects(readContextAnalystCandidate(c.store,c.p.manifest.taskId)); if (variant === "mode") assert.equal((await (await import("node:fs/promises")).lstat(file)).mode & 0o077,0o044); assert.deepEqual(readRows(c),before); }
  finally { if (variant === "mode") await chmod(file,0o600); if (variant === "link") await rm(copy); if (variant === "symlink") { await rm(file); await rename(copy,file); } if (variant === "missing") await rename(copy,file); if (variant === "source") await writeFile(source,sourceBytes); }
 }
 assert((await readFile(file)).equals(original)); assert.equal((await readContextAnalystCandidate(c.store,c.p.manifest.taskId)).sha256,c.saved.sha256);
}));

test("task DB permissions, hard links, dangling symlinks and unsupported schema remain denied and unrepaired", async () => {
 for (const variant of ["mode", "link", "symlink", "schema"]) await sealedFixture(async c => {
  c.task.close(); const file = resolve(c.store.directory,"tasks.sqlite"), copy = file + ".saved", before = await readFile(file);
  if (variant === "mode") await chmod(file,0o644); if (variant === "link") await link(file,copy); if (variant === "symlink") { await rename(file,copy); await symlink(file + ".absent",file); } if (variant === "schema") { const db = new DatabaseSync(file); try { db.exec("ALTER TABLE tasks ADD COLUMN authored_unsupported TEXT"); } finally { db.close(); } }
  await assert.rejects(readContextAnalystCandidate(c.store,c.p.manifest.taskId));
  if (variant === "mode") { assert.equal((await (await import("node:fs/promises")).lstat(file)).mode & 0o077,0o044); assert((await readFile(file)).equals(before)); } if (variant === "link") { assert((await readFile(copy)).equals(before)); assert.equal((await (await import("node:fs/promises")).lstat(file)).nlink,2); } if (variant === "symlink") { assert(!existsSync(file + ".absent")); assert((await readFile(copy)).equals(before)); } if (variant === "schema") { const db = new DatabaseSync(file,{readOnly:true}); try { assert(db.prepare("PRAGMA table_info(tasks)").all().some(r => r.name === "authored_unsupported")); } finally { db.close(); } }
 });
});

test("DB inode replacement during the final candidate read cannot deliver rows from an old open connection", async () => sealedFixture(async c => {
 c.task.close(); const file = resolve(c.store.directory,"tasks.sqlite"), { open,stat } = await import("node:fs/promises"), info = await stat(file,{bigint:true}), probe = await open(candidateFile(c),"r"), prototype = Object.getPrototypeOf(probe), nativeRead = prototype.read; await probe.close(); let candidateReads = 0, changed = false;
 prototype.read = async function(...args: unknown[]) { const value = await Reflect.apply(nativeRead,this,args) as { bytesRead:number; buffer?:Buffer }; if(value.bytesRead && value.buffer?.includes(Buffer.from('"kind":"context_analyst_candidate"')) && ++candidateReads === 2){ await rename(file,file + ".saved"); await copyFile(file + ".saved",file); changed = true; } return value; };
 try { await assert.rejects(readContextAnalystCandidate(c.store,c.p.manifest.taskId)); assert(changed); assert.notEqual((await stat(file,{bigint:true})).ino,info.ino); assert.equal(sha256(await readFile(candidateFile(c))),c.saved.sha256); } finally { prototype.read = nativeRead; }
}));
