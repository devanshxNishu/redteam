import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { sha256 } from "./evidence.ts";
import { readContextAnalyticalPacket, checkContextAnalyticalPacketAccess } from "./context-analysis.ts";
import type { ContextAnalyticalPacket } from "./context-analysis.ts";
import { ContextDataError, ContextStateConflict, fields, text, uuid, digest, timestamp, integer, list, freeze, json, bytes, inputBytes, recordDirectory, privateBytes, publish } from "./context-data.ts";
import type { WorkspaceStore } from "./workspace.ts";

interface Declaration { authorized: true; basis: string; expiresAt: string }
export interface ContextProcessingInput {
  schemaVersion: "1.0"; kind: "context_processing_declaration_input"; provider: "openai"; model: string; purpose: "input_count_and_analysis_inference";
  packet: { snapshotId: string; packetSha256: string }; packetDeclaration: Declaration;
  sources: (Declaration & { sourceId: string; recordSha256: string; contentSha256: string })[];
  training: false; redistribution: false;
}
export interface ContextProcessingState { revision: number; status: "active" | "revoked"; at: string; reason: string | null }
export interface ContextProcessingCatalog {
  id: string; createdAt: string; provider: "openai"; model: string; packetSha256: string; snapshotId: string; recordSha256: string; expiresAt: string; directory: string; state: ContextProcessingState;
}
const maximumInputBytes = 24000, maximumRecordBytes = 64000;
const boundaries = Object.freeze({ authority: "operator_declared_not_independently_authenticated", originalSourcePolicies: "unchanged_local_only_records", processing: "declaration_only_no_dispatch", generation: "not_prepared", credentials: "not_loaded", liveCompatibility: "not_checked", training: "not_authorized", redistribution: "not_authorized", networkRequests: 0, modelCalls: 0, toolCalls: 0, taskCreated: false, budgetCreated: false, resultPublished: false, semanticReview: "unreviewed", stakeholderDecisions: "not_performed" } as const);
function modelName(value: unknown): string { const name = text(value, 120); if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/u.test(name)) throw new ContextDataError(); return name; }
function declaration(value: unknown): Declaration { const raw = fields(value, ["authorized", "basis", "expiresAt"]); if (raw.authorized !== true) throw new ContextDataError(); return { authorized: true, basis: text(raw.basis, 1000), expiresAt: timestamp(raw.expiresAt) }; }
export function parseContextProcessingInput(value: unknown): ContextProcessingInput {
  try {
    const raw = fields(value, ["schemaVersion", "kind", "provider", "model", "purpose", "packet", "packetDeclaration", "sources", "training", "redistribution"]);
    if (raw.schemaVersion !== "1.0" || raw.kind !== "context_processing_declaration_input" || raw.provider !== "openai" || raw.purpose !== "input_count_and_analysis_inference" || raw.training !== false || raw.redistribution !== false) throw new ContextDataError();
    const packet = fields(raw.packet, ["snapshotId", "packetSha256"]), sources = list(raw.sources, 12, value => { const item = fields(value, ["sourceId", "recordSha256", "contentSha256", "authorized", "basis", "expiresAt"]); return { sourceId: uuid(item.sourceId), recordSha256: digest(item.recordSha256), contentSha256: digest(item.contentSha256), ...declaration({ authorized: item.authorized, basis: item.basis, expiresAt: item.expiresAt }) }; });
    if (new Set(sources.map(source => source.sourceId)).size !== sources.length) throw new ContextDataError();
    const input: ContextProcessingInput = { schemaVersion: "1.0", kind: "context_processing_declaration_input", provider: "openai", model: modelName(raw.model), purpose: "input_count_and_analysis_inference", packet: { snapshotId: uuid(packet.snapshotId), packetSha256: digest(packet.packetSha256) }, packetDeclaration: declaration(raw.packetDeclaration), sources, training: false, redistribution: false };
    bytes(input, maximumInputBytes); return freeze(input);
  } catch { throw new ContextDataError(); }
}
function initialState(at: string): ContextProcessingState { return { revision: 1, status: "active", at, reason: null }; }
function recordFor(input: ContextProcessingInput, packet: ContextAnalyticalPacket, id: string, createdAt: string) {
  uuid(id); timestamp(createdAt);
  if (input.packet.snapshotId !== packet.context.snapshotId || input.packet.packetSha256 !== packet.packetSha256 || input.sources.length !== packet.sources.length || Date.parse(createdAt) < Date.parse(packet.context.createdAt)) throw new ContextDataError();
  const expiries = [Date.parse(input.packetDeclaration.expiresAt)];
  const sources = packet.sources.map((source, index) => {
    const declared = input.sources[index]!;
    if (declared.sourceId !== source.sourceId || declared.recordSha256 !== source.recordSha256 || declared.contentSha256 !== source.contentSha256 || Date.parse(declared.expiresAt) > Date.parse(source.permissionExpiresAt)) throw new ContextDataError();
    expiries.push(Date.parse(declared.expiresAt), Date.parse(source.permissionExpiresAt));
    return { sourceId: source.sourceId, recordPolicy: source.recordPolicy, version: source.version, lineageRootId: source.lineageRootId, recordSha256: source.recordSha256, metadataSha256: source.metadataSha256, contentSha256: source.contentSha256, contentBytes: source.contentBytes, stateRevision: source.stateRevision, localPermissionExpiresAt: source.permissionExpiresAt };
  });
  const expiresAt = new Date(Math.min(...expiries)).toISOString(); if (Date.parse(expiresAt) <= Date.parse(createdAt)) throw new ContextDataError();
  return { schemaVersion: "1.0", kind: "context_processing_authorization", policyVersion: "context-processing-declaration-v1", id, createdAt, input, inputSha256: sha256(JSON.stringify(input)),
    scope: { brief: packet.brief, briefPacketSha256: packet.briefPacketSha256, snapshot: { id: packet.context.snapshotId, policyVersion: packet.context.snapshotPolicyVersion, recordSha256: packet.context.snapshotRecordSha256 }, packetSha256: packet.packetSha256, sources }, expiresAt, boundaries };
}
export type ContextProcessingRecord = ReturnType<typeof recordFor>;
function catalogFor(record: ContextProcessingRecord, directory: string, recordSha256: string, state: ContextProcessingState): ContextProcessingCatalog { return { id: record.id, createdAt: record.createdAt, provider: record.input.provider, model: record.input.model, packetSha256: record.scope.packetSha256, snapshotId: record.scope.snapshot.id, recordSha256, expiresAt: record.expiresAt, directory, state }; }
export function checkContextProcessingCatalog(store: WorkspaceStore, value: ContextProcessingCatalog): undefined {
  fields(value, ["id", "createdAt", "provider", "model", "packetSha256", "snapshotId", "recordSha256", "expiresAt", "directory", "state"]); uuid(value.id); timestamp(value.createdAt); modelName(value.model); digest(value.packetSha256); uuid(value.snapshotId); digest(value.recordSha256); timestamp(value.expiresAt); text(value.directory, 4096);
  if (value.provider !== "openai" || Date.parse(value.expiresAt) <= Date.parse(value.createdAt)) throw new ContextDataError();
  const events = store.contextProcessingEvents(value.id); if (events.length < 1 || events.length > 2 || !isDeepStrictEqual(events[0], initialState(value.createdAt))) throw new ContextDataError();
  if (events.length === 2) { const event = fields(events[1], ["revision", "status", "at", "reason"]); if (event.revision !== 2 || event.status !== "revoked" || Date.parse(timestamp(event.at)) < Date.parse(value.createdAt)) throw new ContextDataError(); text(event.reason, 1000); }
  if (!isDeepStrictEqual(value.state, events.at(-1)) || !isDeepStrictEqual(store.contextProcessingAuthorization(value.id), value)) throw new ContextDataError(); return undefined;
}
function checkActive(store: WorkspaceStore, catalog: ContextProcessingCatalog, packet: ContextAnalyticalPacket): undefined {
  checkContextProcessingCatalog(store, catalog); checkContextAnalyticalPacketAccess(packet);
  if (catalog.state.status !== "active" || Date.now() >= Date.parse(catalog.expiresAt) || catalog.packetSha256 !== packet.packetSha256 || catalog.snapshotId !== packet.context.snapshotId || store.activeContextProcessing(catalog.packetSha256, catalog.provider, catalog.model)?.id !== catalog.id) throw new ContextDataError(); return undefined;
}
/** Explicit local record only. A true operator declaration does not authenticate content rights or dispatch. */
export async function createContextProcessingAuthorization(store: WorkspaceStore, value: unknown): Promise<ContextProcessingCatalog> {
  try {
    const input = parseContextProcessingInput(value), packet = await readContextAnalyticalPacket(store, input.packet.snapshotId), record = recordFor(input, packet, randomUUID(), new Date().toISOString()), recordBytes = bytes(record, maximumRecordBytes);
    const guard = () => { checkContextAnalyticalPacketAccess(packet); if (Date.now() >= Date.parse(record.expiresAt)) throw new ContextDataError(); if (store.activeContextProcessing(input.packet.packetSha256, input.provider, input.model)) throw new ContextStateConflict(); return undefined; }; guard();
    const { state, directory } = await recordDirectory(store.directory, "context-processing", record.id, true); guard(); await publish(state, directory, "record.json", recordBytes, maximumRecordBytes);
    const current = await readContextAnalyticalPacket(store, input.packet.snapshotId); if (current.packetSha256 !== packet.packetSha256 || !isDeepStrictEqual(recordFor(input, current, record.id, record.createdAt), record)) throw new ContextDataError();
    if (!(await privateBytes(state, resolve(directory, "record.json"), maximumRecordBytes)).equals(recordBytes)) throw new ContextDataError(); guard(); checkContextAnalyticalPacketAccess(current);
    const summary = catalogFor(record, directory, sha256(recordBytes), initialState(record.createdAt)); store.saveContextProcessingAuthorization(summary, () => { guard(); checkContextAnalyticalPacketAccess(current); return undefined; }); return freeze(summary);
  } catch (error) { if (error instanceof ContextStateConflict) throw error; throw new ContextDataError(); }
}
export interface CheckedContextProcessingAuthorization { authorization: ContextProcessingRecord; recordSha256: string; currentState: ContextProcessingState; executionAuthority: "not_granted" }
const checkedAuthorizations = new WeakMap<object, { store: WorkspaceStore; guard: () => undefined }>();
/** Current metadata/expiry only; use full managed reads before future transmissions. */
export function checkContextProcessingAuthorizationAccess(store: WorkspaceStore, value: CheckedContextProcessingAuthorization): undefined {
  try { const checked = checkedAuthorizations.get(value); if (!checked || checked.store !== store) throw new ContextDataError(); checked.guard(); return undefined; } catch { throw new ContextDataError(); }
}
export async function readContextProcessingAuthorization(store: WorkspaceStore, id: string): Promise<CheckedContextProcessingAuthorization> {
  try {
    uuid(id); const expected = store.contextProcessingAuthorization(id); if (!expected) throw new ContextDataError(); checkContextProcessingCatalog(store, expected); if (expected.state.status !== "active" || Date.now() >= Date.parse(expected.expiresAt)) throw new ContextDataError();
    const { state, directory } = await recordDirectory(store.directory, "context-processing", id); if (expected.directory !== directory) throw new ContextDataError();
    const recordBytes = await privateBytes(state, resolve(directory, "record.json"), maximumRecordBytes); if (sha256(recordBytes) !== expected.recordSha256) throw new ContextDataError();
    const decoded = json(recordBytes), raw = fields(decoded, ["schemaVersion", "kind", "policyVersion", "id", "createdAt", "input", "inputSha256", "scope", "expiresAt", "boundaries"]), input = parseContextProcessingInput(raw.input), packet = await readContextAnalyticalPacket(store, expected.snapshotId), record = recordFor(input, packet, id, expected.createdAt);
    if (!isDeepStrictEqual(decoded, record) || !recordBytes.equals(bytes(record, maximumRecordBytes)) || !isDeepStrictEqual(catalogFor(record, directory, sha256(recordBytes), expected.state), expected)) throw new ContextDataError(); checkActive(store, expected, packet);
    const current = await readContextAnalyticalPacket(store, expected.snapshotId); if (current.packetSha256 !== packet.packetSha256 || !(await privateBytes(state, resolve(directory, "record.json"), maximumRecordBytes)).equals(recordBytes)) throw new ContextDataError();
    checkActive(store, expected, packet); checkActive(store, expected, current);
    const result: CheckedContextProcessingAuthorization = freeze({ authorization: record, recordSha256: expected.recordSha256, currentState: expected.state, executionAuthority: "not_granted" }); checkedAuthorizations.set(result, { store, guard: () => { checkActive(store, expected, packet); checkActive(store, expected, current); return undefined; } }); return result;
  } catch { throw new ContextDataError(); }
}
/** Administrative metadata only. Catalog state is not a checked processing permission. */
export function contextProcessingSummaries(store: WorkspaceStore) {
  return store.recentContextProcessing().flatMap(item => { try { checkContextProcessingCatalog(store, item); return [{ id: item.id, createdAt: item.createdAt, provider: item.provider, model: item.model, snapshotId: item.snapshotId, expiresAt: item.expiresAt, state: item.state.status, revision: item.state.revision, timeState: Date.now() >= Date.parse(item.expiresAt) ? "expired" : "not_expired", catalogStatus: "cataloged_unverified", processingAuthority: "not_checked" }]; } catch { return []; } });
}
/** Administrative revocation remains possible after expiry, source loss or authorization file loss. */
export function revokeContextProcessingAuthorization(store: WorkspaceStore, id: string, revision: number, reason: string) {
  uuid(id); integer(revision, 1); text(reason, 1000); const expected = store.contextProcessingAuthorization(id); if (!expected) throw new ContextDataError(); checkContextProcessingCatalog(store, expected);
  return freeze({ id, state: store.revokeContextProcessingAuthorization(id, revision, reason, () => checkContextProcessingCatalog(store, expected)) });
}
export async function readContextProcessingInput(file: string): Promise<ContextProcessingInput> {
  try { const input = parseContextProcessingInput(json(await inputBytes(file, maximumInputBytes))); if ([input.packetDeclaration, ...input.sources].some(item => Date.now() >= Date.parse(item.expiresAt))) throw new ContextDataError(); return input; } catch { throw new ContextDataError(); }
}
