import { constants } from "node:fs";
import { lstat, open, opendir, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { sha256 } from "./evidence.ts";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const maximumBytes = 2_000_000, maximumEntries = 100, maximumArtifacts = 20;
type FileState = "readable" | "missing" | "unsafe" | "too_large" | "unreadable" | "changed_during_read";
type CheckState = "matching" | "missing" | "invalid" | "unsafe" | "too_large" | "unreadable" | "changed" | "changed_during_read" | "not_checked";
export interface DiagnosticIssue {
  code: string;
  level: "info" | "warning" | "error";
  message: string;
  action: string;
  artifactIndex?: number;
}
export interface ActorDiagnostic {
  schemaVersion: "1.0";
  kind: "actor_publication_diagnostic";
  runId: string;
  inspectedAt: string;
  readOnly: true;
  scope: "saved_publication_and_recorded_artifact_hashes";
  publication: { state: FileState | "invalid_json" | "invalid_record" | "readable_record" | "not_checked"; sha256?: string; bytes?: number };
  artifacts: { declared: number | null; checked: number; matching: number; results: { index: number; state: CheckState }[] };
  staging: { candidates: number; inventoryComplete: boolean };
  issues: DiagnosticIssue[];
  nextCommands: string[];
  limitations: string[];
}

async function directoryState(path: string): Promise<"available" | "missing" | "unsafe" | "unreadable"> {
  try {
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink() || await realpath(path) !== path) return "unsafe";
    return "available";
  } catch (error) { return (error as NodeJS.ErrnoException).code === "ENOENT" ? "missing" : "unreadable"; }
}

/** Fixed allocations bound reads even if a file grows after stat. No store is opened. */
async function readBounded(path: string): Promise<{ state: FileState; bytes?: Buffer }> {
  let file: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const before = await lstat(path, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink()) return { state: "unsafe" };
    if (before.size > BigInt(maximumBytes)) return { state: "too_large" };
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = await file.stat({ bigint: true });
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) return { state: "changed_during_read" };
    if (opened.size > BigInt(maximumBytes)) return { state: "too_large" };
    const buffer = Buffer.alloc(Number(opened.size) + 1);
    let length = 0;
    while (length < buffer.length) {
      const result = await file.read(buffer, length, buffer.length - length, length);
      if (result.bytesRead === 0) break;
      length += result.bytesRead;
    }
    const after = await file.stat({ bigint: true });
    const current = await lstat(path, { bigint: true });
    if (after.size !== opened.size || after.mtimeNs !== opened.mtimeNs || BigInt(length) !== opened.size
      || current.isSymbolicLink() || current.dev !== opened.dev || current.ino !== opened.ino || current.mtimeNs !== opened.mtimeNs) return { state: "changed_during_read" };
    return { state: "readable", bytes: buffer.subarray(0, length) };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return { state: code === "ENOENT" ? "missing" : code === "ELOOP" ? "unsafe" : "unreadable" };
  } finally { await file?.close(); }
}

async function stagingInventory(path: string): Promise<{ candidates: number; complete: boolean }> {
  let candidates = 0, entries = 0;
  try {
    const directory = await opendir(path);
    for await (const entry of directory) {
      if (++entries > maximumEntries) return { candidates, complete: false };
      if (entry.name.startsWith(".redteam-publish-") && entry.name.endsWith(".pending")) candidates++;
    }
    return { candidates, complete: true };
  } catch { return { candidates, complete: false }; }
}

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function parse(bytes: Buffer): unknown { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }

/** Local metadata inspection. It neither authorizes a report nor invokes recovery. */
export async function diagnoseActorPublication(workspace: string, runId: string): Promise<ActorDiagnostic> {
  if (!uuid.test(runId)) throw new Error("Supply an actor run UUID.");
  const result: ActorDiagnostic = {
    schemaVersion: "1.0", kind: "actor_publication_diagnostic", runId, inspectedAt: new Date().toISOString(), readOnly: true,
    scope: "saved_publication_and_recorded_artifact_hashes", publication: { state: "not_checked" },
    artifacts: { declared: null, checked: 0, matching: 0, results: [] }, staging: { candidates: 0, inventoryComplete: false }, issues: [],
    nextCommands: [`redteam tasks list ${runId}`, `redteam budgets show ${runId}`],
    limitations: ["Workspace records and files are not created, changed, repaired, or replayed. Read access can update operating-system access times.",
      "Task state, current budget, research permission, and decision acceptance are not evaluated by this command.",
      "Hash matches use the saved report's metadata. They do not authenticate that metadata or establish behavioral validity.",
      "Files can change after inspection. Staging candidates do not establish whether a writer is active or interrupted."],
  };
  const issue = (code: string, level: DiagnosticIssue["level"], message: string, action: string, index?: number) => result.issues.push({ code, level, message, action, ...(index === undefined ? {} : { artifactIndex: index }) });
  let base: string;
  try { base = await realpath(workspace); }
  catch { issue("workspace_unavailable", "error", "The workspace cannot be inspected.", "Check the current directory and local read access."); return result; }
  const state = resolve(base, ".redteam"), runs = resolve(state, "actor-runs"), root = resolve(runs, runId);
  for (const [component, path] of [["workspace_state", state], ["actor_runs", runs], ["run_directory", root]] as const) {
    const available = await directoryState(path);
    if (available !== "available") {
      issue(`${component}_${available}`, "error", "A required local directory is missing, unsafe, or unreadable.", "Check the selected workspace. Preserve existing paths and do not replace symbolic links automatically.");
      return result;
    }
  }
  const artifactRoot = resolve(root, "artifacts"), artifactDirectory = await directoryState(artifactRoot);
  const inventories = [await stagingInventory(root)];
  if (artifactDirectory === "available") inventories.push(await stagingInventory(artifactRoot));
  else issue(`artifact_directory_${artifactDirectory}`, "error", "The artifact directory is missing, unsafe, or unreadable.", "Preserve the directory and restore verified original records from a trusted copy if available.");
  result.staging = { candidates: inventories.reduce((sum, item) => sum + item.candidates, 0), inventoryComplete: artifactDirectory === "available" && inventories.every(item => item.complete) };
  if (!result.staging.inventoryComplete) issue("inventory_incomplete", "warning", "The directory inventory is incomplete or exceeds its 100-entry bound.", "Inspect the local directory separately. No staging cleanup was performed.");
  if (result.staging.candidates) issue("staging_candidates_present", "info", "Staging candidates remain outside the publication.", "Preserve these entries. A staging name cannot prove that its writer has stopped.");
  const publication = await readBounded(resolve(root, "report.json"));
  result.publication = { state: publication.state };
  if (publication.state !== "readable") {
    issue(`publication_${publication.state}`, publication.state === "missing" ? "warning" : "error", "The saved final report is missing or cannot be read within the required file boundaries.", publication.state === "missing" ? "Inspect task and budget state. Recovery will check the frozen finalization deadline and current permissions." : "Preserve the existing file. Check read access, size, and file type; do not replace it automatically.");
    if (publication.state === "missing") result.nextCommands.push(`redteam tasks recover ${runId}`);
    return result;
  }
  result.publication = { state: "readable", sha256: sha256(publication.bytes!), bytes: publication.bytes!.length };
  let document: unknown;
  try { document = parse(publication.bytes!); }
  catch {
    result.publication.state = "invalid_json";
    issue("publication_invalid_json", "error", "The final report is not valid UTF-8 JSON. It may be incomplete or altered; this inspection does not determine the cause.", "Preserve its bytes. Restore a verified original publication from a trusted copy if available. Recovery does not overwrite an existing final file.");
    return result;
  }
  if (!record(document) || document.schemaVersion !== "1.0" || typeof document.kind !== "string" || !["model_actor_run", "scripted_actor_demo"].includes(document.kind) || document.runId !== runId
    || typeof document.outcome !== "string" || !["completed", "limited_coverage"].includes(document.outcome) || !Array.isArray(document.reports) || document.reports.length > 100
    || !Array.isArray(document.artifacts) || document.artifacts.length < 1 || document.artifacts.length > maximumArtifacts) {
    result.publication.state = "invalid_record";
    issue("publication_invalid_record", "error", "The JSON does not match the supported actor report identity and structure.", "Preserve the file and compare it with the original run records. No decision or replacement report was produced.");
    return result;
  }
  result.publication.state = "readable_record"; result.artifacts.declared = document.artifacts.length;
  const ids = new Set<string>(), paths = new Set<string>();
  for (const [index, item] of document.artifacts.entries()) {
    let check: CheckState = "invalid";
    if (!record(item) || typeof item.id !== "string" || !uuid.test(item.id) || ids.has(item.id)
      || typeof item.path !== "string" || !/^artifacts\/[a-f0-9-]{36}\.[a-z]{1,10}$/.test(item.path) || paths.has(item.path)
      || typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.sha256) || typeof item.bytes !== "number" || !Number.isSafeInteger(item.bytes) || item.bytes < 0 || item.bytes > maximumBytes) {
      issue("artifact_reference_invalid", "error", "An artifact reference is invalid, duplicated, or exceeds the supported bounds.", "Compare the saved metadata with a trusted original. The reference was not followed.", index);
    } else {
      ids.add(item.id); paths.add(item.path);
      if (artifactDirectory !== "available") check = "not_checked";
      else {
        const artifact = await readBounded(resolve(root, item.path)); result.artifacts.checked++;
        check = artifact.state === "readable" ? artifact.bytes!.length === item.bytes && sha256(artifact.bytes!) === item.sha256 ? "matching" : "changed" : artifact.state;
        if (check === "matching") result.artifacts.matching++;
        else issue(`artifact_${check}`, "error", "A recorded artifact is missing, changed, unsafe, or unavailable.", "Preserve the file and compare it with a trusted original. A hash mismatch cannot establish how the file changed.", index);
      }
    }
    result.artifacts.results.push({ index, state: check });
  }
  if (Array.isArray(document.integrityErrors) && document.integrityErrors.length) issue("recorded_integrity_errors", "warning", "The saved report already records integrity errors.", "Inspect the original coordinator records under current research permission. Error bodies are not returned here.");
  return result;
}
