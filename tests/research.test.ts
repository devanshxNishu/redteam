import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { ResearchRegistry } from "../src/research.ts";
import type { SourceInput, ModelInput, EvaluationInput } from "../src/research.ts";

// These are software test records. Their declared human origin tests gates; no real
// participant material is created, saved in the product workspace, or validated.
const scope = { country: "test-market", language: "test-language", segment: "test-buyers", category: "test-category", decision: "buy-pilot" };
function source(id: string, overrides: Partial<SourceInput> = {}): SourceInput {
  return { id, kind: "synthetic_fixture", title: "Software verification fixture", reference: "fixture:research-test", collectedAt: "2026-01-01T00:00:00.000Z", method: "Synthetic software test", scope,
    partition: "grounding", participantRefs: [id], consentRef: null, permissions: { grounding: true, training: false, evaluation: false }, expiresAt: null,
    limitations: ["Fabricated software test data. Not human research."], content: { text: `Private synthetic content for ${id}` }, ...overrides };
}
function outcome(id: string, action = "buy", overrides: Partial<SourceInput> = {}): SourceInput {
  return source(id, { partition: "held_out", permissions: { grounding: false, training: false, evaluation: true }, content: { text: "Synthetic choice", observedAction: action }, ...overrides });
}
function model(overrides: Partial<ModelInput> = {}): ModelInput {
  return { id: "buyer", version: "1", domain: "consumer", scope, sourceIds: ["grounding"], goals: ["Complete a test decision"], constraints: ["Honor a test budget"], knownInformation: ["Test offer"], decisionRules: ["Use permitted information"], limitations: ["Synthetic test model"], ...overrides };
}
function evaluation(overrides: Partial<EvaluationInput> = {}): EvaluationInput {
  return { id: "evaluation", modelId: "buyer", modelVersion: "1", scope, cases: [{ id: "case-a", sourceId: "held-a", scenarioRef: "scenario-a" }, { id: "case-b", sourceId: "held-b", scenarioRef: "scenario-b" }],
    thresholds: { minimumCases: 2, minimumParticipants: 2, minimumAccuracy: 0.75, baselineAccuracy: 0.5, minimumLift: 0.2 }, protocolRef: "fixture:protocol", outcomeHorizon: "At the end of the synthetic offer task", ...overrides };
}
function seed(registry: ResearchRegistry): void {
  registry.addSource(source("grounding")); registry.addSource(outcome("held-a")); registry.addSource(outcome("held-b", "reject")); registry.addModel(model());
}
const predictions = [{ caseId: "case-a", action: "buy" }, { caseId: "case-b", action: "reject" }];
async function temporary(work: (registry: ResearchRegistry, directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-research-"));
  const registry = new ResearchRegistry(directory);
  try { await work(registry, directory); } finally { registry.close(); await rm(directory, { recursive: true, force: true }); }
}

test("research source content is encrypted and immutable; metadata has no raw content", async () => temporary(async (registry, directory) => {
  const input = source("grounding");
  const registered = registry.addSource(input);
  assert.equal(registered.provenance, "operator_declared");
  assert(!JSON.stringify(registry.sources()).includes(input.content.text));
  assert.deepEqual(registry.readSource(input.id, "grounding"), input.content);
  assert.throws(() => registry.addSource(input), /UNIQUE/);
  assert(!(await readFile(resolve(directory, ".redteam/research.sqlite-wal"))).includes(Buffer.from(input.content.text)));
}));

test("source gates distinguish grounding, training, expiry, and held-out outcomes", async () => temporary(async registry => {
  registry.addSource(source("grounding")); registry.addSource(outcome("held-a"));
  assert.throws(() => registry.readSource("grounding", "training"), /missing, expired, or revoked/);
  assert.throws(() => registry.readSource("held-a", "grounding"), /missing, expired, or revoked/);
  assert.throws(() => registry.readSource("held-a", "evaluation" as "grounding"), /locked evaluation/);
  registry.addSource(source("expired", { expiresAt: "2020-01-01T00:00:00.000Z" }));
  assert.throws(() => registry.readSource("expired", "grounding"), /expired/);
  assert.throws(() => registry.addSource(outcome("leak", "buy", { permissions: { grounding: true, training: false, evaluation: true } })), /Held-out/);
}));

test("model versions cannot overwrite or exceed scope; synthetic grounding and validation are denied", async () => temporary(async registry => {
  seed(registry);
  const original = registry.model("buyer", "1");
  assert.throws(() => registry.addModel(model({ decisionRules: ["Changed rule"] })), /UNIQUE/);
  assert.equal(registry.model("buyer", "1").hash, original.hash);
  assert.throws(() => registry.groundModel("buyer", "1"), /excludes synthetic/);
  assert.throws(() => registry.authorizeModel("buyer", "1", { ...scope, country: "elsewhere" }, "exploratory"), /outside/);
  assert.throws(() => registry.authorizeModel("buyer", "1", scope, "validated_within_scope"), /independent research review/);
  assert.throws(() => registry.addModel(model({ version: "2", scope: { ...scope, segment: "different" } })), /match/);
  assert.throws(() => registry.addModel(model({ version: "2", sourceIds: ["held-a"] })), /missing/);
}));

test("declared human grounding requires consent and an observation; published sources alone are insufficient", async () => temporary(async registry => {
  assert.throws(() => registry.addSource(source("human", { kind: "human_observation" })), /consent/);
  registry.addSource(source("published", { kind: "published_research" }));
  registry.addModel(model({ sourceIds: ["published"] }));
  assert.throws(() => registry.groundModel("buyer", "1"), /human observations/);
  registry.addSource(source("declared-human", { kind: "human_observation", consentRef: "fixture:consent" }));
  registry.addModel(model({ version: "2", sourceIds: ["declared-human"] }));
  assert.equal(registry.groundModel("buyer", "2").status, "research_grounded");
  assert.equal(registry.summary().validatedModels, 0);
}));

test("source revocation removes active content and restricts every dependent model version", async () => temporary(async registry => {
  seed(registry); registry.addModel(model({ version: "2" }));
  registry.revokeSource("grounding", "Fixture withdrawal");
  assert.throws(() => registry.readSource("grounding", "grounding"), /revoked/);
  assert(registry.models().every(item => item.status === "restricted"));
  assert.throws(() => registry.authorizeModel("buyer", "1", scope, "exploratory"), /not permitted/);
}));

test("outcomes stay locked until complete, valid, immutable predictions are frozen", async () => temporary(async registry => {
  seed(registry); registry.registerEvaluation(evaluation());
  assert.throws(() => registry.readEvaluationOutcomes("evaluation"), /Freeze all predictions/);
  assert.throws(() => registry.scoreEvaluation("evaluation"), /Freeze all predictions/);
  assert.throws(() => registry.lockPredictions("evaluation", predictions.slice(0, 1)), /every registered case/);
  assert.throws(() => registry.lockPredictions("evaluation", [predictions[0], predictions[0]]), /every registered case/);
  assert.throws(() => registry.lockPredictions("evaluation", [{ ...predictions[0], action: "approve_investment" }, predictions[1]]), /action/);
  const locked = registry.lockPredictions("evaluation", predictions);
  assert(locked.predictionHash && locked.lockedAt);
  assert.throws(() => registry.lockPredictions("evaluation", predictions), /already locked/);
  assert.deepEqual(registry.readEvaluationOutcomes("evaluation"), [{ caseId: "case-a", observedAction: "buy" }, { caseId: "case-b", observedAction: "reject" }]);
  assert.throws(() => registry.readSource("held-a", "grounding"), /missing/);
}));

test("evaluation scoring reports registered agreement and never validates synthetic behavior", async () => temporary(async registry => {
  seed(registry); registry.registerEvaluation(evaluation()); registry.lockPredictions("evaluation", predictions);
  const result = registry.scoreEvaluation("evaluation");
  assert.equal(result.caseCount, 2); assert.equal(result.participantCount, 2);
  assert.equal(result.correct, 2); assert.equal(result.accuracy, 1); assert.equal(result.lift, 0.5);
  assert.equal(result.thresholdsPassed, true); assert.equal(result.validated, false);
  assert.equal(registry.evaluation("evaluation").mode, "software_fixture");
  assert.equal(registry.model("buyer", "1").status, "draft");
  assert.deepEqual(registry.scoreEvaluation("evaluation"), result);
}));

test("evaluation partitions reject participant leakage, repeated sources, and threshold mutation", async () => temporary(async registry => {
  seed(registry);
  registry.addSource(outcome("overlap", "buy", { participantRefs: ["grounding"] }));
  assert.throws(() => registry.registerEvaluation(evaluation({ cases: [{ id: "case-a", sourceId: "overlap", scenarioRef: "scenario" }] })), /overlap/);
  assert.throws(() => registry.registerEvaluation(evaluation({ cases: [{ id: "case-a", sourceId: "held-a", scenarioRef: "scenario" }, { id: "case-b", sourceId: "held-a", scenarioRef: "scenario" }] })), /unique/);
  registry.registerEvaluation(evaluation());
  assert.throws(() => registry.registerEvaluation(evaluation({ thresholds: { ...evaluation().thresholds, minimumAccuracy: 0 } })), /UNIQUE/);
}));

test("reading outcomes blocks later fresh evaluations, cloned sources, and late prediction locks", async () => temporary(async registry => {
  seed(registry); registry.registerEvaluation(evaluation()); registry.registerEvaluation(evaluation({ id: "late" }));
  registry.lockPredictions("evaluation", predictions); registry.readEvaluationOutcomes("evaluation");
  assert.throws(() => registry.registerEvaluation(evaluation({ id: "new" })), /already been exposed/);
  assert.throws(() => registry.lockPredictions("late", predictions), /already been exposed/);
  registry.addSource(outcome("clone", "buy", { participantRefs: ["new-participant"] }));
  assert.throws(() => registry.registerEvaluation(evaluation({ id: "cloned", cases: [{ id: "case", sourceId: "clone", scenarioRef: "scenario" }] })), /already been exposed/);
}));

test("models frozen before outcome access can share a prospective evaluation set", async () => temporary(async registry => {
  seed(registry); registry.registerEvaluation(evaluation()); registry.registerEvaluation(evaluation({ id: "comparison" }));
  registry.lockPredictions("evaluation", predictions); registry.lockPredictions("comparison", predictions);
  assert.equal(registry.scoreEvaluation("evaluation").correct, 2);
  assert.equal(registry.scoreEvaluation("comparison").correct, 2);
}));

test("withdrawn outcome permission blocks reads and scoring even after prediction lock", async () => temporary(async registry => {
  seed(registry); registry.registerEvaluation(evaluation()); registry.lockPredictions("evaluation", predictions);
  registry.revokeSource("held-a", "Fixture outcome withdrawn");
  assert.throws(() => registry.readEvaluationOutcomes("evaluation"), /revoked/);
  assert.throws(() => registry.scoreEvaluation("evaluation"), /revoked/);
}));

test("research parser rejects unknown fields and accessor input without executing getters", async () => temporary(async registry => {
  assert.throws(() => registry.addSource({ ...source("extra"), validated: true }), /unsupported/);
  let invoked = false;
  const unsafe = { ...source("accessor") };
  Object.defineProperty(unsafe, "title", { get: () => { invoked = true; return "unsafe"; } });
  assert.throws(() => registry.addSource(unsafe), /accessors/); assert.equal(invoked, false);
}));
