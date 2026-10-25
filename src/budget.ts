import { DatabaseSync } from "node:sqlite";
import { chmodSync, lstatSync } from "node:fs";
import { resolve } from "node:path";
import { workspaceDirectory } from "./workspace.ts";

export interface BudgetAmount { tokens: number; costMicrousd: number }
export type BudgetPool = "investigation" | "verification" | "report";
export interface BudgetPlan {
  runId: string;
  cap: BudgetAmount;
  verificationReserve: BudgetAmount;
  reportReserve: BudgetAmount;
  deadlineAt: string;
}
export interface BudgetInvocation {
  id: string;
  runId: string;
  taskRef: string;
  pool: BudgetPool;
  pricingRef: string;
  maximum: BudgetAmount;
  state: "reserved" | "in_flight" | "uncertain" | "settled" | "released";
  actual: BudgetAmount | null;
  overrun: boolean;
  createdAt: string;
  updatedAt: string;
}
interface StoredRun extends BudgetPlan { state: "open" | "closing" | "closed"; closeReason: string | null; createdAt: string }
export interface BudgetSnapshot {
  run: StoredRun;
  pools: { pool: BudgetPool; cap: BudgetAmount; spent: { tokens: string; costMicrousd: string }; held: { tokens: string; costMicrousd: string }; available: BudgetAmount }[];
  invocations: BudgetInvocation[];
}

const pools: BudgetPool[] = ["investigation", "verification", "report"];
const resources = ["tokens", "costMicrousd"] as const;
export class BudgetDeniedError extends Error {}
const same = (a: BudgetAmount, b: BudgetAmount) => resources.every(key => a[key] === b[key]);
function identifier(value: string): void {
  if (typeof value !== "string" || !value.trim() || value.length > 200) throw new Error("Budget records require bounded identifiers.");
}
function amount(value: BudgetAmount): BudgetAmount {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).some(key => typeof key !== "string" || !resources.includes(key as typeof resources[number]))
    || Object.values(Object.getOwnPropertyDescriptors(value)).some(field => !("value" in field))
    || resources.some(key => !Number.isSafeInteger(value[key]) || value[key] < 0)) throw new Error("Budget quantities require nonnegative safe integers.");
  return { tokens: value.tokens, costMicrousd: value.costMicrousd };
}
function poolCap(run: BudgetPlan, pool: BudgetPool): BudgetAmount {
  if (pool === "verification") return { ...run.verificationReserve };
  if (pool === "report") return { ...run.reportReserve };
  return { tokens: run.cap.tokens - run.verificationReserve.tokens - run.reportReserve.tokens,
    costMicrousd: run.cap.costMicrousd - run.verificationReserve.costMicrousd - run.reportReserve.costMicrousd };
}

/** Local durable liability ledger. It cannot impose a billing cap at a provider. */
export class BudgetLedger {
  private readonly db: DatabaseSync;
  constructor(workspace: string) {
    const file = resolve(workspaceDirectory(workspace), "budgets.sqlite");
    if (lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error("The budget database must not be a symbolic link.");
    this.db = new DatabaseSync(file);
    chmodSync(file, 0o600);
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS budget_runs (id TEXT PRIMARY KEY, document TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS budget_invocations (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, document TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS budget_invocations_run ON budget_invocations(run_id);
      CREATE TABLE IF NOT EXISTS budget_events (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, invocation_id TEXT, kind TEXT NOT NULL, at TEXT NOT NULL);
    `);
  }
  private transaction<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = work(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  private event(runId: string, invocationId: string | null, kind: string): void {
    this.db.prepare("INSERT INTO budget_events(run_id, invocation_id, kind, at) VALUES (?, ?, ?, ?)").run(runId, invocationId, kind, new Date().toISOString());
  }
  private run(id: string): StoredRun {
    const row = this.db.prepare("SELECT document FROM budget_runs WHERE id=?").get(id);
    if (!row) throw new Error("Budget run not found.");
    return JSON.parse(String(row.document)) as StoredRun;
  }
  hasRun(id: string): boolean { return Boolean(this.db.prepare("SELECT id FROM budget_runs WHERE id=?").get(id)); }
  private invocation(id: string): BudgetInvocation {
    const row = this.db.prepare("SELECT document FROM budget_invocations WHERE id=?").get(id);
    if (!row) throw new Error("Budget invocation not found.");
    return JSON.parse(String(row.document)) as BudgetInvocation;
  }
  private saveRun(run: StoredRun): void {
    this.db.prepare("UPDATE budget_runs SET document=? WHERE id=?").run(JSON.stringify(run), run.runId);
  }
  private saveInvocation(item: BudgetInvocation): void {
    item.updatedAt = new Date().toISOString();
    this.db.prepare("UPDATE budget_invocations SET document=? WHERE id=?").run(JSON.stringify(item), item.id);
  }
  private allowDispatch(run: StoredRun, pool: BudgetPool): void {
    if (run.state === "closed" || (run.state === "closing" && pool === "investigation") || Date.now() >= Date.parse(run.deadlineAt)) throw new BudgetDeniedError("The budget run does not permit new dispatch.");
  }

  createRun(plan: BudgetPlan): void {
    identifier(plan.runId);
    const cap = amount(plan.cap), verificationReserve = amount(plan.verificationReserve), reportReserve = amount(plan.reportReserve);
    if (typeof plan.deadlineAt !== "string" || !Number.isFinite(Date.parse(plan.deadlineAt))) throw new Error("Budget runs require a deadline.");
    for (const key of resources) if (BigInt(verificationReserve[key]) + BigInt(reportReserve[key]) > BigInt(cap[key])) throw new Error("Protected reserves exceed the run cap.");
    const run: StoredRun = { runId: plan.runId, cap, verificationReserve, reportReserve, deadlineAt: new Date(plan.deadlineAt).toISOString(), state: "open", closeReason: null, createdAt: new Date().toISOString() };
    this.transaction(() => {
      this.db.prepare("INSERT INTO budget_runs(id, document) VALUES (?, ?)").run(run.runId, JSON.stringify(run));
      this.event(run.runId, null, "run_created");
    });
  }

  reserve(input: Pick<BudgetInvocation, "id" | "runId" | "taskRef" | "pool" | "pricingRef" | "maximum">): BudgetInvocation {
    for (const field of [input.id, input.runId, input.taskRef, input.pricingRef]) identifier(field);
    if (!pools.includes(input.pool)) throw new Error("Unsupported budget pool.");
    const maximum = amount(input.maximum);
    if (maximum.tokens === 0 && maximum.costMicrousd === 0) throw new Error("A reservation must bound a nonzero resource.");
    return this.transaction(() => {
      const existing = this.db.prepare("SELECT document FROM budget_invocations WHERE id=?").get(input.id);
      if (existing) {
        const item = JSON.parse(String(existing.document)) as BudgetInvocation;
        if (item.runId !== input.runId || item.taskRef !== input.taskRef || item.pool !== input.pool || item.pricingRef !== input.pricingRef || !same(item.maximum, maximum)) throw new Error("An invocation identity cannot change its reservation.");
        return item;
      }
      const run = this.run(input.runId); this.allowDispatch(run, input.pool);
      const snapshot = this.snapshot(input.runId);
      const available = snapshot.pools.find(pool => pool.pool === input.pool)!.available;
      if (resources.some(key => maximum[key] > available[key])) throw new BudgetDeniedError("The request exceeds its uncommitted budget pool.");
      const now = new Date().toISOString();
      const item: BudgetInvocation = { id: input.id, runId: input.runId, taskRef: input.taskRef, pool: input.pool, pricingRef: input.pricingRef, maximum, state: "reserved", actual: null, overrun: false, createdAt: now, updatedAt: now };
      this.db.prepare("INSERT INTO budget_invocations(id, run_id, document) VALUES (?, ?, ?)").run(item.id, item.runId, JSON.stringify(item));
      this.event(item.runId, item.id, "reserved"); return item;
    });
  }

  dispatch(id: string): void {
    this.transaction(() => {
      const item = this.invocation(id); this.allowDispatch(this.run(item.runId), item.pool);
      if (item.state !== "reserved") throw new Error("An invocation can dispatch only once from reserved state.");
      item.state = "in_flight"; this.saveInvocation(item); this.event(item.runId, id, "dispatched");
    });
  }
  uncertain(id: string): void {
    this.transaction(() => {
      const item = this.invocation(id);
      if (["uncertain", "settled"].includes(item.state)) return;
      if (item.state !== "in_flight") throw new Error("Only a dispatched invocation can have unknown usage.");
      item.state = "uncertain"; this.saveInvocation(item); this.event(item.runId, id, "usage_uncertain");
    });
  }
  release(id: string): void {
    this.transaction(() => {
      const item = this.invocation(id);
      if (item.state === "released") return;
      if (item.state !== "reserved") throw new Error("Dispatched or uncertain liability cannot be released without a receipt.");
      item.state = "released"; this.saveInvocation(item); this.event(item.runId, id, "released_before_dispatch");
    });
  }
  settle(id: string, receipt: BudgetAmount): void {
    const actual = amount(receipt);
    this.transaction(() => {
      const item = this.invocation(id);
      if (item.state === "settled") {
        if (!same(item.actual!, actual)) throw new Error("A settled usage receipt is immutable.");
        return;
      }
      if (!["in_flight", "uncertain"].includes(item.state)) throw new Error("Usage requires a dispatched invocation.");
      item.state = "settled"; item.actual = actual;
      item.overrun = resources.some(key => actual[key] > item.maximum[key]);
      this.saveInvocation(item); this.event(item.runId, id, item.overrun ? "receipt_overrun" : "settled");
      if (item.overrun) { const run = this.run(item.runId); run.state = "closed"; run.closeReason = "receipt_overrun"; this.saveRun(run); }
    });
  }
  beginClosing(runId: string): void {
    this.transaction(() => {
      const run = this.run(runId);
      if (run.state !== "open") return;
      run.state = "closing"; this.saveRun(run); this.event(runId, null, "closing");
    });
  }
  closeRun(runId: string, reason: string): void {
    identifier(reason);
    this.transaction(() => {
      const run = this.run(runId);
      if (run.state !== "closed") { run.state = "closed"; run.closeReason = reason; this.saveRun(run); this.event(runId, null, "closed"); }
      for (const item of this.snapshot(runId).invocations.filter(item => item.state === "in_flight")) {
        item.state = "uncertain"; this.saveInvocation(item); this.event(runId, item.id, "usage_uncertain");
      }
    });
  }

  snapshot(runId: string): BudgetSnapshot {
    // One read transaction prevents a snapshot combining incompatible concurrent states.
    const read = () => {
      const run = this.run(runId);
      const invocations = this.db.prepare("SELECT document FROM budget_invocations WHERE run_id=? ORDER BY id").all(runId).map(row => JSON.parse(String(row.document)) as BudgetInvocation);
      return { run, invocations, pools: pools.map(pool => {
        const cap = poolCap(run, pool);
        const spent = { tokens: 0n, costMicrousd: 0n }, held = { tokens: 0n, costMicrousd: 0n };
        for (const item of invocations.filter(item => item.pool === pool)) for (const key of resources) {
          if (item.state === "settled") spent[key] += BigInt(item.actual![key]);
          else if (item.state !== "released") held[key] += BigInt(item.maximum[key]);
        }
        const available = (key: typeof resources[number]) => Number(BigInt(cap[key]) > spent[key] + held[key] ? BigInt(cap[key]) - spent[key] - held[key] : 0n);
        return { pool, cap, spent: { tokens: String(spent.tokens), costMicrousd: String(spent.costMicrousd) }, held: { tokens: String(held.tokens), costMicrousd: String(held.costMicrousd) }, available: { tokens: available("tokens"), costMicrousd: available("costMicrousd") } };
      }) };
    };
    if (this.db.isTransaction) return read();
    this.db.exec("BEGIN");
    try { const result = read(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  events(runId: string): { invocationId: string | null; kind: string; at: string }[] {
    return this.db.prepare("SELECT invocation_id, kind, at FROM budget_events WHERE run_id=? ORDER BY id").all(runId)
      .map(row => ({ invocationId: row.invocation_id === null ? null : String(row.invocation_id), kind: String(row.kind), at: String(row.at) }));
  }
  close(): void { this.db.close(); }
}
