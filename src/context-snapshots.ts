import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { sha256 } from "./evidence.ts";
import { parseGlobalContextInput, assessGlobalContext } from "./global-context.ts";
import type { GlobalContextInput } from "./global-context.ts";
import { readReviewBrief, checkReviewBriefAccess } from "./review-briefs.ts";
import { readAnalyticalPacket } from "./analytical-review.ts";
import { readContextSource, checkContextSourceAccess, checkContextSourceCatalog } from "./context-sources.ts";
import type { CheckedContextSource, ContextSourceCatalog } from "./context-sources.ts";
import { ContextDataError, fields, text, uuid, digest, timestamp, integer, list, freeze, json, bytes, inputBytes, recordDirectory, privateBytes, publish } from "./context-data.ts";
import type { WorkspaceStore } from "./workspace.ts";

export interface ContextSnapshotInput { schemaVersion: "1.0"; kind: "context_snapshot_input"; briefId: string; selection: { sourceId: string; recordSha256: string; expectedStateRevision: number }[]; context: GlobalContextInput }
export interface ContextSnapshotSummary { id: string; createdAt: string; briefId: string; briefReportSha256: string; subjectType: "idea" | "app"; title: string; directory: string; recordSha256: string; sources: { sourceId: string; recordSha256: string; stateRevision: number }[]; outcome: string }
const maximumRecordBytes = 700000;
const boundaries = Object.freeze({ sourceContents: "local_imported_bytes_integrity_only", provenance: "operator_imported_unverified", publisherAuthenticated: false, currentGlobalAwareness: "not_established", semanticReview: "unreviewed", externalProcessing: "not_authorized", redistribution: "not_authorized", training: "not_authorized", actualNewsCollected: false, networkRequests: 0, modelCalls: 0, referencesOpened: false, appExecution: "not_performed", stakeholderDecisions: false } as const);
export function parseContextSnapshotInput(value: unknown): ContextSnapshotInput {
  try {
    const raw = fields(value, ["schemaVersion", "kind", "briefId", "selection", "context"]); if (raw.schemaVersion !== "1.0" || raw.kind !== "context_snapshot_input") throw new ContextDataError();
    const selection = list(raw.selection, 12, item => { const pin = fields(item, ["sourceId", "recordSha256", "expectedStateRevision"]); return { sourceId: uuid(pin.sourceId), recordSha256: digest(pin.recordSha256), expectedStateRevision: integer(pin.expectedStateRevision, 1) }; });
    if (new Set(selection.map(pin => pin.sourceId)).size !== selection.length) throw new ContextDataError();
    const input: ContextSnapshotInput = { schemaVersion: "1.0", kind: "context_snapshot_input", briefId: uuid(raw.briefId), selection, context: parseGlobalContextInput(raw.context) };
    if (input.context.sources.length !== selection.length || Buffer.byteLength(JSON.stringify(input)) > 150000) throw new ContextDataError(); return freeze(input);
  } catch { throw new ContextDataError(); }
}
async function checkedInputs(store: WorkspaceStore, value: unknown, creating: boolean) {
  const input = parseContextSnapshotInput(value), briefCatalog = store.reviewBrief(input.briefId); if (!briefCatalog) throw new ContextDataError();
  const brief = await readReviewBrief(store, input.briefId), packet = await readAnalyticalPacket(store, input.briefId);
  const sources: { checked: CheckedContextSource; catalog: ContextSourceCatalog }[] = [];
  if (creating && Date.parse(input.context.scope.asOf) > Date.now()) throw new ContextDataError();
  for (const [index, pin] of input.selection.entries()) {
    const catalog = store.contextSource(pin.sourceId); if (!catalog) throw new ContextDataError(); const checked = await readContextSource(store, pin.sourceId);
    if (catalog.recordSha256 !== pin.recordSha256 || checked.currentState.revision !== pin.expectedStateRevision || !isDeepStrictEqual(input.context.sources[index], checked.source.input.metadata)
      || Date.parse(checked.source.importedAt) > Date.parse(input.context.scope.asOf)) throw new ContextDataError();
    checkContextSourceAccess(store, checked, catalog); sources.push({ checked, catalog });
  }
  const guard = () => { checkReviewBriefAccess(store, brief, briefCatalog); for (const source of sources) checkContextSourceAccess(store, source.checked, source.catalog); return undefined; }; guard();
  const sourcePins = sources.map(({ checked, catalog }) => ({ sourceId: checked.source.id, version: checked.source.version, lineageRootId: checked.source.lineageRootId, recordSha256: catalog.recordSha256, metadataSha256: checked.source.metadataSha256,
    contentSha256: checked.source.content.sha256, contentBytes: checked.source.content.bytes, importedAt: checked.source.importedAt, stateRevision: checked.currentState.revision, permittedPurpose: "local_review_only", permissionExpiresAt: checked.source.input.permissions.expiresAt }));
  const base = { input, inputSha256: sha256(JSON.stringify(input)), brief: packet.brief, briefPacketSha256: packet.packetSha256, sourcePins, assessment: assessGlobalContext(input.context), boundaries };
  return { base, guard, briefTitle: brief.input.title };
}
export async function previewContextSnapshot(store: WorkspaceStore, value: unknown) {
  try { const checked = await checkedInputs(store, value, true); checked.guard(); return freeze({ schemaVersion: "1.0", kind: "context_snapshot_preview", state: "not_saved", ...checked.base }); } catch { throw new ContextDataError(); }
}
function record(id: string, createdAt: string, base: Awaited<ReturnType<typeof checkedInputs>>["base"]) {
  uuid(id); timestamp(createdAt); if (Date.parse(base.input.context.scope.asOf) > Date.parse(createdAt) || base.sourcePins.some(pin => Date.parse(pin.importedAt) > Date.parse(createdAt))) throw new ContextDataError();
  return { schemaVersion: "1.0", kind: "context_snapshot", policyVersion: "context-snapshot-v1", id, createdAt, ...base };
}
export type ContextSnapshot = ReturnType<typeof record>;
function summary(snapshot: ContextSnapshot, title: string, directory: string, recordSha256: string): ContextSnapshotSummary { return { id: snapshot.id, createdAt: snapshot.createdAt, briefId: snapshot.brief.id, briefReportSha256: snapshot.brief.reportSha256, subjectType: snapshot.brief.subjectType, title, directory, recordSha256,
  sources: snapshot.sourcePins.map(pin => ({ sourceId: pin.sourceId, recordSha256: pin.recordSha256, stateRevision: pin.stateRevision })), outcome: snapshot.assessment.outcome }; }
export async function createContextSnapshot(store: WorkspaceStore, value: unknown): Promise<ContextSnapshotSummary> {
  try {
    const checked = await checkedInputs(store, value, true), id = randomUUID(), createdAt = new Date().toISOString(), snapshot = record(id, createdAt, checked.base), recordBytes = bytes(snapshot, maximumRecordBytes);
    const { state, directory } = await recordDirectory(store.directory, "context-snapshots", id, true); checked.guard(); await publish(state, directory, "snapshot.json", recordBytes, maximumRecordBytes);
    const rechecked = await checkedInputs(store, checked.base.input, false); if (!isDeepStrictEqual(rechecked.base, checked.base)) throw new ContextDataError(); checked.guard(); rechecked.guard();
    const result = summary(snapshot, checked.briefTitle, directory, sha256(recordBytes)); store.saveContextSnapshot(result, () => { checked.guard(); rechecked.guard(); return undefined; }); return freeze(result);
  } catch { throw new ContextDataError(); }
}
function checkSummary(store: WorkspaceStore, value: ContextSnapshotSummary): void {
  fields(value, ["id", "createdAt", "briefId", "briefReportSha256", "subjectType", "title", "directory", "recordSha256", "sources", "outcome"]);
  uuid(value.id); timestamp(value.createdAt); uuid(value.briefId); digest(value.briefReportSha256); text(value.title, 200); text(value.directory, 4096); digest(value.recordSha256);
  if (!["idea", "app"].includes(value.subjectType) || !["no_eligible_context", "partial_metadata_coverage", "metadata_checks_passed"].includes(value.outcome)) throw new ContextDataError();
  const pins = list(value.sources, 12, item => { const pin = fields(item, ["sourceId", "recordSha256", "stateRevision"]); return { sourceId: uuid(pin.sourceId), recordSha256: digest(pin.recordSha256), stateRevision: integer(pin.stateRevision, 1) }; });
  if (new Set(pins.map(pin => pin.sourceId)).size !== pins.length) throw new ContextDataError();
  const brief = store.reviewBrief(value.briefId); if (!brief || brief.reportSha256 !== value.briefReportSha256 || brief.title !== value.title || brief.subjectType !== value.subjectType) throw new ContextDataError();
  for (const pin of pins) { const source = store.contextSource(pin.sourceId); if (!source) throw new ContextDataError(); checkContextSourceCatalog(store, source); if (source.state.status !== "active" || source.state.revision !== pin.stateRevision || source.recordSha256 !== pin.recordSha256 || Date.now() >= Date.parse(source.expiresAt)) throw new ContextDataError(); }
  if (!isDeepStrictEqual(store.contextSnapshot(value.id), value)) throw new ContextDataError();
}
export async function readContextSnapshot(store: WorkspaceStore, id: string): Promise<ContextSnapshot> {
  try {
    uuid(id); const expected = store.contextSnapshot(id); if (!expected) throw new ContextDataError(); checkSummary(store, expected);
    const { state, directory } = await recordDirectory(store.directory, "context-snapshots", id); if (expected.directory !== directory) throw new ContextDataError();
    const recordBytes = await privateBytes(state, resolve(directory, "snapshot.json"), maximumRecordBytes); if (sha256(recordBytes) !== expected.recordSha256) throw new ContextDataError();
    const decoded = json(recordBytes), raw = fields(decoded, ["schemaVersion", "kind", "policyVersion", "id", "createdAt", "input", "inputSha256", "brief", "briefPacketSha256", "sourcePins", "assessment", "boundaries"]), checked = await checkedInputs(store, raw.input, false), snapshot = record(id, expected.createdAt, checked.base);
    if (!isDeepStrictEqual(decoded, snapshot) || !recordBytes.equals(bytes(snapshot, maximumRecordBytes)) || !isDeepStrictEqual(summary(snapshot, checked.briefTitle, directory, sha256(recordBytes)), expected)) throw new ContextDataError();
    if (!(await privateBytes(state, resolve(directory, "snapshot.json"), maximumRecordBytes)).equals(recordBytes)) throw new ContextDataError(); checked.guard(); checkSummary(store, expected); return freeze(snapshot);
  } catch { throw new ContextDataError(); }
}
export function contextSnapshotSummaries(store: WorkspaceStore) {
  return store.recentContextSnapshots().flatMap(item => { try { checkSummary(store, item); return [{ id: item.id, createdAt: item.createdAt, briefId: item.briefId, subjectType: item.subjectType, title: item.title, sourceCount: item.sources.length, outcome: item.outcome, recordSha256: item.recordSha256, recordStatus: "cataloged_unverified", reviewStatus: "unreviewed" }]; } catch { return []; } });
}
export async function readContextSnapshotInput(file: string): Promise<ContextSnapshotInput> { try { return parseContextSnapshotInput(json(await inputBytes(file, 150000))); } catch { throw new ContextDataError(); } }
