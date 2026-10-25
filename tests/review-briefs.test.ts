import test from "node:test";
import assert from "node:assert/strict";
import { chmod, link, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";
import { WorkspaceStore } from "../src/workspace.ts";
import { sha256 } from "../src/evidence.ts";
import { createReviewBrief, previewReviewBrief, readReviewBrief, readReviewBriefInput, reviewBriefSummaries, validateReviewBriefInput } from "../src/review-briefs.ts";
import type { ReviewBriefInput } from "../src/review-briefs.ts";
const project = resolve(import.meta.dirname, ".."), execute = promisify(execFile);
const common = () => ({ schemaVersion: "1.0" as const, kind: "review_brief_input" as const, title: "Owned idea", decision: "Which assumption should we test before building?", audience: { users: "Independent shop operators", buyers: null, market: null, language: null }, assumptions: ["The operator has time to use a separate tool."], suppliedEvidence: [] as { label: string; description: string; reference: string | null }[], unknowns: ["Actual willingness to pay is unknown."] });
const idea = (): ReviewBriefInput => ({ ...common(), subjectType: "idea", idea: { problem: "Operators report repeating a task. This statement is unverified.", solution: "Proposed app to support that task.", alternatives: null, valueProposition: null, businessModel: null, distribution: null, differentiation: null } });
const app = (): ReviewBriefInput => ({ ...common(), title: "Owned app", subjectType: "app", app: { purpose: "Support an operator task.", journey: "Open signup, fill the form, submit.", expectedBehavior: "The expected confirmation appears.", url: null } });
async function fixture(work: (workspace: string, store: WorkspaceStore) => Promise<void>) { const workspace = await mkdtemp(resolve(tmpdir(), "redteam-brief-")), store = new WorkspaceStore(workspace); try { await work(workspace, store); } finally { store.close(); await rm(workspace, { recursive: true, force: true }); } }
const dbFor = (workspace: string) => new DatabaseSync(resolve(workspace, ".redteam/workspace.sqlite"));

test("idea/app previews preserve unknowns, identify separate missing inputs and do not infer a review or stakeholder decision", () => {
  const a = previewReviewBrief(idea()), b = previewReviewBrief(app()); assert.equal(a.subjectType, "idea"); assert.equal(b.subjectType, "app");
  assert(a.missingInputs.includes("idea.businessModel")); assert(!a.missingInputs.includes("app.url")); assert(b.missingInputs.includes("app.url")); assert(!b.missingInputs.some(key => key.startsWith("idea.")));
  assert.deepEqual(a.operatorUnknowns, idea().unknowns); assert.equal(a.status, "not_a_review"); assert.equal(a.suppliedEvidenceCount, 0); assert.equal(a.assumptionCount, 1); assert.equal(a.tracks.length, 6);
  assert(a.tracks.every(track => track.state === "not_started" && track.basis === "analytical_questions_only")); assert.equal(a.boundaries.toolCalls, 0); assert.equal(a.boundaries.modelCalls, 0); assert.equal(a.boundaries.stakeholderDecisions, false); assert.equal(a.boundaries.demandEstablished, false);
  assert.deepEqual(a, previewReviewBrief(idea())); assert.equal(Object.isFrozen(a.boundaries), true);
});
test("strict contract rejects other subjects, mixed fields, asserted outcomes, missing fields and unsafe URLs", () => {
  const input = idea(), ap = app(); for (const value of [null, [], { ...input, subjectType: "cv" }, { ...input, subjectType: "service" }, { ...input, subjectType: "website" }, { ...input, app: ap.subjectType === "app" ? ap.app : {} }, { ...input, schemaVersion: "2.0" }, { ...input, verdict: "validated" }, { ...input, investorDecision: "invest" }, { ...input, audience: { users: "all" } }, { ...input, title: " " }, { ...input, title: "bad\nheading" }, { ...input, decision: "bad\u001btext" }, { ...input, unknowns: [null] }, { ...input, suppliedEvidence: [{ label: "claim", description: "unverified", reference: null, verified: true }] }]) assert.throws(() => validateReviewBriefInput(value));
  for (const url of ["file:///private/secret", "javascript:alert(1)", "https://name:password@example.test", "./app", "data:text/html,test"]) assert.throws(() => validateReviewBriefInput({ ...ap, app: { ...(ap as Extract<ReviewBriefInput, {subjectType: "app"}>).app, url } }));
  const copy = structuredClone(input) as unknown as Record<string, unknown>; delete copy.unknowns; assert.throws(() => validateReviewBriefInput(copy));
});
test("descriptor parsing refuses nested getters, serializers, symbols, sparse/extra arrays and inherited objects without invoking them", () => {
  let called = 0; const poison = () => { called++; return "unexpected"; }, getter = { ...idea() }; Object.defineProperty(getter, "subjectType", { enumerable: true, get: poison });
  const nested = { ...idea(), audience: { ...idea().audience } }; Object.defineProperty(nested.audience, "market", { enumerable: true, get: poison });
  const list: unknown[] = ["one"]; Object.defineProperty(list, "0", { enumerable: true, get: poison });
  const extra = Object.assign(["one"], { other: "no" }); const symbol = ["one"]; Object.defineProperty(symbol, Symbol("private"), { value: true });
  for (const value of [getter, nested, { ...idea(), assumptions: list }, { ...idea(), assumptions: extra }, { ...idea(), assumptions: symbol }, { ...idea(), assumptions: Array(1) }, { ...idea(), toJSON: poison }, { ...idea(), [Symbol("private")]: true }, Object.assign(Object.create({ inherited: true }), idea())]) assert.throws(() => validateReviewBriefInput(value)); assert.equal(called, 0);
});
test("field, list and complete UTF-8 byte bounds reject excessive intake", () => {
  for (const value of [{ ...idea(), title: "x".repeat(201) }, { ...idea(), assumptions: Array(13).fill("assumption") }, { ...idea(), unknowns: ["x".repeat(501)] }, { ...idea(), suppliedEvidence: Array(11).fill({ label: "x", description: "x", reference: null }) }]) assert.throws(() => validateReviewBriefInput(value));
  const input = idea(); assert.equal(input.subjectType, "idea"); if (input.subjectType !== "idea") return;
  for (const key of ["problem", "solution", "alternatives", "valueProposition", "businessModel", "distribution", "differentiation"] as const) input.idea[key] = "界".repeat(2000);
  input.assumptions = Array(12).fill("界".repeat(500)); input.unknowns = Array(12).fill("界".repeat(500)); assert.throws(() => validateReviewBriefInput(input), /64 KiB/);
});
test("saved idea and app preserve exact supplied text/hash, private immutable bytes, and not-started provenance", async () => fixture(async (workspace, store) => {
  const input = idea(); input.title = '<img src=x onerror="alert(1)"> Owned idea'; input.decision = "Keep the first paragraph.\nKeep the second paragraph.";
  const a = await createReviewBrief(store, input), b = await createReviewBrief(store, app()), report = await readReviewBrief(store, a.id), bytes = await readFile(resolve(a.directory, "report.json"));
  assert.deepEqual(report.input, validateReviewBriefInput(input)); assert.equal(report.inputSha256, sha256(JSON.stringify(report.input))); assert.equal(a.reportSha256, sha256(bytes)); assert.equal(report.state, "intake_saved"); assert.equal(report.reviewStatus, "not_started"); assert.equal(report.provenance.input, "operator_supplied_unverified"); assert.equal(report.provenance.evidenceReferences, "supplied_unopened_unverified"); assert.equal(report.preview.status, "not_a_review"); assert.equal((await readReviewBrief(store, b.id)).input.subjectType, "app");
  assert.equal((await lstat(a.directory)).mode & 0o777, 0o700); assert.equal((await lstat(resolve(a.directory, "report.json"))).mode & 0o777, 0o600);
  assert.deepEqual(store.grants(), []); assert.deepEqual(store.jobs(), []); assert.deepEqual(store.actorRuns(), []); assert.equal(store.auditLog().filter(row => row.action === "review_brief_saved").length, 2);
  const list = reviewBriefSummaries(store); assert.equal(list.length, 2); assert.equal(list[0]!.recordStatus, "cataloged_unverified"); for (const marker of [workspace, "Operators report", "report.json", "Which assumption"]) assert(!JSON.stringify(list).includes(marker));
}));
test("URL/file references stay unopened and supplied claims cannot become observations", async () => fixture(async (workspace, store) => {
  let requests = 0; const server = createServer((_request, response) => { requests++; response.end("PRIVATE_REMOTE_CONTENT"); }); await new Promise<void>(accept => server.listen(0, "127.0.0.1", accept));
  try { const address = server.address(); assert(address && typeof address !== "string"); const input = app(); assert.equal(input.subjectType, "app"); if (input.subjectType !== "app") return; input.app.url = `http://127.0.0.1:${address.port}/app`; const source = resolve(workspace, "private.txt"); await writeFile(source, "PRIVATE_REFERENCE_BYTES"); await chmod(source, 0o600); input.suppliedEvidence = [{ label: "Operator claim", description: "A supplied claim, not an observation.", reference: source }]; const report = await readReviewBrief(store, (await createReviewBrief(store, input)).id); assert.equal(requests, 0); assert.equal(report.preview.suppliedEvidenceCount, 1); assert.equal(report.boundaries.referencesOpened, false); assert(!JSON.stringify(report).includes("PRIVATE_REFERENCE_BYTES")); assert(!JSON.stringify(report).includes("PRIVATE_REMOTE_CONTENT")); assert.equal(await readFile(source, "utf8"), "PRIVATE_REFERENCE_BYTES"); assert.deepEqual(store.grants(), []); assert.deepEqual(store.jobs(), []); }
  finally { await new Promise<void>((accept, reject) => server.close(error => error ? reject(error) : accept())); }
}));
test("changed saved bytes, rehashed false claims, catalog mismatch and unsupported policy deny checked reads", async () => fixture(async (workspace, store) => {
  const saved = await createReviewBrief(store, idea()), path = resolve(saved.directory, "report.json"), original = await readFile(path), db = dbFor(workspace);
  try {
    await writeFile(path, original.toString().replace("intake_saved", "review_complete")); await assert.rejects(readReviewBrief(store, saved.id)); await writeFile(path, original);
    for (const mutate of [(report: Record<string, unknown>) => { report.boundaries = { ...(report.boundaries as object), reviewExecuted: true }; }, (report: Record<string, unknown>) => { report.policyVersion = "unknown"; }, (report: Record<string, unknown>) => { (report.preview as { missingInputs: string[] }).missingInputs = []; }, (report: Record<string, unknown>) => { report.additionalPrivateField = "no"; }]) {
      const report = JSON.parse(original.toString()) as Record<string, unknown>; mutate(report); const bytes = Buffer.from(JSON.stringify(report, null, 2) + "\n"); await writeFile(path, bytes); db.prepare("UPDATE review_briefs SET document=? WHERE id=?").run(JSON.stringify({ ...saved, reportSha256: sha256(bytes) }), saved.id); await assert.rejects(readReviewBrief(store, saved.id));
    }
    await writeFile(path, original); db.prepare("UPDATE review_briefs SET document=? WHERE id=?").run(JSON.stringify({ ...saved, title: "Different title" }), saved.id); await assert.rejects(readReviewBrief(store, saved.id)); db.prepare("UPDATE review_briefs SET document=? WHERE id=?").run(JSON.stringify(saved), saved.id); assert.equal((await readReviewBrief(store, saved.id)).state, "intake_saved");
  } finally { db.close(); }
}));
test("checked reads refuse link substitutions, extra hard links, oversized bytes and an unsafe parent", async () => fixture(async (workspace, store) => {
  const saved = await createReviewBrief(store, idea()), path = resolve(saved.directory, "report.json"), backup = resolve(workspace, "report.backup.json"); await rename(path, backup); await symlink(backup, path); await assert.rejects(readReviewBrief(store, saved.id)); await unlink(path); await link(backup, path); await assert.rejects(readReviewBrief(store, saved.id)); await unlink(path); await rename(backup, path);
  const original = await readFile(path); await writeFile(path, "x".repeat(100001)); await assert.rejects(readReviewBrief(store, saved.id)); await writeFile(path, original);
  const moved = resolve(workspace, "moved-brief"); await rename(saved.directory, moved); await symlink(moved, saved.directory); await assert.rejects(readReviewBrief(store, saved.id)); await unlink(saved.directory); await rename(moved, saved.directory); assert.equal((await readReviewBrief(store, saved.id)).state, "intake_saved");
}));
test("unsafe output roots are rejected without modifying their target", async () => fixture(async (workspace, store) => {
  const elsewhere = resolve(workspace, "elsewhere"); await mkdir(elsewhere); await symlink(elsewhere, resolve(store.directory, "review-briefs")); await assert.rejects(createReviewBrief(store, idea())); assert.deepEqual(await readdir(elsewhere), []); assert.equal(store.recentReviewBriefs().length, 0); assert.equal(store.auditLog().filter(row => row.action === "review_brief_saved").length, 0);
}));
test("immutable catalog insertion and audit roll back on duplicate, failed or asynchronous checks", async () => fixture(async (_workspace, store) => {
  const saved = await createReviewBrief(store, idea()), before = store.auditLog(), bytes = await readFile(resolve(saved.directory, "report.json")); assert.throws(() => store.saveReviewBrief({ ...saved, title: "overwrite" }, () => undefined));
  const id = randomUUID(); assert.throws(() => store.saveReviewBrief({ ...saved, id }, () => { throw new Error("denied"); })); assert.throws(() => store.saveReviewBrief({ ...saved, id }, (() => Promise.resolve(undefined)) as unknown as () => undefined), /synchronously/); assert.equal(store.reviewBrief(id), null); assert.deepEqual(store.reviewBrief(saved.id), saved); assert.deepEqual(store.auditLog(), before); assert((await readFile(resolve(saved.directory, "report.json"))).equals(bytes));
}));
test("failed catalog insertion preserves the first private publication without adopting it", async () => fixture(async (workspace, store) => {
  const save = store.saveReviewBrief.bind(store); store.saveReviewBrief = () => { throw new Error("authored insertion failure"); }; await assert.rejects(createReviewBrief(store, idea()), /authored insertion/); store.saveReviewBrief = save;
  const root = resolve(workspace, ".redteam/review-briefs"), orphans = await readdir(root); assert.equal(orphans.length, 1); const path = resolve(root, orphans[0]!, "report.json"), bytes = await readFile(path); assert.equal(store.recentReviewBriefs().length, 0); assert.equal(store.auditLog().filter(row => row.action === "review_brief_saved").length, 0);
  const saved = await createReviewBrief(store, idea()); assert.notEqual(saved.id, orphans[0]); assert((await readFile(path)).equals(bytes)); assert.equal((await readdir(root)).length, 2); assert.equal(reviewBriefSummaries(store).length, 1); await assert.rejects(readReviewBrief(store, orphans[0]!));
}));
test("explicit input reader rejects unsafe, oversized and invalid UTF-8 JSON without opening embedded references", async () => {
  const workspace = await mkdtemp(resolve(tmpdir(), "redteam-brief-input-")); try { const file = resolve(workspace, "input.json"); await writeFile(file, JSON.stringify(idea())); assert.deepEqual(await readReviewBriefInput(file), validateReviewBriefInput(idea())); const alias = resolve(workspace, "alias.json"); await symlink(file, alias); await assert.rejects(readReviewBriefInput(alias)); await unlink(alias); await link(file, alias); await assert.rejects(readReviewBriefInput(file)); await unlink(alias); await writeFile(file, "x".repeat(65537)); await assert.rejects(readReviewBriefInput(file)); await writeFile(file, Buffer.from([0xff, 0xfe])); await assert.rejects(readReviewBriefInput(file), /UTF-8 JSON/); await writeFile(file, "{"); await assert.rejects(readReviewBriefInput(file), /UTF-8 JSON/); await assert.rejects(readReviewBriefInput(workspace)); } finally { await rm(workspace, { recursive: true, force: true }); }
});
test("terminal previews need no workspace; idea/app add/list/show work without starting tools and invalid commands preserve state", async () => {
  const workspace = await mkdtemp(resolve(tmpdir(), "redteam-brief-cli-")), file = resolve(workspace, "input.json"), run = async (args: string[]) => JSON.parse((await execute(process.execPath, [resolve(project, "src/cli.ts"), "briefs", ...args], { cwd: workspace })).stdout) as Record<string, unknown>;
  try { await writeFile(file, JSON.stringify(idea())); const before = await readdir(workspace); assert.equal((await run(["preview", file])).status, "not_a_review"); assert.deepEqual(await readdir(workspace), before); await assert.rejects(run(["preview", file, "unexpected"])); await assert.rejects(run(["add"])); assert.deepEqual(await readdir(workspace), before);
    const a = await run(["add", file]); await writeFile(file, JSON.stringify(app())); const b = await run(["add", file]); assert.equal(a.subjectType, "idea"); assert.equal(b.subjectType, "app"); const report = await run(["show", String(a.id)]); assert.equal(report.reviewStatus, "not_started"); assert.equal((report.input as ReviewBriefInput).subjectType, "idea"); assert.equal(((await run(["list"])).reviewBriefs as unknown[]).length, 2); const store = new WorkspaceStore(workspace); try { assert.deepEqual(store.jobs(), []); assert.deepEqual(store.actorRuns(), []); assert.deepEqual(store.grants(), []); } finally { store.close(); }
    await assert.rejects(run(["show", "../input.json"])); await writeFile(file, JSON.stringify({ ...idea(), subjectType: "cv" })); await assert.rejects(run(["add", file])); assert.equal(((await run(["list"])).reviewBriefs as unknown[]).length, 2);
  } finally { await rm(workspace, { recursive: true, force: true }); }
});
