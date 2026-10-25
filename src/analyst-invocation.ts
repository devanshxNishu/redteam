import { resolve } from "node:path";
import { BudgetLedger } from "./budget.ts";
import type { BudgetAmount } from "./budget.ts";
import { sha256 } from "./evidence.ts";
import { parseAnalystConfiguration } from "./analyst-config.ts";
import type { prepareAnalystRun } from "./analyst-config.ts";
import type { AnalystTask } from "./analyst-task.ts";

type Preparation = Awaited<ReturnType<typeof prepareAnalystRun>>;
export interface AnalystPhaseContext { invocationRef: string; signal: AbortSignal; maximum: Readonly<BudgetAmount> }
export interface AnalystGenerationContext extends AnalystPhaseContext { inputTokens: number; maximumOutputTokens: number }
export class AnalystInvocationError extends Error {}
function ledger<T>(workspace: string, work: (store: BudgetLedger) => T): T {
  const store = new BudgetLedger(workspace); try { return work(store); } finally { store.close(); }
}
function receipt(value: unknown): BudgetAmount | null {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const fields = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(fields);
  if (keys.length !== 2 || keys.some(key => key !== "tokens" && key !== "costMicrousd")) return null;
  for (const key of ["tokens", "costMicrousd"]) if (!fields[key]?.enumerable || !("value" in fields[key]!) || !Number.isSafeInteger(fields[key]!.value) || fields[key]!.value < 0) return null;
  return { tokens: fields.tokens!.value as number, costMicrousd: fields.costMicrousd!.value as number };
}
function abortable<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((accept, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(new AnalystInvocationError("Analyst inference stopped before a current result was available.")); };
    signal.addEventListener("abort", abort, { once: true });
    pending.then(value => { signal.removeEventListener("abort", abort); accept(value); }, error => { signal.removeEventListener("abort", abort); reject(error); });
    if (signal.aborted) abort();
  });
}

/** Coordinator-only phase accounting. Callbacks are trusted transport code, never model-provided tools. */
export class AnalystInvocations {
  readonly signal: AbortSignal;
  private readonly controller = new AbortController();
  private readonly workspace: string;
  private readonly task: AnalystTask;
  private readonly runId: string;
  private readonly taskId: string;
  private readonly pricingRef: string;
  private readonly manifestHash: string;
  private readonly deadline: number;
  private readonly expiry: number;
  private readonly caps: { count: Readonly<BudgetAmount>; generation: Readonly<BudgetAmount> };
  private readonly maximumInputTokens: number;
  private readonly maximumOutputTokens: number;
  private countState: "unused" | "started" | "returned" | "failed" = "unused";
  private generationStarted = false;
  private inputTokens: number | undefined;
  private closed = false;
  private deadlineTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(workspace: string, preparation: Preparation, task: AnalystTask) {
    const pinnedWorkspace = resolve(workspace);
    task.assertWorkspace(pinnedWorkspace);
    const manifest = preparation.manifest, config = parseAnalystConfiguration(manifest.configuration), snapshot = task.snapshot().record;
    const derived = { tokens: config.limits.count.tokens + config.limits.generation.tokens, costMicrousd: config.limits.count.costMicrousd + config.limits.generation.costMicrousd };
    if (preparation.kind !== "analyst_run_preparation" || preparation.state !== "not_started" || manifest.kind !== "analyst_run_manifest" || manifest.maximumAttempts !== 1
      || preparation.manifestSha256 !== sha256(JSON.stringify(manifest)) || manifest.configurationSha256 !== sha256(JSON.stringify(config))
      || manifest.generationSha256 !== sha256(JSON.stringify(preparation.generation)) || manifest.packetSha256 !== config.processing.packetSha256 || manifest.source.id !== config.processing.briefId
      || snapshot.spec.kind !== "analyst" || snapshot.spec.maximumAttempts !== 1 || snapshot.spec.id !== manifest.taskId || snapshot.spec.runId !== manifest.runId
      || snapshot.spec.questionKey !== manifest.questionKey || snapshot.spec.manifestHash !== preparation.manifestSha256 || snapshot.spec.deadlineAt !== manifest.coordinatorDeadlineAt
      || JSON.stringify(manifest.budget.cap) !== JSON.stringify(derived) || JSON.stringify(manifest.budget.count) !== JSON.stringify(config.limits.count) || JSON.stringify(manifest.budget.generation) !== JSON.stringify(config.limits.generation)
      || Date.parse(manifest.inferenceDeadlineAt) - Date.parse(manifest.preparedAt) !== config.limits.timeoutMs
      || Date.parse(manifest.coordinatorDeadlineAt) - Date.parse(manifest.inferenceDeadlineAt) !== config.limits.finalizationMs
      || Date.parse(config.processing.expiresAt) < Date.parse(manifest.coordinatorDeadlineAt)) throw new AnalystInvocationError("Analyst phase accounting requires the exact prepared manifest and matching task.");
    this.workspace = pinnedWorkspace; this.task = task; this.runId = manifest.runId; this.taskId = manifest.taskId; this.pricingRef = manifest.configurationSha256; this.manifestHash = preparation.manifestSha256;
    this.deadline = Date.parse(manifest.inferenceDeadlineAt); this.expiry = Date.parse(config.processing.expiresAt);
    const remaining = this.deadline - Date.now();
    if (!Number.isSafeInteger(remaining) || remaining < 1 || remaining > 300000) throw new AnalystInvocationError("Analyst inference deadline is unavailable.");
    this.signal = AbortSignal.any([this.controller.signal, task.signal]);
    this.caps = { count: Object.freeze({ ...config.limits.count }), generation: Object.freeze({ ...config.limits.generation }) };
    this.maximumInputTokens = config.limits.maximumInputTokens; this.maximumOutputTokens = config.limits.maximumOutputTokens;
    this.assertActive();
    // A duplicate run is denied, never adopted or reopened.
    ledger(this.workspace, store => store.createRun({ runId: this.runId, cap: derived, verificationReserve: { tokens: 0, costMicrousd: 0 }, reportReserve: { tokens: 0, costMicrousd: 0 }, deadlineAt: manifest.inferenceDeadlineAt }));
    try { this.assertActive(); }
    catch (error) { this.controller.abort(); ledger(this.workspace, store => store.closeRun(this.runId, "analyst_initialization_failed")); throw error; }
    this.deadlineTimer = setTimeout(() => this.controller.abort(), Math.max(1, this.deadline - Date.now())); this.deadlineTimer.unref();
  }
  assertManifest(identity: { runId: string; taskId: string; sha256: string }): void {
    if (identity.runId !== this.runId || identity.taskId !== this.taskId || identity.sha256 !== this.manifestHash) throw new AnalystInvocationError("Analyst transport must match this exact manifest.");
    this.assertActive();
  }
  private assertActive(): void {
    if (this.closed || this.signal.aborted || Date.now() >= this.deadline || Date.now() >= this.expiry) throw new AnalystInvocationError("Analyst phase authority is no longer current.");
    this.task.assertActive();
    if (this.signal.aborted || Date.now() >= this.deadline || Date.now() >= this.expiry) throw new AnalystInvocationError("Analyst phase authority is no longer current.");
  }
  private uncertain(id: string): void {
    try { ledger(this.workspace, store => store.uncertain(id)); } catch { /* In-flight liability remains held if the write fails. */ }
  }
  private async invoke<T, U>(phase: "count" | "generation", work: (context: AnalystPhaseContext) => Promise<T>, consume: (result: T) => { result: U; usage: BudgetAmount | null }): Promise<{ result: U; liability: "settled" | "uncertain" }> {
    const id = `${this.runId}:${phase}`;
    try {
      this.assertActive(); this.task.beforeDispatch(id);
      ledger(this.workspace, store => {
        store.reserve({ id, runId: this.runId, taskRef: this.taskId, pool: "investigation", pricingRef: this.pricingRef, maximum: { ...this.caps[phase] } });
        try { this.assertActive(); store.dispatch(id); }
        catch (error) { try { store.release(id); } catch { /* Release only a still-reserved invocation. */ } throw error; }
      });
    } catch { throw new AnalystInvocationError("Analyst phase could not acquire current ownership and its exact budget reservation."); }
    const onAbort = () => this.uncertain(id);
    this.signal.addEventListener("abort", onAbort, { once: true });
    let pending: Promise<{ result: U; liability: "settled" | "uncertain" }>;
    try {
      this.assertActive();
      const returned = work(Object.freeze({ invocationRef: id, signal: this.signal, maximum: this.caps[phase] }));
      pending = Promise.resolve(returned).then(result => {
        const checked = consume(result), usage = checked.usage;
        if (!usage) { this.uncertain(id); return { result: checked.result, liability: "uncertain" as const }; }
        ledger(this.workspace, store => store.settle(id, usage));
        if (usage.tokens > this.caps[phase].tokens || usage.costMicrousd > this.caps[phase].costMicrousd) throw new AnalystInvocationError("Analyst phase exceeded its recorded budget.");
        return { result: checked.result, liability: "settled" as const };
      }).catch(() => { this.uncertain(id); throw new AnalystInvocationError("Analyst transport or receipt could not complete this phase."); })
        .finally(() => this.signal.removeEventListener("abort", onAbort));
    } catch { this.signal.removeEventListener("abort", onAbort); this.uncertain(id); throw new AnalystInvocationError("Analyst transport could not start under current authority."); }
    const result = await abortable(pending, this.signal);
    this.assertActive(); return result;
  }
  async count(work: (context: AnalystPhaseContext) => Promise<number>): Promise<number> {
    if (typeof work !== "function" || this.countState !== "unused") throw new AnalystInvocationError("Analyst count can start only once.");
    this.countState = "started";
    try {
      // A token count is not an authenticated cost receipt, even when successful.
      const { result } = await this.invoke("count", work, result => ({ result, usage: null }));
      if (!Number.isSafeInteger(result) || result < 1 || result > this.maximumInputTokens) throw new AnalystInvocationError("Counted input exceeds the configured analyst allowance.");
      this.inputTokens = result; this.countState = "returned"; return result;
    } catch (error) { this.countState = "failed"; throw error; }
  }
  async generate<T>(work: (context: AnalystGenerationContext) => Promise<{ value: T; usage: unknown }>): Promise<{ value: T; liability: "settled" | "uncertain" }> {
    if (typeof work !== "function" || this.countState !== "returned" || this.inputTokens === undefined || this.generationStarted) throw new AnalystInvocationError("Analyst generation requires one successful count and can start only once.");
    this.generationStarted = true;
    const { result, liability } = await this.invoke("generation", context => work(Object.freeze({ ...context, inputTokens: this.inputTokens!, maximumOutputTokens: this.maximumOutputTokens })), result => {
      if (!result || typeof result !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(result))) throw new Error();
      const fields = Object.getOwnPropertyDescriptors(result), keys = Reflect.ownKeys(fields);
      if (keys.length !== 2 || keys.some(key => key !== "value" && key !== "usage") || keys.some(key => !fields[key as string]?.enumerable || !("value" in fields[key as string]!))) throw new Error();
      return { result: fields.value!.value as T, usage: receipt(fields.usage!.value) };
    });
    return { value: result, liability };
  }
  close(): void {
    if (this.closed) return;
    this.closed = true; if (this.deadlineTimer) { clearTimeout(this.deadlineTimer); this.deadlineTimer = undefined; } this.controller.abort();
    ledger(this.workspace, store => store.closeRun(this.runId, "analyst_invocations_closed"));
  }
}
