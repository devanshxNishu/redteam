import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { createLocalServer } from "../src/server.ts";
import { grantAccess } from "../src/access.ts";
import { captureRepository } from "../src/repository.ts";
import { registerEngineeringObservations } from "../src/engineering.ts";
import { createTrackedAction, updateTrackedAction } from "../src/actions.ts";
import { readExperimentPlan } from "../src/experiments.ts";
import { sha256 } from "../src/evidence.ts";

async function fixture(work: (context: { page: import("playwright").Page; server: Awaited<ReturnType<typeof createLocalServer>>; notesId: string; actionId: string; grantId: string; refresh: () => Promise<unknown> }) => Promise<void>, hours = 24): Promise<void> {
  const workspace = await mkdtemp(resolve(tmpdir(), "redteam-experiment-ui-")), source = resolve(workspace, "app"); await mkdir(source);
  const bytes = "export {};\n"; await writeFile(resolve(source, "app.ts"), bytes);
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
    await page.goto(server.origin + "/#reviews"); await page.getByText("Local service connected", { exact: true }).waitFor();
    await work({ page, server, notesId: notes.runId, actionId: action.id, grantId: access.id, refresh: () => page.evaluate(() => window.dispatchEvent(new Event("focus"))) }); assert.deepEqual(errors, []);
  } finally { await page.close(); await browser.close(); await server.close(); await rm(workspace, { recursive: true, force: true }); }
}

const frames = (page: import("playwright").Page) => page.evaluate(() => new Promise(accept => requestAnimationFrame(() => requestAnimationFrame(() => accept(null)))));
async function start(page: import("playwright").Page, actionId: string) {
  await page.locator(`[data-action-id="${actionId}"]`).getByRole("button").click(); await page.getByRole("button", { name: "Freeze an experiment plan", exact: true }).click();
}
async function fill(page: import("playwright").Page) {
  const values: Record<string, string> = { title: '<img src=x onerror="alert(1)"> ' + 'A'.repeat(140), hypothesis: "An owned future fixture change may meet the supplied requirement.", intervention: "A planned change, not performed by freezing.", measure: "A future controlled assertion", successRule: "Both fresh assertions pass.", collectionMethod: "Separate saved evidence, not collected here.", population: "Owned software fixture runs only", recruitment: "No participants are recruited.", targetCount: "2" };
  for (const [key, value] of Object.entries(values)) await page.locator(`#experiment-${key}`).fill(value);
  const starts = Math.floor((Date.now() + 3600000) / 1000) * 1000, ends = starts + 3600000;
  for (const [key, time] of [["startsAt", starts], ["endsAt", ends]] as const) {
    const local = await page.evaluate(time => { const value = new Date(time), pad = (n: number) => String(n).padStart(2, "0"); return `${value.getFullYear()}-${pad(value.getMonth()+1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}${value.getSeconds() ? ":" + pad(value.getSeconds()) : ""}`; }, time);
    await page.locator(`#experiment-${key}`).fill(local);
  }
  return { startsAt: new Date(starts).toISOString(), endsAt: new Date(ends).toISOString() };
}

test("experiment dashboard freezes exact supplied plans in local time, shows uncollected outcomes, and preserves historical actions on mobile", { timeout: 30000 }, async () => fixture(async ({ page, server, actionId, refresh }) => {
  assert.match(await page.locator("#experiment-plan-list").textContent() ?? "", /No permitted recent experiment plans/);
  await start(page, actionId); const window = await fill(page);
  await page.setViewportSize({ width: 390, height: 844 }); assert(await page.locator("#review-dialog").evaluate(element => element.scrollWidth <= element.clientWidth));
  await page.getByRole("button", { name: "Freeze supplied plan", exact: true }).click(); await page.locator("#detail-title").filter({ hasText: "Frozen experiment plan" }).waitFor();
  const summary = server.store.recentExperimentPlans()[0]!, report = await readExperimentPlan(server.store, summary.id); assert.deepEqual(report.plan.horizon, window); assert.equal(report.actionVersion.revision, 1); assert.equal(report.outcomeStatus, "not_collected"); assert.equal(server.store.jobs().length, 0); assert.equal(server.store.action(actionId)?.revision, 1); assert.equal(server.store.actionEvents(actionId).length, 1);
  assert.equal(await page.locator("#detail-content img").count(), 0); const text = await page.locator("#detail-content").textContent() ?? ""; assert(text.includes(report.plan.title)); assert(text.includes("Protocol review: not assessed")); assert(text.includes("Outcome: not collected")); assert(text.includes("Intended count: 2. This is not a participant or observation count.")); assert(text.includes("local clock only"));
  assert(await page.locator("#review-dialog").evaluate(element => element.scrollWidth <= element.clientWidth)); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await updateTrackedAction(server.store, actionId, { schemaVersion: "1.0", kind: "action_update", expectedRevision: 1, status: "completed_declared", note: "Operator declaration only." }); await refresh(); await frames(page); assert.match(await page.locator("#detail-content").textContent() ?? "", /revision 1/); assert.equal((await readExperimentPlan(server.store, summary.id)).outcomeStatus, "not_collected"); assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0]);
}));

test("revision conflicts preserve experiment drafts and require a deliberate fresh action read", { timeout: 30000 }, async () => fixture(async ({ page, server, actionId, refresh }) => {
  await start(page, actionId); await fill(page); const title = await page.locator("#experiment-title").inputValue();
  await updateTrackedAction(server.store, actionId, { schemaVersion: "1.0", kind: "action_update", expectedRevision: 1, status: "blocked", note: "Another operator updated the action." }); await refresh(); await page.getByText("A newer revision is available. Read it before deliberately applying an update.", { exact: true }).waitFor(); assert.equal(await page.locator("#experiment-title").inputValue(), title);
  await page.getByRole("button", { name: "Freeze supplied plan", exact: true }).click(); await page.getByText(/This action changed. Read its latest revision before deliberately freezing another plan/).waitFor(); assert.equal(await page.locator("#experiment-title").inputValue(), title); assert.equal(await page.locator("#experiment-title").isDisabled(), false); assert.equal(server.store.recentExperimentPlans().length, 0);
  await page.getByRole("button", { name: "Read latest action · discard this plan draft", exact: true }).click(); await page.getByRole("button", { name: "Freeze an experiment plan", exact: true }).click(); assert.equal(await page.locator("#experiment-title").inputValue(), ""); await fill(page); await page.getByRole("button", { name: "Freeze supplied plan", exact: true }).click(); await page.locator("#detail-title").filter({ hasText: "Frozen experiment plan" }).waitFor(); assert.equal(server.store.recentExperimentPlans()[0]?.actionVersion.revision, 2);
}));

test("current source revocation clears frozen plan detail and catalog without exposing supplied text", { timeout: 30000 }, async () => fixture(async ({ page, server, actionId, grantId, refresh }) => {
  await start(page, actionId); await fill(page); await page.getByRole("button", { name: "Freeze supplied plan", exact: true }).click(); await page.locator("#detail-title").filter({ hasText: "Frozen experiment plan" }).waitFor();
  server.store.revokeGrant(grantId); await refresh(); await page.locator("#review-dialog").waitFor({ state: "hidden" }); assert.equal(await page.locator("#detail-content").textContent(), ""); assert.equal(await page.locator(".experiment-record").count(), 0);
}));

test("a committed freeze response after revocation cannot reopen private detail or repeat a plan", { timeout: 30000 }, async () => fixture(async ({ page, server, actionId, grantId, refresh }) => {
  await start(page, actionId); await fill(page); let release!: () => void, ready!: () => void, done!: () => void; let posts = 0;
  const gate = new Promise<void>(accept => { release = accept; }), saved = new Promise<void>(accept => { ready = accept; }), finished = new Promise<void>(accept => { done = accept; });
  await page.route("**/api/experiments", async route => { if (route.request().method() !== "POST") { await route.continue(); return; } posts++; const response = await route.fetch(); assert.equal(response.status(), 201); ready(); await gate; await route.fulfill({ response }).catch(() => {}); done(); });
  await page.getByRole("button", { name: "Freeze supplied plan", exact: true }).click(); await saved; server.store.revokeGrant(grantId); await refresh(); await page.locator("#review-dialog").waitFor({ state: "hidden" }); release(); await finished; await frames(page); assert.equal(posts, 1); assert.equal(server.store.recentExperimentPlans().length, 1); assert.equal(await page.locator("#detail-content").textContent(), ""); assert.equal(await page.locator(".experiment-record").count(), 0);
}));

test("known expiry clears an unsaved experiment form without waiting for an idle poll", { timeout: 15000 }, async () => fixture(async ({ page, actionId }) => {
  await start(page, actionId); await fill(page); await page.locator("#review-dialog").waitFor({ state: "hidden", timeout: 6000 }); assert.equal(await page.locator("#detail-content").textContent(), "");
}, 0.001));

test("mixed old experiment metadata cannot display a plan after current workspace reports withdrawal", { timeout: 30000 }, async () => fixture(async ({ page, server, actionId, grantId, refresh }) => {
  await start(page, actionId); await fill(page); await page.getByRole("button", { name: "Freeze supplied plan", exact: true }).click(); await page.locator("#detail-title").filter({ hasText: "Frozen experiment plan" }).waitFor(); await page.getByRole("button", { name: "Close review detail" }).click();
  let release!: () => void, ready!: () => void; const gate = new Promise<void>(accept => { release = accept; }), captured = new Promise<void>(accept => { ready = accept; });
  await page.route("**/api/experiments", async route => { const response = await route.fetch(); ready(); await gate; await route.fulfill({ response }); }); await page.route("**/api/workspace", async route => { await gate; const response = await route.fetch(); await route.fulfill({ response }); });
  await refresh(); await captured; server.store.revokeGrant(grantId); release(); await page.locator(".experiment-record").waitFor({ state: "detached" }); assert.equal(await page.locator("#experiment-plan-list img").count(), 0);
}));

test("failed metadata refresh clears a private experiment draft", { timeout: 30000 }, async () => fixture(async ({ page, actionId, refresh }) => {
  await start(page, actionId); await fill(page); await page.route("**/api/experiments", route => route.abort("failed")); await refresh(); await page.locator("#review-dialog").waitFor({ state: "hidden" }); assert.equal(await page.locator("#detail-content").textContent(), ""); assert.equal(await page.locator(".experiment-record").count(), 0);
}));
