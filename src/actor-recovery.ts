import { lstat, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { EvidenceStore, checkArtifacts, sha256 } from "./evidence.ts";
import { TaskStore } from "./tasks.ts";
import type { TaskRecord } from "./tasks.ts";
import { BudgetLedger } from "./budget.ts";
import { WorkspaceStore, workspaceDirectory } from "./workspace.ts";
import type { ActorRunSummary } from "./workspace.ts";
import { recoverActorTasks } from "./actor-task.ts";
import type { ActorDemoReport } from "./actor-reports.ts";
import type { ActorReport, ActorScenario } from "./actor.ts";
import { ResearchRegistry } from "./research.ts";

export interface RecoveredActorReport { runId: string; status: "created" | "existing" | "unavailable"; reason?: "missing_or_invalid_records" | "research_restricted" | "publication_pending" }
type Candidate = { name: string; bytes: Buffer; digest: string };
type Manifest = { schemaVersion?: string; kind?: string; runId?: string; taskId?: string; model?: { id: string; version: string; hash: string } | null; scenario?: ActorScenario; coordinatorDeadlineAt?: string };
class ResearchRestricted extends Error {}

function authorizeMissingPublication(workspace: string, task: TaskRecord, manifest: Manifest): void {
  const pin = manifest.model, scenario = manifest.scenario;
  if (!task.output || !pin || typeof pin.id !== "string" || typeof pin.version !== "string" || !/^[a-f0-9]{64}$/.test(pin.hash)
    || !scenario || scenario.runId !== task.spec.runId || scenario.modelId !== pin.id || scenario.modelVersion !== pin.version
    || manifest.coordinatorDeadlineAt !== task.spec.deadlineAt) throw new Error("Completed publication recovery requires its pinned model, scenario, deadline, and seal.");
  const registry = new ResearchRegistry(workspace);
  try {
    if (registry.authorizeModel(pin.id, pin.version, scenario.scope, "exploratory").hash !== pin.hash) throw new Error("Model pin changed.");
  } catch { throw new ResearchRestricted("Current research permissions restrict publication recovery."); }
  finally { registry.close(); }
}

/** Resolve every listed artifact against the bounded, non-symlink files already read. */
function publishedArtifacts(report: ActorDemoReport, candidates: Candidate[]): Map<string, Candidate> {
  if (!Array.isArray(report.artifacts) || report.artifacts.length < 1 || report.artifacts.length > 20) throw new Error("Invalid published artifact set.");
  const found = new Map<string, Candidate>(), paths = new Set<string>();
  for (const artifact of report.artifacts) {
    const candidate = candidates.find(item => artifact.path === `artifacts/${item.name}`);
    if (!candidate || typeof artifact.id !== "string" || !/^[a-f0-9-]{36}$/.test(artifact.id) || found.has(artifact.id) || paths.has(artifact.path)
      || artifact.mediaType !== "application/json" || typeof artifact.owner !== "string" || artifact.sha256 !== candidate.digest || artifact.bytes !== candidate.bytes.length) throw new Error("Published artifact identity or bytes changed.");
    found.set(artifact.id, candidate); paths.add(artifact.path);
  }
  return found;
}

function artifactRecord(report: ActorDemoReport, found: Map<string, Candidate>, owners: string[], expected: unknown): void {
  const matches = report.artifacts.filter(item => owners.includes(item.owner));
  if (matches.length !== 1 || !isDeepStrictEqual(JSON.parse(found.get(matches[0]!.id)!.bytes.toString("utf8")), expected)) throw new Error("Published snapshot does not match its artifact.");
}

function verifyPublication(report: ActorDemoReport, candidates: Candidate[], task: TaskRecord, events: { kind: string; at: string }[]): Map<string, Candidate> {
  if (report.schemaVersion !== "1.0" || report.kind !== "model_actor_run" || report.runId !== task.spec.runId || !Array.isArray(report.reports)
    || typeof report.note !== "string" || typeof report.generatedAt !== "string" || !Number.isFinite(Date.parse(report.generatedAt))
    || !Array.isArray(report.integrityErrors) || report.integrityErrors.length !== 0
    || !isDeepStrictEqual(report.task, { record: task, events }) || report.budget?.run.runId !== task.spec.runId || report.budget.run.state !== "closed") throw new Error("Published report does not match its durable task.");
  const found = publishedArtifacts(report, candidates);
  const manifests = report.artifacts.filter(item => item.sha256 === task.spec.manifestHash);
  if (manifests.length !== 1) throw new Error("Published manifest reference is missing or ambiguous.");
  if (task.output && !report.artifacts.some(item => item.id === task.output!.artifactRef && item.sha256 === task.output!.sha256)) throw new Error("The published seal does not match the durable output.");
  artifactRecord(report, found, ["task-state", "task-state-recovered"], report.task);
  artifactRecord(report, found, ["budget-ledger", "budget-ledger-recovered"], report.budget);
  return found;
}

/** Restores a publication, never reconstructs an accepted decision from a seal. */
function recordedSummary(workspace: string, root: string, report: ActorDemoReport, found: Map<string, Candidate>, task: TaskRecord, manifest: Manifest): ActorRunSummary {
  if (report.recovery || report.artifacts.length !== 4 || report.reports.length !== 1) throw new Error("Invalid configured publication.");
  const actor = report.reports[0]!;
  const workers = report.artifacts.filter(item => item.owner === `worker:${actor.id}`);
  if (workers.length !== 1) throw new Error("The recorded worker artifact is missing.");
  const artifact = workers[0]!, worker = JSON.parse(found.get(artifact.id)!.bytes.toString("utf8")) as ActorReport;
  if (report.workerOutcome !== worker.outcome || !manifest.scenario || actor.scenarioRef !== manifest.scenario.id
    || manifest.scenario.runId !== task.spec.runId || !isDeepStrictEqual(actor.model, worker.model)) throw new Error("Published worker identity changed.");
  if (report.acceptance?.status === "accepted") {
    if (report.acceptance.reason !== "accepted" || report.outcome !== "completed" || task.state !== "completed"
      || !task.output || task.output.artifactRef !== artifact.id || task.output.sha256 !== artifact.sha256
      || !isDeepStrictEqual(actor, worker) || worker.outcome !== "completed" || !worker.decision || !worker.model
      || !isDeepStrictEqual(worker.model, manifest.model) || worker.decision.runId !== task.spec.runId
      || worker.decision.scenarioRef !== manifest.scenario.id || worker.decision.actorRef !== manifest.scenario.actorRef
      || worker.decision.model.id !== worker.model.id || worker.decision.model.version !== worker.model.version) throw new Error("No exact accepted publication exists under the completed fence.");
  } else {
    if (report.acceptance?.status !== "rejected" || report.acceptance.reason === "accepted" || report.outcome !== "limited_coverage"
      || task.state === "completed" || actor.decision !== null || actor.outcome === "completed") throw new Error("An unaccepted publication cannot carry a decision.");
    // A rejected completed candidate is deliberately redacted by the coordinator.
    if (worker.outcome !== "completed" && !isDeepStrictEqual(actor, worker)) throw new Error("The incomplete worker record changed.");
    if (worker.outcome === "completed" && (actor.outcome !== "policy_denied"
      || !isDeepStrictEqual({ ...actor, outcome: worker.outcome, decision: worker.decision, errors: worker.errors, limitations: worker.limitations }, worker))) throw new Error("The rejected candidate changed beyond coordinator redaction.");
  }
  const pin = manifest.model;
  if (pin) {
    const registry = new ResearchRegistry(workspace);
    try {
      const model = registry.authorizeModel(pin.id, pin.version, manifest.scenario.scope, "exploratory");
      if (model.hash !== pin.hash || manifest.scenario.modelId !== model.id || manifest.scenario.modelVersion !== model.version
        || (actor.model && !isDeepStrictEqual(actor.model, pin))) throw new Error("The model pin changed.");
    } catch { throw new ResearchRestricted("Current research permissions restrict publication recovery."); }
    finally { registry.close(); }
  } else if (actor.model || report.acceptance?.status === "accepted") throw new Error("The publication has no pinned model.");
  return { runId: report.runId, taskId: task.spec.id, kind: "model_actor_run", createdAt: report.generatedAt, outcome: report.outcome, directory: root, artifacts: report.artifacts.length,
    decisions: actor.decision ? [{ domain: actor.decision.domain, action: actor.decision.action, outcome: actor.outcome }] : [{ outcome: actor.outcome }],
    modelVersions: pin ? [{ id: pin.id, version: pin.version }] : [] };
}

function saveSummary(catalog: WorkspaceStore, summary: ActorRunSummary): void {
  try { catalog.saveActorRun(summary); }
  catch (error) { if (!isDeepStrictEqual(catalog.actorRun(summary.runId), summary)) throw error; }
}

async function boundedFile(path: string): Promise<Buffer> {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 2_000_000) throw new Error("Recovery requires bounded regular files.");
  return readFile(path);
}

/** Publishes recorded metadata only. It has no inference adapter or provider credentials. */
async function recoverReport(workspace: string, runId: string): Promise<RecoveredActorReport> {
  if (!/^[a-f0-9-]{36}$/.test(runId)) throw new Error("Invalid configured run identity.");
  const state = await realpath(workspaceDirectory(workspace));
  const root = resolve(state, "actor-runs", runId);
  if (await realpath(resolve(state, "actor-runs")) !== resolve(state, "actor-runs") || await realpath(root) !== root) throw new Error("Recovery run escaped its workspace.");
  const tasks = new TaskStore(workspace);
  let ledger: BudgetLedger | undefined, catalog: WorkspaceStore | undefined;
  try {
    ledger = new BudgetLedger(workspace); catalog = new WorkspaceStore(workspace);
    const records = tasks.list(runId);
    if (records.length !== 1 || records[0]!.spec.kind !== "actor" || !["completed", "interrupted", "failed", "cancelled"].includes(records[0]!.state) || !ledger.hasRun(runId)) throw new Error("No recoverable configured task.");
    const task = records[0]!;
    const artifactRoot = resolve(root, "artifacts");
    if (await realpath(artifactRoot) !== artifactRoot) throw new Error("Recovery artifact directory escaped its run.");
    const names = await readdir(artifactRoot);
    if (names.length > 20) throw new Error("Recovery artifact set exceeds its bound.");
    const candidates: Candidate[] = [];
    for (const name of names) {
      if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
      const bytes = await boundedFile(resolve(artifactRoot, name));
      candidates.push({ name, bytes, digest: sha256(bytes) });
    }
    const manifests = candidates.filter(item => item.digest === task.spec.manifestHash);
    if (manifests.length !== 1) throw new Error("The frozen manifest is missing or changed.");
    const manifest = JSON.parse(manifests[0]!.bytes.toString("utf8")) as Manifest;
    if (manifest.schemaVersion !== "1.0" || manifest.kind !== "configured_actor_manifest" || manifest.runId !== runId || manifest.taskId !== task.spec.id) throw new Error("The manifest does not match the task.");
    const reportFile = resolve(root, "report.json");
    const existing = await lstat(reportFile).catch(error => { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; });
    if (existing) {
      const report = JSON.parse((await boundedFile(reportFile)).toString("utf8")) as ActorDemoReport;
      const found = verifyPublication(report, candidates, task, tasks.events(task.spec.id));
      if (!catalog.actorRun(runId)) {
        if (report.recovery) {
          const missing = report.recovery.reason === "publication_missing";
          if (report.outcome !== "limited_coverage" || report.reports.length !== 0 || report.recovery.acceptedDecisionRecovered !== false
            || (missing ? task.state !== "completed" || report.acceptance?.status !== "unavailable" || report.acceptance.reason !== "publication_missing"
              || report.recovery.recordedAt !== report.generatedAt || Date.parse(report.recovery.recordedAt) < Date.parse(task.spec.deadlineAt)
              : report.recovery.reason !== "unfinished_report" || task.state === "completed" || report.acceptance?.status !== "rejected")) throw new Error("Invalid partial report evidence.");
          if (missing) authorizeMissingPublication(workspace, task, manifest);
          saveSummary(catalog, summary(report.generatedAt, report.artifacts.length, report.task?.record.spec.manifestHash, missing));
        } else saveSummary(catalog, recordedSummary(workspace, root, report, found, task, manifest));
      }
      return { runId, status: "existing" };
    }
    const missing = task.state === "completed";
    if (missing && Date.now() < Date.parse(task.spec.deadlineAt)) return { runId, status: "unavailable", reason: "publication_pending" };
    if (missing) authorizeMissingPublication(workspace, task, manifest);
    const evidence = new EvidenceStore(root);
    await evidence.register("coordinator-recovered", `artifacts/${manifests[0]!.name}`, "application/json");
    if (task.output) {
      const sealed = candidates.find(item => item.digest === task.output!.sha256);
      if (!sealed) throw new Error("The sealed output is missing or changed.");
      const output = await evidence.register(missing ? "sealed-worker-publication-missing" : "sealed-unaccepted-worker", `artifacts/${sealed.name}`, "application/json");
      output.id = task.output.artifactRef;
    }
    ledger.closeRun(runId, missing ? "publication_missing" : "unfinished_report");
    const budget = ledger.snapshot(runId), taskSnapshot = { record: task, events: tasks.events(task.spec.id) };
    await evidence.addBytes("budget-ledger-recovered", Buffer.from(JSON.stringify(budget, null, 2)), "json", "application/json");
    await evidence.addBytes("task-state-recovered", Buffer.from(JSON.stringify(taskSnapshot, null, 2)), "json", "application/json");
    const integrityErrors = await checkArtifacts(root, evidence.artifacts);
    if (integrityErrors.length) throw new Error("Recovered evidence failed verification.");
    const generatedAt = new Date().toISOString();
    const report: ActorDemoReport = { schemaVersion: "1.0", kind: "model_actor_run", runId, generatedAt, outcome: "limited_coverage",
      note: missing ? "The task completed, but its original JSON report publication is unavailable. This partial report preserves the recorded seal and task state. No stakeholder decision is included or reconstructed. No provider request was replayed."
        : "Recovered unfinished configured run. No accepted stakeholder decision was recovered. No provider request was replayed. Unsealed worker candidates are excluded.",
      reports: [], acceptance: missing ? { status: "unavailable", reason: "publication_missing" } : { status: "rejected", reason: "actor_incomplete" }, task: taskSnapshot, budget,
      recovery: { reason: missing ? "publication_missing" : "unfinished_report", recordedAt: generatedAt, acceptedDecisionRecovered: false }, artifacts: evidence.artifacts, integrityErrors };
    const markdown = [missing ? "# redteam: Recovered publication gap" : "# redteam: Recovered partial run", "", report.note, "", `Run: ${runId}`, `Task state: ${task.state}`,
      missing ? "Decision publication: unavailable" : `Stop reason: ${task.stopReason ?? "unknown"}`, "Outcome: limited_coverage", "",
      "No accepted decision or app defect is inferred from this interruption. Held budget amounts remain liabilities until a valid usage receipt arrives.", "", "## Evidence", "", ...evidence.artifacts.map(artifact => `- [${artifact.owner}](${artifact.path}): SHA-256 ${artifact.sha256}`), ""].join("\n");
    // JSON is the publication marker. Existing files are never overwritten.
    if (missing) authorizeMissingPublication(workspace, task, manifest);
    try { await evidence.writeRecord("report.json", report); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") return recoverReport(workspace, runId); throw error; }
    // Only the JSON winner writes the presentation. A recovery that loses to
    // the original coordinator must not claim its Markdown filename first.
    await writeFile(resolve(root, "report.md"), markdown, { flag: "wx", mode: 0o600 }).catch(error => { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; });
    if (missing) authorizeMissingPublication(workspace, task, manifest);
    saveSummary(catalog, summary(generatedAt, evidence.artifacts.length, task.spec.manifestHash, missing));
    return { runId, status: "created" };

    function summary(createdAt: string, artifacts: number, manifestHash?: string, missing = false): ActorRunSummary {
      // The verified manifest provides model identity even when no actor result survived.
      const model = manifest.model;
      const versions = model && typeof model.id === "string" && typeof model.version === "string" && typeof model.hash === "string" && /^[a-f0-9]{64}$/.test(model.hash)
        ? [{ id: model.id, version: model.version }] : [];
      if (manifestHash !== task.spec.manifestHash) throw new Error("Recovery manifest identity changed.");
      return { runId, taskId: task.spec.id, kind: "model_actor_run", createdAt, outcome: "limited_coverage", directory: root, artifacts, decisions: [{ outcome: missing ? "publication_missing" : task.state }], modelVersions: versions };
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
    candidates = [...new Set(tasks.list(runId).filter(task => task.spec.kind === "actor" && ["completed", "interrupted", "failed", "cancelled"].includes(task.state) && !catalog!.actorRun(task.spec.runId)).map(task => task.spec.runId))];
  } finally { tasks.close(); catalog?.close(); }
  const reports: RecoveredActorReport[] = [];
  for (const id of candidates) {
    try { reports.push(await recoverReport(workspace, id)); }
    catch (error) { reports.push({ runId: id, status: "unavailable", reason: error instanceof ResearchRestricted ? "research_restricted" : "missing_or_invalid_records" }); }
  }
  return { ...recovered, reports };
}
