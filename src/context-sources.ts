import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { sha256 } from "./evidence.ts";
import { parseGlobalContextInput } from "./global-context.ts";
import { ContextDataError, ContextStateConflict, fields, text, uuid, digest, timestamp, integer, freeze, json, bytes, inputBytes, recordDirectory, privateBytes, publish } from "./context-data.ts";
import type { WorkspaceStore } from "./workspace.ts";

type Metadata = ReturnType<typeof parseGlobalContextInput>["sources"][number];
export interface ContextSourceImport {
  schemaVersion: "1.0"; kind: "context_source_import_input"; metadata: Metadata;
  observationPeriod: { startsAt: string; endsAt: string } | null;
  permissions: { localReview: true; basis: string; expiresAt: string; externalProcessing: false; redistribution: false; training: false };
  supersedes: { sourceId: string; expectedRevision: number } | null;
}
export interface ContextSourceState { revision: number; status: "active" | "withdrawn" | "superseded"; at: string; reason: string | null; replacementId: string | null }
export interface ContextSourceCatalog {
  id: string; importedAt: string; version: number; lineageRootId: string; metadataId: string; originId: string; kind: Metadata["kind"]; title: string;
  expiresAt: string; directory: string; recordSha256: string; contentSha256: string; inputSha256: string; metadataSha256: string; state: ContextSourceState;
}
export interface PreviousContextVersion { id: string; recordSha256: string; version: number; lineageRootId: string }
const sourceBounds = { record: 24000, content: 32768 };
const provenance = Object.freeze({ source: "operator_imported_unverified", importedText: "exact_local_bytes_only", publisher: "not_authenticated", retrievalTime: "operator_declared_not_observed", networkRequests: 0, modelCalls: 0 } as const);
const boundaries = Object.freeze({ semanticReview: "unreviewed", externalProcessing: "not_authorized", redistribution: "not_authorized", training: "not_authorized", currentGlobalAwareness: "not_established", researchValidated: false, stakeholderDecisions: false } as const);

export function parseContextSourceImport(value: unknown): ContextSourceImport {
  try {
    const raw = fields(value, ["schemaVersion", "kind", "metadata", "observationPeriod", "permissions", "supersedes"]);
    if (raw.schemaVersion !== "1.0" || raw.kind !== "context_source_import_input") throw new ContextDataError();
    const metadata = parseGlobalContextInput({ schemaVersion: "1.0", kind: "global_context_input", scope: { asOf: "1970-01-01T00:00:00.000Z", regions: ["schema"], languages: ["schema"], topics: ["schema"] }, policy: { maximumRetrievalAgeHours: 1, maximumPublicationAgeHours: { news: 1, release: 1, research: 1, dataset: 1, forecast: 1 }, minimumDeclaredOriginsForTrend: 1 }, sources: [raw.metadata], claims: [] }).sources[0]!;
    if (metadata.inspection !== "declared_inspected" || metadata.status !== "available") throw new ContextDataError();
    const permission = fields(raw.permissions, ["localReview", "basis", "expiresAt", "externalProcessing", "redistribution", "training"]);
    if (permission.localReview !== true || permission.externalProcessing !== false || permission.redistribution !== false || permission.training !== false) throw new ContextDataError();
    let observationPeriod = null;
    if (raw.observationPeriod !== null) { const period = fields(raw.observationPeriod, ["startsAt", "endsAt"]), startsAt = timestamp(period.startsAt), endsAt = timestamp(period.endsAt); if (Date.parse(startsAt) > Date.parse(endsAt) || Date.parse(endsAt) > Date.parse(metadata.retrievedAt)) throw new ContextDataError(); observationPeriod = { startsAt, endsAt }; }
    let supersedes = null; if (raw.supersedes !== null) { const prior = fields(raw.supersedes, ["sourceId", "expectedRevision"]); supersedes = { sourceId: uuid(prior.sourceId), expectedRevision: integer(prior.expectedRevision, 1) }; }
    return freeze({ schemaVersion: "1.0", kind: "context_source_import_input", metadata, observationPeriod, permissions: { localReview: true, basis: text(permission.basis, 1000), expiresAt: timestamp(permission.expiresAt), externalProcessing: false, redistribution: false, training: false }, supersedes });
  } catch { throw new ContextDataError(); }
}
function contentText(content: Buffer): string { if (!content.length || content.length > sourceBounds.content) throw new ContextDataError(); const result = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(content); if (!result.trim() || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/u.test(result) || !Buffer.from(result).equals(content)) throw new ContextDataError(); return result; }
function sourceRecord(input: ContextSourceImport, id: string, importedAt: string, content: Buffer, previous: PreviousContextVersion | null) {
  uuid(id); timestamp(importedAt); contentText(content);
  if (input.metadata.contentSha256 !== sha256(content) || Date.parse(input.permissions.expiresAt) <= Date.parse(importedAt) || input.observationPeriod && Date.parse(input.observationPeriod.endsAt) > Date.parse(importedAt)) throw new ContextDataError();
  if (previous) { const prior = fields(previous, ["id", "recordSha256", "version", "lineageRootId"]); previous = { id: uuid(prior.id), recordSha256: digest(prior.recordSha256), version: integer(prior.version, 9999), lineageRootId: uuid(prior.lineageRootId) }; }
  if (input.supersedes ? !previous || input.supersedes.sourceId !== previous.id : previous !== null) throw new ContextDataError();
  return { schemaVersion: "1.0", kind: "context_source_record", policyVersion: "context-source-import-v1", id, importedAt, version: previous ? previous.version + 1 : 1, lineageRootId: previous?.lineageRootId ?? id, previous,
    input, inputSha256: sha256(JSON.stringify(input)), metadataSha256: sha256(JSON.stringify(input.metadata)), content: { filename: "source.txt", bytes: content.length, sha256: sha256(content) }, provenance, boundaries };
}
export type ContextSourceRecord = ReturnType<typeof sourceRecord>;
export interface CheckedContextSource { source: ContextSourceRecord; content: string; currentState: ContextSourceState }
function initialState(at: string): ContextSourceState { return { revision: 1, status: "active", at, reason: null, replacementId: null }; }
function catalog(record: ContextSourceRecord, directory: string, recordSha256: string, state: ContextSourceState): ContextSourceCatalog { return { id: record.id, importedAt: record.importedAt, version: record.version, lineageRootId: record.lineageRootId, metadataId: record.input.metadata.id, originId: record.input.metadata.originId, kind: record.input.metadata.kind, title: record.input.metadata.title, expiresAt: record.input.permissions.expiresAt, directory, recordSha256, contentSha256: record.content.sha256, inputSha256: record.inputSha256, metadataSha256: record.metadataSha256, state }; }

export function checkContextSourceCatalog(store: WorkspaceStore, value: ContextSourceCatalog): void {
  fields(value, ["id", "importedAt", "version", "lineageRootId", "metadataId", "originId", "kind", "title", "expiresAt", "directory", "recordSha256", "contentSha256", "inputSha256", "metadataSha256", "state"]);
  uuid(value.id); timestamp(value.importedAt); integer(value.version); uuid(value.lineageRootId); text(value.metadataId, 80); text(value.originId, 80); text(value.title, 300); text(value.directory, 4096); timestamp(value.expiresAt); [value.recordSha256, value.contentSha256, value.inputSha256, value.metadataSha256].forEach(digest);
  if (!["news", "release", "research", "dataset", "forecast"].includes(value.kind) || Date.parse(value.expiresAt) <= Date.parse(value.importedAt)) throw new ContextDataError();
  const history = store.contextSourceEvents(value.id); if (history.length < 1 || history.length > 2 || !isDeepStrictEqual(history[0], initialState(value.importedAt))) throw new ContextDataError();
  if (history.length === 2) {
    const event = history[1]!; fields(event, ["revision", "status", "at", "reason", "replacementId"]); timestamp(event.at);
    if (event.revision !== 2 || Date.parse(event.at) < Date.parse(value.importedAt) || !["withdrawn", "superseded"].includes(event.status)) throw new ContextDataError();
    if (event.status === "withdrawn" ? event.replacementId !== null || !text(event.reason, 1000) : event.reason !== "replaced_by_new_source_version" || uuid(event.replacementId) === value.id) throw new ContextDataError();
  }
  if (!isDeepStrictEqual(value.state, history.at(-1)) || !isDeepStrictEqual(store.contextSource(value.id), value)) throw new ContextDataError();
}
export function checkContextSourceAccess(store: WorkspaceStore, checked: CheckedContextSource, expected: ContextSourceCatalog): undefined {
  checkContextSourceCatalog(store, expected);
  const recordBytes = bytes(checked.source, sourceBounds.record), actual = catalog(checked.source, expected.directory, sha256(recordBytes), checked.currentState);
  if (!isDeepStrictEqual(actual, expected) || expected.state.status !== "active" || Date.now() >= Date.parse(expected.expiresAt) || sha256(Buffer.from(checked.content)) !== expected.contentSha256) throw new ContextDataError(); return undefined;
}
function checkPrevious(store: WorkspaceStore, record: ContextSourceRecord): void {
  if (!record.previous) { if (record.version !== 1 || record.lineageRootId !== record.id) throw new ContextDataError(); return; }
  const previous = store.contextSource(record.previous.id); if (!previous) throw new ContextDataError(); checkContextSourceCatalog(store, previous);
  if (previous.state.status !== "superseded" || previous.state.replacementId !== record.id || previous.recordSha256 !== record.previous.recordSha256 || previous.version !== record.previous.version || previous.lineageRootId !== record.previous.lineageRootId
    || previous.metadataId !== record.input.metadata.id || previous.originId !== record.input.metadata.originId || previous.version + 1 !== record.version || previous.lineageRootId !== record.lineageRootId) throw new ContextDataError();
}
export async function readContextSource(store: WorkspaceStore, id: string): Promise<CheckedContextSource> {
  try {
    uuid(id); const expected = store.contextSource(id); if (!expected) throw new ContextDataError(); checkContextSourceCatalog(store, expected);
    if (expected.state.status !== "active" || Date.now() >= Date.parse(expected.expiresAt)) throw new ContextDataError();
    const { state, directory } = await recordDirectory(store.directory, "context-sources", id); if (expected.directory !== directory) throw new ContextDataError();
    const recordBytes = await privateBytes(state, resolve(directory, "record.json"), sourceBounds.record), content = await privateBytes(state, resolve(directory, "source.txt"), sourceBounds.content);
    if (sha256(recordBytes) !== expected.recordSha256) throw new ContextDataError();
    const decoded = json(recordBytes), raw = fields(decoded, ["schemaVersion", "kind", "policyVersion", "id", "importedAt", "version", "lineageRootId", "previous", "input", "inputSha256", "metadataSha256", "content", "provenance", "boundaries"]);
    const input = parseContextSourceImport(raw.input), previous = raw.previous === null ? null : fields(raw.previous, ["id", "recordSha256", "version", "lineageRootId"]), record = sourceRecord(input, id, expected.importedAt, content, previous as PreviousContextVersion | null);
    if (!isDeepStrictEqual(decoded, record) || !recordBytes.equals(bytes(record, sourceBounds.record))) throw new ContextDataError(); checkPrevious(store, record);
    const checked = freeze({ source: record, content: contentText(content), currentState: expected.state }); checkContextSourceAccess(store, checked, expected);
    if (!(await privateBytes(state, resolve(directory, "record.json"), sourceBounds.record)).equals(recordBytes) || !(await privateBytes(state, resolve(directory, "source.txt"), sourceBounds.content)).equals(content)) throw new ContextDataError();
    checkContextSourceAccess(store, checked, expected); return checked;
  } catch { throw new ContextDataError(); }
}
export async function importContextSource(store: WorkspaceStore, value: unknown, contentInput: Buffer): Promise<ContextSourceCatalog> {
  try {
    const input = parseContextSourceImport(value), content = Buffer.from(contentInput); contentText(content);
    if (sha256(content) !== input.metadata.contentSha256 || Date.now() >= Date.parse(input.permissions.expiresAt)) throw new ContextDataError();
    let previous: PreviousContextVersion | null = null, parent: CheckedContextSource | undefined, parentCatalog: ContextSourceCatalog | undefined;
    if (input.supersedes) {
      parentCatalog = store.contextSource(input.supersedes.sourceId) ?? undefined; parent = await readContextSource(store, input.supersedes.sourceId);
      if (!parentCatalog || parent.currentState.revision !== input.supersedes.expectedRevision || parent.source.input.metadata.id !== input.metadata.id || parent.source.input.metadata.originId !== input.metadata.originId) throw new ContextStateConflict();
      checkContextSourceAccess(store, parent, parentCatalog); previous = { id: parent.source.id, recordSha256: parentCatalog.recordSha256, version: parent.source.version, lineageRootId: parent.source.lineageRootId };
    }
    const id = randomUUID(), importedAt = new Date().toISOString(), record = sourceRecord(input, id, importedAt, content, previous), recordBytes = bytes(record, sourceBounds.record);
    const guard = () => { if (Date.now() >= Date.parse(input.permissions.expiresAt)) throw new ContextDataError(); if (parent && parentCatalog) checkContextSourceAccess(store, parent, parentCatalog); return undefined; }; guard();
    const { state, directory } = await recordDirectory(store.directory, "context-sources", id, true);
    guard(); await publish(state, directory, "source.txt", content, sourceBounds.content); guard(); await publish(state, directory, "record.json", recordBytes, sourceBounds.record);
    if (!(await privateBytes(state, resolve(directory, "source.txt"), sourceBounds.content)).equals(content)) throw new ContextDataError(); guard();
    const summary = catalog(record, directory, sha256(recordBytes), initialState(importedAt)); store.saveContextSource(summary, input.supersedes, guard); return freeze(summary);
  } catch (error) { if (error instanceof ContextStateConflict) throw error; throw new ContextDataError(); }
}
export function contextSourceSummaries(store: WorkspaceStore) {
  return store.recentContextSources().flatMap(summary => { try { checkContextSourceCatalog(store, summary); if (summary.state.status !== "active" || Date.now() >= Date.parse(summary.expiresAt)) return []; return [{ id: summary.id, importedAt: summary.importedAt, version: summary.version, lineageRootId: summary.lineageRootId, title: summary.title, kind: summary.kind, recordSha256: summary.recordSha256, stateRevision: summary.state.revision, recordStatus: "cataloged_unverified" as const, provenance: provenance.source }]; } catch { return []; } });
}
export function withdrawContextSource(store: WorkspaceStore, id: string, expectedRevision: number, reason: string) {
  uuid(id); integer(expectedRevision, 1); text(reason, 1000); const summary = store.contextSource(id); if (!summary) throw new ContextDataError(); checkContextSourceCatalog(store, summary);
  // Administrative withdrawal remains possible after expiry or content loss. It reads no source text.
  const state = store.withdrawContextSource(id, expectedRevision, reason, () => { checkContextSourceCatalog(store, summary); return undefined; }); return freeze({ id, state });
}
export async function readContextImportFiles(metadataFile: string, contentFile: string) {
  try { const input = parseContextSourceImport(json(await inputBytes(metadataFile, sourceBounds.record))), content = await inputBytes(contentFile, sourceBounds.content); contentText(content); if (sha256(content) !== input.metadata.contentSha256 || Date.now() >= Date.parse(input.permissions.expiresAt)) throw new ContextDataError(); return { input, content }; } catch { throw new ContextDataError(); }
}
