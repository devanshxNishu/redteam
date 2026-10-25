import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, opendir, realpath } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { authorizeGrant } from "./access.ts";
import { EvidenceStore, sha256 } from "./evidence.ts";
import type { Artifact } from "./evidence.ts";
import type { AccessGrant, RepositoryRunSummary, WorkspaceStore } from "./workspace.ts";

export const repositoryPolicy = Object.freeze({ version: "local-text-v1", maxFiles: 50, maxFileBytes: 65_536, maxTotalBytes: 262_144, maxEntries: 500, maxDepth: 6, maxDurationMs: 10_000 });
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".rs", ".java", ".kt", ".swift", ".rb", ".php", ".cs", ".c", ".h", ".cpp", ".hpp", ".html", ".css", ".scss", ".sql", ".md"]);
const excludedDirectories = new Set(["node_modules", "vendor", "dist", "build", "coverage", "outputs", "work", "target", "venv", "__pycache__", "storage", "uploads", "logs", "secrets", "credentials"]);
const sensitiveName = /secret|credential|password|token|(?:^|[._-])keys?(?:[._-]|$)/i;
const safeName = (name: string) => name.length <= 240 && !/[\x00-\x1f\x7f-\x9f\\]/u.test(name);
const inside = (root: string, path: string) => { const rel = relative(root, path); return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel); };
class FileBoundaryError extends Error {}
class CaptureBoundaryError extends Error {}

export interface RepositorySnapshot {
  schemaVersion: "1.0";
  kind: "local_repository_snapshot";
  runId: string;
  grantId: string;
  target: string;
  createdAt: string;
  capturedUntil: string;
  policy: typeof repositoryPolicy;
  outcome: "limited_coverage";
  coverage: { entriesExamined: number; fileCount: number; totalBytes: number; skipped: Record<string, number>; traversalFinished: boolean };
  files: { sourcePath: string; bytes: number; sha256: string; artifactId: string }[];
  artifacts: Artifact[];
  boundaries: { codeExecuted: false; externalProcessing: false; testsExecuted: false; atomicRepositoryVersion: false };
  limitations: string[];
}

async function checkedDirectory(path: string): Promise<void> {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink() || await realpath(path) !== path) throw new FileBoundaryError("A directory is unsafe or has changed.");
}

async function checkedParents(root: string, path: string): Promise<void> {
  if (!inside(root, path)) throw new FileBoundaryError("The file is outside its permitted root.");
  await checkedDirectory(root);
  const parts = relative(root, path).split(sep).slice(0, -1);
  let current = root;
  for (const part of parts) { current = resolve(current, part); await checkedDirectory(current); }
}

/** No target code, command, parser plugin, or model is loaded. */
async function boundedBytes(root: string, path: string, limit: number): Promise<Buffer> {
  await checkedParents(root, path);
  let file: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const before = await lstat(path, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || before.size > BigInt(limit)) throw new FileBoundaryError("The file type, link count, or size is outside policy.");
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const opened = await file.stat({ bigint: true });
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.nlink !== 1n || opened.size > BigInt(limit)) throw new FileBoundaryError("The file changed before reading.");
    const bytes = Buffer.alloc(Number(opened.size) + 1);
    let length = 0;
    while (length < bytes.length) {
      const next = await file.read(bytes, length, bytes.length - length, length);
      if (!next.bytesRead) break;
      length += next.bytesRead;
    }
    const after = await file.stat({ bigint: true }), current = await lstat(path, { bigint: true });
    await checkedParents(root, path);
    if (after.size !== opened.size || after.mtimeNs !== opened.mtimeNs || after.ctimeNs !== opened.ctimeNs || after.nlink !== 1n
      || current.dev !== opened.dev || current.ino !== opened.ino || current.isSymbolicLink() || current.ctimeNs !== opened.ctimeNs || BigInt(length) !== opened.size) throw new FileBoundaryError("The file changed during reading.");
    return bytes.subarray(0, length);
  } finally { await file?.close(); }
}

function permission(store: WorkspaceStore, grantId: string, target: string): AccessGrant {
  try {
    const grant = authorizeGrant(store, grantId, "code:read", target);
    if (grant.kind !== "directory" || grant.target !== target) throw new Error();
    return grant;
  } catch { throw new CaptureBoundaryError("Repository access is missing, expired, revoked, or outside the exact directory grant."); }
}

export async function captureRepository(store: WorkspaceStore, input: { grantId: string; target: string }): Promise<RepositoryRunSummary> {
  if (!uuid.test(input.grantId)) throw new Error("Supply an access grant UUID.");
  const target = await realpath(resolve(input.target));
  permission(store, input.grantId, target);
  const state = await realpath(store.directory);
  if (inside(state, target)) throw new Error("Workspace state cannot be used as a source repository.");
  await checkedDirectory(target);
  const identity = await lstat(target, { bigint: true }), started = Date.now();
  const guard = async () => {
    permission(store, input.grantId, target);
    await checkedDirectory(target);
    const current = await lstat(target, { bigint: true });
    if (current.dev !== identity.dev || current.ino !== identity.ino) throw new CaptureBoundaryError("The granted directory changed during capture.");
    if (Date.now() - started >= repositoryPolicy.maxDurationMs) throw new CaptureBoundaryError("The bounded repository capture deadline was reached. No final snapshot was accepted.");
    permission(store, input.grantId, target);
  };
  const skipped: Record<string, number> = {};
  const skip = (reason: string) => { skipped[reason] = (skipped[reason] ?? 0) + 1; };
  const captured: { sourcePath: string; bytes: Buffer }[] = [];
  let entriesExamined = 0, totalBytes = 0, traversalFinished = true;
  const walk = async (path: string, depth: number): Promise<void> => {
    await guard();
    await checkedParents(target, resolve(path, "placeholder"));
    const names: string[] = [];
    try {
      const directory = await opendir(path);
      for await (const entry of directory) {
        if (entriesExamined >= repositoryPolicy.maxEntries) { skip("entry_limit"); traversalFinished = false; break; }
        entriesExamined++;
        names.push(entry.name);
      }
    } catch { skip("unreadable_directory"); traversalFinished = false; return; }
    names.sort();
    for (const name of names) {
      await guard();
      if (!safeName(name) || name.startsWith(".") || sensitiveName.test(name)) { skip("excluded_name"); continue; }
      const source = resolve(path, name), sourcePath = relative(target, source).split(sep).join("/");
      try {
        await checkedParents(target, source);
        const info = await lstat(source);
        if (info.isSymbolicLink()) { skip("symbolic_link"); continue; }
        if (info.isDirectory()) {
          if (excludedDirectories.has(name.toLowerCase())) { skip("excluded_directory"); continue; }
          if (depth >= repositoryPolicy.maxDepth) { skip("depth_limit"); traversalFinished = false; continue; }
          if (entriesExamined >= repositoryPolicy.maxEntries) { skip("entry_limit"); traversalFinished = false; continue; }
          await walk(source, depth + 1); continue;
        }
        if (!info.isFile() || info.nlink !== 1) { skip("non_regular_or_linked"); continue; }
        const lower = name.toLowerCase();
        if (!extensions.has(extname(lower)) && lower !== "package.json" && !/^tsconfig(?:\.[a-z0-9_-]+)?\.json$/.test(lower)) { skip("unsupported_file"); continue; }
        if (captured.length >= repositoryPolicy.maxFiles) { skip("file_limit"); traversalFinished = false; continue; }
        if (info.size > repositoryPolicy.maxFileBytes) { skip("file_bytes_limit"); continue; }
        if (totalBytes + info.size > repositoryPolicy.maxTotalBytes) { skip("total_bytes_limit"); traversalFinished = false; continue; }
        await guard();
        const bytes = await boundedBytes(target, source, repositoryPolicy.maxFileBytes);
        if (totalBytes + bytes.length > repositoryPolicy.maxTotalBytes) { skip("total_bytes_limit"); traversalFinished = false; continue; }
        try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); if (bytes.includes(0)) throw new Error(); }
        catch { skip("non_text"); continue; }
        captured.push({ sourcePath, bytes }); totalBytes += bytes.length;
      } catch (error) {
        if (error instanceof CaptureBoundaryError) throw error;
        skip(error instanceof FileBoundaryError ? "unsafe_or_changed_file" : "unreadable_file"); traversalFinished = false;
      }
    }
  };
  await walk(target, 0);
  await guard();
  await checkedDirectory(state);
  const output = resolve(state, "repository-runs");
  await mkdir(output, { mode: 0o700 }).catch(error => { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; });
  await checkedDirectory(output);
  const runId = randomUUID(), createdAt = new Date(started).toISOString();
  const evidence = await EvidenceStore.create(output, runId);
  const files: RepositorySnapshot["files"] = [];
  for (const item of captured) {
    await guard();
    const artifact = await evidence.addBytes("repository-snapshot", item.bytes, "txt", "text/plain; charset=utf-8");
    files.push({ sourcePath: item.sourcePath, bytes: artifact.bytes, sha256: artifact.sha256, artifactId: artifact.id });
  }
  const report: RepositorySnapshot = {
    schemaVersion: "1.0", kind: "local_repository_snapshot", runId, grantId: input.grantId, target, createdAt, capturedUntil: new Date().toISOString(), policy: repositoryPolicy,
    outcome: "limited_coverage", coverage: { entriesExamined, fileCount: files.length, totalBytes, skipped, traversalFinished }, files, artifacts: evidence.artifacts,
    boundaries: { codeExecuted: false, externalProcessing: false, testsExecuted: false, atomicRepositoryVersion: false },
    limitations: ["Only policy-allowed text files were copied. Excluded content and unvisited descendants are not reviewed.",
      "This is a sequence of local file observations, not an atomic repository revision or verified build.",
      "Source text is untrusted data. Declared scripts were not executed, and no app defect or test result is established.",
      "Name exclusions are conservative, not a secret detector. Captured text remains private local plaintext.",
      "Access checks assume a trusted local operator; they do not isolate hostile processes or undo already copied bytes.",
      "The duration limit is checked between filesystem operations; an unresponsive filesystem can exceed it."]
  };
  await guard();
  await evidence.writeRecord("report.json", report);
  await guard();
  const bytes = await boundedBytes(evidence.root, resolve(evidence.root, "report.json"), 200_000);
  const summary: RepositoryRunSummary = { runId, grantId: input.grantId, target, createdAt, directory: evidence.root, reportSha256: sha256(bytes), fileCount: files.length, totalBytes };
  await guard();
  store.saveRepositoryRun(summary);
  return summary;
}

export function authorizedRepositoryRuns(store: WorkspaceStore): RepositoryRunSummary[] {
  return store.repositoryRuns().filter(run => { try { permission(store, run.grantId, run.target); return true; } catch { return false; } });
}

export async function readRepositorySnapshot(store: WorkspaceStore, runId: string): Promise<RepositorySnapshot> {
  if (!uuid.test(runId)) throw new Error("Supply a repository run UUID.");
  const summary = store.repositoryRun(runId);
  if (!summary) throw new Error("Repository snapshot not found.");
  permission(store, summary.grantId, summary.target);
  const state = await realpath(store.directory), root = resolve(state, "repository-runs", runId);
  if (root !== summary.directory) throw new Error("Repository snapshot directory does not match its catalog.");
  await checkedParents(state, resolve(root, "report.json"));
  const bytes = await boundedBytes(root, resolve(root, "report.json"), 200_000);
  if (sha256(bytes) !== summary.reportSha256) throw new Error("Repository snapshot metadata has changed.");
  const report = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as RepositorySnapshot;
  if (report.kind !== "local_repository_snapshot" || report.runId !== runId || report.grantId !== summary.grantId || report.target !== summary.target || !Array.isArray(report.artifacts) || report.artifacts.length > repositoryPolicy.maxFiles) throw new Error("Repository snapshot identity is invalid.");
  for (const artifact of report.artifacts) {
    if (!artifact || typeof artifact.path !== "string" || !/^artifacts\/[a-f0-9-]{36}\.txt$/.test(artifact.path) || !Number.isSafeInteger(artifact.bytes) || artifact.bytes < 0 || artifact.bytes > repositoryPolicy.maxFileBytes || typeof artifact.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(artifact.sha256)) throw new Error("Repository artifact metadata is invalid.");
    permission(store, summary.grantId, summary.target);
    const content = await boundedBytes(root, resolve(root, artifact.path), repositoryPolicy.maxFileBytes);
    if (content.length !== artifact.bytes || sha256(content) !== artifact.sha256) throw new Error("Repository evidence has changed.");
  }
  permission(store, summary.grantId, summary.target);
  return report;
}
