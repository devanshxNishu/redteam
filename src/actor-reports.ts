import { lstat, readFile, realpath, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { WorkspaceStore } from "./workspace.ts";
import type { ActorReport } from "./actor.ts";
import type { Artifact } from "./evidence.ts";
import { ResearchRegistry } from "./research.ts";
import type { BudgetSnapshot } from "./budget.ts";
import type { ActorTaskSnapshot } from "./actor-task.ts";
import type { ActorAcceptance } from "./actor-execution.ts";
import { TaskStore } from "./tasks.ts";
import { sha256 } from "./evidence.ts";

export interface ActorDemoReport {
  schemaVersion: "1.0";
  kind: "scripted_actor_demo" | "model_actor_run";
  runId: string;
  generatedAt: string;
  outcome: "completed" | "limited_coverage";
  note: string;
  reports: ActorReport[];
  artifacts: Artifact[];
  integrityErrors: string[];
  budget?: BudgetSnapshot;
  task?: ActorTaskSnapshot;
  acceptance?: ActorAcceptance;
  workerOutcome?: ActorReport["outcome"];
  recovery?: { reason: "unfinished_report" | "publication_missing"; recordedAt: string; acceptedDecisionRecovered: false };
}

/** Old catalog gaps can omit model references. The durable manifest remains authoritative. */
async function recoveredModel(workspace: string, directory: string, report: ActorDemoReport): Promise<{ id: string; version: string; hash: string } | null> {
  if (!report.task) throw new Error("Recovery task is unavailable.");
  const tasks = new TaskStore(workspace);
  const task = (() => { try { return tasks.task(report.task.record.spec.id); } finally { tasks.close(); } })();
  if (task.spec.runId !== report.runId || task.spec.kind !== "actor" || task.spec.manifestHash !== report.task.record.spec.manifestHash) throw new Error("Recovery task identity changed.");
  const references = report.artifacts.filter(item => item.sha256 === task.spec.manifestHash);
  if (references.length !== 1 || !/^artifacts\/[a-f0-9-]{36}\.json$/.test(references[0]!.path)) throw new Error("Recovery manifest reference is unavailable.");
  const path = resolve(directory, references[0]!.path), canonical = await realpath(path), info = await lstat(path);
  if (canonical !== path || !info.isFile() || info.isSymbolicLink() || info.size > 2_000_000) throw new Error("Recovery manifest is not a bounded contained file.");
  const bytes = await readFile(path);
  if (sha256(bytes) !== task.spec.manifestHash) throw new Error("Recovery manifest bytes changed.");
  const manifest = JSON.parse(bytes.toString("utf8"));
  if (manifest.kind !== "configured_actor_manifest" || manifest.runId !== report.runId || manifest.taskId !== task.spec.id) throw new Error("Recovery manifest identity changed.");
  if (manifest.model === null) return null;
  if (!manifest.model || typeof manifest.model.id !== "string" || typeof manifest.model.version !== "string" || typeof manifest.model.hash !== "string" || !/^[a-f0-9]{64}$/.test(manifest.model.hash)) throw new Error("Recovery model pin is unavailable.");
  return manifest.model;
}

export async function readActorReport(store: WorkspaceStore, workspace: string, id: string, registry?: ResearchRegistry): Promise<ActorDemoReport> {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid actor run identifier.");
  const summary = store.actorRun(id);
  if (!summary) throw new Error("Actor run not found.");
  const root = await realpath(resolve(workspace, ".redteam/actor-runs"));
  const directory = await realpath(summary.directory);
  if (directory !== resolve(root, id)) throw new Error("Actor report is outside its registered run.");
  const file = await realpath(resolve(directory, "report.json"));
  if (file !== resolve(directory, "report.json") || !(await stat(file)).isFile() || (await stat(file)).size > 2_000_000) throw new Error("Actor report must be a bounded regular file in its run.");
  const report = JSON.parse(await readFile(file, "utf8")) as ActorDemoReport;
  if (report.schemaVersion !== "1.0" || !["scripted_actor_demo", "model_actor_run"].includes(report.kind) || report.runId !== id || !Array.isArray(report.reports) || !Array.isArray(report.artifacts)) throw new Error("Unrecognized actor report.");
  const research = registry ?? new ResearchRegistry(workspace);
  try {
    if (report.kind === "model_actor_run" && report.recovery) {
      const pin = await recoveredModel(workspace, directory, report);
      if (pin) {
        const model = research.model(pin.id, pin.version);
        if (model.hash !== pin.hash) throw new Error("Recovery model hash changed.");
        research.authorizeModel(model.id, model.version, model.scope, "exploratory");
      }
    }
    for (const ref of summary.modelVersions ?? []) {
      const model = research.model(ref.id, ref.version);
      research.authorizeModel(model.id, model.version, model.scope, "exploratory");
    }
    for (const actor of report.reports) if (actor.model) {
      const model = research.model(actor.model.id, actor.model.version);
      research.authorizeModel(model.id, model.version, model.scope, "exploratory");
    }
  } catch { throw new Error("Current research permissions restrict this actor report."); }
  finally { if (!registry) research.close(); }
  return report;
}

export async function authorizedActorRuns(store: WorkspaceStore, registry: ResearchRegistry, workspace: string) {
  return Promise.all(store.actorRuns().map(async run => {
    try {
      const versions = run.modelVersions?.length ? run.modelVersions : (await readActorReport(store, workspace, run.runId, registry)).reports.flatMap(actor => actor.model ? [{ id: actor.model.id, version: actor.model.version }] : []);
      for (const ref of versions) {
        const model = registry.model(ref.id, ref.version);
        registry.authorizeModel(model.id, model.version, model.scope, "exploratory");
      }
      return { ...run, restricted: false };
    } catch { return { ...run, decisions: [], restricted: true }; }
  }));
}
