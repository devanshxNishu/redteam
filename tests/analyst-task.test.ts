import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { AnalystTask, AnalystTaskPolicyError, analystTaskPolicy } from "../src/analyst-task.ts";
import type { AnalystTaskInput, AnalystTaskPolicy, AnalystTaskFailure } from "../src/analyst-task.ts";
import { TaskStore } from "../src/tasks.ts";

const digest = "a".repeat(64), otherDigest = "b".repeat(64), now = 2000000000000;
const input = (): AnalystTaskInput => ({ taskId: "analyst", runId: "analysis-run", questionKey: "supplied-brief-objections", manifestHash: digest, deadlineAt: new Date(Date.now() + 60000).toISOString(), owner: "local-coordinator" });
const output = { artifactRef: "opaque-candidate-ref", sha256: digest };
async function temporary(t: TestContext, work: (directory: string, open: (check?: () => unknown, policy?: Partial<AnalystTaskPolicy>, change?: Partial<AnalystTaskInput>) => AnalystTask, observer: TaskStore) => void | Promise<void>) {
  t.mock.timers.enable({ apis: ["Date", "setInterval"], now });
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-analyst-task-")), handles: AnalystTask[] = [];
  const observer = new TaskStore(directory);
  const open = (check: () => unknown = () => {}, policy: Partial<AnalystTaskPolicy> = {}, change: Partial<AnalystTaskInput> = {}) => {
    const handle = new AnalystTask(directory, { ...input(), ...change }, check, policy); handles.push(handle); return handle;
  };
  try { await work(directory, open, observer); }
  finally { handles.forEach(handle => handle.close()); observer.close(); t.mock.timers.reset(); await rm(directory, { recursive: true, force: true }); }
}

test("analyst configuration and synchronous source authority fail before acquiring state", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-analyst-denied-")); let accessed = false;
  try {
    for (const policy of [{ leaseMs: 0 }, { leaseMs: 60001 }, { heartbeatMs: 30000 }, { heartbeatMs: NaN }, { tools: [] }, { get leaseMs() { accessed = true; return 100; } }]) {
      assert.throws(() => new AnalystTask(directory, input(), () => {}, policy), AnalystTaskPolicyError);
      assert.equal(existsSync(resolve(directory, ".redteam")), false);
    }
    for (const check of [() => { throw new Error("PRIVATE SOURCE DETAIL"); }, () => false, () => ({}), async () => {}, async () => { throw new Error("PRIVATE ASYNC DETAIL"); }]) {
      assert.throws(() => new AnalystTask(directory, input(), check), error => error instanceof AnalystTaskPolicyError && !error.message.includes("PRIVATE"));
      assert.equal(existsSync(resolve(directory, ".redteam")), false);
    }
    for (const change of [{ owner: "" }, { manifestHash: "bad" }, { deadlineAt: "invalid" }, { deadlineAt: new Date(0).toISOString() }, { get owner() { accessed = true; return "owner"; } }]) {
      const configured = Object.defineProperties({ ...input() }, Object.getOwnPropertyDescriptors(change));
      assert.throws(() => new AnalystTask(directory, configured, () => {}), AnalystTaskPolicyError);
    }
    assert.equal(accessed, false); assert.equal(existsSync(resolve(directory, ".redteam")), false);
    assert.deepEqual(analystTaskPolicy(), { leaseMs: 30000, heartbeatMs: 1000 });
    await Promise.resolve(); // Rejected async guards were consumed, never awaited as authority.
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("analyst ownership pins one attempt and manifest without giving a model authority", async t => temporary(t, (_, open, observer) => {
  const task = open(), snapshot = task.snapshot();
  assert.equal(snapshot.record.spec.kind, "analyst"); assert.equal(snapshot.record.spec.maximumAttempts, 1);
  assert.equal(snapshot.record.spec.manifestHash, digest); assert.equal(snapshot.record.spec.questionKey, "supplied-brief-objections");
  assert.equal(snapshot.record.attempt, 1); assert.equal(snapshot.record.fence, 1); assert.equal(snapshot.record.state, "running");
  assert.equal(snapshot.record.lease?.owner, "local-coordinator");
  assert.deepEqual(snapshot.events.map(event => event.kind), ["created", "claimed", "started"]);
  assert.throws(() => observer.claim("analyst", "competitor", 1000), /not available/);
  assert.throws(() => open(), /UNIQUE/); task.assertActive();
  snapshot.record.spec.manifestHash = otherDigest;
  assert.equal(task.snapshot().record.spec.manifestHash, digest);
}));

test("source callback cannot change the pinned configuration before task creation", async t => temporary(t, (directory, _, observer) => {
  const configured = input();
  const task = new AnalystTask(directory, configured, () => { configured.manifestHash = otherDigest; configured.owner = "changed"; });
  try { assert.equal(observer.task("analyst").spec.manifestHash, digest); assert.equal(observer.task("analyst").lease?.owner, "local-coordinator"); }
  finally { task.close(); }
}));

test("same-attempt dispatch intent is idempotent and records no actual provider call", async t => temporary(t, (_, open) => {
  const task = open(); task.beforeDispatch("invocation"); task.beforeDispatch("invocation");
  assert.deepEqual(task.snapshot().record.dispatchIntents, [{ invocationRef: "invocation", attempt: 1 }]);
  assert.equal(task.snapshot().events.filter(event => event.kind === "dispatch_intent").length, 1);
  task.stop("adapter_failed");
  assert.equal(task.signal.aborted, true); assert.equal(task.snapshot().record.stopReason, "adapter_failed");
  assert.throws(() => task.beforeDispatch("replay"), AnalystTaskPolicyError);
}));

test("source withdrawal blocks dispatch and sealing and aborts the handle", async t => temporary(t, (_, open) => {
  let allowed = true;
  const task = open(() => { if (!allowed) throw new Error("private revocation"); }); allowed = false;
  assert.throws(() => task.beforeDispatch("blocked"), AnalystTaskPolicyError);
  assert.throws(() => task.seal(output), AnalystTaskPolicyError);
  assert.equal(task.signal.aborted, true); assert.equal(task.snapshot().record.output, null);
  assert.deepEqual(task.snapshot().record.dispatchIntents, []);
  task.stop("policy_denied"); assert.equal(task.snapshot().record.stopReason, "policy_denied");
}));

test("a source callback cannot cancel ownership and still authorize dispatch", async t => temporary(t, (_, open, observer) => {
  let cancel = false;
  const task = open(() => { if (cancel) observer.cancel("analyst"); }); cancel = true;
  assert.throws(() => task.beforeDispatch("blocked"), AnalystTaskPolicyError);
  assert.deepEqual(task.snapshot().record.dispatchIntents, []); assert.equal(task.signal.aborted, true);
}));

test("heartbeat checks current source, renews only active leases, and stops after denial", async t => temporary(t, (_, open) => {
  let allowed = true;
  const task = open(() => { if (!allowed) throw new Error(); }, { leaseMs: 500, heartbeatMs: 100 });
  t.mock.timers.tick(100);
  assert.equal(task.snapshot().record.lease?.expiresAt, new Date(now + 600).toISOString());
  allowed = false; t.mock.timers.tick(100); assert.equal(task.signal.aborted, true);
  const events = task.snapshot().events;
  t.mock.timers.tick(1000); assert.deepEqual(task.snapshot().events, events);
}));

test("external cancellation aborts on the next heartbeat and cannot seal", async t => temporary(t, (_, open, observer) => {
  const task = open(() => {}, { leaseMs: 500, heartbeatMs: 100 }); observer.cancel("analyst");
  t.mock.timers.tick(100); assert.equal(task.signal.aborted, true);
  assert.throws(() => task.seal(output), AnalystTaskPolicyError); task.stop("invalid_output");
  assert.equal(observer.task("analyst").state, "cancelled"); assert.equal(observer.task("analyst").output, null);
}));

test("sealing removes the lease and exact fenced completion is only mechanical metadata", async t => temporary(t, (_, open) => {
  const task = open(); task.seal(output);
  assert.equal(task.snapshot().record.state, "sealed"); assert.equal(task.snapshot().record.lease, null);
  t.mock.timers.tick(1000); assert.equal(task.signal.aborted, false);
  task.complete(digest);
  assert.equal(task.snapshot().record.state, "completed"); assert.deepEqual(task.snapshot().record.output, output);
  assert.equal(task.snapshot().record.spec.kind, "analyst");
  assert.deepEqual(task.snapshot().events.map(event => event.kind), ["created", "claimed", "started", "output_sealed", "completed"]);
  const events = task.snapshot().events; t.mock.timers.tick(60000); assert.deepEqual(task.snapshot().events, events);
  task.stop("cancelled"); assert.equal(task.snapshot().record.state, "completed");
}));

test("wrong completion digest preserves the seal and cannot be retried through the handle", async t => temporary(t, (_, open) => {
  const task = open(); task.seal(output);
  assert.throws(() => task.complete(otherDigest), AnalystTaskPolicyError);
  assert.throws(() => task.complete(digest), AnalystTaskPolicyError);
  task.stop("invalid_output");
  assert.equal(task.snapshot().record.state, "sealed"); assert.deepEqual(task.snapshot().record.output, output);
}));

test("source withdrawal after sealing prevents completion and preserves bytes for factual recovery", async t => temporary(t, (_, open, observer) => {
  let allowed = true;
  const task = open(() => { if (!allowed) throw new Error(); }); task.seal(output); allowed = false;
  assert.throws(() => task.complete(digest), AnalystTaskPolicyError); assert.equal(task.signal.aborted, true);
  t.mock.timers.setTime(now + 60001);
  assert.deepEqual(observer.recoverExpired("analysis-run"), ["analyst"]);
  assert.equal(observer.task("analyst").state, "interrupted"); assert.deepEqual(observer.task("analyst").output, output);
  assert.throws(() => observer.retryBeforeDispatch("analyst", 1), /remaining attempts/);
}));

test("expired leases and deadlines cannot be revived or completed", async t => temporary(t, (_, open, observer) => {
  const task = open(() => {}, { leaseMs: 500, heartbeatMs: 100 }); task.beforeDispatch("uncertain");
  t.mock.timers.setTime(now + 501);
  assert.throws(() => task.assertActive(), AnalystTaskPolicyError);
  assert.throws(() => task.seal(output), AnalystTaskPolicyError);
  assert.deepEqual(observer.recoverExpired("analysis-run"), ["analyst"]);
  assert.equal(observer.task("analyst").stopReason, "lease_expired");
  assert.deepEqual(observer.task("analyst").dispatchIntents, [{ invocationRef: "uncertain", attempt: 1 }]);
  const second = open(() => {}, {}, { taskId: "second", questionKey: "second", deadlineAt: new Date(Date.now() + 300).toISOString() });
  second.seal(output); t.mock.timers.tick(301);
  assert.throws(() => second.complete(digest), AnalystTaskPolicyError);
  assert.deepEqual(observer.recoverExpired("analysis-run"), ["second"]);
  assert.equal(observer.task("second").stopReason, "deadline_expired");
}));

test("only supported stop reasons are recorded and fenced cancellation preserves the seal", async t => temporary(t, (_, open) => {
  for (const [index, reason] of ["adapter_failed", "policy_denied", "invalid_output", "limit_reached"].entries()) {
    const task = open(() => {}, {}, { taskId: `failure-${index}`, questionKey: `failure-${index}` }); task.stop(reason as AnalystTaskFailure);
    assert.equal(task.snapshot().record.state, "failed"); assert.equal(task.snapshot().record.stopReason, reason);
  }
  const task = open(); assert.throws(() => task.stop("invented" as AnalystTaskFailure), AnalystTaskPolicyError); task.assertActive();
  task.seal(output); task.stop("cancelled"); assert.equal(task.snapshot().record.state, "cancelled"); assert.deepEqual(task.snapshot().record.output, output);
}));

test("atomic expected-fence cancellation cannot cancel a replacement owner", async t => temporary(t, (_, __, observer) => {
  observer.create({ id: "replaceable", runId: "other-run", kind: "actor", questionKey: "generic-retry", manifestHash: digest, maximumAttempts: 2, deadlineAt: new Date(now + 60000).toISOString() });
  const old = observer.claim("replaceable", "old", 100); observer.start(old); observer.fail(old, "adapter_failed");
  observer.retryBeforeDispatch("replaceable", old.fence); const next = observer.claim("replaceable", "replacement", 1000); observer.start(next);
  assert.throws(() => observer.cancel("replaceable", old.fence), /current ownership fence/);
  assert.equal(observer.task("replaceable").state, "running"); assert.equal(observer.task("replaceable").lease?.owner, "replacement");
  observer.cancel("replaceable", next.fence); assert.equal(observer.task("replaceable").state, "cancelled");
}));

test("close stops timers and connections without inventing success, retry or spend release", async t => temporary(t, (_, open, observer) => {
  const task = open(() => {}, { leaseMs: 500, heartbeatMs: 100 }); task.beforeDispatch("possibly-sent");
  const before = task.snapshot(); task.close(); task.close(); assert.equal(task.signal.aborted, true);
  assert.throws(() => task.snapshot(), /closed/); assert.throws(() => task.assertActive(), AnalystTaskPolicyError);
  t.mock.timers.tick(501); assert.deepEqual(observer.events("analyst"), before.events);
  assert.equal(observer.task("analyst").state, "running");
  assert.deepEqual(observer.recoverExpired("analysis-run"), ["analyst"]);
  assert.equal(observer.task("analyst").state, "interrupted"); assert.equal(observer.task("analyst").output, null);
  assert.throws(() => observer.retryBeforeDispatch("analyst", 1));
}));


test("an async authority change cannot renew or complete an already sealed task", async t => temporary(t, (_, open) => {
  let asyncGuard = false;
  const task = open(() => asyncGuard ? Promise.resolve() : undefined); task.seal(output); asyncGuard = true;
  t.mock.timers.tick(1000); assert.equal(task.signal.aborted, true);
  assert.throws(() => task.complete(digest), AnalystTaskPolicyError);
  assert.equal(task.snapshot().record.state, "sealed"); assert.deepEqual(task.snapshot().record.output, output);
}));

test("invalid output metadata cannot be sealed and cannot run supplied accessors", async t => temporary(t, (_, open) => {
  let accessed = false;
  const task = open();
  assert.throws(() => task.seal({ artifactRef: "opaque", get sha256() { accessed = true; return digest; } }), AnalystTaskPolicyError);
  assert.equal(accessed, false); assert.equal(task.signal.aborted, true); assert.equal(task.snapshot().record.output, null);
  task.stop("invalid_output"); assert.equal(task.snapshot().record.stopReason, "invalid_output");
}));
