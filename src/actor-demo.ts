import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ResearchRegistry } from "./research.ts";
import { EvidenceStore, sha256, checkArtifacts } from "./evidence.ts";
import { runActor } from "./actor.ts";
import type { ActorLimits, ActorScenario, InferenceAdapter } from "./actor.ts";
import type { ModelScope } from "./research.ts";
import { WorkspaceStore } from "./workspace.ts";
import type { ActorRunSummary } from "./workspace.ts";

const loadedSource = await readFile(new URL(import.meta.url));
const adapterHash = sha256(loadedSource);

export async function runActorDemo(workspace: string, registry: ResearchRegistry) {
  if (sha256(await readFile(new URL(import.meta.url))) !== adapterHash) throw new Error("Actor demo code changed after loading. Start a new process.");
  const runId = randomUUID();
  const prefix = `actor-fixture-${runId.slice(0, 8)}`;
  const limits: ActorLimits = { maxSteps: 4, maxReads: 2, maxOutputChars: 8000, maxContextChars: 30000, maxTotalTokens: 0, maxCostMicrousd: 0, timeoutMs: 3000 };
  const scenarios: ActorScenario[] = [];
  for (const domain of ["consumer", "investor"] as const) {
    const scope: ModelScope = { country: "synthetic-market", language: "en", segment: `${domain}-software-fixture`, category: "synthetic-pilot", decision: domain === "consumer" ? "fixture-purchase" : "fixture-investment" };
    const source = registry.addSource({ id: `${prefix}-${domain}-source`, kind: "synthetic_fixture", title: "Scripted actor runtime fixture", reference: `fixture:${prefix}:${domain}`, collectedAt: new Date().toISOString(),
      method: "Authored software fixture", scope, partition: "grounding", participantRefs: [`${prefix}-${domain}-synthetic-unit`], consentRef: null,
      permissions: { grounding: true, training: false, evaluation: false }, expiresAt: null, limitations: ["Not human research or behavioral validation"], content: { text: "Use permitted fixture information to exercise runtime controls." } });
    const model = registry.addModel({ id: `${prefix}-${domain}`, version: "1", domain, scope, sourceIds: [source.id], goals: ["Exercise a bounded simulated decision"], constraints: ["Use the supplied software fixture only"], knownInformation: [],
      decisionRules: ["Scripted adapter returns the authored fixture response after reading its context"], limitations: ["Draft synthetic fixture. No live model or human behavior."] });
    scenarios.push({ id: `${prefix}-${domain}-scenario`, runId, actorRef: `${prefix}-${domain}-actor`, modelId: model.id, modelVersion: model.version, scope,
      ...(domain === "investor" ? { decisionBody: "individual" as const } : {}), facts: [
        { id: `${domain}-offer`, label: "Synthetic offer", value: domain === "consumer" ? "The pilot costs 20 synthetic units." : "The synthetic startup requests 100 synthetic capital units.", kind: "app_observation", visibility: "initial" },
        { id: `${domain}-context`, label: "Synthetic decision context", value: domain === "consumer" ? "The synthetic buyer has a budget of 5 units. The offer is unaffordable in this fixture." : "The fixture mandate and capital permit this deal. Decision authority and required diligence are unknown.", kind: "scenario_fact", visibility: "on_request" },
      ] });
  }
  const adapter: InferenceAdapter = { id: "scripted-stakeholder-fixture-v1", mode: "scripted_fixture", next: async view => {
    const contextRef = `${view.model.domain}-context`;
    const context = view.observations.find(item => item.ref === contextRef);
    let action: unknown;
    if (!context) action = { type: "inspect", ref: contextRef };
    else if (view.model.domain === "consumer") action = { type: "decide", decision: {
      action: "reject", evidenceRefs: [contextRef], constraints: [{ key: "affordability", state: "unsatisfied", material: true, evidenceRefs: [contextRef] }],
      rationale: "The scripted fixture declines because its 5-unit budget cannot cover the 20-unit price.", missingInformation: [], limitations: ["Authored fixture response; not a real consumer prediction."], changeConditions: ["A different offer or budget requires a separate scenario."],
    } };
    else action = { type: "decide", decision: {
      action: "conditional_investment", evidenceRefs: [contextRef], constraints: [
        { key: "mandate", state: "satisfied", material: true, evidenceRefs: [contextRef] },
        { key: "available_capital", state: "satisfied", material: true, evidenceRefs: [contextRef] },
        { key: "decision_authority", state: "unknown", material: true, evidenceRefs: [] },
        { key: "required_diligence", state: "unknown", material: true, evidenceRefs: [] },
      ], conditions: ["Establish decision_authority", "Complete required_diligence"], rationale: "The scripted fixture keeps the decision conditional while authority and diligence are unknown.",
      missingInformation: ["Decision authority", "Required diligence outcome"], limitations: ["Authored fixture response; not investor interest or a funding commitment."], changeConditions: ["Resolve the listed conditions in a new scenario."],
    } };
    return { action, usage: { inputTokens: 0, outputTokens: 0, costMicrousd: 0 } };
  } };
  const reports = [];
  for (const scenario of scenarios) reports.push(await runActor(registry, scenario, adapter, limits));
  const store = await EvidenceStore.create(resolve(workspace, ".redteam/actor-runs"), runId);
  await store.addBytes("coordinator", Buffer.from(JSON.stringify({ scenarios, limits, adapter: { id: adapter.id, mode: adapter.mode, codeHash: adapterHash } }, null, 2)), "json", "application/json");
  for (const report of reports) await store.addBytes(report.id, Buffer.from(JSON.stringify(report, null, 2)), "json", "application/json");
  const integrityErrors = await checkArtifacts(store.root, store.artifacts);
  const document = { schemaVersion: "1.0", kind: "scripted_actor_demo", runId, generatedAt: new Date().toISOString(),
    outcome: reports.every(report => report.outcome === "completed") && integrityErrors.length === 0 ? "completed" : "limited_coverage",
    note: "Scripted adapter mechanics only. No live inference, psychology validation, purchases, or investments.", reports, artifacts: store.artifacts, integrityErrors };
  await store.writeRecord("report.json", document);
  const lines = ["# redteam: Scripted actor demonstration", "", document.note, "", `Run: ${runId}`, `Outcome: ${document.outcome}`, ""];
  for (const report of reports) lines.push(`## ${report.decision?.domain ?? "Incomplete actor"}`, "", `Outcome: ${report.outcome}`, `Simulated action: ${report.decision?.action ?? "none"}`, "", report.decision?.rationale ?? report.errors.join("; "), "",
    ...(report.decision?.domain === "investor" ? report.decision.conditions.map(condition => `- ${condition}`) : []), "");
  lines.push("## Evidence", "", ...store.artifacts.map(artifact => `- [${artifact.owner}](${artifact.path}): SHA-256 ${artifact.sha256}`), "", "These records check runtime mechanics. They do not measure demand or funding probability.");
  await writeFile(resolve(store.root, "report.md"), lines.join("\n") + "\n", { flag: "wx", mode: 0o600 });
  const summary: ActorRunSummary = { runId, kind: "scripted_actor_demo", createdAt: document.generatedAt, outcome: document.outcome as ActorRunSummary["outcome"],
    decisions: reports.map(report => ({ ...(report.decision ? { domain: report.decision.domain, action: report.decision.action } : {}), outcome: report.outcome })), directory: store.root, artifacts: store.artifacts.length };
  const workspaceStore = new WorkspaceStore(workspace);
  try { workspaceStore.saveActorRun(summary); } finally { workspaceStore.close(); }
  return { ...summary, note: document.note, integrityErrors };
}
