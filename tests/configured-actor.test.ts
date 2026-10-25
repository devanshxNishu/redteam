import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { ResearchRegistry } from "../src/research.ts";
import { WorkspaceStore } from "../src/workspace.ts";
import { authorizedActorRuns, readActorReport } from "../src/actor-reports.ts";
import { configureInference } from "../src/inference-config.ts";
import { executeConfiguredActor } from "../src/actor-execution.ts";
import type { ActorScenario, ActorLimits, InferenceAdapter } from "../src/actor.ts";
import { EvidenceStore, checkArtifacts, sha256 } from "../src/evidence.ts";
import { BudgetLedger } from "../src/budget.ts";
import { TaskStore } from "../src/tasks.ts";
import { recoverConfiguredActors } from "../src/actor-recovery.ts";
import type { ActorDemoReport } from "../src/actor-reports.ts";

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

function removeCatalogEntry(directory: string, runId: string) {
  const db = new DatabaseSync(resolve(directory, ".redteam/workspace.sqlite"));
  try { db.prepare("DELETE FROM actor_runs WHERE id=?").run(runId); } finally { db.close(); }
}

test("concurrent recovery restores an accepted publication exactly without inference or file changes", async () => temporary(async (registry, directory, scenario) => {
  const fake = provider(), { adapter, configuration } = configureInference(profile, secret, fake.transport);
  const result = await executeConfiguredActor(directory, registry, scenario, limits, adapter, configuration);
  const file = resolve(result.directory, "report.json"), before = await readFile(file);
  const store = new WorkspaceStore(directory), tasks = new TaskStore(directory), ledger = new BudgetLedger(directory);
  try {
    const expected = { ...store.actorRun(result.runId), directory: await realpath(result.directory) }, taskBefore = tasks.task(result.taskId!), budgetBefore = ledger.snapshot(result.runId);
    const report = JSON.parse(before.toString("utf8")) as ActorDemoReport;
    const artifactBytes = await Promise.all(report.artifacts.map(item => readFile(resolve(result.directory, item.path))));
    removeCatalogEntry(directory, result.runId);
    // JSON can be durable before the optional Markdown presentation is written.
    await rm(resolve(result.directory, "report.md"));
    const recovered = await Promise.all([recoverConfiguredActors(directory, result.runId), recoverConfiguredActors(directory, result.runId)]);
    assert(recovered.every(item => item.reports[0]?.status === "existing"));
    assert.deepEqual(store.actorRun(result.runId), expected); assert.equal(store.actorRuns().length, 1);
    assert.deepEqual(await readFile(file), before); await assert.rejects(readFile(resolve(result.directory, "report.md")), /ENOENT/);
    assert.deepEqual(await Promise.all(report.artifacts.map(item => readFile(resolve(result.directory, item.path)))), artifactBytes);
    assert.deepEqual(tasks.task(result.taskId!), taskBefore); assert.deepEqual(ledger.snapshot(result.runId), budgetBefore);
    assert.equal((await readActorReport(store, directory, result.runId, registry)).reports[0]?.decision?.action, "reject");
    assert.deepEqual((await recoverConfiguredActors(directory, result.runId)).reports, []); assert.equal(fake.requests(), 4);
  } finally { store.close(); tasks.close(); ledger.close(); }
}));

const publicationChanges: [string, (report: ActorDemoReport) => void][] = [
  ["a changed decision", report => { report.reports[0]!.decision!.action = "buy"; }],
  ["a different completed fence", report => { report.task!.record.fence++; }],
  ["a changed task transition", report => { report.task!.events.pop(); }],
  ["a changed budget snapshot", report => { report.budget!.pools[0]!.spent.costMicrousd = "0"; }],
  ["an omitted sealed worker", report => { report.artifacts = report.artifacts.filter(item => item.id !== report.task!.record.output!.artifactRef); }],
  ["duplicate artifact identities", report => { report.artifacts[1]!.id = report.artifacts[0]!.id; }],
  ["a rejected report for a completed task", report => { report.acceptance = { status: "rejected", reason: "task_not_accepted" }; }],
];
for (const [name, change] of publicationChanges) test(`publication recovery rejects ${name}`, async () => temporary(async (registry, directory, scenario) => {
  const fake = provider(), { adapter, configuration } = configureInference(profile, secret, fake.transport);
  const result = await executeConfiguredActor(directory, registry, scenario, limits, adapter, configuration);
  const file = resolve(result.directory, "report.json"), report = JSON.parse(await readFile(file, "utf8")) as ActorDemoReport;
  change(report); const changed = JSON.stringify(report); await writeFile(file, changed); removeCatalogEntry(directory, result.runId);
  assert.equal((await recoverConfiguredActors(directory, result.runId)).reports[0]?.status, "unavailable");
  const store = new WorkspaceStore(directory); try { assert.equal(store.actorRun(result.runId), null); } finally { store.close(); }
  assert.equal(await readFile(file, "utf8"), changed); assert.equal(fake.requests(), 4);
}));

test("publication recovery rejects changed sealed bytes even when the report adopts their new hash", async () => temporary(async (registry, directory, scenario) => {
  const fake = provider(), { adapter, configuration } = configureInference(profile, secret, fake.transport);
  const result = await executeConfiguredActor(directory, registry, scenario, limits, adapter, configuration);
  const file = resolve(result.directory, "report.json"), report = JSON.parse(await readFile(file, "utf8")) as ActorDemoReport;
  const artifact = report.artifacts.find(item => item.id === report.task!.record.output!.artifactRef)!;
  const changed = Buffer.from(JSON.stringify({ ...report.reports[0], outcome: "adapter_failed", decision: null }));
  await writeFile(resolve(result.directory, artifact.path), changed);
  artifact.sha256 = sha256(changed); artifact.bytes = changed.length;
  await writeFile(file, JSON.stringify(report)); removeCatalogEntry(directory, result.runId);
  assert.equal((await recoverConfiguredActors(directory, result.runId)).reports[0]?.status, "unavailable");
  assert.equal(fake.requests(), 4);
}));

test("completed task without a published report never reconstructs a decision from its seal", async () => temporary(async (registry, directory, scenario) => {
  const fake = provider(), { adapter, configuration } = configureInference(profile, secret, fake.transport);
  const result = await executeConfiguredActor(directory, registry, scenario, limits, adapter, configuration);
  removeCatalogEntry(directory, result.runId); await rm(resolve(result.directory, "report.json"));
  const recovered = await recoverConfiguredActors(directory, result.runId);
  assert.deepEqual(recovered.taskIds, []); assert.equal(recovered.reports[0]?.status, "unavailable");
  const store = new WorkspaceStore(directory), tasks = new TaskStore(directory);
  try { assert.equal(store.actorRun(result.runId), null); assert.equal(tasks.task(result.taskId!).state, "completed"); } finally { store.close(); tasks.close(); }
  await assert.rejects(readFile(resolve(result.directory, "report.json")), /ENOENT/); assert.equal(fake.requests(), 4);
}));

test("source withdrawal blocks catalog restoration of a previously accepted publication", async () => temporary(async (registry, directory, scenario) => {
  const fake = provider(), { adapter, configuration } = configureInference(profile, secret, fake.transport);
  const result = await executeConfiguredActor(directory, registry, scenario, limits, adapter, configuration);
  const file = resolve(result.directory, "report.json"), before = await readFile(file);
  removeCatalogEntry(directory, result.runId); registry.revokeSource("source", "Synthetic withdrawal before catalog repair");
  assert.deepEqual((await recoverConfiguredActors(directory, result.runId)).reports, [{ runId: result.runId, status: "unavailable", reason: "research_restricted" }]);
  const store = new WorkspaceStore(directory); try { assert.equal(store.actorRun(result.runId), null); } finally { store.close(); }
  assert.deepEqual(await readFile(file), before); assert.equal(fake.requests(), 4);
}));

test("recovery restores an existing rejected publication without promoting its worker", async () => temporary(async (registry, directory, scenario) => {
  const fake = provider(true), { adapter, configuration } = configureInference(profile, secret, fake.transport);
  const result = await executeConfiguredActor(directory, registry, scenario, limits, adapter, configuration);
  const file = resolve(result.directory, "report.json"), before = await readFile(file), store = new WorkspaceStore(directory);
  try {
    const expected = { ...store.actorRun(result.runId), directory: await realpath(result.directory) }; removeCatalogEntry(directory, result.runId);
    assert.equal((await recoverConfiguredActors(directory, result.runId)).reports[0]?.status, "existing");
    assert.deepEqual(store.actorRun(result.runId), expected); assert.equal(store.actorRun(result.runId)?.decisions[0]?.action, undefined);
    assert.equal((await readActorReport(store, directory, result.runId, registry)).acceptance?.status, "rejected");
    assert.deepEqual(await readFile(file), before); assert.equal(fake.requests(), 2);
  } finally { store.close(); }
}));

for (const phase of ["before", "after"] as const) test(`killed configured coordinator ${phase} atomic JSON publication preserves the acceptance boundary`, { timeout: 15000 }, async () => temporary(async (registry, directory, scenario) => {
  const executionUrl = new URL("../src/actor-execution.ts", import.meta.url).href, evidenceUrl = new URL("../src/evidence.ts", import.meta.url).href, registryUrl = new URL("../src/research.ts", import.meta.url).href;
  // The hook pauses the actual EvidenceStore call, without replacing publication.
  const program = `import { executeConfiguredActor } from ${JSON.stringify(executionUrl)}; import { EvidenceStore } from ${JSON.stringify(evidenceUrl)}; import { ResearchRegistry } from ${JSON.stringify(registryUrl)};
    const registry=new ResearchRegistry(process.argv[1]), scenario=JSON.parse(process.argv[2]), phase=process.argv[3], keepalive=setInterval(()=>{},1000);let calls=0;
    const original=EvidenceStore.prototype.writeRecord;
    EvidenceStore.prototype.writeRecord=async function(name,value){if(name!=="report.json")return original.call(this,name,value);if(phase==="after")await original.call(this,name,value);process.send({runId:value.runId,taskId:value.task.record.spec.id,calls,phase});await new Promise(()=>{});};
    const adapter={id:"killed-publication-fixture",mode:"live_model",dataLocation:"local",next:async view=>{calls++;return{action:calls===1?{type:"inspect",ref:"budget"}:{type:"decide",decision:{action:"reject",evidenceRefs:["budget"],constraints:view.constraints,rationale:"Authored fixture exceeds its declared budget",missingInformation:[],limitations:["Not human research"],changeConditions:["Different synthetic scenario"]}},usage:{inputTokens:7,outputTokens:3,costMicrousd:17}};}};
    try{await executeConfiguredActor(process.argv[1],registry,scenario,${JSON.stringify({ ...limits, timeoutMs: 500 })},adapter,${JSON.stringify(profile)},{taskPolicy:{finalizationMs:100}});}catch(error){process.send({error:error.message});}finally{registry.close();clearInterval(keepalive);}`;
  const child = spawn(process.execPath, ["--input-type=module", "-e", program, directory, JSON.stringify(scenario), phase], { stdio: ["ignore", "ignore", "pipe", "ipc"], env: { ...process.env, OPENAI_API_KEY: "" } });
  try {
    const message = await new Promise<{ runId: string; taskId: string; calls: number; error?: string }>((done, reject) => {
      const timer = setTimeout(() => reject(new Error("Configured publication fixture did not reach its checkpoint")), 5000);
      child.once("message", value => { clearTimeout(timer); done(value as { runId: string; taskId: string; calls: number }); });
      child.once("error", error => { clearTimeout(timer); reject(error); });
      child.once("exit", code => { clearTimeout(timer); reject(new Error(`Publication fixture exited early: ${code}`)); });
    });
    assert.equal(message.error, undefined); assert.equal(message.calls, 2);
    const reportFile = resolve(directory, ".redteam/actor-runs", message.runId, "report.json");
    const original = phase === "after" ? await readFile(reportFile) : null;
    const stopped = new Promise<void>(done => child.once("exit", () => done())); child.kill("SIGKILL"); await stopped;
    const tasks = new TaskStore(directory), store = new WorkspaceStore(directory), ledger = new BudgetLedger(directory);
    try {
      assert.equal(tasks.task(message.taskId).state, "completed"); assert.equal(store.actorRun(message.runId), null);
      const budgetBefore = ledger.snapshot(message.runId); assert.equal(budgetBefore.pools[0]?.spent.costMicrousd, "34");
      const recovery = await recoverConfiguredActors(directory, message.runId); assert.deepEqual(recovery.taskIds, []);
      if (phase === "after") {
        assert.equal(recovery.reports[0]?.status, "existing"); assert.deepEqual(await readFile(reportFile), original);
        const report = await readActorReport(store, directory, message.runId, registry);
        assert.equal(report.acceptance?.status, "accepted"); assert.equal(report.reports[0]?.decision?.action, "reject");
        assert.deepEqual(await checkArtifacts(resolve(reportFile, ".."), report.artifacts), []);
      } else {
        assert.equal(recovery.reports[0]?.reason, "publication_pending"); assert.equal(store.actorRun(message.runId), null);
        await assert.rejects(readFile(reportFile), /ENOENT/);
        await new Promise(done => setTimeout(done, Math.max(1, Date.parse(tasks.task(message.taskId).spec.deadlineAt) - Date.now() + 15)));
        assert.equal((await recoverConfiguredActors(directory, message.runId)).reports[0]?.status, "created");
        const report = await readActorReport(store, directory, message.runId, registry);
        assert.equal(report.recovery?.reason, "publication_missing"); assert.equal(report.acceptance?.status, "unavailable"); assert.deepEqual(report.reports, []);
        assert.equal(report.task?.record.state, "completed"); assert.equal(report.artifacts.length, 4); assert.deepEqual(await checkArtifacts(resolve(reportFile, ".."), report.artifacts), []);
      }
      assert.deepEqual(ledger.snapshot(message.runId), budgetBefore); assert.equal(tasks.task(message.taskId).dispatchIntents.length, 2);
    } finally { tasks.close(); store.close(); ledger.close(); }
  } finally { if (child.exitCode === null && child.signalCode === null) { const stopped = new Promise<void>(done => child.once("exit", () => done())); child.kill("SIGKILL"); await stopped; } }
}));

test("a delayed completed coordinator preserves the factual publication-gap report without promoting its decision", async () => temporary(async (registry, directory, scenario) => {
  const original = EvidenceStore.prototype.writeRecord, fake = provider(), { adapter, configuration } = configureInference(profile, secret, fake.transport);
  let release: () => void = () => {}, reached: (report: ActorDemoReport) => void = () => {};
  const gate = new Promise<void>(done => { release = done; }), checkpoint = new Promise<ActorDemoReport>(done => { reached = done; });
  EvidenceStore.prototype.writeRecord = async function (name, value) {
    if (name === "report.json" && !(value as ActorDemoReport).recovery) { reached(value as ActorDemoReport); await gate; }
    await original.call(this, name, value);
  };
  const running = executeConfiguredActor(directory, registry, scenario, { ...limits, timeoutMs: 500 }, adapter, configuration, { taskPolicy: { finalizationMs: 100 } });
  try {
    const candidate = await checkpoint;
    assert.equal((await recoverConfiguredActors(directory, candidate.runId)).reports[0]?.reason, "publication_pending");
    await new Promise(done => setTimeout(done, Math.max(1, Date.parse(candidate.task!.record.spec.deadlineAt) - Date.now() + 15)));
    assert.equal((await recoverConfiguredActors(directory, candidate.runId)).reports[0]?.status, "created");
    const file = resolve(directory, ".redteam/actor-runs", candidate.runId, "report.json"), before = await readFile(file);
    release(); const result = await running;
    assert.equal(result.outcome, "limited_coverage"); assert.equal(result.recoveredReport, true); assert.equal(result.workerOutcome, "completed");
    assert.deepEqual(result.acceptance, { status: "unavailable", reason: "publication_missing" });
    assert.deepEqual(result.decisions, [{ outcome: "publication_missing" }]); assert.equal(fake.requests(), 4);
    assert.deepEqual(await readFile(file), before);
    const store = new WorkspaceStore(directory);
    try { assert.equal(store.actorRuns().length, 1); assert.deepEqual((await readActorReport(store, directory, result.runId, registry)).reports, []); }
    finally { store.close(); }
  } finally { release(); EvidenceStore.prototype.writeRecord = original; await running.catch(() => {}); }
}));

test("an original publication that wins during recovery keeps its exact accepted decision", async () => temporary(async (registry, directory, scenario) => {
  const write = EvidenceStore.prototype.writeRecord, add = EvidenceStore.prototype.addBytes, fake = provider(), { adapter, configuration } = configureInference(profile, secret, fake.transport);
  let releaseNormal: () => void = () => {}, releasePublished: () => void = () => {}, releaseRecovery: () => void = () => {}, reachedNormal: (report: ActorDemoReport) => void = () => {}, reachedRecovery: () => void = () => {}, reachedPublished: () => void = () => {};
  const normalGate = new Promise<void>(done => { releaseNormal = done; }), recoveryGate = new Promise<void>(done => { releaseRecovery = done; });
  const publishedGate = new Promise<void>(done => { releasePublished = done; }), publishedCheckpoint = new Promise<void>(done => { reachedPublished = done; });
  const normalCheckpoint = new Promise<ActorDemoReport>(done => { reachedNormal = done; }), recoveryCheckpoint = new Promise<void>(done => { reachedRecovery = done; });
  EvidenceStore.prototype.writeRecord = async function (name, value) {
    if (name === "report.json" && !(value as ActorDemoReport).recovery) { reachedNormal(value as ActorDemoReport); await normalGate; }
    await write.call(this, name, value);
    if (name === "report.json" && !(value as ActorDemoReport).recovery) { reachedPublished(); await publishedGate; }
  };
  EvidenceStore.prototype.addBytes = async function (owner, bytes, extension, mediaType) {
    if (owner === "budget-ledger-recovered") { reachedRecovery(); await recoveryGate; }
    return add.call(this, owner, bytes, extension, mediaType);
  };
  const running = executeConfiguredActor(directory, registry, scenario, { ...limits, timeoutMs: 500 }, adapter, configuration, { taskPolicy: { finalizationMs: 100 } });
  let recovery: ReturnType<typeof recoverConfiguredActors> | undefined;
  try {
    const candidate = await normalCheckpoint;
    await new Promise(done => setTimeout(done, Math.max(1, Date.parse(candidate.task!.record.spec.deadlineAt) - Date.now() + 15)));
    recovery = recoverConfiguredActors(directory, candidate.runId); await recoveryCheckpoint;
    releaseNormal(); await publishedCheckpoint;
    const file = resolve(directory, ".redteam/actor-runs", candidate.runId, "report.json"), before = await readFile(file);
    releaseRecovery(); assert.equal((await recovery).reports[0]?.status, "existing");
    await assert.rejects(readFile(resolve(file, "../report.md")), /ENOENT/);
    releasePublished(); const result = await running; assert.equal(result.acceptance.status, "accepted");
    assert.deepEqual(await readFile(file), before); assert.equal(fake.requests(), 4);
    const store = new WorkspaceStore(directory);
    try { assert.equal(store.actorRuns().length, 1); assert.equal(store.actorRun(result.runId)?.outcome, "completed"); assert.equal((await readActorReport(store, directory, result.runId, registry)).reports[0]?.decision?.action, "reject"); }
    finally { store.close(); }
  } finally { releaseNormal(); releasePublished(); releaseRecovery(); EvidenceStore.prototype.writeRecord = write; EvidenceStore.prototype.addBytes = add; await running.catch(() => {}); await recovery?.catch(() => {}); }
}));

test("a finishing denied coordinator keeps recovered catalog permissions when recovery stopped before catalog insertion", async () => temporary(async (registry, directory, scenario) => {
  const write = EvidenceStore.prototype.writeRecord, save = WorkspaceStore.prototype.saveActorRun, fake = provider(), { adapter, configuration } = configureInference(profile, secret, fake.transport);
  let release: () => void = () => {}, reached: (report: ActorDemoReport) => void = () => {}, rejectCatalog = true;
  const gate = new Promise<void>(done => { release = done; }), checkpoint = new Promise<ActorDemoReport>(done => { reached = done; });
  EvidenceStore.prototype.writeRecord = async function (name, value) {
    if (name === "report.json" && !(value as ActorDemoReport).recovery) { reached(value as ActorDemoReport); await gate; }
    return write.call(this, name, value);
  };
  WorkspaceStore.prototype.saveActorRun = function (summary) {
    if (rejectCatalog) { rejectCatalog = false; throw new Error("Authored stop before recovery catalog insertion"); }
    save.call(this, summary);
  };
  const running = executeConfiguredActor(directory, registry, scenario, limits, adapter, configuration);
  try {
    const candidate = await checkpoint; assert.equal(candidate.reports[0]?.model, null); assert.equal(fake.requests(), 0);
    assert.equal((await recoverConfiguredActors(directory, candidate.runId)).reports[0]?.status, "unavailable");
    const file = resolve(directory, ".redteam/actor-runs", candidate.runId, "report.json"), bytes = await readFile(file), recovered = JSON.parse(bytes.toString("utf8"));
    assert.equal(recovered.recovery.reason, "unfinished_report");
    release(); const result = await running;
    assert.equal(result.recoveredReport, true); assert.equal(result.createdAt, recovered.generatedAt);
    assert.deepEqual(result.modelVersions, [{ id: scenario.modelId, version: scenario.modelVersion }]); assert.deepEqual(await readFile(file), bytes);
    registry.revokeSource("source", "Synthetic withdrawal after coordinator catalog repair");
    const store = new WorkspaceStore(directory);
    try { assert.equal((await authorizedActorRuns(store, registry, directory))[0]?.restricted, true); await assert.rejects(readActorReport(store, directory, result.runId, registry), /restrict/); }
    finally { store.close(); }
  } finally { release(); EvidenceStore.prototype.writeRecord = write; WorkspaceStore.prototype.saveActorRun = save; await running.catch(() => {}); }
}, false));

test("abandoned staging bytes are never promoted or removed during publication recovery", async () => temporary(async (registry, directory, scenario) => {
  const fake = provider(), { adapter, configuration } = configureInference(profile, secret, fake.transport);
  const result = await executeConfiguredActor(directory, registry, scenario, limits, adapter, configuration);
  const pending = resolve(result.directory, ".redteam-publish-interrupted.pending"), artifactPending = resolve(result.directory, "artifacts/.redteam-publish-interrupted.pending");
  await writeFile(pending, '{"partial":'); await writeFile(artifactPending, '{"unaccepted":'); removeCatalogEntry(directory, result.runId);
  assert.equal((await recoverConfiguredActors(directory, result.runId)).reports[0]?.status, "existing");
  assert.equal(await readFile(pending, "utf8"), '{"partial":'); assert.equal(await readFile(artifactPending, "utf8"), '{"unaccepted":');
  assert((await readdir(result.directory)).includes(".redteam-publish-interrupted.pending")); assert.equal(fake.requests(), 4);
  const store = new WorkspaceStore(directory);
  try { assert.equal((await readActorReport(store, directory, result.runId, registry)).artifacts.length, 4); } finally { store.close(); }
}));

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
    assert.equal(report.artifacts.length, 4);
    assert.equal(report.acceptance?.status, "accepted");
    assert.equal(report.task?.record.state, "completed");
    const manifest = report.artifacts.find(artifact => artifact.owner === "coordinator")!;
    assert.equal(report.task?.record.spec.manifestHash, manifest.sha256);
    assert.equal(report.task?.record.dispatchIntents.length, 2);
    assert.deepEqual(report.task?.record.dispatchIntents.map(item => item.invocationRef).sort(), report.budget?.invocations.map(item => item.id).sort());
    const output = report.artifacts.find(artifact => artifact.id === report.task?.record.output?.artifactRef)!;
    assert.equal(output.sha256, report.task?.record.output?.sha256);
    assert.equal(report.budget?.run.state, "closed");
    assert.equal(report.budget?.invocations.length, 2);
    assert(report.budget?.invocations.every(item => item.state === "settled"));
    assert.deepEqual(report.budget?.pools[0]?.spent, { tokens: "280", costMicrousd: "360" });
    assert.deepEqual(report.budget?.pools[0]?.held, { tokens: "0", costMicrousd: "0" });
    assert.deepEqual(await checkArtifacts(result.directory, report.artifacts), []);
    for (const artifact of report.artifacts) assert(!(await readFile(resolve(result.directory, artifact.path), "utf8")).includes(secret));
    assert(!JSON.stringify(report).includes(secret));
    assert.equal((await authorizedActorRuns(store, registry, directory))[0]?.restricted, false);
    registry.revokeSource("source", "Synthetic withdrawal");
    assert.equal((await authorizedActorRuns(store, registry, directory))[0]?.restricted, true);
    await assert.rejects(readActorReport(store, directory, result.runId, registry), /restrict/);
  } finally { store.close(); }
}));

function localReply(view: Parameters<InferenceAdapter["next"]>[0]) {
  return { action: { type: "decide", decision: { action: "reject", evidenceRefs: ["budget"], constraints: view.constraints,
    rationale: "Synthetic fixture rejects an unaffordable offer", missingInformation: [], limitations: ["Software fixture, not behavior research"], changeConditions: ["Use another scenario"] } }, usage: { inputTokens: 7, outputTokens: 3, costMicrousd: 17 } };
}

test("a worker result is rejected when its task is cancelled before coordinator acceptance", async () => temporary(async (registry, directory, scenario) => {
  scenario.facts[1]!.visibility = "initial";
  const { configuration } = configureInference(profile, secret, provider().transport);
  const backend: InferenceAdapter = { id: "cancelled-output-fixture", mode: "live_model", dataLocation: "local", next: async view => {
    const tasks = new TaskStore(directory);
    try { tasks.cancel(tasks.list()[0]!.spec.id); } finally { tasks.close(); }
    return localReply(view);
  } };
  const result = await executeConfiguredActor(directory, registry, scenario, limits, backend, configuration);
  assert.equal(result.outcome, "limited_coverage"); assert.equal(result.workerOutcome, "completed");
  assert.equal(result.acceptance.status, "rejected"); assert.equal(result.task.record.state, "cancelled");
  assert.equal(result.task.record.output, null); assert.equal(result.decisions[0]?.action, undefined);
  const report = JSON.parse(await readFile(resolve(result.directory, "report.json"), "utf8"));
  assert.equal(report.reports[0].decision, null);
  assert.equal(result.budget.pools[0]?.spent.costMicrousd, "17");
  removeCatalogEntry(directory, result.runId);
  assert.equal((await recoverConfiguredActors(directory, result.runId)).reports[0]?.status, "existing");
  const store = new WorkspaceStore(directory);
  try { assert.equal(store.actorRun(result.runId)?.decisions[0]?.action, undefined); assert.equal((await readActorReport(store, directory, result.runId, registry)).reports[0]?.decision, null); }
  finally { store.close(); }
}));

test("task cancellation between actor steps denies another adapter dispatch", async () => temporary(async (registry, directory, scenario) => {
  const { configuration } = configureInference(profile, secret, provider().transport); let calls = 0;
  const backend: InferenceAdapter = { id: "cancelled-next-step-fixture", mode: "live_model", dataLocation: "local", next: async () => {
    calls++; const tasks = new TaskStore(directory);
    try { tasks.cancel(tasks.list()[0]!.spec.id); } finally { tasks.close(); }
    return { action: { type: "inspect", ref: "budget" }, usage: { inputTokens: 1, outputTokens: 1, costMicrousd: 1 } };
  } };
  const result = await executeConfiguredActor(directory, registry, scenario, limits, backend, configuration);
  assert.equal(calls, 1); assert.equal(result.outcome, "limited_coverage");
  assert.equal(result.task.record.state, "cancelled"); assert.equal(result.budget.invocations.length, 1);
  assert.equal(result.budget.pools[0]?.spent.costMicrousd, "1");
}));

test("concurrent recovery publication is preserved while a cancelled coordinator finishes", async () => temporary(async (registry, directory, scenario) => {
  scenario.facts[1]!.visibility = "initial";
  const { configuration } = configureInference(profile, secret, provider().transport);
  let published = "", directoryOfReport = "";
  const backend: InferenceAdapter = { id: "publication-race-fixture", mode: "live_model", dataLocation: "local", next: async view => {
    const tasks = new TaskStore(directory); let runId: string;
    try { const task = tasks.list()[0]!; runId = task.spec.runId; tasks.cancel(task.spec.id); } finally { tasks.close(); }
    const recovered = await recoverConfiguredActors(directory, runId); assert.equal(recovered.reports[0]?.status, "created");
    directoryOfReport = resolve(directory, ".redteam/actor-runs", runId);
    published = await readFile(resolve(directoryOfReport, "report.json"), "utf8");
    return localReply(view);
  } };
  const result = await executeConfiguredActor(directory, registry, scenario, limits, backend, configuration);
  assert.equal(result.outcome, "limited_coverage"); assert.equal(result.recoveredReport, true);
  assert.equal(result.artifacts, 3); assert.equal(result.acceptance.status, "rejected");
  assert.equal(await readFile(resolve(directoryOfReport, "report.json"), "utf8"), published);
  const report = JSON.parse(published); assert.deepEqual(report.reports, []); assert.deepEqual(await checkArtifacts(directoryOfReport, report.artifacts), []);
  const store = new WorkspaceStore(directory); try { assert.equal(store.actorRuns().length, 1); } finally { store.close(); }
  assert.equal(result.budget.pools[0]?.spent.costMicrousd, "17");
}));

test("expired ownership cannot publish even when the adapter blocks heartbeat timers", async () => temporary(async (registry, directory, scenario) => {
  scenario.facts[1]!.visibility = "initial";
  const { configuration } = configureInference(profile, secret, provider().transport);
  const backend: InferenceAdapter = { id: "expired-output-fixture", mode: "live_model", dataLocation: "local", next: async view => {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    return localReply(view);
  } };
  const result = await executeConfiguredActor(directory, registry, scenario, limits, backend, configuration, { taskPolicy: { leaseMs: 80, heartbeatMs: 10 } });
  assert.equal(result.outcome, "limited_coverage"); assert.equal(result.acceptance.status, "rejected");
  assert.equal(result.task.record.state, "interrupted"); assert.equal(result.task.record.stopReason, "lease_expired");
  assert.equal(result.task.record.output, null); assert.equal(result.decisions[0]?.action, undefined);
  assert.equal(result.budget.pools[0]?.spent.costMicrousd, "17");
}));

test("a healthy long call renews task ownership and keeps one dispatch identity", async () => temporary(async (registry, directory, scenario) => {
  scenario.facts[1]!.visibility = "initial";
  const { configuration } = configureInference(profile, secret, provider().transport);
  const backend: InferenceAdapter = { id: "renewed-lease-fixture", mode: "live_model", dataLocation: "local", next: async view => {
    await new Promise(resolveReply => setTimeout(resolveReply, 600)); return localReply(view);
  } };
  const result = await executeConfiguredActor(directory, registry, scenario, limits, backend, configuration, { taskPolicy: { leaseMs: 250, heartbeatMs: 20 } });
  assert.equal(result.outcome, "completed"); assert.equal(result.task.record.state, "completed");
  assert(result.task.events.some(event => event.kind === "lease_extended"));
  assert.equal(result.task.record.dispatchIntents.length, 1); assert.equal(result.budget.invocations.length, 1);
}));

test("external cancellation stops an uncooperative adapter and retains uncertain spend", async () => temporary(async (registry, directory, scenario) => {
  const { configuration } = configureInference(profile, secret, provider().transport);
  const controller = new AbortController(); let observed: AbortSignal | undefined;
  const backend: InferenceAdapter = { id: "abort-fixture", mode: "live_model", dataLocation: "local", next: async (_, request) => {
    observed = request.signal; controller.abort(); return new Promise(() => {});
  } };
  const result = await executeConfiguredActor(directory, registry, scenario, limits, backend, configuration, { signal: controller.signal });
  assert(observed?.aborted); assert.equal(result.actorOutcome, "cancelled");
  assert.equal(result.task.record.state, "cancelled"); assert.equal(result.task.record.dispatchIntents.length, 1);
  assert.equal(result.budget.invocations[0]?.state, "uncertain"); assert.equal(result.budget.pools[0]?.held.costMicrousd, "10000");
}));

test("external task cancellation aborts a stalled call through the ownership heartbeat", async () => temporary(async (registry, directory, scenario) => {
  const { configuration } = configureInference(profile, secret, provider().transport); let observed: AbortSignal | undefined;
  const backend: InferenceAdapter = { id: "heartbeat-cancel-fixture", mode: "live_model", dataLocation: "local", next: async (_, request) => {
    observed = request.signal; const tasks = new TaskStore(directory);
    try { tasks.cancel(tasks.list()[0]!.spec.id); } finally { tasks.close(); }
    return new Promise(() => {});
  } };
  const started = performance.now();
  const result = await executeConfiguredActor(directory, registry, scenario, limits, backend, configuration, { taskPolicy: { leaseMs: 500, heartbeatMs: 20 } });
  assert(performance.now() - started < 1500); assert(observed?.aborted);
  assert.equal(result.actorOutcome, "cancelled"); assert.equal(result.budget.invocations[0]?.state, "uncertain");
}));

test("restart recovery preserves a killed worker's manifest, invocation identity, and unknown liability", { timeout: 10000 }, async () => temporary(async (_, directory, scenario) => {
  const actorUrl = new URL("../src/actor-execution.ts", import.meta.url).href, registryUrl = new URL("../src/research.ts", import.meta.url).href, taskUrl = new URL("../src/tasks.ts", import.meta.url).href;
  const program = `import {executeConfiguredActor} from ${JSON.stringify(actorUrl)}; import {ResearchRegistry} from ${JSON.stringify(registryUrl)}; import {TaskStore} from ${JSON.stringify(taskUrl)}; const directory=process.argv[1]; const registry=new ResearchRegistry(directory); const adapter={id:"killed-software-fixture",mode:"live_model",dataLocation:"local",next:async()=>{const tasks=new TaskStore(directory); const task=tasks.list()[0]; tasks.close(); process.send({runId:task.spec.runId,taskId:task.spec.id}); return new Promise(()=>{});}}; await executeConfiguredActor(directory,registry,JSON.parse(process.argv[2]),JSON.parse(process.argv[3]),adapter,JSON.parse(process.argv[4]),{taskPolicy:{leaseMs:100,heartbeatMs:10}});`;
  const child = spawn(process.execPath, ["--input-type=module", "-e", program, directory, JSON.stringify(scenario), JSON.stringify({ ...limits, timeoutMs: 5000 }), JSON.stringify(profile)], { stdio: ["ignore", "ignore", "pipe", "ipc"] });
  try {
    const started = await new Promise<{ runId: string; taskId: string }>((resolveStarted, reject) => {
      child.once("message", message => resolveStarted(message as { runId: string; taskId: string })); child.once("error", reject);
      child.once("exit", code => reject(new Error(`Worker ended before dispatch: ${code}`)));
    });
    const exited = new Promise<void>(resolveExit => child.once("exit", () => resolveExit()));
    child.kill("SIGKILL"); await exited;
    await new Promise(resolveExpiry => setTimeout(resolveExpiry, 125));
    const recovered = await recoverConfiguredActors(directory, started.runId); assert.deepEqual(recovered.taskIds, [started.taskId]);
    assert.equal(recovered.reports[0]?.status, "created");
    const tasks = new TaskStore(directory), budget = new BudgetLedger(directory);
    try {
      const task = tasks.task(started.taskId), snapshot = budget.snapshot(started.runId);
      assert.equal(task.state, "interrupted"); assert.equal(task.dispatchIntents.length, 1);
      assert.equal(snapshot.run.state, "closed"); assert.equal(snapshot.invocations[0]?.state, "uncertain");
      assert.equal(task.dispatchIntents[0]?.invocationRef, snapshot.invocations[0]?.id);
      assert.equal(snapshot.pools[0]?.held.costMicrousd, "10000");
      assert.throws(() => tasks.retryBeforeDispatch(started.taskId, task.fence), /pre-dispatch/);
      const artifactFiles = (await import("node:fs/promises")).readdir(resolve(directory, ".redteam/actor-runs", started.runId, "artifacts"));
      assert.equal((await artifactFiles).length, 3);
      const partial = JSON.parse(await readFile(resolve(directory, ".redteam/actor-runs", started.runId, "report.json"), "utf8"));
      assert.equal(partial.outcome, "limited_coverage"); assert.deepEqual(partial.reports, []);
      assert.equal(partial.recovery.acceptedDecisionRecovered, false);
      assert.deepEqual(await checkArtifacts(resolve(directory, ".redteam/actor-runs", started.runId), partial.artifacts), []);
    } finally { tasks.close(); budget.close(); }
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); }
}));

test("unauthorized source processing blocks every fake-provider request and retains a partial report", async () => temporary(async (registry, directory, scenario) => {
  const fake = provider(); const { adapter, configuration } = configureInference(profile, secret, fake.transport);
  const result = await executeConfiguredActor(directory, registry, scenario, limits, adapter, configuration);
  assert.equal(result.outcome, "limited_coverage"); assert.equal(result.actorOutcome, "policy_denied"); assert.equal(fake.requests(), 0);
  assert.equal(result.budget.invocations.length, 0); assert.equal(result.budget.run.state, "closed");
}, false));

test("provider refusal keeps known usage and produces no accepted decision", async () => temporary(async (registry, directory, scenario) => {
  const fake = provider(true); const { adapter, configuration } = configureInference(profile, secret, fake.transport);
  const result = await executeConfiguredActor(directory, registry, scenario, limits, adapter, configuration);
  assert.equal(result.actorOutcome, "adapter_failed"); assert.equal(result.outcome, "limited_coverage");
  assert.equal(result.usage.costMicrousd, 180); assert.equal(result.usage.unreceiptedCalls, 0); assert.equal(fake.requests(), 2);
  assert.equal(result.budget.invocations[0]?.state, "settled"); assert.equal(result.budget.pools[0]?.spent.costMicrousd, "180");
}));

test("provider failure retains durable unknown liability instead of returning the reservation", async () => temporary(async (registry, directory, scenario) => {
  const { adapter, configuration } = configureInference(profile, secret, async () => { throw new Error(`Private provider failure ${secret}`); });
  const result = await executeConfiguredActor(directory, registry, scenario, limits, adapter, configuration);
  assert.equal(result.actorOutcome, "adapter_failed"); assert.equal(result.budget.invocations[0]?.state, "uncertain");
  assert.deepEqual(result.budget.pools[0]?.held, { tokens: "2000", costMicrousd: "10000" });
  assert(!JSON.stringify(result).includes(secret));
  const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
  const child = spawnSync(process.execPath, [cli, "budgets", "show", result.runId], { cwd: directory, encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  const snapshot = JSON.parse(child.stdout); assert.equal(snapshot.invocations[0].state, "uncertain");
  assert(snapshot.events.some((item: { kind: string }) => item.kind === "dispatched"));
}));

test("a late usage receipt reconciles a stopped actor without reopening its run or rewriting its report", async () => temporary(async (registry, directory, scenario) => {
  const { configuration } = configureInference(profile, secret, provider().transport);
  let deliver: (value: unknown) => void = () => { throw new Error("Adapter did not start"); };
  const backend: InferenceAdapter = { id: "late-software-fixture", mode: "live_model", dataLocation: "local", next: async () => new Promise(resolveReply => { deliver = resolveReply; }) };
  const result = await executeConfiguredActor(directory, registry, scenario, { ...limits, timeoutMs: 40 }, backend, configuration);
  assert.equal(result.actorOutcome, "limit_reached"); assert.equal(result.budget.invocations[0]?.state, "uncertain");
  const reportFile = resolve(result.directory, "report.json"); const original = await readFile(reportFile, "utf8");
  deliver({ action: null, usage: { inputTokens: 7, outputTokens: 3, costMicrousd: 17 } });
  await new Promise(resolveTurn => setImmediate(resolveTurn));
  const ledger = new BudgetLedger(directory);
  try {
    const reconciled = ledger.snapshot(result.runId);
    assert.equal(reconciled.run.state, "closed"); assert.equal(reconciled.invocations[0]?.state, "settled");
    assert.deepEqual(reconciled.pools[0]?.spent, { tokens: "10", costMicrousd: "17" });
    assert.deepEqual(reconciled.pools[0]?.held, { tokens: "0", costMicrousd: "0" });
    assert.throws(() => ledger.reserve({ id: "retry", runId: result.runId, taskRef: "actor", pool: "investigation", pricingRef: "fixture", maximum: { tokens: 1, costMicrousd: 1 } }), /new dispatch/);
  } finally { ledger.close(); }
  assert.equal(await readFile(reportFile, "utf8"), original);
  assert.equal(result.budget.invocations[0]?.state, "uncertain");
  removeCatalogEntry(directory, result.runId);
  assert.equal((await recoverConfiguredActors(directory, result.runId)).reports[0]?.status, "existing");
  assert.equal(await readFile(reportFile, "utf8"), original);
}));

test("malformed receipts keep liability while overrun receipts preserve actual usage", async () => temporary(async (registry, directory, scenario) => {
  const { configuration } = configureInference(profile, secret, provider().transport);
  for (const [label, usage] of [["malformed", { inputTokens: -1, outputTokens: 1, costMicrousd: 0 }], ["overrun", { inputTokens: 10, outputTokens: 10, costMicrousd: 15000 }]] as const) {
    const backend: InferenceAdapter = { id: `software-fixture-${label}`, mode: "live_model", dataLocation: "local", next: async () => ({ action: {}, usage }) };
    const result = await executeConfiguredActor(directory, registry, scenario, limits, backend, configuration);
    assert.equal(result.outcome, "limited_coverage");
    if (label === "malformed") {
      assert.equal(result.actorOutcome, "adapter_failed"); assert.equal(result.budget.invocations[0]?.state, "uncertain");
      assert.equal(result.budget.pools[0]?.held.costMicrousd, "10000");
    } else {
      assert.equal(result.actorOutcome, "limit_reached"); assert.equal(result.budget.invocations[0]?.overrun, true);
      assert.equal(result.budget.pools[0]?.spent.costMicrousd, "15000"); assert.equal(result.budget.run.closeReason, "receipt_overrun");
    }
  }
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
