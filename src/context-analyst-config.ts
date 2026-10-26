import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { sha256 } from "./evidence.ts";
import { parseAnalystResources } from "./analyst-config.ts";
import type { AnalystConfiguration } from "./analyst-config.ts";
import { prepareContextAnalystGeneration } from "./context-analyst-generation.ts";
import { readContextAnalyticalPacket, checkContextAnalyticalPacketAccess } from "./context-analysis.ts";
import type { ContextAnalyticalPacket } from "./context-analysis.ts";
import { readContextProcessingAuthorization, checkContextProcessingAuthorizationAccess } from "./context-processing.ts";
import type { CheckedContextProcessingAuthorization } from "./context-processing.ts";
import { ContextDataError, fields, text, uuid, digest, integer, freeze, bytes, inputBytes, json, timestamp } from "./context-data.ts";
import type { WorkspaceStore } from "./workspace.ts";

export interface ContextAnalystConfiguration {
  schemaVersion: "2.0"; kind: "context_analyst_configuration"; provider: "openai"; model: string;
  pricing: AnalystConfiguration["pricing"]; limits: AnalystConfiguration["limits"]; taskPolicy: AnalystConfiguration["taskPolicy"];
  context: { snapshotId: string; packetSha256: string; generationSha256: string };
  processing: { mode: "external"; scope: "exact_context_packet_and_generation"; authorizationId: string; recordSha256: string; expectedRevision: 1 };
}
/** Public data only. A reference to a declaration is not a permission check or dispatch authority. */
export function parseContextAnalystConfiguration(value: unknown): Readonly<ContextAnalystConfiguration> {
  try {
    const raw = fields(value, ["schemaVersion", "kind", "provider", "model", "pricing", "context", "processing", "limits", "taskPolicy"]), model = text(raw.model, 120);
    if (raw.schemaVersion !== "2.0" || raw.kind !== "context_analyst_configuration" || raw.provider !== "openai" || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/u.test(model)) throw new ContextDataError();
    const context = fields(raw.context, ["snapshotId", "packetSha256", "generationSha256"]), processing = fields(raw.processing, ["mode", "scope", "authorizationId", "recordSha256", "expectedRevision"]);
    if (processing.mode !== "external" || processing.scope !== "exact_context_packet_and_generation" || integer(processing.expectedRevision, 1) !== 1) throw new ContextDataError();
    const resources = parseAnalystResources({ pricing: raw.pricing, limits: raw.limits, taskPolicy: raw.taskPolicy });
    const result: ContextAnalystConfiguration = { schemaVersion: "2.0", kind: "context_analyst_configuration", provider: "openai", model, pricing: resources.pricing,
      context: { snapshotId: uuid(context.snapshotId), packetSha256: digest(context.packetSha256), generationSha256: digest(context.generationSha256) },
      processing: { mode: "external", scope: "exact_context_packet_and_generation", authorizationId: uuid(processing.authorizationId), recordSha256: digest(processing.recordSha256), expectedRevision: 1 }, limits: resources.limits, taskPolicy: resources.taskPolicy };
    bytes(result, 16000); return freeze(result);
  } catch { throw new ContextDataError(); }
}
function checkBinding(store: WorkspaceStore, configuration: ContextAnalystConfiguration, checked: CheckedContextProcessingAuthorization): undefined {
  checkContextProcessingAuthorizationAccess(store, checked); const record = checked.authorization;
  if (record.id !== configuration.processing.authorizationId || checked.recordSha256 !== configuration.processing.recordSha256 || checked.currentState.revision !== configuration.processing.expectedRevision || checked.currentState.status !== "active"
    || record.input.provider !== configuration.provider || record.input.model !== configuration.model || record.input.purpose !== "input_count_and_analysis_inference" || record.scope.snapshot.id !== configuration.context.snapshotId || record.scope.packetSha256 !== configuration.context.packetSha256) throw new ContextDataError(); return undefined;
}
function buildPreparation(configuration: Readonly<ContextAnalystConfiguration>, grant: CheckedContextProcessingAuthorization, preview: Awaited<ReturnType<typeof prepareContextAnalystGeneration>>, packet: ContextAnalyticalPacket, started: number, identity?: { runId: string; taskId: string }) {
  const resources = parseAnalystResources({ pricing: configuration.pricing, limits: configuration.limits, taskPolicy: configuration.taskPolicy }), deadline = started + configuration.limits.timeoutMs, finalDeadline = deadline + configuration.limits.finalizationMs, record = grant.authorization;
  if (!Number.isSafeInteger(started) || started < Date.parse(record.createdAt) || !Number.isSafeInteger(finalDeadline) || !Number.isFinite(new Date(finalDeadline).getTime()) || finalDeadline > Date.parse(record.expiresAt)) throw new ContextDataError();
  const manifest = { schemaVersion: "2.0" as const, kind: "context_analyst_run_manifest" as const, policyVersion: "brief-context-analyst-run-v1" as const,
    runId: identity?.runId ?? randomUUID(), taskId: identity?.taskId ?? randomUUID(), questionKey: "supplied-brief-context-analysis", maximumAttempts: 1 as const,
    preparedAt: new Date(started).toISOString(), inferenceDeadlineAt: new Date(deadline).toISOString(), coordinatorDeadlineAt: new Date(finalDeadline).toISOString(),
    source: packet.brief, context: { snapshotId: configuration.context.snapshotId, snapshotPolicyVersion: packet.context.snapshotPolicyVersion, snapshotRecordSha256: preview.snapshotRecordSha256, asOf: packet.context.asOf, timeBasis: "frozen_snapshot_not_live_freshness" as const },
    processing: { authorizationId: record.id, policyVersion: record.policyVersion, recordSha256: grant.recordSha256, inputSha256: record.inputSha256, stateRevision: grant.currentState.revision, effectiveExpiresAt: record.expiresAt, provider: record.input.provider, model: record.input.model, purpose: record.input.purpose },
    sourcePins: record.scope.sources, packetSha256: preview.packetSha256, briefPacketSha256: preview.briefPacketSha256, generationPolicyVersion: preview.policyVersion, instructionsSha256: preview.instructionsSha256, inputSha256: preview.inputSha256, schemaSha256: preview.schemaSha256, generationSha256: preview.generationSha256, generationPreviewSha256: preview.previewSha256,
    configurationSha256: sha256(JSON.stringify(configuration)), configuration,
    budget: { cap: { tokens: configuration.limits.count.tokens + configuration.limits.generation.tokens, costMicrousd: configuration.limits.count.costMicrousd + configuration.limits.generation.costMicrousd }, count: configuration.limits.count, generation: configuration.limits.generation, maximumConfiguredGenerationCostMicrousd: resources.maximumGenerationCostMicrousd, costBasis: "operator_configured_estimate" as const, countCostBasis: "explicit_operator_liability_cap_not_assumed_free" as const },
    responseLimits: packet.limits, boundaries: { processingAuthority: "operator_declared_not_independently_authenticated", executionAuthority: "not_granted", liveCompatibility: "not_checked", manifestSaved: false, referencesOpened: false, modelCalls: 0, networkRequests: 0, taskCreated: false, budgetCreated: false, resultPublished: false, semanticReview: "unreviewed", stakeholderDecisions: "not_performed" } as const };
  bytes(manifest, 24000); const preparation = freeze({ schemaVersion: "2.0" as const, kind: "context_analyst_run_preparation" as const, state: "not_started" as const, manifest, manifestSha256: sha256(JSON.stringify(manifest)), generation: preview.generation }); bytes(preparation, 520000); return preparation;
}
export type ContextAnalystPreparation = ReturnType<typeof buildPreparation>;
const checkedPreparations = new WeakMap<object, { store: WorkspaceStore; guard: () => undefined }>();
/** Current metadata/expiry and frozen deadline only; full managed file checks remain required before later use. */
export function checkContextAnalystPreparationAccess(store: WorkspaceStore, value: ContextAnalystPreparation): undefined {
  try { const checked = checkedPreparations.get(value); if (!checked || checked.store !== store) throw new ContextDataError(); checked.guard(); return undefined; } catch { throw new ContextDataError(); }
}
async function checkedContext(store: WorkspaceStore, configuration: Readonly<ContextAnalystConfiguration>) {
  const grant = await readContextProcessingAuthorization(store, configuration.processing.authorizationId); checkBinding(store, configuration, grant);
  const preview = await prepareContextAnalystGeneration(store, configuration.context.snapshotId), packet = await readContextAnalyticalPacket(store, configuration.context.snapshotId);
  if (preview.packetSha256 !== configuration.context.packetSha256 || preview.generationSha256 !== configuration.context.generationSha256 || packet.packetSha256 !== preview.packetSha256 || preview.inputSha256 !== sha256(JSON.stringify(packet))) throw new ContextDataError();
  const current = await readContextProcessingAuthorization(store, configuration.processing.authorizationId); checkBinding(store, configuration, current);
  if (!isDeepStrictEqual(current, grant)) throw new ContextDataError();
  const guard = () => { checkBinding(store, configuration, grant); checkBinding(store, configuration, current); checkContextAnalyticalPacketAccess(packet); return undefined; }; guard(); return { current, preview, packet, guard };
}
/** Checked unwritten plan only. This never creates provider/key/task/ledger/manifest files or results. */
export async function prepareContextAnalystRun(store: WorkspaceStore, value: unknown): Promise<ContextAnalystPreparation> {
  try {
    const configuration = parseContextAnalystConfiguration(value), checked = await checkedContext(store, configuration), preparation = buildPreparation(configuration, checked.current, checked.preview, checked.packet, Date.now());
    const guard = () => { checked.guard(); if (Date.now() >= Date.parse(preparation.manifest.inferenceDeadlineAt)) throw new ContextDataError(); return undefined; }; guard(); checkedPreparations.set(preparation, { store, guard }); return preparation;
  } catch { throw new ContextDataError(); }
}
/** Canonical data validation only. Reconstructed bytes never acquire checked preparation/write or execution identity. */
export async function checkContextAnalystManifestBytes(store: WorkspaceStore, suppliedManifest: Buffer, suppliedGeneration: Buffer) {
  try {
    if (!Buffer.isBuffer(suppliedManifest) || !Buffer.isBuffer(suppliedGeneration) || suppliedManifest.length > 24000 || suppliedGeneration.length > 500000) throw new ContextDataError();
    const manifestBytes = Buffer.from(suppliedManifest), generationBytes = Buffer.from(suppliedGeneration), raw = fields(json(manifestBytes), ["schemaVersion", "kind", "policyVersion", "runId", "taskId", "questionKey", "maximumAttempts", "preparedAt", "inferenceDeadlineAt", "coordinatorDeadlineAt", "source", "context", "processing", "sourcePins", "packetSha256", "briefPacketSha256", "generationPolicyVersion", "instructionsSha256", "inputSha256", "schemaSha256", "generationSha256", "generationPreviewSha256", "configurationSha256", "configuration", "budget", "responseLimits", "boundaries"]);
    const runId = uuid(raw.runId), taskId = uuid(raw.taskId), preparedAt = timestamp(raw.preparedAt), configuration = parseContextAnalystConfiguration(raw.configuration); if (runId === taskId || Date.parse(preparedAt) > Date.now()) throw new ContextDataError();
    const checked = await checkedContext(store, configuration), preparation = buildPreparation(configuration, checked.current, checked.preview, checked.packet, Date.parse(preparedAt), { runId, taskId });
    if (!manifestBytes.equals(Buffer.from(JSON.stringify(preparation.manifest))) || !generationBytes.equals(Buffer.from(JSON.stringify(preparation.generation)))) throw new ContextDataError(); checked.guard();
    return Object.freeze({ preparation, checkCurrent: checked.guard, executionAuthority: "not_granted" as const });
  } catch { throw new ContextDataError(); }
}
export async function readContextAnalystConfigurationInput(file: string): Promise<Readonly<ContextAnalystConfiguration>> { try { return parseContextAnalystConfiguration(json(await inputBytes(file, 16000))); } catch { throw new ContextDataError(); } }
