import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { EvidenceStore, checkArtifacts } from "./evidence.ts";
import { ResearchRegistry } from "./research.ts";
import { WorkspaceStore } from "./workspace.ts";
import type { ActorRunSummary } from "./workspace.ts";
import { runActor } from "./actor.ts";
import type { ActorScenario, ActorLimits, InferenceAdapter } from "./actor.ts";
import type { PublicOpenAIConfiguration } from "./inference-config.ts";
import { BudgetLedger } from "./budget.ts";
import { withDurableBudget } from "./budgeted-inference.ts";

export async function executeConfiguredActor(workspace: string, registry: ResearchRegistry, input: unknown, limits: ActorLimits, adapter: InferenceAdapter, configuration: PublicOpenAIConfiguration) {
  if (adapter.mode !== "live_model") throw new Error("Configured runs require a declared live-model adapter. Use actors demo for scripted fixtures.");
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.values(Object.getOwnPropertyDescriptors(input)).some(item => !("value" in item))) throw new Error("Scenario input requires plain data.");
  const allowed = ["id", "actorRef", "modelId", "modelVersion", "scope", "decisionBody", "facts", "constraints", "processing"];
  if (Reflect.ownKeys(input).some(key => typeof key !== "string" || !allowed.includes(key))) throw new Error("Unsupported scenario field. The coordinator supplies run identity.");
  const runId = randomUUID();
  const scenario = { ...structuredClone(input), runId } as ActorScenario;
  const ledger = new BudgetLedger(workspace);
  try {
    ledger.createRun({ runId, cap: { tokens: limits.maxTotalTokens, costMicrousd: limits.maxCostMicrousd }, verificationReserve: { tokens: 0, costMicrousd: 0 }, reportReserve: { tokens: 0, costMicrousd: 0 }, deadlineAt: new Date(Date.now() + limits.timeoutMs).toISOString() });
  } finally { ledger.close(); }
  const actor = await runActor(registry, scenario, withDurableBudget(workspace, runId, scenario.actorRef, adapter), limits);
  const finalLedger = new BudgetLedger(workspace);
  const budget = (() => {
    try { finalLedger.closeRun(runId, actor.outcome); return finalLedger.snapshot(runId); }
    finally { finalLedger.close(); }
  })();
  const evidence = await EvidenceStore.create(resolve(workspace, ".redteam/actor-runs"), runId);
  const backend = actor.backend;
  // The configuration type contains public fields only. Credentials stay in the adapter closure.
  const publicConfiguration = { provider: configuration.provider, model: configuration.model, inputUsdPerMillion: configuration.inputUsdPerMillion, outputUsdPerMillion: configuration.outputUsdPerMillion, maximumOutputTokens: configuration.maximumOutputTokens };
  await evidence.addBytes("coordinator", Buffer.from(JSON.stringify({ scenario, limits, backend, configuration: publicConfiguration }, null, 2)), "json", "application/json");
  await evidence.addBytes(actor.id, Buffer.from(JSON.stringify(actor, null, 2)), "json", "application/json");
  await evidence.addBytes("budget-ledger", Buffer.from(JSON.stringify(budget, null, 2)), "json", "application/json");
  const integrityErrors = await checkArtifacts(evidence.root, evidence.artifacts);
  const generatedAt = new Date().toISOString();
  const outcome: ActorRunSummary["outcome"] = actor.outcome === "completed" && integrityErrors.length === 0 ? "completed" : "limited_coverage";
  const note = "Configured model run. Decisions are simulations; independent behavioral validity is not established. No purchase or investment is executed.";
  await evidence.writeRecord("report.json", { schemaVersion: "1.0", kind: "model_actor_run", runId, generatedAt, outcome, note, reports: [actor], budget, artifacts: evidence.artifacts, integrityErrors });
  const lines = ["# redteam: Configured model run", "", note, "", `Run: ${runId}`, `Outcome: ${outcome}`, `Actor outcome: ${actor.outcome}`, `Cost basis: ${actor.backend.costBasis}`, "",
    actor.decision ? `Simulated ${actor.decision.domain} action: ${actor.decision.action}` : "No valid decision was accepted.", "", actor.decision?.rationale ?? actor.errors.join("; "), "",
    `Durable budget state: ${budget.run.state}`, `Unsettled invocations: ${budget.invocations.filter(item => ["reserved", "in_flight", "uncertain"].includes(item.state)).length}`, "",
    "This budget snapshot records report-time state. A later valid receipt can update the durable ledger; inspect it with redteam budgets show RUN_ID.", "",
    ...(actor.decision?.domain === "investor" ? actor.decision.conditions.map(condition => `- Condition: ${condition}`) : []), "",
    "## Limitations", "", ...actor.limitations.map(limitation => `- ${limitation}`), "", "## Evidence", "", ...evidence.artifacts.map(artifact => `- [${artifact.owner}](${artifact.path}): SHA-256 ${artifact.sha256}`)];
  await writeFile(resolve(evidence.root, "report.md"), lines.join("\n") + "\n", { flag: "wx", mode: 0o600 });
  const summary: ActorRunSummary = { runId, kind: "model_actor_run", createdAt: generatedAt, outcome, directory: evidence.root, artifacts: evidence.artifacts.length,
    decisions: actor.decision ? [{ domain: actor.decision.domain, action: actor.decision.action, outcome: actor.outcome }] : [{ outcome: actor.outcome }],
    modelVersions: actor.model ? [{ id: actor.model.id, version: actor.model.version }] : [] };
  const store = new WorkspaceStore(workspace);
  try { store.saveActorRun(summary); } finally { store.close(); }
  return { ...summary, note, actorOutcome: actor.outcome, usage: actor.usage, budget, integrityErrors };
}
