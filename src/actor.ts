import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { ResearchRegistry } from "./research.ts";
import type { ModelScope, RegisteredModel } from "./research.ts";
import { validateRegisteredDecision } from "./domain/registered-decision.ts";
import type { DecisionRecord } from "./domain/decisions.ts";
import { withinDeadline } from "./deadline.ts";
import { LimitError } from "./policy.ts";

export interface ActorFact {
  id: string;
  label: string;
  value: string;
  kind: "scenario_fact" | "app_observation";
  visibility: "initial" | "on_request";
}
export interface ActorScenario {
  id: string;
  runId: string;
  actorRef: string;
  modelId: string;
  modelVersion: string;
  scope: ModelScope;
  decisionBody?: "individual" | "committee";
  facts: ActorFact[];
}
export interface ActorLimits {
  maxSteps: number;
  maxReads: number;
  maxOutputChars: number;
  maxContextChars: number;
  maxTotalTokens: number;
  maxCostMicrousd: number;
  timeoutMs: number;
}
export interface AdapterView {
  model: RegisteredModel;
  scenario: { id: string; actorRef: string; scope: ModelScope; decisionBody: "individual" | "committee" | null };
  availableReads: { ref: string; label: string; kind: "research_source" | ActorFact["kind"] }[];
  observations: { ref: string; value: string; kind: "research_source" | ActorFact["kind"] }[];
}
export interface AdapterRequest {
  signal: AbortSignal;
  maximumOutputChars: number;
  remainingTokens: number;
  maximumCostMicrousd: number;
}
export interface InferenceAdapter {
  id: string;
  mode: "scripted_fixture" | "live_model";
  /** Trusted adapters must bound request liability before making a provider call. */
  next(view: Readonly<AdapterView>, request: AdapterRequest): Promise<unknown>;
}
export interface ActorReport {
  id: string;
  mode: "simulated";
  backend: { id: string; mode: InferenceAdapter["mode"] };
  model: { id: string; version: string; hash: string } | null;
  scenarioRef: string;
  outcome: "completed" | "limit_reached" | "policy_denied" | "invalid_decision" | "adapter_failed" | "cancelled";
  decision: DecisionRecord | null;
  errors: string[];
  usage: { steps: number; reads: number; inputTokens: number; outputTokens: number; costMicrousd: number; unreceiptedCalls: number; unreceiptedReservationMicrousd: number };
  events: { kind: string; at: string; ref?: string }[];
  limitations: string[];
}

class ActorFailure extends Error {
  readonly outcome: ActorReport["outcome"];
  constructor(outcome: ActorReport["outcome"], message: string) { super(message); this.outcome = outcome; }
}
function failure(outcome: ActorReport["outcome"], message: string): never { throw new ActorFailure(outcome, message); }
function record(input: unknown, allowed: string[], label: string): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) failure("adapter_failed", `${label} must be a plain object.`);
  if (Reflect.ownKeys(input).some(key => typeof key !== "string" || !allowed.includes(key)) || Object.values(Object.getOwnPropertyDescriptors(input)).some(item => !("value" in item))) failure("policy_denied", `${label} contains an unsupported field or accessor.`);
  return input as Record<string, unknown>;
}
function count(input: unknown, label: string): number {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 0) failure("adapter_failed", `${label} requires a nonnegative integer.`);
  return input;
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { for (const item of Object.values(value)) freeze(item); Object.freeze(value); }
  return value;
}
function safeText(value: unknown, maximum: number): value is string { return typeof value === "string" && value.trim().length > 0 && value.length <= maximum; }
function validateScenario(scenario: ActorScenario): void {
  for (const key of ["id", "runId", "actorRef", "modelId", "modelVersion"] as const) if (!safeText(scenario[key], 120)) failure("policy_denied", `Scenario ${key} requires a short identifier.`);
  if (scenario.decisionBody !== undefined && !["individual", "committee"].includes(scenario.decisionBody)) failure("policy_denied", "Unsupported decision body.");
  if (!Array.isArray(scenario.facts) || scenario.facts.length > 100) failure("policy_denied", "A scenario supports at most 100 facts.");
  const ids = new Set<string>();
  for (const fact of scenario.facts) {
    if (!safeText(fact.id, 120) || !safeText(fact.label, 240) || !safeText(fact.value, 20000) || !["initial", "on_request"].includes(fact.visibility) || !["scenario_fact", "app_observation"].includes(fact.kind) || ids.has(fact.id)) failure("policy_denied", "Scenario facts require unique references and supported visibility.");
    ids.add(fact.id);
  }
}

/** The adapter gets scoped data only; this runtime exposes no browser, shell, or payment tools. */
export async function runActor(registry: ResearchRegistry, input: ActorScenario, adapter: InferenceAdapter, limits: ActorLimits, signal?: AbortSignal): Promise<ActorReport> {
  const report: ActorReport = {
    id: randomUUID(), mode: "simulated", backend: { id: adapter.id, mode: adapter.mode }, model: null, scenarioRef: input.id,
    outcome: "adapter_failed", decision: null, errors: [], usage: { steps: 0, reads: 0, inputTokens: 0, outputTokens: 0, costMicrousd: 0, unreceiptedCalls: 0, unreceiptedReservationMicrousd: 0 }, events: [],
    limitations: [adapter.mode === "scripted_fixture" ? "Scripted software adapter. No live model calls or human behavior are represented." : "Model-generated simulation. Independent behavioral validity is not established.",
      "The gateway filters supplied information. It cannot remove a language model's prior knowledge or validate its psychological realism.",
      "Usage receipts come from the trusted adapter. Provider billing verification and production isolation require additional infrastructure.",
      "A failed or timed-out call without a valid usage receipt has unknown final cost. Its requested reservation remains visible.",
      "Decisions are simulated records. No purchase, investment, browser action, or external message is executed."],
  };
  const controller = new AbortController();
  const combined = signal ? AbortSignal.any([controller.signal, signal]) : controller.signal;
  const startedAt = performance.now();
  const event = (kind: string, ref?: string) => report.events.push({ kind, at: new Date().toISOString(), ...(ref ? { ref } : {}) });
  try {
    validateScenario(input);
    for (const key of ["maxSteps", "maxReads", "maxOutputChars", "maxContextChars", "maxTotalTokens", "maxCostMicrousd", "timeoutMs"] as const) count(limits[key], key);
    if (limits.maxSteps < 1 || limits.maxSteps > 100 || limits.maxReads > 100 || limits.timeoutMs < 1 || limits.timeoutMs > 300000 || limits.maxOutputChars < 100 || limits.maxOutputChars > 1000000 || limits.maxContextChars < 100 || limits.maxContextChars > 1000000) failure("policy_denied", "Actor limits are outside supported bounds.");
    if (!safeText(adapter.id, 120) || !["scripted_fixture", "live_model"].includes(adapter.mode)) failure("policy_denied", "The inference adapter requires a declared identity and mode.");
    const scenario = structuredClone(input);
    const model = registry.authorizeModel(scenario.modelId, scenario.modelVersion, scenario.scope, "exploratory");
    report.model = { id: model.id, version: model.version, hash: model.hash };
    const facts = new Map(scenario.facts.map(fact => [fact.id, fact]));
    if (model.sourceIds.some(id => facts.has(id))) failure("policy_denied", "Research and observation references must be distinct.");
    const observations: AdapterView["observations"] = scenario.facts.filter(fact => fact.visibility === "initial").map(fact => ({ ref: fact.id, value: fact.value, kind: fact.kind }));
    const seen = new Set(observations.map(item => item.ref));
    const availableReads: AdapterView["availableReads"] = [
      ...scenario.facts.filter(fact => fact.visibility === "on_request").map(fact => ({ ref: fact.id, label: fact.label, kind: fact.kind })),
      ...model.sourceIds.map(ref => ({ ref, label: "Permitted grounding source", kind: "research_source" as const })),
    ];
    for (let step = 0; step < limits.maxSteps; step++) {
      if (combined.aborted) failure("cancelled", "Actor execution was cancelled.");
      registry.authorizeModel(model.id, model.version, scenario.scope, "exploratory");
      const remainingMs = limits.timeoutMs - (performance.now() - startedAt);
      if (remainingMs <= 0) failure("limit_reached", "Actor deadline reached.");
      const usedTokens = report.usage.inputTokens + report.usage.outputTokens;
      if (usedTokens >= limits.maxTotalTokens && adapter.mode !== "scripted_fixture") failure("limit_reached", "Actor inference token budget exhausted.");
      const view: AdapterView = { model: structuredClone(model), scenario: { id: scenario.id, actorRef: scenario.actorRef, scope: scenario.scope, decisionBody: model.domain === "investor" ? scenario.decisionBody ?? "individual" : null }, availableReads, observations };
      if (JSON.stringify(view).length > limits.maxContextChars) failure("limit_reached", "Actor context limit reached.");
      report.usage.steps++;
      report.usage.unreceiptedCalls++;
      report.usage.unreceiptedReservationMicrousd = limits.maxCostMicrousd - report.usage.costMicrousd;
      event("adapter_requested");
      let raw: unknown;
      let cancelCall: (() => void) | undefined;
      try {
        const cancelled = new Promise<never>((_, reject) => { cancelCall = () => reject(new Error("Actor cancelled.")); combined.addEventListener("abort", cancelCall, { once: true }); });
        const pending = Promise.resolve().then(() => adapter.next(freeze(structuredClone(view)), { signal: combined, maximumOutputChars: limits.maxOutputChars, remainingTokens: limits.maxTotalTokens - usedTokens, maximumCostMicrousd: limits.maxCostMicrousd - report.usage.costMicrousd }));
        raw = await withinDeadline(Promise.race([pending, cancelled]), remainingMs, "Actor adapter");
      } catch (error) {
        if (combined.aborted) failure("cancelled", "Actor execution was cancelled.");
        if (error instanceof LimitError) failure("limit_reached", "Actor adapter deadline reached.");
        failure("adapter_failed", "Inference adapter failed. No valid decision was accepted.");
      } finally { if (cancelCall) combined.removeEventListener("abort", cancelCall); }
      if (combined.aborted) failure("cancelled", "Actor execution was cancelled.");
      registry.authorizeModel(model.id, model.version, scenario.scope, "exploratory");
      const receipt = record(raw, ["action", "usage"], "adapter reply");
      const usage = record(receipt.usage, ["inputTokens", "outputTokens", "costMicrousd"], "usage receipt");
      const inputTokens = count(usage.inputTokens, "inputTokens");
      const outputTokens = count(usage.outputTokens, "outputTokens");
      const costMicrousd = count(usage.costMicrousd, "costMicrousd");
      report.usage.inputTokens += inputTokens;
      report.usage.outputTokens += outputTokens;
      report.usage.costMicrousd += costMicrousd;
      report.usage.unreceiptedCalls--; report.usage.unreceiptedReservationMicrousd = 0;
      if (!Number.isSafeInteger(report.usage.inputTokens + report.usage.outputTokens) || !Number.isSafeInteger(report.usage.costMicrousd)) failure("adapter_failed", "Adapter usage exceeds supported accounting precision.");
      if (report.usage.inputTokens + report.usage.outputTokens > limits.maxTotalTokens || report.usage.costMicrousd > limits.maxCostMicrousd) failure("limit_reached", "Adapter usage exceeded the permitted budget. Receipt retained; no further calls allowed.");
      const action = record(receipt.action, ["type", "ref", "decision"], "actor action");
      if (JSON.stringify(action).length > limits.maxOutputChars) failure("limit_reached", "Adapter output limit reached.");
      if (action.type === "inspect") {
        if (Object.keys(action).some(key => !["type", "ref"].includes(key)) || typeof action.ref !== "string") failure("policy_denied", "Inspect requires a permitted reference only.");
        if (report.usage.reads >= limits.maxReads) failure("limit_reached", "Actor read limit reached.");
        if (!availableReads.some(item => item.ref === action.ref)) failure("policy_denied", "The requested information is outside the actor's knowledge boundary.");
        report.usage.reads++;
        if (!seen.has(action.ref)) {
          const fact = facts.get(action.ref);
          const value = fact ? fact.value : registry.readSource(action.ref, "grounding").text;
          observations.push({ ref: action.ref, value, kind: fact?.kind ?? "research_source" }); seen.add(action.ref);
        }
        event("information_observed", action.ref);
      } else if (action.type === "decide") {
        if (Object.keys(action).some(key => !["type", "decision"].includes(key))) failure("policy_denied", "Decision action cannot add tools or identities.");
        const body = record(action.decision, ["action", "evidenceRefs", "constraints", "rationale", "missingInformation", "limitations", "changeConditions", ...(model.domain === "investor" ? ["conditions"] : [])], "decision body");
        const decision = {
          ...structuredClone(body), id: randomUUID(), runId: scenario.runId, mode: "simulated", scenarioRef: scenario.id, actorRef: scenario.actorRef,
          model: { id: model.id, version: model.version, use: "exploratory", scopeMatch: "within" }, domain: model.domain,
          ...(model.domain === "investor" ? { decisionBody: scenario.decisionBody ?? "individual" } : {}),
        };
        const check = validateRegisteredDecision(decision, registry, { runId: scenario.runId, actorRef: scenario.actorRef, scenarioRef: scenario.id, scope: scenario.scope, observationRefs: [...seen].filter(ref => facts.has(ref)) });
        if (!check.valid) failure("invalid_decision", check.errors.join("; "));
        const accepted = decision as DecisionRecord;
        const cited = [...accepted.evidenceRefs, ...accepted.constraints.flatMap(constraint => constraint.evidenceRefs)];
        if (cited.some(ref => !seen.has(ref))) failure("invalid_decision", "Decision cites information the actor has not observed.");
        if (performance.now() - startedAt >= limits.timeoutMs) failure("limit_reached", "Actor deadline reached before decision acceptance.");
        report.decision = accepted; report.outcome = "completed"; event("decision_accepted"); return report;
      } else failure("policy_denied", "Unsupported actor action. Only permitted inspection and simulated decisions are available.");
    }
    failure("limit_reached", "Actor step limit reached before a valid decision.");
  } catch (error) {
    if (error instanceof ActorFailure) { report.outcome = error.outcome; report.errors.push(error.message); }
    else { report.outcome = "policy_denied"; report.errors.push("Actor setup or current research permission failed. No decision was accepted."); }
    event("actor_stopped"); return report;
  } finally { controller.abort(); }
}
