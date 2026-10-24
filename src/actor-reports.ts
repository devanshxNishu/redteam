import { readFile, realpath, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { WorkspaceStore } from "./workspace.ts";
import type { ActorReport } from "./actor.ts";
import type { Artifact } from "./evidence.ts";
import { ResearchRegistry } from "./research.ts";
import type { BudgetSnapshot } from "./budget.ts";

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
      const versions = run.modelVersions ?? (await readActorReport(store, workspace, run.runId, registry)).reports.flatMap(actor => actor.model ? [{ id: actor.model.id, version: actor.model.version }] : []);
      for (const ref of versions) {
        const model = registry.model(ref.id, ref.version);
        registry.authorizeModel(model.id, model.version, model.scope, "exploratory");
      }
      return { ...run, restricted: false };
    } catch { return { ...run, decisions: [], restricted: true }; }
  }));
}
