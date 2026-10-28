import {lstatSync, realpathSync} from "node:fs";
import {resolve} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {isDeepStrictEqual} from "node:util";
import {ContextDataError, fields, uuid, digest, timestamp, json, freeze} from "./context-data.ts";

const question = "supplied-brief-context-analysis", maximumDatabaseBytes = 32 * 1024 * 1024;
const nativeAborted = Object.getOwnPropertyDescriptor(AbortSignal.prototype, "aborted")!.get!;
const files = [["manifest", "manifest.json", 24000], ["generation", "generation.json", 500000], ["candidate", "candidate.json", 64000], ["report", "report.json", 128000]] as const;
type PathState = "missing" | "unsafe" | "oversized" | "private_file_observed" | "private_directory_observed";
function options(value: unknown) {
  const r = fields(value, Object.keys(value as object));
  if (Object.keys(r).some(k => !["maximumReadMs", "signal"].includes(k))) throw new ContextDataError();
  const ms = r.maximumReadMs === undefined ? 2000 : r.maximumReadMs;
  if (!Number.isSafeInteger(ms) || (ms as number) < 1 || (ms as number) > 5000) throw new ContextDataError();
  if (r.signal !== undefined) {
    if (!(r.signal instanceof AbortSignal)) throw new ContextDataError();
    nativeAborted.call(r.signal);
  }
  return {ms: ms as number, signal: r.signal as AbortSignal | undefined};
}
function observe(path: string, directory: boolean, maximum = 0) {
  const i = lstatSync(path, {bigint: true, throwIfNoEntry: false});
  if (!i) return {state: "missing" as PathState, identity: null};
  const identity = [i.dev, i.ino, i.mode, i.nlink, i.size, i.mtimeNs, i.ctimeNs];
  if (i.isSymbolicLink() || i.mode & 0o077n || (directory ? !i.isDirectory() : !i.isFile() || i.nlink !== 1n)) return {state: "unsafe" as PathState, identity};
  if (directory) {
    if (realpathSync(path) !== path) return {state: "unsafe" as PathState, identity};
    // Directory content changes are checked through selected children; pin directory identity/privacy.
    return {state: "private_directory_observed" as PathState, identity: [i.dev, i.ino, i.mode]};
  }
  return {state: (i.size > BigInt(maximum) ? "oversized" : "private_file_observed") as PathState, identity};
}
function databaseWitness(state: string) {
  const directory = observe(state, true);
  if (directory.state !== "private_directory_observed") throw new ContextDataError();
  const main = resolve(state, "tasks.sqlite"), observed = observe(main, false, maximumDatabaseBytes);
  if (observed.state !== "private_file_observed") throw new ContextDataError();
  const wal = observe(main + "-wal", false, maximumDatabaseBytes), shm = observe(main + "-shm", false, 1024 * 1024);
  for (const item of [wal, shm]) if (!["missing", "private_file_observed"].includes(item.state)) throw new ContextDataError();
  // A new private empty WAL is SQLite coordination, not changed persisted content.
  return {directory, main: observed, wal: wal.identity?.[4] === 0n ? null : wal.identity};
}
function taskMetadata(row: Record<string, unknown>, taskId: string) {
  if (row.id !== taskId || row.question_key !== question || !(row.run_id instanceof Uint8Array) || !(row.document instanceof Uint8Array)) throw new ContextDataError();
  const runId = uuid(new TextDecoder("utf-8", {fatal: true}).decode(row.run_id));
  const r = fields(json(Buffer.from(row.document)), ["spec", "state", "attempt", "fence", "lease", "dispatchIntents", "output", "stopReason", "createdAt", "updatedAt"]);
  const s = fields(r.spec, ["id", "runId", "kind", "questionKey", "manifestHash", "maximumAttempts", "deadlineAt"]);
  if (s.id !== taskId || s.runId !== runId || s.kind !== "analyst" || s.questionKey !== question || s.maximumAttempts !== 1 || !["queued", "leased", "running", "sealed", "completed", "failed", "cancelled", "interrupted"].includes(r.state as string)) throw new ContextDataError();
  digest(s.manifestHash);
  const deadlineAt = timestamp(s.deadlineAt), createdAt = timestamp(r.createdAt), updatedAt = timestamp(r.updatedAt);
  if (Date.parse(updatedAt) < Date.parse(createdAt) || Date.parse(deadlineAt) <= Date.parse(createdAt)) throw new ContextDataError();
  return {id: taskId, runId, recordedState: r.state as string, recordedDeadlineAt: deadlineAt, status: "recorded_metadata_unverified"};
}
function publicationWitness(state: string, runId: string) {
  const parent = resolve(state, "context-analyst-runs"), runs = observe(parent, true);
  if (runs.state !== "private_directory_observed") return {runs, run: null, files: null};
  const root = resolve(parent, runId), run = observe(root, true);
  if (run.state !== "private_directory_observed") return {runs, run, files: null};
  return {runs, run, files: files.map(([name, filename, max]) => ({name, ...observe(resolve(root, filename), false, max)}))};
}

/** Bounded existing metadata only. No source/body read, acceptance, recovery, key or provider. */
export function diagnoseContextAnalystRun(suppliedState: string, suppliedTaskId: string, suppliedOptions: unknown = {}) {
  try {
    const taskId = uuid(suppliedTaskId), o = options(suppliedOptions);
    if (typeof suppliedState !== "string" || suppliedState.length > 4096 || suppliedState.includes("\0") || resolve(suppliedState) !== suppliedState) throw new ContextDataError();
    const started = Date.now(), cutoff = started + o.ms;
    if (!Number.isSafeInteger(started) || started < 0 || !Number.isSafeInteger(cutoff)) throw new ContextDataError();
    const guard = () => { const now = Date.now(); if (!Number.isSafeInteger(now) || now < started || now >= cutoff || o.signal && nativeAborted.call(o.signal)) throw new ContextDataError(); };
    guard(); const pinned = databaseWitness(suppliedState);
    let task: ReturnType<typeof taskMetadata>;
    const db = new DatabaseSync(resolve(suppliedState, "tasks.sqlite"), {readOnly: true, allowExtension: false, defensive: true, timeout: 1});
    try {
      guard(); if (!isDeepStrictEqual(databaseWitness(suppliedState), pinned)) throw new ContextDataError();
      db.exec("BEGIN");
      if (db.prepare("PRAGMA journal_mode").get()?.journal_mode !== "wal" || db.prepare("SELECT type FROM sqlite_master WHERE name='tasks'").get()?.type !== "table") throw new ContextDataError();
      if (!isDeepStrictEqual(db.prepare("PRAGMA table_info(tasks)").all().map(c => [c.name, c.type, c.pk, c.notnull]), [["id", "TEXT", 1, 0], ["run_id", "TEXT", 0, 1], ["question_key", "TEXT", 0, 1], ["document", "TEXT", 0, 1]])) throw new ContextDataError();
      const row = db.prepare("SELECT id,question_key,CASE WHEN length(CAST(run_id AS BLOB))=36 THEN CAST(run_id AS BLOB) ELSE NULL END AS run_id,CASE WHEN length(CAST(document AS BLOB)) BETWEEN 1 AND 65536 THEN CAST(document AS BLOB) ELSE NULL END AS document FROM tasks WHERE id=? AND question_key=?").get(taskId, question);
      if (!row) throw new ContextDataError(); task = taskMetadata(row, taskId); guard(); db.exec("COMMIT");
    } finally { db.close(); }
    guard(); if (!isDeepStrictEqual(databaseWitness(suppliedState), pinned)) throw new ContextDataError();
    const publication = publicationWitness(suppliedState, task.runId), report = publication.files?.find(f => f.name === "report")?.state;
    const inspectedAt = new Date(Date.now()).toISOString(), window = Date.parse(inspectedAt) < Date.parse(task.recordedDeadlineAt) ? "before_recorded_deadline" : "at_or_after_recorded_deadline";
    const unsafe = publication.files?.some(f => !["missing", "private_file_observed"].includes(f.state));
    const code = !publication.files || unsafe ? "publication_paths_unavailable" : report === "private_file_observed" ? "report_file_present_unverified" : window === "before_recorded_deadline" ? "report_missing_before_recorded_deadline" : "report_missing_at_or_after_recorded_deadline";
    const output = freeze({schemaVersion: "2.0", kind: "context_analyst_run_diagnostic", policyVersion: "context-run-diagnostic-v1", task,
      inspectedAt, publicationWindow: window, runDirectory: publication.run?.state ?? publication.runs.state,
      files: publication.files?.map(({name, state}) => ({name, state})) ?? [], guidance: {code, nextCommand: report === "private_file_observed" && !unsafe ? `redteam context runs show ${taskId}` : null, automaticRetry: "not_authorized", recovery: "not_performed"},
      bounds: {mainBytes: maximumDatabaseBytes, walBytes: maximumDatabaseBytes, shmBytes: 1024 * 1024, taskDocumentBytes: 65536, taskRows: 1, publicationPaths: 4, maximumReadMs: o.ms},
      boundaries: {coverage: "one_recorded_task_and_fixed_path_metadata", sourceRights: "not_checked", sourceBodies: "not_read", publicationJSON: "not_read", reportValidity: "not_checked", taskHistory: "not_checked", processOwnership: "not_checked", billing: "not_opened", executionAuthority: "not_granted", publicationReceipt: "not_recreated", semanticReview: "not_performed", sqliteCoordination: "read_only_connection_not_no_filesystem_activity", clock: "trusted_local_not_atomic"}});
    guard(); if (!isDeepStrictEqual(publicationWitness(suppliedState, task.runId), publication) || !isDeepStrictEqual(databaseWitness(suppliedState), pinned)) throw new ContextDataError();
    guard(); return output;
  } catch { throw new ContextDataError(); }
}
