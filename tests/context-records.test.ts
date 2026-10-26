import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, stat, chmod, rename, symlink, link } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { WorkspaceStore } from "../src/workspace.ts";
import { createReviewBrief } from "../src/review-briefs.ts";
import { readAnalyticalPacket } from "../src/analytical-review.ts";
import { sha256 } from "../src/evidence.ts";
import { parseGlobalContextInput } from "../src/global-context.ts";
import { ContextDataError, ContextStateConflict, existingContextWorkspace } from "../src/context-data.ts";
import { importContextSource, readContextSource, withdrawContextSource, contextSourceSummaries, readContextImportFiles } from "../src/context-sources.ts";
import type { ContextSourceImport, ContextSourceCatalog } from "../src/context-sources.ts";
import { createContextSnapshot, readContextSnapshot, previewContextSnapshot, contextSnapshotSummaries } from "../src/context-snapshots.ts";
import type { ContextSnapshotInput, ContextSnapshotSummary } from "../src/context-snapshots.ts";

const authored = Buffer.from('\ufeffAuthored local context fixture. No actual news or publisher verified.\r\n\tExact bytes stay intact.\n');
function input(content = authored, id = "source-1"): ContextSourceImport {
  const now = Date.now(); return { schemaVersion: "1.0", kind: "context_source_import_input", metadata: { id, originId: "declared-origin-1", kind: "news", publisher: "Authored fixture publisher", title: "Authored local text, not collected news", url: "https://example.invalid/unopened-source", publishedAt: new Date(now - 3600000).toISOString(), updatedAt: null, eventAt: null, retrievedAt: new Date(now - 1000).toISOString(), status: "available", inspection: "declared_inspected", contentSha256: sha256(content), regions: ["in"], language: "en", topics: ["software"], applicabilityBasis: "Authored applicability declaration only." }, observationPeriod: null, permissions: { localReview: true, basis: "Authored local-only permission declaration for software checks.", expiresAt: new Date(now + 600000).toISOString(), externalProcessing: false, redistribution: false, training: false }, supersedes: null };
}
async function fixture(work: (context: { workspace: string; store: WorkspaceStore; snapshotInput: (sources: ContextSourceCatalog[]) => Promise<ContextSnapshotInput> }) => Promise<void>) {
  const workspace = await mkdtemp(resolve(tmpdir(), "redteam-context-records-")), store = new WorkspaceStore(workspace); let briefId: string | undefined;
  try {
    const snapshotInput = async (sources: ContextSourceCatalog[]): Promise<ContextSnapshotInput> => {
      briefId ??= (await createReviewBrief(store, JSON.parse(await readFile(resolve(import.meta.dirname, "../examples/idea-review-brief.input.json"), "utf8")))).id;
      const records = []; for (const source of sources) records.push(await readContextSource(store, source.id));
      const template = JSON.parse(await readFile(resolve(import.meta.dirname, "../examples/global-context.input.json"), "utf8")); template.scope.asOf = new Date().toISOString(); template.sources = records.map(record => record.source.input.metadata);
      return { schemaVersion: "1.0", kind: "context_snapshot_input", briefId, selection: sources.map(source => ({ sourceId: source.id, recordSha256: source.recordSha256, expectedStateRevision: source.state.revision })), context: parseGlobalContextInput(template) };
    };
    await work({ workspace, store, snapshotInput });
  } finally { store.close(); await rm(workspace, { recursive: true, force: true }); }
}
function editCatalog(store: WorkspaceStore, table: "context_sources" | "context_snapshots", id: string, edit: (value: Record<string, any>) => void) {
  const db = new DatabaseSync(resolve(store.directory, "workspace.sqlite")); try { const value = JSON.parse(String(db.prepare(`SELECT document FROM ${table} WHERE id=?`).get(id)!.document)); edit(value); db.prepare(`UPDATE ${table} SET document=? WHERE id=?`).run(JSON.stringify(value), id); } finally { db.close(); }
}

test("context import preserves exact private text bytes and separate declared/import times without tasks, tools or research", async t => fixture(async ({ store }) => {
  let network = 0; t.mock.method(globalThis, "fetch", async () => { network++; throw new Error(); });
  const supplied = input(), saved = await importContextSource(store, supplied, authored), result = await readContextSource(store, saved.id);
  assert((await readFile(resolve(saved.directory, "source.txt"))).equals(authored)); assert(Buffer.from(result.content).equals(authored)); assert.equal(result.source.input.metadata.retrievedAt, supplied.metadata.retrievedAt); assert(Date.parse(saved.importedAt) > Date.parse(supplied.metadata.retrievedAt));
  assert.equal(result.source.provenance.source, "operator_imported_unverified"); assert.equal(result.source.provenance.publisher, "not_authenticated"); assert.equal(result.source.boundaries.externalProcessing, "not_authorized"); assert.equal(result.source.boundaries.training, "not_authorized"); assert.equal(network, 0);
  assert.equal((await stat(saved.directory)).mode & 0o777, 0o700); for (const file of ["record.json", "source.txt"]) assert.equal((await stat(resolve(saved.directory, file))).mode & 0o777, 0o600);
  assert.equal(sha256(await readFile(resolve(saved.directory, "record.json"))), saved.recordSha256); assert(Object.isFrozen(result.source.input.permissions)); assert.equal(store.auditLog().length, 1); assert.deepEqual(store.jobs(), []); assert.deepEqual(store.actorRuns(), []); for (const file of ["tasks.sqlite", "budgets.sqlite", "research.sqlite"]) assert(!existsSync(resolve(store.directory, file)));
  const projected = contextSourceSummaries(store)[0]!; assert.equal(projected.recordStatus, "cataloged_unverified"); assert(!Object.hasOwn(projected, "directory")); assert(!Object.hasOwn(projected, "content"));
}));

test("bad byte pins, false authority/collector identity and expired or uninspected imports fail before a source directory", async () => {
  for (const boundary of ["hash", "external", "local", "training", "collector", "expired", "uninspected", "period", "utf8", "oversize", "control"]) await fixture(async ({ store }) => {
    const supplied: any = input(); let content = authored;
    if (boundary === "hash") supplied.metadata.contentSha256 = "b".repeat(64);
    if (boundary === "external") supplied.permissions.externalProcessing = true;
    if (boundary === "local") supplied.permissions.localReview = false;
    if (boundary === "training") supplied.permissions.training = true;
    if (boundary === "collector") supplied.collector = "trusted_global_feed";
    if (boundary === "expired") supplied.permissions.expiresAt = new Date(0).toISOString();
    if (boundary === "uninspected") { supplied.metadata.inspection = "metadata_only"; supplied.metadata.contentSha256 = null; }
    if (boundary === "period") supplied.observationPeriod = { startsAt: new Date(Date.now() + 1000).toISOString(), endsAt: new Date(Date.now() + 2000).toISOString() };
    if (boundary === "utf8") content = Buffer.from([0xff]);
    if (boundary === "oversize") content = Buffer.alloc(32769, "x");
    if (boundary === "control") content = Buffer.from("authored\0text");
    await assert.rejects(importContextSource(store, supplied, content), ContextDataError); assert(!existsSync(resolve(store.directory, "context-sources"))); assert.deepEqual(store.auditLog(), []);
  });
});

test("mutable caller metadata and bytes cannot alter the copied published source", async () => fixture(async ({ store }) => {
  const supplied = input(), content = Buffer.from(authored), pending = importContextSource(store, supplied, content); supplied.metadata.title = "changed-after-call"; content.fill(120);
  const saved = await pending, checked = await readContextSource(store, saved.id); assert.notEqual(checked.source.input.metadata.title, supplied.metadata.title); assert(Buffer.from(checked.content).equals(authored));
}));

test("withdrawal preserves bytes and audit history, denies local reads and catalogs, and stale revisions cannot restore", async () => fixture(async ({ store }) => {
  const saved = await importContextSource(store, input(), authored), before = await readFile(resolve(saved.directory, "record.json")), audit = store.auditLog().length;
  const stopped = withdrawContextSource(store, saved.id, 1, "Declared withdrawal for this authored check."); assert.equal(stopped.state.status, "withdrawn"); assert.equal(stopped.state.revision, 2); assert.equal(store.contextSourceEvents(saved.id).length, 2); assert.equal(store.auditLog().length, audit + 1);
  await assert.rejects(readContextSource(store, saved.id), ContextDataError); assert.deepEqual(contextSourceSummaries(store), []); assert.throws(() => withdrawContextSource(store, saved.id, 1, "stale retry"), ContextStateConflict); assert.equal(store.auditLog().length, audit + 1); assert((await readFile(resolve(saved.directory, "record.json"))).equals(before));
}));

test("expired local-use permission denies delivery but administrative withdrawal still works without reading lost text", async t => fixture(async ({ store }) => {
  const supplied = input(), saved = await importContextSource(store, supplied, authored); await rm(resolve(saved.directory, "source.txt"));
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse(supplied.permissions.expiresAt) + 1 }); await assert.rejects(readContextSource(store, saved.id), ContextDataError); assert.deepEqual(contextSourceSummaries(store), []);
  assert.equal(withdrawContextSource(store, saved.id, 1, "Administrative stop after expiry and file loss.").state.status, "withdrawn");
}));

test("correction creates an exact new version and atomically supersedes the active predecessor without changing its bytes", async () => fixture(async ({ store }) => {
  const supplied = input(), old = await importContextSource(store, supplied, authored), original = await readFile(resolve(old.directory, "record.json")), content = Buffer.from("Authored corrected content; still no actual news.");
  const corrected = structuredClone(supplied); corrected.metadata.contentSha256 = sha256(content); corrected.supersedes = { sourceId: old.id, expectedRevision: 1 };
  const next = await importContextSource(store, corrected, content), result = await readContextSource(store, next.id); assert.equal(next.version, 2); assert.equal(next.lineageRootId, old.id); assert.equal(result.source.previous!.recordSha256, old.recordSha256); assert.equal(store.contextSource(old.id)!.state.replacementId, next.id); assert.equal(store.contextSource(old.id)!.state.status, "superseded");
  assert((await readFile(resolve(old.directory, "record.json"))).equals(original)); assert((await readFile(resolve(old.directory, "source.txt"))).equals(authored)); await assert.rejects(readContextSource(store, old.id), ContextDataError); assert.deepEqual(contextSourceSummaries(store).map(source => source.id), [next.id]);
}));

test("a correction cannot change citation/origin identity or implicitly restore a withdrawn version", async () => fixture(async ({ store }) => {
  const supplied = input(), old = await importContextSource(store, supplied, authored), before = await readdir(resolve(store.directory, "context-sources"));
  for (const field of ["id", "originId"] as const) { const changed = structuredClone(supplied); changed.metadata[field] = "another-identity"; changed.supersedes = { sourceId: old.id, expectedRevision: 1 }; await assert.rejects(importContextSource(store, changed, authored), ContextStateConflict); }
  withdrawContextSource(store, old.id, 1, "No restoration authorized."); supplied.supersedes = { sourceId: old.id, expectedRevision: 1 }; await assert.rejects(importContextSource(store, supplied, authored), ContextDataError); assert.deepEqual(await readdir(resolve(store.directory, "context-sources")), before);
}));

test("two connections cannot both withdraw the same source revision", async () => fixture(async ({ workspace, store }) => {
  const saved = await importContextSource(store, input(), authored), second = new WorkspaceStore(workspace); try {
    const outcomes = await Promise.allSettled([Promise.resolve().then(() => withdrawContextSource(store, saved.id, 1, "first stop")), Promise.resolve().then(() => withdrawContextSource(second, saved.id, 1, "second stop"))]);
    assert.equal(outcomes.filter(item => item.status === "fulfilled").length, 1); assert.equal(outcomes.filter(item => item.status === "rejected").length, 1); assert.equal(store.contextSourceEvents(saved.id).length, 2);
  } finally { second.close(); }
}));

test("source catalog insert and audit roll back on duplicate or asynchronous/failed authority", async () => fixture(async ({ store }) => {
  const saved = await importContextSource(store, input(), authored), before = store.auditLog();
  assert.throws(() => store.saveContextSource(saved, null, () => undefined)); assert.deepEqual(store.auditLog(), before);
  const second = { ...saved, id: "11111111-1111-4111-8111-111111111111", lineageRootId: "11111111-1111-4111-8111-111111111111" };
  assert.throws(() => store.saveContextSource(second, null, (() => Promise.resolve()) as any), ContextDataError); assert.throws(() => store.saveContextSource(second, null, () => { throw new Error("authored denial"); })); assert.equal(store.contextSource(second.id), null); assert.deepEqual(store.auditLog(), before);
}));

test("failed source catalog commit preserves factual orphan files without any automatic adoption", async t => fixture(async ({ store }) => {
  t.mock.method(store, "saveContextSource", () => { throw new Error("authored database failure"); }); await assert.rejects(importContextSource(store, input(), authored), ContextDataError);
  const roots = await readdir(resolve(store.directory, "context-sources")); assert.equal(roots.length, 1); assert.deepEqual(await readdir(resolve(store.directory, "context-sources", roots[0]!)), ["record.json", "source.txt"]); assert.equal(store.contextSource(roots[0]!), null); assert.deepEqual(store.auditLog(), []); await assert.rejects(readContextSource(store, roots[0]!), ContextDataError);
}));

test("changed source bytes, rehashed false collector claims and altered state history are denied", async () => {
  for (const boundary of ["content", "provenance", "history", "catalog"]) await fixture(async ({ store }) => {
    const saved = await importContextSource(store, input(), authored);
    if (boundary === "content") await writeFile(resolve(saved.directory, "source.txt"), "changed authored bytes");
    if (boundary === "provenance") { const file = resolve(saved.directory, "record.json"), record = JSON.parse(await readFile(file, "utf8")); record.provenance.source = "authenticated_global_news"; const bytes = Buffer.from(JSON.stringify(record, null, 2) + "\n"); await writeFile(file, bytes); editCatalog(store, "context_sources", saved.id, value => { value.recordSha256 = sha256(bytes); }); }
    if (boundary === "history") { const db = new DatabaseSync(resolve(store.directory, "workspace.sqlite")); try { db.prepare("UPDATE context_source_events SET document=? WHERE source_id=?").run(JSON.stringify({ ...saved.state, reason: "changed initial event" }), saved.id); } finally { db.close(); } }
    if (boundary === "catalog") editCatalog(store, "context_sources", saved.id, value => { value.title = "changed catalog title"; });
    await assert.rejects(readContextSource(store, saved.id), ContextDataError);
  });
});

test("source reads deny symlinks, hard links, public permissions, oversize files and unsafe parent substitution", async () => {
  for (const boundary of ["symlink", "hardlink", "public", "oversize", "parent"]) await fixture(async ({ store }) => {
    const saved = await importContextSource(store, input(), authored), file = resolve(saved.directory, "source.txt");
    if (boundary === "symlink") { await rename(file, file + ".saved"); await symlink(file + ".saved", file); }
    if (boundary === "hardlink") await link(file, file + ".alias");
    if (boundary === "public") await chmod(file, 0o644);
    if (boundary === "oversize") await writeFile(file, Buffer.alloc(32769, "x"));
    if (boundary === "parent") { const parent = resolve(store.directory, "context-sources"); await rename(parent, parent + "-saved"); await symlink(parent + "-saved", parent); }
    await assert.rejects(readContextSource(store, saved.id), ContextDataError);
  });
});

test("unsafe source output parents do not mutate the external target", async () => fixture(async ({ workspace, store }) => {
  const external = resolve(workspace, "external"); await mkdir(external); await symlink(external, resolve(store.directory, "context-sources")); await assert.rejects(importContextSource(store, input(), authored), ContextDataError); assert.deepEqual(await readdir(external), []); assert.deepEqual(store.auditLog(), []);
}));

test("named import files are bounded and exact; unsafe links and invalid metadata do not open a referenced URL", async t => fixture(async ({ workspace }) => {
  let calls = 0; t.mock.method(globalThis, "fetch", async () => { calls++; throw new Error(); }); const metadataFile = resolve(workspace, "metadata.json"), contentFile = resolve(workspace, "source.txt"); await writeFile(metadataFile, JSON.stringify(input())); await writeFile(contentFile, authored);
  const checked = await readContextImportFiles(metadataFile, contentFile); assert(checked.content.equals(authored)); assert.equal(calls, 0); await link(contentFile, contentFile + ".alias"); await assert.rejects(readContextImportFiles(metadataFile, contentFile), ContextDataError);
  await writeFile(metadataFile, Buffer.from([0xff])); await assert.rejects(readContextImportFiles(metadataFile, contentFile), ContextDataError); assert.equal(calls, 0);
}));

test("snapshot preview saves nothing; saved records bind the exact brief, imported source versions and metadata-only assessment", async () => fixture(async ({ store, snapshotInput }) => {
  const source = await importContextSource(store, input(), authored), supplied = await snapshotInput([source]), audit = store.auditLog(), files = await readdir(store.directory), packet = await readAnalyticalPacket(store, supplied.briefId);
  const preview = await previewContextSnapshot(store, supplied); assert.equal(preview.state, "not_saved"); assert.deepEqual(store.auditLog(), audit); assert.deepEqual(await readdir(store.directory), files); assert.equal(preview.assessment.boundaries.sourceContentsRead, false);
  const saved = await createContextSnapshot(store, supplied), report = await readContextSnapshot(store, saved.id); assert.equal(report.briefPacketSha256, packet.packetSha256); assert.equal(report.sourcePins[0]!.recordSha256, source.recordSha256); assert.equal(report.sourcePins[0]!.contentSha256, sha256(authored)); assert.equal(report.inputSha256, sha256(JSON.stringify(report.input))); assert.equal(report.assessment.outcome, "metadata_checks_passed"); assert.equal(report.boundaries.sourceContents, "local_imported_bytes_integrity_only"); assert.equal(report.boundaries.semanticReview, "unreviewed"); assert.equal(report.boundaries.actualNewsCollected, false); assert.equal(report.boundaries.modelCalls, 0); assert(Object.isFrozen(report.sourcePins));
  assert.equal(contextSnapshotSummaries(store)[0]!.recordStatus, "cataloged_unverified"); assert(!JSON.stringify(report).includes(authored.toString())); assert(!Object.hasOwn(contextSnapshotSummaries(store)[0]!, "directory")); assert.deepEqual(await readAnalyticalPacket(store, supplied.briefId), packet);
}));

test("snapshots refuse incorrect metadata/order/byte pins/revisions and future or pre-import as-of without publication", async () => fixture(async ({ store, snapshotInput }) => {
  const source = await importContextSource(store, input(), authored), original = await snapshotInput([source]);
  for (const boundary of ["metadata", "pin", "revision", "future", "before_import", "extra_source"]) {
    const changed = structuredClone(original);
    if (boundary === "metadata") changed.context.sources[0]!.publisher = "different declared publisher";
    if (boundary === "pin") changed.selection[0]!.recordSha256 = "b".repeat(64);
    if (boundary === "revision") changed.selection[0]!.expectedStateRevision = 2;
    if (boundary === "future") changed.context.scope.asOf = new Date(Date.now() + 3600000).toISOString();
    if (boundary === "before_import") changed.context.scope.asOf = new Date(Date.parse(source.importedAt) - 1).toISOString();
    if (boundary === "extra_source") changed.context.sources.push({ ...changed.context.sources[0]!, id: "not-selected" });
    await assert.rejects(createContextSnapshot(store, changed), ContextDataError); assert(!existsSync(resolve(store.directory, "context-snapshots")));
  }
}));

test("partial and empty snapshot coverage stay explicit, with no actual news or semantic approval", async () => fixture(async ({ store, snapshotInput }) => {
  const source = await importContextSource(store, input(), authored), supplied = structuredClone(await snapshotInput([source])); supplied.context.scope.regions.push("us"); const saved = await createContextSnapshot(store, supplied), report = await readContextSnapshot(store, saved.id); assert.equal(report.assessment.outcome, "partial_metadata_coverage"); assert.equal(report.assessment.missingCoverage[0]!.region, "us"); assert.equal(report.boundaries.currentGlobalAwareness, "not_established");
  const empty = await snapshotInput([]), none = await createContextSnapshot(store, empty); assert.equal((await readContextSnapshot(store, none.id)).assessment.outcome, "no_eligible_context");
}));

test("current withdrawal, supersession or expiry denies snapshots and hides their catalog without rewriting them", async () => {
  for (const boundary of ["withdrawal", "supersession", "expiry"]) await fixture(async ({ store, snapshotInput }) => {
    const supplied = input(), source = await importContextSource(store, supplied, authored), saved = await createContextSnapshot(store, await snapshotInput([source])), before = await readFile(resolve(saved.directory, "snapshot.json"));
    if (boundary === "withdrawal") withdrawContextSource(store, source.id, 1, "Current use denied.");
    if (boundary === "supersession") { supplied.supersedes = { sourceId: source.id, expectedRevision: 1 }; await importContextSource(store, supplied, authored); }
    if (boundary === "expiry") editCatalog(store, "context_sources", source.id, value => { value.expiresAt = new Date(Date.now() - 1).toISOString(); });
    await assert.rejects(readContextSnapshot(store, saved.id), ContextDataError); assert.deepEqual(contextSnapshotSummaries(store), []); assert((await readFile(resolve(saved.directory, "snapshot.json"))).equals(before));
  });
});

test("source text loss or brief tampering denies checked snapshots; restoration does not promote new judgments", async () => fixture(async ({ store, snapshotInput }) => {
  const source = await importContextSource(store, input(), authored), supplied = await snapshotInput([source]), saved = await createContextSnapshot(store, supplied), brief = store.reviewBrief(supplied.briefId)!;
  for (const file of [resolve(source.directory, "source.txt"), resolve(brief.directory, "report.json")]) { const original = await readFile(file); await writeFile(file, "authored changed bytes"); await assert.rejects(readContextSnapshot(store, saved.id), ContextDataError); await writeFile(file, original); assert.equal((await readContextSnapshot(store, saved.id)).boundaries.semanticReview, "unreviewed"); }
}));

test("snapshot rehashed false assertions, unsafe links, oversize and catalog changes are unavailable", async () => {
  for (const boundary of ["assertion", "symlink", "hardlink", "public", "oversize", "catalog"]) await fixture(async ({ store, snapshotInput }) => {
    const source = await importContextSource(store, input(), authored), saved = await createContextSnapshot(store, await snapshotInput([source])), file = resolve(saved.directory, "snapshot.json");
    if (boundary === "assertion") { const report = JSON.parse(await readFile(file, "utf8")); report.boundaries.currentGlobalAwareness = "verified"; const changed = Buffer.from(JSON.stringify(report, null, 2) + "\n"); await writeFile(file, changed); editCatalog(store, "context_snapshots", saved.id, value => { value.recordSha256 = sha256(changed); }); }
    if (boundary === "symlink") { await rename(file, file + ".saved"); await symlink(file + ".saved", file); }
    if (boundary === "hardlink") await link(file, file + ".alias");
    if (boundary === "public") await chmod(file, 0o644);
    if (boundary === "oversize") await writeFile(file, Buffer.alloc(700001, "x"));
    if (boundary === "catalog") editCatalog(store, "context_snapshots", saved.id, value => { value.title = "false catalog title"; });
    await assert.rejects(readContextSnapshot(store, saved.id), ContextDataError);
  });
});

test("source withdrawal at final snapshot insertion leaves an unaccepted orphan and no snapshot audit", async t => fixture(async ({ store, snapshotInput }) => {
  const source = await importContextSource(store, input(), authored), supplied = await snapshotInput([source]), save = store.saveContextSnapshot.bind(store);
  t.mock.method(store, "saveContextSnapshot", (summary: ContextSnapshotSummary, authorize: () => undefined) => { withdrawContextSource(store, source.id, 1, "Withdrawn at final publication boundary."); return save(summary, authorize); });
  await assert.rejects(createContextSnapshot(store, supplied), ContextDataError); assert.deepEqual(store.recentContextSnapshots(), []); const roots = await readdir(resolve(store.directory, "context-snapshots")); assert.equal(roots.length, 1); assert(existsSync(resolve(store.directory, "context-snapshots", roots[0]!, "snapshot.json"))); assert(!store.auditLog().some(event => event.action === "context_snapshot_saved"));
}));

test("existing workspace checks reject missing or unsafe state/database without creating or normalizing it", async () => fixture(async ({ workspace, store }) => {
  const absent = resolve(workspace, "new-workspace"); await mkdir(absent); await assert.rejects(existingContextWorkspace(absent), ContextDataError); assert.deepEqual(await readdir(absent), []);
  const database = resolve(store.directory, "workspace.sqlite"); await chmod(database, 0o644); await assert.rejects(existingContextWorkspace(workspace), ContextDataError); assert.equal((await stat(database)).mode & 0o777, 0o644); await chmod(database, 0o600);
  await chmod(store.directory, 0o755); await assert.rejects(existingContextWorkspace(workspace), ContextDataError); assert.equal((await stat(store.directory)).mode & 0o777, 0o755);
}));

test("terminal source and snapshot workflow is explicit, preserves inputs, and rejects bad input before a new store", async () => {
  const workspace = await mkdtemp(resolve(tmpdir(), "redteam-context-terminal-")), cli = resolve(import.meta.dirname, "../src/cli.ts"), run = (args: string[]) => execFileSync(process.execPath, [cli, "context", ...args], { cwd: workspace, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  try {
    const metadata = resolve(workspace, "metadata.json"), sourceFile = resolve(workspace, "source.txt"); await writeFile(metadata, JSON.stringify({ ...input(), collector: "not_allowed" })); await writeFile(sourceFile, authored);
    let denied = spawnSync(process.execPath, [cli, "context", "sources", "import", metadata, sourceFile], { cwd: workspace, encoding: "utf8" }); assert.equal(denied.status, 1); assert(!existsSync(resolve(workspace, ".redteam"))); await writeFile(metadata, JSON.stringify(input())); const before = await readFile(metadata);
    const imported = JSON.parse(run(["sources", "import", metadata, sourceFile])); assert(!Object.hasOwn(imported, "directory")); const detail = JSON.parse(run(["sources", "show", imported.id])); assert.equal(detail.source.provenance.source, "operator_imported_unverified"); assert(Buffer.from(detail.content).equals(authored)); assert.equal(JSON.parse(run(["sources", "list"])).sources.length, 1);
    const store = new WorkspaceStore(workspace); let supplied: ContextSnapshotInput;
    try { const brief = await createReviewBrief(store, JSON.parse(await readFile(resolve(import.meta.dirname, "../examples/idea-review-brief.input.json"), "utf8"))), context = JSON.parse(await readFile(resolve(import.meta.dirname, "../examples/global-context.input.json"), "utf8")); context.scope.asOf = new Date().toISOString(); context.sources = [detail.source.input.metadata]; supplied = { schemaVersion: "1.0", kind: "context_snapshot_input", briefId: brief.id, selection: [{ sourceId: imported.id, recordSha256: imported.recordSha256, expectedStateRevision: 1 }], context }; } finally { store.close(); }
    const snapshotFile = resolve(workspace, "snapshot.input.json"); await writeFile(snapshotFile, JSON.stringify(supplied)); assert.equal(JSON.parse(run(["snapshots", "preview", snapshotFile])).state, "not_saved"); const saved = JSON.parse(run(["snapshots", "create", snapshotFile])); assert(!Object.hasOwn(saved, "directory")); assert.equal(JSON.parse(run(["snapshots", "show", saved.id])).boundaries.semanticReview, "unreviewed"); assert.equal(JSON.parse(run(["snapshots", "list"])).snapshots.length, 1);
    assert.equal(JSON.parse(run(["sources", "withdraw", imported.id, "1", "Deliberate terminal stop."])).state.status, "withdrawn"); assert.equal(JSON.parse(run(["snapshots", "list"])).snapshots.length, 0); denied = spawnSync(process.execPath, [cli, "context", "snapshots", "show", saved.id], { cwd: workspace, encoding: "utf8" }); assert.equal(denied.status, 1); assert(!denied.stderr.includes(authored.toString())); assert((await readFile(metadata)).equals(before)); assert((await readFile(sourceFile)).equals(authored));
  } finally { await rm(workspace, { recursive: true, force: true }); }
});


test("competing corrections leave exactly one active new version and preserve the losing orphan", async () => fixture(async ({ store }) => {
  const supplied = input(), source = await importContextSource(store, supplied, authored); supplied.supersedes = { sourceId: source.id, expectedRevision: 1 };
  const outcomes = await Promise.allSettled([importContextSource(store, supplied, authored), importContextSource(store, supplied, authored)]);
  assert.equal(outcomes.filter(item => item.status === "fulfilled").length, 1); assert.equal(outcomes.filter(item => item.status === "rejected").length, 1); assert.equal(contextSourceSummaries(store).length, 1); assert.equal(store.recentContextSources().length, 2); assert.equal(store.contextSourceEvents(source.id).length, 2); assert.equal(store.auditLog().length, 3);
}));

test("a failing correction insertion rolls back predecessor state, events and audit", async () => fixture(async ({ store }) => {
  const source = await importContextSource(store, input(), authored), before = store.auditLog();
  assert.throws(() => store.saveContextSource({ ...source, version: 2 }, { sourceId: source.id, expectedRevision: 1 }, () => undefined));
  assert.deepEqual(store.contextSource(source.id), source); assert.equal(store.contextSourceEvents(source.id).length, 1); assert.deepEqual(store.auditLog(), before);
}));

test("permission expiry at the source catalog boundary preserves bytes without catalog acceptance", async t => fixture(async ({ store }) => {
  const supplied = input(), save = store.saveContextSource.bind(store);
  t.mock.method(store, "saveContextSource", (summary: ContextSourceCatalog, previous: ContextSourceImport["supersedes"], authorize: () => undefined) => { t.mock.timers.enable({ apis: ["Date"], now: Date.parse(supplied.permissions.expiresAt) + 1 }); return save(summary, previous, authorize); });
  await assert.rejects(importContextSource(store, supplied, authored), ContextDataError); assert.deepEqual(store.recentContextSources(), []); assert.deepEqual(store.auditLog(), []); const roots = await readdir(resolve(store.directory, "context-sources")); assert.equal(roots.length, 1); assert((await readFile(resolve(store.directory, "context-sources", roots[0]!, "source.txt"))).equals(authored));
}));

test("actual source-use expiry denies a historical snapshot without altering its immutable file", async t => fixture(async ({ store, snapshotInput }) => {
  const supplied = input(), source = await importContextSource(store, supplied, authored), saved = await createContextSnapshot(store, await snapshotInput([source])), before = await readFile(resolve(saved.directory, "snapshot.json"));
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse(supplied.permissions.expiresAt) + 1 }); await assert.rejects(readContextSnapshot(store, saved.id), ContextDataError); assert.deepEqual(contextSnapshotSummaries(store), []); assert((await readFile(resolve(saved.directory, "snapshot.json"))).equals(before)); assert.equal(store.contextSource(source.id)!.state.status, "active");
}));

test("snapshot source order and mutable caller values cannot redirect an exact selection", async () => fixture(async ({ store, snapshotInput }) => {
  const first = await importContextSource(store, input(), authored), second = await importContextSource(store, input(authored, "source-2"), authored), supplied = structuredClone(await snapshotInput([first, second]));
  const wrong = structuredClone(supplied); wrong.context.sources.reverse(); await assert.rejects(createContextSnapshot(store, wrong), ContextDataError); assert(!existsSync(resolve(store.directory, "context-snapshots")));
  const pending = createContextSnapshot(store, supplied); supplied.selection[0]!.sourceId = "../outside"; supplied.context.scope.regions.push("us"); const saved = await pending, checked = await readContextSnapshot(store, saved.id); assert.equal(checked.sourcePins[0]!.sourceId, first.id); assert.deepEqual(checked.input.context.scope.regions, ["in"]);
}));

test("rehashing alternate JSON formatting cannot replace supported canonical source or snapshot bytes", async () => fixture(async ({ store, snapshotInput }) => {
  const source = await importContextSource(store, input(), authored), saved = await createContextSnapshot(store, await snapshotInput([source]));
  for (const [table, id, file] of [["context_sources", source.id, resolve(source.directory, "record.json")], ["context_snapshots", saved.id, resolve(saved.directory, "snapshot.json")]] as const) {
    const original = await readFile(file), originalHash = sha256(original), changed = Buffer.from(JSON.stringify(JSON.parse(original.toString()))); await writeFile(file, changed); editCatalog(store, table, id, value => { value.recordSha256 = sha256(changed); });
    await assert.rejects(table === "context_sources" ? readContextSource(store, id) : readContextSnapshot(store, id), ContextDataError); await writeFile(file, original); editCatalog(store, table, id, value => { value.recordSha256 = originalHash; });
  }
  assert.equal((await readContextSnapshot(store, saved.id)).boundaries.semanticReview, "unreviewed");
}));
