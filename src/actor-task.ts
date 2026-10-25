import { TaskStore } from "./tasks.ts";
import type { TaskLease, TaskRecord, SealedTaskOutput } from "./tasks.ts";
import { BudgetLedger } from "./budget.ts";
import { InferencePolicyError } from "./actor.ts";
import type { ActorReport } from "./actor.ts";

export interface ActorTaskPolicy { leaseMs: number; heartbeatMs: number; finalizationMs: number }
export const defaultActorTaskPolicy: Readonly<ActorTaskPolicy> = Object.freeze({ leaseMs: 30000, heartbeatMs: 1000, finalizationMs: 10000 });
export interface ActorTaskSnapshot { record: TaskRecord; events: { kind: string; at: string }[] }
export function actorTaskPolicy(input: Partial<ActorTaskPolicy> = {}): ActorTaskPolicy {
  const policy = { ...defaultActorTaskPolicy, ...input };
  if (Object.keys(input).some(key => !["leaseMs", "heartbeatMs", "finalizationMs"].includes(key))
    || Object.values(policy).some(value => !Number.isSafeInteger(value) || value < 1)
    || policy.leaseMs > 60000 || policy.heartbeatMs >= policy.leaseMs || policy.finalizationMs > 10000) throw new Error("Invalid actor task lease or finalization policy.");
  return policy;
}

/** Coordinator-only handles. The inference adapter receives neither this object nor its store. */
export class ActorTask {
  readonly signal: AbortSignal;
  private readonly controller = new AbortController();
  private readonly store: TaskStore;
  private readonly lease: TaskLease;
  private readonly runId: string;
  private timer: ReturnType<typeof setInterval> | undefined;
  constructor(workspace: string, input: { taskId: string; runId: string; actorRef: string; manifestHash: string; deadlineAt: string; owner: string }, policy: ActorTaskPolicy) {
    this.signal = this.controller.signal; this.runId = input.runId;
    this.store = new TaskStore(workspace);
    try {
      this.store.create({ id: input.taskId, runId: input.runId, kind: "actor", questionKey: input.actorRef, manifestHash: input.manifestHash, maximumAttempts: 1, deadlineAt: input.deadlineAt });
      this.lease = this.store.claim(input.taskId, input.owner, policy.leaseMs);
      this.store.start(this.lease);
      this.timer = setInterval(() => {
        try { this.store.heartbeat(this.lease, policy.leaseMs); }
        catch { this.controller.abort(); this.stopTimer(); }
      }, policy.heartbeatMs);
      this.timer.unref();
    } catch (error) { this.store.close(); throw error; }
  }
  assertActive(): void {
    try { if (this.signal.aborted) throw new Error("Ownership was lost."); this.store.assertRunning(this.lease); }
    catch { this.controller.abort(); throw new InferencePolicyError("Actor task ownership is no longer valid."); }
  }
  beforeDispatch(invocationRef: string): void {
    this.assertActive();
    try { this.store.recordDispatchIntent(this.lease, invocationRef); }
    catch { this.controller.abort(); throw new InferencePolicyError("Actor dispatch intent could not be recorded under its lease."); }
  }
  accept(output: SealedTaskOutput): void {
    this.assertActive();
    this.store.seal(this.lease, output);
    this.store.complete(this.lease.taskId, output.sha256, this.lease.fence);
    this.stopTimer();
  }
  stop(outcome: ActorReport["outcome"]): void {
    this.stopTimer();
    this.store.recoverExpired(this.runId);
    if (outcome === "cancelled") {
      const current = this.store.task(this.lease.taskId);
      if (current.fence === this.lease.fence && current.lease?.owner === this.lease.owner) this.store.cancel(this.lease.taskId);
    } else {
      try { this.store.fail(this.lease, outcome === "limit_reached" ? "limit_reached" : outcome === "policy_denied" ? "policy_denied" : outcome === "invalid_decision" ? "invalid_output" : "adapter_failed"); }
      catch { this.store.recoverExpired(this.runId); }
    }
  }
  snapshot(): ActorTaskSnapshot { return { record: this.store.task(this.lease.taskId), events: this.store.events(this.lease.taskId) }; }
  private stopTimer(): void { if (this.timer) { clearInterval(this.timer); this.timer = undefined; } }
  close(): void { this.stopTimer(); this.store.close(); }
}

/** Recovers expired configured tasks conservatively; it never dispatches or releases uncertain spend. */
export function recoverActorTasks(workspace: string, runId?: string): { taskIds: string[]; runIds: string[] } {
  const tasks = new TaskStore(workspace);
  let ledger: BudgetLedger | undefined;
  try {
    ledger = new BudgetLedger(workspace);
    const candidates = [...new Set(tasks.list(runId).filter(task => task.spec.kind === "actor").map(task => task.spec.runId))];
    const taskIds: string[] = [], runIds: string[] = [];
    for (const id of candidates) {
      if (!ledger.hasRun(id)) continue;
      const recovered = tasks.recoverExpired(id);
      if (recovered.length) { ledger.closeRun(id, "task_interrupted"); taskIds.push(...recovered); runIds.push(id); }
    }
    return { taskIds, runIds };
  } finally { tasks.close(); ledger?.close(); }
}
