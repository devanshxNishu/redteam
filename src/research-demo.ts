import { randomUUID } from "node:crypto";
import { ResearchRegistry } from "./research.ts";
import type { SourceInput, ModelScope } from "./research.ts";
import { validateRegisteredDecision } from "./domain/registered-decision.ts";
import type { DecisionRecord } from "./domain/decisions.ts";

/** Scripted test data checks registry mechanics. No actor or human is sampled. */
export function runResearchDemo(registry: ResearchRegistry) {
  const prefix = `fixture-${randomUUID().slice(0, 8)}`;
  const scope: ModelScope = { country: "synthetic-market", language: "en", segment: "software-fixture", category: "synthetic-pilot", decision: "fixture-offer-choice" };
  const makeSource = (suffix: string, heldOut: boolean, action?: string): SourceInput => ({
    id: `${prefix}-${suffix}`, kind: "synthetic_fixture", title: "Synthetic registry demonstration", reference: `fixture:${prefix}:${suffix}`,
    collectedAt: new Date().toISOString(), method: "Scripted software fixture; no human observation", scope, partition: heldOut ? "held_out" : "grounding",
    participantRefs: [`${prefix}-synthetic-${suffix}`], consentRef: null,
    permissions: { grounding: !heldOut, training: false, evaluation: heldOut }, expiresAt: null,
    limitations: ["Synthetic software verification only. Not evidence about people, demand, or funding."],
    content: { text: "Scripted test record with a predefined expected action.", ...(action ? { observedAction: action } : {}) },
  });
  const grounding = registry.addSource(makeSource("grounding", false));
  const buy = registry.addSource(makeSource("case-a", true, "buy"));
  const reject = registry.addSource(makeSource("case-b", true, "reject"));
  const model = registry.addModel({ id: `${prefix}-buyer`, version: "1", domain: "consumer", scope, sourceIds: [grounding.id],
    goals: ["Exercise registry controls"], constraints: ["Use synthetic records only"], knownInformation: ["Scripted test scenario"],
    decisionRules: ["Expected actions are authored by the software fixture"], limitations: ["Draft fixture. No researched or validated behavior."] });
  const evaluation = registry.registerEvaluation({ id: `${prefix}-evaluation`, modelId: model.id, modelVersion: model.version, scope,
    cases: [{ id: "case-a", sourceId: buy.id, scenarioRef: `${prefix}-offer-a` }, { id: "case-b", sourceId: reject.id, scenarioRef: `${prefix}-offer-b` }],
    thresholds: { minimumCases: 2, minimumParticipants: 2, minimumAccuracy: 1, baselineAccuracy: 0.5, minimumLift: 0.5 },
    protocolRef: "fixture:registry-controls", outcomeHorizon: "End of the scripted software test" });
  registry.lockPredictions(evaluation.id, [{ caseId: "case-a", action: "buy" }, { caseId: "case-b", action: "reject" }]);
  const result = registry.scoreEvaluation(evaluation.id);
  const decision: DecisionRecord = {
    id: `${prefix}-decision`, runId: prefix, mode: "simulated", scenarioRef: `${prefix}-offer`, actorRef: `${prefix}-actor`,
    model: { id: model.id, version: model.version, use: "exploratory", scopeMatch: "within" }, domain: "consumer", action: "defer",
    evidenceRefs: [grounding.id], constraints: [{ key: "affordability", state: "unknown", material: true, evidenceRefs: [] }],
    rationale: "A scripted record defers while the fixture omits a budget.", missingInformation: ["No fixture budget is supplied."],
    limitations: ["Authored software fixture; no live actor or behavioral prediction."], changeConditions: ["Supply a permitted budget observation."],
  };
  const decisionValidation = validateRegisteredDecision(decision, registry, { runId: prefix, actorRef: decision.actorRef, scenarioRef: decision.scenarioRef, scope, observationRefs: [] });
  return { kind: "software_fixture", note: "Scripted expected choices, not model-generated predictions or human research.", model: { id: model.id, version: model.version, status: model.status, hash: model.hash }, evaluationId: evaluation.id, result, decision, decisionValidation };
}
