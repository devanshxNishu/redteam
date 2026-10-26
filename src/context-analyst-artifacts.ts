import { resolve } from "node:path";
import { lstat, realpath } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";
import { checkedParents } from "./local-files.ts";
import { sha256 } from "./evidence.ts";
import { ContextDataError, recordDirectory, privateDirectory, privateBytes, publish, freeze, fields, uuid, digest, timestamp, json } from "./context-data.ts";
import { checkContextAnalystPreparationAccess, checkContextAnalystManifestBytes } from "./context-analyst-config.ts";
import type { ContextAnalystPreparation } from "./context-analyst-config.ts";
import type { WorkspaceStore } from "./workspace.ts";

const publications = new WeakMap<object, { store: WorkspaceStore }>();

/** Requires the original current in-process preparation; copies cannot authorize new file publication. */
export async function saveContextAnalystManifest(store: WorkspaceStore, preparation: ContextAnalystPreparation) {
  try {
    checkContextAnalystPreparationAccess(store, preparation);
    const manifestBytes = Buffer.from(JSON.stringify(preparation.manifest)), generationBytes = Buffer.from(JSON.stringify(preparation.generation));
    if (manifestBytes.length > 24000 || generationBytes.length > 500000 || sha256(manifestBytes) !== preparation.manifestSha256 || sha256(generationBytes) !== preparation.manifest.generationSha256) throw new ContextDataError();
    const checked = await checkContextAnalystManifestBytes(store, manifestBytes, generationBytes); checkContextAnalystPreparationAccess(store, preparation); checked.checkCurrent();
    const { state, directory } = await recordDirectory(store.directory, "context-analyst-runs", preparation.manifest.runId, true);
    for (const [name, value, maximum] of [["manifest.json", manifestBytes, 24000], ["generation.json", generationBytes, 500000]] as const) { checkContextAnalystPreparationAccess(store, preparation); checked.checkCurrent(); await publish(state, directory, name, value, maximum); }
    const verified = await verifyFiles(store, preparation); checked.checkCurrent(); publications.set(preparation, { store }); return freeze({ runId: verified.runId, taskId: verified.taskId, directory, manifestSha256: verified.manifestSha256, generationSha256: verified.generationSha256, executionAuthority: "not_granted" as const });
  } catch { throw new ContextDataError(); }
}
/** Pre-ownership verification only. This cannot read/adopt a run from an untrusted UUID or serialized flag. */
export async function verifySavedContextAnalystManifest(store: WorkspaceStore, preparation: ContextAnalystPreparation) {
  try { if (publications.get(preparation)?.store !== store) throw new ContextDataError(); return await verifyFiles(store, preparation); } catch { throw new ContextDataError(); }
}
async function verifyFiles(store: WorkspaceStore, preparation: ContextAnalystPreparation) {
  try {
    checkContextAnalystPreparationAccess(store, preparation); const { state, directory } = await recordDirectory(store.directory, "context-analyst-runs", preparation.manifest.runId);
    const manifestBytes = await privateBytes(state, resolve(directory, "manifest.json"), 24000), generationBytes = await privateBytes(state, resolve(directory, "generation.json"), 500000);
    if (sha256(manifestBytes) !== preparation.manifestSha256 || sha256(generationBytes) !== preparation.manifest.generationSha256 || !manifestBytes.equals(Buffer.from(JSON.stringify(preparation.manifest))) || !generationBytes.equals(Buffer.from(JSON.stringify(preparation.generation)))) throw new ContextDataError();
    const checked = await checkContextAnalystManifestBytes(store, manifestBytes, generationBytes);
    if (!(await privateBytes(state, resolve(directory, "manifest.json"), 24000)).equals(manifestBytes) || !(await privateBytes(state, resolve(directory, "generation.json"), 500000)).equals(generationBytes)) throw new ContextDataError(); checked.checkCurrent(); checkContextAnalystPreparationAccess(store, preparation);
    return freeze({ schemaVersion: "2.0", kind: "verified_context_analyst_manifest", runId: preparation.manifest.runId, taskId: preparation.manifest.taskId, directory, manifestSha256: preparation.manifestSha256, generationSha256: preparation.manifest.generationSha256, manifest: checked.preparation.manifest, generation: checked.preparation.generation, executionAuthority: "not_granted", ownership: "not_acquired" });
  } catch { throw new ContextDataError(); }
}


/** Historical task-backed data only. No task store constructor, schema repair, ownership or execution capability. */
export async function readContextAnalystManifest(store: WorkspaceStore, taskId: string) {
  let database: DatabaseSync | undefined;
  try {
    uuid(taskId); await privateDirectory(store.directory); const state = await realpath(store.directory), file = resolve(state, "tasks.sqlite");
    const privateFile = async (path: string, optional = false) => {
      await checkedParents(state, path); let info;
      try { info = await lstat(path, { bigint: true }); } catch (error) { if (optional && (error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
      if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1n || (info.mode & 0o077n)) throw new ContextDataError(); return info;
    };
    const pinned = await privateFile(file); if (!pinned) throw new ContextDataError();
    const checkDatabase = async () => { await privateDirectory(state); const current = await privateFile(file); if (!current || current.dev !== pinned.dev || current.ino !== pinned.ino) throw new ContextDataError(); await privateFile(file + "-wal", true); await privateFile(file + "-shm", true); };
    await checkDatabase(); database = new DatabaseSync(file, { readOnly: true, allowExtension: false, defensive: true, timeout: 1000 }); await checkDatabase();
    if (database.prepare("SELECT type FROM sqlite_master WHERE name='tasks'").get()?.type !== "table") throw new ContextDataError();
    const columns = database.prepare("PRAGMA table_info(tasks)").all(); if (!isDeepStrictEqual(columns.map(column => [column.name, column.type, column.pk, column.notnull]), [["id", "TEXT", 1, 0], ["run_id", "TEXT", 0, 1], ["question_key", "TEXT", 0, 1], ["document", "TEXT", 0, 1]])) throw new ContextDataError();
    const query = database.prepare("SELECT id, run_id, question_key, CASE WHEN length(CAST(document AS BLOB)) BETWEEN 1 AND 1000000 THEN CAST(document AS BLOB) ELSE NULL END AS document FROM tasks WHERE id=?");
    const readSpec = () => {
      const row = query.get(taskId); if (!row || !(row.document instanceof Uint8Array) || row.document.byteLength > 1000000) throw new ContextDataError();
      const record = fields(json(Buffer.from(row.document)), ["spec", "state", "attempt", "fence", "lease", "dispatchIntents", "output", "stopReason", "createdAt", "updatedAt"]), raw = fields(record.spec, ["id", "runId", "kind", "questionKey", "manifestHash", "maximumAttempts", "deadlineAt"]);
      if (raw.id !== taskId || row.id !== raw.id || row.run_id !== raw.runId || row.question_key !== raw.questionKey || raw.kind !== "analyst" || raw.questionKey !== "supplied-brief-context-analysis" || raw.maximumAttempts !== 1) throw new ContextDataError();
      return { id: uuid(raw.id), runId: uuid(raw.runId), kind: "analyst" as const, questionKey: "supplied-brief-context-analysis", manifestHash: digest(raw.manifestHash), maximumAttempts: 1, deadlineAt: timestamp(raw.deadlineAt), createdAt: timestamp(record.createdAt) };
    };
    const spec = readSpec(), { directory } = await recordDirectory(state, "context-analyst-runs", spec.runId), manifestBytes = await privateBytes(state, resolve(directory, "manifest.json"), 24000), generationBytes = await privateBytes(state, resolve(directory, "generation.json"), 500000);
    if (sha256(manifestBytes) !== spec.manifestHash) throw new ContextDataError();
    const checked = await checkContextAnalystManifestBytes(store, manifestBytes, generationBytes), m = checked.preparation.manifest;
    if (!isDeepStrictEqual(spec, { id: m.taskId, runId: m.runId, kind: "analyst", questionKey: m.questionKey, manifestHash: checked.preparation.manifestSha256, maximumAttempts: m.maximumAttempts, deadlineAt: m.coordinatorDeadlineAt, createdAt: spec.createdAt }) || Date.parse(spec.createdAt) < Date.parse(m.preparedAt) || Date.parse(spec.createdAt) >= Date.parse(m.inferenceDeadlineAt)) throw new ContextDataError();
    await checkDatabase(); if (!isDeepStrictEqual(readSpec(), spec)) throw new ContextDataError();
    if (!(await privateBytes(state, resolve(directory, "manifest.json"), 24000)).equals(manifestBytes) || !(await privateBytes(state, resolve(directory, "generation.json"), 500000)).equals(generationBytes)) throw new ContextDataError();
    await checkDatabase(); checked.checkCurrent(); if (!isDeepStrictEqual(readSpec(), spec)) throw new ContextDataError();
    return freeze({ schemaVersion: "2.0", kind: "saved_context_analyst_manifest", runId: m.runId, taskId: m.taskId, directory, manifestSha256: spec.manifestHash, generationSha256: m.generationSha256, manifest: m, generation: checked.preparation.generation, executionAuthority: "not_granted", ownership: "not_acquired", taskStateChanged: false });
  } catch { throw new ContextDataError(); } finally { try { database?.close(); } catch { throw new ContextDataError(); } }
}
