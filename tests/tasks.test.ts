import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { TaskStore } from "../src/tasks.ts";
import type { TaskSpec } from "../src/tasks.ts";
import { BudgetLedger } from "../src/budget.ts";

const digest = "a".repeat(64), otherDigest = "b".repeat(64);
const spec = (): TaskSpec => ({ id: "task", runId: "run", kind: "actor", questionKey: "scenario-review", manifestHash: digest, maximumAttempts: 2, deadlineAt: new Date(100000).toISOString() });
async function temporary(work: (store: TaskStore, directory: string, advance: (milliseconds: number) => void) => Promise<void> | void) {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-task-")); let now = 1000;
  const store = new TaskStore(directory, () => now);
  try { store.create(spec()); await work(store, directory, milliseconds => { now += milliseconds; }); }
  finally { store.close(); await rm(directory, { recursive: true, force: true }); }
}

test("task identity and questions are immutable and require bounded specifications", async () => temporary(store => {
  assert.throws(() => store.create(spec()), /UNIQUE/);
  assert.throws(() => store.create({ ...spec(), id: "duplicate-question" }), /UNIQUE/);
  for (const change of [{ manifestHash: "unknown" }, { maximumAttempts: 0 }, { maximumAttempts: 6 }, { deadlineAt: "invalid" }]) assert.throws(() => store.create({ ...spec(), id: "bad", questionKey: "bad", ...change }));
  const copy = store.task("task"); copy.spec.manifestHash = otherDigest;
  assert.equal(store.task("task").spec.manifestHash, digest);
  let accessed = false;
  const accessor = { ...spec(), get manifestHash() { accessed = true; return digest; } };
  assert.throws(() => store.create(accessor), /without accessors/); assert.equal(accessed, false);
  assert.throws(() => store.create({ ...spec(), tools: ["shell"] } as TaskSpec), /plain supported/);
}));

test("one owner can start and seal output; sealed results cannot be replaced", async () => temporary(store => {
  const lease = store.claim("task", "worker-1", 1000);
  assert.throws(() => store.claim("task", "worker-2", 1000), /not available/);
  assert.throws(() => store.seal(lease, { artifactRef: "artifact", sha256: digest }), /running task/);
  assert.throws(() => store.start({ ...lease, owner: "worker-2" }), /stale/);
  store.start(lease); assert.throws(() => store.start(lease), /leased task/);
  store.seal(lease, { artifactRef: "artifact", sha256: digest });
  assert.throws(() => store.seal(lease, { artifactRef: "replacement", sha256: otherDigest }), /stale/);
  assert.throws(() => store.complete("task", otherDigest), /expected sealed/);
  store.complete("task", digest); store.cancel("task");
  assert.equal(store.task("task").state, "completed"); assert.equal(store.task("task").output?.sha256, digest);
  assert.deepEqual(store.events("task").map(event => event.kind), ["created", "claimed", "started", "output_sealed", "completed"]);
}));

test("authoritative lease expiry defeats forged timestamps and prevents resurrection", async () => temporary((store, _, advance) => {
  const lease = store.claim("task", "worker", 100);
  advance(101);
  const forged = { ...lease, expiresAt: new Date(999999999).toISOString() };
  assert.throws(() => store.start(forged), /expired/);
  assert.throws(() => store.heartbeat(forged, 1000), /expired/);
  assert.deepEqual(store.recoverExpired("run"), ["task"]);
  assert.equal(store.task("task").state, "interrupted");
  assert.equal(store.task("task").stopReason, "lease_expired");
  assert.throws(() => store.claim("task", "replacement", 100), /not available/);
}));

test("explicit pre-dispatch retry increments the fence and rejects the previous worker", async () => temporary((store, _, advance) => {
  const old = store.claim("task", "worker", 100); store.start(old); advance(101); store.recoverExpired("run");
  assert.throws(() => store.retryBeforeDispatch("task", old.fence + 1), /matching fence/);
  store.retryBeforeDispatch("task", old.fence);
  const replacement = store.claim("task", "worker", 100);
  assert.equal(replacement.fence, old.fence + 1); assert.equal(store.task("task").attempt, 2);
  assert.throws(() => store.start(old), /stale/);
  store.start(replacement); store.fail(replacement, "adapter_failed");
  assert.throws(() => store.retryBeforeDispatch("task", replacement.fence), /remaining attempts/);
}));

test("heartbeat cannot extend beyond the task deadline and recovery preserves sealed output", async () => temporary((store, _, advance) => {
  const lease = store.claim("task", "worker", 100);
  advance(50); const extended = store.heartbeat(lease, 60000);
  assert.equal(Date.parse(extended.expiresAt), 61050);
  advance(59000); const final = store.heartbeat(extended, 60000);
  assert.equal(Date.parse(final.expiresAt), 100000);
  store.start(final); store.seal(final, { artifactRef: "output", sha256: digest });
  advance(100000); assert.deepEqual(store.recoverExpired("run"), []);
  assert.equal(store.task("task").output?.sha256, digest);
}));

test("dispatch intent prevents retry and task cancellation never releases budget liability", async () => temporary((store, directory) => {
  const budget = new BudgetLedger(directory);
  try {
    budget.createRun({ runId: "run", cap: { tokens: 100, costMicrousd: 100 }, verificationReserve: { tokens: 0, costMicrousd: 0 }, reportReserve: { tokens: 0, costMicrousd: 0 }, deadlineAt: new Date(Date.now() + 60000).toISOString() });
    const lease = store.claim("task", "worker", 1000); store.start(lease);
    store.recordDispatchIntent(lease, "invocation"); store.recordDispatchIntent(lease, "invocation");
    assert.equal(store.task("task").dispatchIntents.length, 1);
    budget.reserve({ id: "invocation", runId: "run", taskRef: "task", pool: "investigation", pricingRef: "fixture", maximum: { tokens: 100, costMicrousd: 100 } }); budget.dispatch("invocation");
    store.fail(lease, "adapter_failed"); assert.throws(() => store.retryBeforeDispatch("task", lease.fence), /pre-dispatch/);
    store.cancel("task");
    assert.equal(budget.snapshot("run").pools[0]?.held.costMicrousd, "100");
    const second = store.create({ ...spec(), id: "second", questionKey: "another-question" });
    const secondLease = store.claim(second.spec.id, "worker", 100); store.start(secondLease); store.cancel(second.spec.id);
    assert.throws(() => store.seal(secondLease, { artifactRef: "late", sha256: digest }), /stale/);
  } finally { budget.close(); }
}));

test("task records and expired dispatch intents persist across connection restart", async () => temporary((store, directory, advance) => {
  const lease = store.claim("task", "worker", 100); store.start(lease); store.recordDispatchIntent(lease, "possibly-dispatched"); advance(101);
  const reopened = new TaskStore(directory, () => 1101);
  try {
    assert.deepEqual(reopened.recoverExpired("run"), ["task"]);
    assert.equal(reopened.task("task").dispatchIntents[0]?.invocationRef, "possibly-dispatched");
    assert.throws(() => reopened.retryBeforeDispatch("task", lease.fence), /pre-dispatch/);
    assert.throws(() => reopened.seal(lease, { artifactRef: "late", sha256: digest }), /stale/);
  } finally { reopened.close(); }
}));

test("task state files are private and dangling symbolic links cannot create targets", async () => temporary(async (_, directory) => {
  assert.equal((await stat(resolve(directory, ".redteam/tasks.sqlite"))).mode & 0o777, 0o600);
  const target = resolve(directory, "absent.sqlite"), other = resolve(directory, "other");
  const another = new TaskStore(other); another.close(); await rm(resolve(other, ".redteam/tasks.sqlite"));
  await symlink(target, resolve(other, ".redteam/tasks.sqlite"));
  assert.throws(() => new TaskStore(other), /symbolic link/); await assert.rejects(stat(target), /ENOENT/);
}));

test("competing processes can claim a queued task only once", { timeout: 15000 }, async () => temporary(async (store, directory) => {
  store.create({ ...spec(), id: "race", questionKey: "race", deadlineAt: new Date(Date.now() + 60000).toISOString() });
  const moduleUrl = new URL("../src/tasks.ts", import.meta.url).href;
  const program = `import { TaskStore } from ${JSON.stringify(moduleUrl)}; process.send({ready:true}); process.once("message", () => { const store = new TaskStore(process.argv[1]); try { store.claim("race",process.argv[2],5000); process.send({ok:true}); } catch(error) { process.send({ok:false,error:error.message}); } finally { store.close(); process.disconnect(); } });`;
  const children = Array.from({ length: 4 }, (_, index) => spawn(process.execPath, ["--input-type=module", "-e", program, directory, `worker-${index}`], { stdio: ["ignore", "ignore", "pipe", "ipc"] }));
  try {
    await Promise.all(children.map(child => new Promise<void>((ready, reject) => { child.once("message", () => ready()); child.once("error", reject); child.once("exit", code => { if (code) reject(new Error(`Worker exited ${code}`)); }); })));
    const results = children.map(child => new Promise<{ ok: boolean; error?: string }>((done, reject) => { child.once("message", result => done(result as { ok: boolean; error?: string })); child.once("error", reject); child.once("exit", code => { if (code) reject(new Error(`Worker exited ${code}`)); }); }));
    children.forEach(child => child.send("go"));
    const values = await Promise.all(results); assert.equal(values.filter(value => value.ok).length, 1);
    assert(values.filter(value => !value.ok).every(value => /not available/.test(value.error ?? "")));
    assert.equal(store.task("race").attempt, 1);
  } finally { for (const child of children) if (child.exitCode === null) child.kill(); }
}));
