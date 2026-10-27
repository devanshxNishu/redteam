import { lstatSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";
import { AnalystTask } from "./analyst-task.ts";
import type { AnalystTaskFailure } from "./analyst-task.ts";
import type { SealedTaskOutput } from "./tasks.ts";
import { ContextDataError, text } from "./context-data.ts";
import { checkContextAnalystPreparationAccess, checkContextAnalystFinalizationAccess } from "./context-analyst-config.ts";
import type { ContextAnalystPreparation } from "./context-analyst-config.ts";
import { verifySavedContextAnalystManifest, verifyContextAnalystFinalizationFiles, readContextAnalystManifest } from "./context-analyst-artifacts.ts";
import type { WorkspaceStore } from "./workspace.ts";

const construction = Symbol("checked context ownership");
const attempted = new WeakSet<object>();
const bindings = new WeakMap<object, { store: WorkspaceStore; preparation: ContextAnalystPreparation; candidateGuard: () => { attempt: number; fence: number } }>();

/** Actual current handle identity only; JSON, prototype copies and cross-Store/preparation handles are not authority. */
export function checkContextAnalystTaskBinding(store: WorkspaceStore, preparation: ContextAnalystPreparation, task: ContextAnalystTask): undefined {
  const binding = bindings.get(task);
  if (!binding || binding.store !== store || binding.preparation !== preparation) throw new ContextDataError();
  return task.assertInference();
}

/** Original running owner during reserved finalization; never authorizes another send. */
export function checkContextAnalystCandidateTaskBinding(store: WorkspaceStore, preparation: ContextAnalystPreparation, task: ContextAnalystTask) {
  const binding = bindings.get(task);
  if (!binding || binding.store !== store || binding.preparation !== preparation) throw new ContextDataError();
  return binding.candidateGuard();
}

function coordinatorAuthority(guard: () => unknown): void {
  if (typeof guard !== "function") throw new ContextDataError();
  const result = guard(); if (result !== undefined) { if (result instanceof Promise) void result.catch(() => {}); throw new ContextDataError(); }
}

/** Check before TaskStore can normalize permissions or create tables. Sidecars can change during normal SQLite use. */
function databaseFiles(store: WorkspaceStore, allowMissing: boolean) {
  const state = store.directory, path = resolve(state, "tasks.sqlite");
  const file = (name: string) => {
    const info = lstatSync(name, { bigint: true, throwIfNoEntry: false });
    if (info && (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1n || (info.mode & 0o077n))) throw new ContextDataError();
    return info;
  };
  const root = () => { const info = lstatSync(state); if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) || realpathSync(state) !== state) throw new ContextDataError(); };
  root(); const pinned = file(path);
  if (!pinned && !allowMissing) throw new ContextDataError();
  const check = () => {
    root(); const current = file(path), wal = file(path + "-wal"), shm = file(path + "-shm");
    if (pinned ? !current || current.dev !== pinned.dev || current.ino !== pinned.ino : current || wal || shm) throw new ContextDataError();
    return undefined;
  };
  check(); return { path, exists: !!pinned, check };
}
function preflight(store: WorkspaceStore, preparation: ContextAnalystPreparation) {
  const files = databaseFiles(store, true);
  if (files.exists) {
    const db = new DatabaseSync(files.path, { readOnly: true, allowExtension: false, defensive: true, timeout: 1000 });
    try {
      for (const [table, expected] of [
        ["tasks", [["id", "TEXT", 1, 0], ["run_id", "TEXT", 0, 1], ["question_key", "TEXT", 0, 1], ["document", "TEXT", 0, 1]]],
        ["task_events", [["id", "INTEGER", 1, 0], ["task_id", "TEXT", 0, 1], ["kind", "TEXT", 0, 1], ["at", "TEXT", 0, 1]]]
      ] as const) {
        if (db.prepare("SELECT type FROM sqlite_master WHERE name=?").get(table)?.type !== "table" || !isDeepStrictEqual(db.prepare(`PRAGMA table_info(${table})`).all().map(c => [c.name, c.type, c.pk, c.notnull]), expected)) throw new ContextDataError();
      }
      if (db.prepare("PRAGMA journal_mode").get()?.journal_mode !== "wal" || db.prepare("SELECT id FROM tasks WHERE id=? OR run_id=? LIMIT 1").get(preparation.manifest.taskId, preparation.manifest.runId)) throw new ContextDataError();
    } finally { db.close(); }
  }
  files.check(); return files.check;
}

/** Coordinator-only handle. Models must never receive this handle, stores, callbacks or task authority. */
export class ContextAnalystTask {
  readonly signal: AbortSignal;
  readonly inferenceSignal: AbortSignal;
  private readonly task: AnalystTask;
  private readonly store: WorkspaceStore;
  private readonly preparation: ContextAnalystPreparation;
  private readonly inference = new AbortController();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;

  private constructor(key: symbol, store: WorkspaceStore, preparation: ContextAnalystPreparation, owner: string, coordinatorGuard: () => unknown) {
    if (key !== construction) throw new ContextDataError();
    this.store = store; this.preparation = preparation;
    let databaseGuard = () => undefined, initializing = true;
    const guard = () => { coordinatorAuthority(coordinatorGuard); databaseGuard(); if (initializing) checkContextAnalystPreparationAccess(store, preparation); else checkContextAnalystFinalizationAccess(store, preparation); return undefined; };
    const m = preparation.manifest;
    this.task = new AnalystTask(dirname(store.directory), { taskId: m.taskId, runId: m.runId, questionKey: m.questionKey, manifestHash: preparation.manifestSha256, deadlineAt: m.coordinatorDeadlineAt, owner }, guard, m.configuration.taskPolicy);
    try {
      databaseGuard = databaseFiles(store, false).check; guard(); initializing = false;
      this.signal = this.task.signal; this.inferenceSignal = AbortSignal.any([this.signal, this.inference.signal]);
      this.timer = setTimeout(() => this.inference.abort(), Math.max(1, Date.parse(m.inferenceDeadlineAt) - Date.now())); this.timer.unref();
      bindings.set(this, { store, preparation, candidateGuard: () => {
        if (this.closed) throw new ContextDataError(); checkContextAnalystFinalizationAccess(store, preparation); this.task.assertActive();
        const record = this.task.snapshot().record;
        if (record.state !== "running" || record.attempt !== 1 || record.output !== null || !isDeepStrictEqual(record.spec, { id: m.taskId, runId: m.runId, kind: "analyst", questionKey: m.questionKey, manifestHash: preparation.manifestSha256, maximumAttempts: 1, deadlineAt: m.coordinatorDeadlineAt })) throw new ContextDataError();
        return Object.freeze({ attempt: record.attempt, fence: record.fence });
      } });
    } catch { this.task.close(); throw new ContextDataError(); }
  }
  static async create(store: WorkspaceStore, preparation: ContextAnalystPreparation, suppliedOwner: string, coordinatorGuard: () => unknown = () => undefined) {
    try {
      coordinatorAuthority(coordinatorGuard); checkContextAnalystPreparationAccess(store, preparation); if (attempted.has(preparation)) throw new ContextDataError(); const owner = text(suppliedOwner, 200), checkDatabase = preflight(store, preparation);
      await verifySavedContextAnalystManifest(store, preparation); coordinatorAuthority(coordinatorGuard); checkDatabase(); preflight(store, preparation)(); checkContextAnalystPreparationAccess(store, preparation);
      if (attempted.has(preparation)) throw new ContextDataError(); attempted.add(preparation);
      return new ContextAnalystTask(construction, store, preparation, owner, coordinatorGuard);
    } catch { throw new ContextDataError(); }
  }
  assertWorkspace(workspace: string): void { this.task.assertWorkspace(workspace); }
  assertInference(): undefined {
    try { if (this.closed || this.inferenceSignal.aborted) throw new ContextDataError(); checkContextAnalystPreparationAccess(this.store, this.preparation); this.task.assertActive(); return undefined; }
    catch { this.inference.abort(); throw new ContextDataError(); }
  }
  private async files(phase: "inference" | "finalization") {
    if (this.closed) throw new ContextDataError();
    if (phase === "inference") this.assertInference(); else checkContextAnalystFinalizationAccess(this.store, this.preparation);
    await (phase === "inference" ? verifySavedContextAnalystManifest(this.store, this.preparation) : verifyContextAnalystFinalizationFiles(this.store, this.preparation));
    const saved = await readContextAnalystManifest(this.store, this.preparation.manifest.taskId);
    if (saved.manifestSha256 !== this.preparation.manifestSha256) throw new ContextDataError();
  }
  async checkInferenceFiles(): Promise<void> {
    try { await this.files("inference"); this.assertInference(); }
    catch { this.inference.abort(); throw new ContextDataError(); }
  }
  async beforeDispatch(invocationRef: string, phaseGuard: () => unknown = () => undefined): Promise<void> {
    try {
      if (typeof phaseGuard !== "function") throw new ContextDataError();
      await this.files("inference"); this.assertInference(); const result = phaseGuard();
      if (result !== undefined) { if (result instanceof Promise) void result.catch(() => {}); throw new ContextDataError(); }
      this.task.beforeDispatch(invocationRef);
    }
    catch { this.inference.abort(); throw new ContextDataError(); }
  }
  async seal(output: SealedTaskOutput): Promise<void> {
    try { await this.files("finalization"); this.task.seal(output); }
    catch { this.inference.abort(); throw new ContextDataError(); }
  }
  async complete(expectedHash: string): Promise<void> {
    try { await this.files("finalization"); this.task.complete(expectedHash); this.stopInference(); }
    catch { this.inference.abort(); throw new ContextDataError(); }
  }
  private stopInference(): void { if (this.timer) { clearTimeout(this.timer); this.timer = undefined; } this.inference.abort(); }
  stop(reason: AnalystTaskFailure | "cancelled"): void { this.task.stop(reason); this.stopInference(); }
  snapshot() { return this.task.snapshot(); }
  close(): void { if (this.closed) return; this.closed = true; this.stopInference(); this.task.close(); }
}
