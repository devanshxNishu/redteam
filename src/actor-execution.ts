import { randomUUID } from "node:crypto";
import { lstat, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { EvidenceStore, checkArtifacts } from "./evidence.ts";
import { ResearchRegistry } from "./research.ts";
import { WorkspaceStore } from "./workspace.ts";
import type { ActorRunSummary } from "./workspace.ts";
import { runActor } from "./actor.ts";
import type { ActorScenario, ActorLimits, ActorReport, InferenceAdapter } from "./actor.ts";
import type { PublicOpenAIConfiguration } from "./inference-config.ts";
import { BudgetLedger } from "./budget.ts";
import { withDurableBudget } from "./budgeted-inference.ts";
import { ActorTask, actorTaskPolicy } from "./actor-task.ts";
import { recoverConfiguredActors } from "./actor-recovery.ts";
import type { ActorTaskPolicy } from "./actor-task.ts";
import type { ActorDemoReport } from "./actor-reports.ts";

export interface ActorAcceptance { status: "accepted" | "rejected"; reason: "accepted" | "actor_incomplete" | "artifact_integrity_failed" | "task_not_accepted" }
export interface ActorExecutionOptions { signal?: AbortSignal; taskPolicy?: Partial<ActorTaskPolicy> }

export async function executeConfiguredActor(workspace: string, registry: ResearchRegistry, input: unknown, inputLimits: ActorLimits, adapter: InferenceAdapter, configuration: PublicOpenAIConfiguration, options: ActorExecutionOptions = {}) {
  if (adapter.mode !== "live_model") throw new Error("Configured runs require a declared live-model adapter. Use actors demo for scripted fixtures.");
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.values(Object.getOwnPropertyDescriptors(input)).some(item => !("value" in item))) throw new Error("Scenario input requires plain data.");
  const allowed = ["id", "actorRef", "modelId", "modelVersion", "scope", "decisionBody", "facts", "constraints", "processing"];
  if (Reflect.ownKeys(input).some(key => typeof key !== "string" || !allowed.includes(key))) throw new Error("Unsupported scenario field. The coordinator supplies run identity.");
  const runId = randomUUID();
  const scenario = { ...structuredClone(input), runId } as ActorScenario;
  if (!inputLimits || typeof inputLimits !== "object" || Array.isArray(inputLimits)
    || Object.values(Object.getOwnPropertyDescriptors(inputLimits)).some(field => !("value" in field))
    || Reflect.ownKeys(inputLimits).some(key => typeof key !== "string" || !["maxSteps", "maxReads", "maxOutputChars", "maxContextChars", "maxTotalTokens", "maxCostMicrousd", "timeoutMs"].includes(key))) throw new Error("Limits require supported plain fields.");
  const limits = structuredClone(inputLimits);
  if (!Number.isSafeInteger(limits.timeoutMs) || limits.timeoutMs < 1 || limits.timeoutMs > 300000) throw new Error("Actor timeout must be from 1 to 300000 milliseconds.");
  const policy = actorTaskPolicy(options.taskPolicy);
  await recoverConfiguredActors(workspace);
  const evidence = await EvidenceStore.create(resolve(workspace, ".redteam/actor-runs"), runId);
  const taskId = randomUUID();
  const backend: ActorReport["backend"] = { id: adapter.id, mode: adapter.mode, dataLocation: adapter.dataLocation ?? "undeclared", costBasis: adapter.costBasis ?? "adapter_declared", ...(adapter.configurationHash ? { configurationHash: adapter.configurationHash } : {}) };
  // The configuration type contains public fields only. Credentials stay in the adapter closure.
  const publicConfiguration = { provider: configuration.provider, model: configuration.model, inputUsdPerMillion: configuration.inputUsdPerMillion, outputUsdPerMillion: configuration.outputUsdPerMillion, maximumOutputTokens: configuration.maximumOutputTokens };
  let modelPin: { id: string; version: string; hash: string } | null = null;
  try { const model = registry.model(scenario.modelId, scenario.modelVersion); modelPin = { id: model.id, version: model.version, hash: model.hash }; } catch { /* The actor reports unavailable research as denied coverage. */ }
  const coordinatorDeadlineAt = new Date(Date.now() + limits.timeoutMs + policy.finalizationMs).toISOString();
  const manifest = await evidence.addBytes("coordinator", Buffer.from(JSON.stringify({ schemaVersion: "1.0", kind: "configured_actor_manifest", runId, taskId, scenario, model: modelPin, limits, backend, configuration: publicConfiguration, taskPolicy: policy, coordinatorDeadlineAt }, null, 2)), "json", "application/json");
  const task = new ActorTask(workspace, { taskId, runId, actorRef: scenario.actorRef, manifestHash: manifest.sha256, deadlineAt: coordinatorDeadlineAt, owner: randomUUID() }, policy);
  try {
    const ledger = new BudgetLedger(workspace);
    try { ledger.createRun({ runId, cap: { tokens: limits.maxTotalTokens, costMicrousd: limits.maxCostMicrousd }, verificationReserve: { tokens: 0, costMicrousd: 0 }, reportReserve: { tokens: 0, costMicrousd: 0 }, deadlineAt: new Date(Date.now() + limits.timeoutMs).toISOString() }); }
    finally { ledger.close(); }
    const signal = options.signal ? AbortSignal.any([task.signal, options.signal]) : task.signal;
    const worker = await runActor(registry, scenario, withDurableBudget(workspace, runId, taskId, adapter, task), limits, signal);
    const workerArtifact = await evidence.addBytes(`worker:${worker.id}`, Buffer.from(JSON.stringify(worker, null, 2)), "json", "application/json");
    let actor = worker;
    const acceptance: ActorAcceptance = { status: "rejected", reason: "actor_incomplete" };
    const outputErrors = await checkArtifacts(evidence.root, evidence.artifacts);
    if (worker.outcome === "completed" && outputErrors.length === 0) {
      try {
        if (!worker.model || !modelPin || worker.model.hash !== modelPin.hash) throw new Error("The worker model does not match the manifest.");
        registry.authorizeModel(worker.model.id, worker.model.version, scenario.scope, "exploratory");
        task.accept({ artifactRef: workerArtifact.id, sha256: workerArtifact.sha256 });
        acceptance.status = "accepted"; acceptance.reason = "accepted";
      } catch { acceptance.reason = "task_not_accepted"; }
    } else if (outputErrors.length) acceptance.reason = "artifact_integrity_failed";
    if (acceptance.status === "rejected") {
      if (worker.outcome === "completed") actor = { ...worker, outcome: "policy_denied", decision: null, errors: [...worker.errors, "The coordinator could not accept the worker result under its task lease, research permissions, and evidence checks."], limitations: [...worker.limitations, "The raw worker artifact contains an unaccepted candidate. It is not an accepted stakeholder decision."] };
      task.stop(actor.outcome);
    }
    const finalLedger = new BudgetLedger(workspace);
    const budget = (() => { try { finalLedger.closeRun(runId, actor.outcome); return finalLedger.snapshot(runId); } finally { finalLedger.close(); } })();
    const taskSnapshot = task.snapshot();
    await evidence.addBytes("budget-ledger", Buffer.from(JSON.stringify(budget, null, 2)), "json", "application/json");
    await evidence.addBytes("task-state", Buffer.from(JSON.stringify(taskSnapshot, null, 2)), "json", "application/json");
    const integrityErrors = await checkArtifacts(evidence.root, evidence.artifacts);
    const generatedAt = new Date().toISOString();
    let outcome: ActorRunSummary["outcome"] = acceptance.status === "accepted" && integrityErrors.length === 0 ? "completed" : "limited_coverage";
    let note = "Configured model run. Decisions are simulations; independent behavioral validity is not established. No purchase or investment is executed.";
    let publishedAcceptance = acceptance, artifactCount = evidence.artifacts.length, recoveredReport = false;
    try { await evidence.writeRecord("report.json", { schemaVersion: "1.0", kind: "model_actor_run", runId, generatedAt, outcome, note, reports: [actor], workerOutcome: worker.outcome, acceptance, budget, task: taskSnapshot, artifacts: evidence.artifacts, integrityErrors }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const file = resolve(evidence.root, "report.json"), info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 2_000_000) throw new Error("Existing actor report is not a bounded regular file.");
      const previous = JSON.parse(await readFile(file, "utf8")) as ActorDemoReport;
      if (previous.kind !== "model_actor_run" || previous.runId !== runId || previous.outcome !== "limited_coverage"
        || previous.recovery?.reason !== "unfinished_report" || previous.acceptance?.status !== "rejected"
        || !Array.isArray(previous.reports) || previous.reports.length !== 0
        || previous.task?.record.spec.manifestHash !== manifest.sha256 || previous.task.record.spec.id !== taskId
        || !Array.isArray(previous.artifacts) || (await checkArtifacts(evidence.root, previous.artifacts)).length) throw new Error("An incompatible actor report already exists.");
      // Recovery can finish while a cancelled coordinator is still closing.
      // Preserve that published report; the newer raw worker file stays diagnostic.
      outcome = "limited_coverage"; note = previous.note; publishedAcceptance = previous.acceptance;
      artifactCount = previous.artifacts.length; recoveredReport = true;
    }
    const lines = ["# redteam: Configured model run", "", note, "", `Run: ${runId}`, `Outcome: ${outcome}`, `Actor outcome: ${actor.outcome}`, `Coordinator acceptance: ${acceptance.status}`, `Task: ${taskId} (${taskSnapshot.record.state})`, `Cost basis: ${actor.backend.costBasis}`, "",
      actor.decision ? `Simulated ${actor.decision.domain} action: ${actor.decision.action}` : "No valid decision was accepted.", "", actor.decision?.rationale ?? actor.errors.join("; "), "",
      `Durable budget state: ${budget.run.state}`, `Unsettled invocations: ${budget.invocations.filter(item => ["reserved", "in_flight", "uncertain"].includes(item.state)).length}`, "",
      "This budget snapshot records report-time state. A later valid receipt can update the durable ledger; inspect it with redteam budgets show RUN_ID.", "",
      ...(actor.decision?.domain === "investor" ? actor.decision.conditions.map(condition => `- Condition: ${condition}`) : []), "",
      "## Limitations", "", ...actor.limitations.map(limitation => `- ${limitation}`), "", "## Evidence", "", ...evidence.artifacts.map(artifact => `- [${artifact.owner}](${artifact.path}): SHA-256 ${artifact.sha256}`)];
    if (!recoveredReport) await writeFile(resolve(evidence.root, "report.md"), lines.join("\n") + "\n", { flag: "wx", mode: 0o600 });
    let summary: ActorRunSummary = { runId, taskId, kind: "model_actor_run", createdAt: generatedAt, outcome, directory: evidence.root, artifacts: artifactCount,
      decisions: recoveredReport ? [{ outcome: taskSnapshot.record.state }] : actor.decision ? [{ domain: actor.decision.domain, action: actor.decision.action, outcome: actor.outcome }] : [{ outcome: actor.outcome }],
      modelVersions: actor.model ? [{ id: actor.model.id, version: actor.model.version }] : [] };
    const store = new WorkspaceStore(workspace);
    try {
      const existing = store.actorRun(runId);
      if (existing) summary = existing;
      else try { store.saveActorRun(summary); } catch (error) { const raced = store.actorRun(runId); if (!raced) throw error; summary = raced; }
    } finally { store.close(); }
    return { ...summary, note, actorOutcome: actor.outcome, workerOutcome: worker.outcome, acceptance: publishedAcceptance, usage: actor.usage, budget, task: taskSnapshot, integrityErrors, recoveredReport };
  } finally { task.close(); }
}
