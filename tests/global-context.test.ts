import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, readdir, rm, link, symlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { assessGlobalContext, parseGlobalContextInput, readGlobalContextInput, GlobalContextError } from "../src/global-context.ts";
import type { GlobalContextInput } from "../src/global-context.ts";
import { sha256 } from "../src/evidence.ts";

function fixture(): GlobalContextInput {
  return { schemaVersion: "1.0", kind: "global_context_input", scope: { asOf: "2026-10-01T12:00:00.000Z", regions: ["in"], languages: ["en"], topics: ["software"] }, policy: { maximumRetrievalAgeHours: 24, maximumPublicationAgeHours: { news: 72, release: 168, research: 8760, dataset: 2160, forecast: 720 }, minimumDeclaredOriginsForTrend: 2 }, sources: [{ id: "source-1", originId: "origin-1", kind: "news", publisher: "Authored software fixture publisher", title: "Authored test material, no real news collected", url: "https://example.invalid/authored-source", publishedAt: "2026-10-01T09:00:00.000Z", updatedAt: "2026-10-01T10:00:00.000Z", eventAt: "2026-10-01T08:00:00.000Z", retrievedAt: "2026-10-01T11:00:00.000Z", status: "available", inspection: "declared_inspected", contentSha256: "a".repeat(64), regions: ["in"], language: "en", topics: ["software"], applicabilityBasis: "Authored scope declaration, not independently verified." }], claims: [{ id: "claim-1", kind: "reported_statement", statement: "Authored claim for metadata checks only.", sourceIds: ["source-1"], contradictionSourceIds: [] }] };
}

test("source eligibility and citations are deterministic copied frozen metadata, not verified news or truth", () => {
  const input = fixture(), original = structuredClone(input), result = assessGlobalContext(input);
  assert.equal(result.outcome, "metadata_checks_passed"); assert.equal(result.inputSha256, sha256(JSON.stringify(parseGlobalContextInput(input)))); assert.deepEqual(result.sources[0]!.reasons, []); assert.equal(result.claims[0]!.sourceChecks, "met_unreviewed"); assert.equal(result.claims[0]!.semanticReview, "unreviewed"); assert.equal(result.boundaries.currentGlobalAwareness, "not_established"); assert.equal(result.boundaries.sourceContentsRead, false); assert.equal(result.boundaries.networkRequests, 0); assert.equal(result.boundaries.stakeholderDecisions, false); assert.equal(result.boundaries.independence, "declared_origins_not_authenticated");
  assert(Object.isFrozen(result.policy.maximumPublicationAgeHours)); assert(Object.isFrozen(result.coverage[0]!.eligibleSourceIds)); input.scope.regions.push("us"); input.sources[0]!.originId = "changed"; assert.deepEqual(result.scope, original.scope); assert.equal(result.sources[0]!.originId, "origin-1"); assert.equal(assessGlobalContext(original).inputSha256, result.inputSha256);
});

test("empty supplied evidence stays unavailable with explicit cross-product coverage gaps", () => {
  const input = fixture(); input.sources = []; input.claims = []; input.scope.regions.push("us"); input.scope.languages.push("hi"); input.scope.topics.push("payments"); const result = assessGlobalContext(input);
  assert.equal(result.outcome, "no_eligible_context"); assert.equal(result.missingCoverage.length, 8); assert.equal(result.distinctEligibleDeclaredOriginGroups, 0);
});

test("fresh retrieval or update cannot make old news publication or an old event current", () => {
  for (const field of ["publishedAt", "eventAt"] as const) {
    const input = fixture(); input.sources[0]![field] = "2026-09-01T09:00:00.000Z"; const result = assessGlobalContext(input);
    assert.equal(result.outcome, "no_eligible_context"); assert(result.sources[0]!.reasons.includes(field === "publishedAt" ? "publication_too_old" : "historical_event")); assert.equal(result.claims[0]!.sourceChecks, "not_met");
  }
});

test("frozen time excludes later retrieval, publication, update and observed event data", () => {
  for (const field of ["retrievedAt", "publishedAt", "updatedAt", "eventAt"] as const) {
    const input = fixture(); input.sources[0]![field] = "2026-10-02T12:00:00.000Z";
    if (field === "publishedAt") input.sources[0]!.updatedAt = null;
    const result = assessGlobalContext(input); assert.equal(result.sources[0]!.eligibleByMetadata, false, field); assert(result.sources[0]!.reasons.some(reason => reason.includes("after_")), field);
  }
});

test("source content updated or published after its own retrieval cannot be treated as observed then", () => {
  for (const field of ["publishedAt", "updatedAt", "eventAt"] as const) {
    const input = fixture(); input.sources[0]![field] = "2026-10-01T11:30:00.000Z"; if (field === "publishedAt") input.sources[0]!.updatedAt = null;
    assert.equal(assessGlobalContext(input).sources[0]!.eligibleByMetadata, false, field);
  }
});

test("unknown publication time, uninspected, withdrawn, superseded and old retrieval records fail current eligibility", () => {
  for (const boundary of ["unknown_date", "metadata", "withdrawn", "superseded", "old_retrieval"]) {
    const input = fixture(), source = input.sources[0]!;
    if (boundary === "unknown_date") source.publishedAt = null;
    if (boundary === "metadata") { source.inspection = "metadata_only"; source.contentSha256 = null; }
    if (boundary === "withdrawn" || boundary === "superseded") source.status = boundary;
    if (boundary === "old_retrieval") { source.retrievedAt = "2026-09-29T11:00:00.000Z"; source.publishedAt = "2026-09-29T09:00:00.000Z"; source.updatedAt = null; source.eventAt = null; }
    const result = assessGlobalContext(input); assert.equal(result.outcome, "no_eligible_context", boundary); assert(result.sources[0]!.reasons.length); assert.equal(result.claims[0]!.sourceChecks, "not_met");
  }
});

test("per-kind age windows have exact inclusive boundaries and no unconfigured freshness default", () => {
  const input = fixture(); input.sources[0]!.publishedAt = "2026-09-28T12:00:00.000Z"; input.sources[0]!.eventAt = null;
  assert.equal(assessGlobalContext(input).sources[0]!.eligibleByMetadata, true); input.sources[0]!.publishedAt = "2026-09-28T11:59:59.999Z"; assert.equal(assessGlobalContext(input).sources[0]!.eligibleByMetadata, false);
  input.sources[0]!.kind = "research"; assert.equal(assessGlobalContext(input).sources[0]!.eligibleByMetadata, true);
  const missing: Record<string, unknown> = structuredClone(input.policy); delete missing.maximumPublicationAgeHours; assert.throws(() => assessGlobalContext({ ...input, policy: missing }), GlobalContextError);
});

test("country, language and topic coverage is exact and global labels do not imply every country", () => {
  const input = fixture(); input.scope.regions.push("us"); input.scope.languages.push("hi"); const result = assessGlobalContext(input);
  assert.equal(result.outcome, "partial_metadata_coverage"); assert.equal(result.missingCoverage.length, 3); assert.equal(result.coverage.find(cell => cell.region === "in" && cell.language === "en")!.eligibleSourceIds.length, 1);
  input.sources[0]!.regions = ["global"]; assert.equal(assessGlobalContext(input).outcome, "no_eligible_context");
  input.sources[0]!.regions = ["in"]; input.sources[0]!.language = null; assert.equal(assessGlobalContext(input).outcome, "no_eligible_context");
  input.sources[0]!.language = "en"; input.sources[0]!.topics = ["unrelated"]; assert.equal(assessGlobalContext(input).outcome, "no_eligible_context");
});

test("syndicated source chains cannot inflate declared origin count for a trend", () => {
  const input = fixture(); input.sources.push({ ...input.sources[0]!, id: "source-2", publisher: "Another authored publisher", url: "https://example.invalid/reprint" }); input.claims[0]!.kind = "trend_hypothesis"; input.claims[0]!.sourceIds.push("source-2");
  let result = assessGlobalContext(input); assert.equal(result.sources.filter(source => source.eligibleByMetadata).length, 2); assert.equal(result.distinctEligibleDeclaredOriginGroups, 1); assert(result.claims[0]!.reasons.includes("insufficient_declared_origins"));
  input.sources[1]!.originId = "origin-2"; result = assessGlobalContext(input); assert.equal(result.claims[0]!.sourceChecks, "met_unreviewed"); assert.equal(result.claims[0]!.trendValidity, "not_assessed"); assert.equal(result.boundaries.independence, "declared_origins_not_authenticated");
});

test("identical canonical URLs and transitive origin chains cannot inflate trend counts", () => {
  const input = fixture(); input.sources.push({ ...input.sources[0]!, id: "source-2", originId: "origin-2", url: input.sources[0]!.url + "#section" });
  input.sources.push({ ...input.sources[0]!, id: "source-3", originId: "origin-2", url: "https://example.invalid/other" });
  input.claims[0]!.kind = "trend_hypothesis"; input.claims[0]!.sourceIds = input.sources.map(source => source.id);
  const result = assessGlobalContext(input); assert.equal(result.distinctEligibleDeclaredOriginGroups, 1); assert.equal(result.claims[0]!.distinctEligibleDeclaredOriginGroups, 1); assert(result.claims[0]!.reasons.includes("insufficient_declared_origins")); assert.equal(new Set(result.sources.map(source => source.declaredOriginGroup)).size, 1);
});

test("declared contrary evidence remains a conflict even if its current eligibility fails", () => {
  const input = fixture(); input.sources.push({ ...input.sources[0]!, id: "source-2", originId: "origin-2", status: "withdrawn" }); input.claims[0]!.contradictionSourceIds.push("source-2");
  const result = assessGlobalContext(input); assert.equal(result.claims[0]!.sourceChecks, "not_met"); assert(result.claims[0]!.reasons.includes("declared_conflict_requires_review")); assert.deepEqual(result.claims[0]!.contradictionSourceIds, ["source-2"]);
});

test("forecast dates and unknown event times keep explicit labels and do not become observed outcomes", () => {
  const input = fixture(); input.sources[0]!.kind = "forecast"; input.sources[0]!.eventAt = "2027-10-01T12:00:00.000Z"; input.claims[0]!.kind = "forecast";
  const result = assessGlobalContext(input); assert.equal(result.sources[0]!.eligibleByMetadata, true); assert(result.sources[0]!.warnings.includes("forecast_not_observed_outcome")); assert.equal(result.claims[0]!.forecastAccuracy, "not_assessed");
  input.sources[0]!.eventAt = null; assert(assessGlobalContext(input).sources[0]!.warnings.includes("event_time_unknown"));
});

test("unsupported claims, unknown citations, ambiguous identity, duplicate tags and unsupported policy values are denied", () => {
  const bad: ((input: GlobalContextInput) => unknown)[] = [
    input => ({ ...input, trusted: true }), input => ({ ...input, claims: [{ ...input.claims[0], sourceIds: ["absent"] }] }),
    input => ({ ...input, claims: [{ ...input.claims[0], contradictionSourceIds: ["source-1"] }] }), input => ({ ...input, sources: [...input.sources, ...input.sources] }),
    input => ({ ...input, scope: { ...input.scope, regions: ["in", "in"] } }), input => ({ ...input, policy: { ...input.policy, minimumDeclaredOriginsForTrend: 0 } }),
    input => ({ ...input, sources: [{ ...input.sources[0], url: "file:///secret" }] }), input => ({ ...input, sources: [{ ...input.sources[0], url: "https://user:password@example.invalid/" }] }),
    input => ({ ...input, sources: [{ ...input.sources[0], contentSha256: null }] }), input => ({ ...input, claims: [{ ...input.claims[0], kind: "verified_investment_demand" }] }),
    input => ({ ...input, policy: { ...input.policy, maximumRetrievalAgeHours: NaN } })
  ]; for (const mutate of bad) assert.throws(() => assessGlobalContext(mutate(fixture())), GlobalContextError);
});

test("getters, sparse or extended arrays, oversized content and prototype fields cannot enter the metadata contract", () => {
  let getterRan = false; const input = fixture(); Object.defineProperty(input.sources[0], "title", { enumerable: true, get() { getterRan = true; return "must not run"; } }); assert.throws(() => assessGlobalContext(input), GlobalContextError); assert.equal(getterRan, false);
  for (const mutate of [(input: GlobalContextInput) => { delete input.sources[0]; }, (input: GlobalContextInput) => { Object.assign(input.sources, { instruction: "execute" }); }, (input: GlobalContextInput) => { input.claims[0]!.statement = "x".repeat(2001); }, (input: GlobalContextInput) => { Object.setPrototypeOf(input.policy, { authorized: true }); }]) { const changed = fixture(); mutate(changed); assert.throws(() => assessGlobalContext(changed), GlobalContextError); }
});

test("bounded input loading rejects linked, oversized and invalid UTF-8 files and opens no referenced URL", async t => {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-context-")), file = resolve(directory, "input.json"); let requests = 0; t.mock.method(globalThis, "fetch", async () => { requests++; throw new Error(); });
  try {
    const input = fixture(); await writeFile(file, JSON.stringify(input)); assert.deepEqual(await readGlobalContextInput(file), parseGlobalContextInput(input)); assert.equal(requests, 0);
    await symlink(file, file + ".symlink"); await assert.rejects(readGlobalContextInput(file + ".symlink"), GlobalContextError);
    await link(file, file + ".hardlink"); await assert.rejects(readGlobalContextInput(file), GlobalContextError);
    const invalid = resolve(directory, "invalid.json"); await writeFile(invalid, Buffer.from([0xff])); await assert.rejects(readGlobalContextInput(invalid), GlobalContextError); await writeFile(invalid, " ".repeat(131073)); await assert.rejects(readGlobalContextInput(invalid), GlobalContextError);
    assert.equal(requests, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("terminal assessment is usable without creating a workspace and refuses extra arguments before access", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-context-cli-")), file = resolve(directory, "input.json"), cli = resolve(import.meta.dirname, "../src/cli.ts"), input = fixture();
  try {
    await writeFile(file, JSON.stringify(input)); const before = await readFile(file), result = JSON.parse(execFileSync(process.execPath, [cli, "context", "assess", file], { cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
    assert.deepEqual(result, assessGlobalContext(input)); assert((await readFile(file)).equals(before)); assert.deepEqual(await readdir(directory), ["input.json"]); assert(!existsSync(resolve(directory, ".redteam")));
    const denied = spawnSync(process.execPath, [cli, "context", "assess", file, "--fetch"], { cwd: directory, encoding: "utf8" }); assert.equal(denied.status, 1); assert.match(denied.stderr, /Usage: redteam context assess FILE/); assert.equal(denied.stdout, ""); assert(!existsSync(resolve(directory, ".redteam")));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
