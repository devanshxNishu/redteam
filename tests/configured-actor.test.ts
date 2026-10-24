import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { ResearchRegistry } from "../src/research.ts";
import { WorkspaceStore } from "../src/workspace.ts";
import { authorizedActorRuns, readActorReport } from "../src/actor-reports.ts";
import { configureInference } from "../src/inference-config.ts";
import { executeConfiguredActor } from "../src/actor-execution.ts";
import type { ActorScenario, ActorLimits } from "../src/actor.ts";
import { checkArtifacts } from "../src/evidence.ts";

// All provider exchanges below use an injected local function. They are not live
// OpenAI observations and must not be used as model-quality evidence.
const scope = { country: "synthetic", language: "en", segment: "fixture", category: "software", decision: "fixture-purchase" };
const profile = { provider: "openai", model: "fixture-model", inputUsdPerMillion: "1.00", outputUsdPerMillion: "2.00", maximumOutputTokens: 200 };
const limits: ActorLimits = { maxSteps: 3, maxReads: 2, maxOutputChars: 8000, maxContextChars: 20000, maxTotalTokens: 2000, maxCostMicrousd: 10000, timeoutMs: 2000 };
const secret = "test-only-private-key";
async function temporary(work: (registry: ResearchRegistry, directory: string, scenario: Omit<ActorScenario, "runId">) => Promise<void>, external = true): Promise<void> {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-configured-"));
  const registry = new ResearchRegistry(directory);
  try {
    registry.addSource({ id: "source", kind: "synthetic_fixture", title: "Configured adapter fixture", reference: "fixture:configured", collectedAt: "2026-01-01T00:00:00.000Z", method: "Software fixture", scope, partition: "grounding", participantRefs: ["synthetic-unit"], consentRef: null,
      permissions: { grounding: true, training: false, evaluation: false }, processing: external ? "external_model_allowed" : "local_only", expiresAt: null, limitations: ["Not human research"], content: { text: "Synthetic bounded decision rule" } });
    registry.addModel({ id: "model", version: "1", domain: "consumer", scope, sourceIds: ["source"], goals: ["Test a configured decision"], constraints: ["Honor the supplied budget"], knownInformation: [], decisionRules: ["Use observed fixture data"], limitations: ["Synthetic test model"] });
    await work(registry, directory, { id: "scenario", actorRef: "actor", modelId: "model", modelVersion: "1", scope, processing: "external_model_allowed", constraints: [
      { key: "affordability", state: "unsatisfied", material: true, evidenceRefs: ["budget"] },
    ], facts: [
      { id: "offer", label: "Fixture offer", value: "Price: 20 units", kind: "app_observation", visibility: "initial", processing: "external_model_allowed" },
      { id: "budget", label: "Fixture budget", value: "Budget: 5 units", kind: "scenario_fact", visibility: "on_request", processing: "external_model_allowed" },
    ] });
  } finally { registry.close(); await rm(directory, { recursive: true, force: true }); }
}
function provider(refusal = false) {
  let requests = 0; let generations = 0;
  const transport: typeof fetch = async (url, options) => {
    requests++; assert(options?.signal);
    if (String(url).endsWith("/input_tokens")) return new Response(JSON.stringify({ input_tokens: 100 }));
    generations++;
    const action = generations === 1 ? { type: "inspect", ref: "budget", decision: null } : { type: "decide", ref: null, decision: { action: "reject", evidenceRefs: ["budget"], constraints: [{ key: "affordability", state: "unsatisfied", material: true, evidenceRefs: ["budget"] }], rationale: "The synthetic offer exceeds the supplied budget.", missingInformation: [], limitations: ["Mock provider output; not behavioral evidence."], changeConditions: ["Change the fixture budget or offer"] } };
    return new Response(JSON.stringify({ id: `resp_fixture_${generations}`, model: "fixture-model-snapshot", status: "completed", usage: { input_tokens: 100, output_tokens: 40 }, output: [{ type: "message", content: refusal ? [{ type: "refusal", refusal: "Fixture refusal" }] : [{ type: "output_text", text: JSON.stringify(action) }] }] }));
  };
  return { transport, requests: () => requests };
}

test("configured fake-provider execution saves receipts, model versions, and verifiable private artifacts", async () => temporary(async (registry, directory, scenario) => {
  const fake = provider();
  const { adapter, configuration } = configureInference(profile, secret, fake.transport);
  const result = await executeConfiguredActor(directory, registry, scenario, limits, adapter, configuration);
  assert.equal(result.outcome, "completed"); assert.equal(result.kind, "model_actor_run"); assert.equal(fake.requests(), 4);
  const store = new WorkspaceStore(directory);
  try {
    const report = await readActorReport(store, directory, result.runId, registry);
    assert.equal(report.reports[0]?.decision?.action, "reject");
    assert.equal(report.reports[0]?.receipts.length, 2);
    assert.equal(report.reports[0]?.receipts[0]?.providerResponseId, "resp_fixture_1");
    assert.equal(report.reports[0]?.receipts[0]?.providerModel, "fixture-model-snapshot");
    assert.equal(report.reports[0]?.receipts[0]?.preflightInputTokens, 100);
    assert.equal(report.reports[0]?.backend.costBasis, "configured_rate_estimate");
    assert.equal(report.reports[0]?.usage.costMicrousd, 360);
    assert.equal(report.reports[0]?.usage.unreceiptedCalls, 0);
    assert.deepEqual(await checkArtifacts(result.directory, report.artifacts), []);
    for (const artifact of report.artifacts) assert(!(await readFile(resolve(result.directory, artifact.path), "utf8")).includes(secret));
    assert(!JSON.stringify(report).includes(secret));
    assert.equal((await authorizedActorRuns(store, registry, directory))[0]?.restricted, false);
    registry.revokeSource("source", "Synthetic withdrawal");
    assert.equal((await authorizedActorRuns(store, registry, directory))[0]?.restricted, true);
    await assert.rejects(readActorReport(store, directory, result.runId, registry), /restrict/);
  } finally { store.close(); }
}));

test("unauthorized source processing blocks every fake-provider request and retains a partial report", async () => temporary(async (registry, directory, scenario) => {
  const fake = provider(); const { adapter, configuration } = configureInference(profile, secret, fake.transport);
  const result = await executeConfiguredActor(directory, registry, scenario, limits, adapter, configuration);
  assert.equal(result.outcome, "limited_coverage"); assert.equal(result.actorOutcome, "policy_denied"); assert.equal(fake.requests(), 0);
}, false));

test("provider refusal keeps known usage and produces no accepted decision", async () => temporary(async (registry, directory, scenario) => {
  const fake = provider(true); const { adapter, configuration } = configureInference(profile, secret, fake.transport);
  const result = await executeConfiguredActor(directory, registry, scenario, limits, adapter, configuration);
  assert.equal(result.actorOutcome, "adapter_failed"); assert.equal(result.outcome, "limited_coverage");
  assert.equal(result.usage.costMicrousd, 180); assert.equal(result.usage.unreceiptedCalls, 0); assert.equal(fake.requests(), 2);
}));

test("configuration requires explicit decimal rates and keeps credentials outside public profiles", () => {
  assert.throws(() => configureInference({ ...profile, apiKey: secret }, secret), /Keep credentials/);
  assert.throws(() => configureInference({ ...profile, inputUsdPerMillion: "1e3" }, secret), /decimal string/);
  assert.throws(() => configureInference({ ...profile, inputUsdPerMillion: "0" }, secret), /bounds/);
  assert.throws(() => configureInference(profile, undefined), /API key/);
  assert(!JSON.stringify(configureInference(profile, secret, provider().transport)).includes(secret));
});

test("terminal configured runs fail closed when OPENAI_API_KEY is absent", async () => temporary(async (_, directory) => {
  const path = resolve(directory, "profile.json"); await writeFile(path, JSON.stringify(profile));
  const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
  const child = spawnSync(process.execPath, [cli, "actors", "run", "--scenario", "not-read.json", "--limits", "not-read.json", "--config", path], { cwd: directory, encoding: "utf8", env: { PATH: process.env.PATH ?? "", OPENAI_API_KEY: "" } });
  assert.equal(child.status, 1); assert.match(child.stderr, /API key/); assert.equal(child.stdout, "");
}));
