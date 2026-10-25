import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, readlink, rm, symlink, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { EvidenceStore, sha256 } from "../src/evidence.ts";
import { diagnoseActorPublication } from "../src/actor-diagnostics.ts";
import { TaskStore } from "../src/tasks.ts";
import { BudgetLedger } from "../src/budget.ts";
import { WorkspaceStore } from "../src/workspace.ts";

const marker = "PRIVATE_FIXTURE_CONTENT_MUST_NOT_BE_RETURNED";
async function temporary(work: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-diagnostic-"));
  try { await work(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
async function fixture(directory: string) {
  const runId = randomUUID(), evidence = await EvidenceStore.create(resolve(directory, ".redteam/actor-runs"), runId);
  const artifact = await evidence.addBytes(marker, Buffer.from(JSON.stringify({ privateFixture: marker })), "json", "application/json");
  const report = { schemaVersion: "1.0", kind: "model_actor_run", runId, generatedAt: new Date().toISOString(), outcome: "limited_coverage", note: marker,
    reports: [{ privateFixture: marker }], artifacts: evidence.artifacts, integrityErrors: [] as string[] };
  await evidence.writeRecord("report.json", report);
  return { runId, evidence, artifact, report, reportFile: resolve(evidence.root, "report.json") };
}
async function snapshot(root: string): Promise<unknown[]> {
  const result: unknown[] = [];
  async function visit(path: string, name: string) {
    const info = await lstat(path, { bigint: true });
    result.push({ name, mode: String(info.mode), mtime: String(info.mtimeNs), bytes: String(info.size),
      ...(info.isFile() ? { hash: sha256(await readFile(path)) } : info.isSymbolicLink() ? { link: await readlink(path) } : {}) });
    if (info.isDirectory()) for (const entry of (await readdir(path)).sort()) await visit(resolve(path, entry), `${name}/${entry}`);
  }
  await visit(root, "."); return result;
}

test("diagnostics check recorded hashes without returning report, source, or decision content", async () => temporary(async directory => {
  const { runId, reportFile } = await fixture(directory), before = await snapshot(directory);
  const result = await diagnoseActorPublication(directory, runId);
  assert.equal(result.readOnly, true); assert.equal(result.publication.state, "readable_record");
  assert.equal(result.publication.sha256, sha256(await readFile(reportFile))); assert.equal(result.artifacts.matching, 1);
  assert.deepEqual(result.issues, []); assert(!JSON.stringify(result).includes(marker));
  assert.deepEqual(await snapshot(directory), before);
}));

test("missing workspaces and run directories are reported without creating state or changing permissions", async () => temporary(async directory => {
  const runId = randomUUID(), before = await snapshot(directory);
  assert.equal((await diagnoseActorPublication(directory, runId)).issues[0]?.code, "workspace_state_missing");
  assert.deepEqual(await snapshot(directory), before);
  await mkdir(resolve(directory, ".redteam/actor-runs"), { recursive: true, mode: 0o750 }); await chmod(resolve(directory, ".redteam"), 0o750);
  const existing = await snapshot(directory);
  assert.equal((await diagnoseActorPublication(directory, runId)).issues[0]?.code, "run_directory_missing");
  assert.deepEqual(await snapshot(directory), existing);
  await assert.rejects(diagnoseActorPublication(directory, "../../private"), /UUID/);
}));

test("an absent publication suggests guarded recovery without creating or publishing anything", async () => temporary(async directory => {
  const { runId, reportFile } = await fixture(directory); await rm(reportFile); const before = await snapshot(directory);
  const result = await diagnoseActorPublication(directory, runId);
  assert.equal(result.publication.state, "missing"); assert(result.nextCommands.includes(`redteam tasks recover ${runId}`));
  assert.equal(result.artifacts.checked, 0); assert.deepEqual(await snapshot(directory), before);
}));

test("invalid legacy JSON is fingerprinted and preserved without printing parser error bodies", async () => temporary(async directory => {
  const { runId, reportFile } = await fixture(directory), bytes = Buffer.from(`{"private":"${marker}",`);
  await writeFile(reportFile, bytes); const before = await snapshot(directory);
  const result = await diagnoseActorPublication(directory, runId);
  assert.equal(result.publication.state, "invalid_json"); assert.equal(result.publication.sha256, sha256(bytes));
  assert.equal(result.issues[0]?.code, "publication_invalid_json"); assert(!result.nextCommands.some(command => command.includes("recover")));
  assert(!JSON.stringify(result).includes(marker)); assert.deepEqual(await snapshot(directory), before);
  await writeFile(reportFile, Buffer.from([0xff, 0xfe])); assert.equal((await diagnoseActorPublication(directory, runId)).publication.state, "invalid_json");
}));

test("unsupported report identities and hostile JSON field types produce bounded invalid-record diagnostics", async () => temporary(async directory => {
  const { runId, reportFile, report } = await fixture(directory);
  for (const changed of [null, [], { ...report, runId: randomUUID() }, { ...report, kind: { toString: null, valueOf: null } }, { ...report, artifacts: Array(21).fill(report.artifacts[0]) }]) {
    await writeFile(reportFile, JSON.stringify(changed));
    assert.equal((await diagnoseActorPublication(directory, runId)).publication.state, "invalid_record");
  }
}));

test("missing and changed artifacts remain distinct from an unreadable publication", async () => temporary(async directory => {
  const { runId, artifact, evidence } = await fixture(directory), path = resolve(evidence.root, artifact.path);
  await rm(path); let result = await diagnoseActorPublication(directory, runId);
  assert.equal(result.publication.state, "readable_record"); assert.equal(result.artifacts.results[0]?.state, "missing");
  await writeFile(path, "changed"); result = await diagnoseActorPublication(directory, runId);
  assert.equal(result.artifacts.results[0]?.state, "changed"); assert.equal(result.artifacts.matching, 0); assert(!JSON.stringify(result).includes(marker));
}));

test("duplicate and escaping artifact references are not followed or reflected", async () => temporary(async directory => {
  const { runId, reportFile, report, artifact } = await fixture(directory), outside = resolve(directory, "private.json");
  await writeFile(outside, marker);
  await writeFile(reportFile, JSON.stringify({ ...report, artifacts: [artifact, artifact, { ...artifact, id: randomUUID(), path: `../../${marker}`, owner: marker }] }));
  const before = await snapshot(directory), result = await diagnoseActorPublication(directory, runId);
  assert.deepEqual(result.artifacts.results.map(item => item.state), ["matching", "invalid", "invalid"]);
  assert(!JSON.stringify(result).includes(marker)); assert.deepEqual(await snapshot(directory), before);
}));

test("report and artifact symlinks are rejected without following their targets", async () => temporary(async directory => {
  const { runId, artifact, evidence, reportFile } = await fixture(directory), outside = resolve(directory, "private.json"), bytes = await readFile(reportFile);
  await writeFile(outside, bytes); await rm(reportFile); await symlink(outside, reportFile);
  assert.equal((await diagnoseActorPublication(directory, runId)).publication.state, "unsafe"); assert.deepEqual(await readFile(outside), bytes);
  await rm(reportFile); await writeFile(reportFile, bytes);
  const path = resolve(evidence.root, artifact.path); await rm(path); await symlink(outside, path);
  assert.equal((await diagnoseActorPublication(directory, runId)).artifacts.results[0]?.state, "unsafe"); assert.deepEqual(await readFile(outside), bytes);
}));

test("unsafe parent directories and nonregular report files never supply diagnostic content", async () => temporary(async directory => {
  const { runId, reportFile, evidence } = await fixture(directory);
  await rm(reportFile); await mkdir(reportFile);
  assert.equal((await diagnoseActorPublication(directory, runId)).publication.state, "unsafe");
  const before = await snapshot(directory); await rm(resolve(evidence.root, "artifacts"), { recursive: true }); await symlink(directory, resolve(evidence.root, "artifacts"));
  const unsafe = await snapshot(directory), result = await diagnoseActorPublication(directory, runId);
  assert(result.issues.some(issue => issue.code === "artifact_directory_unsafe")); assert.deepEqual(await snapshot(directory), unsafe); assert(before.length > 0);
}));

test("oversized files and staging inventories remain bounded and untouched", async () => temporary(async directory => {
  const { runId, reportFile, artifact, evidence } = await fixture(directory), original = await readFile(reportFile);
  await truncate(reportFile, 2_000_001); assert.equal((await diagnoseActorPublication(directory, runId)).publication.state, "too_large");
  await writeFile(reportFile, original); await truncate(resolve(evidence.root, artifact.path), 2_000_001);
  assert.equal((await diagnoseActorPublication(directory, runId)).artifacts.results[0]?.state, "too_large");
  await Promise.all(Array.from({ length: 101 }, (_, index) => writeFile(resolve(evidence.root, `.redteam-publish-${index}.pending`), marker)));
  const before = await snapshot(directory), result = await diagnoseActorPublication(directory, runId);
  assert.equal(result.staging.inventoryComplete, false); assert(result.staging.candidates <= 100); assert(result.issues.some(issue => issue.code === "inventory_incomplete"));
  assert.deepEqual(await snapshot(directory), before);
}));

test("diagnostics leave expired tasks, in-flight liability, and live SQLite WAL files unchanged", async () => temporary(async directory => {
  const earlier = Date.now() - 2000, tasks = new TaskStore(directory, () => earlier), budgets = new BudgetLedger(directory), catalog = new WorkspaceStore(directory);
  try {
    const { runId, artifact } = await fixture(directory), taskId = randomUUID();
    tasks.create({ id: taskId, runId, kind: "actor", questionKey: marker, manifestHash: artifact.sha256, maximumAttempts: 1, deadlineAt: new Date(earlier + 1000).toISOString() });
    const lease = tasks.claim(taskId, "fixture", 100); tasks.start(lease); tasks.recordDispatchIntent(lease, "fixture-invocation");
    budgets.createRun({ runId, cap: { tokens: 100, costMicrousd: 100 }, verificationReserve: { tokens: 0, costMicrousd: 0 }, reportReserve: { tokens: 0, costMicrousd: 0 }, deadlineAt: new Date(Date.now() + 60000).toISOString() });
    budgets.reserve({ id: "fixture-invocation", runId, taskRef: taskId, pool: "investigation", pricingRef: "fixture", maximum: { tokens: 100, costMicrousd: 100 } }); budgets.dispatch("fixture-invocation");
    const taskBefore = tasks.task(taskId), budgetBefore = budgets.snapshot(runId), before = await snapshot(directory);
    const result = await diagnoseActorPublication(directory, runId); assert(!JSON.stringify(result).includes(marker));
    assert.deepEqual(await snapshot(directory), before);
    assert.deepEqual(tasks.task(taskId), taskBefore); assert.deepEqual(budgets.snapshot(runId), budgetBefore);
    assert.equal(tasks.task(taskId).state, "running"); assert.equal(budgets.snapshot(runId).invocations[0]?.state, "in_flight");
  } finally { tasks.close(); budgets.close(); catalog.close(); }
}));

test("staging candidates are counted without promoting, parsing, or deleting their private bytes", async () => temporary(async directory => {
  const { runId, evidence } = await fixture(directory);
  await writeFile(resolve(evidence.root, `.redteam-publish-${randomUUID()}.pending`), `{"private":"${marker}`);
  await writeFile(resolve(evidence.root, "artifacts", `.redteam-publish-${randomUUID()}.pending`), marker);
  const before = await snapshot(directory), result = await diagnoseActorPublication(directory, runId);
  assert.equal(result.publication.state, "readable_record"); assert.equal(result.artifacts.matching, 1);
  assert.deepEqual(result.staging, { candidates: 2, inventoryComplete: true }); assert(result.issues.some(issue => issue.code === "staging_candidates_present"));
  assert(!JSON.stringify(result).includes(marker)); assert.deepEqual(await snapshot(directory), before);
}));

test("the terminal diagnostic creates no state in a new workspace and keeps invalid bytes private", async () => temporary(async directory => {
  const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url)), runId = randomUUID();
  let child = spawnSync(process.execPath, [cli, "actors", "diagnose", runId], { cwd: directory, encoding: "utf8" });
  assert.equal(child.status, 1, child.stderr); assert.equal(JSON.parse(child.stdout).issues[0].code, "workspace_state_missing"); assert.deepEqual(await readdir(directory), []);
  const context = await fixture(directory);
  child = spawnSync(process.execPath, [cli, "actors", "diagnose", context.runId], { cwd: directory, encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr); assert(!child.stdout.includes(marker));
  await writeFile(context.reportFile, `{"private":"${marker}`); const before = await snapshot(directory);
  child = spawnSync(process.execPath, [cli, "actors", "diagnose", context.runId], { cwd: directory, encoding: "utf8" });
  assert.equal(child.status, 1, child.stderr); assert.equal(JSON.parse(child.stdout).publication.state, "invalid_json"); assert(!child.stdout.includes(marker));
  assert.deepEqual(await snapshot(directory), before);
}));
