import { DatabaseSync } from "node:sqlite";
import { chmodSync, lstatSync } from "node:fs";
import { resolve } from "node:path";
import { workspaceDirectory } from "./workspace.ts";

export interface TaskSpec {
  id: string;
  runId: string;
  kind: "actor" | "analyst" | "verifier" | "reporter";
  questionKey: string;
  manifestHash: string;
  maximumAttempts: number;
  deadlineAt: string;
}
export interface TaskLease { taskId: string; owner: string; fence: number; expiresAt: string }
export interface SealedTaskOutput { artifactRef: string; sha256: string }
export interface TaskRecord {
  spec: TaskSpec;
  state: "queued" | "leased" | "running" | "sealed" | "completed" | "failed" | "cancelled" | "interrupted";
  attempt: number;
  fence: number;
  lease: TaskLease | null;
  dispatchIntents: { invocationRef: string; attempt: number }[];
  output: SealedTaskOutput | null;
  stopReason: string | null;
  createdAt: string;
  updatedAt: string;
}
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
function identifier(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 200) throw new Error("Tasks require bounded identifiers.");
}
function plain(value: unknown, keys: string[]): void {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).some(key => typeof key !== "string" || !keys.includes(key))
    || Object.values(Object.getOwnPropertyDescriptors(value)).some(field => !("value" in field))) throw new Error("Task records require plain supported fields without accessors.");
}

/** Fenced task-state foundation. It does not execute workers or grant tools. */
export class TaskStore {
  private readonly db: DatabaseSync;
  private readonly clock: () => number;
  constructor(workspace: string, clock = Date.now) {
    this.clock = clock;
    const file = resolve(workspaceDirectory(workspace), "tasks.sqlite");
    if (lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error("The task database must not be a symbolic link.");
    this.db = new DatabaseSync(file); chmodSync(file, 0o600);
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, question_key TEXT NOT NULL, document TEXT NOT NULL, UNIQUE(run_id, question_key));
      CREATE TABLE IF NOT EXISTS task_events (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL, kind TEXT NOT NULL, at TEXT NOT NULL);
    `);
  }
  private transaction<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = work(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  private now(): number {
    const now = this.clock();
    if (!Number.isSafeInteger(now) || now < 0) throw new Error("Task clock is invalid.");
    return now;
  }
  private save(task: TaskRecord, event: string): void {
    task.updatedAt = new Date(this.now()).toISOString();
    this.db.prepare("UPDATE tasks SET document=? WHERE id=?").run(JSON.stringify(task), task.spec.id);
    this.db.prepare("INSERT INTO task_events(task_id, kind, at) VALUES (?, ?, ?)").run(task.spec.id, event, task.updatedAt);
  }
  task(id: string): TaskRecord {
    const row = this.db.prepare("SELECT document FROM tasks WHERE id=?").get(id);
    if (!row) throw new Error("Task not found.");
    return JSON.parse(String(row.document)) as TaskRecord;
  }
  list(runId?: string): TaskRecord[] {
    const rows = runId === undefined ? this.db.prepare("SELECT document FROM tasks ORDER BY id").all()
      : this.db.prepare("SELECT document FROM tasks WHERE run_id=? ORDER BY id").all(runId);
    return rows.map(row => JSON.parse(String(row.document)) as TaskRecord);
  }
  create(spec: TaskSpec): TaskRecord {
    plain(spec, ["id", "runId", "kind", "questionKey", "manifestHash", "maximumAttempts", "deadlineAt"]);
    for (const value of [spec.id, spec.runId, spec.questionKey]) identifier(value);
    if (!["actor", "analyst", "verifier", "reporter"].includes(spec.kind) || !hash(spec.manifestHash)
      || !Number.isSafeInteger(spec.maximumAttempts) || spec.maximumAttempts < 1 || spec.maximumAttempts > 5
      || typeof spec.deadlineAt !== "string" || !Number.isFinite(Date.parse(spec.deadlineAt)) || Date.parse(spec.deadlineAt) <= this.now()) throw new Error("Task specification requires a supported kind, manifest hash, bounded attempts, and future deadline.");
    const frozenSpec: TaskSpec = { id: spec.id, runId: spec.runId, kind: spec.kind, questionKey: spec.questionKey, manifestHash: spec.manifestHash, maximumAttempts: spec.maximumAttempts, deadlineAt: new Date(spec.deadlineAt).toISOString() };
    const now = new Date(this.now()).toISOString();
    const task: TaskRecord = { spec: frozenSpec, state: "queued", attempt: 0, fence: 0, lease: null, dispatchIntents: [], output: null, stopReason: null, createdAt: now, updatedAt: now };
    return this.transaction(() => {
      this.db.prepare("INSERT INTO tasks(id, run_id, question_key, document) VALUES (?, ?, ?, ?)").run(spec.id, spec.runId, spec.questionKey, JSON.stringify(task));
      this.save(task, "created"); return task;
    });
  }
  private duration(milliseconds: number): void {
    if (!Number.isSafeInteger(milliseconds) || milliseconds < 1 || milliseconds > 60000) throw new Error("Task lease duration must be from 1 to 60000 milliseconds.");
  }
  private current(lease: TaskLease): TaskRecord {
    const task = this.task(lease.taskId);
    if (!["leased", "running"].includes(task.state) || !task.lease || task.lease.owner !== lease.owner || task.fence !== lease.fence
      || Date.parse(task.lease.expiresAt) <= this.now() || Date.parse(task.spec.deadlineAt) <= this.now()) throw new Error("The task lease is stale, expired, or no longer active.");
    return task;
  }
  claim(id: string, owner: string, milliseconds: number): TaskLease {
    identifier(owner); this.duration(milliseconds);
    return this.transaction(() => {
      const task = this.task(id), now = this.now();
      if (task.state !== "queued" || task.attempt >= task.spec.maximumAttempts || Date.parse(task.spec.deadlineAt) <= now) throw new Error("The task is not available for claim.");
      task.attempt++; task.fence++; task.state = "leased"; task.stopReason = null;
      task.lease = { taskId: id, owner, fence: task.fence, expiresAt: new Date(Math.min(now + milliseconds, Date.parse(task.spec.deadlineAt))).toISOString() };
      this.save(task, "claimed"); return { ...task.lease };
    });
  }
  start(lease: TaskLease): void {
    this.transaction(() => {
      const task = this.current(lease);
      if (task.state !== "leased") throw new Error("Only a leased task can start.");
      task.state = "running"; this.save(task, "started");
    });
  }
  assertRunning(lease: TaskLease): void {
    if (this.current(lease).state !== "running") throw new Error("The task is not running under this lease.");
  }
  heartbeat(lease: TaskLease, milliseconds: number): TaskLease {
    this.duration(milliseconds);
    return this.transaction(() => {
      const task = this.current(lease);
      task.lease!.expiresAt = new Date(Math.min(Math.max(Date.parse(task.lease!.expiresAt), this.now() + milliseconds), Date.parse(task.spec.deadlineAt))).toISOString();
      this.save(task, "lease_extended"); return { ...task.lease! };
    });
  }
  recordDispatchIntent(lease: TaskLease, invocationRef: string): void {
    identifier(invocationRef);
    this.transaction(() => {
      const task = this.current(lease);
      if (task.state !== "running") throw new Error("Only a running task can record a dispatch intent.");
      const prior = task.dispatchIntents.find(item => item.invocationRef === invocationRef);
      if (prior) { if (prior.attempt !== task.attempt) throw new Error("Invocation identity belongs to another attempt."); return; }
      if (task.dispatchIntents.length >= 1000) throw new Error("Task dispatch-intent limit reached.");
      task.dispatchIntents.push({ invocationRef, attempt: task.attempt }); this.save(task, "dispatch_intent");
    });
  }
  seal(lease: TaskLease, output: SealedTaskOutput): void {
    plain(output, ["artifactRef", "sha256"]);
    identifier(output.artifactRef);
    if (!hash(output.sha256)) throw new Error("Task output requires a SHA-256 digest.");
    this.transaction(() => {
      const task = this.current(lease);
      if (task.state !== "running" || task.output) throw new Error("Only a running task can seal one output.");
      task.output = { artifactRef: output.artifactRef, sha256: output.sha256 }; task.state = "sealed"; task.lease = null; this.save(task, "output_sealed");
    });
  }
  complete(id: string, expectedHash: string, expectedFence?: number): void {
    this.transaction(() => {
      const task = this.task(id);
      if (task.state !== "sealed" || !task.output || task.output.sha256 !== expectedHash || (expectedFence !== undefined && task.fence !== expectedFence)
        || Date.parse(task.spec.deadlineAt) <= this.now()) throw new Error("Completion requires the coordinator's expected sealed-output digest, fence, and remaining time.");
      task.state = "completed"; this.save(task, "completed");
    });
  }
  fail(lease: TaskLease, reason: "adapter_failed" | "policy_denied" | "invalid_output" | "limit_reached"): void {
    if (!["adapter_failed", "policy_denied", "invalid_output", "limit_reached"].includes(reason)) throw new Error("Unsupported task failure reason.");
    this.transaction(() => { const task = this.current(lease); task.state = "failed"; task.lease = null; task.stopReason = reason; this.save(task, "failed"); });
  }
  cancel(id: string, expectedFence?: number): void {
    this.transaction(() => {
      const task = this.task(id);
      if (expectedFence !== undefined && task.fence !== expectedFence) throw new Error("Cancellation requires the current ownership fence.");
      if (["completed", "cancelled", "failed", "interrupted"].includes(task.state)) return;
      task.state = "cancelled"; task.lease = null; task.stopReason = "cancelled"; this.save(task, "cancelled");
    });
  }
  recoverExpired(runId: string): string[] {
    return this.transaction(() => {
      const recovered: string[] = [];
      for (const task of this.list(runId)) {
        if (!["queued", "leased", "running", "sealed"].includes(task.state)) continue;
        const deadlineExpired = Date.parse(task.spec.deadlineAt) <= this.now();
        if (!deadlineExpired && (!task.lease || Date.parse(task.lease.expiresAt) > this.now())) continue;
        task.state = "interrupted"; task.lease = null; task.stopReason = deadlineExpired ? "deadline_expired" : "lease_expired";
        this.save(task, "interrupted"); recovered.push(task.spec.id);
      }
      return recovered;
    });
  }
  retryBeforeDispatch(id: string, expectedFence: number): void {
    this.transaction(() => {
      const task = this.task(id);
      if (!["failed", "interrupted"].includes(task.state) || task.fence !== expectedFence || task.dispatchIntents.length > 0
        || task.attempt >= task.spec.maximumAttempts || Date.parse(task.spec.deadlineAt) <= this.now()) throw new Error("Retry requires an unfinished pre-dispatch task, matching fence, remaining attempts, and time.");
      task.state = "queued"; task.stopReason = null; this.save(task, "retry_authorized_before_dispatch");
    });
  }
  events(id: string): { kind: string; at: string }[] {
    return this.db.prepare("SELECT kind, at FROM task_events WHERE task_id=? ORDER BY id").all(id).map(row => ({ kind: String(row.kind), at: String(row.at) }));
  }
  close(): void { this.db.close(); }
}
