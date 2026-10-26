import { collectPublicContext, parsePublicContextCollection } from "./context-collector.ts";
import type { PublicContextCollection } from "./context-collector.ts";
import { prepareContextCaptureCorrection, saveCapturedContextSource } from "./context-sources.ts";
import { ContextDataError, fields, freeze, inputBytes, integer, json, uuid } from "./context-data.ts";
import type { WorkspaceStore } from "./workspace.ts";

export interface ContextCollectionInput {
  schemaVersion: "1.0";
  kind: "context_source_collection_input";
  collection: PublicContextCollection;
  supersedes: { sourceId: string; expectedRevision: number } | null;
}
export function parseContextCollectionInput(value: unknown): ContextCollectionInput {
  try {
    const raw = fields(value, ["schemaVersion", "kind", "collection", "supersedes"]);
    if (raw.schemaVersion !== "1.0" || raw.kind !== "context_source_collection_input") throw new ContextDataError();
    let supersedes = null;
    if (raw.supersedes !== null) { const prior = fields(raw.supersedes, ["sourceId", "expectedRevision"]); supersedes = { sourceId: uuid(prior.sourceId), expectedRevision: integer(prior.expectedRevision, 1) }; }
    const collection = parsePublicContextCollection(raw.collection);
    if (Date.parse(collection.permissions.expiresAt) <= Date.now() + collection.limits.timeoutMs) throw new ContextDataError();
    return freeze({ schemaVersion: "1.0", kind: "context_source_collection_input", collection, supersedes });
  } catch { throw new ContextDataError(); }
}
export async function readContextCollectionInput(file: string): Promise<ContextCollectionInput> {
  try { return parseContextCollectionInput(json(await inputBytes(file, 10000))); } catch { throw new ContextDataError(); }
}
/** Explicit operation only; one native fetch, followed by one non-replayable publication attempt. */
export async function collectContextSource(store: WorkspaceStore, value: unknown, signal?: AbortSignal) {
  const input = parseContextCollectionInput(value);
  const correction = input.supersedes ? await prepareContextCaptureCorrection(store, input.collection, input.supersedes.sourceId, input.supersedes.expectedRevision) : null;
  const capture = await collectPublicContext(input.collection, signal);
  return saveCapturedContextSource(store, capture, correction, signal);
}
