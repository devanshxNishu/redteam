import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { request } from "node:http";
import { createLocalServer } from "../src/server.ts";
import { grantAccess } from "../src/access.ts";
import { captureRepository } from "../src/repository.ts";
import { registerEngineeringObservations } from "../src/engineering.ts";
import { sha256 } from "../src/evidence.ts";
const assetsRoot = resolve(import.meta.dirname, "..");
async function fixture(work: (context: { server: Awaited<ReturnType<typeof createLocalServer>>; headers: Record<string, string>; snapshotId: string; notesId: string; grantId: string; snapshotDirectory: string; notesDirectory: string }) => Promise<void>): Promise<void> {
  const workspace = await mkdtemp(resolve(tmpdir(), "redteam-code-api-")), source = resolve(workspace, "app"); await mkdir(source);
  const bytes = "// COPIED_SOURCE_PRIVATE_MARKER\nexport {};\n"; await writeFile(resolve(source, "app.ts"), bytes);
  const server = await createLocalServer({ workspace, assetsRoot, port: 0 });
  try {
    const access = grantAccess(server.store, { name: "Owned fixture", target: source, kind: "directory", capabilities: ["code:read"] });
    const snapshot = await captureRepository(server.store, { grantId: access.id, target: source });
    const notes = await registerEngineeringObservations(server.store, { schemaVersion: "1.0", kind: "engineering_observation_input", snapshotRunId: snapshot.runId, requirements: [], observations: [{ id: "OBS-1", type: "source_observation", statement: "<img src=x onerror=alert(1)> OPERATOR_NOTE_MARKER", requirementId: null, citations: [{ sourcePath: "app.ts", fileSha256: sha256(bytes), startLine: 2, endLine: 2 }] }] });
    await work({ server, headers: { Authorization: `Bearer ${server.token}` }, snapshotId: snapshot.runId, notesId: notes.runId, grantId: access.id, snapshotDirectory: snapshot.directory, notesDirectory: notes.directory });
  } finally { await server.close(); await rm(workspace, { recursive: true, force: true }); }
}
const unavailable = { error: "Code record unavailable. Access or integrity checks failed.", code: "code_record_unavailable" };

test("code endpoints share session, origin, host, and no-store boundaries", async () => fixture(async ({ server, headers, snapshotId, notesId }) => {
  for (const path of ["/api/code-runs", `/api/code-runs/repositories/${snapshotId}`, `/api/code-runs/observations/${notesId}`]) {
    assert.equal((await fetch(server.origin + path)).status, 401);
    assert.equal((await fetch(server.origin + path, { headers: { ...headers, Origin: "https://foreign.test" } })).status, 403);
    const status = await new Promise<number | undefined>((accept, reject) => {
      const attempt = request(server.origin + path, { headers: { ...headers, Host: "forged.test" } }, response => { response.resume(); accept(response.statusCode); });
      attempt.on("error", reject); attempt.end();
    }); assert.equal(status, 421);
    const response = await fetch(server.origin + path, { headers }); assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store"); assert.match(response.headers.get("content-type")!, /application\/json/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  }
}));

test("code listing is a minimal authorized catalog, while details preserve all unreviewed labels", async () => fixture(async ({ server, headers, snapshotId, notesId }) => {
  const listing = await (await fetch(`${server.origin}/api/code-runs`, { headers })).text();
  assert(!listing.includes("OPERATOR_NOTE_MARKER")); assert(!listing.includes("COPIED_SOURCE_PRIVATE_MARKER")); assert(!listing.includes('"directory"')); assert(!listing.includes('"statement"'));
  const catalog = JSON.parse(listing); assert.equal(catalog.repositoryRuns.length, 1); assert.equal(catalog.engineeringRuns.length, 1);
  assert.equal(catalog.repositoryRuns[0].recordStatus, "cataloged_unverified"); assert.equal(catalog.engineeringRuns[0].recordStatus, "cataloged_unverified");
  const source = await (await fetch(`${server.origin}/api/code-runs/repositories/${snapshotId}`, { headers })).text(); assert(!source.includes("COPIED_SOURCE_PRIVATE_MARKER"));
  const response = await fetch(`${server.origin}/api/code-runs/observations/${notesId}`, { headers }), text = await response.text(), report = JSON.parse(text);
  assert(!text.includes("COPIED_SOURCE_PRIVATE_MARKER")); assert(text.includes("OPERATOR_NOTE_MARKER"));
  assert.equal(report.observations[0].expectationStatus, "unknown"); assert.equal(report.observations[0].semanticStatus, "unreviewed");
  assert.equal(report.observations[0].executionStatus, "not_executed"); assert.equal(report.observations[0].defectStatus, "not_assessed");
  assert.equal(report.boundaries.externalProcessing, false); assert.equal(report.boundaries.findingsApproved, false);
}));

test("changed snapshot bytes deny both dependent details without leaking private content or filesystem errors", async () => fixture(async ({ server, headers, snapshotId, notesId, snapshotDirectory }) => {
  const snapshot = JSON.parse(await readFile(resolve(snapshotDirectory, "report.json"), "utf8")); await writeFile(resolve(snapshotDirectory, snapshot.artifacts[0].path), "changed");
  for (const path of [`repositories/${snapshotId}`, `observations/${notesId}`, "repositories/00000000-0000-0000-0000-000000000000"]) {
    const response = await fetch(`${server.origin}/api/code-runs/${path}`, { headers }); assert.equal(response.status, 404); assert.deepEqual(await response.json(), unavailable);
  }
  const catalog = await (await fetch(`${server.origin}/api/code-runs`, { headers })).json() as { repositoryRuns: { recordStatus: string }[] };
  assert.equal(catalog.repositoryRuns[0]?.recordStatus, "cataloged_unverified");
}));

test("grant revocation hides catalogs and denies old links before reading missing files", async () => fixture(async ({ server, headers, snapshotId, notesId, grantId, notesDirectory }) => {
  assert.equal((await fetch(`${server.origin}/api/access/${grantId}/revoke`, { method: "POST", headers })).status, 200);
  await rm(resolve(notesDirectory, "report.json"));
  assert.deepEqual(await (await fetch(`${server.origin}/api/code-runs`, { headers })).json(), { repositoryRuns: [], engineeringRuns: [] });
  for (const path of [`repositories/${snapshotId}`, `observations/${notesId}`]) {
    const response = await fetch(`${server.origin}/api/code-runs/${path}`, { headers }); assert.equal(response.status, 404); assert.deepEqual(await response.json(), unavailable);
  }
}));

test("grant expiry also hides and denies both source record types", async context => fixture(async ({ server, headers, snapshotId, notesId, grantId }) => {
  context.mock.method(Date, "now", () => Date.parse(server.store.grant(grantId)!.expiresAt) + 1);
  assert.deepEqual(await (await fetch(`${server.origin}/api/code-runs`, { headers })).json(), { repositoryRuns: [], engineeringRuns: [] });
  for (const path of [`repositories/${snapshotId}`, `observations/${notesId}`]) assert.equal((await fetch(`${server.origin}/api/code-runs/${path}`, { headers })).status, 404);
}));

test("no source download, capture, or note registration action is enabled through inspection routes", async () => fixture(async ({ server, headers, snapshotId, notesId }) => {
  const before = server.store.auditLog();
  for (const path of ["/api/code-runs", `/api/code-runs/repositories/${snapshotId}`, `/api/code-runs/observations/${notesId}`]) assert.equal((await fetch(server.origin + path, { method: "POST", headers })).status, 404);
  assert.equal((await fetch(`${server.origin}/api/code-runs/repositories/${snapshotId}/artifacts/00000000-0000-0000-0000-000000000000`, { headers })).status, 404);
  assert.deepEqual(server.store.auditLog(), before);
}));
