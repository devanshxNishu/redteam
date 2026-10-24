import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ResearchRegistry } from "../src/research.ts";
import { runActor } from "../src/actor.ts";
import type { ActorScenario, ActorLimits, InferenceAdapter } from "../src/actor.ts";

const scope = { country: "synthetic-market", language: "en", segment: "fixture", category: "software", decision: "processing-test" };
const limits: ActorLimits = { maxSteps: 2, maxReads: 1, maxOutputChars: 5000, maxContextChars: 20000, maxTotalTokens: 100, maxCostMicrousd: 100, timeoutMs: 1000 };
const reply = { action: { type: "decide", decision: { action: "abstain", evidenceRefs: ["fact"], constraints: [], rationale: "Scripted test of provider processing permission.", missingInformation: [], limitations: ["Synthetic test; no human prediction."], changeConditions: [] } }, usage: { inputTokens: 1, outputTokens: 1, costMicrousd: 0 } };
async function temporary(work: (registry: ResearchRegistry, scenario: ActorScenario, directory: string) => Promise<void>, external = false): Promise<void> {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-processing-"));
  const registry = new ResearchRegistry(directory);
  try {
    registry.addSource({ id: "source", kind: "synthetic_fixture", title: "Processing permission fixture", reference: "fixture:processing", collectedAt: "2026-01-01T00:00:00.000Z", method: "Software fixture", scope, partition: "grounding", participantRefs: ["fixture"], consentRef: null,
      permissions: { grounding: true, training: false, evaluation: false }, expiresAt: null, ...(external ? { processing: "external_model_allowed" } : {}), limitations: ["Not human research"], content: { text: "Private fixture data" } });
    registry.addModel({ id: "model", version: "1", domain: "consumer", scope, sourceIds: ["source"], goals: ["Test permissions"], constraints: ["Honor processing scope"], knownInformation: [], decisionRules: ["Use permitted data"], limitations: ["Fixture model"] });
    await work(registry, { id: "scenario", runId: "run", actorRef: "actor", modelId: "model", modelVersion: "1", scope, facts: [{ id: "fact", label: "Fixture fact", value: "A private scenario value", kind: "scenario_fact", visibility: "initial" }] }, directory);
  } finally { registry.close(); await rm(directory, { recursive: true, force: true }); }
}

test("sources default to local processing while provider processing remains distinct from training", async () => temporary(async registry => {
  assert.equal(registry.source("source").processing, "local_only");
  assert.equal(registry.authorizeProcessing("model", "1", "local").id, "model");
  assert.throws(() => registry.authorizeProcessing("model", "1", "external"), /not permitted/);
}));

test("legacy source records without a processing declaration remain local-only", async () => temporary(async (registry, _, directory) => {
  const db = new DatabaseSync(resolve(directory, ".redteam/research.sqlite"));
  try {
    const old = { ...registry.source("source") };
    delete (old as Partial<typeof old>).processing;
    db.prepare("UPDATE research_sources SET document=? WHERE id='source'").run(JSON.stringify(old));
  } finally { db.close(); }
  assert.equal(registry.source("source").processing, "local_only");
  assert.equal(registry.sources()[0]?.processing, "local_only");
  assert.throws(() => registry.authorizeProcessing("model", "1", "external"), /not permitted/);
}));

test("external adapters receive no data when a derived model source has local-only permission", async () => temporary(async (registry, scenario) => {
  scenario.processing = "external_model_allowed"; scenario.facts[0]!.processing = "external_model_allowed";
  let calls = 0;
  const adapter: InferenceAdapter = { id: "fake-external", mode: "live_model", dataLocation: "external", next: async () => { calls++; return reply; } };
  const result = await runActor(registry, scenario, adapter, limits);
  assert.equal(result.outcome, "policy_denied"); assert.equal(calls, 0); assert.equal(result.usage.steps, 0);
}));

test("external processing requires both scenario and individual fact permission", async () => temporary(async (registry, scenario) => {
  let calls = 0;
  const adapter: InferenceAdapter = { id: "fake-external", mode: "live_model", dataLocation: "external", next: async () => { calls++; return reply; } };
  assert.equal((await runActor(registry, scenario, adapter, limits)).outcome, "policy_denied");
  scenario.processing = "external_model_allowed";
  assert.equal((await runActor(registry, scenario, adapter, limits)).outcome, "policy_denied");
  scenario.facts[0]!.processing = "external_model_allowed";
  const result = await runActor(registry, scenario, adapter, limits);
  assert.equal(result.outcome, "completed"); assert.equal(calls, 1); assert.equal(result.backend.dataLocation, "external");
  assert.equal(registry.source("source").permissions.training, false);
  assert.throws(() => registry.readSource("source", "training"), /missing/);
}, true));

test("live adapters with undeclared data location are denied before dispatch", async () => temporary(async (registry, scenario) => {
  let calls = 0;
  const result = await runActor(registry, scenario, { id: "undeclared", mode: "live_model", next: async () => { calls++; return reply; } }, limits);
  assert.equal(result.outcome, "policy_denied"); assert.equal(calls, 0);
}));
