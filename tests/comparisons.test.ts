import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, cp, readFile, writeFile, rm, readdir, symlink, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { WorkspaceStore } from "../src/workspace.ts";
import { runStudy } from "../src/runner.ts";
import type { ReviewReport } from "../src/domain/review.ts";
import { createStoredComparison, readStoredComparison, comparisonSummaries } from "../src/comparisons.ts";
import { createTrackedAction } from "../src/actions.ts";
import { createLocalServer } from "../src/server.ts";
import { sha256 } from "../src/evidence.ts";
const project = resolve(import.meta.dirname, ".."), execute = promisify(execFile);
let seed: string;
const captures: { directory: string; report: ReviewReport }[] = [];
before(async () => {
  seed = await mkdtemp(resolve(tmpdir(), "redteam-comparison-seeds-"));
  const study = JSON.parse(await readFile(resolve(project, "examples/pilot-signup.study.json"), "utf8"));
  for (const variant of ["broken", "fixed", "broken", "fixed"] as const) captures.push(await runStudy(study, { projectRoot: project, outputRoot: resolve(seed, "runs"), variant }));
});
after(async () => { if (seed) await rm(seed, { recursive: true, force: true }); });
type Context = { directory: string; store: WorkspaceStore; baselineId: string; candidateId: string; a: ReviewReport; b: ReviewReport; aDir: string; bDir: string };
async function fixture(work: (context: Context) => Promise<void>, indexes = [0, 1]): Promise<void> {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-comparisons-")), store = new WorkspaceStore(directory);
  try {
    const selected = indexes.map(index => captures[index]!); const ids = [randomUUID(), randomUUID()];
    const dirs: string[] = [], reports: ReviewReport[] = [];
    for (const [index, capture] of selected.entries()) {
      const target = resolve(directory, ".redteam/runs", capture.report.runId); await mkdir(resolve(target, ".."), { recursive: true }); await cp(capture.directory, target, { recursive: true });
      dirs.push(target); reports.push(structuredClone(capture.report));
      store.saveJob({ id: ids[index]!, variant: capture.report.manifest.fixtureVariant, status: "completed", createdAt: capture.report.manifest.createdAt, updatedAt: capture.report.generatedAt, reportDirectory: target, findingCount: capture.report.findings.length, artifactCount: capture.report.artifacts.length, error: null });
    }
    await work({ directory, store, baselineId: ids[0]!, candidateId: ids[1]!, a: reports[0]!, b: reports[1]!, aDir: dirs[0]!, bDir: dirs[1]! });
  } finally { store.close(); await rm(directory, { recursive: true, force: true }); }
}
const input = (c: Context) => ({ baselineReviewId: c.baselineId, candidateReviewId: c.candidateId });
const save = (directory: string, report: ReviewReport) => writeFile(resolve(directory, "report.json"), JSON.stringify(report, null, 2) + "\n");
// Authored negative-test metadata only. This does not represent another browser run.
async function reseal(directory: string, report: ReviewReport) {
  for (const execution of report.executions) {
    const artifact = report.artifacts.find(item => execution.artifactIds.includes(item.id) && item.mediaType === "application/json")!;
    const bytes = Buffer.from(JSON.stringify({ ...execution, artifactIds: execution.artifactIds.filter(id => id !== artifact.id) }, null, 2) + "\n");
    await writeFile(resolve(directory, artifact.path), bytes); artifact.sha256 = sha256(bytes); artifact.bytes = bytes.length;
  }
  await save(directory, report);
}

for (const [name, indexes, verdict] of [
  ["broken to fixed", [0, 1], "mismatch_not_observed_in_candidate"],
  ["fixed to broken", [1, 2], "mismatch_observed_in_candidate"],
  ["both fixed", [1, 3], "requirement_passed_in_both"],
  ["both broken", [0, 2], "mismatch_reproduced_in_both"],
] as const) test(`real captured fixture comparison: ${name}`, async () => fixture(async c => {
  const before = await Promise.all([readFile(resolve(c.aDir, "report.json")), readFile(resolve(c.bDir, "report.json"))]);
  const summary = await createStoredComparison(c.store, input(c)), report = await readStoredComparison(c.store, summary.id);
  assert.equal(report.outcome, "compared"); assert.equal(report.verdict, verdict); assert.equal(report.scope.requirementId, "DEMO-SIGNUP-001"); assert.equal(report.reasons.length, 0);
  assert.deepEqual(report.boundaries, { testsExecuted: false, modelCalls: 0, actionStatusChanged: false, causalEffectEstablished: false, sourceKind: "controlled_local_fixture" });
  assert.notEqual(report.baseline.reviewId, report.baseline.evidenceRunId); assert.equal(c.store.jobs().length, 2); assert.equal(c.store.recentActions().length, 0);
  assert.equal(comparisonSummaries(c.store)[0]?.recordStatus, "cataloged_unverified");
  assert.deepEqual(await Promise.all([readFile(resolve(c.aDir, "report.json")), readFile(resolve(c.bDir, "report.json"))]), before);
}, [...indexes]));

test("comparison never upgrades a declared action or appends action history", async () => fixture(async c => {
  const action = await createTrackedAction(c.store, { schemaVersion: "1.0", kind: "action_input", origin: { kind: "browser_finding", runId: c.baselineId, itemId: c.a.findings[0]!.id }, title: "Investigate signup", owner: "Operator", nextStep: "Investigate this fixture.", validationMethod: "Run a separate controlled check." });
  await createStoredComparison(c.store, input(c)); assert.deepEqual(c.store.action(action.id), action); assert.equal(c.store.actionEvents(action.id).length, 1);
}));

const negatives: [string, (c: Context) => void, string][] = [
  ["empty finding list on failed assertions", c => { c.a.findings = []; c.a.outcome = "completed"; }, "baseline:finding_assertion_mismatch"],
  ["limited coverage", c => { c.b.outcome = "limited_coverage"; }, "candidate:incomplete_report"],
  ["missing verifier", c => { c.b.executions.pop(); }, "candidate:missing_fresh_execution_pair"],
  ["changed study scope", c => { c.b.manifest.studyHash = "0".repeat(64); }, "candidate:study_hash_mismatch"],
  ["changed requirement hash", c => { c.b.manifest.requirement.sha256 = "0".repeat(64); }, "candidate:requirement_source_mismatch"],
  ["changed instrumentation", c => { c.b.manifest.runtime.node = "unmatched-runtime"; }, "recorded_instrumentation_changed_or_missing"],
  ["report execution disagrees with sealed record", c => { c.b.executions[0]!.baselineReady = false; }, "candidate:execution_record_mismatch"],
  ["internally inconsistent assertion", c => { c.b.executions[0]!.assertion!.verdict = "fail"; }, "candidate:assertion_inconsistent"],
  ["missing execution dataset", c => { c.b.executions[0]!.snapshotId = null; }, "candidate:missing_execution_or_dataset_identity"],
  ["reused verifier dataset", c => { c.b.executions[1]!.snapshotId = c.b.executions[0]!.snapshotId; }, "candidate:reused_execution_or_dataset"],
  ["incomplete step coverage", c => { c.b.executions[0]!.observations.splice(1, 1); }, "candidate:incomplete_observation_sequence"],
  ["capture error", c => { c.b.executions[0]!.captureErrors.push("Authored capture failure"); }, "candidate:incomplete_execution"],
  ["missing required screenshot link", c => { const execution = c.b.executions[0]!; execution.artifactIds = execution.artifactIds.filter(id => c.b.artifacts.find(item => item.id === id)?.mediaType !== "image/png"); }, "candidate:required_capture_missing"],
];
for (const [name, mutate, reason] of negatives) test(`not comparable: ${name}`, async () => fixture(async c => {
  mutate(c); await save(c.aDir, c.a); await save(c.bDir, c.b);
  const summary = await createStoredComparison(c.store, input(c)), report = await readStoredComparison(c.store, summary.id);
  assert.equal(report.outcome, "not_comparable"); assert.equal(report.verdict, "not_comparable"); assert(report.reasons.includes(reason), JSON.stringify(report.reasons));
}));

test("reversed report chronology and aliased evidence cannot compare", async () => fixture(async c => {
  const reversed = await createStoredComparison(c.store, { baselineReviewId: c.candidateId, candidateReviewId: c.baselineId });
  assert((await readStoredComparison(c.store, reversed.id)).reasons.includes("candidate_time_precedes_baseline_or_is_invalid"));
  const job = c.store.job(c.baselineId)!; c.store.saveJob({ ...job, id: c.candidateId });
  const alias = await createStoredComparison(c.store, input(c)); assert((await readStoredComparison(c.store, alias.id)).reasons.includes("saved_runs_are_not_distinct"));
}));

test("different observations on the same recorded build are explicit, without causal claims", async () => fixture(async c => {
  c.b.manifest.fixtureBuildHash = c.a.manifest.fixtureBuildHash;
  for (const execution of c.b.executions) execution.buildHash = c.a.manifest.fixtureBuildHash;
  await reseal(c.bDir, c.b);
  const summary = await createStoredComparison(c.store, input(c)); assert.equal(summary.verdict, "changed_observation_same_build");
  assert.equal((await readStoredComparison(c.store, summary.id)).boundaries.causalEffectEstablished, false);
}));

test("strict input, unavailable sources, changed bytes, and symlink artifacts fail before cataloging", async () => fixture(async c => {
  for (const value of [null, [], { ...input(c), execute: true }, { baselineReviewId: c.baselineId, candidateReviewId: c.baselineId }, { baselineReviewId: "../unsafe", candidateReviewId: c.candidateId }]) await assert.rejects(createStoredComparison(c.store, value));
  const artifact = c.b.artifacts[0]!, path = resolve(c.bDir, artifact.path), bytes = await readFile(path);
  await writeFile(path, "changed"); await assert.rejects(createStoredComparison(c.store, input(c)), /evidence has changed/);
  await unlink(path); const outside = resolve(c.directory, "untrusted-artifact"); await writeFile(outside, bytes); await symlink(outside, path);
  await assert.rejects(createStoredComparison(c.store, input(c))); assert.deepEqual(c.store.recentComparisons(), []);
}));

test("saved comparisons deny changed source, source manifest, publication, and parent availability", async () => fixture(async c => {
  const summary = await createStoredComparison(c.store, input(c)), report = await readStoredComparison(c.store, summary.id), artifact = report.artifacts[0]!;
  const sourcePath = resolve(summary.directory, artifact.path), sourceBytes = await readFile(sourcePath), reportPath = resolve(summary.directory, "report.json"), reportBytes = await readFile(reportPath);
  await writeFile(sourcePath, "{}"); await assert.rejects(readStoredComparison(c.store, summary.id), /manifest has changed/); await writeFile(sourcePath, sourceBytes);
  await writeFile(reportPath, "{}"); await assert.rejects(readStoredComparison(c.store, summary.id), /publication has changed/); await writeFile(reportPath, reportBytes);
  const original = await readFile(resolve(c.bDir, "report.json")); await writeFile(resolve(c.bDir, "report.json"), original.toString() + " "); await assert.rejects(readStoredComparison(c.store, summary.id), /original comparison source has changed/); await writeFile(resolve(c.bDir, "report.json"), original);
  c.store.saveJob({ ...c.store.job(c.candidateId)!, status: "failed" }); assert.deepEqual(comparisonSummaries(c.store), []); await assert.rejects(readStoredComparison(c.store, summary.id), /pin is unavailable/);
}));

test("catalog insertion rechecks source pins and preserves unaccepted orphan bytes", async () => fixture(async c => {
  const original = c.store.saveComparison.bind(c.store);
  c.store.saveComparison = (...args) => { c.store.saveJob({ ...c.store.job(c.candidateId)!, status: "failed" }); return original(...args); };
  await assert.rejects(createStoredComparison(c.store, input(c)), /pin is unavailable/); assert.deepEqual(c.store.recentComparisons(), []); assert(!c.store.auditLog().some(event => event.action === "comparison_saved"));
  const dirs = await readdir(resolve(c.directory, ".redteam/comparisons")); assert.equal(dirs.length, 1); assert(await readFile(resolve(c.directory, ".redteam/comparisons", dirs[0]!, "report.json")));
}));

test("comparison catalog rejects async checks and duplicate insertion atomically", async () => fixture(async c => {
  const summary = await createStoredComparison(c.store, input(c)), audit = c.store.auditLog();
  assert.throws(() => c.store.saveComparison({ ...summary, id: randomUUID() }, (async () => undefined) as unknown as () => undefined), /synchronously/);
  assert.throws(() => c.store.saveComparison(summary, () => undefined));
  assert.equal(c.store.recentComparisons().length, 1); assert.deepEqual(c.store.auditLog(), audit);
}));

test("CLI and API share immutable comparisons, return explicit not-comparable results, and protect detail", async () => fixture(async c => {
  const cli = resolve(project, "src/cli.ts"), created = JSON.parse((await execute(process.execPath, [cli, "comparisons", "create", "--baseline", c.baselineId, "--candidate", c.candidateId], { cwd: c.directory })).stdout);
  const shown = JSON.parse((await execute(process.execPath, [cli, "comparisons", "show", created.id], { cwd: c.directory })).stdout); assert.equal(shown.verdict, "mismatch_not_observed_in_candidate");
  const listed = JSON.parse((await execute(process.execPath, [cli, "comparisons", "list"], { cwd: c.directory })).stdout); assert.equal(listed.comparisons.length, 1);
  await assert.rejects(execute(process.execPath, [cli, "comparisons", "create", "--baseline", c.candidateId, "--candidate", c.baselineId], { cwd: c.directory }), error => { const result = error as Error & { code: number; stdout: string }; assert.equal(result.code, 1); assert.equal(JSON.parse(result.stdout).outcome, "not_comparable"); return true; });
  const server = await createLocalServer({ workspace: c.directory, assetsRoot: project, port: 0 });
  try {
    assert.equal((await fetch(server.origin + "/api/comparisons")).status, 401);
    const headers = { Authorization: `Bearer ${server.token}`, "Content-Type": "application/json" };
    const response = await fetch(server.origin + "/api/comparisons", { method: "POST", headers, body: JSON.stringify(input(c)) }); assert.equal(response.status, 201); assert.equal(response.headers.get("cache-control"), "no-store");
    const result = await response.json() as { id: string }; assert.equal((await fetch(server.origin + `/api/comparisons/${result.id}`, { headers })).status, 200);
    const invalid = await fetch(server.origin + "/api/comparisons", { method: "POST", headers, body: JSON.stringify({ ...input(c), execute: true }) }); assert.equal(invalid.status, 400); assert.equal((await invalid.json() as { code: string }).code, "comparison_not_created");
    await writeFile(resolve(c.bDir, "report.json"), "PRIVATE_CHANGED_SOURCE");
    const denied = await fetch(server.origin + `/api/comparisons/${result.id}`, { headers }); assert.equal(denied.status, 404); const text = await denied.text(); assert(!text.includes(c.bDir)); assert(!text.includes("PRIVATE_CHANGED_SOURCE"));
    assert.equal((await fetch(server.origin + "/api/comparisons", { headers: { ...headers, Origin: "https://foreign.example" } })).status, 403);
  } finally { await server.close(); }
}));
