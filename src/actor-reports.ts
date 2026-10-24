import { readFile, realpath, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { WorkspaceStore } from "./workspace.ts";
import type { ActorReport } from "./actor.ts";
import type { Artifact } from "./evidence.ts";

export interface ActorDemoReport {
  schemaVersion: "1.0";
  kind: "scripted_actor_demo";
  runId: string;
  generatedAt: string;
  outcome: "completed" | "limited_coverage";
  note: string;
  reports: ActorReport[];
  artifacts: Artifact[];
  integrityErrors: string[];
}

export async function readActorReport(store: WorkspaceStore, workspace: string, id: string): Promise<ActorDemoReport> {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid actor run identifier.");
  const summary = store.actorRun(id);
  if (!summary) throw new Error("Actor run not found.");
  const root = await realpath(resolve(workspace, ".redteam/actor-runs"));
  const directory = await realpath(summary.directory);
  if (directory !== resolve(root, id)) throw new Error("Actor report is outside its registered run.");
  const file = await realpath(resolve(directory, "report.json"));
  if (file !== resolve(directory, "report.json") || !(await stat(file)).isFile() || (await stat(file)).size > 2_000_000) throw new Error("Actor report must be a bounded regular file in its run.");
  const report = JSON.parse(await readFile(file, "utf8")) as ActorDemoReport;
  if (report.schemaVersion !== "1.0" || report.kind !== "scripted_actor_demo" || report.runId !== id || !Array.isArray(report.reports) || !Array.isArray(report.artifacts)) throw new Error("Unrecognized actor report.");
  return report;
}
