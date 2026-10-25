import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { EvidenceStore, checkArtifacts } from "../src/evidence.ts";
import { TaskStore } from "../src/tasks.ts";
import { BudgetLedger } from "../src/budget.ts";
import { WorkspaceStore } from "../src/workspace.ts";
import { ResearchRegistry } from "../src/research.ts";
import { readActorReport, authorizedActorRuns } from "../src/actor-reports.ts";
import { recoverConfiguredActors } from "../src/actor-recovery.ts";

const scope = { country: "synthetic", language: "en", segment: "fixture", category: "software", decision: "fixture" };
type FixtureOptions = { sealed?: boolean; active?: boolean; completed?: boolean };
async function temporary(work: (context: Awaited<ReturnType<typeof fixture>>) => Promise<void>, options: FixtureOptions = {}) {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-recovery-"));
  const context = await fixture(directory, options);
  try { await work(context); } finally { context.registry.close(); await rm(directory, { recursive: true, force: true }); }
}
async function fixture(directory: string, options: FixtureOptions) {
  const runId = randomUUID(), taskId = randomUUID(), registry = new ResearchRegistry(directory);
  registry.addSource({ id: "source", kind: "synthetic_fixture", title: "Recovery fixture", reference: "fixture:recovery", collectedAt: new Date().toISOString(), method: "Authored software fixture", scope, partition: "grounding", participantRefs: ["synthetic-unit"], consentRef: null,
    permissions: { grounding: true, training: false, evaluation: false }, expiresAt: null, limitations: ["Not human research"], content: { text: "Recovery mechanics only" } });
  const model = registry.addModel({ id: "model", version: "1", domain: "consumer", scope, sourceIds: ["source"], goals: ["Test recovery"], constraints: ["No live calls"], knownInformation: [], decisionRules: ["No predictions"], limitations: ["Synthetic software fixture"] });
  const evidence = await EvidenceStore.create(resolve(directory, ".redteam/actor-runs"), runId);
  const now = options.active ? Date.now() : Date.now() - 2000;
  const deadlineAt = new Date(now + 1000).toISOString();
  const manifest = await evidence.addBytes("coordinator", Buffer.from(JSON.stringify({ schemaVersion: "1.0", kind: "configured_actor_manifest", runId, taskId, model: { id: model.id, version: model.version, hash: model.hash },
    scenario: { id: "fixture", runId, actorRef: "fixture", modelId: model.id, modelVersion: model.version, scope, facts: [] }, coordinatorDeadlineAt: deadlineAt,
    limits: { timeoutMs: 100 }, configuration: { provider: "fixture" } })), "json", "application/json");
  const tasks = new TaskStore(directory, () => now), budget = new BudgetLedger(directory);
  let output;
  try {
    tasks.create({ id: taskId, runId, kind: "actor", questionKey: "fixture", manifestHash: manifest.sha256, maximumAttempts: 1, deadlineAt });
    const lease = tasks.claim(taskId, "fixture-worker", options.active ? 1000 : 100); tasks.start(lease); tasks.recordDispatchIntent(lease, "fixture-invocation");
    budget.createRun({ runId, cap: { tokens: 100, costMicrousd: 100 }, verificationReserve: { tokens: 0, costMicrousd: 0 }, reportReserve: { tokens: 0, costMicrousd: 0 }, deadlineAt: new Date(Date.now() + 60000).toISOString() });
    budget.reserve({ id: "fixture-invocation", runId, taskRef: taskId, pool: "investigation", pricingRef: "fixture", maximum: { tokens: 100, costMicrousd: 100 } }); budget.dispatch("fixture-invocation");
    if (options.sealed || options.completed) {
      output = await evidence.addBytes("worker", Buffer.from(JSON.stringify({ decision: { action: "unaccepted-fixture-candidate" } })), "json", "application/json");
      tasks.seal(lease, { artifactRef: output.id, sha256: output.sha256 });
      if (options.completed) tasks.complete(taskId, output.sha256, lease.fence);
    }
  } finally { tasks.close(); budget.close(); }
  return { directory, runId, taskId, registry, evidence, manifest, output };
}

test("recovery creates a verifiable partial report with no invented actor result", async () => temporary(async ({ directory, runId, taskId, registry, evidence }) => {
  const recovered = await recoverConfiguredActors(directory, runId);
  assert.deepEqual(recovered.taskIds, [taskId]); assert.equal(recovered.reports[0]?.status, "created");
  const store = new WorkspaceStore(directory);
  try {
    const report = await readActorReport(store, directory, runId, registry);
    assert.equal(report.outcome, "limited_coverage"); assert.deepEqual(report.reports, []);
    assert.equal(report.recovery?.acceptedDecisionRecovered, false); assert.equal(report.acceptance?.status, "rejected");
    assert.equal(report.budget?.invocations[0]?.state, "uncertain"); assert.equal(report.budget?.pools[0]?.held.costMicrousd, "100");
    assert.deepEqual(await checkArtifacts(evidence.root, report.artifacts), []); assert.equal(report.artifacts.length, 3);
    assert.equal(store.actorRuns().length, 1); assert.equal(store.actorRun(runId)?.decisions[0]?.action, undefined);
    registry.revokeSource("source", "Synthetic withdrawal");
    assert.equal((await authorizedActorRuns(store, registry, directory))[0]?.restricted, true);
    await assert.rejects(readActorReport(store, directory, runId, registry), /restrict/);
  } finally { store.close(); }
}));

test("recovery is idempotent and repairs a missing catalog entry without rewriting evidence", async () => temporary(async ({ directory, runId, evidence }) => {
  await recoverConfiguredActors(directory, runId);
  const before = await readFile(resolve(evidence.root, "report.json"), "utf8");
  assert.deepEqual((await recoverConfiguredActors(directory, runId)).reports, []);
  const db = new DatabaseSync(resolve(directory, ".redteam/workspace.sqlite"));
  try { db.prepare("DELETE FROM actor_runs WHERE id=?").run(runId); } finally { db.close(); }
  const repaired = await recoverConfiguredActors(directory, runId); assert.equal(repaired.reports[0]?.status, "existing");
  assert.equal(await readFile(resolve(evidence.root, "report.json"), "utf8"), before);
  const store = new WorkspaceStore(directory); try { assert.equal(store.actorRuns().length, 1); assert.deepEqual(store.actorRun(runId)?.modelVersions, [{ id: "model", version: "1" }]); } finally { store.close(); }
}));

test("an unpublished sealed candidate remains unaccepted after deadline recovery", async () => temporary(async ({ directory, runId, taskId, output, registry, evidence }) => {
  const recovered = await recoverConfiguredActors(directory, runId); assert.deepEqual(recovered.taskIds, [taskId]);
  const store = new WorkspaceStore(directory);
  try {
    const report = await readActorReport(store, directory, runId, registry);
    assert.equal(report.task?.record.state, "interrupted"); assert.equal(report.task?.record.output?.sha256, output?.sha256);
    assert.equal(report.artifacts.find(item => item.owner === "sealed-unaccepted-worker")?.id, output?.id);
    assert.deepEqual(report.reports, []); assert.equal(report.acceptance?.status, "rejected");
    assert.deepEqual(await checkArtifacts(evidence.root, report.artifacts), []);
  } finally { store.close(); }
}, { sealed: true }));

test("changed manifests and sealed bytes cannot produce a recovered report", async () => {
  await temporary(async ({ directory, runId, evidence, manifest }) => {
    await writeFile(resolve(evidence.root, manifest.path), "changed manifest");
    const result = await recoverConfiguredActors(directory, runId); assert.equal(result.reports[0]?.status, "unavailable");
    await assert.rejects(readFile(resolve(evidence.root, "report.json")), /ENOENT/);
    const store = new WorkspaceStore(directory); try { assert.equal(store.actorRun(runId), null); } finally { store.close(); }
  });
  await temporary(async ({ directory, runId, evidence, output }) => {
    await writeFile(resolve(evidence.root, output!.path), "changed sealed candidate");
    assert.equal((await recoverConfiguredActors(directory, runId)).reports[0]?.status, "unavailable");
    await assert.rejects(readFile(resolve(evidence.root, "report.json")), /ENOENT/);
  }, { sealed: true });
});

test("recovery denies symbolic-link evidence without reading or changing its target", async () => temporary(async ({ directory, runId, evidence, manifest }) => {
  const outside = resolve(directory, "outside.json"), path = resolve(evidence.root, manifest.path), original = await readFile(path);
  await writeFile(outside, original); await rm(path); await symlink(outside, path);
  assert.equal((await recoverConfiguredActors(directory, runId)).reports[0]?.status, "unavailable");
  assert.deepEqual(await readFile(outside), original); await assert.rejects(readFile(resolve(evidence.root, "report.json")), /ENOENT/);
}));

test("recovery leaves a healthy active task and its held invocation unchanged", async () => temporary(async ({ directory, runId, evidence }) => {
  const recovered = await recoverConfiguredActors(directory, runId); assert.deepEqual(recovered.taskIds, []); assert.deepEqual(recovered.reports, []);
  const tasks = new TaskStore(directory), budget = new BudgetLedger(directory);
  try { assert.equal(tasks.list(runId)[0]?.state, "running"); assert.equal(budget.snapshot(runId).invocations[0]?.state, "in_flight"); } finally { tasks.close(); budget.close(); }
  await assert.rejects(readFile(resolve(evidence.root, "report.json")), /ENOENT/);
}, { active: true }));

test("a completed task produces a factual missing-publication report after its finalization deadline", async () => temporary(async ({ directory, runId, taskId, registry, evidence, output }) => {
  const tasks = new TaskStore(directory), budget = new BudgetLedger(directory), store = new WorkspaceStore(directory);
  try {
    const before = tasks.task(taskId), sealed = await readFile(resolve(evidence.root, output!.path));
    assert.equal((await recoverConfiguredActors(directory, runId)).reports[0]?.status, "created");
    const report = await readActorReport(store, directory, runId, registry);
    assert.equal(report.outcome, "limited_coverage"); assert.deepEqual(report.reports, []);
    assert.deepEqual(report.acceptance, { status: "unavailable", reason: "publication_missing" });
    assert.equal(report.recovery?.reason, "publication_missing"); assert.equal(report.recovery?.acceptedDecisionRecovered, false);
    assert.deepEqual(tasks.task(taskId), before); assert.equal(report.task?.record.state, "completed");
    assert.equal(report.artifacts.find(item => item.id === output!.id)?.owner, "sealed-worker-publication-missing");
    assert.deepEqual(await readFile(resolve(evidence.root, output!.path)), sealed); assert.equal(report.artifacts.length, 4);
    assert.deepEqual(await checkArtifacts(evidence.root, report.artifacts), []);
    assert.equal(budget.snapshot(runId).run.state, "closed"); assert.equal(budget.snapshot(runId).run.closeReason, "publication_missing");
    assert.equal(budget.snapshot(runId).invocations[0]?.state, "uncertain"); assert.equal(budget.snapshot(runId).pools[0]?.held.costMicrousd, "100");
    assert.deepEqual(store.actorRun(runId)?.decisions, [{ outcome: "publication_missing" }]);
    assert.deepEqual((await recoverConfiguredActors(directory, runId)).reports, []);
    registry.revokeSource("source", "Synthetic withdrawal after recovery");
    assert.equal((await authorizedActorRuns(store, registry, directory))[0]?.restricted, true); await assert.rejects(readActorReport(store, directory, runId, registry), /restrict/);
  } finally { tasks.close(); budget.close(); store.close(); }
}, { completed: true }));

test("a completed task inside its finalization window stays pending without any publication or budget change", async () => temporary(async ({ directory, runId, taskId, evidence }) => {
  const tasks = new TaskStore(directory), budget = new BudgetLedger(directory);
  try {
    const taskBefore = tasks.task(taskId), budgetBefore = budget.snapshot(runId);
    assert.deepEqual((await recoverConfiguredActors(directory, runId)).reports, [{ runId, status: "unavailable", reason: "publication_pending" }]);
    assert.deepEqual(tasks.task(taskId), taskBefore); assert.deepEqual(budget.snapshot(runId), budgetBefore);
    await assert.rejects(readFile(resolve(evidence.root, "report.json")), /ENOENT/);
  } finally { tasks.close(); budget.close(); }
}, { completed: true, active: true }));

test("withdrawal blocks missing-publication creation before any ledger closure or report write", async () => temporary(async ({ directory, runId, registry, evidence }) => {
  const budget = new BudgetLedger(directory);
  try {
    const before = budget.snapshot(runId); registry.revokeSource("source", "Synthetic withdrawal before recovery");
    assert.deepEqual((await recoverConfiguredActors(directory, runId)).reports, [{ runId, status: "unavailable", reason: "research_restricted" }]);
    assert.deepEqual(budget.snapshot(runId), before); await assert.rejects(readFile(resolve(evidence.root, "report.json")), /ENOENT/);
  } finally { budget.close(); }
}, { completed: true }));

test("concurrent missing-publication recovery and later catalog repair preserve one unavailable decision record", async () => temporary(async ({ directory, runId, registry, evidence }) => {
  const results = await Promise.all([recoverConfiguredActors(directory, runId), recoverConfiguredActors(directory, runId)]);
  assert(results.every(item => ["created", "existing"].includes(item.reports[0]?.status ?? "")));
  const before = await readFile(resolve(evidence.root, "report.json"));
  const db = new DatabaseSync(resolve(directory, ".redteam/workspace.sqlite"));
  try { db.prepare("DELETE FROM actor_runs WHERE id=?").run(runId); } finally { db.close(); }
  assert.equal((await recoverConfiguredActors(directory, runId)).reports[0]?.status, "existing");
  const store = new WorkspaceStore(directory);
  try {
    assert.equal(store.actorRuns().length, 1); assert.deepEqual(store.actorRun(runId)?.decisions, [{ outcome: "publication_missing" }]);
    assert.equal((await readActorReport(store, directory, runId, registry)).acceptance?.status, "unavailable");
  } finally { store.close(); }
  assert.deepEqual(await readFile(resolve(evidence.root, "report.json")), before);
}, { completed: true }));

test("missing-publication catalog repair rechecks current research permission", async () => temporary(async ({ directory, runId, registry, evidence }) => {
  await recoverConfiguredActors(directory, runId);
  const before = await readFile(resolve(evidence.root, "report.json")), db = new DatabaseSync(resolve(directory, ".redteam/workspace.sqlite"));
  try { db.prepare("DELETE FROM actor_runs WHERE id=?").run(runId); } finally { db.close(); }
  registry.revokeSource("source", "Synthetic withdrawal before partial catalog repair");
  assert.equal((await recoverConfiguredActors(directory, runId)).reports[0]?.reason, "research_restricted");
  const store = new WorkspaceStore(directory); try { assert.equal(store.actorRun(runId), null); } finally { store.close(); }
  assert.deepEqual(await readFile(resolve(evidence.root, "report.json")), before);
}, { completed: true }));

test("changed sealed bytes cannot produce a completed-task publication-gap report", async () => temporary(async ({ directory, runId, evidence, output }) => {
  await writeFile(resolve(evidence.root, output!.path), "changed completed output");
  assert.equal((await recoverConfiguredActors(directory, runId)).reports[0]?.reason, "missing_or_invalid_records");
  await assert.rejects(readFile(resolve(evidence.root, "report.json")), /ENOENT/);
}, { completed: true }));

test("withdrawal during recovery artifact writing prevents final JSON publication", async () => temporary(async ({ directory, runId, registry, evidence }) => {
  const original = EvidenceStore.prototype.addBytes;
  EvidenceStore.prototype.addBytes = async function (owner, bytes, extension, mediaType) {
    const artifact = await original.call(this, owner, bytes, extension, mediaType);
    if (owner === "budget-ledger-recovered") registry.revokeSource("source", "Synthetic withdrawal during recovery");
    return artifact;
  };
  try {
    assert.equal((await recoverConfiguredActors(directory, runId)).reports[0]?.reason, "research_restricted");
    await assert.rejects(readFile(resolve(evidence.root, "report.json")), /ENOENT/);
    const store = new WorkspaceStore(directory); try { assert.equal(store.actorRun(runId), null); } finally { store.close(); }
  } finally { EvidenceStore.prototype.addBytes = original; }
}, { completed: true }));

test("legacy empty catalog model references cannot bypass recovery report withdrawal", async () => temporary(async ({ directory, runId, registry }) => {
  await recoverConfiguredActors(directory, runId);
  const store = new WorkspaceStore(directory), database = new DatabaseSync(resolve(directory, ".redteam/workspace.sqlite"));
  try {
    const summary = store.actorRun(runId)!; summary.modelVersions = [];
    database.prepare("UPDATE actor_runs SET document=? WHERE id=?").run(JSON.stringify(summary), runId);
    assert.equal((await readActorReport(store, directory, runId, registry)).recovery?.reason, "publication_missing");
    registry.revokeSource("source", "Synthetic withdrawal with a legacy catalog gap");
    assert.equal((await authorizedActorRuns(store, registry, directory))[0]?.restricted, true);
    await assert.rejects(readActorReport(store, directory, runId, registry), /restrict/);
  } finally { store.close(); database.close(); }
}, { completed: true }));

test("changed manifest bytes cannot supply recovery permissions through an empty catalog", async () => temporary(async ({ directory, runId, registry, evidence, manifest }) => {
  await recoverConfiguredActors(directory, runId);
  const store = new WorkspaceStore(directory), database = new DatabaseSync(resolve(directory, ".redteam/workspace.sqlite"));
  try {
    const summary = store.actorRun(runId)!; summary.modelVersions = [];
    database.prepare("UPDATE actor_runs SET document=? WHERE id=?").run(JSON.stringify(summary), runId);
    await writeFile(resolve(evidence.root, manifest.path), JSON.stringify({ model: null }));
    assert.equal((await authorizedActorRuns(store, registry, directory))[0]?.restricted, true);
    await assert.rejects(readActorReport(store, directory, runId, registry), /restrict/);
  } finally { store.close(); database.close(); }
}, { completed: true }));
