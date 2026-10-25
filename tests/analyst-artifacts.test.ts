import test from "node:test";
import assert from "node:assert/strict";
import { chmod, link, mkdtemp, readFile, readdir, rename, rm, stat, symlink, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { WorkspaceStore } from "../src/workspace.ts";
import { createReviewBrief } from "../src/review-briefs.ts";
import { readAnalyticalPacket } from "../src/analytical-review.ts";
import { prepareAnalystRun } from "../src/analyst-config.ts";
import { saveAnalystManifest, readAnalystManifest, AnalystManifestError } from "../src/analyst-artifacts.ts";
import { TaskStore } from "../src/tasks.ts";
import { sha256 } from "../src/evidence.ts";

async function fixture(work: (context: { workspace: string; store: WorkspaceStore; briefDirectory: string; preparation: Awaited<ReturnType<typeof prepareAnalystRun>>; task: (manifestHash?: string, kind?: "analyst" | "actor") => TaskStore }) => Promise<void>) {
  const workspace = await mkdtemp(resolve(tmpdir(), "redteam-analyst-files-")), store = new WorkspaceStore(workspace), tasks: TaskStore[] = [];
  try {
    const brief = await createReviewBrief(store, JSON.parse(await readFile(resolve(import.meta.dirname, "../examples/idea-review-brief.input.json"), "utf8"))), packet = await readAnalyticalPacket(store, brief.id);
    const preparation = await prepareAnalystRun(store, brief.id, { schemaVersion: "1.0", kind: "analyst_configuration", provider: "openai", model: "authored-manifest-fixture", pricing: { inputUsdPerMillion: "1", outputUsdPerMillion: "1" }, processing: { mode: "external", provider: "openai", scope: "exact_brief_packet_and_generation", briefId: brief.id, packetSha256: packet.packetSha256, authorized: true, basis: "Authored storage declaration, no provider.", expiresAt: new Date(Date.now() + 600000).toISOString() }, limits: { maximumInputTokens: 1000, maximumOutputTokens: 100, count: { tokens: 1000, costMicrousd: 1000 }, generation: { tokens: 1100, costMicrousd: 1100 }, timeoutMs: 10000, finalizationMs: 1000 }, taskPolicy: { leaseMs: 2000, heartbeatMs: 200 } });
    const task = (manifestHash = preparation.manifestSha256, kind: "analyst" | "actor" = "analyst") => { const db = new TaskStore(workspace); tasks.push(db); const m = preparation.manifest; db.create({ id: m.taskId, runId: m.runId, kind, questionKey: m.questionKey, manifestHash, maximumAttempts: 1, deadlineAt: m.coordinatorDeadlineAt }); return db; };
    await work({ workspace, store, briefDirectory: brief.directory, preparation, task });
  } finally { tasks.forEach(db => db.close()); store.close(); await rm(workspace, { recursive: true, force: true }); }
}

test("saved manifest and generation are exact owner-only compact bytes, with no task/budget/result side effects", async () => fixture(async ({ store, preparation }) => {
  const before = store.auditLog(), saved = await saveAnalystManifest(store, preparation);
  const manifest = await readFile(resolve(saved.directory, "manifest.json")), generation = await readFile(resolve(saved.directory, "generation.json"));
  assert.equal(manifest.toString(), JSON.stringify(preparation.manifest)); assert.equal(generation.toString(), JSON.stringify(preparation.generation)); assert.equal(sha256(manifest), preparation.manifestSha256); assert.equal(sha256(generation), preparation.manifest.generationSha256);
  assert.equal((await stat(saved.directory)).mode & 0o777, 0o700); for (const name of ["manifest.json", "generation.json"]) assert.equal((await stat(resolve(saved.directory, name))).mode & 0o777, 0o600);
  assert.deepEqual(await readdir(saved.directory), ["generation.json", "manifest.json"]); assert.deepEqual(store.auditLog(), before); assert.deepEqual(store.jobs(), []); assert.deepEqual(store.actorRuns(), []); assert(!existsSync(resolve(store.directory, "tasks.sqlite"))); assert(!existsSync(resolve(store.directory, "budgets.sqlite")));
  await assert.rejects(readAnalystManifest(store, preparation.manifest.taskId), AnalystManifestError); assert(!existsSync(resolve(store.directory, "tasks.sqlite")));
}));

test("a durable matching analyst task permits checked historical reading without acquiring or changing ownership", async () => fixture(async ({ store, preparation, task }) => {
  const saved = await saveAnalystManifest(store, preparation), tasks = task(), before = tasks.task(preparation.manifest.taskId), events = tasks.events(before.spec.id);
  const record = await readAnalystManifest(store, before.spec.id); assert.equal(record.executionAuthority, "not_granted"); assert.equal(record.manifestSha256, saved.manifestSha256); assert.deepEqual(record.manifest, preparation.manifest); assert.deepEqual(record.generation, preparation.generation); assert(Object.isFrozen(record.generation.text.format.schema));
  assert.deepEqual(tasks.task(before.spec.id), before); assert.deepEqual(tasks.events(before.spec.id), events);
  const lease = tasks.claim(before.spec.id, "authored-owner", 1000); tasks.start(lease); await readAnalystManifest(store, before.spec.id); assert.equal(tasks.task(before.spec.id).state, "running");
}));

test("expired external processing and task deadlines do not turn a historical read into new execution permission", async t => fixture(async ({ store, preparation, task }) => {
  await saveAnalystManifest(store, preparation); const tasks = task();
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() + 700000 });
  const record = await readAnalystManifest(store, preparation.manifest.taskId); assert.equal(record.executionAuthority, "not_granted"); assert.equal(tasks.task(record.taskId).state, "queued"); assert.equal(tasks.task(record.taskId).attempt, 0);
  await assert.rejects(saveAnalystManifest(store, preparation), AnalystManifestError);
}));

test("a duplicate or concurrent writer never replaces a prior directory or adopts saved bytes", async () => fixture(async ({ store, preparation }) => {
  const outcomes = await Promise.allSettled([saveAnalystManifest(store, preparation), saveAnalystManifest(store, preparation)]);
  assert.equal(outcomes.filter(item => item.status === "fulfilled").length, 1); assert.equal(outcomes.filter(item => item.status === "rejected").length, 1);
  const saved = outcomes.find(item => item.status === "fulfilled")!.value, before = await readFile(resolve(saved.directory, "manifest.json"));
  await assert.rejects(saveAnalystManifest(store, preparation), AnalystManifestError); assert((await readFile(resolve(saved.directory, "manifest.json"))).equals(before));
}));

test("actor records and wrong durable manifest pins cannot authorize saved analyst data", async () => {
  for (const kind of ["actor", "wrong_hash"] as const) await fixture(async ({ store, preparation, task }) => {
    await saveAnalystManifest(store, preparation); task(kind === "wrong_hash" ? "a".repeat(64) : undefined, kind === "actor" ? "actor" : "analyst"); await assert.rejects(readAnalystManifest(store, preparation.manifest.taskId), AnalystManifestError);
  });
});

test("changed manifest/generation bytes, alternate JSON formatting and rehashed false declarations are denied", async () => {
  for (const name of ["manifest.json", "generation.json"]) await fixture(async ({ store, preparation, task }) => {
    const saved = await saveAnalystManifest(store, preparation); task(); const file = resolve(saved.directory, name), bytes = await readFile(file); await writeFile(file, bytes.toString() + "\n"); await assert.rejects(readAnalystManifest(store, preparation.manifest.taskId), AnalystManifestError); await writeFile(file, bytes); assert.equal((await readAnalystManifest(store, preparation.manifest.taskId)).runId, saved.runId);
  });
  await fixture(async ({ store, preparation, task }) => {
    const saved = await saveAnalystManifest(store, preparation), changed = { ...preparation.manifest, maximumAttempts: 2 }, bytes = Buffer.from(JSON.stringify(changed)); await writeFile(resolve(saved.directory, "manifest.json"), bytes); task(sha256(bytes)); await assert.rejects(readAnalystManifest(store, preparation.manifest.taskId), AnalystManifestError);
  });
});

test("saved reader rejects symlinks, extra links, public permissions, oversized bytes and unsafe parents", async () => {
  for (const boundary of ["symlink", "hardlink", "public", "oversize", "parent"]) await fixture(async ({ store, preparation, task }) => {
    const saved = await saveAnalystManifest(store, preparation); task(); const file = resolve(saved.directory, "manifest.json");
    if (boundary === "symlink") { await rename(file, file + ".saved"); await symlink(file + ".saved", file); }
    if (boundary === "hardlink") await link(file, file + ".alias");
    if (boundary === "public") await chmod(file, 0o644);
    if (boundary === "oversize") await writeFile(file, "x".repeat(16001));
    if (boundary === "parent") { const parent = resolve(store.directory, "analyst-runs"); await rename(parent, parent + "-saved"); await symlink(parent + "-saved", parent); }
    await assert.rejects(readAnalystManifest(store, preparation.manifest.taskId), AnalystManifestError);
  });
});

test("current source loss denies new storage before a directory and denies later reading until restored", async () => fixture(async ({ store, preparation, briefDirectory, task }) => {
  const source = resolve(briefDirectory, "report.json"), bytes = await readFile(source); await writeFile(source, "AUTHORED_SOURCE_CHANGE");
  await assert.rejects(saveAnalystManifest(store, preparation), AnalystManifestError); assert(!existsSync(resolve(store.directory, "analyst-runs")));
  await writeFile(source, bytes); await saveAnalystManifest(store, preparation); task(); await writeFile(source, "AUTHORED_SOURCE_CHANGE"); await assert.rejects(readAnalystManifest(store, preparation.manifest.taskId), AnalystManifestError); await writeFile(source, bytes); await readAnalystManifest(store, preparation.manifest.taskId);
}));

test("source denial after first publication leaves factual orphan bytes and blocks the next file without adoption", async t => fixture(async ({ store, preparation }) => {
  const directory = resolve(store.directory, "analyst-runs", preparation.manifest.runId), original = store.reviewBrief.bind(store);
  t.mock.method(store, "reviewBrief", (id: string) => existsSync(resolve(directory, "manifest.json")) ? null : original(id));
  await assert.rejects(saveAnalystManifest(store, preparation), AnalystManifestError); assert.deepEqual(await readdir(directory), ["manifest.json"]); assert.equal(sha256(await readFile(resolve(directory, "manifest.json"))), preparation.manifestSha256); assert(!existsSync(resolve(store.directory, "tasks.sqlite")));
  t.mock.restoreAll(); await assert.rejects(saveAnalystManifest(store, preparation), AnalystManifestError); assert.deepEqual(await readdir(directory), ["manifest.json"]);
}));

test("unsafe output roots and unsupported manifest fields cannot mutate external targets", async () => fixture(async ({ workspace, store, preparation }) => {
  const target = resolve(workspace, "external"); await import("node:fs/promises").then(fs => fs.mkdir(target)); await symlink(target, resolve(store.directory, "analyst-runs"));
  await assert.rejects(saveAnalystManifest(store, preparation), AnalystManifestError); assert.deepEqual(await readdir(target), []); await unlink(resolve(store.directory, "analyst-runs"));
  const invalid = { ...preparation, manifest: { ...preparation.manifest, tools: ["shell"] } }; await assert.rejects(saveAnalystManifest(store, invalid), AnalystManifestError); assert(!existsSync(resolve(store.directory, "analyst-runs")));
}));


test("caller mutation during source reads cannot redirect the validated run directory", async () => fixture(async ({ store, preparation }) => {
  const input = structuredClone(preparation), pending = saveAnalystManifest(store, input);
  input.manifest.runId = "../unexpected-run" as typeof input.manifest.runId; input.manifestSha256 = sha256(JSON.stringify(input.manifest));
  await assert.rejects(pending, AnalystManifestError); assert(!existsSync(resolve(store.directory, "unexpected-run"))); assert(!existsSync(resolve(store.directory, "analyst-runs")));
}));

test("unsafe task database or workspace permissions are denied before store opening can normalize them", async () => {
  for (const boundary of ["public_database", "hardlink", "symlink", "public_workspace"]) await fixture(async ({ store, preparation, task }) => {
    await saveAnalystManifest(store, preparation); task(); const database = resolve(store.directory, "tasks.sqlite");
    if (boundary === "public_database") await chmod(database, 0o644);
    if (boundary === "hardlink") await link(database, database + ".alias");
    if (boundary === "symlink") { await rename(database, database + ".saved"); await symlink(database + ".saved", database); }
    if (boundary === "public_workspace") await chmod(store.directory, 0o755);
    await assert.rejects(readAnalystManifest(store, preparation.manifest.taskId), AnalystManifestError);
    if (boundary === "public_database") assert.equal((await stat(database)).mode & 0o777, 0o644);
    if (boundary === "public_workspace") assert.equal((await stat(store.directory)).mode & 0o777, 0o755);
  });
});
