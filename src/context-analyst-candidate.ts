import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { sha256 } from "./evidence.ts";
import { ContextDataError, freeze, recordDirectory, privateBytes, publish } from "./context-data.ts";
import { checkContextAnalystFinalizationAccess } from "./context-analyst-config.ts";
import type { ContextAnalystPreparation } from "./context-analyst-config.ts";
import { readContextAnalystManifest } from "./context-analyst-artifacts.ts";
import { checkContextAnalystCandidateTaskBinding } from "./context-analyst-task.ts";
import type { ContextAnalystTask } from "./context-analyst-task.ts";
import { inspectContextAnalystTransportObservation } from "./context-analyst-transport.ts";
import type { ContextAnalystTransportResult } from "./context-analyst-transport.ts";
import { readContextAnalyticalPacket, validateContextAnalyticalResponse } from "./context-analysis.ts";
import type { WorkspaceStore } from "./workspace.ts";

const maximum = 64000, attempted = new WeakSet<object>();
function record(preparation: ContextAnalystPreparation, observation: Awaited<ReturnType<typeof inspectContextAnalystTransportObservation>>, result: ContextAnalystTransportResult) {
  const m = preparation.manifest;
  return freeze({ schemaVersion: "2.0", kind: "context_analyst_candidate", policyVersion: "brief-context-analyst-candidate-v1", runId: m.runId, taskId: m.taskId,
    manifestSha256: preparation.manifestSha256, generationSha256: m.generationSha256, packetSha256: m.packetSha256,
    snapshotRecordSha256: m.context.snapshotRecordSha256, processingRecordSha256: m.processing.recordSha256, sourcePinsSha256: sha256(JSON.stringify(m.sourcePins)),
    observation, result, boundaries: { semanticReview: "unreviewed", researchValidity: "not_established", stakeholderDecisions: "not_performed", appExecution: "not_performed", publication: "candidate_only_not_a_final_report", providerAuthentication: "not_independently_established", liveCompatibility: "not_checked", budget: "read_current_durable_ledger_separately" } });
}
export type ContextAnalystCandidate = ReturnType<typeof record>;
function receipt(preparation: ContextAnalystPreparation, candidate: ContextAnalystCandidate, bytes: Buffer) {
  return freeze({ schemaVersion: "2.0", kind: "context_analyst_candidate_receipt", runId: preparation.manifest.runId, taskId: preparation.manifest.taskId,
    artifactRef: `${preparation.manifest.runId}:context_candidate`, sha256: sha256(bytes), bytes: bytes.length, candidate,
    taskSealed: false, taskCompleted: false, finalReportPublished: false });
}
export type ContextAnalystCandidateReceipt = ReturnType<typeof receipt>;
const publications = new WeakMap<object, { store: WorkspaceStore; preparation: ContextAnalystPreparation; task: ContextAnalystTask; bytes: Buffer }>();
function guard(store: WorkspaceStore, preparation: ContextAnalystPreparation, task: ContextAnalystTask, observation?: ContextAnalystCandidate["observation"]) {
  checkContextAnalystFinalizationAccess(store, preparation);
  const identity = checkContextAnalystCandidateTaskBinding(store, preparation, task);
  if (observation && (observation.taskId !== preparation.manifest.taskId || observation.attempt !== identity.attempt || observation.fence !== identity.fence)) throw new ContextDataError();
  const intents = task.snapshot().record.dispatchIntents;
  if (!isDeepStrictEqual(intents, ["count", "generation"].map(phase => ({ invocationRef: `${preparation.manifest.runId}:context_${phase}`, attempt: identity.attempt })))) throw new ContextDataError();
}
async function files(store: WorkspaceStore, preparation: ContextAnalystPreparation, task: ContextAnalystTask) {
  checkContextAnalystCandidateTaskBinding(store, preparation, task);
  const saved = await readContextAnalystManifest(store, preparation.manifest.taskId);
  if (saved.manifestSha256 !== preparation.manifestSha256 || saved.generationSha256 !== preparation.manifest.generationSha256) throw new ContextDataError();
  checkContextAnalystCandidateTaskBinding(store, preparation, task);
}
/** The cutoff bounds the caller. Late local I/O can leave diagnostic bytes, never a late receipt or authority. */
async function bounded<T>(deadline: number, work: (current: () => void) => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined, stopped = false;
  const current = () => { if (stopped || Date.now() >= deadline) throw new ContextDataError(); };
  const expired = new Promise<never>((_, reject) => { timer = setTimeout(() => { stopped = true; reject(new ContextDataError()); }, Math.max(1, deadline - Date.now())); timer.unref(); });
  try { current(); return await Promise.race([work(current), expired]); } finally { stopped = true; clearTimeout(timer); }
}

/** One publication attempt under the original running owner. A copied result cannot establish observation. */
export async function saveContextAnalystCandidate(store: WorkspaceStore, preparation: ContextAnalystPreparation, task: ContextAnalystTask, suppliedResult: unknown): Promise<ContextAnalystCandidateReceipt> {
  try {
    checkContextAnalystCandidateTaskBinding(store, preparation, task);
    return await bounded(Date.parse(preparation.manifest.coordinatorDeadlineAt), async current => {
      if (attempted.has(task)) throw new ContextDataError();
      const observation = await inspectContextAnalystTransportObservation(store, preparation, suppliedResult), result = suppliedResult as ContextAnalystTransportResult;
      guard(store, preparation, task, observation);
      const packet = await readContextAnalyticalPacket(store, preparation.manifest.context.snapshotId);
      if (packet.packetSha256 !== preparation.manifest.packetSha256 || !["checked_unreviewed", "rejected"].includes(result.status)) throw new ContextDataError();
      if (result.status === "checked_unreviewed") {
        if (!result.check) throw new ContextDataError(); const validated = validateContextAnalyticalResponse(result.check.response, packet);
        if (!isDeepStrictEqual(result.check, { response: validated.response, checks: validated.checks, tracksNotCovered: validated.tracksNotCovered })) throw new ContextDataError();
      } else if (result.check !== null) throw new ContextDataError();
      const candidate = record(preparation, observation, result), bytes = Buffer.from(JSON.stringify(candidate));
      if (bytes.length > maximum) throw new ContextDataError();
      const { state, directory } = await recordDirectory(store.directory, "context-analyst-runs", preparation.manifest.runId);
      await files(store, preparation, task); guard(store, preparation, task, observation);
      current(); if (attempted.has(task)) throw new ContextDataError(); attempted.add(task);
      await publish(state, directory, "candidate.json", bytes, maximum);
      await files(store, preparation, task);
      if (!(await privateBytes(state, resolve(directory, "candidate.json"), maximum)).equals(bytes)) throw new ContextDataError();
      guard(store, preparation, task, observation);
      current(); const saved = receipt(preparation, candidate, bytes); publications.set(saved, { store, preparation, task, bytes }); return saved;
    });
  } catch { throw new ContextDataError(); }
}

/** Current original receipt, bytes and running owner only. Serialized files are not recoverable receipt authority. */
export async function verifyContextAnalystCandidate(store: WorkspaceStore, preparation: ContextAnalystPreparation, task: ContextAnalystTask, suppliedReceipt: unknown): Promise<ContextAnalystCandidateReceipt> {
  try {
    const binding = publications.get(suppliedReceipt as object);
    if (!binding || binding.store !== store || binding.preparation !== preparation || binding.task !== task) throw new ContextDataError();
    checkContextAnalystCandidateTaskBinding(store, preparation, task);
    return await bounded(Date.parse(preparation.manifest.coordinatorDeadlineAt), async current => {
      const saved = suppliedReceipt as ContextAnalystCandidateReceipt;
      if (saved.sha256 !== sha256(binding.bytes) || !Buffer.from(JSON.stringify(saved.candidate)).equals(binding.bytes)) throw new ContextDataError();
      await files(store, preparation, task);
      const { state, directory } = await recordDirectory(store.directory, "context-analyst-runs", preparation.manifest.runId);
      if (!(await privateBytes(state, resolve(directory, "candidate.json"), maximum)).equals(binding.bytes)) throw new ContextDataError();
      await files(store, preparation, task);
      if (!(await privateBytes(state, resolve(directory, "candidate.json"), maximum)).equals(binding.bytes)) throw new ContextDataError();
      guard(store, preparation, task, saved.candidate.observation); current(); return saved;
    });
  } catch { throw new ContextDataError(); }
}
