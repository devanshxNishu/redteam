import test from "node:test";
import { request } from "node:http";
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


async function apiFixture(work: (c: Context & { server: Awaited<ReturnType<typeof createLocalServer>>; headers: Record<string, string> }) => Promise<void>) {
  await fixture(async c => { const server = await createLocalServer({ workspace: c.directory, assetsRoot: project, port: 0 }); try { await work({ ...c, server, headers: { Authorization: `Bearer ${server.token}`, "Content-Type": "application/json" } }); } finally { await server.close(); } });
}

test("export API creates checked records and attachment downloads with exact bytes and current local session boundaries", async () => apiFixture(async c => {
  const base = c.server.origin + "/api/report-exports";
  assert.equal((await fetch(base)).status, 401); assert.equal((await fetch(base, { method: "POST", headers: c.headers, body: JSON.stringify(selection(c.action.id)), credentials: "omit" })).status, 201);
  const summary = c.store.recentReportExports()[0]!, detail = await fetch(`${base}/${summary.id}`, { headers: c.headers }); assert.equal(detail.status, 200); assert.equal(detail.headers.get("cache-control"), "no-store");
  const list = await (await fetch(base, { headers: c.headers })).json() as { reportExports: { sources: unknown[]; recordStatus: string }[] }; assert.equal(list.reportExports[0]?.recordStatus, "cataloged_unverified"); assert.equal(list.reportExports[0]?.sources.length, 1); assert(!JSON.stringify(list).includes("sourcePins")); assert(!JSON.stringify(list).includes(c.directory)); assert(!JSON.stringify(list).includes("origin"));
  for (const format of ["json", "md"]) {
    const response = await fetch(`${base}/${summary.id}/download.${format}`, { headers: c.headers }); assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal(response.headers.get("content-disposition"), `attachment; filename="redteam-report-${summary.id}.${format}"`); const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(response.headers.get("x-content-sha256"), sha256(bytes)); assert.equal(Number(response.headers.get("content-length")), bytes.length); assert.deepEqual(bytes, await readFile(format === "json" ? resolve(summary.directory, "report.json") : resolve(summary.directory, summary.markdownFile)));
  }
  assert.equal((await fetch(base, { headers: { ...c.headers, Origin: "https://foreign.example" } })).status, 403); const forged = await new Promise<number | undefined>((accept, reject) => { const attempt = request(base, { headers: { ...c.headers, Host: "forged.example" } }, response => { response.resume(); accept(response.statusCode); }); attempt.on("error", reject); attempt.end(); }); assert.equal(forged, 421); assert.equal(c.store.jobs().length, 0); assert.equal(c.store.actorRuns().length, 0); assert.equal(c.store.actionEvents(c.action.id).length, 1);
}));

test("creation and unavailable detail errors are static and unsupported download/mutation routes stay closed", async () => apiFixture(async c => {
  const base = c.server.origin + "/api/report-exports";
  const invalid = await fetch(base, { method: "POST", headers: c.headers, body: JSON.stringify({ ...selection(c.action.id), execute: true }) }); assert.equal(invalid.status, 400); const invalidText = await invalid.text(); assert(!invalidText.includes(c.directory)); assert(!invalidText.includes("PRIVATE_PLAN_TITLE"));
  const summary = await createReportExport(c.store, selection(c.action.id));
  for (const route of [`${base}/${randomUUID()}`, `${base}/${summary.id}/download.html`, `${base}/${summary.id}/artifacts/private`]) assert.equal((await fetch(route, { headers: c.headers })).status, 404);
  for (const method of ["PATCH", "DELETE"]) assert.equal((await fetch(`${base}/${summary.id}`, { method, headers: c.headers, body: "{}" })).status, 404);
  await writeFile(resolve(summary.directory, summary.markdownFile), "PRIVATE_CHANGED_EXPORT_CONTENT");
  for (const suffix of ["", "/download.json", "/download.md"]) { const response = await fetch(`${base}/${summary.id}${suffix}`, { headers: c.headers }); assert.equal(response.status, 404); const text = await response.text(); assert(!text.includes(c.directory)); assert(!text.includes("PRIVATE_CHANGED_EXPORT_CONTENT")); assert.equal(JSON.parse(text).code, "report_export_unavailable"); }
}));

test("source withdrawal hides export catalog and denies detail and both downloads without deleting delivered copies", async () => apiFixture(async c => {
  const summary = await createReportExport(c.store, selection(c.action.id)), base = c.server.origin + `/api/report-exports/${summary.id}`, delivered = Buffer.from(await (await fetch(base + "/download.json", { headers: c.headers })).arrayBuffer()); c.store.revokeGrant(c.grantId);
  const list = await (await fetch(c.server.origin + "/api/report-exports", { headers: c.headers })).json() as { reportExports: unknown[] }; assert.deepEqual(list.reportExports, []);
  for (const suffix of ["", "/download.json", "/download.md"]) { const response = await fetch(base + suffix, { headers: c.headers }); assert.equal(response.status, 404); assert(!(await response.text()).includes(c.directory)); }
  assert.deepEqual(await readFile(resolve(summary.directory, "report.json")), delivered);
}));

test("expired source permission also blocks download", async context => apiFixture(async c => {
  const summary = await createReportExport(c.store, selection(c.action.id)); context.mock.method(Date, "now", () => Date.parse(c.store.grant(c.grantId)!.expiresAt) + 1);
  assert.equal((await fetch(c.server.origin + `/api/report-exports/${summary.id}/download.md`, { headers: c.headers })).status, 404);
}));

test("later action updates preserve historical downloads but changed historical notes deny managed delivery", async () => apiFixture(async c => {
  const summary = await createReportExport(c.store, selection(c.action.id)), base = c.server.origin + `/api/report-exports/${summary.id}`, first = await (await fetch(base + "/download.json", { headers: c.headers })).text(); await updateTrackedAction(c.store, c.action.id, update);
  assert.equal(await (await fetch(base + "/download.json", { headers: c.headers })).text(), first);
  const db = new DatabaseSync(resolve(c.directory, ".redteam/workspace.sqlite")); try { const event = c.store.actionEvents(c.action.id)[0]!; event.note = "altered old note"; db.prepare("UPDATE action_events SET document=? WHERE action_id=? AND revision=1").run(JSON.stringify(event), c.action.id); } finally { db.close(); }
  assert.equal((await fetch(base + "/download.json", { headers: c.headers })).status, 404); assert.equal((await fetch(base + "/download.md", { headers: c.headers })).status, 404);
}));

test("permission is checked once more after full source verification and immediately before delivery", async () => apiFixture(async c => {
  const summary = await createReportExport(c.store, selection(c.action.id)), original = c.server.store.reportExport.bind(c.server.store); let reads = 0;
  c.server.store.reportExport = id => { const value = original(id); if (++reads === 2) c.store.revokeGrant(c.grantId); return value; };
  const response = await fetch(c.server.origin + `/api/report-exports/${summary.id}/download.json`, { headers: c.headers }); assert.equal(reads, 2); assert.equal(response.status, 404); assert.equal(response.headers.get("content-disposition"), null); const text = await response.text(); assert(!text.includes("Owned fixture investigation")); assert.equal(JSON.parse(text).code, "report_export_unavailable");
}));
