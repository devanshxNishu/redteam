import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { ResearchRegistry } from "../src/research.ts";
import { runActor } from "../src/actor.ts";
import type { ActorScenario, ActorLimits, InferenceAdapter } from "../src/actor.ts";

const scope = { country: "synthetic-market", language: "en", segment: "fixture", category: "software", decision: "assess-fixture" };
const limits: ActorLimits = { maxSteps: 4, maxReads: 2, maxOutputChars: 5000, maxContextChars: 20000, maxTotalTokens: 1000, maxCostMicrousd: 100, timeoutMs: 1000 };
const receipt = (action: unknown, usage = { inputTokens: 0, outputTokens: 0, costMicrousd: 0 }) => ({ action, usage });
const decline = () => ({ type: "decide", decision: { action: "reject", evidenceRefs: ["budget"], constraints: [{ key: "affordability", state: "unsatisfied", material: true, evidenceRefs: ["budget"] }],
  rationale: "Scripted fixture declines an unaffordable offer.", missingInformation: [], limitations: ["Software fixture only."], changeConditions: ["A different fixture budget could change this decision."] } });
function adapter(next: InferenceAdapter["next"]): InferenceAdapter { return { id: "test-script", mode: "scripted_fixture", next }; }
async function temporary(work: (registry: ResearchRegistry, scenario: ActorScenario) => Promise<void>, domain: "consumer" | "investor" = "consumer"): Promise<void> {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-actor-"));
  const registry = new ResearchRegistry(directory);
  try {
    registry.addSource({ id: "source", kind: "synthetic_fixture", title: "Actor software test", reference: "fixture:actor", collectedAt: "2026-01-01T00:00:00.000Z", method: "Scripted software test", scope,
      partition: "grounding", participantRefs: ["synthetic-unit"], consentRef: null, permissions: { grounding: true, training: false, evaluation: false }, expiresAt: null, limitations: ["Not human research"], content: { text: "Synthetic rule, not a participant response." } });
    registry.addModel({ id: "model", version: "1", domain, scope, sourceIds: ["source"], goals: ["Assess the synthetic offer"], constraints: ["Use permitted facts"], knownInformation: [], decisionRules: ["Select a simulated response"], limitations: ["Synthetic fixture model"] });
    await work(registry, { id: "scenario", runId: "run", actorRef: "actor", modelId: "model", modelVersion: "1", scope, facts: [
      { id: "offer", label: "Public offer", value: "The fixture costs 20 units.", kind: "app_observation", visibility: "initial" },
      { id: "budget", label: "Available budget", value: "The fixture budget is 5 units.", kind: "scenario_fact", visibility: "on_request" },
    ] });
  } finally { registry.close(); await rm(directory, { recursive: true, force: true }); }
}

test("consumer runtime reveals requested facts only and accepts a consistent simulated decline", async () => temporary(async (registry, scenario) => {
  let calls = 0;
  const backend = adapter(async view => {
    assert(Object.isFrozen(view)); assert(Object.isFrozen(view.observations));
    if (calls++ === 0) { assert(!JSON.stringify(view).includes("budget is 5")); return receipt({ type: "inspect", ref: "budget" }); }
    assert(view.observations.some(item => item.ref === "budget"));
    return receipt(decline());
  });
  const result = await runActor(registry, scenario, backend, limits);
  assert.equal(result.outcome, "completed"); assert.equal(result.decision?.action, "reject");
  assert.equal(result.decision?.model.use, "exploratory"); assert.equal(result.usage.steps, 2); assert.equal(result.usage.reads, 1);
  assert.equal(result.backend.mode, "scripted_fixture");
}));

test("runtime cannot inspect arbitrary sources, execute tools, or override model identity", async () => temporary(async (registry, scenario) => {
  for (const action of [{ type: "inspect", ref: "held-out-answer" }, { type: "shell", command: "run-anything" }, { type: "decide", decision: { ...decline().decision, model: { use: "validated_within_scope" } } }]) {
    const result = await runActor(registry, scenario, adapter(async () => receipt(action)), limits);
    assert.equal(result.outcome, "policy_denied"); assert.equal(result.decision, null);
  }
}));

test("decisions cannot cite unseen facts or unread model sources", async () => temporary(async (registry, scenario) => {
  const unseen = await runActor(registry, scenario, adapter(async () => receipt(decline())), limits);
  assert.equal(unseen.outcome, "invalid_decision");
  const unread = decline(); unread.decision.evidenceRefs = ["source"]; unread.decision.constraints = [];
  const result = await runActor(registry, scenario, adapter(async () => receipt(unread)), limits);
  assert.equal(result.outcome, "invalid_decision"); assert.match(result.errors.join(";"), /not observed/);
}));

test("read and step limits stop work without accepting a partial decision", async () => temporary(async (registry, scenario) => {
  const inspect = adapter(async () => receipt({ type: "inspect", ref: "budget" }));
  const noReads = await runActor(registry, scenario, inspect, { ...limits, maxReads: 0 });
  assert.equal(noReads.outcome, "limit_reached"); assert.equal(noReads.usage.reads, 0);
  const oneStep = await runActor(registry, scenario, inspect, { ...limits, maxSteps: 1 });
  assert.equal(oneStep.outcome, "limit_reached"); assert.equal(oneStep.decision, null); assert.equal(oneStep.usage.steps, 1);
}));

test("adapter usage overruns are retained and prevent further calls", async () => temporary(async (registry, scenario) => {
  let calls = 0;
  const backend = adapter(async () => { calls++; return receipt({ type: "inspect", ref: "budget" }, { inputTokens: 5, outputTokens: 5, costMicrousd: 101 }); });
  const result = await runActor(registry, scenario, backend, limits);
  assert.equal(result.outcome, "limit_reached"); assert.equal(calls, 1); assert.equal(result.usage.costMicrousd, 101);
  assert.equal(result.decision, null);
}));

test("stalled adapters time out and receive cancellation", { timeout: 2000 }, async () => temporary(async (registry, scenario) => {
  let observedSignal: AbortSignal | undefined;
  const result = await runActor(registry, scenario, adapter(async (_, request) => { observedSignal = request.signal; return new Promise(() => {}); }), { ...limits, timeoutMs: 30 });
  assert.equal(result.outcome, "limit_reached"); assert(observedSignal?.aborted);
  assert.equal(result.usage.unreceiptedCalls, 1); assert.equal(result.usage.unreceiptedReservationMicrousd, limits.maxCostMicrousd);
}));

test("external cancellation ends an uncooperative adapter promptly", { timeout: 2000 }, async () => temporary(async (registry, scenario) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15);
  const startedAt = performance.now();
  try {
    const result = await runActor(registry, scenario, adapter(async () => new Promise(() => {})), { ...limits, timeoutMs: 5000 }, controller.signal);
    assert.equal(result.outcome, "cancelled"); assert(performance.now() - startedAt < 1000);
  } finally { clearTimeout(timer); }
}));

test("research withdrawal during an adapter call blocks decision acceptance", async () => temporary(async (registry, scenario) => {
  scenario.facts[1]!.visibility = "initial";
  const result = await runActor(registry, scenario, adapter(async () => { registry.revokeSource("source", "Synthetic withdrawal"); return receipt(decline()); }), limits);
  assert.equal(result.outcome, "policy_denied"); assert.equal(result.decision, null);
}));

test("investor runtime returns explicit conditions and preserves coordinator decision authority", async () => temporary(async (registry, scenario) => {
  scenario.decisionBody = "individual";
  const result = await runActor(registry, scenario, adapter(async () => receipt({ type: "decide", decision: {
    action: "conditional_investment", evidenceRefs: ["offer"], constraints: [
      { key: "mandate", state: "satisfied", material: true, evidenceRefs: ["offer"] },
      { key: "available_capital", state: "satisfied", material: true, evidenceRefs: ["offer"] },
      { key: "decision_authority", state: "unknown", material: true, evidenceRefs: [] },
      { key: "required_diligence", state: "unknown", material: true, evidenceRefs: [] },
    ], conditions: ["Resolve decision_authority", "Complete required_diligence"], rationale: "Scripted conditional fixture response", missingInformation: ["Authority and diligence remain unspecified"], limitations: ["Software fixture; not funding evidence"], changeConditions: ["Complete the listed conditions"],
  } })), limits);
  assert.equal(result.outcome, "completed"); assert.equal(result.decision?.domain, "investor");
  if (result.decision?.domain === "investor") { assert.equal(result.decision.decisionBody, "individual"); assert.equal(result.decision.conditions.length, 2); }
}, "investor"));

test("bad accounting, missing limits, and excessive context deny execution", async () => temporary(async (registry, scenario) => {
  const malformed = await runActor(registry, scenario, adapter(async () => receipt({}, { inputTokens: -1, outputTokens: 0, costMicrousd: 0 })), limits);
  assert.equal(malformed.outcome, "adapter_failed");
  let calls = 0;
  const backend = adapter(async () => { calls++; return receipt(decline()); });
  const invalid = await runActor(registry, scenario, backend, {} as ActorLimits);
  assert.equal(invalid.decision, null); assert.equal(calls, 0);
  const tooSmall = await runActor(registry, scenario, backend, { ...limits, maxContextChars: 100 });
  assert.equal(tooSmall.outcome, "limit_reached"); assert.equal(calls, 0);
  const noTokens = await runActor(registry, scenario, { ...backend, mode: "live_model", dataLocation: "local" }, { ...limits, maxTotalTokens: 0 });
  assert.equal(noTokens.outcome, "limit_reached"); assert.equal(calls, 0);
}));
