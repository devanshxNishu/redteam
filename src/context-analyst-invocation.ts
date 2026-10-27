import { lstatSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";
import { BudgetLedger } from "./budget.ts";
import type { BudgetAmount, BudgetPlan } from "./budget.ts";
import { ContextDataError, fields, json, timestamp, text, freeze } from "./context-data.ts";
import { checkContextAnalystTaskBinding } from "./context-analyst-task.ts";
import type { ContextAnalystTask } from "./context-analyst-task.ts";
import type { ContextAnalystPreparation } from "./context-analyst-config.ts";
import type { WorkspaceStore } from "./workspace.ts";

export interface ContextAnalystPhase { invocationRef: string; signal: AbortSignal; maximum: Readonly<BudgetAmount> }
export interface ContextAnalystGenerationPhase extends ContextAnalystPhase { inputTokens: number; maximumOutputTokens: number }
const construction = Symbol("checked context phases"), attempted = new WeakSet<object>();
const bindings = new WeakMap<object, { store: WorkspaceStore; preparation: ContextAnalystPreparation; guard: () => undefined }>();
/** Actual original handle only. Prototype instances and overridden public methods do not establish accounting authority. */
export function checkContextAnalystInvocationBinding(store: WorkspaceStore, preparation: ContextAnalystPreparation, value: ContextAnalystInvocations): undefined {
  const checked = bindings.get(value); if (!checked || checked.store !== store || checked.preparation !== preparation) throw new ContextDataError(); return checked.guard();
}
const keys = ["tokens", "costMicrousd"] as const;
function amount(value: unknown): BudgetAmount {
  const raw = fields(value, [...keys]); for (const key of keys) if (!Number.isSafeInteger(raw[key]) || (raw[key] as number) < 0) throw new ContextDataError();
  return { tokens: raw.tokens as number, costMicrousd: raw.costMicrousd as number };
}
function receipt(value: unknown): BudgetAmount | null { try { return amount(value); } catch { return null; } }
const reference = (runId: string, phase: "count" | "generation") => `${runId}:context_${phase}`;

/** No constructor normalization or schema repair is allowed on an existing ledger. */
function ledgerFiles(store: WorkspaceStore, allowMissing: boolean) {
  const state = store.directory, path = resolve(state, "budgets.sqlite");
  const file = (name: string) => { const info = lstatSync(name, { bigint: true, throwIfNoEntry: false }); if (info && (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1n || (info.mode & 0o077n))) throw new ContextDataError(); return info; };
  const root = () => { const info = lstatSync(state); if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) || realpathSync(state) !== state) throw new ContextDataError(); };
  root(); const pinned = file(path); if (!pinned && !allowMissing) throw new ContextDataError();
  const check = () => { root(); const current = file(path), wal = file(path + "-wal"), shm = file(path + "-shm"); if (pinned ? !current || current.dev !== pinned.dev || current.ino !== pinned.ino : current || wal || shm) throw new ContextDataError(); return undefined; };
  check(); return { path, exists: !!pinned, check };
}
function schema(db: DatabaseSync) {
  for (const [table, expected] of [
    ["budget_runs", [["id", "TEXT", 1, 0], ["document", "TEXT", 0, 1]]],
    ["budget_invocations", [["id", "TEXT", 1, 0], ["run_id", "TEXT", 0, 1], ["document", "TEXT", 0, 1]]],
    ["budget_events", [["id", "INTEGER", 1, 0], ["run_id", "TEXT", 0, 1], ["invocation_id", "TEXT", 0, 0], ["kind", "TEXT", 0, 1], ["at", "TEXT", 0, 1]]]
  ] as const) if (db.prepare("SELECT type FROM sqlite_master WHERE name=?").get(table)?.type !== "table" || !isDeepStrictEqual(db.prepare(`PRAGMA table_info(${table})`).all().map(c => [c.name, c.type, c.pk, c.notnull]), expected)) throw new ContextDataError();
  if (db.prepare("PRAGMA journal_mode").get()?.journal_mode !== "wal" || db.prepare("SELECT tbl_name FROM sqlite_master WHERE type='index' AND name='budget_invocations_run'").get()?.tbl_name !== "budget_invocations"
    || !isDeepStrictEqual(db.prepare("PRAGMA index_info(budget_invocations_run)").all().map(c => c.name), ["run_id"]) || db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name IN ('budget_runs','budget_invocations','budget_events') LIMIT 1").get()) throw new ContextDataError();
}
function document(row: Record<string, unknown>) { if (!(row.document instanceof Uint8Array) || row.document.byteLength > 1000000) throw new ContextDataError(); return json(Buffer.from(row.document)); }

/** Private adapter validates exact immutable plans/invocations around every ordinary ledger operation. */
class ContextLedger {
  readonly plan: Readonly<BudgetPlan>;
  private files: ReturnType<typeof ledgerFiles>;
  private createdAt: string | undefined;
  private initialized = false;
  private readonly store: WorkspaceStore;
  private readonly preparation: ContextAnalystPreparation;
  constructor(store: WorkspaceStore, preparation: ContextAnalystPreparation) {
    this.store = store; this.preparation = preparation;
    const m = preparation.manifest; this.plan = freeze({ runId: m.runId, cap: { ...m.budget.cap }, verificationReserve: { tokens: 0, costMicrousd: 0 }, reportReserve: { tokens: 0, costMicrousd: 0 }, deadlineAt: m.inferenceDeadlineAt });
    this.files = ledgerFiles(store, true); this.preflight();
  }
  preflight() { this.files.check(); if (!this.files.exists) return; const db = new DatabaseSync(this.files.path, { readOnly: true, allowExtension: false, defensive: true, timeout: 1000 }); try { schema(db); if (db.prepare("SELECT id FROM budget_runs WHERE id=?").get(this.plan.runId) || db.prepare("SELECT id FROM budget_invocations WHERE run_id=? LIMIT 1").get(this.plan.runId)) throw new ContextDataError(); } finally { db.close(); } this.files.check(); }
  create() {
    this.preflight(); const ledger = new BudgetLedger(dirname(this.store.directory)); try { ledger.createRun(this.plan); } finally { ledger.close(); }
    this.files = ledgerFiles(this.store, false); this.initialized = true; this.check();
  }
  check(): "open" | "closing" | "closed" {
    if (!this.initialized) throw new ContextDataError(); this.files.check();
    const db = new DatabaseSync(this.files.path, { readOnly: true, allowExtension: false, defensive: true, timeout: 1000 });
    try {
      schema(db); const row = db.prepare("SELECT id, CASE WHEN length(CAST(document AS BLOB)) BETWEEN 1 AND 1000000 THEN CAST(document AS BLOB) ELSE NULL END AS document FROM budget_runs WHERE id=?").get(this.plan.runId); if (!row) throw new ContextDataError();
      const run = fields(document(row), ["runId", "cap", "verificationReserve", "reportReserve", "deadlineAt", "state", "closeReason", "createdAt"]), createdAt = timestamp(run.createdAt);
      if (row.id !== this.plan.runId || run.runId !== this.plan.runId || !isDeepStrictEqual(amount(run.cap), this.plan.cap) || !isDeepStrictEqual(amount(run.verificationReserve), this.plan.verificationReserve) || !isDeepStrictEqual(amount(run.reportReserve), this.plan.reportReserve) || run.deadlineAt !== this.plan.deadlineAt || this.createdAt && this.createdAt !== createdAt || !["open", "closing", "closed"].includes(run.state as string)) throw new ContextDataError();
      if (run.state === "closed") text(run.closeReason, 200); else if (run.closeReason !== null) throw new ContextDataError();
      const rows = db.prepare("SELECT id,run_id,CASE WHEN length(CAST(document AS BLOB)) BETWEEN 1 AND 1000000 THEN CAST(document AS BLOB) ELSE NULL END AS document FROM budget_invocations WHERE run_id=? LIMIT 3").all(this.plan.runId); if (rows.length > 2) throw new ContextDataError();
      for (const row of rows) {
        const item = fields(document(row), ["id", "runId", "taskRef", "pool", "pricingRef", "maximum", "state", "actual", "overrun", "createdAt", "updatedAt"]), phase = item.id === reference(this.plan.runId, "count") ? "count" : item.id === reference(this.plan.runId, "generation") ? "generation" : null;
        if (!phase || row.id !== item.id || row.run_id !== this.plan.runId || item.runId !== this.plan.runId || item.taskRef !== this.preparation.manifest.taskId || item.pool !== "investigation" || item.pricingRef !== this.preparation.manifest.configurationSha256 || !isDeepStrictEqual(amount(item.maximum), this.preparation.manifest.budget[phase]) || !["reserved", "in_flight", "uncertain", "settled", "released"].includes(item.state as string)) throw new ContextDataError();
        timestamp(item.createdAt); timestamp(item.updatedAt); const actual = item.actual === null ? null : amount(item.actual);
        if (item.state === "settled" ? !actual || item.overrun !== keys.some(key => actual[key] > amount(item.maximum)[key]) : actual !== null || item.overrun !== false) throw new ContextDataError();
      }
      this.createdAt ??= createdAt; this.files.check(); return run.state as "open" | "closing" | "closed";
    } finally { db.close(); }
  }
  with<T>(work: (ledger: BudgetLedger) => T): T {
    this.check(); const ledger = new BudgetLedger(dirname(this.store.directory)); try { const value = work(ledger); this.check(); return value; } finally { ledger.close(); }
  }
}
function abortable<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((accept, reject) => { const abort = () => { signal.removeEventListener("abort", abort); reject(new ContextDataError()); }; signal.addEventListener("abort", abort, { once: true }); pending.then(value => { signal.removeEventListener("abort", abort); accept(value); }, error => { signal.removeEventListener("abort", abort); reject(error); }); if (signal.aborted) abort(); });
}

/** Trusted coordinator callbacks only. It creates no HTTP request, model key, candidate, seal or semantic approval. */
export class ContextAnalystInvocations {
  readonly signal: AbortSignal;
  private readonly controller = new AbortController();
  private readonly book: ContextLedger;
  private readonly caps: { count: Readonly<BudgetAmount>; generation: Readonly<BudgetAmount> };
  private countState: "unused" | "started" | "returned" | "failed" = "unused";
  private generationStarted = false;
  private inputTokens: number | undefined;
  private closed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly store: WorkspaceStore;
  private readonly preparation: ContextAnalystPreparation;
  private readonly task: ContextAnalystTask;
  private constructor(key: symbol, store: WorkspaceStore, preparation: ContextAnalystPreparation, task: ContextAnalystTask, book: ContextLedger) {
    if (key !== construction) throw new ContextDataError(); this.store = store; this.preparation = preparation; this.task = task; this.book = book; this.caps = freeze({ count: { ...preparation.manifest.budget.count }, generation: { ...preparation.manifest.budget.generation } }); this.signal = AbortSignal.any([this.controller.signal, task.inferenceSignal]);
    this.book.create();
    try { this.assertActive(); this.timer = setTimeout(() => this.controller.abort(), Math.max(1, Date.parse(preparation.manifest.inferenceDeadlineAt) - Date.now())); this.timer.unref(); bindings.set(this, { store, preparation, guard: () => this.assertActive() }); }
    catch { this.controller.abort(); try { this.book.with(ledger => ledger.closeRun(preparation.manifest.runId, "context_initialization_failed")); } catch { /* Preserve uncertain initialization without adopting/retrying it. */ } throw new ContextDataError(); }
  }
  static async create(store: WorkspaceStore, preparation: ContextAnalystPreparation, task: ContextAnalystTask) {
    try {
      checkContextAnalystTaskBinding(store, preparation, task); if (attempted.has(task)) throw new ContextDataError(); const book = new ContextLedger(store, preparation);
      await abortable(task.checkInferenceFiles(), task.inferenceSignal); checkContextAnalystTaskBinding(store, preparation, task); book.preflight();
      const snapshot = task.snapshot().record; if (snapshot.state !== "running" || snapshot.attempt !== 1 || snapshot.dispatchIntents.length || snapshot.output !== null || attempted.has(task)) throw new ContextDataError();
      attempted.add(task); return new ContextAnalystInvocations(construction, store, preparation, task, book);
    } catch { throw new ContextDataError(); }
  }
  private assertActive(): undefined {
    if (this.closed || this.signal.aborted) throw new ContextDataError(); checkContextAnalystTaskBinding(this.store, this.preparation, this.task);
    if (this.closed || this.signal.aborted || this.book.check() !== "open") throw new ContextDataError(); return undefined;
  }
  assertManifest(identity: { runId: string; taskId: string; sha256: string }): void {
    const raw = fields(identity, ["runId", "taskId", "sha256"]); if (raw.runId !== this.preparation.manifest.runId || raw.taskId !== this.preparation.manifest.taskId || raw.sha256 !== this.preparation.manifestSha256) throw new ContextDataError(); this.assertActive();
  }
  async checkTransmissionFiles(): Promise<void> {
    try { this.assertActive(); await abortable(this.task.checkInferenceFiles(), this.signal); this.assertActive(); }
    catch { throw new ContextDataError(); }
  }
  private uncertain(id: string) { try { this.book.with(ledger => ledger.uncertain(id)); } catch { /* Never release possible dispatch without a trusted receipt. */ } }
  private async invoke<T, U>(phase: "count" | "generation", work: (context: ContextAnalystPhase) => Promise<T>, consume: (result: T) => { result: U; usage: BudgetAmount | null }): Promise<{ result: U; liability: "settled" | "uncertain" }> {
    const id = reference(this.preparation.manifest.runId, phase); let reserved = false, dispatched = false;
    try {
      this.assertActive(); await abortable(this.task.checkInferenceFiles(), this.signal); this.assertActive();
      this.book.with(ledger => { if (ledger.snapshot(this.preparation.manifest.runId).invocations.some(item => item.id === id)) throw new ContextDataError(); return ledger.reserve({ id, runId: this.preparation.manifest.runId, taskRef: this.preparation.manifest.taskId, pool: "investigation", pricingRef: this.preparation.manifest.configurationSha256, maximum: this.caps[phase] }); }); reserved = true;
      await abortable(this.task.beforeDispatch(id, () => this.assertActive()), this.signal); this.assertActive(); this.book.with(ledger => ledger.dispatch(id)); dispatched = true;
    } catch { if (reserved && !dispatched) try { this.book.with(ledger => ledger.release(id)); } catch { /* Preserve factual reservation on uncertain cleanup. */ } throw new ContextDataError(); }
    const onAbort = () => this.uncertain(id); this.signal.addEventListener("abort", onAbort, { once: true });
    let pending: Promise<{ result: U; liability: "settled" | "uncertain" }>;
    try {
      this.assertActive(); const returned = work(Object.freeze({ invocationRef: id, signal: this.signal, maximum: this.caps[phase] }));
      pending = Promise.resolve(returned).then(value => { const checked = consume(value); if (!checked.usage) { this.uncertain(id); return { result: checked.result, liability: "uncertain" as const }; }
        this.book.with(ledger => ledger.settle(id, checked.usage!)); if (keys.some(key => checked.usage![key] > this.caps[phase][key])) throw new ContextDataError(); return { result: checked.result, liability: "settled" as const };
      }).catch(() => { this.uncertain(id); throw new ContextDataError(); }).finally(() => this.signal.removeEventListener("abort", onAbort));
    } catch { this.signal.removeEventListener("abort", onAbort); this.uncertain(id); throw new ContextDataError(); }
    const result = await abortable(pending, this.signal); this.assertActive(); await abortable(this.task.checkInferenceFiles(), this.signal); this.assertActive(); return result;
  }
  async count(work: (context: ContextAnalystPhase) => Promise<number>): Promise<number> {
    if (typeof work !== "function" || this.countState !== "unused") throw new ContextDataError(); this.countState = "started";
    try { const { result } = await this.invoke("count", work, result => ({ result, usage: null })); if (!Number.isSafeInteger(result) || result < 1 || result > this.preparation.manifest.configuration.limits.maximumInputTokens) throw new ContextDataError(); this.inputTokens = result; this.countState = "returned"; return result; }
    catch { this.countState = "failed"; throw new ContextDataError(); }
  }
  async generate<T>(work: (context: ContextAnalystGenerationPhase) => Promise<{ value: T; usage: unknown }>): Promise<{ value: T; liability: "settled" | "uncertain" }> {
    if (typeof work !== "function" || this.countState !== "returned" || this.inputTokens === undefined || this.generationStarted) throw new ContextDataError(); this.generationStarted = true;
    const { result, liability } = await this.invoke("generation", context => work(Object.freeze({ ...context, inputTokens: this.inputTokens!, maximumOutputTokens: this.preparation.manifest.configuration.limits.maximumOutputTokens })), value => { const raw = fields(value, ["value", "usage"]); return { result: raw.value as T, usage: receipt(raw.usage) }; });
    return { value: result, liability };
  }
  snapshot() { return this.book.with(ledger => ledger.snapshot(this.preparation.manifest.runId)); }
  close(): void { if (this.closed) return; this.closed = true; if (this.timer) { clearTimeout(this.timer); this.timer = undefined; } this.controller.abort(); this.book.with(ledger => ledger.closeRun(this.preparation.manifest.runId, "context_invocations_closed")); }
}
