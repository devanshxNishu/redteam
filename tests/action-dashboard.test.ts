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
import { sha256 } from "../src/evidence.ts";

async function fixture(work: (context: { page: import("playwright").Page; server: Awaited<ReturnType<typeof createLocalServer>>; notesId: string; grantId: string; refresh: () => Promise<unknown> }) => Promise<void>, hours = 24): Promise<void> {
  const workspace = await mkdtemp(resolve(tmpdir(), "redteam-action-ui-")), source = resolve(workspace, "app"); await mkdir(source);
  const bytes = "export {};\n"; await writeFile(resolve(source, "app.ts"), bytes);
  const server = await createLocalServer({ workspace, assetsRoot: resolve(import.meta.dirname, ".."), port: 0 });
  process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(import.meta.dirname, "../.cache/ms-playwright"); const { chromium } = await import("playwright");
  const browser = await chromium.launch(existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome") ? { channel: "chrome", headless: true } : { headless: true }).catch(async error => { await server.close(); await rm(workspace, { recursive: true, force: true }); throw error; });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message)); page.on("dialog", async dialog => { errors.push(dialog.message()); await dialog.dismiss(); });
  try {
    const access = grantAccess(server.store, { name: "Owned source", target: source, kind: "directory", capabilities: ["code:read"], expiresInHours: hours });
    const snapshot = await captureRepository(server.store, { grantId: access.id, target: source });
    const notes = await registerEngineeringObservations(server.store, { schemaVersion: "1.0", kind: "engineering_observation_input", snapshotRunId: snapshot.runId, requirements: [], observations: [{ id: "OBS-1", type: "source_observation", statement: "Owned unreviewed note", requirementId: null, citations: [{ sourcePath: "app.ts", fileSha256: sha256(bytes), startLine: 1, endLine: 1 }] }] });
    await page.goto(server.origin + "/#reviews"); await page.getByText("Local service connected", { exact: true }).waitFor();
    await work({ page, server, notesId: notes.runId, grantId: access.id, refresh: () => page.evaluate(() => window.dispatchEvent(new Event("focus"))) }); assert.deepEqual(errors, []);
  } finally { await page.close(); await browser.close(); await server.close(); await rm(workspace, { recursive: true, force: true }); }
}
async function start(page: import("playwright").Page, notesId: string) {
  await page.locator(`[data-code-run="${notesId}"]`).getByRole("button").click(); await page.getByRole("button", { name: "Plan a next step", exact: true }).click();
  await page.locator("#action-title").fill('<img src=x onerror="alert(1)"> ' + 'A'.repeat(140)); await page.locator("#action-owner").fill("Local owner label");
  await page.locator("#action-nextStep").fill("Clarify an approved requirement."); await page.locator("#action-validationMethod").fill("Perform a separate controlled check after approval.");
}
const frames = (page: import("playwright").Page) => page.evaluate(() => new Promise(accept => requestAnimationFrame(() => requestAnimationFrame(() => accept(null)))));

test("action UI creates from source, preserves declared completion, handles conflicts without draft overwrite, and clears revoked detail", { timeout: 30000 }, async () => fixture(async ({ page, server, notesId, grantId, refresh }) => {
  await start(page, notesId); await page.getByRole("button", { name: "Save proposed action" }).click(); await page.locator("#detail-title").filter({ hasText: "Tracked follow-up action" }).waitFor();
  assert.equal(await page.locator("#detail-content img").count(), 0); assert.match(await page.locator("#detail-content").textContent() ?? "", /Not independently verified/);
  const action = server.store.recentActions()[0]!; assert.equal(action.origin.runId, notesId);
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole("button", { name: "Edit declared action", exact: true }).click();
  assert(await page.locator("#review-dialog").evaluate(element => element.scrollWidth <= element.clientWidth));
  await page.locator("#action-status").selectOption("completed_declared"); await page.locator("#action-note").fill("Operator declaration, not an independent test."); await page.getByRole("button", { name: "Save declared update" }).click();
  await page.locator("#detail-title").filter({ hasText: "Tracked follow-up action" }).waitFor(); assert.equal(server.store.action(action.id)?.revision, 2); assert.equal(server.store.action(action.id)?.verificationStatus, "not_independently_verified"); assert(await page.locator("#review-dialog").evaluate(element => element.scrollWidth <= element.clientWidth));
  await page.getByRole("button", { name: "Edit declared action", exact: true }).click(); await page.locator("#action-title").fill("Unsaved local draft"); await page.locator("#action-note").fill("Keep this draft during a conflict.");
  const actionPath = `**/api/actions/${action.id}`;
  await page.route(actionPath, route => route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ code: "action_revision_changed", error: "The action changed during inspection. Read it again." }) }));
  await refresh(); await page.getByText(/The revision changed while checking/).waitFor(); assert.equal(await page.locator("#action-title").inputValue(), "Unsaved local draft");
  await page.unroute(actionPath);
  await updateTrackedAction(server.store, action.id, { schemaVersion: "1.0", kind: "action_update", expectedRevision: 2, status: "blocked", note: "A different operator updated the record." });
  await refresh(); await page.getByText("A newer revision is available. Read it before deliberately applying an update.", { exact: true }).waitFor(); assert.equal(await page.locator("#action-title").inputValue(), "Unsaved local draft");
  await page.getByRole("button", { name: "Save declared update" }).click(); await page.getByText(/This action changed. Read its latest revision/).waitFor(); assert.equal(await page.locator("#action-title").inputValue(), "Unsaved local draft"); assert.equal(server.store.action(action.id)?.revision, 3);
  await page.getByRole("button", { name: "Read latest action · discard this draft" }).click(); await page.locator("#detail-title").filter({ hasText: "Tracked follow-up action" }).waitFor(); await page.getByRole("button", { name: "Edit declared action", exact: true }).click();
  server.store.revokeGrant(grantId); await refresh(); await page.locator("#review-dialog").waitFor({ state: "hidden" }); assert.equal(await page.locator("#detail-content").textContent(), ""); assert.equal(await page.locator(".action-record").count(), 0);
}));

test("a saved response arriving after revocation cannot reopen an action or cause an automatic duplicate", { timeout: 30000 }, async () => fixture(async ({ page, server, notesId, grantId, refresh }) => {
  await start(page, notesId); let release!: () => void, ready!: () => void, done!: () => void;
  const gate = new Promise<void>(accept => { release = accept; }), saved = new Promise<void>(accept => { ready = accept; }), finished = new Promise<void>(accept => { done = accept; });
  await page.route("**/api/actions", async route => {
    if (route.request().method() !== "POST") { await route.continue(); return; }
    const response = await route.fetch(); assert.equal(response.status(), 201); ready(); await gate; await route.fulfill({ response }).catch(() => {}); done();
  });
  await page.getByRole("button", { name: "Save proposed action" }).click(); await saved; server.store.revokeGrant(grantId); await refresh(); await page.locator("#review-dialog").waitFor({ state: "hidden" });
  release(); await finished; await frames(page); assert.equal(await page.locator("#detail-content").textContent(), ""); assert.equal(await page.locator(".action-record").count(), 0); assert.equal(server.store.recentActions().length, 1);
}));

test("same-refresh mixed snapshots cannot display source or action metadata after workspace reports revocation", { timeout: 30000 }, async () => fixture(async ({ page, server, notesId, grantId, refresh }) => {
  const action = await createTrackedAction(server.store, { schemaVersion: "1.0", kind: "action_input", origin: { kind: "engineering_observation", runId: notesId, itemId: "OBS-1" }, title: "PRIVATE_MIXED_SNAPSHOT_TITLE", owner: "Owner", nextStep: "Clarify.", validationMethod: "Separate test." }); await refresh(); await page.locator(`[data-action-id="${action.id}"]`).waitFor();
  let release!: () => void, codeReady!: () => void, actionsReady!: () => void;
  const gate = new Promise<void>(accept => { release = accept; }), code = new Promise<void>(accept => { codeReady = accept; }), actions = new Promise<void>(accept => { actionsReady = accept; });
  await page.route("**/api/code-runs", async route => { const response = await route.fetch(); codeReady(); await gate; await route.fulfill({ response }); });
  await page.route("**/api/actions", async route => { const response = await route.fetch(); actionsReady(); await gate; await route.fulfill({ response }); });
  await page.route("**/api/workspace", async route => { await gate; const response = await route.fetch(); await route.fulfill({ response }); });
  await refresh(); await Promise.all([code, actions]); server.store.revokeGrant(grantId); release();
  await page.locator(".action-record").waitFor({ state: "detached" }); assert.equal(await page.locator(".code-record").count(), 0); assert(!(await page.locator("#action-run-list").textContent())?.includes("PRIVATE_MIXED_SNAPSHOT_TITLE"));
}));

test("known source expiry clears an unsaved plan form without waiting for the idle poll", { timeout: 15000 }, async () => fixture(async ({ page, notesId }) => {
  await start(page, notesId); await page.locator("#review-dialog").waitFor({ state: "hidden", timeout: 6000 }); assert.equal(await page.locator("#detail-content").textContent(), ""); assert.equal(await page.locator(".action-record").count(), 0);
}, 0.001));
