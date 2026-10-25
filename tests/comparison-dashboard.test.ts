import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { runStudy } from "../src/runner.ts";
import { createLocalServer } from "../src/server.ts";
import { createStoredComparison } from "../src/comparisons.ts";
import { createTrackedAction } from "../src/actions.ts";
const project = resolve(import.meta.dirname, ".."); let seed: string;
const captures: Awaited<ReturnType<typeof runStudy>>[] = [];
before(async () => {
  seed = await mkdtemp(resolve(tmpdir(), "redteam-comparison-ui-seed-"));
  const study = JSON.parse(await readFile(resolve(project, "examples/pilot-signup.study.json"), "utf8"));
  for (const variant of ["broken", "fixed"] as const) captures.push(await runStudy(study, { projectRoot: project, outputRoot: resolve(seed, "runs"), variant }));
});
after(async () => { if (seed) await rm(seed, { recursive: true, force: true }); });
type Context = { page: import("playwright").Page; server: Awaited<ReturnType<typeof createLocalServer>>; baselineId: string; candidateId: string; candidatePath: string; refresh: () => Promise<unknown> };
async function fixture(work: (context: Context) => Promise<void>): Promise<void> {
  const workspace = await mkdtemp(resolve(tmpdir(), "redteam-comparison-ui-")), server = await createLocalServer({ workspace, assetsRoot: project, port: 0 });
  process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(project, ".cache/ms-playwright"); const { chromium } = await import("playwright");
  const browser = await chromium.launch(existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome") ? { channel: "chrome", headless: true } : { headless: true }).catch(async error => { await server.close(); await rm(workspace, { recursive: true, force: true }); throw error; });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors: string[] = [], ids = [randomUUID(), randomUUID()];
  page.on("pageerror", error => errors.push(error.message)); page.on("dialog", async dialog => { errors.push(dialog.message()); await dialog.dismiss(); });
  try {
    for (const [index, capture] of captures.entries()) {
      const target = resolve(workspace, ".redteam/runs", capture.report.runId); await mkdir(resolve(target, ".."), { recursive: true }); await cp(capture.directory, target, { recursive: true });
      const report = capture.report; server.store.saveJob({ id: ids[index]!, variant: report.manifest.fixtureVariant, status: "completed", createdAt: report.manifest.createdAt, updatedAt: report.generatedAt, reportDirectory: target, findingCount: report.findings.length, artifactCount: report.artifacts.length, error: null });
    }
    await page.goto(server.origin + "/#reviews"); await page.getByText("Local service connected", { exact: true }).waitFor();
    await work({ page, server, baselineId: ids[0]!, candidateId: ids[1]!, candidatePath: resolve(workspace, ".redteam/runs", captures[1]!.report.runId, "report.json"), refresh: () => page.evaluate(() => window.dispatchEvent(new Event("focus"))) }); assert.deepEqual(errors, []);
  } finally { await page.close(); await browser.close(); await server.close(); await rm(workspace, { recursive: true, force: true }); }
}
const frames = (page: import("playwright").Page) => page.evaluate(() => new Promise(accept => requestAnimationFrame(() => requestAnimationFrame(() => accept(null)))));
async function select(c: Context, reversed = false) {
  await c.page.getByRole("button", { name: "Compare saved reviews", exact: true }).click();
  await c.page.locator("#comparison-baseline").selectOption(reversed ? c.candidateId : c.baselineId);
  await c.page.locator("#comparison-candidate").selectOption(reversed ? c.baselineId : c.candidateId);
}
async function saved(c: Context) {
  const summary = await createStoredComparison(c.server.store, { baselineReviewId: c.baselineId, candidateReviewId: c.candidateId }); await c.refresh();
  await c.page.locator(`[data-comparison-id="${summary.id}"]`).waitFor(); return summary;
}

test("comparison dashboard creates checked results, exposes scope/reasons, and preserves action declarations on desktop and mobile", { timeout: 30000 }, async () => fixture(async c => {
  const { page, server } = c; assert.match(await page.locator("#comparison-run-list").textContent() ?? "", /No recent comparisons/);
  const action = await createTrackedAction(server.store, { schemaVersion: "1.0", kind: "action_input", origin: { kind: "browser_finding", runId: c.baselineId, itemId: captures[0]!.report.findings[0]!.id }, title: "Declared fixture follow-up", owner: "Operator", nextStep: "Investigate.", validationMethod: "Separate controlled check." });
  await select(c); await page.locator("#comparison-candidate").selectOption(c.baselineId); await page.getByRole("button", { name: "Create comparison" }).click(); await page.getByText("Choose two different reviews.", { exact: true }).waitFor(); assert.equal(server.store.recentComparisons().length, 0);
  await page.locator("#comparison-candidate").selectOption(c.candidateId); await c.refresh(); await frames(page); assert.equal(await page.locator("#comparison-baseline").inputValue(), c.baselineId); assert.equal(await page.locator("#comparison-candidate").inputValue(), c.candidateId);
  await page.getByRole("button", { name: "Create comparison" }).click(); await page.locator("#detail-title").filter({ hasText: "Saved controlled-review comparison" }).waitFor();
  const content = await page.locator("#detail-content").textContent() ?? ""; assert(content.includes("mismatch not observed in candidate")); assert(content.includes(c.baselineId)); assert(content.includes(captures[0]!.report.runId)); assert(content.includes("DEMO-SIGNUP-001")); assert(content.includes("Action progress and history are unchanged")); assert(content.includes("not a causal fix"));
  assert.equal(server.store.jobs().length, 2); assert.deepEqual(server.store.action(action.id), action); assert.equal(server.store.actionEvents(action.id).length, 1);
  await page.setViewportSize({ width: 390, height: 844 }); assert(await page.locator("#review-dialog").evaluate(element => element.scrollWidth <= element.clientWidth)); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole("button", { name: "Close review detail" }).click(); await select(c, true); assert(await page.locator("#review-dialog").evaluate(element => element.scrollWidth <= element.clientWidth));
  await page.getByRole("button", { name: "Create comparison" }).click(); await page.locator("#detail-title").filter({ hasText: "Saved controlled-review comparison" }).waitFor(); assert.match(await page.locator("#detail-content").textContent() ?? "", /not comparable/); assert.match(await page.locator("#detail-content").textContent() ?? "", /candidate time precedes baseline or is invalid/);
  assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0]);
}));

test("comparison detail renders API text safely and clears changed source evidence on refresh", { timeout: 30000 }, async () => fixture(async c => {
  const summary = await saved(c), path = `**/api/comparisons/${summary.id}`, marker = '<img src=x onerror="alert(1)">';
  await c.page.route(path, async route => { const response = await route.fetch(); const report = await response.json(); report.limitations.push(marker); await route.fulfill({ response, json: report }); });
  await c.page.locator(`[data-comparison-id="${summary.id}"]`).getByRole("button").click(); await c.page.getByText(marker, { exact: true }).waitFor(); assert.equal(await c.page.locator("#detail-content img").count(), 0); await c.page.unroute(path);
  await writeFile(c.candidatePath, "CHANGED_PRIVATE_SOURCE"); await c.refresh(); await c.page.locator("#review-dialog").waitFor({ state: "hidden" }); assert.equal(await c.page.locator("#detail-content").textContent(), ""); assert(!(await c.page.locator("#toast").textContent())?.includes("CHANGED_PRIVATE_SOURCE"));
}));

test("late initial comparison detail cannot restore a view after navigation", { timeout: 30000 }, async () => fixture(async c => {
  const summary = await saved(c); let release!: () => void, ready!: () => void, done!: () => void;
  const gate = new Promise<void>(accept => { release = accept; }), captured = new Promise<void>(accept => { ready = accept; }), finished = new Promise<void>(accept => { done = accept; });
  await c.page.route(`**/api/comparisons/${summary.id}`, async route => { const response = await route.fetch(); ready(); await gate; await route.fulfill({ response }).catch(() => {}); done(); });
  await c.page.locator(`[data-comparison-id="${summary.id}"]`).getByRole("button").click(); await captured;
  await c.page.locator('a[data-view="access"]').click(); release(); await finished; await frames(c.page);
  assert.equal(await c.page.locator("#review-dialog").isVisible(), false); assert.equal(await c.page.locator("#detail-content").textContent(), "");
}));

test("a committed comparison response after close cannot reopen detail or repeat the write", { timeout: 30000 }, async () => fixture(async c => {
  let release!: () => void, ready!: () => void, done!: () => void;
  const gate = new Promise<void>(accept => { release = accept; }), captured = new Promise<void>(accept => { ready = accept; }), finished = new Promise<void>(accept => { done = accept; }); let posts = 0;
  await c.page.route("**/api/comparisons", async route => { if (route.request().method() !== "POST") { await route.continue(); return; } posts++; const response = await route.fetch(); assert.equal(response.status(), 201); ready(); await gate; await route.fulfill({ response }).catch(() => {}); done(); });
  await select(c); await c.page.getByRole("button", { name: "Create comparison" }).click(); await captured;
  await c.page.getByRole("button", { name: "Close review detail" }).click(); release(); await finished; await c.refresh(); await c.page.locator(".comparison-record").waitFor(); await frames(c.page);
  assert.equal(posts, 1); assert.equal(c.server.store.recentComparisons().length, 1); assert.equal(await c.page.locator("#review-dialog").isVisible(), false); assert.equal(await c.page.locator("#detail-content").textContent(), "");
}));

test("selected unavailable parents close the form and mixed old catalogs cannot restore their rows", { timeout: 30000 }, async () => fixture(async c => {
  await saved(c); await select(c);
  let release!: () => void, ready!: () => void;
  const gate = new Promise<void>(accept => { release = accept; }), captured = new Promise<void>(accept => { ready = accept; });
  await c.page.route("**/api/comparisons", async route => { const response = await route.fetch(); ready(); await gate; await route.fulfill({ response }); });
  await c.page.route("**/api/workspace", async route => { await gate; const response = await route.fetch(); await route.fulfill({ response }); });
  await c.refresh(); await captured; c.server.store.saveJob({ ...c.server.store.job(c.candidateId)!, status: "failed" }); release();
  await c.page.locator("#review-dialog").waitFor({ state: "hidden" }); await c.page.locator(".comparison-record").waitFor({ state: "detached" }); assert.equal(await c.page.locator("#detail-content").textContent(), ""); assert.equal(await c.page.locator("#compare-reviews").isDisabled(), true);
}));

test("failed metadata refresh clears comparison detail, catalogs, and create control", { timeout: 30000 }, async () => fixture(async c => {
  const summary = await saved(c); await c.page.locator(`[data-comparison-id="${summary.id}"]`).getByRole("button").click(); await c.page.locator("#detail-title").filter({ hasText: "Saved controlled-review comparison" }).waitFor();
  await c.page.route("**/api/comparisons", route => route.abort("failed")); await c.refresh(); await c.page.locator("#review-dialog").waitFor({ state: "hidden" }); assert.equal(await c.page.locator("#detail-content").textContent(), ""); assert.equal(await c.page.locator(".comparison-record").count(), 0); assert.equal(await c.page.locator("#compare-reviews").isDisabled(), true);
}));
