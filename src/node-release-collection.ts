import { collectNodeRelease, parseNodeReleaseCollection } from "./node-release-context.ts";
import type { NodeReleaseCollection } from "./node-release-context.ts";
import { prepareNodeReleaseCorrection, saveNodeReleaseSource } from "./context-sources.ts";
import { ContextDataError, fields, freeze, inputBytes, integer, json, uuid } from "./context-data.ts";
import type { WorkspaceStore } from "./workspace.ts";

export interface NodeReleaseSourceInput {
  schemaVersion: "1.0";
  kind: "node_release_source_collection_input";
  collection: NodeReleaseCollection;
  supersedes: { sourceId: string; expectedRevision: number } | null;
}
export function parseNodeReleaseSourceInput(value: unknown): NodeReleaseSourceInput {
  try {
    const raw = fields(value, ["schemaVersion", "kind", "collection", "supersedes"]);
    if (raw.schemaVersion !== "1.0" || raw.kind !== "node_release_source_collection_input") throw new ContextDataError();
    let supersedes = null;
    if (raw.supersedes !== null) { const prior = fields(raw.supersedes, ["sourceId", "expectedRevision"]); supersedes = { sourceId: uuid(prior.sourceId), expectedRevision: integer(prior.expectedRevision, 1) }; }
    const collection = parseNodeReleaseCollection(raw.collection);
    if (Date.parse(collection.permissions.expiresAt) <= Date.now() + collection.limits.timeoutMs) throw new ContextDataError();
    return freeze({ schemaVersion: "1.0", kind: "node_release_source_collection_input", collection, supersedes });
  } catch { throw new ContextDataError(); }
}
export async function readNodeReleaseSourceInput(file: string): Promise<NodeReleaseSourceInput> {
  try { return parseNodeReleaseSourceInput(json(await inputBytes(file, 10000))); } catch { throw new ContextDataError(); }
}
/** Deliberate native collection only. No retries, dynamic endpoint or automatic source replacement. */
export async function collectNodeReleaseSource(store: WorkspaceStore, value: unknown, signal?: AbortSignal) {
  const input = parseNodeReleaseSourceInput(value);
  const correction = input.supersedes ? await prepareNodeReleaseCorrection(store, input.collection, input.supersedes.sourceId, input.supersedes.expectedRevision) : null;
  const capture = await collectNodeRelease(input.collection, signal);
  return saveNodeReleaseSource(store, capture, correction, signal);
}
