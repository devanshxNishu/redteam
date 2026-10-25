import { lstat, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { EvidenceStore, checkArtifacts, sha256 } from "./evidence.ts";
import { TaskStore } from "./tasks.ts";
import { BudgetLedger } from "./budget.ts";
import { WorkspaceStore, workspaceDirectory } from "./workspace.ts";
import type { ActorRunSummary } from "./workspace.ts";
import { recoverActorTasks } from "./actor-task.ts";
import type { ActorDemoReport } from "./actor-reports.ts";

export interface RecoveredActorReport { runId: string; status: "created" | "existing" | "unavailable"; reason?: "missing_or_invalid_records" }

async function boundedFile(path: string): Promise<Buffer> {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 2_000_000) throw new Error("Recovery requires bounded regular files.");
  return readFile(path);
}

/** Publishes recorded metadata only. It has no inference adapter or provider credentials. */
async function publishPartialReport(workspace: string, runId: string): Promise<RecoveredActorReport> {
  if (!/^[a-f0-9-]{36}$/.test(runId)) throw new Error("Invalid configured run identity.");
  const state = await realpath(workspaceDirectory(workspace));
  const root = resolve(state, "actor-runs", runId);
  if (await realpath(resolve(state, "actor-runs")) !== resolve(state, "actor-runs") || await realpath(root) !== root) throw new Error("Recovery run escaped its workspace.");
  const tasks = new TaskStore(workspace);
  let ledger: BudgetLedger | undefined, catalog: WorkspaceStore | undefined;
  try {
    ledger = new BudgetLedger(workspace); catalog = new WorkspaceStore(workspace);
    const records = tasks.list(runId);
    if (records.length !== 1 || !["interrupted", "failed", "cancelled"].includes(records[0]!.state) || !ledger.hasRun(runId)) throw new Error("No recoverable configured task.");
    const task = records[0]!;
    const artifactRoot = resolve(root, "artifacts");
    if (await realpath(artifactRoot) !== artifactRoot) throw new Error("Recovery artifact directory escaped its run.");
    const names = await readdir(artifactRoot);
    if (names.length > 20) throw new Error("Recovery artifact set exceeds its bound.");
    const candidates: { name: string; bytes: Buffer; digest: string }[] = [];
    for (const name of names) {
      if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
      const bytes = await boundedFile(resolve(artifactRoot, name));
      candidates.push({ name, bytes, digest: sha256(bytes) });
    }
    const manifests = candidates.filter(item => item.digest === task.spec.manifestHash);
    if (manifests.length !== 1) throw new Error("The frozen manifest is missing or changed.");
    const manifest = JSON.parse(manifests[0]!.bytes.toString("utf8")) as { schemaVersion?: string; kind?: string; runId?: string; taskId?: string; model?: { id?: string; version?: string; hash?: string } | null };
    if (manifest.schemaVersion !== "1.0" || manifest.kind !== "configured_actor_manifest" || manifest.runId !== runId || manifest.taskId !== task.spec.id) throw new Error("The manifest does not match the task.");
    const reportFile = resolve(root, "report.json");
    const existing = await lstat(reportFile).catch(error => { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; });
    if (existing) {
      const report = JSON.parse((await boundedFile(reportFile)).toString("utf8")) as ActorDemoReport;
      if (report.runId !== runId || report.kind !== "model_actor_run") throw new Error("Invalid existing recovery report.");
      if (!catalog.actorRun(runId) && report.recovery?.reason === "unfinished_report") {
        if (report.outcome !== "limited_coverage" || report.reports.length !== 0 || (await checkArtifacts(root, report.artifacts)).length) throw new Error("Invalid partial report evidence.");
        catalog.saveActorRun(summary(report.generatedAt, report.artifacts.length, report.task?.record.spec.manifestHash));
      }
      return { runId, status: "existing" };
    }
    const evidence = new EvidenceStore(root);
    await evidence.register("coordinator-recovered", `artifacts/${manifests[0]!.name}`, "application/json");
    if (task.output) {
      const sealed = candidates.find(item => item.digest === task.output!.sha256);
      if (!sealed) throw new Error("The sealed output is missing or changed.");
      const output = await evidence.register("sealed-unaccepted-worker", `artifacts/${sealed.name}`, "application/json");
      output.id = task.output.artifactRef;
    }
    ledger.closeRun(runId, "unfinished_report");
    const budget = ledger.snapshot(runId), taskSnapshot = { record: task, events: tasks.events(task.spec.id) };
    await evidence.addBytes("budget-ledger-recovered", Buffer.from(JSON.stringify(budget, null, 2)), "json", "application/json");
    await evidence.addBytes("task-state-recovered", Buffer.from(JSON.stringify(taskSnapshot, null, 2)), "json", "application/json");
    const integrityErrors = await checkArtifacts(root, evidence.artifacts);
    if (integrityErrors.length) throw new Error("Recovered evidence failed verification.");
    const generatedAt = new Date().toISOString();
    const report: ActorDemoReport = { schemaVersion: "1.0", kind: "model_actor_run", runId, generatedAt, outcome: "limited_coverage",
      note: "Recovered unfinished configured run. No accepted stakeholder decision was recovered. No provider request was replayed. Unsealed worker candidates are excluded.",
      reports: [], acceptance: { status: "rejected", reason: "actor_incomplete" }, task: taskSnapshot, budget, recovery: { reason: "unfinished_report", recordedAt: generatedAt, acceptedDecisionRecovered: false }, artifacts: evidence.artifacts, integrityErrors };
    const markdown = ["# redteam: Recovered partial run", "", report.note, "", `Run: ${runId}`, `Task state: ${task.state}`, `Stop reason: ${task.stopReason ?? "unknown"}`, "Outcome: limited_coverage", "",
      "No accepted decision or app defect is inferred from this interruption. Held budget amounts remain liabilities until a valid usage receipt arrives.", "", "## Evidence", "", ...evidence.artifacts.map(artifact => `- [${artifact.owner}](${artifact.path}): SHA-256 ${artifact.sha256}`), ""].join("\n");
    // JSON is the publication marker. Existing files are never overwritten.
    await writeFile(resolve(root, "report.md"), markdown, { flag: "wx", mode: 0o600 }).catch(error => { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; });
    try { await evidence.writeRecord("report.json", report); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") return publishPartialReport(workspace, runId); throw error; }
    try { catalog.saveActorRun(summary(generatedAt, evidence.artifacts.length, task.spec.manifestHash)); }
    catch (error) { if (!catalog.actorRun(runId)) throw error; }
    return { runId, status: "created" };

    function summary(createdAt: string, artifacts: number, manifestHash?: string): ActorRunSummary {
      // The verified manifest provides model identity even when no actor result survived.
      const model = manifest.model;
      const versions = model && typeof model.id === "string" && typeof model.version === "string" && typeof model.hash === "string" && /^[a-f0-9]{64}$/.test(model.hash)
        ? [{ id: model.id, version: model.version }] : [];
      if (manifestHash !== task.spec.manifestHash) throw new Error("Recovery manifest identity changed.");
      return { runId, taskId: task.spec.id, kind: "model_actor_run", createdAt, outcome: "limited_coverage", directory: root, artifacts, decisions: [{ outcome: task.state }], modelVersions: versions };
    }
  } finally { tasks.close(); ledger?.close(); catalog?.close(); }
}

export async function recoverConfiguredActors(workspace: string, runId?: string) {
  const recovered = recoverActorTasks(workspace, runId);
  const tasks = new TaskStore(workspace);
  let catalog: WorkspaceStore | undefined;
  let candidates: string[];
  try {
    catalog = new WorkspaceStore(workspace);
    candidates = [...new Set(tasks.list(runId).filter(task => task.spec.kind === "actor" && ["interrupted", "failed", "cancelled"].includes(task.state) && !catalog!.actorRun(task.spec.runId)).map(task => task.spec.runId))];
  } finally { tasks.close(); catalog?.close(); }
  const reports: RecoveredActorReport[] = [];
  for (const id of candidates) {
    try { reports.push(await publishPartialReport(workspace, id)); }
    catch { reports.push({ runId: id, status: "unavailable", reason: "missing_or_invalid_records" }); }
  }
  return { ...recovered, reports };
}
