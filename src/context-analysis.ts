import { isDeepStrictEqual } from "node:util";
import { sha256 } from "./evidence.ts";
import { readAnalyticalPacket } from "./analytical-review.ts";
import type { AnalyticalPacket } from "./analytical-review.ts";
import type { GlobalContextInput } from "./global-context.ts";
import { readReviewBrief, checkReviewBriefAccess } from "./review-briefs.ts";
import { readContextSnapshot } from "./context-snapshots.ts";
import type { ContextSnapshot } from "./context-snapshots.ts";
import { readContextSource, checkContextSourceAccess } from "./context-sources.ts";
import type { CheckedContextSource, ContextSourceCatalog } from "./context-sources.ts";
import { ContextDataError, fields, freeze, uuid, list, inputBytes, json } from "./context-data.ts";
import type { WorkspaceStore } from "./workspace.ts";

const policyVersion = "brief-context-analysis-v1" as const;
const tracks = ["product", "engineering", "customer_buyer", "commercial", "investor_preparation", "verification"] as const;
const limits = Object.freeze({ maxPacketBytes: 300000, maxSources: 12, maxResponseBytes: 32768, maxConcerns: 12, maxCitationsPerConcern: 6 });
const boundaries = Object.freeze({ coverage: "selected_brief_and_exact_context_snapshot", processing: "local_only_not_dispatchable", externalProcessing: "not_authorized", redistribution: "not_authorized", training: "not_authorized", currentGlobalAwareness: "not_established", sourceSupport: "not_semantically_verified", appExecution: "not_performed", stakeholderDecisions: "not_performed", referencesOpened: false, networkRequests: 0, toolCalls: 0, modelCalls: 0, semanticReview: "unreviewed", researchValidity: "not_established" } as const);
const limitations = Object.freeze(["Brief fields are supplied claims; source contents are exact checked local bytes. Neither hashes nor recorded capture provenance independently authenticate facts or semantic support.", "Context eligibility and coverage are evaluated at the frozen snapshot as-of time. This is not live freshness or complete global coverage. Future, unknown and stale dates remain explicit.", "Remote text, instructions, links and supplied references are untrusted literal data. They grant no tools, private access, external processing, delegation, purchases or investments.", "A matching citation identifies a field or whole source version, not a verified quotation, claim, relevance, causal effect, researched psychology or prediction. Free text needs separate semantic review and evaluation.", "Every concern must relate to at least one supplied brief field. A described app has not been tested, and a proposed next check has an unreviewed protocol.", "This packet/check is local and creates no model request, generation preview, provider authorization, task, budget or analytical result. Supplied text can contain private information; local operator, clock, files, copies and backups remain trusted boundaries."]);
function sourceDates(source: CheckedContextSource["source"]) {
  if (source.policyVersion === "context-source-node-release-v1") return { kind: "recorded_release" as const, repository: source.capture.release.repository, releaseId: source.capture.release.id, tag: source.capture.release.tag, timestamps: source.capture.release.timestamps, materialUpdatedAt: source.capture.release.materialUpdatedAt };
  if (source.policyVersion === "context-source-native-capture-v1") return { kind: "recorded_population" as const, datasetLastUpdated: source.capture.dataset.lastUpdated, observationYears: source.capture.dataset.observations.map(item => item.year), missingYears: source.capture.dataset.missingYears };
  return { kind: "operator_metadata_only" as const };
}
export interface ContextAnalyticalSource {
  sourceId: string; recordPolicy: CheckedContextSource["source"]["policyVersion"]; version: number; lineageRootId: string; recordSha256: string; metadataSha256: string;
  contentSha256: string; contentBytes: number; content: string; observationPeriod: CheckedContextSource["source"]["input"]["observationPeriod"]; importedAt: string; stateRevision: number;
  permittedPurpose: "local_review_only"; permissionExpiresAt: string; metadata: GlobalContextInput["sources"][number]; sourceDates: ReturnType<typeof sourceDates>; provenance: CheckedContextSource["source"]["provenance"];
  eligibilityAtSnapshot: { eligibleByMetadata: boolean; reasons: string[]; warnings: string[]; declaredOriginGroup: string }; semanticReview: "unreviewed";
}
export interface ContextAnalyticalPacket {
  schemaVersion: "2.0"; kind: "analytical_review_packet"; policyVersion: typeof policyVersion; brief: AnalyticalPacket["brief"]; briefPacketSha256: string; fields: AnalyticalPacket["fields"];
  context: { snapshotId: string; snapshotPolicyVersion: ContextSnapshot["policyVersion"]; snapshotRecordSha256: string; createdAt: string; asOf: string; timeBasis: "frozen_snapshot_not_live_freshness"; assessment: ContextSnapshot["assessment"]; declaredClaims: GlobalContextInput["claims"] };
  sources: readonly ContextAnalyticalSource[]; limits: typeof limits; boundaries: typeof boundaries; limitations: readonly string[]; packetSha256: string;
}
function sourceProjection(checked: CheckedContextSource, catalog: ContextSourceCatalog, assessment: ContextSnapshot["assessment"]["sources"][number]): ContextAnalyticalSource {
  const source = checked.source;
  return { sourceId: source.id, recordPolicy: source.policyVersion, version: source.version, lineageRootId: source.lineageRootId, recordSha256: catalog.recordSha256, metadataSha256: source.metadataSha256,
    contentSha256: source.content.sha256, contentBytes: source.content.bytes, content: checked.content, observationPeriod: source.input.observationPeriod, importedAt: source.importedAt, stateRevision: checked.currentState.revision,
    permittedPurpose: "local_review_only", permissionExpiresAt: source.input.permissions.expiresAt, metadata: source.input.metadata, sourceDates: sourceDates(source), provenance: source.provenance,
    eligibilityAtSnapshot: { eligibleByMetadata: assessment.eligibleByMetadata, reasons: assessment.reasons, warnings: assessment.warnings, declaredOriginGroup: assessment.declaredOriginGroup }, semanticReview: "unreviewed" };
}
const checkedPackets = new WeakMap<object, () => undefined>();
/** Local deterministic packet only. This cannot enter the existing brief-only provider contracts. */
export async function readContextAnalyticalPacket(store: WorkspaceStore, snapshotId: string): Promise<ContextAnalyticalPacket> {
  try {
    uuid(snapshotId); const catalog = store.contextSnapshot(snapshotId); if (!catalog) throw new ContextDataError();
    const snapshot = await readContextSnapshot(store, snapshotId), briefCatalog = store.reviewBrief(snapshot.brief.id); if (!briefCatalog) throw new ContextDataError();
    const brief = await readReviewBrief(store, snapshot.brief.id), packet = await readAnalyticalPacket(store, snapshot.brief.id);
    if (packet.packetSha256 !== snapshot.briefPacketSha256 || !isDeepStrictEqual(packet.brief, snapshot.brief) || snapshot.sourcePins.length > limits.maxSources) throw new ContextDataError();
    const checkedSources: { checked: CheckedContextSource; catalog: ContextSourceCatalog }[] = [], sources: ReturnType<typeof sourceProjection>[] = [];
    for (const pin of snapshot.sourcePins) {
      const sourceCatalog = store.contextSource(pin.sourceId); if (!sourceCatalog) throw new ContextDataError(); const checked = await readContextSource(store, pin.sourceId), assessment = snapshot.assessment.sources.find(item => item.id === checked.source.input.metadata.id);
      if (!assessment || sourceCatalog.recordSha256 !== pin.recordSha256 || checked.source.metadataSha256 !== pin.metadataSha256 || checked.source.content.sha256 !== pin.contentSha256 || checked.source.content.bytes !== pin.contentBytes || checked.source.version !== pin.version || checked.source.lineageRootId !== pin.lineageRootId || checked.currentState.revision !== pin.stateRevision) throw new ContextDataError();
      checkContextSourceAccess(store, checked, sourceCatalog); checkedSources.push({ checked, catalog: sourceCatalog }); sources.push(sourceProjection(checked, sourceCatalog, assessment));
    }
    const guard = () => { checkReviewBriefAccess(store, brief, briefCatalog); if (!isDeepStrictEqual(store.contextSnapshot(snapshotId), catalog)) throw new ContextDataError(); for (const source of checkedSources) checkContextSourceAccess(store, source.checked, source.catalog); return undefined; }; guard();
    const base: Omit<ContextAnalyticalPacket, "packetSha256"> = { schemaVersion: "2.0", kind: "analytical_review_packet", policyVersion, brief: packet.brief, briefPacketSha256: packet.packetSha256, fields: packet.fields,
      context: { snapshotId, snapshotPolicyVersion: snapshot.policyVersion, snapshotRecordSha256: catalog.recordSha256, createdAt: snapshot.createdAt, asOf: snapshot.input.context.scope.asOf, timeBasis: "frozen_snapshot_not_live_freshness", assessment: snapshot.assessment, declaredClaims: snapshot.input.context.claims },
      sources, limits, boundaries, limitations };
    const result = freeze({ ...base, packetSha256: sha256(JSON.stringify(base)) });
    if (Buffer.byteLength(JSON.stringify(result, null, 2) + "\n") > limits.maxPacketBytes) throw new ContextDataError();
    const currentSnapshot = await readContextSnapshot(store, snapshotId), currentBrief = await readAnalyticalPacket(store, snapshot.brief.id);
    if (!isDeepStrictEqual(currentSnapshot, snapshot) || currentBrief.packetSha256 !== packet.packetSha256) throw new ContextDataError();
    for (const source of checkedSources) if (!isDeepStrictEqual(await readContextSource(store, source.checked.source.id), source.checked)) throw new ContextDataError();
    guard(); checkedPackets.set(result, guard); return result;
  } catch { throw new ContextDataError(); }
}
function choice<T extends string>(value: unknown, allowed: readonly T[]): T { if (typeof value !== "string" || !allowed.includes(value as T)) throw new ContextDataError(); return value as T; }
function responseText(value: unknown, max: number): string { if (typeof value !== "string" || !value.trim() || value.length > max || /[\x00-\x08\x0b-\x1f\x7f-\x9f]/u.test(value)) throw new ContextDataError(); return value; }
type BriefCitation = { kind: "brief_field"; fieldId: string; fieldSha256: string };
type SourceCitation = { kind: "context_source"; sourceId: string; recordSha256: string; contentSha256: string; use: "context_at_snapshot" | "background_only" | "coverage_gap" };
function citation(value: unknown, packet: ContextAnalyticalPacket): BriefCitation | SourceCitation {
  if (!value || typeof value !== "object") throw new ContextDataError(); const kind = Object.getOwnPropertyDescriptor(value, "kind")?.value;
  if (kind === "brief_field") {
    const raw = fields(value, ["kind", "fieldId", "fieldSha256"]), field = packet.fields.find(item => item.id === raw.fieldId); if (!field || field.sha256 !== raw.fieldSha256) throw new ContextDataError(); return { kind, fieldId: field.id, fieldSha256: field.sha256 };
  }
  const raw = fields(value, ["kind", "sourceId", "recordSha256", "contentSha256", "use"]); if (kind !== "context_source") throw new ContextDataError();
  const source = packet.sources.find(item => item.sourceId === raw.sourceId); if (!source || source.recordSha256 !== raw.recordSha256 || source.contentSha256 !== raw.contentSha256) throw new ContextDataError();
  const use = choice(raw.use, ["context_at_snapshot", "background_only", "coverage_gap"] as const);
  if (use === "context_at_snapshot" && !source.eligibilityAtSnapshot.eligibleByMetadata || use === "background_only" && source.eligibilityAtSnapshot.reasons.some(reason => ["retrieved_after_as_of", "published_after_available_time", "updated_after_available_time", "event_after_available_time"].includes(reason))) throw new ContextDataError();
  return { kind, sourceId: source.sourceId, recordSha256: source.recordSha256, contentSha256: source.contentSha256, use };
}
/** Requires the exact checked in-process packet; full file checks belong to the managed operation below. */
export function validateContextAnalyticalResponse(value: unknown, packet: ContextAnalyticalPacket) {
  try {
    const guard = checkedPackets.get(packet); if (!guard) throw new ContextDataError(); guard();
    const raw = fields(value, ["schemaVersion", "kind", "mode", "reviewStatus", "briefId", "snapshotId", "packetSha256", "concerns", "abstention"]);
    if (raw.schemaVersion !== "2.0" || raw.kind !== "analytical_review_response" || raw.mode !== "analytical_only" || raw.reviewStatus !== "unreviewed" || raw.briefId !== packet.brief.id || raw.snapshotId !== packet.context.snapshotId || raw.packetSha256 !== packet.packetSha256) throw new ContextDataError();
    const seen = new Set<string>(), concerns = list(raw.concerns, limits.maxConcerns, value => {
      const item = fields(value, ["id", "track", "type", "statement", "basis", "whyItMatters", "priority", "priorityReason", "nextCheck"]);
      if (typeof item.id !== "string" || !/^C[0-9]{2}$/u.test(item.id) || seen.has(item.id)) throw new ContextDataError(); seen.add(item.id);
      const cited = new Set<string>(), basis = list(item.basis, limits.maxCitationsPerConcern, value => { const ref = citation(value, packet), id = ref.kind === "brief_field" ? `brief:${ref.fieldId}` : `source:${ref.sourceId}`; if (cited.has(id)) throw new ContextDataError(); cited.add(id); return ref; });
      if (!basis.some(ref => ref.kind === "brief_field")) throw new ContextDataError();
      const next = fields(item.nextCheck, ["question", "method", "successRule", "protocolStatus"]); if (next.protocolStatus !== "unreviewed") throw new ContextDataError();
      return { id: item.id, track: choice(item.track, tracks), type: choice(item.type, ["assumption_risk", "evidence_gap", "consistency_question"] as const), statement: responseText(item.statement, 1000), basis, whyItMatters: responseText(item.whyItMatters, 1000), priority: choice(item.priority, ["now", "next", "later"] as const), priorityReason: responseText(item.priorityReason, 500),
        nextCheck: { question: responseText(next.question, 1000), method: responseText(next.method, 1000), successRule: responseText(next.successRule, 1000), protocolStatus: "unreviewed" as const } };
    });
    const abstention = raw.abstention === null ? null : responseText(raw.abstention, 1000); if (!concerns.length && abstention === null) throw new ContextDataError();
    const response = { schemaVersion: "2.0", kind: "analytical_review_response", mode: "analytical_only", reviewStatus: "unreviewed", briefId: packet.brief.id, snapshotId: packet.context.snapshotId, packetSha256: packet.packetSha256, concerns, abstention };
    if (Buffer.byteLength(JSON.stringify(response)) > limits.maxResponseBytes) throw new ContextDataError(); guard();
    return freeze({ schemaVersion: "2.0", kind: "analytical_response_check", response, checks: { structure: "passed", citations: "matched_to_exact_brief_fields_and_source_versions", sourceUse: "metadata_only_at_snapshot", semanticReview: "unreviewed", researchValidity: "not_established" }, tracksNotCovered: tracks.filter(track => !concerns.some(concern => concern.track === track)), boundaries, limitations });
  } catch { throw new ContextDataError(); }
}
export async function readContextAnalyticalResponseInput(file: string): Promise<unknown> { try { return json(await inputBytes(file, limits.maxResponseBytes)); } catch { throw new ContextDataError(); } }
export async function checkStoredContextAnalyticalResponse(store: WorkspaceStore, snapshotId: string, value: unknown) {
  const packet = await readContextAnalyticalPacket(store, snapshotId), checked = validateContextAnalyticalResponse(value, packet), current = await readContextAnalyticalPacket(store, snapshotId);
  if (current.packetSha256 !== packet.packetSha256) throw new ContextDataError(); validateContextAnalyticalResponse(checked.response, current); return checked;
}
