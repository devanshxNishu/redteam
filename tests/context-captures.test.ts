import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, link, chmod, realpath } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import type { ClientRequest, IncomingMessage } from "node:http";
import { WorkspaceStore } from "../src/workspace.ts";
import { sha256 } from "../src/evidence.ts";
import { ContextCollectionError, assertNativeContextCapture, createInjectedContextCollector, publicContextCaptureReceipt, readRecordedPublicContextCapture } from "../src/context-collector.ts";
import type { PublicContextCapture, PublicContextCollection } from "../src/context-collector.ts";
import { ContextDataError, ContextStateConflict } from "../src/context-data.ts";
import { readContextSource, saveCapturedContextSource, importContextSource, contextSourceSummaries, prepareContextCaptureCorrection, withdrawContextSource } from "../src/context-sources.ts";
import type { ContextSourceCatalog } from "../src/context-sources.ts";
import { collectContextSource, parseContextCollectionInput, readContextCollectionInput } from "../src/context-collection.ts";
import { createReviewBrief } from "../src/review-briefs.ts";
import { createContextSnapshot, previewContextSnapshot, readContextSnapshot, contextSnapshotSummaries } from "../src/context-snapshots.ts";

function collection(): PublicContextCollection { return { schemaVersion: "1.0", kind: "public_context_collection_input", adapter: "world_bank_population_v1", countryCode: "IND", years: { first: 2023, last: 2024 }, permissions: { collect: true, localReview: true, basis: "AUTHORED historical software fixture. No actual network observation, news, data, participant or license assertion.", expiresAt: new Date(Date.now() + 600000).toISOString(), externalProcessing: false, redistribution: false, training: false }, limits: { timeoutMs: 1000, maximumBytes: 32768 } }; }
function collectionInput() { return { schemaVersion: "1.0", kind: "context_source_collection_input", collection: collection(), supersedes: null }; }
async function simulatedCapture(): Promise<PublicContextCapture> {
  const raw = Buffer.from(JSON.stringify([{ page: 1, pages: 1, per_page: 10, total: 1, sourceid: "2", lastupdated: "2025-01-01" }, [{ indicator: { id: "SP.POP.TOTL", value: "Authored fixture indicator" }, country: { id: "IN", value: "Authored fixture location" }, countryiso3code: "IND", date: "2024", value: null, unit: "", obs_status: "", decimal: 0 }]]) + "\n");
  return createInjectedContextCollector({ resolver: () => ({ resolve4: async () => ["8.8.8.8"], cancel() {} }), request: (_url, _options, deliver) => {
    const request = Object.assign(new EventEmitter(), { destroy() {}, end() { queueMicrotask(() => { const response = Object.assign(new EventEmitter(), { statusCode: 200, complete: true, socket: { encrypted: true, authorized: true, remoteAddress: "8.8.8.8", remoteFamily: "IPv4", remotePort: 443 }, rawHeaders: ["Content-Type", "application/json", "Content-Length", String(raw.length)], destroy() {} }); deliver(response as unknown as IncomingMessage); response.emit("data", raw); response.emit("end"); }); } }); return request as unknown as ClientRequest;
  } })(collection());
}
// Deliberately authored historical claims through the low-level Store, NEVER the native writer.
// This demonstrates checked local byte/policy identity, not independent historical attestation.
async function authoredReceipt() {
  const simulated = await simulatedCapture(), receipt = structuredClone(publicContextCaptureReceipt(simulated));
  receipt.provenance.transport = "native_https"; receipt.provenance.networkObservation = "native_runtime_observation";
  const historical = readRecordedPublicContextCapture(receipt, simulated.body.text); assert.throws(() => assertNativeContextCapture(historical), ContextCollectionError);
  return { simulated, receipt, historical };
}
async function fixture(work: (store: WorkspaceStore, workspace: string) => Promise<void>) {
  const workspace = await mkdtemp(resolve(tmpdir(), "redteam-native-records-")), store = new WorkspaceStore(workspace);
  try { await work(store, workspace); } finally { store.close(); await rm(workspace, { recursive: true, force: true }); }
}
async function historicalSource(store: WorkspaceStore, previous: ContextSourceCatalog | null = null) {
  const { simulated, receipt, historical } = await authoredReceipt(), id = randomUUID(), importedAt = new Date().toISOString(), country = "ind";
  const metadata = { id: "wb-pop-ind-2023-2024", originId: "world-bank-wdi-2", kind: "dataset", publisher: "World Bank", title: "World Bank population: IND (2023-2024)", url: historical.url, publishedAt: null, updatedAt: null, eventAt: null, retrievedAt: historical.retrievedAt, status: "available", inspection: "declared_inspected", contentSha256: historical.body.sha256, regions: [country], language: "en", topics: ["population"], applicabilityBasis: "Provider country/economy query and annual population series only; aggregate identifiers do not imply every country or stakeholder coverage." };
  const input = { schemaVersion: "1.0", kind: "context_source_native_input", metadata, observationPeriod: null, permissions: { localReview: true, basis: historical.input.permissions.basis, expiresAt: historical.input.permissions.expiresAt, externalProcessing: false, redistribution: false, training: false }, supersedes: previous ? { sourceId: previous.id, expectedRevision: 1 } : null };
  const record = { schemaVersion: "1.0", kind: "context_source_record", policyVersion: "context-source-native-capture-v1", id, importedAt, version: previous ? previous.version + 1 : 1, lineageRootId: previous?.lineageRootId ?? id, previous: previous ? { id: previous.id, recordSha256: previous.recordSha256, version: previous.version, lineageRootId: previous.lineageRootId } : null, input, inputSha256: sha256(JSON.stringify(input)), metadataSha256: sha256(JSON.stringify(metadata)), content: { filename: "source.txt", bytes: historical.body.bytes, sha256: historical.body.sha256 }, provenance: { source: "native_public_capture_recorded", importedText: "exact_received_utf8_json", publisher: "not_authenticated", retrievalTime: "native_runtime_recorded", networkRequests: 1, modelCalls: 0 }, boundaries: { semanticReview: "unreviewed", externalProcessing: "not_authorized", redistribution: "not_authorized", training: "not_authorized", currentGlobalAwareness: "not_established", researchValidated: false, stakeholderDecisions: false, captureReceipt: "historical_runtime_record_not_independent_attestation" }, capture: receipt };
  const directory = resolve(await realpath(store.directory), "context-sources", id); await mkdir(directory, { recursive: true, mode: 0o700 }); await chmod(resolve(store.directory, "context-sources"), 0o700);
  const bytes = Buffer.from(JSON.stringify(record, null, 2) + "\n"); await writeFile(resolve(directory, "record.json"), bytes, { mode: 0o600 }); await writeFile(resolve(directory, "source.txt"), historical.body.text, { mode: 0o600 });
  const catalog: ContextSourceCatalog = { recordPolicy: "context-source-native-capture-v1", id, importedAt, version: record.version, lineageRootId: record.lineageRootId, metadataId: metadata.id, originId: metadata.originId, kind: "dataset", title: metadata.title, expiresAt: input.permissions.expiresAt, directory, recordSha256: sha256(bytes), contentSha256: historical.body.sha256, inputSha256: record.inputSha256, metadataSha256: record.metadataSha256, state: { revision: 1, status: "active", at: importedAt, reason: null, replacementId: null } };
  store.saveContextSource(catalog, input.supersedes, () => undefined); return { catalog, record, historical, simulated, bytes };
}
function editCatalog(store: WorkspaceStore, id: string, edit: (value: any) => void) {
  const db = new DatabaseSync(resolve(store.directory, "workspace.sqlite")); try { const value = JSON.parse(String(db.prepare("SELECT document FROM context_sources WHERE id=?").get(id)!.document)); edit(value); db.prepare("UPDATE context_sources SET document=? WHERE id=?").run(JSON.stringify(value), id); } finally { db.close(); }
}
async function snapshotInput(store: WorkspaceStore, sources: ContextSourceCatalog[]) {
  const brief = await createReviewBrief(store, JSON.parse(await readFile(resolve(import.meta.dirname, "../examples/idea-review-brief.input.json"), "utf8")));
  const context = JSON.parse(await readFile(resolve(import.meta.dirname, "../examples/global-context.input.json"), "utf8")); context.scope = { asOf: new Date().toISOString(), regions: ["ind"], languages: ["en"], topics: ["population"] }; context.sources = [];
  for (const source of sources) context.sources.push((await readContextSource(store, source.id)).source.input.metadata);
  return { schemaVersion: "1.0", kind: "context_snapshot_input", briefId: brief.id, selection: sources.map(source => ({ sourceId: source.id, recordSha256: source.recordSha256, expectedStateRevision: 1 })), context };
}

test("authored historical receipt reconstructs exact source bytes without conferring native execution identity", async () => fixture(async store => {
  const saved = await historicalSource(store), checked = await readContextSource(store, saved.catalog.id);
  assert.equal(checked.content, saved.historical.body.text); assert.equal(checked.source.policyVersion, "context-source-native-capture-v1"); assert.equal(checked.source.input.kind, "context_source_native_input"); assert.equal(checked.source.input.metadata.publishedAt, null); assert.equal(checked.source.input.metadata.updatedAt, null); assert.equal(checked.source.input.observationPeriod, null); assert.deepEqual(checked.source.input.metadata.regions, ["ind"]); assert.equal(checked.source.provenance.publisher, "not_authenticated"); assert.equal(checked.source.boundaries.semanticReview, "unreviewed");
  assert(checked.source.policyVersion === "context-source-native-capture-v1"); assert.equal(checked.source.capture.dataset.lastUpdated.precision, "date_only"); assert(!Object.hasOwn(checked.source.capture.body, "text")); assert.equal(checked.source.capture.dataset.observations[0]!.value, null); assert.deepEqual(checked.source.capture.dataset.missingYears, [2023]); assert(Object.isFrozen(checked.source.capture.input));
  const summary = contextSourceSummaries(store)[0]!; assert.equal(summary.provenance, "native_capture_catalog_unverified"); assert.equal(summary.recordStatus, "cataloged_unverified"); assert(!JSON.stringify(summary).includes(store.directory)); assert.equal(store.auditLog()[0]!.action, "context_source_captured");
}));

test("injected, copied, reconstructed and forged native flags cannot use the native writer", async () => fixture(async store => {
  const { simulated, receipt, historical } = await authoredReceipt();
  for (const value of [simulated, historical, structuredClone(historical), receipt, { provenance: { transport: "native_https" } }]) await assert.rejects(saveCapturedContextSource(store, value as PublicContextCapture), ContextDataError);
  assert(!existsSync(resolve(store.directory, "context-sources"))); assert.deepEqual(store.auditLog(), []); assert.deepEqual(store.jobs(), []);
}));

test("receipt reconstruction rejects false provenance, scope, schema, dates, headers, bytes and bounds", async () => {
  const { receipt, historical } = await authoredReceipt();
  const changes: ((copy: any) => void)[] = [copy => { copy.url = "https://localhost/private"; }, copy => { copy.inputSha256 = "f".repeat(64); }, copy => { copy.body.sha256 = "f".repeat(64); }, copy => { copy.body.bytes++; }, copy => { copy.body.text = historical.body.text; }, copy => { copy.provenance.transport = "injected_test_io"; }, copy => { copy.provenance.networkObservation = "authenticated_publisher"; }, copy => { copy.provenance.httpRequests = 2; }, copy => { copy.provenance.redirects = 1; }, copy => { copy.provenance.bodyEvents = 8193; }, copy => { copy.provenance.peerIPv4 = "127.0.0.1"; }, copy => { copy.startedAt = copy.finishedAt; copy.retrievedAt = new Date(Date.parse(copy.startedAt) - 1).toISOString(); }, copy => { copy.finishedAt = new Date(Date.parse(copy.startedAt) + copy.input.limits.timeoutMs).toISOString(); }, copy => { copy.input.permissions.expiresAt = copy.finishedAt; }, copy => { copy.response.status = 206; }, copy => { copy.response.contentLength++; }, copy => { copy.response.date = "injected\nheader"; }, copy => { copy.response.extra = "unknown"; }, copy => { copy.dataset.observations[0].value = 999; }, copy => { copy.dataset.publishedAt = copy.retrievedAt; }, copy => { copy.boundaries.externalProcessing = "authorized"; }];
  for (const change of changes) { const copy = structuredClone(receipt); change(copy); assert.throws(() => readRecordedPublicContextCapture(copy, historical.body.text), ContextCollectionError); }
});

test("manual input cannot claim or replace a native policy", async () => fixture(async store => {
  const saved = await historicalSource(store), supplied: any = structuredClone(saved.record.input), raw = Buffer.from(saved.historical.body.text);
  await assert.rejects(importContextSource(store, supplied, raw), ContextDataError); supplied.kind = "context_source_import_input"; supplied.supersedes = { sourceId: saved.catalog.id, expectedRevision: 1 }; await assert.rejects(importContextSource(store, supplied, raw), ContextStateConflict);
  supplied.supersedes = null; supplied.provenance = "native_https"; await assert.rejects(importContextSource(store, supplied, raw), ContextDataError); assert.equal(store.recentContextSources().length, 1);
}));

test("native snapshots use v2 policy pins and leave unknown publication ineligible", async () => fixture(async store => {
  const saved = await historicalSource(store), input = await snapshotInput(store, [saved.catalog]), preview = await previewContextSnapshot(store, input); assert.equal(store.recentContextSnapshots().length, 0);
  const summary = await createContextSnapshot(store, input), report = await readContextSnapshot(store, summary.id); assert.equal(report.policyVersion, "context-snapshot-v2"); assert.equal(report.sourcePins[0]!.recordPolicy, "context-source-native-capture-v1"); assert.equal(report.boundaries.sourceContents, "local_source_bytes_integrity_only"); assert.equal(report.boundaries.networkRequests, 0); assert.equal(report.boundaries.actualNewsCollected, false); assert.equal(report.assessment.outcome, "no_eligible_context"); assert.deepEqual(report.assessment, preview.assessment); assert.equal(contextSnapshotSummaries(store).length, 1);
}));

test("mixed snapshots pin native and old manual policies while old manual-only v1 remains unchanged", async () => fixture(async store => {
  const native = await historicalSource(store), manualInput: any = structuredClone(native.record.input); manualInput.kind = "context_source_import_input"; manualInput.metadata.id = "authored-manual";
  const manual = await importContextSource(store, manualInput, Buffer.from(native.historical.body.text)); const v1 = await createContextSnapshot(store, await snapshotInput(store, [manual])), before = await readFile(resolve(v1.directory, "snapshot.json")); assert.equal((await readContextSnapshot(store, v1.id)).policyVersion, "context-snapshot-v1");
  const v2 = await createContextSnapshot(store, await snapshotInput(store, [native.catalog, manual])), report = await readContextSnapshot(store, v2.id); assert.deepEqual(report.sourcePins.map(pin => pin.recordPolicy), ["context-source-native-capture-v1", "context-source-import-v1"]); assert((await readFile(resolve(v1.directory, "snapshot.json"))).equals(before)); assert.equal((await readContextSnapshot(store, v1.id)).boundaries.sourceContents, "local_imported_bytes_integrity_only");
}));

test("withdrawal preserves native bytes and denies source and dependent snapshot delivery", async () => fixture(async store => {
  const saved = await historicalSource(store), snapshot = await createContextSnapshot(store, await snapshotInput(store, [saved.catalog])); withdrawContextSource(store, saved.catalog.id, 1, "Authored withdrawal");
  assert((await readFile(resolve(saved.catalog.directory, "record.json"))).equals(saved.bytes)); assert.equal(contextSourceSummaries(store).length, 0); assert.equal(contextSnapshotSummaries(store).length, 0); await assert.rejects(readContextSource(store, saved.catalog.id), ContextDataError); await assert.rejects(readContextSnapshot(store, snapshot.id), ContextDataError);
}));

test("historical native correction preserves predecessor bytes and invalidates old snapshot", async () => fixture(async store => {
  const first = await historicalSource(store), snapshot = await createContextSnapshot(store, await snapshotInput(store, [first.catalog])), second = await historicalSource(store, first.catalog), checked = await readContextSource(store, second.catalog.id);
  assert.equal(checked.source.version, 2); assert.equal(checked.source.previous!.recordSha256, first.catalog.recordSha256); assert((await readFile(resolve(first.catalog.directory, "record.json"))).equals(first.bytes)); assert.equal(store.contextSource(first.catalog.id)!.state.replacementId, second.catalog.id); await assert.rejects(readContextSource(store, first.catalog.id), ContextDataError); await assert.rejects(readContextSnapshot(store, snapshot.id), ContextDataError); assert.equal(contextSourceSummaries(store).length, 1);
}));

test("stale native corrections roll back without altering the winning history", async () => fixture(async store => {
  const first = await historicalSource(store), winner = await historicalSource(store, first.catalog), events = store.contextSourceEvents(first.catalog.id); await assert.rejects(historicalSource(store, first.catalog), ContextStateConflict); assert.deepEqual(store.contextSourceEvents(first.catalog.id), events); assert.equal(store.contextSource(first.catalog.id)!.state.replacementId, winner.catalog.id); assert.equal(store.recentContextSources().length, 2);
}));

test("native capture preflight requires current policy, exact query and active revision", async () => fixture(async store => {
  const saved = await historicalSource(store), input = collection(), valid = await prepareContextCaptureCorrection(store, input, saved.catalog.id, 1); assert(Object.isFrozen(valid.parent));
  for (const value of [{ ...input, countryCode: "USA" }, { ...input, years: { first: 2022, last: 2024 } }]) await assert.rejects(prepareContextCaptureCorrection(store, value, saved.catalog.id, 1), ContextStateConflict);
  await assert.rejects(prepareContextCaptureCorrection(store, input, saved.catalog.id, 2), ContextDataError); withdrawContextSource(store, saved.catalog.id, 1, "Authored withdrawal"); await assert.rejects(prepareContextCaptureCorrection(store, input, saved.catalog.id, 1), ContextDataError);
}));

test("changed raw bytes and self-rehashed false native records deny checked delivery", async () => {
  for (const change of ["raw", "input", "provenance", "capture", "future-import", "catalog-policy"]) await fixture(async store => {
    const saved = await historicalSource(store); if (change === "raw") await writeFile(resolve(saved.catalog.directory, "source.txt"), "changed");
    else if (change === "catalog-policy") editCatalog(store, saved.catalog.id, value => { delete value.recordPolicy; });
    else { const record: any = structuredClone(saved.record); if (change === "input") record.input.metadata.retrievedAt = new Date(0).toISOString(); if (change === "provenance") record.provenance.publisher = "authenticated"; if (change === "capture") record.capture.dataset.observations[0].value = 99; if (change === "future-import") record.capture.finishedAt = new Date(Date.parse(record.importedAt) + 1).toISOString(); const bytes = Buffer.from(JSON.stringify(record, null, 2) + "\n"); await writeFile(resolve(saved.catalog.directory, "record.json"), bytes); editCatalog(store, saved.catalog.id, value => { value.recordSha256 = sha256(bytes); }); }
    await assert.rejects(readContextSource(store, saved.catalog.id), ContextDataError);
  });
});

test("native source reads reject unsafe links, public permissions and oversized receipts", async () => {
  for (const change of ["symlink", "hardlink", "mode", "oversize"]) await fixture(async (store, workspace) => {
    const saved = await historicalSource(store), path = resolve(saved.catalog.directory, "record.json"); if (change === "mode") await chmod(path, 0o644); else if (change === "oversize") await writeFile(path, Buffer.alloc(64001)); else { const original = await readFile(path), other = resolve(workspace, "other.json"); await writeFile(other, original, { mode: 0o600 }); await rm(path); if (change === "symlink") await symlink(other, path); else await link(other, path); }
    await assert.rejects(readContextSource(store, saved.catalog.id), ContextDataError);
  });
});

test("current native expiry denies catalogs and snapshots but still permits administrative withdrawal", async t => fixture(async store => {
  const saved = await historicalSource(store), snapshot = await createContextSnapshot(store, await snapshotInput(store, [saved.catalog])), actual = Date.now; t.mock.method(Date, "now", () => Date.parse(saved.catalog.expiresAt) + 1);
  try { assert.equal(contextSourceSummaries(store).length, 0); assert.equal(contextSnapshotSummaries(store).length, 0); await assert.rejects(readContextSource(store, saved.catalog.id), ContextDataError); await assert.rejects(readContextSnapshot(store, snapshot.id), ContextDataError); withdrawContextSource(store, saved.catalog.id, 1, "Expired authored source"); } finally { Date.now = actual; }
}));

test("strict collection input copies authority and rejects unsupported, expired and stale fields", async () => {
  const value = collectionInput(), parsed = parseContextCollectionInput(value); value.collection.countryCode = "USA"; assert.equal(parsed.collection.countryCode, "IND"); assert(Object.isFrozen(parsed.collection.permissions));
  const invalid: unknown[] = [null, { ...collectionInput(), native: true }, { ...collectionInput(), supersedes: { sourceId: randomUUID(), expectedRevision: 2 } }];
  const expired = collectionInput(); expired.collection.permissions.expiresAt = new Date(0).toISOString(); invalid.push(expired); const forbidden = collectionInput(); (forbidden.collection.permissions as any).collect = false; invalid.push(forbidden);
  for (const candidate of invalid) assert.throws(() => parseContextCollectionInput(candidate), ContextDataError);
});

test("named collection file preserves bytes and rejects links, invalid UTF-8 and oversized inputs", async () => fixture(async (_store, workspace) => {
  const path = resolve(workspace, "input.json"), bytes = Buffer.from(JSON.stringify(collectionInput())); await writeFile(path, bytes); assert.equal((await readContextCollectionInput(path)).collection.countryCode, "IND"); assert((await readFile(path)).equals(bytes));
  const alias = resolve(workspace, "alias.json"); await symlink(path, alias); await assert.rejects(readContextCollectionInput(alias), ContextDataError); await rm(alias); await link(path, alias); await assert.rejects(readContextCollectionInput(path), ContextDataError); await rm(alias); await writeFile(path, Buffer.from([0xff])); await assert.rejects(readContextCollectionInput(path), ContextDataError); await writeFile(path, Buffer.alloc(10001)); await assert.rejects(readContextCollectionInput(path), ContextDataError);
}));

test("aborted explicit collection and missing correction create no source, task or budget", async () => fixture(async store => {
  const controller = new AbortController(); controller.abort(); await assert.rejects(collectContextSource(store, collectionInput(), controller.signal), ContextCollectionError);
  await assert.rejects(collectContextSource(store, { ...collectionInput(), supersedes: { sourceId: randomUUID(), expectedRevision: 1 } }), ContextDataError); assert.equal(store.recentContextSources().length, 0); assert.deepEqual(store.auditLog(), []); for (const name of ["context-sources", "tasks.sqlite", "budgets.sqlite", "research.sqlite"]) assert(!existsSync(resolve(store.directory, name)));
}));

test("terminal collection denies disabled, expired, malformed and missing-parent inputs before new state", async () => {
  const workspace = await mkdtemp(resolve(tmpdir(), "redteam-collect-cli-")), cli = resolve(import.meta.dirname, "../src/cli.ts"), path = resolve(workspace, "input.json");
  try { const invalid: any[] = [JSON.parse(await readFile(resolve(import.meta.dirname, "../examples/public-context-collection.input.json"), "utf8")), { ...collectionInput(), collection: { ...collection(), permissions: { ...collection().permissions, collect: false } } }, { ...collectionInput(), supersedes: { sourceId: randomUUID(), expectedRevision: 1 } }]; for (const value of invalid) { await writeFile(path, JSON.stringify(value)); assert.throws(() => execFileSync(process.execPath, [cli, "context", "sources", "collect", path], { cwd: workspace, stdio: "pipe" })); assert(!existsSync(resolve(workspace, ".redteam"))); } assert.throws(() => execFileSync(process.execPath, [cli, "context", "sources", "collect", path, "extra"], { cwd: workspace, stdio: "pipe" })); assert(!existsSync(resolve(workspace, ".redteam"))); }
  finally { await rm(workspace, { recursive: true, force: true }); }
});
