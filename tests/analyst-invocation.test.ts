import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";
import { setImmediate as nextTurn } from "node:timers/promises";
import { WorkspaceStore } from "../src/workspace.ts";
import { createReviewBrief } from "../src/review-briefs.ts";
import { readAnalyticalPacket } from "../src/analytical-review.ts";
import { prepareAnalystRun } from "../src/analyst-config.ts";
import { AnalystTask } from "../src/analyst-task.ts";
import { AnalystInvocations, AnalystInvocationError } from "../src/analyst-invocation.ts";
import { BudgetLedger } from "../src/budget.ts";
import { sha256 } from "../src/evidence.ts";

type Preparation = Awaited<ReturnType<typeof prepareAnalystRun>>;
function deferred<T>() { let accept!: (value: T) => void; const promise = new Promise<T>(done => { accept = done; }); return { promise, accept }; }
async function fixture(work: (context: { workspace: string; preparation: Preparation; task: AnalystTask; open: () => AnalystInvocations; budget: () => ReturnType<BudgetLedger["snapshot"]>; denySource: () => void }) => Promise<void>, timeoutMs = 5000) {
  const workspace = await mkdtemp(resolve(tmpdir(), "redteam-analyst-invocation-")), store = new WorkspaceStore(workspace), handles: AnalystInvocations[] = [];
  let task: AnalystTask | undefined, allowed = true;
  try {
    const input = JSON.parse(await readFile(resolve(import.meta.dirname, "../examples/idea-review-brief.input.json"), "utf8")), brief = await createReviewBrief(store, input), packet = await readAnalyticalPacket(store, brief.id);
    const preparation = await prepareAnalystRun(store, brief.id, { schemaVersion: "1.0", kind: "analyst_configuration", provider: "openai", model: "authored-invocation-fixture", pricing: { inputUsdPerMillion: "1", outputUsdPerMillion: "1" }, processing: { mode: "external", provider: "openai", scope: "exact_brief_packet_and_generation", briefId: brief.id, packetSha256: packet.packetSha256, authorized: true, basis: "Authored software declaration; no provider request.", expiresAt: new Date(Date.now() + 600000).toISOString() }, limits: { maximumInputTokens: 1000, maximumOutputTokens: 100, count: { tokens: 1000, costMicrousd: 1000 }, generation: { tokens: 1100, costMicrousd: 1100 }, timeoutMs, finalizationMs: 1000 }, taskPolicy: { leaseMs: 2000, heartbeatMs: 200 } });
    task = new AnalystTask(workspace, { taskId: preparation.manifest.taskId, runId: preparation.manifest.runId, questionKey: preparation.manifest.questionKey, manifestHash: preparation.manifestSha256, deadlineAt: preparation.manifest.coordinatorDeadlineAt, owner: "authored-coordinator" }, () => { if (!allowed) throw new Error("PRIVATE source reason"); }, preparation.manifest.configuration.taskPolicy);
    const active = task;
    const open = () => { const handle = new AnalystInvocations(workspace, preparation, active); handles.push(handle); return handle; };
    const budget = () => { const ledger = new BudgetLedger(workspace); try { return ledger.snapshot(preparation.manifest.runId); } finally { ledger.close(); } };
    await work({ workspace, preparation, task: active, open, budget, denySource: () => { allowed = false; } });
  } finally { for (const handle of handles) handle.close(); task?.close(); store.close(); await rm(workspace, { recursive: true, force: true }); }
}

test("phase accounting denies mismatched manifest/task or source before creating a budget", async () => fixture(async ({ workspace, preparation, task, denySource }) => {
  for (const change of [{ taskId: "different" }, { packetSha256: "b".repeat(64) }, { maximumAttempts: 2 }, { budget: { ...preparation.manifest.budget, count: { tokens: 1, costMicrousd: 1 } } }]) {
    const manifest = { ...preparation.manifest, ...change }, altered = { ...preparation, manifest, manifestSha256: sha256(JSON.stringify(manifest)) } as Preparation;
    assert.throws(() => new AnalystInvocations(workspace, altered, task), AnalystInvocationError);
    assert.equal(existsSync(resolve(workspace, ".redteam/budgets.sqlite")), false);
  }
  denySource(); assert.throws(() => new AnalystInvocations(workspace, preparation, task));
  assert.equal(existsSync(resolve(workspace, ".redteam/budgets.sqlite")), false);
}));

test("successful count holds its full liability while generation settles only a trusted transport receipt", async () => fixture(async ({ preparation, task, open, budget }) => {
  const phases = open(); let callbacks = 0;
  const counted = await phases.count(async context => { callbacks++; assert.equal(context.invocationRef, preparation.manifest.runId + ":count"); assert.deepEqual(context.maximum, { tokens: 1000, costMicrousd: 1000 }); assert(Object.isFrozen(context)); return 500; });
  assert.equal(counted, 500); assert.equal(budget().invocations[0]?.state, "uncertain"); assert.equal(budget().pools[0]?.held.costMicrousd, "1000");
  const result = await phases.generate(async context => { callbacks++; assert.equal(context.inputTokens, 500); assert.equal(context.maximumOutputTokens, 100); assert.deepEqual(context.maximum, { tokens: 1100, costMicrousd: 1100 }); return { value: { status: "authored_unreviewed_candidate" }, usage: { tokens: 550, costMicrousd: 550 } }; });
  assert.deepEqual(result, { value: { status: "authored_unreviewed_candidate" }, liability: "settled" }); assert.equal(callbacks, 2);
  const snapshot = budget(); assert.deepEqual(snapshot.run.cap, { tokens: 2100, costMicrousd: 2100 }); assert.equal(snapshot.pools[0]?.held.costMicrousd, "1000"); assert.equal(snapshot.pools[0]?.spent.costMicrousd, "550"); assert.equal(snapshot.pools[0]?.available.costMicrousd, 550);
  assert.equal(task.snapshot().record.state, "running"); assert.equal(task.snapshot().record.output, null); assert.equal(task.snapshot().record.dispatchIntents.length, 2);
}));

test("phase order and concurrent duplicate calls cannot replay count or generation", async () => fixture(async ({ open, budget }) => {
  const phases = open(), count = deferred<number>(), generation = deferred<{ value: string; usage: unknown }>(); let calls = 0;
  await assert.rejects(phases.generate(async () => { calls++; return { value: "bad", usage: null }; }), AnalystInvocationError);
  const pendingCount = phases.count(() => { calls++; return count.promise; }); await assert.rejects(phases.count(async () => { calls++; return 1; }), AnalystInvocationError);
  count.accept(400); assert.equal(await pendingCount, 400);
  const pendingGeneration = phases.generate(() => { calls++; return generation.promise; }); await assert.rejects(phases.generate(async () => { calls++; return { value: "duplicate", usage: null }; }), AnalystInvocationError);
  generation.accept({ value: "opaque candidate", usage: { tokens: 420, costMicrousd: 420 } }); await pendingGeneration;
  await assert.rejects(phases.count(async () => 1), AnalystInvocationError); assert.equal(calls, 2); assert.equal(budget().invocations.length, 2);
}));

test("invalid counted tokens preserve unknown liability and block generation", async () => {
  for (const count of [0, -1, NaN, 1001]) await fixture(async ({ open, budget }) => {
    const phases = open(); await assert.rejects(phases.count(async () => count), AnalystInvocationError);
    await assert.rejects(phases.generate(async () => ({ value: "must not return", usage: null })), AnalystInvocationError);
    assert.equal(budget().invocations.length, 1); assert.equal(budget().invocations[0]?.state, "uncertain"); assert.equal(budget().pools[0]?.held.costMicrousd, "1000");
  });
});

test("callback failures are redacted, retain possible dispatch liability and never replay", async () => fixture(async ({ open, budget }) => {
  const phases = open(); let calls = 0;
  await assert.rejects(phases.count(async () => { calls++; throw new Error("PRIVATE_KEY_AND_PROVIDER_BODY"); }), error => error instanceof AnalystInvocationError && !error.message.includes("PRIVATE"));
  await assert.rejects(phases.count(async () => { calls++; return 1; }), AnalystInvocationError);
  assert.equal(calls, 1); assert.equal(budget().invocations[0]?.state, "uncertain");
}));

test("a reservation denied before callback dispatch cannot consume another reservation or call transport", async () => fixture(async ({ workspace, preparation, task, open, budget }) => {
  const phases = open(), other = new BudgetLedger(workspace); let calls = 0;
  try { other.reserve({ id: "authored-other-liability", runId: preparation.manifest.runId, taskRef: preparation.manifest.taskId, pool: "investigation", pricingRef: "authored", maximum: { tokens: 2100, costMicrousd: 2100 } }); } finally { other.close(); }
  await assert.rejects(phases.count(async () => { calls++; return 500; }), AnalystInvocationError);
  assert.equal(calls, 0); assert.equal(budget().invocations.length, 1); assert.equal(budget().invocations[0]?.id, "authored-other-liability"); assert.equal(budget().invocations[0]?.state, "reserved"); assert.equal(task.snapshot().record.dispatchIntents.length, 1);
}));

test("source denial before phase dispatch records no callback or invocation", async () => fixture(async ({ task, open, budget, denySource }) => {
  const phases = open(); let calls = 0; denySource();
  await assert.rejects(phases.count(async () => { calls++; return 500; }));
  assert.equal(calls, 0); assert.equal(phases.signal.aborted, true); assert.deepEqual(budget().invocations, []); assert.deepEqual(task.snapshot().record.dispatchIntents, []);
}));

test("cancellation releases the caller from stalled count without releasing uncertain liability", async () => fixture(async ({ task, open, budget }) => {
  const phases = open(), count = deferred<number>(), pending = phases.count(() => count.promise);
  task.stop("cancelled"); await assert.rejects(pending, AnalystInvocationError);
  assert.equal(budget().invocations[0]?.state, "uncertain"); assert.equal(budget().pools[0]?.held.tokens, "1000");
  count.accept(500); await nextTurn(); assert.equal(task.snapshot().record.state, "cancelled"); assert.equal(task.snapshot().record.output, null);
  await assert.rejects(phases.generate(async () => ({ value: "stale", usage: null })), AnalystInvocationError);
}));

test("a late generation receipt settles factual liability after cancellation without returning its candidate", async () => fixture(async ({ task, open, budget }) => {
  const phases = open(); await phases.count(async () => 400);
  const response = deferred<{ value: string; usage: unknown }>(), pending = phases.generate(() => response.promise);
  task.stop("cancelled"); await assert.rejects(pending, AnalystInvocationError);
  assert.equal(budget().pools[0]?.held.costMicrousd, "2100");
  response.accept({ value: "STALE_CANDIDATE_NOT_DELIVERED", usage: { tokens: 450, costMicrousd: 450 } }); await nextTurn();
  const generation = budget().invocations.find(item => item.id.endsWith(":generation")); assert.equal(generation?.state, "settled"); assert.deepEqual(generation?.actual, { tokens: 450, costMicrousd: 450 }); assert.equal(budget().pools[0]?.held.costMicrousd, "1000"); assert.equal(task.snapshot().record.state, "cancelled"); assert.equal(task.snapshot().record.output, null);
}));

test("missing or invalid generation receipts retain the entire phase cap without executing accessors", async () => {
  let accessed = false;
  const values = [null, { tokens: 1, costMicrousd: -1 }, { tokens: 1, costMicrousd: 1, extra: true }, { get tokens() { accessed = true; return 1; }, costMicrousd: 1 }, Promise.resolve({ tokens: 0, costMicrousd: 0 })];
  for (const usage of values) await fixture(async ({ open, budget }) => {
    const phases = open(); await phases.count(async () => 400); const result = await phases.generate(async () => ({ value: "opaque unaccepted candidate", usage }));
    assert.equal(result.liability, "uncertain"); assert.equal(budget().pools[0]?.held.costMicrousd, "2100"); assert.equal(budget().invocations.find(item => item.id.endsWith(":generation"))?.actual, null);
  });
  assert.equal(accessed, false);
});

test("source withdrawal after response settlement blocks result delivery but preserves a known receipt", async () => fixture(async ({ task, open, budget, denySource }) => {
  const phases = open(); await phases.count(async () => 400);
  await assert.rejects(phases.generate(async () => { denySource(); return { value: "must not return", usage: { tokens: 420, costMicrousd: 420 } }; }));
  assert.equal(budget().invocations.find(item => item.id.endsWith(":generation"))?.state, "settled"); assert.equal(budget().pools[0]?.spent.costMicrousd, "420"); assert.equal(task.signal.aborted, true); assert.equal(task.snapshot().record.output, null);
}));

test("receipt overruns remain recorded and close dispatch rather than hiding spend", async () => fixture(async ({ task, open, budget }) => {
  const phases = open(); await phases.count(async () => 400);
  await assert.rejects(phases.generate(async () => ({ value: "overrun candidate", usage: { tokens: 1101, costMicrousd: 1101 } })), AnalystInvocationError);
  const snapshot = budget(), generation = snapshot.invocations.find(item => item.id.endsWith(":generation")); assert.equal(generation?.state, "settled"); assert.equal(generation?.overrun, true); assert.equal(snapshot.run.state, "closed"); assert.equal(snapshot.run.closeReason, "receipt_overrun"); assert.equal(task.snapshot().record.state, "running");
}));

test("inference deadline aborts a stalled callback before the later task finalization deadline", { timeout: 3000 }, async () => fixture(async ({ task, open, budget }) => {
  const phases = open(), keepAlive = setTimeout(() => {}, 1500);
  try { await assert.rejects(phases.count(() => new Promise(() => {})), AnalystInvocationError); }
  finally { clearTimeout(keepAlive); }
  assert.equal(phases.signal.aborted, true); assert.equal(task.signal.aborted, false); assert.equal(task.snapshot().record.state, "running"); assert.equal(budget().invocations[0]?.state, "uncertain");
}, 150));

test("close is idempotent and an existing budget run cannot be adopted or reopened", async () => fixture(async ({ workspace, preparation, task, open, budget }) => {
  const phases = open(); await phases.count(async () => 400);
  assert.throws(() => new AnalystInvocations(workspace, preparation, task), /UNIQUE/);
  phases.close(); phases.close(); assert.equal(phases.signal.aborted, true); assert.equal(budget().run.state, "closed"); assert.equal(budget().invocations.length, 1); assert.equal(budget().invocations[0]?.state, "uncertain");
  assert.throws(() => new AnalystInvocations(workspace, preparation, task), /UNIQUE/);
  await assert.rejects(phases.generate(async () => ({ value: "no replay", usage: null })), AnalystInvocationError); assert.equal(task.snapshot().record.state, "running");
}));

test("an accessor-bearing transport envelope cannot settle spend or execute a value getter", async () => fixture(async ({ open, budget }) => {
  const phases = open(); await phases.count(async () => 400); let accessed = false;
  await assert.rejects(phases.generate(async () => ({ get value() { accessed = true; return "bad"; }, usage: { tokens: 420, costMicrousd: 420 } })), AnalystInvocationError);
  assert.equal(accessed, false); assert.equal(budget().invocations.find(item => item.id.endsWith(":generation"))?.state, "uncertain");
}));


test("a task handle cannot acquire a budget in a different workspace", async () => fixture(async ({ workspace, preparation, task }) => {
  const different = resolve(workspace, "different-workspace");
  assert.throws(() => new AnalystInvocations(different, preparation, task), /different workspace/);
  assert.equal(existsSync(different), false); assert.equal(existsSync(resolve(workspace, ".redteam/budgets.sqlite")), false);
}));

test("source loss immediately after reservation releases only the still-undispatched phase", async t => fixture(async ({ task, open, budget, denySource }) => {
  const phases = open(); let callbacks = 0;
  const reserve = BudgetLedger.prototype.reserve;
  t.mock.method(BudgetLedger.prototype, "reserve", function(this: BudgetLedger, input: Parameters<BudgetLedger["reserve"]>[0]) {
    const record = reserve.call(this, input); denySource(); return record;
  });
  await assert.rejects(phases.count(async () => { callbacks++; return 400; }), AnalystInvocationError);
  const snapshot = budget(); assert.equal(callbacks, 0); assert.equal(snapshot.invocations.length, 1); assert.equal(snapshot.invocations[0]?.state, "released"); assert.equal(snapshot.pools[0]?.held.costMicrousd, "0"); assert.equal(snapshot.pools[0]?.spent.costMicrousd, "0"); assert.equal(task.signal.aborted, true);
  await assert.rejects(phases.count(async () => 400), AnalystInvocationError);
}));


test("a relative accounting workspace is pinned before callbacks can change the working directory", async () => fixture(async ({ workspace, preparation, task, budget }) => {
  const initial = process.cwd(), phases = new AnalystInvocations(relative(initial, workspace), preparation, task), moved = resolve(workspace, "other/deep/location/for/test");
  await mkdir(moved, { recursive: true });
  try { process.chdir(moved); assert.equal(await phases.count(async () => 400), 400); assert.equal(budget().invocations[0]?.state, "uncertain"); }
  finally { phases.close(); process.chdir(initial); }
}));
