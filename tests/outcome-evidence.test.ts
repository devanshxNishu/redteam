import test, { before, after } from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { request } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { WorkspaceStore } from "../src/workspace.ts";
import { runStudy } from "../src/runner.ts";
import type { ReviewReport } from "../src/domain/review.ts";
import { createTrackedAction, updateTrackedAction } from "../src/actions.ts";
import type { ActionRecord } from "../src/domain/actions.ts";
import { freezeExperimentPlan, readExperimentPlan } from "../src/experiments.ts";
import type { ExperimentPlanInput, ExperimentPlanSummary } from "../src/experiments.ts";
import { createStoredComparison, readStoredComparison } from "../src/comparisons.ts";
import type { ComparisonSummary } from "../src/comparisons.ts";
import { outcomeEvidenceSummaries, readOutcomeEvidence, registerOutcomeEvidence, validateOutcomeEvidenceInput } from "../src/outcome-evidence.ts";
import { sha256 } from "../src/evidence.ts";
import { grantAccess } from "../src/access.ts";
import { captureRepository } from "../src/repository.ts";
import { registerEngineeringObservations } from "../src/engineering.ts";
import { createLocalServer } from "../src/server.ts";
import { createReportExport, readReportExport, reportExportSummaries } from "../src/report-export.ts";
const project = resolve(import.meta.dirname, ".."), execute = promisify(execFile);
type Context = { directory: string; store: WorkspaceStore; action: ActionRecord; plan: ExperimentPlanSummary; comparison: ComparisonSummary; baselineId: string; candidateId: string; a: ReviewReport; b: ReviewReport; aDir: string; bDir: string; planInput: ExperimentPlanInput };
let seed: Context;
function planInput(action: ActionRecord, startsAt: string, endsAt: string): ExperimentPlanInput { return { schemaVersion: "1.0", kind: "experiment_plan_input", actionId: action.id, expectedActionRevision: 1, title: "Owned controlled fixture plan", owner: "Operator label", hypothesis: "A separate controlled candidate may meet the saved requirement.", intervention: "Planned owned fixture change; not executed by registration.", outcome: { measure: "Captured requirement assertion", successRule: "The supplied expected heading appears.", collectionMethod: "Separate controlled primary and verifier evidence." }, samplePlan: { population: "Owned software fixtures only", recruitment: "No human participants", targetCount: 2 }, horizon: { startsAt, endsAt } }; }
async function actionFor(store: WorkspaceStore, runId: string, itemId: string, kind: "browser_finding" | "engineering_observation" = "browser_finding") { return createTrackedAction(store, { schemaVersion: "1.0", kind: "action_input", origin: { kind, runId, itemId }, title: "Investigate owned fixture", owner: "Operator label", nextStep: "Plan a separate check.", validationMethod: "Separate captured evidence, with no causal assertion." }); }
function saveJob(store: WorkspaceStore, report: ReviewReport, directory: string, id = randomUUID()) { store.saveJob({ id, variant: report.manifest.fixtureVariant, status: "completed", createdAt: report.manifest.createdAt, updatedAt: report.generatedAt, reportDirectory: directory, findingCount: report.findings.length, artifactCount: report.artifacts.length, error: null }); return id; }
before(async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-outcome-real-seed-")), store = new WorkspaceStore(directory), study = JSON.parse(await readFile(resolve(project, "examples/pilot-signup.study.json"), "utf8"));
  const baseline = await runStudy(study, { projectRoot: project, outputRoot: resolve(directory, ".redteam/runs"), variant: "broken" }), baselineId = saveJob(store, baseline.report, baseline.directory), action = await actionFor(store, baselineId, baseline.report.findings[0]!.id);
  const input = planInput(action, new Date(Date.now() + 1000).toISOString(), new Date(Date.now() + 3_600_000).toISOString()), plan = await freezeExperimentPlan(store, input);
  await new Promise(resolve => setTimeout(resolve, Math.max(0, Date.parse(input.horizon.startsAt) - Date.now() + 5)));
  const candidate = await runStudy(study, { projectRoot: project, outputRoot: resolve(directory, ".redteam/runs"), variant: "fixed" }), candidateId = saveJob(store, candidate.report, candidate.directory), comparison = await createStoredComparison(store, { baselineReviewId: baselineId, candidateReviewId: candidateId });
  seed = { directory, store, action, plan, comparison, baselineId, candidateId, a: baseline.report, b: candidate.report, aDir: baseline.directory, bDir: candidate.directory, planInput: input };
});
after(async () => { if (seed) { seed.store.close(); await rm(seed.directory, { recursive: true, force: true }); } });
// Negative cases use authored local-clock plan fixtures over copied real captures, not new prospective runs or human observations.
async function fixture(t: TestContext, work: (c: Context) => Promise<void>, horizon = seed.planInput.horizon): Promise<void> {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-outcome-fixture-")), store = new WorkspaceStore(directory);
  try {
    const aDir = resolve(directory, ".redteam/runs", seed.a.runId), bDir = resolve(directory, ".redteam/runs", seed.b.runId); await mkdir(resolve(aDir, ".."), { recursive: true }); await cp(seed.aDir, aDir, { recursive: true }); await cp(seed.bDir, bDir, { recursive: true });
    const baselineId = saveJob(store, seed.a, aDir), candidateId = saveJob(store, seed.b, bDir); let action: ActionRecord, plan: ExperimentPlanSummary, input: ExperimentPlanInput;
    t.mock.timers.enable({ apis: ["Date"], now: Date.parse(seed.plan.frozenAt) });
    try { action = await actionFor(store, baselineId, seed.a.findings[0]!.id); input = planInput(action, horizon.startsAt, horizon.endsAt); plan = await freezeExperimentPlan(store, input); } finally { t.mock.timers.reset(); }
    const comparison = await createStoredComparison(store, { baselineReviewId: baselineId, candidateReviewId: candidateId });
    await work({ directory, store, action, plan, comparison, baselineId, candidateId, a: structuredClone(seed.a), b: structuredClone(seed.b), aDir, bDir, planInput: input });
  } finally { t.mock.timers.reset(); store.close(); await rm(directory, { recursive: true, force: true }); }
}
const selection = (c: Context) => ({ schemaVersion: "1.0", kind: "controlled_outcome_evidence_input", planId: c.plan.id, comparisonId: c.comparison.id, note: "Operator-supplied unreviewed note; no result adjudication." });
const database = (c: Context) => new DatabaseSync(resolve(c.directory, ".redteam/workspace.sqlite"));
async function reseal(directory: string, report: ReviewReport) { for (const execution of report.executions) { const artifact = report.artifacts.find(item => execution.artifactIds.includes(item.id) && item.mediaType === "application/json")!, bytes = Buffer.from(JSON.stringify({ ...execution, artifactIds: execution.artifactIds.filter(id => id !== artifact.id) }, null, 2) + "\n"); await writeFile(resolve(directory, artifact.path), bytes); artifact.sha256 = sha256(bytes); artifact.bytes = bytes.length; } await writeFile(resolve(directory, "report.json"), JSON.stringify(report, null, 2) + "\n"); }

test("real prospective controlled capture links exact lineage without adjudicating or promoting any source", async () => {
  const c = seed, before = await Promise.all([readFile(resolve(c.aDir, "report.json")), readFile(resolve(c.bDir, "report.json")), readFile(resolve(c.plan.directory, "report.json")), readFile(resolve(c.comparison.directory, "report.json"))]), action = c.store.action(c.action.id), events = c.store.actionEvents(c.action.id), summary = await registerOutcomeEvidence(c.store, selection(c)), report = await readOutcomeEvidence(c.store, summary.id);
  assert.equal(report.state, "evidence_registered"); assert.equal(report.observation.verdict, "mismatch_not_observed_in_candidate"); assert.equal(report.assessment.hypothesisResolution, "not_assessed"); assert.equal(report.assessment.independentOutcomeVerification, "not_established"); assert.equal(report.assessment.plannedIntervention, "not_verified"); assert.equal(report.assessment.sampleAdequacy, "not_assessed"); assert.equal(report.assessment.causalAttribution, "not_assessed"); assert.equal(report.execution, "not_performed_by_tracking"); assert.equal(report.artifacts.length, 2);
  assert.deepEqual(report.input, selection(c)); assert.equal(report.sources.plan.reportSha256, c.plan.reportSha256); assert.equal(report.sources.comparison.baseline.reviewId, c.baselineId); assert.notEqual(c.baselineId, c.a.runId); assert.notEqual(c.candidateId, c.b.runId);
  assert.deepEqual(c.store.action(c.action.id), action); assert.deepEqual(c.store.actionEvents(c.action.id), events); assert.equal((await readExperimentPlan(c.store, c.plan.id)).outcomeStatus, "not_collected"); assert.equal(c.store.jobs().length, 2); assert.equal(c.store.actorRuns().length, 0);
  assert.deepEqual(await Promise.all([readFile(resolve(c.aDir, "report.json")), readFile(resolve(c.bDir, "report.json")), readFile(resolve(c.plan.directory, "report.json")), readFile(resolve(c.comparison.directory, "report.json"))]), before);
  const metadata = outcomeEvidenceSummaries(c.store); assert.equal(metadata[0]!.recordStatus, "cataloged_unverified"); assert(!JSON.stringify(metadata).includes(c.directory)); assert(!JSON.stringify(metadata).includes("Operator-supplied"));
});
test("later legitimate action declarations preserve the frozen revision and old evidence link", async t => fixture(t, async c => {
  const saved = await registerOutcomeEvidence(c.store, selection(c)); await updateTrackedAction(c.store, c.action.id, { schemaVersion: "1.0", kind: "action_update", expectedRevision: 1, status: "completed_declared", note: "Declaration, not verification." });
  const report = await readOutcomeEvidence(c.store, saved.id); assert.equal(report.sources.actionVersion.revision, 1); assert.equal(c.store.action(c.action.id)!.verificationStatus, "not_independently_verified"); assert.equal((await readExperimentPlan(c.store, c.plan.id)).outcomeStatus, "not_collected");
}));
test("strict input refuses outcome claims, arbitrary files, unknown fields, invalid notes, getters and serializers", () => {
  const input = selection(seed); for (const value of [null, [], { ...input, kind: "human_outcome" }, { ...input, outcome: "success" }, { ...input, path: "/private" }, { ...input, note: " " }, { ...input, note: "x".repeat(2001) }, { ...input, note: "bad\u0000note" }, { ...input, planId: "../secret" }, { ...input, assessment: { hypothesisResolution: "pass" } }]) assert.throws(() => validateOutcomeEvidenceInput(value));
  let called = false; const getter = { ...input }; Object.defineProperty(getter, "note", { enumerable: true, get() { called = true; return "no"; } }); assert.throws(() => validateOutcomeEvidenceInput(getter)); assert.throws(() => validateOutcomeEvidenceInput({ ...input, toJSON() { called = true; return input; } })); assert.throws(() => validateOutcomeEvidenceInput({ ...input, [Symbol("no")]: "no" })); assert.equal(called, false);
  const { note, ...noNote } = input; assert.deepEqual(validateOutcomeEvidenceInput(noNote), noNote);
});
test("a different baseline job cannot be silently substituted for the pinned finding", async t => fixture(t, async c => {
  const aliasId = saveJob(c.store, c.a, c.aDir), comparison = await createStoredComparison(c.store, { baselineReviewId: aliasId, candidateReviewId: c.candidateId });
  await assert.rejects(registerOutcomeEvidence(c.store, { ...selection(c), comparisonId: comparison.id }), /exact baseline/); assert.equal(c.store.recentOutcomeEvidence().length, 0);
}));
test("a source-note plan remains outside this controlled browser-finding contract", async t => fixture(t, async c => {
  const source = resolve(c.directory, "app"); await mkdir(source); await writeFile(resolve(source, "app.ts"), "export {};\n");
  const grant = grantAccess(c.store, { name: "Owned source", kind: "directory", target: source, capabilities: ["code:read"] }), capture = await captureRepository(c.store, { grantId: grant.id, target: source }), notes = await registerEngineeringObservations(c.store, { schemaVersion: "1.0", kind: "engineering_observation_input", snapshotRunId: capture.runId, requirements: [], observations: [{ id: "OBS-1", type: "source_observation", statement: "Unreviewed", requirementId: null, citations: [{ sourcePath: "app.ts", fileSha256: sha256("export {};\n"), startLine: 1, endLine: 1 }] }] });
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse(seed.plan.frozenAt) }); let plan: ExperimentPlanSummary;
  try { const action = await actionFor(c.store, notes.runId, "OBS-1", "engineering_observation"); plan = await freezeExperimentPlan(c.store, planInput(action, c.planInput.horizon.startsAt, c.planInput.horizon.endsAt)); } finally { t.mock.timers.reset(); }
  await assert.rejects(registerOutcomeEvidence(c.store, { ...selection(c), planId: plan.id }), /exact baseline/); assert.equal(c.store.recentOutcomeEvidence().length, 0);
}));
test("captures before the planned window remain unavailable", async t => fixture(t, async c => {
  await assert.rejects(registerOutcomeEvidence(c.store, selection(c)), /frozen local-clock window/); assert.equal(c.store.recentOutcomeEvidence().length, 0);
}, { startsAt: new Date(Date.parse(seed.b.generatedAt) + 10_000).toISOString(), endsAt: new Date(Date.parse(seed.b.generatedAt) + 20_000).toISOString() }));
test("captures finishing after the planned window remain unavailable", async t => fixture(t, async c => {
  await assert.rejects(registerOutcomeEvidence(c.store, selection(c)), /frozen local-clock window/); assert.equal(c.store.recentOutcomeEvidence().length, 0);
}, { startsAt: seed.planInput.horizon.startsAt, endsAt: new Date(Date.parse(seed.b.manifest.createdAt) + 1).toISOString() }));
test("locally recorded future candidate evidence cannot precede its comparison or registration", async t => fixture(t, async c => {
  const offset = Date.now() + 60_000 - Date.parse(c.b.manifest.createdAt), shift = (value: string) => new Date(Date.parse(value) + offset).toISOString(); c.b.manifest.createdAt = shift(c.b.manifest.createdAt); c.b.generatedAt = shift(c.b.generatedAt); for (const item of c.b.executions) { item.startedAt = shift(item.startedAt); item.finishedAt = shift(item.finishedAt); for (const observation of item.observations) observation.at = shift(observation.at); } await reseal(c.bDir, c.b);
  const comparison = await createStoredComparison(c.store, { baselineReviewId: c.baselineId, candidateReviewId: c.candidateId }); await assert.rejects(registerOutcomeEvidence(c.store, { ...selection(c), comparisonId: comparison.id }), /frozen local-clock window/);
}));
test("incomplete, reused, or changed-scope comparisons do not become linked outcome evidence", async t => fixture(t, async c => {
  c.b.manifest.studyHash = "0".repeat(64); await writeFile(resolve(c.bDir, "report.json"), JSON.stringify(c.b)); const comparison = await createStoredComparison(c.store, { baselineReviewId: c.baselineId, candidateReviewId: c.candidateId }); assert.equal(comparison.outcome, "not_comparable"); await assert.rejects(registerOutcomeEvidence(c.store, { ...selection(c), comparisonId: comparison.id }), /fully checked comparable/);
}));
test("fresh source classification rejects a forged saved comparison verdict even with changed local catalog hash", async t => fixture(t, async c => {
  const report = await readStoredComparison(c.store, c.comparison.id); report.verdict = "requirement_passed_in_both"; const bytes = Buffer.from(JSON.stringify(report)); await writeFile(resolve(c.comparison.directory, "report.json"), bytes); const db = database(c); try { db.prepare("UPDATE comparisons SET document=? WHERE id=?").run(JSON.stringify({ ...c.comparison, verdict: report.verdict, reportSha256: sha256(bytes) }), c.comparison.id); } finally { db.close(); }
  await assert.rejects(registerOutcomeEvidence(c.store, selection(c)), /fully checked comparable/); assert.equal(c.store.recentOutcomeEvidence().length, 0);
}));
test("out-of-order observation times are refused even when a comparison's weaker checks accept them", async t => fixture(t, async c => {
  c.b.executions[0]!.observations[0]!.at = new Date(Date.parse(c.b.generatedAt) + 60_000).toISOString(); await reseal(c.bDir, c.b);
  const comparison = await createStoredComparison(c.store, { baselineReviewId: c.baselineId, candidateReviewId: c.candidateId }); assert.equal(comparison.outcome, "compared"); await assert.rejects(registerOutcomeEvidence(c.store, { ...selection(c), comparisonId: comparison.id }), /Observation chronology/);
}));
test("changed plan, comparison, browser, own publication and own artifact bytes deny checked reads", async t => fixture(t, async c => {
  const summary = await registerOutcomeEvidence(c.store, selection(c)), report = await readOutcomeEvidence(c.store, summary.id);
  for (const file of [resolve(c.plan.directory, "report.json"), resolve(c.comparison.directory, "report.json"), resolve(c.bDir, c.b.artifacts[0]!.path), resolve(summary.directory, "report.json"), resolve(summary.directory, report.artifacts[0]!.path)]) { const original = await readFile(file); await writeFile(file, "AUTHORED_TAMPER"); await assert.rejects(readOutcomeEvidence(c.store, summary.id)); await writeFile(file, original); assert.equal((await readOutcomeEvidence(c.store, summary.id)).id, summary.id); }
}));
test("altered historical notes deny old evidence while later legitimate revisions remain supported", async t => fixture(t, async c => {
  const summary = await registerOutcomeEvidence(c.store, selection(c)), db = database(c); try { const row = db.prepare("SELECT document FROM action_events WHERE action_id=? AND revision=1").get(c.action.id)!, value = JSON.parse(String(row.document)); value.note = "AUTHORED_ALTERED_HISTORY"; db.prepare("UPDATE action_events SET document=? WHERE action_id=? AND revision=1").run(JSON.stringify(value), c.action.id); } finally { db.close(); }
  assert.equal(outcomeEvidenceSummaries(c.store).length, 0); await assert.rejects(readOutcomeEvidence(c.store, summary.id), /history has changed/);
}));
test("current source unavailability hides catalogs and denies old links", async t => fixture(t, async c => {
  const summary = await registerOutcomeEvidence(c.store, selection(c)); c.store.saveJob({ ...c.store.job(c.candidateId)!, status: "failed" }); assert.equal(outcomeEvidenceSummaries(c.store).length, 0); await assert.rejects(readOutcomeEvidence(c.store, summary.id), /pin is unavailable/);
}));
test("a limited job cannot upgrade a completed-looking source report into linked evidence", async t => fixture(t, async c => {
  c.store.saveJob({ ...c.store.job(c.candidateId)!, status: "limited_coverage" }); await assert.rejects(registerOutcomeEvidence(c.store, selection(c)), /Only completed/); assert.equal(c.store.recentOutcomeEvidence().length, 0);
}));
test("unsafe evidence roots and artifact symlinks are refused without writing outside the boundary", async t => fixture(t, async c => {
  const outside = resolve(c.directory, "outside"); await mkdir(outside); const output = resolve(c.store.directory, "outcome-evidence"); await symlink(outside, output); await assert.rejects(registerOutcomeEvidence(c.store, selection(c)), /unsafe/); assert.deepEqual(await readdir(outside), []); await rm(output);
  const summary = await registerOutcomeEvidence(c.store, selection(c)), report = await readOutcomeEvidence(c.store, summary.id), artifact = resolve(summary.directory, report.artifacts[0]!.path); await rm(artifact); await writeFile(resolve(outside, "secret.json"), "PRIVATE_MARKER"); await symlink(resolve(outside, "secret.json"), artifact); await assert.rejects(readOutcomeEvidence(c.store, summary.id));
}));
test("source change at catalog insertion rejects publication and preserves orphan bytes without promotion", async t => fixture(t, async c => {
  const original = c.store.saveOutcomeEvidence.bind(c.store); let published = ""; c.store.saveOutcomeEvidence = (summary, guard) => { published = summary.directory; c.store.saveJob({ ...c.store.job(c.candidateId)!, status: "interrupted" }); original(summary, guard); };
  await assert.rejects(registerOutcomeEvidence(c.store, selection(c)), /pin is unavailable/); assert(published); const bytes = await readFile(resolve(published, "report.json")); assert.equal(c.store.recentOutcomeEvidence().length, 0); assert.equal(c.store.action(c.action.id)!.status, "proposed"); assert.equal((await readExperimentPlan(c.store, c.plan.id)).outcomeStatus, "not_collected"); assert((JSON.parse(bytes.toString())).assessment.independentOutcomeVerification === "not_established");
  await assert.rejects(registerOutcomeEvidence(c.store, selection(c))); assert((await readFile(resolve(published, "report.json"))).equals(bytes)); const db = database(c); try { assert.equal(db.prepare("SELECT count(*) AS n FROM audit WHERE action='outcome_evidence_registered'").get()!.n, 0); } finally { db.close(); }
}));
test("history change at insertion is caught by the synchronous guard", async t => fixture(t, async c => {
  const original = c.store.saveOutcomeEvidence.bind(c.store); c.store.saveOutcomeEvidence = (summary, guard) => { const db = database(c); try { const row = db.prepare("SELECT document FROM action_events WHERE action_id=? AND revision=1").get(c.action.id)!, event = JSON.parse(String(row.document)); event.note = "changed before insert"; db.prepare("UPDATE action_events SET document=? WHERE action_id=? AND revision=1").run(JSON.stringify(event), c.action.id); } finally { db.close(); } original(summary, guard); };
  await assert.rejects(registerOutcomeEvidence(c.store, selection(c)), /history has changed/); assert.equal(c.store.recentOutcomeEvidence().length, 0);
}));
test("concurrent duplicate registration inserts one immutable catalog/audit record and leaves all source declarations unchanged", async t => fixture(t, async c => {
  const results = await Promise.allSettled(Array.from({ length: 4 }, () => registerOutcomeEvidence(c.store, selection(c)))); assert.equal(results.filter(item => item.status === "fulfilled").length, 1); assert.equal(results.filter(item => item.status === "rejected" && /already registered/.test(String(item.reason))).length, 3); assert.equal(c.store.recentOutcomeEvidence().length, 1); assert.equal(c.store.action(c.action.id)!.revision, 1);
  const db = database(c); try { assert.equal(db.prepare("SELECT count(*) AS n FROM audit WHERE action='outcome_evidence_registered'").get()!.n, 1); } finally { db.close(); }
  assert.equal((await readOutcomeEvidence(c.store, c.store.recentOutcomeEvidence()[0]!.id)).state, "evidence_registered");
}));
test("catalog writes reject asynchronous checks and preserve the existing first record on conflict", async t => fixture(t, async c => {
  const summary = await registerOutcomeEvidence(c.store, selection(c)), bytes = await readFile(resolve(summary.directory, "report.json")); assert.throws(() => c.store.saveOutcomeEvidence({ ...summary, id: randomUUID() }, (() => Promise.resolve()) as unknown as () => undefined), /synchronously/); assert.throws(() => c.store.saveOutcomeEvidence({ ...summary, id: randomUUID() }, () => undefined), /already registered/); assert.equal(c.store.recentOutcomeEvidence().length, 1); assert((await readFile(resolve(summary.directory, "report.json"))).equals(bytes));
}));
test("a sequential duplicate is rejected before another evidence directory is published", async t => fixture(t, async c => {
  await registerOutcomeEvidence(c.store, selection(c)); const before = await readdir(resolve(c.store.directory, "outcome-evidence")); await assert.rejects(registerOutcomeEvidence(c.store, selection(c)), /already registered/); assert.deepEqual(await readdir(resolve(c.store.directory, "outcome-evidence")), before);
}));
test("a local clock rollback at insertion cannot register evidence from its recorded future", async t => fixture(t, async c => {
  const original = c.store.saveOutcomeEvidence.bind(c.store); c.store.saveOutcomeEvidence = (summary, guard) => { t.mock.timers.enable({ apis: ["Date"], now: Date.parse(c.a.generatedAt) }); try { original(summary, guard); } finally { t.mock.timers.reset(); } };
  await assert.rejects(registerOutcomeEvidence(c.store, selection(c)), /frozen local-clock window|time changed/); assert.equal(c.store.recentOutcomeEvidence().length, 0);
}));
test("source CLI register/list/show preserve fixed labels, reject duplicates and strict unsupported commands", async t => fixture(t, async c => {
  const file = resolve(c.directory, "evidence.input.json"); await writeFile(file, JSON.stringify(selection(c))); const command = async (args: string[]) => JSON.parse((await execute(process.execPath, [resolve(project, "src/cli.ts"), ...args], { cwd: c.directory })).stdout);
  const summary = await command(["experiments", "evidence", "register", file]), report = await command(["experiments", "evidence", "show", summary.id]); assert.equal(report.assessment.independentOutcomeVerification, "not_established"); assert.equal(report.state, "evidence_registered"); assert.equal((await command(["experiments", "evidence", "list"])).outcomeEvidence.length, 1); await assert.rejects(command(["experiments", "evidence", "register", file]), /already registered/); await assert.rejects(command(["experiments", "evidence", "list", "extra"]), /Usage/); await assert.rejects(command(["experiments", "evidence", "approve", summary.id]), /Usage/); assert.equal(c.store.action(c.action.id)!.status, "proposed");
}));

type ApiContext = Context & { server: Awaited<ReturnType<typeof createLocalServer>>; headers: Record<string, string> };
async function apiFixture(t: TestContext, work: (c: ApiContext) => Promise<void>) { await fixture(t, async c => { const server = await createLocalServer({ workspace: c.directory, assetsRoot: project, port: 0 }); try { await work({ ...c, server, headers: { Authorization: `Bearer ${server.token}`, "Content-Type": "application/json" } }); } finally { await server.close(); } }); }
const apiCreate = (c: ApiContext, value: unknown = selection(c)) => fetch(c.server.origin + "/api/outcome-evidence", { method: "POST", headers: c.headers, body: JSON.stringify(value) });

test("API registration and checked detail expose a strict public projection with unchanged fixed labels and sources", async t => apiFixture(t, async c => {
  const value = { ...selection(c), note: "<script>literal operator note</script>" }, response = await apiCreate(c, value); assert.equal(response.status, 201); assert.equal(response.headers.get("cache-control"), "no-store"); assert.match(response.headers.get("content-type")!, /^application\/json/);
  const report = await response.json() as Record<string, any>; assert.deepEqual(Object.keys(report).sort(), ["schemaVersion", "kind", "policyVersion", "id", "registeredAt", "input", "state", "execution", "assessment", "observation", "alignment", "sources", "artifacts", "limitations"].sort()); assert.deepEqual(report.input, value); assert.equal(report.assessment.hypothesisResolution, "not_assessed"); assert.equal(report.assessment.independentOutcomeVerification, "not_established"); assert.equal(report.observation.verdict, "mismatch_not_observed_in_candidate");
  assert.deepEqual(Object.keys(report.sources.plan).sort(), ["id", "reportSha256"]); assert.deepEqual(Object.keys(report.sources.comparison.baseline).sort(), ["evidenceRunId", "reportSha256", "reviewId"]); assert.deepEqual(Object.keys(report.sources.actionVersion.origin).sort(), ["kind", "runId", "itemId", "evidenceRunId", "reportSha256"].sort()); assert.deepEqual(Object.keys(report.artifacts[0]).sort(), ["id", "owner", "mediaType", "bytes", "sha256"].sort());
  const serialized = JSON.stringify(report); for (const forbidden of [c.directory, '"directory":', '"catalogSha256":', '"projectionSha256":', '"actionHistorySha256":', '"access":', '"path":']) assert(!serialized.includes(forbidden), forbidden);
  const detail = await fetch(c.server.origin + `/api/outcome-evidence/${report.id}`, { headers: c.headers }); assert.equal(detail.status, 200); assert.equal(detail.headers.get("cache-control"), "no-store"); assert.deepEqual(await detail.json(), report);
  const catalog = await fetch(c.server.origin + "/api/outcome-evidence", { headers: c.headers }), metadata = await catalog.json() as Record<string, any>; assert.equal(metadata.outcomeEvidence.length, 1); assert.equal(metadata.outcomeEvidence[0].recordStatus, "cataloged_unverified"); assert(!JSON.stringify(metadata).includes(value.note)); assert(!JSON.stringify(metadata).includes(c.directory)); assert.equal(c.store.action(c.action.id)!.revision, 1); assert.equal((await readExperimentPlan(c.store, c.plan.id)).outcomeStatus, "not_collected"); assert.equal(c.store.jobs().length, 2); assert.equal(c.store.actorRuns().length, 0);
}));
test("API session, Origin, real forged Host, strict input, static missing detail and unsupported routes deny access", async t => apiFixture(t, async c => {
  assert.equal((await fetch(c.server.origin + "/api/outcome-evidence")).status, 401); assert.equal((await fetch(c.server.origin + "/api/outcome-evidence", { headers: { ...c.headers, Origin: "https://foreign.example" } })).status, 403);
  const forged = await new Promise<number>( (accept, reject) => { const req = request(c.server.origin + "/api/outcome-evidence", { headers: { ...c.headers, Host: "foreign.example" } }, response => { response.resume(); accept(response.statusCode!); }); req.on("error", reject); req.end(); }); assert.equal(forged, 421);
  for (const value of [{ ...selection(c), hypothesisResolution: "pass" }, { ...selection(c), path: "/PRIVATE_INPUT_MARKER" }, { ...selection(c), note: "x".repeat(2001) }, { ...selection(c), planId: "PRIVATE_INPUT_MARKER" }, { ...selection(c), kind: "human_outcome" }]) { const response = await apiCreate(c, value); assert.equal(response.status, 400); assert.equal(response.headers.get("cache-control"), "no-store"); const message = await response.text(); assert(message.includes("outcome_evidence_not_confirmed")); assert(!message.includes(c.directory)); assert(!message.includes("PRIVATE_INPUT_MARKER")); }
  const id = randomUUID(); for (const [method, path] of [["GET", `/api/outcome-evidence/${id}`], ["DELETE", `/api/outcome-evidence/${id}`], ["PUT", `/api/outcome-evidence/${id}`], ["GET", `/api/outcome-evidence/${id}/download.json`], ["GET", `/api/outcome-evidence/${id}/artifacts/secret.json`], ["POST", `/api/outcome-evidence/${id}/approve`]] as const) { const response = await fetch(c.server.origin + path, { method, headers: c.headers, ...(method === "POST" || method === "PUT" ? { body: "{}" } : {}) }); assert.equal(response.status, 404); assert(!String(await response.text()).includes(c.directory)); }
  assert.equal(c.store.recentOutcomeEvidence().length, 0);
}));
test("API detail remains historical after a legitimate action update but denies changed history and clears catalog", async t => apiFixture(t, async c => {
  const report = await (await apiCreate(c)).json() as { id: string }; await updateTrackedAction(c.store, c.action.id, { schemaVersion: "1.0", kind: "action_update", expectedRevision: 1, status: "completed_declared", note: "A declaration only." }); let response = await fetch(c.server.origin + `/api/outcome-evidence/${report.id}`, { headers: c.headers }); assert.equal(response.status, 200); assert.equal((await response.json() as Record<string, any>).sources.actionVersion.revision, 1);
  const db = database(c); try { const event = JSON.parse(String(db.prepare("SELECT document FROM action_events WHERE action_id=? AND revision=1").get(c.action.id)!.document)); event.note = "PRIVATE_CHANGED_HISTORY"; db.prepare("UPDATE action_events SET document=? WHERE action_id=? AND revision=1").run(JSON.stringify(event), c.action.id); } finally { db.close(); }
  response = await fetch(c.server.origin + `/api/outcome-evidence/${report.id}`, { headers: c.headers }); assert.equal(response.status, 404); const body = await response.text(); assert(!body.includes("PRIVATE_CHANGED_HISTORY")); assert(!body.includes(c.directory)); assert.equal((await (await fetch(c.server.origin + "/api/outcome-evidence", { headers: c.headers })).json() as Record<string, any>).outcomeEvidence.length, 0);
}));
test("API denies changed own/source evidence and current limited source jobs without reflecting saved content", async t => apiFixture(t, async c => {
  const report = await (await apiCreate(c)).json() as { id: string }, summary = c.store.outcomeEvidence(report.id)!, internal = await readOutcomeEvidence(c.store, report.id);
  for (const file of [resolve(summary.directory, internal.artifacts[0]!.path), resolve(c.bDir, c.b.artifacts[0]!.path)]) { const before = await readFile(file); await writeFile(file, "PRIVATE_CHANGED_BYTES"); const response = await fetch(c.server.origin + `/api/outcome-evidence/${report.id}`, { headers: c.headers }); assert.equal(response.status, 404); const message = await response.text(); assert(!message.includes("PRIVATE_CHANGED_BYTES")); assert(!message.includes(c.directory)); await writeFile(file, before); }
  c.store.saveJob({ ...c.store.job(c.candidateId)!, status: "limited_coverage" }); assert.equal((await fetch(c.server.origin + `/api/outcome-evidence/${report.id}`, { headers: c.headers })).status, 404); assert.equal((await (await fetch(c.server.origin + "/api/outcome-evidence", { headers: c.headers })).json() as Record<string, any>).outcomeEvidence.length, 0);
}));
test("API final response guard refuses a source change after the completed full read", async t => apiFixture(t, async c => {
  const report = await (await apiCreate(c)).json() as { id: string }, original = c.server.store.outcomeEvidence.bind(c.server.store); let reads = 0;
  c.server.store.outcomeEvidence = id => { if (++reads === 2) c.server.store.saveJob({ ...c.server.store.job(c.candidateId)!, status: "interrupted" }); return original(id); };
  const response = await fetch(c.server.origin + `/api/outcome-evidence/${report.id}`, { headers: c.headers }); assert.equal(reads, 2); assert.equal(response.status, 404); assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal(response.headers.get("content-disposition"), null); const message = await response.text(); assert(message.includes("outcome_evidence_unavailable")); assert(!message.includes(c.directory)); assert(!message.includes("Operator-supplied"));
}));
test("API uncertain create response preserves a committed record and never silently retries or promotes sources", async t => apiFixture(t, async c => {
  const original = c.server.store.saveOutcomeEvidence.bind(c.server.store), job = c.server.store.job(c.candidateId)!;
  c.server.store.saveOutcomeEvidence = (summary, guard) => { original(summary, guard); c.server.store.saveJob({ ...job, status: "interrupted" }); };
  const response = await apiCreate(c); assert.equal(response.status, 400); assert((await response.text()).includes("Inspect recent records before retrying")); assert.equal(c.store.recentOutcomeEvidence().length, 1); assert.equal(c.store.action(c.action.id)!.revision, 1); const saved = c.store.recentOutcomeEvidence()[0]!; const before = await readFile(resolve(saved.directory, "report.json"));
  c.server.store.saveJob(job); const restored = await fetch(c.server.origin + `/api/outcome-evidence/${saved.id}`, { headers: c.headers }); assert.equal(restored.status, 200); assert.equal((await apiCreate(c)).status, 400); assert.equal(c.store.recentOutcomeEvidence().length, 1); assert((await readFile(resolve(saved.directory, "report.json"))).equals(before));
}));
test("API permits one active create and a busy response performs no duplicate work", async t => apiFixture(t, async c => {
  const payload = JSON.stringify(selection(c)); let first: ReturnType<typeof request>;
  const result = new Promise<{ status: number; text: string }>((accept, reject) => { first = request(c.server.origin + "/api/outcome-evidence", { method: "POST", headers: { ...c.headers, Expect: "100-continue", "Content-Length": Buffer.byteLength(payload) } }, response => { const chunks: Buffer[] = []; response.on("data", chunk => chunks.push(Buffer.from(chunk))); response.on("end", () => accept({ status: response.statusCode!, text: Buffer.concat(chunks).toString() })); }); first.on("error", reject); first.setTimeout(5000, () => first.destroy(new Error("Owned API test timed out."))); });
  try { const ready = new Promise<void>((accept, reject) => { first!.once("continue", accept); first!.once("error", reject); }); first!.flushHeaders(); await ready; first!.write(payload.slice(0, 20)); const busy = await apiCreate(c); assert.equal(busy.status, 409); assert.equal((await busy.json() as Record<string, any>).code, "outcome_evidence_busy"); first!.end(payload.slice(20)); const completed = await result; assert.equal(completed.status, 201); assert.equal(JSON.parse(completed.text).state, "evidence_registered"); assert.equal(c.store.recentOutcomeEvidence().length, 1); }
  finally { first!.destroy(); await result.catch(() => {}); }
}));
test("API final guard binds the delivered bytes to the exact checked publication catalog", async t => apiFixture(t, async c => {
  const report = await (await apiCreate(c)).json() as { id: string }, original = c.server.store.outcomeEvidence.bind(c.server.store); let reads = 0;
  c.server.store.outcomeEvidence = id => { const summary = original(id); return ++reads === 2 && summary ? { ...summary, reportSha256: "0".repeat(64) } : summary; };
  const response = await fetch(c.server.origin + `/api/outcome-evidence/${report.id}`, { headers: c.headers }); assert.equal(reads, 2); assert.equal(response.status, 404); const message = await response.text(); assert(message.includes("outcome_evidence_unavailable")); assert(!message.includes(c.directory)); assert(!message.includes("Operator-supplied"));
}));

const exportInput = (items: { kind: string; id: string }[]) => ({ schemaVersion: "1.0", kind: "report_export_input", title: "Explicit controlled evidence bundle", items });
test("v2 export includes an explicitly selected evidence link in a five-kind bundle with fixed labels and bounded public fields", async t => fixture(t, async c => {
  const link = await registerOutcomeEvidence(c.store, { ...selection(c), note: '<img src=x onerror="alert(1)"> ``` supplied text only' }), before = c.store.action(c.action.id), summary = await createReportExport(c.store, exportInput([{ kind: "review", id: c.baselineId }, { kind: "action", id: c.action.id }, { kind: "experiment", id: c.plan.id }, { kind: "comparison", id: c.comparison.id }, { kind: "outcome_evidence", id: link.id }])), report = await readReportExport(c.store, summary.id), linked = report.records[4]!;
  assert.equal(report.policyVersion, "local-record-export-v2"); assert.deepEqual(report.sourceReadBudget, { maxDistinctReviews: 5, maxReviewReferences: 10, distinctReviews: 2, reviewReferences: 7 }); assert.equal(linked.kind, "outcome_evidence"); assert.equal(linked.snapshotHash, link.reportSha256); assert.equal((linked.body.assessment as Record<string, unknown>).independentOutcomeVerification, "not_established"); assert.equal((linked.body.assessment as Record<string, unknown>).hypothesisResolution, "not_assessed");
  const json = JSON.stringify(report), human = await readFile(resolve(summary.directory, summary.markdownFile), "utf8"); for (const marker of [c.directory, '"directory":', '"reviewDependencies":', '"actionHistorySha256":', '"catalogSha256":', '"projectionSha256":']) { assert(!json.includes(marker), marker); assert(!human.includes(marker), marker); }
  assert(human.includes(JSON.stringify('<img src=x onerror="alert(1)"> ``` supplied text only').slice(1, -1))); assert(human.includes("````json")); assert.deepEqual(c.store.action(c.action.id), before); assert.equal((await readExperimentPlan(c.store, c.plan.id)).outcomeStatus, "not_collected"); assert.equal(c.store.jobs().length, 2); assert.equal(c.store.actorRuns().length, 0); assert.equal(summary.sourcePins[4]!.outcome?.id, link.id); assert.deepEqual(summary.sourcePins[4]!.reviewDependencies, [c.baselineId, c.candidateId]);
}));
test("authored v1 four-kind exports remain readable without adding transitive policy or rewriting old bytes", async t => fixture(t, async c => {
  const summary = await createReportExport(c.store, exportInput([{ kind: "review", id: c.baselineId }, { kind: "action", id: c.action.id }, { kind: "experiment", id: c.plan.id }, { kind: "comparison", id: c.comparison.id }])), report = await readReportExport(c.store, summary.id); report.policyVersion = "local-record-export-v1"; delete report.sourceReadBudget;
  const bytes = Buffer.from(JSON.stringify(report, null, 2) + "\n"), pins = summary.sourcePins.map(pin => { const { reviewDependencies, ...legacy } = pin; return legacy; }); await writeFile(resolve(summary.directory, "report.json"), bytes); const db = database(c); try { db.prepare("UPDATE report_exports SET document=? WHERE id=?").run(JSON.stringify({ ...summary, sourcePins: pins, reportSha256: sha256(bytes) }), summary.id); } finally { db.close(); }
  const legacy = await readReportExport(c.store, summary.id); assert.equal(legacy.policyVersion, "local-record-export-v1"); assert.equal(legacy.sourceReadBudget, undefined); assert.equal(legacy.records.length, 4); assert((await readFile(resolve(summary.directory, "report.json"))).equals(bytes)); await updateTrackedAction(c.store, c.action.id, { schemaVersion: "1.0", kind: "action_update", expectedRevision: 1, status: "in_progress", note: "Later valid declaration." }); assert.equal((await readReportExport(c.store, summary.id)).policyVersion, "local-record-export-v1");
}));
test("six distinct transitive review dependencies are rejected before browser/file readers begin", async t => fixture(t, async c => {
  const comparisons = [c.comparison.id]; for (let index = 0; index < 2; index++) { const baseline = saveJob(c.store, c.a, c.aDir), candidate = saveJob(c.store, c.b, c.bDir); comparisons.push((await createStoredComparison(c.store, { baselineReviewId: baseline, candidateReviewId: candidate })).id); }
  const original = c.store.job.bind(c.store); let reads = 0; c.store.job = () => { reads++; throw new Error("AUTHORED_READ_MUST_NOT_START"); };
  try { await assert.rejects(createReportExport(c.store, exportInput(comparisons.map(id => ({ kind: "comparison", id })))), /five distinct controlled reviews/); assert.equal(reads, 0); assert.equal(c.store.recentReportExports().length, 0); } finally { c.store.job = original; }
}));
test("repeated comparison dependencies consume references even when they use the same two review jobs", async t => fixture(t, async c => {
  const comparisons = [c.comparison.id]; for (let index = 0; index < 5; index++) comparisons.push((await createStoredComparison(c.store, { baselineReviewId: c.baselineId, candidateReviewId: c.candidateId })).id);
  const original = c.store.job.bind(c.store); let reads = 0; c.store.job = () => { reads++; throw new Error("AUTHORED_READ_MUST_NOT_START"); };
  try { await assert.rejects(createReportExport(c.store, exportInput(comparisons.map(id => ({ kind: "comparison", id })))), /ten review references/); assert.equal(reads, 0); } finally { c.store.job = original; }
}));
test("six evidence links cannot hide twelve repeated review references behind six selected records", async t => fixture(t, async c => {
  const links = [(await registerOutcomeEvidence(c.store, selection(c))).id];
  for (let index = 0; index < 5; index++) { t.mock.timers.enable({ apis: ["Date"], now: Date.parse(seed.plan.frozenAt) }); let plan: ExperimentPlanSummary; try { plan = await freezeExperimentPlan(c.store, { ...c.planInput, title: `Authored frozen plan ${index}` }); } finally { t.mock.timers.reset(); } links.push((await registerOutcomeEvidence(c.store, { ...selection(c), planId: plan.id })).id); }
  const original = c.store.job.bind(c.store); let reads = 0; c.store.job = () => { reads++; throw new Error("AUTHORED_READ_MUST_NOT_START"); };
  try { await assert.rejects(createReportExport(c.store, exportInput(links.map(id => ({ kind: "outcome_evidence", id })))), /ten review references/); assert.equal(reads, 0); assert.equal(c.store.recentReportExports().length, 0); } finally { c.store.job = original; }
}));
test("an exported evidence link preserves later action revisions but rejects changed historical notes", async t => fixture(t, async c => {
  const link = await registerOutcomeEvidence(c.store, selection(c)), summary = await createReportExport(c.store, exportInput([{ kind: "outcome_evidence", id: link.id }])); await updateTrackedAction(c.store, c.action.id, { schemaVersion: "1.0", kind: "action_update", expectedRevision: 1, status: "completed_declared", note: "Declaration only." }); assert.equal(((await readReportExport(c.store, summary.id)).records[0]!.body.sources as Record<string, any>).actionVersion.revision, 1);
  const db = database(c); try { const event = JSON.parse(String(db.prepare("SELECT document FROM action_events WHERE action_id=? AND revision=1").get(c.action.id)!.document)); event.note = "AUTHORED_CHANGED_OLD_NOTE"; db.prepare("UPDATE action_events SET document=? WHERE action_id=? AND revision=1").run(JSON.stringify(event), c.action.id); } finally { db.close(); }
  assert.equal(reportExportSummaries(c.store).length, 0); await assert.rejects(readReportExport(c.store, summary.id), /history has changed/);
}));
test("exported link retrieval checks link/plan/comparison/browser artifacts and preserves delivered bytes", async t => fixture(t, async c => {
  const link = await registerOutcomeEvidence(c.store, selection(c)), linked = await readOutcomeEvidence(c.store, link.id), summary = await createReportExport(c.store, exportInput([{ kind: "outcome_evidence", id: link.id }])), originalExport = await readFile(resolve(summary.directory, "report.json")), originalMarkdown = await readFile(resolve(summary.directory, summary.markdownFile));
  for (const file of [resolve(link.directory, linked.artifacts[0]!.path), resolve(c.plan.directory, "report.json"), resolve(c.comparison.directory, "report.json"), resolve(c.bDir, c.b.artifacts[0]!.path)]) { const before = await readFile(file); await writeFile(file, "AUTHORED_SOURCE_CHANGE"); await assert.rejects(readReportExport(c.store, summary.id)); await writeFile(file, before); assert.equal((await readReportExport(c.store, summary.id)).id, summary.id); }
  c.store.saveJob({ ...c.store.job(c.candidateId)!, status: "limited_coverage" }); assert.equal(reportExportSummaries(c.store).length, 0); await assert.rejects(readReportExport(c.store, summary.id), /Only completed/); assert((await readFile(resolve(summary.directory, "report.json"))).equals(originalExport)); assert((await readFile(resolve(summary.directory, summary.markdownFile))).equals(originalMarkdown));
}));
test("export insertion rechecks a linked source synchronously and leaves private orphan bytes unpromoted", async t => fixture(t, async c => {
  const link = await registerOutcomeEvidence(c.store, selection(c)), original = c.store.saveReportExport.bind(c.store); let publication = ""; c.store.saveReportExport = (summary, guard) => { publication = summary.directory; c.store.saveJob({ ...c.store.job(c.candidateId)!, status: "interrupted" }); original(summary, guard); };
  await assert.rejects(createReportExport(c.store, exportInput([{ kind: "outcome_evidence", id: link.id }])), /pin is unavailable/); assert(publication); const saved = JSON.parse(await readFile(resolve(publication, "report.json"), "utf8")); assert.equal(saved.records[0].body.assessment.independentOutcomeVerification, "not_established"); assert.equal(c.store.recentReportExports().length, 0); const db = database(c); try { assert.equal(db.prepare("SELECT count(*) AS n FROM audit WHERE action='report_export_saved'").get()!.n, 0); } finally { db.close(); }
}));
test("API download refuses a transitive link source lost after full export verification", async t => apiFixture(t, async c => {
  const link = await registerOutcomeEvidence(c.store, selection(c)), summary = await createReportExport(c.store, exportInput([{ kind: "outcome_evidence", id: link.id }])), original = c.server.store.reportExport.bind(c.server.store); let reads = 0;
  c.server.store.reportExport = id => { if (++reads === 2) c.server.store.saveJob({ ...c.server.store.job(c.candidateId)!, status: "interrupted" }); return original(id); };
  const response = await fetch(c.server.origin + `/api/report-exports/${summary.id}/download.json`, { headers: c.headers }); assert.equal(reads, 2); assert.equal(response.status, 404); assert.equal(response.headers.get("content-disposition"), null); const message = await response.text(); assert(!message.includes(c.directory)); assert(!message.includes("Operator-supplied"));
}));
test("an exported evidence link stays unavailable during a local clock rollback", async t => fixture(t, async c => {
  const link = await registerOutcomeEvidence(c.store, selection(c)), summary = await createReportExport(c.store, exportInput([{ kind: "outcome_evidence", id: link.id }])); t.mock.timers.enable({ apis: ["Date"], now: Date.parse(seed.plan.frozenAt) }); try { assert.equal(reportExportSummaries(c.store).length, 0); await assert.rejects(readReportExport(c.store, summary.id), /ahead of the current local clock/); } finally { t.mock.timers.reset(); } assert.equal((await readReportExport(c.store, summary.id)).id, summary.id);
}));
