import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { WorkspaceStore } from "../src/workspace.ts";
import { grantAccess } from "../src/access.ts";
import { captureRepository } from "../src/repository.ts";
import { registerEngineeringObservations } from "../src/engineering.ts";
import { createTrackedAction, readTrackedAction, updateTrackedAction, authorizedActionSummaries, validateActionInput } from "../src/actions.ts";
import type { ActionInput } from "../src/domain/actions.ts";
import { sha256 } from "../src/evidence.ts";
import { runStudy } from "../src/runner.ts";
import { createLocalServer } from "../src/server.ts";
const execute = promisify(execFile), cli = resolve("src/cli.ts"), project = resolve(import.meta.dirname, "..");
async function fixture(work: (context: { directory: string; store: WorkspaceStore; input: ActionInput; grantId: string; snapshotDirectory: string }) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-actions-")), source = resolve(directory, "app"); await mkdir(source);
  const store = new WorkspaceStore(directory), text = "export {};\n"; await writeFile(resolve(source, "app.ts"), text);
  try {
    const access = grantAccess(store, { name: "Owned source", target: source, kind: "directory", capabilities: ["code:read"] });
    const snapshot = await captureRepository(store, { grantId: access.id, target: source });
    const notes = await registerEngineeringObservations(store, { schemaVersion: "1.0", kind: "engineering_observation_input", snapshotRunId: snapshot.runId, requirements: [], observations: [{ id: "OBS-1", type: "source_observation", statement: "Unreviewed source note", requirementId: null, citations: [{ sourcePath: "app.ts", fileSha256: sha256(text), startLine: 1, endLine: 1 }] }] });
    const input: ActionInput = { schemaVersion: "1.0", kind: "action_input", origin: { kind: "engineering_observation", runId: notes.runId, itemId: "OBS-1" }, title: "PRIVATE_ACTION_TITLE", owner: "Local pilot owner", nextStep: "Clarify the required behavior.", validationMethod: "Obtain an approved requirement, then run a separate controlled check." };
    await work({ directory, store, input, grantId: access.id, snapshotDirectory: snapshot.directory });
  } finally { store.close(); await rm(directory, { recursive: true, force: true }); }
}
const patch = (revision: number, status = "in_progress") => ({ schemaVersion: "1.0", kind: "action_update", expectedRevision: revision, status, note: "Operator-declared progress only." });

test("tracked plans pin source notes, preserve declared provenance, and append exact revisions", async () => fixture(async ({ store, input }) => {
  const created = await createTrackedAction(store, input); assert.equal(created.status, "proposed"); assert.equal(created.revision, 1);
  const updated = await updateTrackedAction(store, created.id, patch(1, "completed_declared"));
  assert.equal(updated.revision, 2); assert.equal(updated.status, "completed_declared"); assert.equal(updated.verificationStatus, "not_independently_verified"); assert.equal(updated.execution, "not_performed_by_tracking");
  const result = await readTrackedAction(store, created.id); assert.deepEqual(result.record, updated); assert.equal(result.events.length, 2); assert.deepEqual(result.events.map(event => event.revision), [1, 2]); assert.deepEqual(result.events[0]?.after, created);
  assert.equal(authorizedActionSummaries(store)[0]?.recordStatus, "cataloged_unverified"); assert.equal(store.auditLog()[0]?.action, "action_updated");
}));

test("input rejects authority, execution, source-pin and outcome escalation", async () => fixture(async ({ store, input }) => {
  for (const value of [{ ...input, status: "completed" }, { ...input, verificationStatus: "verified" }, { ...input, origin: { ...input.origin, access: null } }, { ...input, owner: "" }, { ...input, title: "x".repeat(201) }, { ...input, nextStep: "x".repeat(2001) }]) assert.throws(() => validateActionInput(value));
  const action = await createTrackedAction(store, input);
  for (const value of [{ ...patch(1), origin: input.origin }, { ...patch(1), verificationStatus: "verified" }, patch(1, "validated"), { ...patch(1), expectedRevision: 0 }, { ...patch(1), note: "" }, { schemaVersion: "1.0", kind: "action_update", expectedRevision: 1, note: "No changes" }]) await assert.rejects(updateTrackedAction(store, action.id, value));
  assert.equal(store.actionEvents(action.id).length, 1);
  assert.throws(() => store.saveAction({ ...action, revision: 2 }, 1, "Invalid async guard", (async () => undefined) as unknown as () => undefined), /synchronously/);
  assert.equal(store.actionEvents(action.id).length, 1);
}));

test("unknown origins and changed source evidence cannot create or advance a plan", async () => fixture(async ({ store, input, snapshotDirectory }) => {
  await assert.rejects(createTrackedAction(store, { ...input, origin: { ...input.origin, itemId: "missing" } }), /does not exist/);
  const action = await createTrackedAction(store, input), report = JSON.parse(await readFile(resolve(snapshotDirectory, "report.json"), "utf8"));
  await writeFile(resolve(snapshotDirectory, report.artifacts[0].path), "changed");
  await assert.rejects(readTrackedAction(store, action.id), /evidence has changed/); await assert.rejects(updateTrackedAction(store, action.id, patch(1)), /evidence has changed/);
  assert.equal(store.action(action.id)?.revision, 1); assert.equal(store.actionEvents(action.id).length, 1);
}));

test("revocation hides the entire plan and history and blocks changes", async () => fixture(async ({ store, input, grantId }) => {
  const action = await createTrackedAction(store, input); store.revokeGrant(grantId);
  assert.deepEqual(authorizedActionSummaries(store), []); await assert.rejects(readTrackedAction(store, action.id), /revoked/); await assert.rejects(updateTrackedAction(store, action.id, patch(1)), /revoked/);
  assert.equal(store.action(action.id)?.revision, 1);
}));

test("expiry also restricts dependent plans", async context => fixture(async ({ store, input, grantId }) => {
  const action = await createTrackedAction(store, input), expires = Date.parse(store.grant(grantId)!.expiresAt);
  context.mock.method(Date, "now", () => expires + 1); assert.deepEqual(authorizedActionSummaries(store), []); await assert.rejects(readTrackedAction(store, action.id), /expired/);
}));

test("permission is checked again inside the action write transaction", async () => fixture(async ({ store, input, grantId }) => {
  const action = await createTrackedAction(store, input), original = store.saveAction.bind(store);
  store.saveAction = (...args) => { store.revokeGrant(grantId); return original(...args); };
  await assert.rejects(updateTrackedAction(store, action.id, patch(1)), /revoked/);
  assert.equal(store.action(action.id)?.revision, 1); assert.equal(store.actionEvents(action.id).length, 1); assert(!store.auditLog().some(event => event.action === "action_updated"));
}));

test("competing terminal processes cannot overwrite the same expected revision", async () => fixture(async ({ store, directory, input }) => {
  const action = await createTrackedAction(store, input), file = resolve(directory, "update.json"); await writeFile(file, JSON.stringify(patch(1)));
  const outcomes = await Promise.allSettled([execute(process.execPath, [cli, "actions", "update", action.id, file], { cwd: directory }), execute(process.execPath, [cli, "actions", "update", action.id, file], { cwd: directory })]);
  assert.equal(outcomes.filter(item => item.status === "fulfilled").length, 1); assert.equal(store.action(action.id)?.revision, 2); assert.equal(store.actionEvents(action.id).length, 2);
  const shown = JSON.parse((await execute(process.execPath, [cli, "actions", "show", action.id], { cwd: directory })).stdout); assert.equal(shown.record.revision, 2); assert.equal(shown.events.length, 2);
}));

test("record/history disagreement is denied, and no-op updates create no revision", async () => fixture(async ({ store, directory, input }) => {
  const action = await createTrackedAction(store, input);
  await assert.rejects(updateTrackedAction(store, action.id, patch(1, "proposed")), /changes no tracked field/);
  const db = new DatabaseSync(resolve(directory, ".redteam/workspace.sqlite"));
  try { db.prepare("UPDATE actions SET document=? WHERE id=?").run(JSON.stringify({ ...action, title: "altered" }), action.id); } finally { db.close(); }
  await assert.rejects(readTrackedAction(store, action.id), /history is inconsistent/); assert.deepEqual(authorizedActionSummaries(store), []);
}));

test("a real fixture finding can seed a plan without tracking executing the app again", { timeout: 60000 }, async () => fixture(async ({ store, directory, input }) => {
  const study = JSON.parse(await readFile(resolve(project, "examples/pilot-signup.study.json"), "utf8"));
  const result = await runStudy(study, { projectRoot: project, outputRoot: resolve(directory, ".redteam/runs"), variant: "broken" }); assert.equal(result.report.findings[0]?.status, "reproduced");
  const report = result.report, reviewId = randomUUID(); store.saveJob({ id: reviewId, variant: "broken", status: "completed", createdAt: report.manifest.createdAt, updatedAt: report.generatedAt, reportDirectory: result.directory, findingCount: report.findings.length, artifactCount: report.artifacts.length, error: null });
  const action = await createTrackedAction(store, { ...input, origin: { kind: "browser_finding", runId: reviewId, itemId: report.findings[0]!.id } }); assert.equal(action.origin.sourceStatus, "reproduced"); assert.equal(action.origin.access, null); assert.equal(action.origin.evidenceRunId, report.runId); assert.notEqual(action.origin.runId, action.origin.evidenceRunId);
  assert.equal((await readTrackedAction(store, action.id)).record.execution, "not_performed_by_tracking");
  await writeFile(resolve(result.directory, report.artifacts[0]!.path), "changed"); await assert.rejects(readTrackedAction(store, action.id), /evidence has changed/);
}));

test("action API protects source permissions and never promotes declared completion", async () => fixture(async ({ store, directory, input, grantId }) => {
  const server = await createLocalServer({ workspace: directory, assetsRoot: project, port: 0 });
  try {
    assert.equal((await fetch(server.origin + "/api/actions")).status, 401);
    const headers = { Authorization: `Bearer ${server.token}`, "Content-Type": "application/json" };
    const created = await fetch(server.origin + "/api/actions", { method: "POST", headers, body: JSON.stringify(input) }); assert.equal(created.status, 201);
    const action = await created.json() as { id: string };
    const updated = await fetch(server.origin + `/api/actions/${action.id}`, { method: "PATCH", headers, body: JSON.stringify(patch(1, "completed_declared")) }); assert.equal(updated.status, 200); assert.equal((await updated.json() as { verificationStatus: string }).verificationStatus, "not_independently_verified");
    assert.equal((await fetch(server.origin + `/api/actions/${action.id}`, { method: "PATCH", headers, body: JSON.stringify(patch(1)) })).status, 409);
    store.revokeGrant(grantId);
    const list = await (await fetch(server.origin + "/api/actions", { headers })).text(); assert(!list.includes(input.title)); assert.deepEqual(JSON.parse(list).actions, []);
    const denied = await fetch(server.origin + `/api/actions/${action.id}`, { headers }); assert.equal(denied.status, 404); assert(!JSON.stringify(await denied.json()).includes(input.title));
  } finally { await server.close(); }
}));
