import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir, lstat, symlink } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { WorkspaceStore } from "../src/workspace.ts";
import { grantAccess } from "../src/access.ts";
import { captureRepository, readRepositorySnapshot, resolveRepositoryCitations } from "../src/repository.ts";
import { registerEngineeringObservations, readEngineeringReport, authorizedEngineeringRuns, validateEngineeringInput } from "../src/engineering.ts";
import type { EngineeringObservationInput } from "../src/engineering.ts";
import { sha256 } from "../src/evidence.ts";
const execute = promisify(execFile), cli = resolve("src/cli.ts");
async function fixture(work: (context: { store: WorkspaceStore; directory: string; source: string; input: EngineeringObservationInput; grantId: string; snapshotDirectory: string }) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-engineering-")), source = resolve(directory, "app"); await mkdir(source);
  const content = "export const enabled = false;\r\n// SOURCE_PRIVATE_MARKER\nexport {};";
  await writeFile(resolve(source, "app.ts"), content); await writeFile(resolve(source, "empty.ts"), ""); await writeFile(resolve(source, "large.ts"), "x".repeat(20_000));
  await writeFile(resolve(source, "bom.ts"), "\uFEFFconst title = 'नमस्ते 🌍';\n");
  const store = new WorkspaceStore(directory);
  try {
    const access = grantAccess(store, { name: "Owned source", target: source, kind: "directory", capabilities: ["code:read"] });
    const snapshot = await captureRepository(store, { grantId: access.id, target: source });
    const input: EngineeringObservationInput = { schemaVersion: "1.0", kind: "engineering_observation_input", snapshotRunId: snapshot.runId,
      requirements: [{ id: "REQ-1", statement: "The feature must be enabled for the approved pilot.", source: { kind: "operator_supplied", reference: "Owned fixture rule v1" } }],
      observations: [{ id: "OBS-1", type: "source_observation", statement: "The copied source declares an enabled value. Its runtime use is untested.", requirementId: "REQ-1", citations: [{ sourcePath: "app.ts", fileSha256: sha256(content), startLine: 1, endLine: 1 }] }] };
    await work({ store, directory, source, input, grantId: access.id, snapshotDirectory: snapshot.directory });
  } finally { store.close(); await rm(directory, { recursive: true, force: true }); }
}

test("source ranges preserve exact CRLF/LF and final-line bytes without inventing an EOF line", async () => fixture(async ({ store, input }) => {
  const ref = input.observations[0]!.citations[0]!;
  const resolved = await resolveRepositoryCitations(store, input.snapshotRunId, [ref, { ...ref, startLine: 2, endLine: 3 }]);
  assert.equal(resolved.citations[0]?.rangeSha256, sha256("export const enabled = false;\r\n"));
  assert.equal(resolved.citations[1]?.rangeSha256, sha256("// SOURCE_PRIVATE_MARKER\nexport {};"));
  const bom = "\uFEFFconst title = 'नमस्ते 🌍';\n";
  const unicode = await resolveRepositoryCitations(store, input.snapshotRunId, [{ sourcePath: "bom.ts", fileSha256: sha256(bom), startLine: 1, endLine: 1 }]);
  assert.equal(unicode.citations[0]?.rangeSha256, sha256(bom));
  assert.equal(unicode.citations[0]?.rangeBytes, Buffer.byteLength(bom));
  await assert.rejects(resolveRepositoryCitations(store, input.snapshotRunId, [{ ...ref, startLine: 4, endLine: 4 }]), /exceeds/);
}));

test("strict input rejects execution/verdict escalation, duplicates, missing requirements, and excess bounds", async () => fixture(async ({ input }) => {
  for (const change of [
    { ...input, findingsApproved: true },
    { ...input, observations: [{ ...input.observations[0], type: "reproduced_defect" }] },
    { ...input, observations: [{ ...input.observations[0], executionStatus: "passed" }] },
    { ...input, observations: [{ ...input.observations[0], requirementId: "UNKNOWN" }] },
    { ...input, observations: [input.observations[0], input.observations[0]] },
    { ...input, requirements: [input.requirements[0], input.requirements[0]] },
    { ...input, requirements: [{ ...input.requirements[0], source: { kind: "authenticated_standard", reference: "invented" } }] },
    { ...input, observations: [{ ...input.observations[0], citations: [] }] },
    { ...input, observations: Array.from({ length: 21 }, (_, index) => ({ ...input.observations[0], id: `OBS-${index}` })) },
    { ...input, observations: [{ ...input.observations[0], statement: "x".repeat(1001) }] },
    { ...input, observations: [{ ...input.observations[0], citations: [{ ...input.observations[0]!.citations[0], verdict: "confirmed" }] }] },
    { ...input, observations: Array.from({ length: 11 }, (_, index) => ({ ...input.observations[0], id: `OBS-${index}`, citations: Array(5).fill(input.observations[0]!.citations[0]) })) }
  ]) assert.throws(() => validateEngineeringInput(change));
  assert.throws(() => validateEngineeringInput({ huge: "x".repeat(65_537) }), /64 KiB/);
  const value = validateEngineeringInput(input); input.observations[0]!.statement = "later mutation";
  assert.notEqual(value.observations[0]?.statement, "later mutation");
}));

test("missing/stale source references, bad ranges, empty files, and oversized excerpts cannot be registered", async () => fixture(async ({ store, input }) => {
  const ref = input.observations[0]!.citations[0]!;
  const report = await readRepositorySnapshot(store, input.snapshotRunId);
  for (const citation of [
    { ...ref, sourcePath: "../outside.ts" }, { ...ref, fileSha256: "0".repeat(64) },
    { ...ref, startLine: 0 }, { ...ref, endLine: 101 }, { ...ref, startLine: 3, endLine: 2 }, { ...ref, endLine: 4 },
    { ...ref, sourcePath: "empty.ts", fileSha256: report.files.find(file => file.sourcePath === "empty.ts")!.sha256 },
    { ...ref, sourcePath: "large.ts", fileSha256: report.files.find(file => file.sourcePath === "large.ts")!.sha256 }
  ]) await assert.rejects(registerEngineeringObservations(store, { ...input, observations: [{ ...input.observations[0], citations: [citation] }] }));
  assert.equal(store.engineeringRuns().length, 0);
}));

test("accepted records pin supplied requirements and range hashes while all semantic and defect claims remain unreviewed", async () => fixture(async ({ store, input }) => {
  input.observations.push({ ...input.observations[0]!, id: "OBS-2", requirementId: null, statement: "Ask whether this declaration is used at runtime." });
  const summary = await registerEngineeringObservations(store, input), report = await readEngineeringReport(store, summary.runId);
  assert.equal(report.authorship, "operator_supplied"); assert.equal(report.outcome, "limited_coverage");
  assert.equal(report.observations[0]?.expectationStatus, "supplied_unverified"); assert.equal(report.observations[1]?.expectationStatus, "unknown");
  for (const observation of report.observations) {
    assert.equal(observation.citationCheck, "matched_saved_bytes"); assert.equal(observation.semanticStatus, "unreviewed");
    assert.equal(observation.executionStatus, "not_executed"); assert.equal(observation.defectStatus, "not_assessed");
  }
  assert.deepEqual(report.boundaries, { codeExecuted: false, testsExecuted: false, externalProcessing: false, findingsApproved: false });
  assert(!JSON.stringify(report).includes("SOURCE_PRIVATE_MARKER"));
  assert.deepEqual(JSON.parse(await readFile(resolve(summary.directory, report.artifacts[0]!.path), "utf8")), input);
  assert.equal(summary.snapshotReportSha256, store.repositoryRun(input.snapshotRunId)?.reportSha256);
  assert.equal(store.auditLog()[0]?.action, "engineering_observations_saved");
  assert.deepEqual(authorizedEngineeringRuns(store), [summary]);
  if (process.platform !== "win32") assert.equal((await lstat(resolve(summary.directory, "report.json"))).mode & 0o077, 0);
  assert.throws(() => store.saveEngineeringRun(summary), /UNIQUE/);
}));

test("changed source evidence denies both registration and existing observation inspection", async () => fixture(async ({ store, input, snapshotDirectory }) => {
  const summary = await registerEngineeringObservations(store, input), snapshot = await readRepositorySnapshot(store, input.snapshotRunId);
  const artifact = snapshot.artifacts.find(item => item.id === snapshot.files.find(file => file.sourcePath === "app.ts")?.artifactId)!;
  await writeFile(resolve(snapshotDirectory, artifact.path), "changed");
  await assert.rejects(registerEngineeringObservations(store, input), /evidence has changed/);
  await assert.rejects(readEngineeringReport(store, summary.runId), /evidence has changed/);
  assert.equal(store.engineeringRuns().length, 1);
}));

test("withdrawal denies inspection before report reads and hides all dependent observation metadata", async () => fixture(async ({ store, input, grantId }) => {
  const summary = await registerEngineeringObservations(store, input); store.revokeGrant(grantId);
  await rm(resolve(summary.directory, "report.json"));
  await assert.rejects(readEngineeringReport(store, summary.runId), /revoked/);
  await assert.rejects(registerEngineeringObservations(store, input), /revoked/);
  assert.deepEqual(authorizedEngineeringRuns(store), []);
}));

test("expired access denies dependent engineering listings and report inspection", async context => fixture(async ({ store, input, grantId }) => {
  const summary = await registerEngineeringObservations(store, input), access = store.grant(grantId)!;
  context.mock.method(Date, "now", () => Date.parse(access.expiresAt) + 1);
  assert.deepEqual(authorizedEngineeringRuns(store), []);
  await assert.rejects(readEngineeringReport(store, summary.runId), /expired/);
}));

test("revocation after writing input preserves private uncataloged bytes without approving the report", async () => fixture(async ({ store, input, grantId }) => {
  const original = store.grant.bind(store); let revoked = false;
  store.grant = id => {
    const output = resolve(store.directory, "engineering-runs");
    if (!revoked && existsSync(output) && readdirSync(output).some(run => {
      const artifacts = resolve(output, run, "artifacts"); return existsSync(artifacts) && readdirSync(artifacts).length > 0;
    })) { revoked = true; store.revokeGrant(grantId); }
    return original(id);
  };
  await assert.rejects(registerEngineeringObservations(store, input), /revoked/);
  assert.equal(store.engineeringRuns().length, 0);
  const [run] = await readdir(resolve(store.directory, "engineering-runs")); assert(run);
  const root = resolve(store.directory, "engineering-runs", run);
  assert.equal((await readdir(resolve(root, "artifacts"))).length, 1);
  await assert.rejects(lstat(resolve(root, "report.json")), /ENOENT/);
}));

test("changed report/input bytes and symbolic-link replacements cannot pass inspection", async () => fixture(async ({ store, input, directory }) => {
  const summary = await registerEngineeringObservations(store, input), report = await readEngineeringReport(store, summary.runId);
  const file = resolve(summary.directory, report.artifacts[0]!.path), bytes = await readFile(file);
  await writeFile(file, "altered"); await assert.rejects(readEngineeringReport(store, summary.runId), /input evidence has changed/);
  const outside = resolve(directory, "outside.json"); await writeFile(outside, bytes); await rm(file); await symlink(outside, file);
  await assert.rejects(readEngineeringReport(store, summary.runId), /file type/);
  await rm(file); await writeFile(file, bytes);
  const metadata = resolve(summary.directory, "report.json"), saved = await readFile(metadata);
  await writeFile(metadata, saved.toString().replace('not_assessed', 'approved'));
  await assert.rejects(readEngineeringReport(store, summary.runId), /metadata has changed/);
}));

test("a changed snapshot catalog pin and an unsafe output directory fail closed", async () => fixture(async ({ store, input, source }) => {
  const summary = await registerEngineeringObservations(store, input), original = store.repositoryRun.bind(store);
  store.repositoryRun = id => { const value = original(id); return value ? { ...value, reportSha256: "0".repeat(64) } : null; };
  await assert.rejects(readEngineeringReport(store, summary.runId), /snapshot pin/); assert.deepEqual(authorizedEngineeringRuns(store), []);
  store.repositoryRun = original;
  const output = resolve(store.directory, "engineering-runs"); await rm(output, { recursive: true }); await symlink(source, output);
  await assert.rejects(registerEngineeringObservations(store, input), /unsafe/);
  assert.equal(store.engineeringRuns().length, 1);
}));

test("CLI add/list/show preserves unreviewed labels, and command errors cannot promote supplied findings", async () => fixture(async ({ store, directory, input, grantId }) => {
  const file = resolve(directory, "notes.json"); await writeFile(file, JSON.stringify(input));
  const invoke = (...args: string[]) => execute(process.execPath, [cli, "code", "observations", ...args], { cwd: directory });
  const summary = JSON.parse((await invoke("add", file)).stdout), report = JSON.parse((await invoke("show", summary.runId)).stdout);
  assert.equal(report.observations[0].defectStatus, "not_assessed"); assert.equal(report.boundaries.testsExecuted, false);
  assert.equal(JSON.parse((await invoke("list")).stdout).length, 1);
  await assert.rejects(invoke("add", file, "extra"), error => (error as { code: number }).code === 1);
  store.revokeGrant(grantId); await assert.rejects(invoke("show", summary.runId), error => (error as { code: number }).code === 1);
}));
