import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir, unlink, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";
import { WorkspaceStore } from "../src/workspace.ts";
import { grantAccess } from "../src/access.ts";
import { captureRepository } from "../src/repository.ts";
import { registerEngineeringObservations } from "../src/engineering.ts";
import { createTrackedAction, updateTrackedAction } from "../src/actions.ts";
import { freezeExperimentPlan, readExperimentPlan, experimentPlanSummaries, validateExperimentPlan } from "../src/experiments.ts";
import type { ExperimentPlanInput } from "../src/experiments.ts";
import type { ActionRecord } from "../src/domain/actions.ts";
import { sha256 } from "../src/evidence.ts";
import { createLocalServer } from "../src/server.ts";
import { runStudy } from "../src/runner.ts";
const project = resolve(import.meta.dirname, ".."), execute = promisify(execFile);
type Context = { directory: string; store: WorkspaceStore; grantId: string; snapshotDirectory: string; action: ActionRecord; input: ExperimentPlanInput };
async function fixture(work: (c: Context) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-experiments-")), source = resolve(directory, "app"); await mkdir(source); const store = new WorkspaceStore(directory);
  try {
    const text = "export {};\n"; await writeFile(resolve(source, "app.ts"), text);
    const grant = grantAccess(store, { name: "Owned source", target: source, kind: "directory", capabilities: ["code:read"] }), snapshot = await captureRepository(store, { grantId: grant.id, target: source });
    const notes = await registerEngineeringObservations(store, { schemaVersion: "1.0", kind: "engineering_observation_input", snapshotRunId: snapshot.runId, requirements: [], observations: [{ id: "OBS-1", type: "source_observation", statement: "Owned unreviewed note", requirementId: null, citations: [{ sourcePath: "app.ts", fileSha256: sha256(text), startLine: 1, endLine: 1 }] }] });
    const action = await createTrackedAction(store, { schemaVersion: "1.0", kind: "action_input", origin: { kind: "engineering_observation", runId: notes.runId, itemId: "OBS-1" }, title: "Owned fixture investigation", owner: "Operator", nextStep: "Plan a separate controlled check.", validationMethod: "Separate approved evidence." });
    const input: ExperimentPlanInput = { schemaVersion: "1.0", kind: "experiment_plan_input", actionId: action.id, expectedActionRevision: 1, title: "PRIVATE_PLAN_TITLE", owner: "Local operator label", hypothesis: "A future fixture change may meet the supplied requirement.", intervention: "A planned owned fixture change; no action occurs on freeze.", outcome: { measure: "Future controlled requirement assertion", successRule: "The predeclared assertion passes in a fresh pair.", collectionMethod: "Separate saved controlled evidence; not collected by this plan." }, samplePlan: { population: "Owned software fixture runs only", recruitment: "No participant research or recruitment occurs.", targetCount: 2 }, horizon: { startsAt: new Date(Date.now() + 60_000).toISOString(), endsAt: new Date(Date.now() + 3_600_000).toISOString() } };
    await work({ directory, store, grantId: grant.id, snapshotDirectory: snapshot.directory, action, input });
  } finally { store.close(); await rm(directory, { recursive: true, force: true }); }
}
const update = { schemaVersion: "1.0", kind: "action_update", expectedRevision: 1, status: "in_progress", note: "Operator declaration only." };

test("freezing preserves exact supplied input and historical action without performing work or collecting outcomes", async () => fixture(async c => {
  const original = structuredClone(c.input), summary = await freezeExperimentPlan(c.store, c.input), report = await readExperimentPlan(c.store, summary.id);
  assert.deepEqual(report.plan, original); assert.deepEqual(c.input, original); assert.equal(report.state, "plan_frozen"); assert.equal(report.execution, "not_started_by_tracking"); assert.equal(report.outcomeStatus, "not_collected"); assert.equal(report.independentOutcomeVerification, "not_assessed"); assert.equal(report.provenance.semanticReview, "unreviewed"); assert.equal(report.provenance.protocolReview, "not_assessed"); assert.equal(report.provenance.chronology, "local_clock_only");
  assert.equal(report.artifacts.length, 2); assert.equal(report.actionVersion.sha256, sha256(JSON.stringify(c.action))); assert.deepEqual(c.store.action(c.action.id), c.action); assert.equal(c.store.actionEvents(c.action.id).length, 1); assert.equal(c.store.jobs().length, 0); assert.equal(c.store.actorRuns().length, 0); assert.equal(experimentPlanSummaries(c.store)[0]?.recordStatus, "cataloged_unverified");
  const inputArtifact = report.artifacts.find(item => item.owner === "experiment-plan-input")!; assert.deepEqual(JSON.parse(await readFile(resolve(summary.directory, inputArtifact.path), "utf8")), original);
}));

test("later declared action updates preserve the frozen historical version and require a fresh revision for a new plan", async () => fixture(async c => {
  const summary = await freezeExperimentPlan(c.store, c.input); await updateTrackedAction(c.store, c.action.id, update);
  assert.equal((await readExperimentPlan(c.store, summary.id)).actionVersion.revision, 1); assert.equal(experimentPlanSummaries(c.store).length, 1);
  await assert.rejects(freezeExperimentPlan(c.store, c.input), /action changed/i);
  const newer = await freezeExperimentPlan(c.store, { ...c.input, expectedActionRevision: 2 }); assert.equal((await readExperimentPlan(c.store, newer.id)).actionVersion.revision, 2); assert.equal(c.store.recentExperimentPlans().length, 2);
}));

test("input cannot promote execution, outcomes, research authority, or sample declarations", async () => fixture(async c => {
  for (const value of [{ ...c.input, outcomeStatus: "verified" }, { ...c.input, provenance: { semanticReview: "approved" } }, { ...c.input, execute: true }, { ...c.input, expectedActionRevision: 0 }, { ...c.input, title: "x".repeat(201) }, { ...c.input, owner: " " }, { ...c.input, samplePlan: { ...c.input.samplePlan, targetCount: 0 } }, { ...c.input, samplePlan: { ...c.input.samplePlan, targetCount: 100_001 } }, { ...c.input, outcome: { ...c.input.outcome, observed: "pass" } }, { ...c.input, hypothesis: "bad\u0000text" }]) assert.throws(() => validateExperimentPlan(value));
  assert.deepEqual(c.store.recentExperimentPlans(), []);
}));

test("accessor and toJSON input are rejected without executing user code", async () => fixture(async c => {
  let calls = 0; const getter = { ...c.input }; Object.defineProperty(getter, "title", { enumerable: true, get() { calls++; return "bad"; } });
  assert.throws(() => validateExperimentPlan(getter), /plain JSON/); assert.equal(calls, 0);
  assert.throws(() => validateExperimentPlan({ ...c.input, toJSON() { calls++; return c.input; } }), /plain JSON/); assert.equal(calls, 0);
  const cyclic: Record<string, unknown> = { ...c.input }; cyclic.outcome = cyclic; assert.throws(() => validateExperimentPlan(cyclic), /plain JSON/);
}));

test("planned windows reject past, invalid, reversed, excessive, or noncanonical local ordering", async () => fixture(async c => {
  const now = Date.now();
  for (const horizon of [{ startsAt: new Date(now - 1).toISOString(), endsAt: new Date(now + 1000).toISOString() }, { startsAt: c.input.horizon.startsAt, endsAt: c.input.horizon.startsAt }, { startsAt: c.input.horizon.endsAt, endsAt: c.input.horizon.startsAt }, { startsAt: c.input.horizon.startsAt, endsAt: new Date(now + 368 * 86_400_000).toISOString() }, { startsAt: new Date(now + 731 * 86_400_000).toISOString(), endsAt: new Date(now + 732 * 86_400_000).toISOString() }, { startsAt: "2026-02-31T00:00:00.000Z", endsAt: c.input.horizon.endsAt }, { startsAt: c.input.horizon.startsAt.replace(".000Z", "Z").replace("Z", "+00:00"), endsAt: c.input.horizon.endsAt }]) await assert.rejects(freezeExperimentPlan(c.store, { ...c.input, horizon }));
  assert.deepEqual(c.store.recentExperimentPlans(), []);
}));

test("a passed planned window cannot imply execution or a collected outcome", async context => fixture(async c => {
  const summary = await freezeExperimentPlan(c.store, c.input); context.mock.method(Date, "now", () => Date.parse(c.input.horizon.endsAt) + 1);
  const report = await readExperimentPlan(c.store, summary.id); assert.equal(report.outcomeStatus, "not_collected"); assert.equal(report.execution, "not_started_by_tracking"); assert.equal(report.independentOutcomeVerification, "not_assessed");
}));

test("revoked source permission hides plans and denies reads and new freezes", async () => fixture(async c => {
  const summary = await freezeExperimentPlan(c.store, c.input); c.store.revokeGrant(c.grantId); assert.deepEqual(experimentPlanSummaries(c.store), []); await assert.rejects(readExperimentPlan(c.store, summary.id), /revoked/); await assert.rejects(freezeExperimentPlan(c.store, c.input), /revoked/);
}));

test("expired source permission also denies the whole frozen plan", async context => fixture(async c => {
  const summary = await freezeExperimentPlan(c.store, c.input); context.mock.method(Date, "now", () => Date.parse(c.store.grant(c.grantId)!.expiresAt) + 1); assert.deepEqual(experimentPlanSummaries(c.store), []); await assert.rejects(readExperimentPlan(c.store, summary.id), /expired/);
}));

test("changed source artifacts deny frozen plan retrieval and new publication", async () => fixture(async c => {
  const summary = await freezeExperimentPlan(c.store, c.input), source = JSON.parse(await readFile(resolve(c.snapshotDirectory, "report.json"), "utf8")); await writeFile(resolve(c.snapshotDirectory, source.artifacts[0].path), "changed");
  await assert.rejects(readExperimentPlan(c.store, summary.id), /evidence has changed/); await assert.rejects(freezeExperimentPlan(c.store, c.input), /evidence has changed/); assert.equal(c.store.recentExperimentPlans().length, 1);
}));

test("frozen publication, input artifact, and unsafe artifact links are checked", async () => fixture(async c => {
  const summary = await freezeExperimentPlan(c.store, c.input), report = await readExperimentPlan(c.store, summary.id), path = resolve(summary.directory, "report.json"), bytes = await readFile(path), artifact = report.artifacts[0]!, artifactPath = resolve(summary.directory, artifact.path), content = await readFile(artifactPath);
  await writeFile(path, "{}"); await assert.rejects(readExperimentPlan(c.store, summary.id), /publication has changed/); await writeFile(path, bytes);
  await writeFile(artifactPath, "{}"); await assert.rejects(readExperimentPlan(c.store, summary.id), /artifact has changed/); await unlink(artifactPath); const outside = resolve(c.directory, "outside-artifact"); await writeFile(outside, content); await symlink(outside, artifactPath); await assert.rejects(readExperimentPlan(c.store, summary.id));
}));

test("changed historical action content cannot be adopted under the old revision pin", async () => fixture(async c => {
  const summary = await freezeExperimentPlan(c.store, c.input); await updateTrackedAction(c.store, c.action.id, update); const db = new DatabaseSync(resolve(c.directory, ".redteam/workspace.sqlite"));
  try { const event = c.store.actionEvents(c.action.id)[0]!; event.after.title = "altered historical content"; db.prepare("UPDATE action_events SET document=? WHERE action_id=? AND revision=1").run(JSON.stringify(event), c.action.id); } finally { db.close(); }
  assert.deepEqual(experimentPlanSummaries(c.store), []); await assert.rejects(readExperimentPlan(c.store, summary.id), /frozen action version/);
}));

test("source withdrawal at insertion rolls back catalog and audit while preserving orphan bytes", async () => fixture(async c => {
  const original = c.store.saveExperimentPlan.bind(c.store); c.store.saveExperimentPlan = (...args) => { c.store.revokeGrant(c.grantId); return original(...args); };
  await assert.rejects(freezeExperimentPlan(c.store, c.input), /revoked/); assert.deepEqual(c.store.recentExperimentPlans(), []); assert(!c.store.auditLog().some(event => event.action === "experiment_plan_frozen"));
  const dirs = await readdir(resolve(c.directory, ".redteam/experiments")); assert.equal(dirs.length, 1); assert(await readFile(resolve(c.directory, ".redteam/experiments", dirs[0]!, "report.json")));
}));

test("a revision race at insertion cannot freeze an outdated action", async () => fixture(async c => {
  const original = c.store.saveExperimentPlan.bind(c.store); c.store.saveExperimentPlan = (...args) => { c.store.saveAction({ ...c.action, revision: 2, status: "blocked", updatedAt: new Date().toISOString() }, 1, "Competing operator declaration", () => undefined); return original(...args); };
  await assert.rejects(freezeExperimentPlan(c.store, c.input), /action changed/i); assert.equal(c.store.action(c.action.id)?.revision, 2); assert.deepEqual(c.store.recentExperimentPlans(), []);
}));

test("a planned start crossed during publication is rechecked inside insertion", async context => fixture(async c => {
  const original = c.store.saveExperimentPlan.bind(c.store); c.store.saveExperimentPlan = (...args) => { context.mock.method(Date, "now", () => Date.parse(c.input.horizon.startsAt) + 1); return original(...args); };
  await assert.rejects(freezeExperimentPlan(c.store, c.input), /must start after freeze/); assert.deepEqual(c.store.recentExperimentPlans(), []);
}));

test("catalog checks are synchronous and immutable with atomic audit behavior", async () => fixture(async c => {
  const summary = await freezeExperimentPlan(c.store, c.input), audit = c.store.auditLog();
  assert.throws(() => c.store.saveExperimentPlan({ ...summary, id: randomUUID() }, (async () => undefined) as unknown as () => undefined), /synchronously/); assert.throws(() => c.store.saveExperimentPlan(summary, () => undefined)); assert.equal(c.store.recentExperimentPlans().length, 1); assert.deepEqual(c.store.auditLog(), audit);
}));

test("CLI and API freeze supplied plans, enforce expected revisions, and deny unavailable detail without private text", async () => fixture(async c => {
  const cli = resolve(project, "src/cli.ts"), file = resolve(c.directory, "plan.json"); await writeFile(file, JSON.stringify(c.input));
  const summary = JSON.parse((await execute(process.execPath, [cli, "experiments", "freeze", file], { cwd: c.directory })).stdout), report = JSON.parse((await execute(process.execPath, [cli, "experiments", "show", summary.id], { cwd: c.directory })).stdout); assert.equal(report.outcomeStatus, "not_collected"); assert.equal(JSON.parse((await execute(process.execPath, [cli, "experiments", "list"], { cwd: c.directory })).stdout).experimentPlans.length, 1);
  const server = await createLocalServer({ workspace: c.directory, assetsRoot: project, port: 0 });
  try {
    assert.equal((await fetch(server.origin + "/api/experiments")).status, 401); const headers = { Authorization: `Bearer ${server.token}`, "Content-Type": "application/json" };
    const response = await fetch(server.origin + "/api/experiments", { method: "POST", headers, body: JSON.stringify(c.input) }); assert.equal(response.status, 201); assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await fetch(server.origin + `/api/experiments/${summary.id}`, { headers })).status, 200);
    assert.equal((await fetch(server.origin + "/api/experiments", { method: "POST", headers, body: JSON.stringify({ ...c.input, outcomeStatus: "verified" }) })).status, 400);
    await updateTrackedAction(c.store, c.action.id, update); assert.equal((await fetch(server.origin + "/api/experiments", { method: "POST", headers, body: JSON.stringify(c.input) })).status, 409);
    assert.equal((await fetch(server.origin + `/api/experiments/${summary.id}/outcomes`, { method: "POST", headers, body: "{}" })).status, 404);
    c.store.revokeGrant(c.grantId); const denied = await fetch(server.origin + `/api/experiments/${summary.id}`, { headers }); assert.equal(denied.status, 404); const text = await denied.text(); assert(!text.includes("PRIVATE_PLAN_TITLE")); assert(!text.includes(c.directory)); assert.deepEqual((await (await fetch(server.origin + "/api/experiments", { headers })).json() as { experimentPlans: unknown[] }).experimentPlans, []);
  } finally { await server.close(); }
}));

test("an actual controlled browser finding can anchor a plan with distinct review and evidence IDs", { timeout: 60000 }, async () => fixture(async c => {
  const study = JSON.parse(await readFile(resolve(project, "examples/pilot-signup.study.json"), "utf8")), capture = await runStudy(study, { projectRoot: project, outputRoot: resolve(c.directory, ".redteam/runs"), variant: "broken" }), report = capture.report, reviewId = randomUUID();
  c.store.saveJob({ id: reviewId, variant: "broken", status: "completed", createdAt: report.manifest.createdAt, updatedAt: report.generatedAt, reportDirectory: capture.directory, findingCount: 1, artifactCount: report.artifacts.length, error: null });
  const action = await createTrackedAction(c.store, { schemaVersion: "1.0", kind: "action_input", origin: { kind: "browser_finding", runId: reviewId, itemId: report.findings[0]!.id }, title: "Plan fixture check", owner: "Local operator", nextStep: "Plan a check.", validationMethod: "Separate evidence." }), summary = await freezeExperimentPlan(c.store, { ...c.input, actionId: action.id });
  const frozen = await readExperimentPlan(c.store, summary.id); assert.equal(frozen.actionVersion.origin.runId, reviewId); assert.equal(frozen.actionVersion.origin.evidenceRunId, report.runId); assert.notEqual(reviewId, report.runId); assert.equal(c.store.jobs().length, 1);
  c.store.saveJob({ ...c.store.job(reviewId)!, status: "failed" }); await assert.rejects(readExperimentPlan(c.store, summary.id), /browser review is unavailable/);
}));
