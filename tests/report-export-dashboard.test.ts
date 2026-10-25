import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { createLocalServer } from "../src/server.ts";
import { grantAccess } from "../src/access.ts";
import { captureRepository } from "../src/repository.ts";
import { registerEngineeringObservations } from "../src/engineering.ts";
import { createTrackedAction, updateTrackedAction } from "../src/actions.ts";
import { freezeExperimentPlan, readExperimentPlan } from "../src/experiments.ts";
import { createReportExport } from "../src/report-export.ts";
import { createStoredComparison } from "../src/comparisons.ts";
import { runStudy } from "../src/runner.ts";
import { randomUUID } from "node:crypto";
import { sha256 } from "../src/evidence.ts";

async function fixture(work: (context: { page: import("playwright").Page; server: Awaited<ReturnType<typeof createLocalServer>>; workspace: string; notesId: string; actionId: string; planId: string; grantId: string; refresh: () => Promise<unknown> }) => Promise<void>, hours = 24): Promise<void> {
  const workspace = await mkdtemp(resolve(tmpdir(), "redteam-report-export-ui-")), source = resolve(workspace, "app"); await mkdir(source);
  const bytes = "// PRIVATE_SOURCE_MARKER\nexport {};\n"; await writeFile(resolve(source, "app.ts"), bytes);
  const server = await createLocalServer({ workspace, assetsRoot: resolve(import.meta.dirname, ".."), port: 0 });
  process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(import.meta.dirname, "../.cache/ms-playwright"); const { chromium } = await import("playwright");
  const browser = await chromium.launch(existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome") ? { channel: "chrome", headless: true } : { headless: true }).catch(async error => { await server.close(); await rm(workspace, { recursive: true, force: true }); throw error; });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: "Asia/Kolkata" }), errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message)); page.on("dialog", async dialog => { errors.push(dialog.message()); await dialog.dismiss(); });
  try {
    const access = grantAccess(server.store, { name: "Owned source", target: source, kind: "directory", capabilities: ["code:read"], expiresInHours: hours });
    const snapshot = await captureRepository(server.store, { grantId: access.id, target: source });
    const notes = await registerEngineeringObservations(server.store, { schemaVersion: "1.0", kind: "engineering_observation_input", snapshotRunId: snapshot.runId, requirements: [], observations: [{ id: "OBS-1", type: "source_observation", statement: "Owned unreviewed note", requirementId: null, citations: [{ sourcePath: "app.ts", fileSha256: sha256(bytes), startLine: 1, endLine: 1 }] }] });
    const action = await createTrackedAction(server.store, { schemaVersion: "1.0", kind: "action_input", origin: { kind: "engineering_observation", runId: notes.runId, itemId: "OBS-1" }, title: "Owned fixture follow-up", owner: "Local operator label", nextStep: "Plan a separate check.", validationMethod: "Separate evidence." });
    const plan = await freezeExperimentPlan(server.store, { schemaVersion: "1.0", kind: "experiment_plan_input", actionId: action.id, expectedActionRevision: 1, title: "Owned supplied experiment plan", owner: "Operator", hypothesis: "A future fixture change may meet the supplied requirement.", intervention: "Planned only; not executed.", outcome: { measure: "Future controlled assertion", successRule: "Both assertions pass.", collectionMethod: "Separate evidence, not collected here." }, samplePlan: { population: "Owned software fixtures only", recruitment: "No human participants or recruitment.", targetCount: 2 }, horizon: { startsAt: new Date(Date.now()+3600000).toISOString(), endsAt: new Date(Date.now()+7200000).toISOString() } });
    await page.goto(server.origin + "/#reviews"); await page.getByText("Local service connected", { exact: true }).waitFor();
    await work({ page, server, workspace, planId: plan.id, notesId: notes.runId, actionId: action.id, grantId: access.id, refresh: () => page.evaluate(() => window.dispatchEvent(new Event("focus"))) }); assert.deepEqual(errors, []);
  } finally { await page.close(); await browser.close(); await server.close(); await rm(workspace, { recursive: true, force: true }); }
}


type Context = Parameters<Parameters<typeof fixture>[0]>[0];
const frames = (page: import("playwright").Page) => page.evaluate(() => new Promise(accept => requestAnimationFrame(() => requestAnimationFrame(() => accept(null)))));
const option = (c: Context, kind: string, id: string) => c.page.locator(`input[data-export-kind="${kind}"][data-export-id="${id}"]`);
async function form(c: Context, items = [{ kind: "action", id: c.actionId }]) {
  await c.page.getByRole("button", { name: "Select records for export", exact: true }).click(); await c.page.locator("#export-title").fill('<img src=x onerror="alert(1)"> ' + 'A'.repeat(140));
  for (const item of items) await option(c, item.kind, item.id).check();
}
async function bundle(c: Context) { const summary = await createReportExport(c.server.store, { schemaVersion: "1.0", kind: "report_export_input", title: "Private supplied report title", items: [{ kind: "action", id: c.actionId }, { kind: "experiment", id: c.planId }] }); await c.refresh(); await c.page.locator(`[data-report-export-id="${summary.id}"]`).waitFor(); return summary; }
async function inspect(c: Context, id: string) { await c.page.locator(`[data-report-export-id="${id}"]`).getByRole("button").click(); await c.page.locator("#detail-title").filter({ hasText: "Checked local report export" }).waitFor(); }
async function otherAction(c: Context, hours = 24) {
  const path = resolve(c.workspace, `other-app-${randomUUID()}`), text = "export {};\n"; await mkdir(path); await writeFile(resolve(path, "app.ts"), text);
  const grant = grantAccess(c.server.store, { name: "Other owned source", target: path, kind: "directory", capabilities: ["code:read"], expiresInHours: hours }), snapshot = await captureRepository(c.server.store, { grantId: grant.id, target: path }), notes = await registerEngineeringObservations(c.server.store, { schemaVersion: "1.0", kind: "engineering_observation_input", snapshotRunId: snapshot.runId, requirements: [], observations: [{ id: "OBS-1", type: "source_observation", statement: "Other unreviewed note", requirementId: null, citations: [{ sourcePath: "app.ts", fileSha256: sha256(text), startLine: 1, endLine: 1 }] }] });
  const action = await createTrackedAction(c.server.store, { schemaVersion: "1.0", kind: "action_input", origin: { kind: "engineering_observation", runId: notes.runId, itemId: "OBS-1" }, title: "PRIVATE_OTHER_ACTION_TITLE", owner: "Operator", nextStep: "Plan.", validationMethod: "Separate evidence." }); return { action, grant };
}

test("export dashboard creates a real mixed bundle, downloads exact checked bytes, renders literals on mobile, and clears Blob URLs", { timeout: 60000 }, async () => fixture(async c => {
  const project = resolve(import.meta.dirname, ".."), study = JSON.parse(await readFile(resolve(project, "examples/pilot-signup.study.json"), "utf8")), ids: string[] = [];
  for (const variant of ["broken", "fixed"] as const) { const capture = await runStudy(study, { projectRoot: project, outputRoot: resolve(c.workspace, ".redteam/runs"), variant }), report = capture.report, id = randomUUID(); ids.push(id); c.server.store.saveJob({ id, variant, status: "completed", createdAt: report.manifest.createdAt, updatedAt: report.generatedAt, reportDirectory: capture.directory, findingCount: report.findings.length, artifactCount: report.artifacts.length, error: null }); }
  const comparison = await createStoredComparison(c.server.store, { baselineReviewId: ids[0]!, candidateReviewId: ids[1]! }); await c.refresh(); await c.page.locator(`[data-comparison-id="${comparison.id}"]`).waitFor();
  await form(c, [{ kind: "review", id: ids[0]! }, { kind: "action", id: c.actionId }, { kind: "experiment", id: c.planId }, { kind: "comparison", id: comparison.id }]); const title = await c.page.locator("#export-title").inputValue(); await c.refresh(); await frames(c.page); assert.equal(await c.page.locator("#export-title").inputValue(), title); assert.equal(await c.page.locator("#export-options input:checked").count(), 4);
  await c.page.setViewportSize({ width: 390, height: 844 }); assert(await c.page.locator("#review-dialog").evaluate(element => element.scrollWidth <= element.clientWidth)); await c.page.getByRole("button", { name: "Create checked report export", exact: true }).click(); await c.page.locator("#detail-title").filter({ hasText: "Checked local report export" }).waitFor();
  const summary = c.server.store.recentReportExports()[0]!; assert.equal(summary.sourcePins.length, 4); assert.equal(c.server.store.jobs().length, 2); assert.equal(c.server.store.action(c.actionId)?.revision, 1); assert.equal(await c.page.locator("#detail-content img").count(), 0); assert((await c.page.locator("#detail-content").textContent())?.includes(title));
  await c.page.locator("#detail-content details").first().locator("summary").click(); assert(await c.page.locator("#review-dialog").evaluate(element => element.scrollWidth <= element.clientWidth)); assert(await c.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await c.page.evaluate(() => { const active = new Set<string>(), create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL); URL.createObjectURL = value => { const url = create(value); active.add(url); return url; }; URL.revokeObjectURL = url => { active.delete(url); revoke(url); }; (window as unknown as Record<string, unknown>).exportURLCount = () => active.size; });
  for (const [format, name] of [["json", "Download checked JSON"], ["md", "Download checked Markdown"]] as const) { const event = c.page.waitForEvent("download"); await c.page.getByRole("button", { name, exact: true }).click(); const download = await event; assert.equal(download.suggestedFilename(), `redteam-report-${summary.id}.${format}`); const path = await download.path(); assert(path); const bytes = await readFile(path); assert.deepEqual(bytes, await readFile(format === "json" ? resolve(summary.directory, "report.json") : resolve(summary.directory, summary.markdownFile))); assert(!bytes.toString().includes("PRIVATE_SOURCE_MARKER")); }
  await c.page.getByRole("button", { name: "Close review detail" }).click(); assert.equal(await c.page.evaluate(() => ((window as unknown as Record<string, () => number>).exportURLCount!)()), 0); assert.deepEqual(await c.page.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0]);
}));

test("export selection preserves its title and choices while removing an unselected withdrawn source, then clears a selected withdrawal", { timeout: 30000 }, async () => fixture(async c => {
  const other = await otherAction(c); await c.refresh(); await c.page.locator(`[data-action-id="${other.action.id}"]`).waitFor(); await form(c); const title = await c.page.locator("#export-title").inputValue(); assert.equal(await option(c, "action", other.action.id).count(), 1);
  c.server.store.revokeGrant(other.grant.id); await c.refresh(); await option(c, "action", other.action.id).waitFor({ state: "detached" }); assert.equal(await c.page.locator("#export-title").inputValue(), title); assert.equal(await option(c, "action", c.actionId).isChecked(), true); assert(!(await c.page.locator("#export-options").textContent())?.includes("PRIVATE_OTHER_ACTION_TITLE"));
  c.server.store.revokeGrant(c.grantId); await c.refresh(); await c.page.locator("#review-dialog").waitFor({ state: "hidden" }); assert.equal(await c.page.locator("#detail-content").textContent(), "");
}));

test("export form uses the earliest selected source expiry across two grants", { timeout: 15000 }, async () => fixture(async c => {
  const other = await otherAction(c, 0.001); await c.refresh(); await c.page.locator(`[data-action-id="${other.action.id}"]`).waitFor(); await form(c, [{ kind: "action", id: c.actionId }, { kind: "action", id: other.action.id }]);
  await c.page.locator("#review-dialog").waitFor({ state: "hidden", timeout: 6000 }); assert.equal(await c.page.locator("#detail-content").textContent(), ""); assert.equal(c.server.store.recentReportExports().length, 0);
}));

test("export form rejects an empty bundle and caps selection without an automatic write", { timeout: 30000 }, async () => fixture(async c => {
  const original = c.server.store.action(c.actionId)!;
  for (let index = 0; index < 10; index++) await createTrackedAction(c.server.store, { schemaVersion: "1.0", kind: "action_input", origin: { kind: original.origin.kind, runId: original.origin.runId, itemId: original.origin.itemId }, title: `Additional authored action ${index}`, owner: "Operator", nextStep: "Plan.", validationMethod: "Separate check." });
  await c.refresh(); await c.page.getByRole("button", { name: "Select records for export", exact: true }).click(); await c.page.locator("#export-title").fill("Bounded selection"); await c.page.getByRole("button", { name: "Create checked report export", exact: true }).click(); await c.page.getByText("Supply a title without control characters and select at least one record.", { exact: true }).waitFor();
  const inputs = c.page.locator('input[data-export-kind="action"]'); for (let index = 0; index < 10; index++) await inputs.nth(index).check(); await inputs.nth(10).click(); assert.equal(await inputs.nth(10).isChecked(), false); assert.equal(await c.page.locator("#export-options input:checked").count(), 10); assert.equal(c.server.store.recentReportExports().length, 0);
}));

test("checked export detail is cleared after its saved Markdown changes", { timeout: 30000 }, async () => fixture(async c => {
  const summary = await bundle(c); await inspect(c, summary.id); await writeFile(resolve(summary.directory, summary.markdownFile), "PRIVATE_TAMPERED_EXPORT"); await c.refresh(); await c.page.locator("#review-dialog").waitFor({ state: "hidden" }); assert.equal(await c.page.locator("#detail-content").textContent(), ""); assert(!(await c.page.locator("#toast").textContent())?.includes("PRIVATE_TAMPERED_EXPORT"));
}));

test("late initial export detail cannot restore a view after navigation", { timeout: 30000 }, async () => fixture(async c => {
  const summary = await bundle(c); let release!: () => void, ready!: () => void, done!: () => void; const gate = new Promise<void>(accept => { release = accept; }), captured = new Promise<void>(accept => { ready = accept; }), finished = new Promise<void>(accept => { done = accept; });
  await c.page.route(`**/api/report-exports/${summary.id}`, async route => { const response = await route.fetch(); ready(); await gate; await route.fulfill({ response }).catch(() => {}); done(); }); await c.page.locator(`[data-report-export-id="${summary.id}"]`).getByRole("button").click(); await captured; await c.page.locator('a[data-view="access"]').click(); release(); await finished; await frames(c.page); assert.equal(await c.page.locator("#review-dialog").isVisible(), false); assert.equal(await c.page.locator("#detail-content").textContent(), "");
}));

test("a committed export response arriving after source revocation cannot reopen detail or repeat creation", { timeout: 30000 }, async () => fixture(async c => {
  await form(c); let release!: () => void, ready!: () => void, done!: () => void; let posts = 0; const gate = new Promise<void>(accept => { release = accept; }), captured = new Promise<void>(accept => { ready = accept; }), finished = new Promise<void>(accept => { done = accept; });
  await c.page.route("**/api/report-exports", async route => { if (route.request().method() !== "POST") { await route.continue(); return; } posts++; const response = await route.fetch(); assert.equal(response.status(), 201); ready(); await gate; await route.fulfill({ response }).catch(() => {}); done(); }); await c.page.getByRole("button", { name: "Create checked report export", exact: true }).click(); await captured;
  c.server.store.revokeGrant(c.grantId); await c.refresh(); await c.page.locator("#review-dialog").waitFor({ state: "hidden" }); release(); await finished; await frames(c.page); assert.equal(posts, 1); assert.equal(c.server.store.recentReportExports().length, 1); assert.equal(await c.page.locator(".report-export-record").count(), 0); assert.equal(await c.page.locator("#detail-content").textContent(), "");
}));

test("late download bytes cannot start a native download after source revocation closes the view", { timeout: 30000 }, async () => fixture(async c => {
  const summary = await bundle(c); await inspect(c, summary.id); let release!: () => void, ready!: () => void, done!: () => void; let downloads = 0; c.page.on("download", () => downloads++);
  const gate = new Promise<void>(accept => { release = accept; }), captured = new Promise<void>(accept => { ready = accept; }), finished = new Promise<void>(accept => { done = accept; }); await c.page.route(`**/api/report-exports/${summary.id}/download.json`, async route => { const response = await route.fetch(); assert.equal(response.status(), 200); ready(); await gate; await route.fulfill({ response }).catch(() => {}); done(); });
  await c.page.getByRole("button", { name: "Download checked JSON", exact: true }).click(); await captured; c.server.store.revokeGrant(c.grantId); await c.refresh(); await c.page.locator("#review-dialog").waitFor({ state: "hidden" }); release(); await finished; await frames(c.page); assert.equal(downloads, 0); assert.equal(await c.page.locator("#detail-content").textContent(), "");
}));

test("a changed download digest is denied before native download dispatch", { timeout: 30000 }, async () => fixture(async c => {
  const summary = await bundle(c); await inspect(c, summary.id); let downloads = 0; c.page.on("download", () => downloads++);
  await c.page.route(`**/api/report-exports/${summary.id}/download.md`, async route => { const response = await route.fetch(); await route.fulfill({ response, headers: { ...response.headers(), "x-content-sha256": "0".repeat(64) } }); }); await c.page.getByRole("button", { name: "Download checked Markdown", exact: true }).click(); await c.page.locator("#review-dialog").waitFor({ state: "hidden" }); await frames(c.page); assert.equal(downloads, 0); assert.match(await c.page.locator("#toast").textContent() ?? "", /Download hash did not match/);
}));

test("mixed old export/action/plan/code catalogs cannot display private export metadata after current grant withdrawal", { timeout: 30000 }, async () => fixture(async c => {
  await bundle(c); let release!: () => void; const gate = new Promise<void>(accept => { release = accept; }), captured: Promise<void>[] = [];
  for (const path of ["report-exports", "actions", "experiments", "code-runs"]) { let ready!: () => void; captured.push(new Promise<void>(accept => { ready = accept; })); await c.page.route(`**/api/${path}`, async route => { const response = await route.fetch(); ready(); await gate; await route.fulfill({ response }); }); }
  await c.page.route("**/api/workspace", async route => { await gate; const response = await route.fetch(); await route.fulfill({ response }); }); await c.refresh(); await Promise.all(captured); c.server.store.revokeGrant(c.grantId); release(); await c.page.locator(".report-export-record").waitFor({ state: "detached" }); assert(!(await c.page.locator("#report-export-list").textContent())?.includes("Private supplied report title"));
}));

test("failed metadata refresh clears export selection and its private option labels", { timeout: 30000 }, async () => fixture(async c => {
  await form(c); await c.page.route("**/api/report-exports", route => route.abort("failed")); await c.refresh(); await c.page.locator("#review-dialog").waitFor({ state: "hidden" }); assert.equal(await c.page.locator("#detail-content").textContent(), ""); assert.equal(await c.page.locator("#create-report-export").isDisabled(), true);
}));
