import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {resolve} from "node:path";
import {existsSync, readFileSync, writeFileSync, chmodSync, lstatSync, renameSync, rmSync, truncateSync} from "node:fs";
import {WorkspaceStore} from "../src/workspace.ts";
import {diagnosticFixture as fixture, taskRows, authoredFiles} from "./helpers/context-diagnostic-fixture.ts";
import {runFixture} from "./helpers/context-analyst-fixture.ts";
const cli = process.env.REDTEAM_TEST_DIAGNOSTIC_CLI ?? resolve(import.meta.dirname, "../src/cli.ts");
function command(root: string) {
 const guard = resolve(root, "deny-diagnostic-network-and-keys.mjs");
 writeFileSync(guard, "import https from'node:https';import http from'node:http';import{syncBuiltinESMExports}from'node:module';const deny=()=>process.exit(97);https.request=deny;https.get=deny;http.request=deny;http.get=deny;globalThis.fetch=async()=>deny();syncBuiltinESMExports();process.env=new Proxy(process.env,{get(t,k){if(['OPENAI_API_KEY','REDTEAM_AUTHORED_DIAGNOSTIC_VALUE'].includes(k))process.exit(96);return Reflect.get(t,k);}});\n", {mode: 0o600});
 return (...args: string[]) => spawnSync(process.execPath, ["--import", guard, cli, ...args], {cwd: root, encoding: "utf8", maxBuffer: 2000000, timeout: 30000, env: {OPENAI_API_KEY: "AUTHORED_UNUSED_DIAGNOSTIC_KEY_NOT_REAL", REDTEAM_AUTHORED_DIAGNOSTIC_VALUE: "AUTHORED_UNUSED_VALUE_NOT_REAL"}});
}
function checked(r: ReturnType<typeof spawnSync>) {assert.equal(r.status, 0, String(r.stderr)); assert.equal(r.signal, null); assert(!String(r.stdout).includes("AUTHORED_PRIVATE")); return JSON.parse(String(r.stdout));}
function denied(r: ReturnType<typeof spawnSync>) {assert.equal(r.status, 1, String(r.stderr)); assert.equal(r.signal, null); assert.equal(String(r.stdout), ""); assert(!String(r.stderr).includes("PRIVATE_SECRET"));}

test("native terminal diagnoses one cold partial workspace using no key or network and preserves original rows/files", () => fixture(({root, state, run, id, tasks}) => {
 const files = authoredFiles(run); tasks.close(); const invoke = command(root), bytes = readFileSync(resolve(state, "tasks.sqlite")), before = taskRows(state), d = checked(invoke("context", "runs", "diagnose", id)); assert.equal(d.task.id, id); assert.equal(d.guidance.code, "report_file_present_unverified"); assert.equal(d.boundaries.reportValidity, "not_checked"); assert.equal(d.boundaries.sourceBodies, "not_read"); assert(!JSON.stringify(d).includes(root)); assert.deepEqual(taskRows(state), before); assert(readFileSync(resolve(state, "tasks.sqlite")).equals(bytes)); for (const f of files) assert(readFileSync(f.path).equals(f.bytes)); for (const name of ["workspace.sqlite", "budgets.sqlite"]) assert(!existsSync(resolve(state, name)));
}));
test("native malformed absent and extra diagnostic inputs return no partial output or private error text", () => fixture(({root, state, id}) => {
 const invoke = command(root), before = taskRows(state); for (const args of [["context", "runs", "diagnose"], ["context", "runs", "diagnose", "PRIVATE_SECRET"], ["context", "runs", "diagnose", id, "extra"], ["context", "runs", "diagnose", "00000000-0000-0000-0000-000000000000"]]) denied(invoke(...args)); assert.deepEqual(taskRows(state), before);
}));
test("native unavailable state public database and absent database never create or normalize records", () => fixture(({root, state, id}) => {
 const invoke = command(root), path = resolve(state, "tasks.sqlite"); chmodSync(path, 0o644); try {denied(invoke("context", "runs", "diagnose", id)); assert.equal(lstatSync(path).mode & 0o077, 0o044);} finally {chmodSync(path, 0o600);} renameSync(path, path + ".saved"); try {denied(invoke("context", "runs", "diagnose", id)); assert(!existsSync(path));} finally {renameSync(path + ".saved", path);} assert(!existsSync(resolve(state, "workspace.sqlite"))); assert(!existsSync(resolve(state, "budgets.sqlite")));
}));
test("native unsafe oversized and missing publication paths give metadata guidance and preserve their bytes/modes", () => fixture(({root, run, id}) => {
 const invoke = command(root), path = resolve(run, "report.json"); writeFileSync(path, "PRIVATE", {mode: 0o600}); chmodSync(path, 0o644); let d = checked(invoke("context", "runs", "diagnose", id)); assert.equal(d.guidance.code, "publication_paths_unavailable"); assert.equal(lstatSync(path).mode & 0o077, 0o044); chmodSync(path, 0o600); truncateSync(path, 128001); d = checked(invoke("context", "runs", "diagnose", id)); assert.equal(d.files[3].state, "oversized"); assert.equal(lstatSync(path).size, 128001); rmSync(run, {recursive: true}); d = checked(invoke("context", "runs", "diagnose", id)); assert.equal(d.runDirectory, "missing"); assert(!existsSync(run));
}));
test("native diagnostics preserve a live workspace owner and queued browser job without recovery", () => fixture(({root, state, id}) => {
 const store = new WorkspaceStore(root), invoke = command(root); store.acquireCoordinator("AUTHORED_DIAGNOSTIC_LIVE_OWNER"); const job = store.createJob("fixed"), bytes = readFileSync(resolve(state, "workspace.sqlite")), rows = taskRows(state); try {const d = checked(invoke("context", "runs", "diagnose", id)); assert.equal(d.boundaries.processOwnership, "not_checked"); assert.equal(store.job(job.id)!.status, "queued"); assert.deepEqual(taskRows(state), rows); assert(readFileSync(resolve(state, "workspace.sqlite")).equals(bytes)); assert.throws(() => store.acquireCoordinator("AUTHORED_MUST_REMAIN_BLOCKED"));} finally {store.releaseCoordinator("AUTHORED_DIAGNOSTIC_LIVE_OWNER"); store.close();}
}));
test("native idea/app saved reports stay unverified presence here and remain checked only by the existing show command", async () => {
 for (const subject of ["idea", "app"]) await runFixture(async (store, c, result) => {
  const root = resolve(store.directory, ".."), invoke = command(root), reportPath = resolve(store.directory, "context-analyst-runs", result.runId!, "report.json"), original = readFileSync(reportPath), before = taskRows(store.directory), d = checked(invoke("context", "runs", "diagnose", result.taskId!)); assert.equal(d.guidance.code, "report_file_present_unverified"); assert.equal(d.boundaries.sourceRights, "not_checked"); assert(!("report" in d)); const checkedReport = checked(invoke("context", "runs", "show", result.taskId!)); assert.equal(checkedReport.sha256, result.reportSha256); assert.deepEqual(checkedReport.report, result.report); assert.deepEqual(taskRows(store.directory), before); assert(readFileSync(reportPath).equals(original));
 }, subject);
});
