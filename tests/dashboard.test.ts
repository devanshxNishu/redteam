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
import { sha256 } from "../src/evidence.ts";

test("dashboard code inspection clears private detail on expiry, revocation, stale responses, integrity and network failures", { timeout: 60000 }, async () => {
  const workspace = await mkdtemp(resolve(tmpdir(), "redteam-dashboard-")), source = resolve(workspace, "app"); await mkdir(source);
  const text = "// COPIED_SOURCE_PRIVATE_MARKER\nexport {};\n", note = '<img src=x onerror="alert(1)"> Unreviewed supplied note';
  await writeFile(resolve(source, "app.ts"), text);
  const server = await createLocalServer({ workspace, assetsRoot: resolve(import.meta.dirname, ".."), port: 0 });
  process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(import.meta.dirname, "../.cache/ms-playwright");
  const { chromium } = await import("playwright");
  const browser = await chromium.launch(existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome") ? { channel: "chrome", headless: true } : { headless: true }).catch(async error => { await server.close(); await rm(workspace, { recursive: true, force: true }); throw error; });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message)); page.on("dialog", async dialog => { errors.push(dialog.message()); await dialog.dismiss(); });
  const create = async (hours = 24) => {
    const access = grantAccess(server.store, { name: "Owned source", target: source, kind: "directory", capabilities: ["code:read"], expiresInHours: hours });
    const snapshot = await captureRepository(server.store, { grantId: access.id, target: source });
    const notes = await registerEngineeringObservations(server.store, { schemaVersion: "1.0", kind: "engineering_observation_input", snapshotRunId: snapshot.runId, requirements: [{ id: "REQ-1", statement: "Owned supplied requirement", source: { kind: "operator_supplied", reference: "Fixture rule" } }], observations: [{ id: "OBS-1", type: "source_observation", statement: note, requirementId: null, citations: [{ sourcePath: "app.ts", fileSha256: sha256(text), startLine: 2, endLine: 2 }] }] });
    return { access, snapshot, notes };
  };
  const refresh = () => page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const visible = (id: string) => page.locator(`[data-code-run="${id}"]`);
  const closed = async () => { await page.locator("#review-dialog").waitFor({ state: "hidden" }); assert.equal(await page.locator("#detail-content").textContent(), ""); };
  try {
    await page.goto(server.origin + "/#reviews"); await page.getByText("Local service connected", { exact: true }).waitFor();
    assert.match(await page.locator("#repository-run-list").textContent() ?? "", /No permitted records/);
    const first = await create(); await refresh(); await visible(first.notes.runId).waitFor();
    await visible(first.notes.runId).getByRole("button").click(); await page.getByRole("heading", { name: "Engineering source notes", exact: true }).waitFor();
    await page.locator("#detail-content").getByText(note, { exact: true }).waitFor();
    assert.equal(await page.locator("#detail-content img").count(), 0); assert(!(await page.locator("#detail-content").textContent())?.includes("COPIED_SOURCE_PRIVATE_MARKER"));
    assert.match(await page.locator("#detail-content").textContent() ?? "", /Expectation: unknown/);
    assert.match(await page.locator("#detail-content").textContent() ?? "", /Semantic review: unreviewed. Execution: not executed. Defect: not assessed/);
    await page.setViewportSize({ width: 390, height: 844 }); assert(await page.locator("#review-dialog").evaluate(element => element.scrollWidth <= element.clientWidth)); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole("button", { name: "Close review detail" }).click(); await closed();
    await visible(first.snapshot.runId).getByRole("button").click(); await page.getByRole("heading", { name: "Local repository snapshot", exact: true }).waitFor();
    assert.match(await page.locator("#detail-content").textContent() ?? "", /Captured files and hashes/);
    await page.getByRole("button", { name: "Close review detail" }).click();
    await visible(first.notes.runId).getByRole("button").click(); await page.locator("#review-dialog").waitFor();
    const raw = JSON.parse(await readFile(resolve(first.snapshot.directory, "report.json"), "utf8")), artifact = resolve(first.snapshot.directory, raw.artifacts[0].path), original = await readFile(artifact);
    await writeFile(artifact, "changed"); await refresh(); await closed(); await writeFile(artifact, original); await refresh();
    await visible(first.notes.runId).getByRole("button").click(); await page.locator("#review-dialog").waitFor();
    await page.route("**/api/code-runs", route => route.abort("failed")); await refresh(); await closed(); assert.equal(await page.locator(".code-record").count(), 0);
    await page.unroute("**/api/code-runs"); await refresh(); await visible(first.notes.runId).waitFor();
    // A delayed successful detail must not reopen after a newer permission refresh.
    let release!: () => void, fetched!: () => void;
    const gate = new Promise<void>(accept => { release = accept; }), received = new Promise<void>(accept => { fetched = accept; });
    const path = `**/api/code-runs/observations/${first.notes.runId}`;
    await page.route(path, async route => { const response = await route.fetch(); fetched(); await gate; await route.fulfill({ response }).catch(() => {}); });
    await visible(first.notes.runId).getByRole("button").click(); await received;
    server.store.revokeGrant(first.access.id); await refresh(); await visible(first.notes.runId).waitFor({ state: "detached" }); release();
    await page.unroute(path); await closed(); assert.equal(await page.locator("#review-dialog").evaluate(element => (element as HTMLDialogElement).open), false);
    // Known expiry closes locally, without waiting for an idle ten-second poll.
    const expiring = await create(0.001); await refresh(); await visible(expiring.notes.runId).waitFor();
    await visible(expiring.notes.runId).getByRole("button").click(); await page.locator("#review-dialog").waitFor();
    await page.locator("#review-dialog").waitFor({ state: "hidden", timeout: 6000 }); await closed();
    // A pending initial request cannot reopen after navigation either.
    const last = await create(); await refresh(); await visible(last.notes.runId).waitFor();
    let unblock!: () => void, ready!: () => void;
    const delayed = new Promise<void>(accept => { unblock = accept; }), captured = new Promise<void>(accept => { ready = accept; });
    const routePath = `**/api/code-runs/observations/${last.notes.runId}`;
    await page.route(routePath, async route => { const response = await route.fetch(); ready(); await delayed; await route.fulfill({ response }).catch(() => {}); });
    await visible(last.notes.runId).getByRole("button").click(); await captured;
    await page.locator('a[data-view="overview"]').click(); unblock(); await page.unroute(routePath); await closed();
    // A visible report is also cleared after a real external revocation.
    await page.locator('a[data-view="reviews"]').click(); await refresh();
    await visible(last.notes.runId).waitFor(); await visible(last.notes.runId).getByRole("button").click(); await page.locator("#review-dialog").waitFor();
    server.store.revokeGrant(last.access.id); await refresh(); await closed(); await visible(last.notes.runId).waitFor({ state: "detached" });
    // Older successful catalogs cannot overwrite newer revoked metadata.
    const stale = await create(); await refresh(); await visible(stale.notes.runId).waitFor();
    let releaseCatalog!: () => void, catalogReady!: () => void, catalogDone!: () => void;
    const catalogGate = new Promise<void>(accept => { releaseCatalog = accept; }), oldCatalog = new Promise<void>(accept => { catalogReady = accept; }), finished = new Promise<void>(accept => { catalogDone = accept; });
    let intercepted = false;
    await page.route("**/api/code-runs", async route => {
      if (intercepted) { await route.continue(); return; }
      intercepted = true; const response = await route.fetch(); catalogReady(); await catalogGate;
      await route.fulfill({ response }).catch(() => {}); catalogDone();
    });
    await refresh(); await oldCatalog; server.store.revokeGrant(stale.access.id); await refresh();
    await visible(stale.notes.runId).waitFor({ state: "detached" }); releaseCatalog(); await finished;
    await page.evaluate(() => new Promise(accept => requestAnimationFrame(() => requestAnimationFrame(() => accept(null)))));
    assert.equal(await page.locator(".code-record").count(), 0); await page.unroute("**/api/code-runs");
    assert.deepEqual(errors, []);
  } finally { await page.close(); await browser.close(); await server.close(); await rm(workspace, { recursive: true, force: true }); }
});
