import { resolve } from "node:path";
import { sha256 } from "./evidence.ts";
import { ContextDataError, recordDirectory, privateBytes, publish, freeze } from "./context-data.ts";
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
