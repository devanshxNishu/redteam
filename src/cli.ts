#!/usr/bin/env node
import { readFile, stat, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runStudy } from "./runner.ts";
import { checkArtifacts } from "./evidence.ts";
import type { Artifact } from "./evidence.ts";
import { WorkspaceStore } from "./workspace.ts";
import type { ReviewJob } from "./workspace.ts";
import { grantAccess } from "./access.ts";
import { createLocalServer } from "./server.ts";
import { ReviewService } from "./review-service.ts";
import { ResearchRegistry } from "./research.ts";
import { runResearchDemo } from "./research-demo.ts";
import { runActorDemo } from "./actor-demo.ts";
import { authorizedActorRuns } from "./actor-reports.ts";
import { configureInference } from "./inference-config.ts";
import { executeConfiguredActor } from "./actor-execution.ts";
import type { ActorLimits } from "./actor.ts";
import { BudgetLedger } from "./budget.ts";
import { TaskStore } from "./tasks.ts";
import { recoverConfiguredActors } from "./actor-recovery.ts";
import { diagnoseActorPublication } from "./actor-diagnostics.ts";
import { captureRepository, authorizedRepositoryRuns, readRepositorySnapshot } from "./repository.ts";
import { registerEngineeringObservations, authorizedEngineeringRuns, readEngineeringReport } from "./engineering.ts";
import { createTrackedAction, readTrackedAction, updateTrackedAction, authorizedActionSummaries } from "./actions.ts";
import { createStoredComparison, readStoredComparison, comparisonSummaries } from "./comparisons.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspace = resolve(process.cwd());
const help = `redteam — evidence-first app review

redteam ui [--port 4317]
redteam review --demo broken|fixed
redteam runs list
redteam access grant --target ORIGIN [--name NAME] [--allow browser:read,browser:interact] [--session FILE] [--hours 24]
redteam access grant --path DIRECTORY [--name NAME] [--allow code:read,code:test]
redteam access list
redteam access revoke GRANT_ID
redteam code snapshot --grant GRANT_ID --path DIRECTORY
redteam code list
redteam code show RUN_ID
redteam code observations add FILE
redteam code observations list
redteam code observations show RUN_ID
redteam actions add FILE
redteam actions list
redteam actions show ACTION_ID
redteam actions update ACTION_ID FILE
redteam comparisons create --baseline REVIEW_ID --candidate REVIEW_ID
redteam comparisons list
redteam comparisons show COMPARISON_ID
redteam verify RUN_DIRECTORY
redteam research demo
redteam research sources|models
redteam research source add FILE
redteam research source revoke SOURCE_ID --reason TEXT
redteam research model add FILE
redteam research model ground MODEL_ID VERSION
redteam research evaluation register FILE
redteam research evaluation lock EVALUATION_ID FILE
redteam research evaluation score EVALUATION_ID
redteam actors demo
redteam actors list
redteam actors diagnose RUN_ID
redteam actors run --scenario FILE --limits FILE --config FILE
redteam budgets show RUN_ID
redteam tasks list [RUN_ID]
redteam tasks show TASK_ID
redteam tasks cancel TASK_ID
redteam tasks recover RUN_ID
redteam demo [--variant broken|fixed]
redteam --version
redteam examples

State is saved in .redteam under the current directory.
The browser runner supports the controlled signup demo. Code snapshots copy bounded permitted local text only. Grants do not start actions, run source code, or authorize external model processing.`;

function flags(args: string[], allowed: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]!;
    const value = args[index + 1];
    if (!allowed.includes(key) || key in result || !value || value.startsWith("--")) throw new Error(`Invalid option ${key}. Run redteam --help.`);
    result[key] = value;
  }
  return result;
}

interface Daemon { origin: string; token: string }
async function daemon(): Promise<Daemon | null> {
  try {
    const data = JSON.parse(await readFile(resolve(workspace, ".redteam/daemon.json"), "utf8")) as Daemon;
    const url = new URL(data.origin);
    if (url.hostname !== "127.0.0.1" || url.protocol !== "http:" || url.origin !== data.origin || !/^[a-f0-9]{64}$/.test(data.token)) return null;
    const response = await fetch(`${data.origin}/api/workspace`, { headers: { Authorization: `Bearer ${data.token}` }, signal: AbortSignal.timeout(1500) });
    const state = await response.json() as { workspace?: string };
    return response.ok && state.workspace === workspace ? data : null;
  } catch { return null; }
}

function print(value: unknown): void { console.log(JSON.stringify(value, null, 2)); }

async function readInput(file: string): Promise<unknown> {
  const path = resolve(file);
  const info = await stat(path);
  if (!info.isFile() || info.size > 2_000_000) throw new Error("Input must be a regular JSON file no larger than 2 MB.");
  try { return JSON.parse(await readFile(path, "utf8")) as unknown; }
  catch { throw new Error("Input file must contain valid JSON."); }
}

async function runReview(variant: "broken" | "fixed"): Promise<void> {
  const connection = await daemon();
  let job: ReviewJob;
  if (connection) {
    const headers = { Authorization: `Bearer ${connection.token}`, "Content-Type": "application/json" };
    const response = await fetch(`${connection.origin}/api/reviews`, { method: "POST", headers, body: JSON.stringify({ variant }) });
    if (!response.ok) throw new Error("The local service could not queue the review.");
    job = await response.json() as ReviewJob;
    const deadline = Date.now() + 90_000;
    while (["queued", "running", "verifying", "reporting"].includes(job.status)) {
      if (Date.now() >= deadline) throw new Error(`Review ${job.id} is still active. Use redteam runs list to check it.`);
      await new Promise(accept => setTimeout(accept, 500));
      const stateResponse = await fetch(`${connection.origin}/api/workspace`, { headers });
      if (!stateResponse.ok) throw new Error("The local service connection ended. Check redteam runs list.");
      const state = await stateResponse.json() as { jobs: ReviewJob[] };
      const current = state.jobs.find(item => item.id === job.id);
      if (!current) throw new Error("The review is missing from the local service.");
      job = current;
    }
  } else {
    const store = new WorkspaceStore(workspace);
    let reviews: ReviewService | undefined;
    try {
      reviews = new ReviewService(store, workspace, root);
      job = reviews.submit(variant);
      await reviews.stop();
      job = store.job(job.id)!;
    } finally { if (reviews) await reviews.stop(); store.close(); }
  }
  print(job);
  if (job.status !== "completed") process.exitCode = 1;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "--help" || command === "help") { console.log(help); return; }
  if (command === "--version") { console.log((JSON.parse(await readFile(resolve(root, "package.json"), "utf8")) as { version: string }).version); return; }
  if (command === "examples") { if (args.length) throw new Error("Usage: redteam examples"); console.log(resolve(root, "examples")); return; }
  if (command === "ui") {
    const options = flags(args, ["--port"]);
    const port = Number(options["--port"] ?? 4317);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Port must be an integer from 0 to 65535.");
    const existing = await daemon();
    if (existing) { console.log(`Redteam is running at ${existing.origin}`); return; }
    const server = await createLocalServer({ workspace, assetsRoot: root, port });
    const metadata = resolve(workspace, ".redteam/daemon.json");
    try { await writeFile(metadata, JSON.stringify({ origin: server.origin, token: server.token }), { mode: 0o600 }); }
    catch (error) { await server.close(); throw error; }
    console.log(`Redteam is running at ${server.origin}\nWorkspace: ${workspace}\nPress Ctrl+C to stop.`);
    let closing = false;
    const close = () => {
      if (closing) return;
      closing = true;
      void server.close().then(() => unlink(metadata).catch(() => {})).catch(error => { console.error(error instanceof Error ? error.message : "Shutdown failed."); process.exitCode = 1; });
    };
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
    return;
  }
  if (command === "review") {
    const options = flags(args, ["--demo"]);
    if (!["broken", "fixed"].includes(options["--demo"] ?? "")) throw new Error("Usage: redteam review --demo broken|fixed");
    await runReview(options["--demo"] as "broken" | "fixed");
    return;
  }
  if (command === "runs") {
    if (args.length !== 1 || args[0] !== "list") throw new Error("Usage: redteam runs list");
    const store = new WorkspaceStore(workspace);
    try { print(store.jobs()); } finally { store.close(); }
    return;
  }
  if (command === "budgets") {
    if (args.length !== 2 || args[0] !== "show") throw new Error("Usage: redteam budgets show RUN_ID");
    const ledger = new BudgetLedger(workspace);
    try { print({ ...ledger.snapshot(args[1]!), events: ledger.events(args[1]!) }); } finally { ledger.close(); }
    return;
  }
  if (command === "tasks") {
    if (args[0] === "recover" && args.length === 2) { print(await recoverConfiguredActors(workspace, args[1]!)); return; }
    const tasks = new TaskStore(workspace);
    try {
      if (args[0] === "list" && (args.length === 1 || args.length === 2)) print(tasks.list(args[1]));
      else if (args[0] === "show" && args.length === 2) print({ record: tasks.task(args[1]!), events: tasks.events(args[1]!) });
      else if (args[0] === "cancel" && args.length === 2) { tasks.cancel(args[1]!); print(tasks.task(args[1]!)); }
      else throw new Error("Usage: redteam tasks list [RUN_ID]|show TASK_ID|cancel TASK_ID|recover RUN_ID");
    } finally { tasks.close(); }
    return;
  }
  if (command === "research") {
    const registry = new ResearchRegistry(workspace);
    const load = async (file: string | undefined): Promise<unknown> => {
      if (!file) throw new Error("Supply a JSON file.");
      try { return await readInput(file); }
      catch { throw new Error("Input file must contain valid JSON."); }
    };
    try {
      if (args.length === 1 && args[0] === "demo") print(runResearchDemo(registry));
      else if (args.length === 1 && args[0] === "sources") print(registry.sources());
      else if (args.length === 1 && args[0] === "models") print(registry.summary().models);
      else if (args.length === 3 && args[0] === "source" && args[1] === "add") print(registry.addSource(await load(args[2])));
      else if (args.length >= 3 && args[0] === "source" && args[1] === "revoke") {
        const options = flags(args.slice(3), ["--reason"]);
        if (!options["--reason"]) throw new Error("Supply --reason for the source withdrawal.");
        registry.revokeSource(args[2]!, options["--reason"]); print({ id: args[2], revoked: true });
      } else if (args.length === 3 && args[0] === "model" && args[1] === "add") print(registry.addModel(await load(args[2])));
      else if (args.length === 4 && args[0] === "model" && args[1] === "ground") print(registry.groundModel(args[2]!, args[3]!));
      else if (args.length === 3 && args[0] === "evaluation" && args[1] === "register") print(registry.registerEvaluation(await load(args[2])));
      else if (args.length === 4 && args[0] === "evaluation" && args[1] === "lock") print(registry.lockPredictions(args[2]!, await load(args[3])));
      else if (args.length === 3 && args[0] === "evaluation" && args[1] === "score") print(registry.scoreEvaluation(args[2]!));
      else throw new Error("Unknown research command. Run redteam --help.");
    } finally { registry.close(); }
    return;
  }
  if (command === "actors") {
    if (args[0] === "diagnose" && args.length === 2) {
      const diagnostic = await diagnoseActorPublication(workspace, args[1]!); print(diagnostic);
      if (diagnostic.issues.some(issue => issue.level === "error")) process.exitCode = 1;
      return;
    }
    if (args[0] === "run") {
      const options = flags(args.slice(1), ["--scenario", "--limits", "--config"]);
      if (!options["--scenario"] || !options["--limits"] || !options["--config"]) throw new Error("Supply --scenario, --limits, and --config JSON files.");
      const { adapter, configuration } = configureInference(await readInput(options["--config"]), process.env.OPENAI_API_KEY);
      const scenario = await readInput(options["--scenario"]);
      const limits = await readInput(options["--limits"]) as ActorLimits;
      const registry = new ResearchRegistry(workspace);
      const controller = new AbortController();
      const cancel = () => controller.abort();
      process.once("SIGINT", cancel); process.once("SIGTERM", cancel);
      try { const result = await executeConfiguredActor(workspace, registry, scenario, limits, adapter, configuration, { signal: controller.signal }); print(result); if (result.outcome !== "completed") process.exitCode = 1; }
      finally { process.removeListener("SIGINT", cancel); process.removeListener("SIGTERM", cancel); registry.close(); }
      return;
    }
    if (args.length === 1 && args[0] === "list") {
      const store = new WorkspaceStore(workspace);
      let research: ResearchRegistry | undefined;
      try { research = new ResearchRegistry(workspace); print(await authorizedActorRuns(store, research, workspace)); }
      finally { research?.close(); store.close(); }
      return;
    }
    if (args.length !== 1 || args[0] !== "demo") throw new Error("Usage: redteam actors demo|list|run|diagnose RUN_ID");
    const registry = new ResearchRegistry(workspace);
    try {
      const result = await runActorDemo(workspace, registry);
      print(result); if (result.outcome !== "completed") process.exitCode = 1;
    } finally { registry.close(); }
    return;
  }
  if (command === "access") {
    const [operation, ...rest] = args;
    const store = new WorkspaceStore(workspace);
    try {
      if (operation === "list" && rest.length === 0) print(store.grants());
      else if (operation === "revoke" && rest.length === 1) print(store.revokeGrant(rest[0]!));
      else if (operation === "grant") {
        const options = flags(rest, ["--target", "--path", "--name", "--allow", "--session", "--hours"]);
        if (Boolean(options["--target"]) === Boolean(options["--path"])) throw new Error("Supply exactly one --target web origin or --path directory.");
        const kind = options["--path"] ? "directory" : "web";
        let storageState: unknown;
        if (options["--session"]) {
          try { storageState = await readInput(options["--session"]); }
          catch { throw new Error("Session file must contain valid Playwright storage-state JSON."); }
        }
        print(grantAccess(store, { name: options["--name"] ?? (kind === "web" ? "Web app" : "Local project"), kind,
          target: (options["--target"] ?? options["--path"])!,
          capabilities: (options["--allow"] ?? (kind === "web" ? "browser:read,browser:interact" : "code:read")).split(","),
          ...(options["--hours"] !== undefined ? { expiresInHours: Number(options["--hours"]) } : {}),
          ...(storageState !== undefined ? { storageState } : {}),
        }));
      } else throw new Error("Usage: redteam access grant|list|revoke. Run redteam --help.");
    } finally { store.close(); }
    return;
  }
  if (command === "code") {
    const [operation, ...rest] = args;
    if (operation === "observations") {
      const [action, parameter, ...extra] = rest;
      if (extra.length || !["add", "list", "show"].includes(action ?? "") || (action === "list" ? parameter !== undefined : !parameter)) throw new Error("Usage: redteam code observations add FILE|list|show RUN_ID");
      const value = action === "add" ? await readInput(parameter!) : undefined;
      const store = new WorkspaceStore(workspace);
      try {
        if (action === "add") print(await registerEngineeringObservations(store, value));
        else if (action === "list") print(authorizedEngineeringRuns(store));
        else print(await readEngineeringReport(store, parameter!));
      } finally { store.close(); }
      return;
    }
    if (operation !== "snapshot" && operation !== "list" && operation !== "show") throw new Error("Usage: redteam code snapshot|list|show. Run redteam --help.");
    const options = operation === "snapshot" ? flags(rest, ["--grant", "--path"]) : {};
    if (operation === "snapshot" && (!options["--grant"] || !options["--path"])) throw new Error("Supply --grant GRANT_ID and --path DIRECTORY.");
    if ((operation === "list" && rest.length) || (operation === "show" && rest.length !== 1)) throw new Error("Usage: redteam code list|show RUN_ID");
    const store = new WorkspaceStore(workspace);
    try {
      if (operation === "snapshot") print(await captureRepository(store, { grantId: options["--grant"]!, target: options["--path"]! }));
      else if (operation === "list") print(authorizedRepositoryRuns(store));
      else print(await readRepositorySnapshot(store, rest[0]!));
    } finally { store.close(); }
    return;
  }
  if (command === "comparisons") {
    const [operation, ...rest] = args;
    if (!["create", "list", "show"].includes(operation ?? "") || (operation === "list" && rest.length) || (operation === "show" && rest.length !== 1)) throw new Error("Usage: redteam comparisons create --baseline REVIEW_ID --candidate REVIEW_ID|list|show COMPARISON_ID");
    const options = operation === "create" ? flags(rest, ["--baseline", "--candidate"]) : {};
    if (operation === "create" && (!options["--baseline"] || !options["--candidate"])) throw new Error("Supply --baseline REVIEW_ID and --candidate REVIEW_ID.");
    const store = new WorkspaceStore(workspace);
    try {
      if (operation === "create") {
        const result = await createStoredComparison(store, { baselineReviewId: options["--baseline"], candidateReviewId: options["--candidate"] });
        print(result); if (result.outcome === "not_comparable") process.exitCode = 1;
      } else if (operation === "list") print({ recentWindow: 100, comparisons: comparisonSummaries(store) });
      else print(await readStoredComparison(store, rest[0]!));
    } finally { store.close(); }
    return;
  }
  if (command === "actions") {
    const [operation, id, file, ...extra] = args;
    if (extra.length || !["add", "list", "show", "update"].includes(operation ?? "") || (operation === "list" ? id !== undefined : !id) || (operation === "update" ? !file : file !== undefined)) throw new Error("Usage: redteam actions add FILE|list|show ACTION_ID|update ACTION_ID FILE");
    const value = operation === "add" ? await readInput(id!) : operation === "update" ? await readInput(file!) : undefined;
    const store = new WorkspaceStore(workspace);
    try {
      if (operation === "add") print(await createTrackedAction(store, value));
      else if (operation === "list") print({ recentWindow: 100, actions: authorizedActionSummaries(store) });
      else if (operation === "show") print(await readTrackedAction(store, id!));
      else print(await updateTrackedAction(store, id!, value));
    } finally { store.close(); }
    return;
  }
  if (command === "demo") {
    const options = flags(args, ["--variant"]);
    if (options["--variant"] && !["broken", "fixed"].includes(options["--variant"])) throw new Error("Choose broken or fixed.");
    const variant = options["--variant"] === "fixed" ? "fixed" : "broken";
    const study = JSON.parse(await readFile(resolve(root, "examples/pilot-signup.study.json"), "utf8")) as unknown;
    const { report, directory } = await runStudy(study, { projectRoot: root, outputRoot: resolve(workspace, "outputs/runs"), variant });
    print({ runId: report.runId, outcome: report.outcome, findings: report.findings.map(finding => ({ status: finding.status, title: finding.title })), report: resolve(directory, "report.md") });
    if (report.outcome === "limited_coverage") process.exitCode = 1;
    return;
  }
  if (command === "verify") {
    if (args.length !== 1) throw new Error("Usage: redteam verify RUN_DIRECTORY");
    const directory = resolve(args[0]!);
    const report = JSON.parse(await readFile(resolve(directory, "report.json"), "utf8")) as { artifacts?: unknown };
    if (!Array.isArray(report.artifacts) || report.artifacts.length === 0) throw new Error("Report has no artifact manifest.");
    for (const item of report.artifacts) {
      if (!item || typeof item !== "object" || typeof item.path !== "string" || typeof item.sha256 !== "string" || !Number.isSafeInteger(item.bytes)) throw new Error("Invalid artifact metadata.");
    }
    const errors = await checkArtifacts(directory, report.artifacts as Artifact[]);
    print({ artifacts: report.artifacts.length, valid: errors.length === 0, errors });
    if (errors.length) process.exitCode = 1;
    return;
  }
  throw new Error("Unknown command. Run redteam --help.");
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
