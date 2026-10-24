import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { BudgetLedger } from "../src/budget.ts";
import type { BudgetPlan } from "../src/budget.ts";

const plan = (): BudgetPlan => ({ runId: "run", cap: { tokens: 100, costMicrousd: 100 }, verificationReserve: { tokens: 20, costMicrousd: 20 }, reportReserve: { tokens: 10, costMicrousd: 10 }, deadlineAt: new Date(Date.now() + 60000).toISOString() });
const request = (id = "call", maximum = { tokens: 70, costMicrousd: 70 }) => ({ id, runId: "run", taskRef: "actor", pool: "investigation" as const, pricingRef: "fixture-config-hash", maximum });
async function temporary(work: (ledger: BudgetLedger, directory: string) => Promise<void> | void) {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-budget-")); const ledger = new BudgetLedger(directory);
  try { ledger.createRun(plan()); await work(ledger, directory); } finally { ledger.close(); await rm(directory, { recursive: true, force: true }); }
}

test("reservations protect verification and report pools in both resources", async () => temporary(ledger => {
  ledger.reserve(request());
  assert.throws(() => ledger.reserve(request("more", { tokens: 1, costMicrousd: 1 })), /uncommitted budget/);
  ledger.reserve({ ...request("verify", { tokens: 20, costMicrousd: 20 }), pool: "verification" });
  ledger.reserve({ ...request("report", { tokens: 10, costMicrousd: 10 }), pool: "report" });
  assert(ledger.snapshot("run").pools.every(pool => pool.available.tokens === 0 && pool.available.costMicrousd === 0));
  assert.equal(ledger.snapshot("run").invocations.length, 3);
}));

test("invocation replay cannot duplicate reservations, redispatch, or change identity", async () => temporary(ledger => {
  assert.deepEqual(ledger.reserve(request()), ledger.reserve(request()));
  assert.equal(ledger.events("run").filter(event => event.kind === "reserved").length, 1);
  for (const change of [{ taskRef: "other" }, { pricingRef: "new-rate" }, { runId: "other-run" }, { maximum: { tokens: 1, costMicrousd: 1 } }]) assert.throws(() => ledger.reserve({ ...request(), ...change }), /identity/);
  ledger.dispatch("call"); assert.throws(() => ledger.dispatch("call"), /only once/);
  assert.throws(() => ledger.release("call"), /cannot be released/);
}));

test("settlement releases only unused liability and preserves immutable actual usage", async () => temporary(ledger => {
  ledger.reserve(request()); ledger.dispatch("call"); ledger.settle("call", { tokens: 15, costMicrousd: 12 }); ledger.settle("call", { tokens: 15, costMicrousd: 12 });
  const pool = ledger.snapshot("run").pools[0]!;
  assert.deepEqual(pool.spent, { tokens: "15", costMicrousd: "12" }); assert.deepEqual(pool.held, { tokens: "0", costMicrousd: "0" });
  assert.deepEqual(pool.available, { tokens: 55, costMicrousd: 58 });
  assert.throws(() => ledger.settle("call", { tokens: 15, costMicrousd: 11 }), /immutable/);
  assert.throws(() => ledger.release("call"), /cannot be released/);
  ledger.reserve(request("next", pool.available));
}));

test("only undispatched reservations can be released and a released identity cannot execute", async () => temporary(ledger => {
  ledger.reserve(request()); assert.throws(() => ledger.settle("call", { tokens: 0, costMicrousd: 0 }), /dispatched/);
  ledger.release("call"); ledger.release("call");
  assert.equal(ledger.snapshot("run").pools[0]!.available.tokens, 70);
  assert.throws(() => ledger.dispatch("call"), /only once/);
  assert.equal(ledger.reserve(request()).state, "released");
}));

test("unknown usage survives close and process restart until a valid late receipt arrives", async () => temporary((ledger, directory) => {
  ledger.reserve(request()); ledger.dispatch("call"); ledger.uncertain("call"); ledger.closeRun("run", "cancelled");
  const reopened = new BudgetLedger(directory);
  try {
    const snapshot = reopened.snapshot("run"); assert.equal(snapshot.run.state, "closed"); assert.equal(snapshot.invocations[0]!.state, "uncertain");
    assert.deepEqual(snapshot.pools[0]!.held, { tokens: "70", costMicrousd: "70" });
    assert.throws(() => reopened.release("call"), /cannot be released/);
    assert.throws(() => reopened.reserve(request("retry", { tokens: 1, costMicrousd: 1 })), /new dispatch/);
    reopened.settle("call", { tokens: 20, costMicrousd: 25 });
    assert.deepEqual(reopened.snapshot("run").pools[0]!.spent, { tokens: "20", costMicrousd: "25" });
    assert.equal(reopened.snapshot("run").run.state, "closed");
  } finally { reopened.close(); }
}));

test("closure stops investigation while preserving reserved verification and reporting", async () => temporary(ledger => {
  ledger.reserve(request("pending")); ledger.beginClosing("run");
  assert.throws(() => ledger.dispatch("pending"), /new dispatch/); ledger.release("pending");
  assert.throws(() => ledger.reserve(request("investigate")), /new dispatch/);
  ledger.reserve({ ...request("verify", { tokens: 20, costMicrousd: 20 }), pool: "verification" }); ledger.dispatch("verify");
  ledger.reserve({ ...request("report", { tokens: 10, costMicrousd: 10 }), pool: "report" }); ledger.dispatch("report");
  ledger.closeRun("run", "finished");
  assert(ledger.snapshot("run").invocations.filter(item => item.id !== "pending").every(item => item.state === "uncertain"));
}));

test("overrun receipts retain actual spend and close the run without freeing unknown siblings", async () => temporary(ledger => {
  ledger.reserve(request("first", { tokens: 35, costMicrousd: 35 })); ledger.dispatch("first");
  ledger.reserve(request("sibling", { tokens: 35, costMicrousd: 35 })); ledger.dispatch("sibling");
  ledger.settle("first", { tokens: 80, costMicrousd: 90 });
  const snapshot = ledger.snapshot("run"); assert.equal(snapshot.run.closeReason, "receipt_overrun");
  assert.deepEqual(snapshot.pools[0]!.spent, { tokens: "80", costMicrousd: "90" });
  assert.deepEqual(snapshot.pools[0]!.held, { tokens: "35", costMicrousd: "35" });
  assert.deepEqual(snapshot.pools[0]!.available, { tokens: 0, costMicrousd: 0 });
  assert.throws(() => ledger.reserve(request("new", { tokens: 1, costMicrousd: 1 })), /new dispatch/);
}));

test("budget input, deadlines, database permissions, and dangling symlinks fail closed", async () => temporary(async (ledger, directory) => {
  for (const maximum of [{ tokens: -1, costMicrousd: 1 }, { tokens: 0.5, costMicrousd: 1 }, { tokens: Number.MAX_SAFE_INTEGER + 1, costMicrousd: 1 }, { tokens: 0, costMicrousd: 0 }]) assert.throws(() => ledger.reserve(request("bad", maximum)));
  assert.throws(() => ledger.createRun({ ...plan(), runId: "bad", verificationReserve: { tokens: 101, costMicrousd: 0 } }), /reserves exceed/);
  ledger.createRun({ ...plan(), runId: "expired", deadlineAt: "2000-01-01T00:00:00.000Z" });
  assert.throws(() => ledger.reserve({ ...request(), runId: "expired" }), /new dispatch/);
  assert.equal((await stat(resolve(directory, ".redteam/budgets.sqlite"))).mode & 0o777, 0o600);
  const target = resolve(directory, "missing-target.sqlite"), other = resolve(directory, "other");
  const otherLedger = new BudgetLedger(other); otherLedger.close();
  await rm(resolve(other, ".redteam/budgets.sqlite")); await symlink(target, resolve(other, ".redteam/budgets.sqlite"));
  assert.throws(() => new BudgetLedger(other), /symbolic link/); await assert.rejects(stat(target), /ENOENT/);
}));

test("competing processes cannot oversubscribe a shared run", { timeout: 15000 }, async () => temporary(async (ledger, directory) => {
  const moduleUrl = new URL("../src/budget.ts", import.meta.url).href;
  const program = `import { BudgetLedger } from ${JSON.stringify(moduleUrl)}; process.send({ready:true}); process.once("message", () => { const ledger = new BudgetLedger(process.argv[1]); try { ledger.reserve({id:process.argv[2],runId:"run",taskRef:"worker",pool:"investigation",pricingRef:"fixture-rate",maximum:{tokens:25,costMicrousd:25}}); process.send({ok:true}); } catch (error) { process.send({ok:false,error:error.message}); } finally { ledger.close(); process.disconnect(); } });`;
  const children = Array.from({ length: 6 }, (_, index) => spawn(process.execPath, ["--input-type=module", "-e", program, directory, `worker-${index}`], { stdio: ["ignore", "ignore", "pipe", "ipc"] }));
  try {
    await Promise.all(children.map(child => new Promise<void>((resolveReady, reject) => { child.once("message", () => resolveReady()); child.once("error", reject); child.once("exit", code => { if (code) reject(new Error(`Worker exited ${code}`)); }); })));
    const results = children.map(child => new Promise<{ ok: boolean; error?: string }>((resolveResult, reject) => { child.once("message", result => resolveResult(result as { ok: boolean; error?: string })); child.once("error", reject); child.once("exit", code => { if (code) reject(new Error(`Worker exited ${code}`)); }); }));
    for (const child of children) child.send("go");
    const values = await Promise.all(results);
    assert.equal(values.filter(value => value.ok).length, 2);
    assert(values.filter(value => !value.ok).every(value => /uncommitted budget/.test(value.error ?? "")));
    assert.equal(ledger.snapshot("run").pools[0]!.held.costMicrousd, "50");
  } finally { for (const child of children) if (child.exitCode === null) child.kill(); }
}));
