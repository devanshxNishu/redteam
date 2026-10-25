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
import { createReportExport, readReportExport, reportExportSummaries, validateReportExportInput } from "../src/report-export.ts";
import { createStoredComparison } from "../src/comparisons.ts";
import { runStudy } from "../src/runner.ts";
const project = resolve(import.meta.dirname, ".."), execute = promisify(execFile);
type Context = { directory: string; store: WorkspaceStore; grantId: string; snapshotDirectory: string; action: ActionRecord; input: ExperimentPlanInput };
async function fixture(work: (c: Context) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-experiments-")), source = resolve(directory, "app"); await mkdir(source); const store = new WorkspaceStore(directory);
  try {
    const text = "// PRIVATE_RAW_CODE_MARKER\nexport {};\n"; await writeFile(resolve(source, "app.ts"), text);
    const grant = grantAccess(store, { name: "Owned source", target: source, kind: "directory", capabilities: ["code:read"] }), snapshot = await captureRepository(store, { grantId: grant.id, target: source });
    const notes = await registerEngineeringObservations(store, { schemaVersion: "1.0", kind: "engineering_observation_input", snapshotRunId: snapshot.runId, requirements: [], observations: [{ id: "OBS-1", type: "source_observation", statement: "Owned unreviewed note", requirementId: null, citations: [{ sourcePath: "app.ts", fileSha256: sha256(text), startLine: 1, endLine: 1 }] }] });
    const action = await createTrackedAction(store, { schemaVersion: "1.0", kind: "action_input", origin: { kind: "engineering_observation", runId: notes.runId, itemId: "OBS-1" }, title: "Owned fixture investigation", owner: "Operator", nextStep: "Plan a separate controlled check.", validationMethod: "Separate approved evidence." });
    const input: ExperimentPlanInput = { schemaVersion: "1.0", kind: "experiment_plan_input", actionId: action.id, expectedActionRevision: 1, title: "PRIVATE_PLAN_TITLE", owner: "Local operator label", hypothesis: "A future fixture change may meet the supplied requirement.", intervention: "A planned owned fixture change; no action occurs on freeze.", outcome: { measure: "Future controlled requirement assertion", successRule: "The predeclared assertion passes in a fresh pair.", collectionMethod: "Separate saved controlled evidence; not collected by this plan." }, samplePlan: { population: "Owned software fixture runs only", recruitment: "No participant research or recruitment occurs.", targetCount: 2 }, horizon: { startsAt: new Date(Date.now() + 60_000).toISOString(), endsAt: new Date(Date.now() + 3_600_000).toISOString() } };
    await work({ directory, store, grantId: grant.id, snapshotDirectory: snapshot.directory, action, input });
  } finally { store.close(); await rm(directory, { recursive: true, force: true }); }
}
const update = { schemaVersion: "1.0", kind: "action_update", expectedRevision: 1, status: "in_progress", note: "Operator declaration only." };


const selection = (id: string) => ({ schemaVersion: "1.0", kind: "report_export_input", title: "Supplied local report", items: [{ kind: "action", id }] });

test("checked action export omits internal paths, raw source, credentials, and unrelated content without changing records", async () => fixture(async c => {
  await writeFile(resolve(c.directory, ".redteam/secret-export-sentinel"), "PRIVATE_PROVIDER_CREDENTIAL_MARKER");
  const before = structuredClone(c.store.actionEvents(c.action.id)), summary = await createReportExport(c.store, selection(c.action.id)), report = await readReportExport(c.store, summary.id);
  assert.equal(report.records.length, 1); assert.equal(report.records[0]?.kind, "action"); assert.equal(report.artifacts.length, 1); const json = JSON.stringify(report); assert(!json.includes("PRIVATE_RAW_CODE_MARKER")); assert(!json.includes("PRIVATE_PROVIDER_CREDENTIAL_MARKER")); assert(!json.includes(c.directory)); assert(!json.includes("/private/var/")); assert(!json.includes('"access":')); assert(!json.includes('"directory":'));
  assert.equal(report.boundaries.testsExecuted, false); assert.equal(report.boundaries.modelCalls, 0); assert.equal(report.boundaries.outcomeCollection, false); assert.equal(report.boundaries.sourceSemantics, "recorded_not_independently_adjudicated"); assert.deepEqual(c.store.actionEvents(c.action.id), before); assert.equal(c.store.jobs().length, 0); assert.equal(c.store.actorRuns().length, 0); assert.equal(reportExportSummaries(c.store)[0]?.recordStatus, "cataloged_unverified");
}));

test("mixed real review, action, supplied plan, and comparison preserve their distinct provenance", { timeout: 60000 }, async () => fixture(async c => {
  const study = JSON.parse(await readFile(resolve(project, "examples/pilot-signup.study.json"), "utf8")), ids: string[] = [];
  for (const variant of ["broken", "fixed"] as const) {
    const result = await runStudy(study, { projectRoot: project, outputRoot: resolve(c.directory, ".redteam/runs"), variant }), report = result.report, id = randomUUID(); ids.push(id);
    c.store.saveJob({ id, variant, status: "completed", createdAt: report.manifest.createdAt, updatedAt: report.generatedAt, reportDirectory: result.directory, findingCount: report.findings.length, artifactCount: report.artifacts.length, error: null });
  }
  const plan = await freezeExperimentPlan(c.store, c.input), comparison = await createStoredComparison(c.store, { baselineReviewId: ids[0]!, candidateReviewId: ids[1]! }), input = { schemaVersion: "1.0", kind: "report_export_input", title: "Controlled local report", items: [{ kind: "review", id: ids[0]! }, { kind: "action", id: c.action.id }, { kind: "experiment", id: plan.id }, { kind: "comparison", id: comparison.id }] };
  const summary = await createReportExport(c.store, input), report = await readReportExport(c.store, summary.id); assert.equal(report.records.length, 4); assert.equal(c.store.jobs().length, 2); assert.equal(c.store.recentExperimentPlans().length, 1); assert.equal(c.store.recentComparisons().length, 1); assert.equal(c.store.action(c.action.id)?.revision, 1);
  assert.equal(report.records[0]?.body.outcome, "findings_found"); assert.equal(report.records[2]?.body.outcomeStatus, "not_collected"); assert.equal(report.records[3]?.body.verdict, "mismatch_not_observed_in_candidate"); assert(!JSON.stringify(report).includes("PRIVATE_RAW_CODE_MARKER"));
  c.store.saveJob({ ...c.store.job(ids[1]!)!, status: "failed" }); assert.deepEqual(reportExportSummaries(c.store), []); await assert.rejects(readReportExport(c.store, summary.id));
}));

test("selection rejects unsupported kinds, missing/duplicate IDs, extra fields, accessors, and excess records without invoking getters", async () => fixture(async c => {
  for (const value of [{ ...selection(c.action.id), execute: true }, { ...selection(c.action.id), items: [] }, { ...selection(c.action.id), items: Array.from({ length: 11 }, () => ({ kind: "action", id: randomUUID() })) }, { ...selection(c.action.id), items: [{ kind: "actor", id: c.action.id }] }, { ...selection(c.action.id), items: [{ kind: "action", id: "../unsafe" }] }, { ...selection(c.action.id), items: [{ kind: "action", id: c.action.id }, { kind: "action", id: c.action.id }] }, { ...selection(c.action.id), items: Array.from({ length: 6 }, () => ({ kind: "review", id: randomUUID() })) }, { ...selection(c.action.id), title: "bad\nheading" }]) assert.throws(() => validateReportExportInput(value));
  let calls = 0; const getter = selection(c.action.id); Object.defineProperty(getter, "title", { enumerable: true, get() { calls++; return "bad"; } }); assert.throws(() => validateReportExportInput(getter));
  const items = selection(c.action.id).items; Object.defineProperty(items, "0", { enumerable: true, get() { calls++; return { kind: "action", id: c.action.id }; } }); assert.throws(() => validateReportExportInput({ ...selection(c.action.id), items })); assert.equal(calls, 0); assert.deepEqual(c.store.recentReportExports(), []);
}));

test("later declared action revisions preserve exported history while altered historical notes are denied", async () => fixture(async c => {
  const summary = await createReportExport(c.store, selection(c.action.id)), before = await readFile(resolve(summary.directory, "report.json")); await updateTrackedAction(c.store, c.action.id, update);
  const report = await readReportExport(c.store, summary.id); assert.equal((report.records[0]?.body.record as { revision: number }).revision, 1); assert.deepEqual(await readFile(resolve(summary.directory, "report.json")), before);
  const db = new DatabaseSync(resolve(c.directory, ".redteam/workspace.sqlite")); try { const event = c.store.actionEvents(c.action.id)[0]!; event.note = "changed historical note"; db.prepare("UPDATE action_events SET document=? WHERE action_id=? AND revision=1").run(JSON.stringify(event), c.action.id); } finally { db.close(); }
  assert.deepEqual(reportExportSummaries(c.store), []); await assert.rejects(readReportExport(c.store, summary.id), /history changed/);
}));

test("permission withdrawal hides exports and blocks retrieval and creation", async () => fixture(async c => {
  const summary = await createReportExport(c.store, selection(c.action.id)); c.store.revokeGrant(c.grantId); assert.deepEqual(reportExportSummaries(c.store), []); await assert.rejects(readReportExport(c.store, summary.id), /revoked/); await assert.rejects(createReportExport(c.store, selection(c.action.id)), /revoked/);
}));

test("expiry denies export views under the original source grant", async context => fixture(async c => {
  const summary = await createReportExport(c.store, selection(c.action.id)); context.mock.method(Date, "now", () => Date.parse(c.store.grant(c.grantId)!.expiresAt) + 1); assert.deepEqual(reportExportSummaries(c.store), []); await assert.rejects(readReportExport(c.store, summary.id), /expired/);
}));

test("changed source artifacts deny previously saved exports without altering their bytes", async () => fixture(async c => {
  const summary = await createReportExport(c.store, selection(c.action.id)), before = await readFile(resolve(summary.directory, "report.json")), source = JSON.parse(await readFile(resolve(c.snapshotDirectory, "report.json"), "utf8")); await writeFile(resolve(c.snapshotDirectory, source.artifacts[0].path), "changed");
  await assert.rejects(readReportExport(c.store, summary.id), /evidence has changed/); assert.deepEqual(await readFile(resolve(summary.directory, "report.json")), before);
}));

test("changed publication, Markdown, and symlink artifacts fail checked export retrieval", async () => fixture(async c => {
  const summary = await createReportExport(c.store, selection(c.action.id)), reportPath = resolve(summary.directory, "report.json"), bytes = await readFile(reportPath), mdPath = resolve(summary.directory, summary.markdownFile), md = await readFile(mdPath);
  await writeFile(reportPath, "{}"); await assert.rejects(readReportExport(c.store, summary.id), /publication has changed/); await writeFile(reportPath, bytes); await writeFile(mdPath, "changed"); await assert.rejects(readReportExport(c.store, summary.id), /Markdown has changed/);
  await unlink(mdPath); const outside = resolve(c.directory, "outside.md"); await writeFile(outside, md); await symlink(outside, mdPath); await assert.rejects(readReportExport(c.store, summary.id));
}));

test("supplied Markdown and HTML remain literal inside a fence longer than every contained run", async () => fixture(async c => {
  await updateTrackedAction(c.store, c.action.id, { ...update, title: '<img src="https://invalid.example/private">', nextStep: 'Untrusted text with ' + '`'.repeat(20) + '\n# Fake verified result\n![image](https://invalid.example/)' });
  const summary = await createReportExport(c.store, selection(c.action.id)), md = await readFile(resolve(summary.directory, summary.markdownFile), "utf8"); assert(md.includes('`'.repeat(21) + 'json')); assert(md.includes('\\n# Fake verified result')); assert(md.includes('No') || md.includes('It runs no test or model')); assert.equal(md.split('\n# Fake verified result').length, 1);
}));

test("catalog source checks roll back insertion and audit while preserving private orphan reports", async () => fixture(async c => {
  const original = c.store.saveReportExport.bind(c.store); c.store.saveReportExport = (...args) => { c.store.revokeGrant(c.grantId); return original(...args); };
  await assert.rejects(createReportExport(c.store, selection(c.action.id)), /revoked/); assert.deepEqual(c.store.recentReportExports(), []); assert(!c.store.auditLog().some(event => event.action === "report_export_saved")); const dirs = await readdir(resolve(c.directory, ".redteam/report-exports")); assert.equal(dirs.length, 1); assert(await readFile(resolve(c.directory, ".redteam/report-exports", dirs[0]!, "report.json")));
}));

test("catalog guards are synchronous and exports cannot overwrite an existing identity", async () => fixture(async c => {
  const summary = await createReportExport(c.store, selection(c.action.id)), audit = c.store.auditLog(); assert.throws(() => c.store.saveReportExport({ ...summary, id: randomUUID() }, (async () => undefined) as unknown as () => undefined), /synchronously/); assert.throws(() => c.store.saveReportExport(summary, () => undefined)); assert.equal(c.store.recentReportExports().length, 1); assert.deepEqual(c.store.auditLog(), audit);
}));

test("terminal export/list/show creates checked JSON and Markdown and respects current rights", async () => fixture(async c => {
  const cli = resolve(project, "src/cli.ts"), file = resolve(c.directory, "selection.json"); await writeFile(file, JSON.stringify(selection(c.action.id)));
  const result = JSON.parse((await execute(process.execPath, [cli, "reports", "export", file], { cwd: c.directory })).stdout); assert(await readFile(result.json)); assert(await readFile(result.markdown));
  assert.equal(JSON.parse((await execute(process.execPath, [cli, "reports", "show", result.id], { cwd: c.directory })).stdout).records.length, 1); assert.equal(JSON.parse((await execute(process.execPath, [cli, "reports", "list"], { cwd: c.directory })).stdout).reportExports.length, 1);
  c.store.revokeGrant(c.grantId); await assert.rejects(execute(process.execPath, [cli, "reports", "show", result.id], { cwd: c.directory })); assert.equal(JSON.parse((await execute(process.execPath, [cli, "reports", "list"], { cwd: c.directory })).stdout).reportExports.length, 0);
}));

test("large valid histories are refused at the serialized export boundary without catalog insertion", async () => fixture(async c => {
  const ids: string[] = [];
  for (let index = 0; index < 10; index++) {
    let action = index === 0 ? c.action : await createTrackedAction(c.store, { schemaVersion: "1.0", kind: "action_input", origin: { kind: c.action.origin.kind, runId: c.action.origin.runId, itemId: c.action.origin.itemId }, title: `Owned authored history ${index}`, owner: "Operator", nextStep: "Separate planned check.", validationMethod: "Separate evidence." });
    ids.push(action.id);
    for (let revision = 2; revision <= 100; revision++) { action = { ...action, revision, updatedAt: new Date().toISOString(), status: revision % 2 ? "blocked" : "in_progress" }; c.store.saveAction(action, revision - 1, "🙂".repeat(500), () => undefined); }
  }
  await assert.rejects(createReportExport(c.store, { schemaVersion: "1.0", kind: "report_export_input", title: "Oversized authored histories", items: ids.map(id => ({ kind: "action", id })) }), /bounded export size/); assert.deepEqual(c.store.recentReportExports(), []);
}));
