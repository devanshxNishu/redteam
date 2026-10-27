import { lstat, realpath } from "node:fs/promises";
import { lstatSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";
import { checkedParents } from "./local-files.ts";
import { sha256 } from "./evidence.ts";
import { ContextDataError, fields, json, digest, timestamp, uuid, integer, freeze, recordDirectory, privateDirectory, privateBytes } from "./context-data.ts";
import { readContextAnalystManifest } from "./context-analyst-artifacts.ts";
import { readContextAnalyticalPacket, validateContextAnalyticalResponse, checkContextAnalyticalPacketAccess } from "./context-analysis.ts";
import type { ContextAnalyticalPacket } from "./context-analysis.ts";
import type { ContextAnalystPreparation } from "./context-analyst-config.ts";
import type { ContextAnalystCandidate } from "./context-analyst-candidate.ts";
import { readContextProcessingAuthorization, checkContextProcessingAuthorizationAccess } from "./context-processing.ts";
import type { WorkspaceStore } from "./workspace.ts";

function equal(a: unknown, b: unknown) { if (!isDeepStrictEqual(a, b)) throw new ContextDataError(); }
function providerText(value: unknown): string | null { if (value === null) return null; if (typeof value !== "string" || !value.length || value.length > 200 || /[^\x21-\x7e]/u.test(value)) throw new ContextDataError(); return value; }
function metadata(p: { manifest: ContextAnalystPreparation["manifest"]; manifestSha256: string; generation: ContextAnalystPreparation["generation"] }) {
  const m = p.manifest, c = m.configuration, g = p.generation, common = { model: c.model, instructions: g.instructions, input: g.input, text: g.text, tools: [], tool_choice: "none", truncation: "disabled" };
  return { policyVersion: "brief-context-analyst-openai-v1", provider: "openai", model: c.model, manifestSha256: p.manifestSha256, packetSha256: m.packetSha256, configurationSha256: m.configurationSha256,
    context: { snapshotId: m.context.snapshotId, snapshotRecordSha256: m.context.snapshotRecordSha256, asOf: m.context.asOf, timeBasis: m.context.timeBasis }, processingRecordSha256: m.processing.recordSha256,
    countRequestSha256: sha256(JSON.stringify(common)), generationRequestSha256: sha256(JSON.stringify({ ...common, max_output_tokens: c.limits.maximumOutputTokens, store: false, stream: false, background: false })),
    limits: { requestBytes: 520000, countResponseBytes: 16384, generationResponseBytes: 1000000, analyticalResponseBytes: 32768, bodyReads: 8192 }, liveVerification: "not_performed", costBasis: "configured_rate_estimate", countBilling: "not_inferred" };
}
function result(value: unknown, p: Awaited<ReturnType<typeof readContextAnalystManifest>>, packet: ContextAnalyticalPacket) {
  const r = fields(value, ["schemaVersion", "kind", "status", "reason", "check", "provider", "phase", "countedInputTokens", "countResponseSha256", "generationLiability", "requestsStarted", "metadata"]);
  if (r.schemaVersion !== "2.0" || r.kind !== "context_analyst_transport_result" || r.phase !== "generation" || !["checked_unreviewed", "rejected"].includes(r.status as string) || !["settled", "uncertain"].includes(r.generationLiability as string)) throw new ContextDataError();
  equal(r.metadata, metadata(p)); equal(r.requestsStarted, { count: true, generation: true });
  const countedInputTokens = integer(r.countedInputTokens, p.manifest.configuration.limits.maximumInputTokens), countResponseSha256 = digest(r.countResponseSha256), rawProvider = fields(r.provider, ["responseId", "model", "status", "responseSha256"]), provider = { responseId: providerText(rawProvider.responseId), model: providerText(rawProvider.model), status: rawProvider.status, responseSha256: digest(rawProvider.responseSha256) };
  if (provider.status !== null && !["completed", "incomplete", "failed", "cancelled", "queued", "in_progress"].includes(provider.status as string)) throw new ContextDataError();
  const selected = provider.responseId !== null && provider.model === p.manifest.configuration.model;
  let check: ContextAnalystCandidate["result"]["check"] = null;
  if (r.status === "checked_unreviewed") {
    if (r.reason !== null || !selected || provider.status !== "completed" || r.generationLiability !== "settled") throw new ContextDataError();
    const rawCheck = fields(r.check, ["response", "checks", "tracksNotCovered"]), validated = validateContextAnalyticalResponse(rawCheck.response, packet);
    check = { response: validated.response, checks: validated.checks, tracksNotCovered: validated.tracksNotCovered }; equal(r.check, check);
    if (Buffer.byteLength(JSON.stringify(check.response)) > 32768) throw new ContextDataError();
  } else {
    if (r.check !== null || !["refused", "incomplete", "provider_failed", "provider_model_mismatch", "usage_unavailable", "preflight_mismatch", "invalid_output"].includes(r.reason as string)) throw new ContextDataError();
    if (r.reason !== "invalid_output" && (!provider.responseId || !provider.model)) throw new ContextDataError();
    if (r.reason === "provider_model_mismatch" ? provider.model === p.manifest.configuration.model || r.generationLiability !== "uncertain" : r.reason !== "invalid_output" && !selected) throw new ContextDataError();
    if (r.reason === "incomplete" && provider.status !== "incomplete" || ["refused", "usage_unavailable", "preflight_mismatch"].includes(r.reason as string) && provider.status !== "completed" || r.reason === "usage_unavailable" && r.generationLiability !== "uncertain" || r.reason === "preflight_mismatch" && r.generationLiability !== "settled") throw new ContextDataError();
  }
  return { schemaVersion: "2.0", kind: "context_analyst_transport_result", status: r.status, reason: r.reason, check, provider, phase: "generation", countedInputTokens, countResponseSha256, generationLiability: r.generationLiability, requestsStarted: { count: true, generation: true }, metadata: metadata(p) };
}
function taskData(value: unknown, p: Awaited<ReturnType<typeof readContextAnalystManifest>>) {
  const r = fields(value, ["spec", "state", "attempt", "fence", "lease", "dispatchIntents", "output", "stopReason", "createdAt", "updatedAt"]), m = p.manifest;
  equal(r.spec, { id: m.taskId, runId: m.runId, kind: "analyst", questionKey: m.questionKey, manifestHash: p.manifestSha256, maximumAttempts: 1, deadlineAt: m.coordinatorDeadlineAt });
  if (!["sealed", "completed"].includes(r.state as string) || integer(r.attempt, 1) !== 1 || integer(r.fence, 1) !== 1 || r.lease !== null || r.stopReason !== null) throw new ContextDataError();
  equal(r.dispatchIntents, ["count", "generation"].map(phase => ({ invocationRef: `${m.runId}:context_${phase}`, attempt: 1 })));
  const output = fields(r.output, ["artifactRef", "sha256"]); if (output.artifactRef !== `${m.runId}:context_candidate`) throw new ContextDataError(); digest(output.sha256);
  const createdAt = timestamp(r.createdAt), updatedAt = timestamp(r.updatedAt);
  if (Date.parse(createdAt) < Date.parse(m.preparedAt) || Date.parse(createdAt) >= Date.parse(m.inferenceDeadlineAt) || Date.parse(updatedAt) < Date.parse(createdAt) || Date.parse(updatedAt) >= Date.parse(m.coordinatorDeadlineAt) || Date.parse(updatedAt) > Date.now()) throw new ContextDataError();
  return { raw: r, state: r.state as "sealed" | "completed", output: { artifactRef: output.artifactRef as string, sha256: output.sha256 as string }, createdAt, updatedAt };
}
function candidateData(bytes: Buffer, p: Awaited<ReturnType<typeof readContextAnalystManifest>>, packet: ContextAnalyticalPacket, task: ReturnType<typeof taskData>) {
  const decoded = json(bytes), r = fields(decoded, ["schemaVersion", "kind", "policyVersion", "runId", "taskId", "manifestSha256", "generationSha256", "packetSha256", "snapshotRecordSha256", "processingRecordSha256", "sourcePinsSha256", "observation", "result", "boundaries"]), m = p.manifest, checkedResult = result(r.result, p, packet), o = fields(r.observation, ["schemaVersion", "kind", "runtimeRoute", "provenance", "observedAt", "resultSha256", "taskId", "attempt", "fence"]), at = timestamp(o.observedAt);
  if (!["explicitly_injected_fetch", "default_runtime_fetch"].includes(o.runtimeRoute as string) || Date.parse(at) < Date.parse(task.createdAt) || Date.parse(at) >= Date.parse(m.inferenceDeadlineAt) || Date.parse(at) > Date.parse(task.updatedAt)) throw new ContextDataError();
  const expected = { schemaVersion: "2.0", kind: "context_analyst_candidate", policyVersion: "brief-context-analyst-candidate-v1", runId: m.runId, taskId: m.taskId, manifestSha256: p.manifestSha256, generationSha256: m.generationSha256, packetSha256: m.packetSha256,
    snapshotRecordSha256: m.context.snapshotRecordSha256, processingRecordSha256: m.processing.recordSha256, sourcePinsSha256: sha256(JSON.stringify(m.sourcePins)), observation: { schemaVersion: "2.0", kind: "context_analyst_transport_observation", runtimeRoute: o.runtimeRoute, provenance: "local_runtime_assertion_not_independent_provider_evidence", observedAt: at, resultSha256: sha256(JSON.stringify(checkedResult)), taskId: m.taskId, attempt: 1, fence: 1 }, result: checkedResult,
    boundaries: { semanticReview: "unreviewed", researchValidity: "not_established", stakeholderDecisions: "not_performed", appExecution: "not_performed", publication: "candidate_only_not_a_final_report", providerAuthentication: "not_independently_established", liveCompatibility: "not_checked", budget: "read_current_durable_ledger_separately" } };
  equal(decoded, expected); if (!bytes.equals(Buffer.from(JSON.stringify(expected))) || sha256(bytes) !== task.output.sha256) throw new ContextDataError();
  return expected as ContextAnalystCandidate;
}

/** Sealed data inspection only. It does not reconstruct observation/receipt authority or accept a final report. */
export async function readContextAnalystCandidate(store: WorkspaceStore, taskId: string) {
  let db: DatabaseSync | undefined;
  try {
    uuid(taskId); const saved = await readContextAnalystManifest(store, taskId), state = await realpath(store.directory), file = resolve(state, "tasks.sqlite");
    const privateFile = async (path: string, optional = false) => { await checkedParents(state, path); let info; try { info = await lstat(path, { bigint: true }); } catch (e) { if (optional && (e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e; } if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1n || (info.mode & 0o077n)) throw new ContextDataError(); return info; };
    const pinned = await privateFile(file); if (!pinned) throw new ContextDataError();
    const databaseFilesSync = () => {
      const root = lstatSync(state); if (!root.isDirectory() || root.isSymbolicLink() || root.mode & 0o077 || realpathSync(state) !== state) throw new ContextDataError();
      for (const path of [file, file + "-wal", file + "-shm"]) { const info = lstatSync(path, { bigint: true, throwIfNoEntry: false }); if (!info) { if (path === file) throw new ContextDataError(); continue; } if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1n || info.mode & 0o077n || path === file && (info.dev !== pinned.dev || info.ino !== pinned.ino)) throw new ContextDataError(); }
    };
    const databaseFiles = async () => { await privateDirectory(state); const current = await privateFile(file); if (!current || current.dev !== pinned.dev || current.ino !== pinned.ino) throw new ContextDataError(); await privateFile(file + "-wal", true); await privateFile(file + "-shm", true); };
    await databaseFiles(); db = new DatabaseSync(file, { readOnly: true, allowExtension: false, defensive: true, timeout: 1000 });
    const readTask = () => {
      if (!db || db.prepare("PRAGMA journal_mode").get()?.journal_mode !== "wal" || db.prepare("SELECT type FROM sqlite_master WHERE name='tasks'").get()?.type !== "table") throw new ContextDataError();
      equal(db.prepare("PRAGMA table_info(tasks)").all().map(c => [c.name, c.type, c.pk, c.notnull]), [["id", "TEXT", 1, 0], ["run_id", "TEXT", 0, 1], ["question_key", "TEXT", 0, 1], ["document", "TEXT", 0, 1]]);
      const row = db.prepare("SELECT id,run_id,question_key,CASE WHEN length(CAST(document AS BLOB)) BETWEEN 1 AND 1000000 THEN CAST(document AS BLOB) ELSE NULL END AS document FROM tasks WHERE id=?").get(taskId);
      if (!row || row.id !== taskId || row.run_id !== saved.runId || row.question_key !== saved.manifest.questionKey || !(row.document instanceof Uint8Array)) throw new ContextDataError(); return taskData(json(Buffer.from(row.document)), saved);
    };
    const processing = await readContextProcessingAuthorization(store, saved.manifest.processing.authorizationId);
    if (processing.recordSha256 !== saved.manifest.processing.recordSha256) throw new ContextDataError();
    const task = readTask(), { directory } = await recordDirectory(state, "context-analyst-runs", saved.runId), filePath = resolve(directory, "candidate.json"), bytes = await privateBytes(state, filePath, 64000), packet = await readContextAnalyticalPacket(store, saved.manifest.context.snapshotId);
    if (packet.packetSha256 !== saved.manifest.packetSha256) throw new ContextDataError(); const candidate = candidateData(bytes, saved, packet, task);
    const current = await readContextAnalystManifest(store, taskId); equal(current, saved); await databaseFiles(); equal(readTask(), task);
    if (!(await privateBytes(state, filePath, 64000)).equals(bytes)) throw new ContextDataError(); databaseFilesSync(); equal(readTask(), task);
    checkContextAnalyticalPacketAccess(packet); checkContextProcessingAuthorizationAccess(store, processing);
    return freeze({ schemaVersion: "2.0", kind: "checked_historical_context_candidate", runId: saved.runId, taskId, candidate, sha256: sha256(bytes), task: { state: task.state, attempt: 1, fence: 1, output: task.output },
      boundaries: { executionAuthority: "not_granted", ownership: "not_acquired", publicationReceipt: "not_recreated", runtimeObservation: "not_recreated", finalReport: "not_verified", semanticReview: "unreviewed", providerAuthentication: "not_independently_established", budget: "read_current_durable_ledger_separately" } });
  } catch { throw new ContextDataError(); } finally { try { db?.close(); } catch { throw new ContextDataError(); } }
}
