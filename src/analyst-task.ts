import { TaskStore } from "./tasks.ts";
import { resolve } from "node:path";
import type { TaskLease, TaskRecord, SealedTaskOutput } from "./tasks.ts";

export interface AnalystTaskPolicy { leaseMs: number; heartbeatMs: number }
export interface AnalystTaskInput { taskId: string; runId: string; questionKey: string; manifestHash: string; deadlineAt: string; owner: string }
export type AnalystTaskFailure = "adapter_failed" | "policy_denied" | "invalid_output" | "limit_reached";
export const defaultAnalystTaskPolicy: Readonly<AnalystTaskPolicy> = Object.freeze({ leaseMs: 30000, heartbeatMs: 1000 });
export class AnalystTaskPolicyError extends Error {}

function fields(value: unknown, allowed: string[], required = allowed): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).some(key => typeof key !== "string" || !allowed.includes(key))
    || Object.values(Object.getOwnPropertyDescriptors(value)).some(field => !("value" in field))
    || required.some(key => !Object.hasOwn(value, key))) throw new AnalystTaskPolicyError("Analyst task configuration requires plain supported fields.");
}
export function analystTaskPolicy(input: Partial<AnalystTaskPolicy> = {}): AnalystTaskPolicy {
  fields(input, ["leaseMs", "heartbeatMs"], []);
  const policy = { ...defaultAnalystTaskPolicy, ...input };
  if (Object.values(policy).some(value => !Number.isSafeInteger(value) || value < 1)
    || policy.leaseMs > 60000 || policy.heartbeatMs >= policy.leaseMs) throw new AnalystTaskPolicyError("Invalid analyst task lease policy.");
  return policy;
}
function sourceAuthority(check: () => unknown): void {
  try {
    const result = check();
    if (result !== undefined) {
      // An async check is never authority. Consume a native rejection without awaiting it.
      if (result instanceof Promise) void result.catch(() => {});
      throw new Error();
    }
  } catch { throw new AnalystTaskPolicyError("Analyst source authority is unavailable."); }
}

/** Coordinator-only ownership handle. Never pass it, its callback, or its store to a model. */
export class AnalystTask {
  readonly signal: AbortSignal;
  private readonly controller = new AbortController();
  private readonly store: TaskStore;
  private readonly workspace: string;
  private readonly lease: TaskLease;
  private readonly checkSource: () => unknown;
  private phase: "running" | "sealed" | "completed" | "stopped" | "closed" = "running";
  private sealed: SealedTaskOutput | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(workspace: string, input: AnalystTaskInput, checkSource: () => unknown, inputPolicy: Partial<AnalystTaskPolicy> = {}) {
    this.signal = this.controller.signal;
    const policy = analystTaskPolicy(inputPolicy);
    fields(input, ["taskId", "runId", "questionKey", "manifestHash", "deadlineAt", "owner"]);
    if ([input.taskId, input.runId, input.questionKey, input.owner].some(value => typeof value !== "string" || !value.trim() || value.length > 200)
      || typeof input.manifestHash !== "string" || !/^[a-f0-9]{64}$/.test(input.manifestHash)
      || typeof input.deadlineAt !== "string" || !Number.isFinite(Date.parse(input.deadlineAt)) || Date.parse(input.deadlineAt) <= Date.now()
      || typeof checkSource !== "function") throw new AnalystTaskPolicyError("Invalid analyst task identity or deadline.");
    // Copy authority inputs before invoking the coordinator callback.
    const pinned = { ...input };
    this.workspace = resolve(workspace);
    sourceAuthority(checkSource);
    this.checkSource = checkSource;
    this.store = new TaskStore(this.workspace);
    try {
      this.store.create({ id: pinned.taskId, runId: pinned.runId, kind: "analyst", questionKey: pinned.questionKey, manifestHash: pinned.manifestHash, maximumAttempts: 1, deadlineAt: pinned.deadlineAt });
      this.lease = this.store.claim(pinned.taskId, pinned.owner, policy.leaseMs);
      this.store.start(this.lease);
      this.assertActive();
      this.timer = setInterval(() => {
        try {
          if (this.phase === "running") { this.assertActive(); this.store.heartbeat(this.lease, policy.leaseMs); }
          else if (this.phase === "sealed") this.assertSealed();
        } catch { this.invalidate(); }
      }, policy.heartbeatMs);
      this.timer.unref();
    } catch (error) { this.invalidate(); this.store.close(); throw error; }
  }
  private stopTimer(): void { if (this.timer) { clearInterval(this.timer); this.timer = undefined; } }
  private invalidate(): void { this.controller.abort(); this.stopTimer(); }
  private authority(): void {
    if (this.signal.aborted || this.phase === "closed" || this.phase === "stopped") throw new AnalystTaskPolicyError("Analyst task authority is no longer valid.");
    sourceAuthority(this.checkSource);
  }
  assertWorkspace(workspace: string): void {
    if (resolve(workspace) !== this.workspace) throw new AnalystTaskPolicyError("Analyst task belongs to a different workspace.");
  }
  assertActive(): void {
    try {
      this.authority();
      if (this.phase !== "running") throw new Error();
      // Check after the callback: it cannot cancel/expire ownership and still authorize work.
      this.store.assertRunning(this.lease);
    } catch { this.invalidate(); throw new AnalystTaskPolicyError("Analyst task or source authority is no longer valid."); }
  }
  beforeDispatch(invocationRef: string): void {
    this.assertActive();
    try { this.store.recordDispatchIntent(this.lease, invocationRef); }
    catch { this.invalidate(); throw new AnalystTaskPolicyError("Analyst dispatch intent could not be recorded under its lease."); }
  }
  seal(output: SealedTaskOutput): void {
    this.assertActive();
    try {
      this.store.seal(this.lease, output);
      // Use the validated stored copy, never read output accessors again.
      this.sealed = this.store.task(this.lease.taskId).output!;
      this.phase = "sealed";
    } catch { this.invalidate(); throw new AnalystTaskPolicyError("Analyst output could not be sealed under its lease."); }
  }
  private assertSealed(): void {
    this.authority();
    const task = this.store.task(this.lease.taskId);
    if (this.phase !== "sealed" || task.state !== "sealed" || task.fence !== this.lease.fence || !this.sealed
      || task.output?.artifactRef !== this.sealed.artifactRef || task.output.sha256 !== this.sealed.sha256
      || Date.parse(task.spec.deadlineAt) <= Date.now()) throw new AnalystTaskPolicyError("Analyst sealed output is no longer current.");
  }
  complete(expectedHash: string): void {
    try {
      // Sealing removes the lease. Completion checks the sealed fence and source instead.
      this.assertSealed();
      this.store.complete(this.lease.taskId, expectedHash, this.lease.fence);
      this.phase = "completed"; this.stopTimer();
    } catch { this.invalidate(); throw new AnalystTaskPolicyError("Analyst completion requires current source authority and the exact sealed output."); }
  }
  stop(reason: AnalystTaskFailure | "cancelled"): void {
    if (!["adapter_failed", "policy_denied", "invalid_output", "limit_reached", "cancelled"].includes(reason)) throw new AnalystTaskPolicyError("Unsupported analyst task stop reason.");
    this.invalidate();
    if (this.phase === "closed" || this.phase === "completed" || this.phase === "stopped") return;
    try {
      if (reason === "cancelled") this.store.cancel(this.lease.taskId, this.lease.fence);
      else if (this.phase === "running") this.store.fail(this.lease, reason);
      // A failed sealed finalization stays sealed for factual deadline recovery.
    } catch { /* Stale owners cannot mutate a replacement or resurrect an expired task. */ }
    this.phase = "stopped";
  }
  snapshot(): { record: TaskRecord; events: { kind: string; at: string }[] } {
    if (this.phase === "closed") throw new AnalystTaskPolicyError("Analyst task handle is closed.");
    return { record: this.store.task(this.lease.taskId), events: this.store.events(this.lease.taskId) };
  }
  close(): void {
    if (this.phase === "closed") return;
    this.invalidate(); this.phase = "closed"; this.store.close();
  }
}
