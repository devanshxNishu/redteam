import { randomUUID } from "node:crypto";
import { mkdir, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { EvidenceStore, sha256 } from "./evidence.ts";
import type { Artifact } from "./evidence.ts";
import { boundedBytes, checkedDirectory, checkedParents } from "./local-files.ts";
import { readFixtureEvidence, checkFixturePin } from "./browser-evidence.ts";
import type { FixtureEvidencePin } from "./browser-evidence.ts";
import { readTrackedAction, checkActionVersionAccess } from "./actions.ts";
import type { ActionVersionPin } from "./actions.ts";
import { readExperimentPlan } from "./experiments.ts";
import { readStoredComparison } from "./comparisons.ts";
import { readOutcomeEvidence, publicOutcomeEvidence, checkOutcomeEvidencePin } from "./outcome-evidence.ts";
import type { OutcomeEvidencePin } from "./outcome-evidence.ts";
import type { WorkspaceStore } from "./workspace.ts";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const policyVersion = "local-record-export-v2", legacyPolicyVersion = "local-record-export-v1";
const boundaries = { sourceSemantics: "recorded_not_independently_adjudicated", testsExecuted: false, modelCalls: 0, sourceRecordsChanged: false, outcomeCollection: false, rawSourceOrResearchIncluded: false } as const;
type Kind = "review" | "action" | "experiment" | "comparison" | "outcome_evidence";
interface Item { kind: Kind; id: string }
interface ExportInput { schemaVersion: "1.0"; kind: "report_export_input"; title: string; items: Item[] }
export type ExportSourcePin = Item & { hash: string; fixture?: FixtureEvidencePin; action?: ActionVersionPin; outcome?: OutcomeEvidencePin; reviewDependencies?: string[] };
interface SourceReadBudget { maxDistinctReviews: 5; maxReviewReferences: 10; distinctReviews: number; reviewReferences: number }
interface ExportedRecord extends Item { snapshotHash: string; body: Record<string, unknown> }
export interface ReportExport {
  schemaVersion: "1.0"; kind: "local_report_export"; policyVersion: typeof policyVersion | typeof legacyPolicyVersion; id: string; createdAt: string; title: string; sourceReadBudget?: SourceReadBudget;
  sourceRefs: { kind: Kind; id: string; hash: string; actionRevision: number | null }[];
  records: ExportedRecord[]; boundaries: typeof boundaries; artifacts: Artifact[]; limitations: string[];
}
export interface ReportExportSummary { id: string; createdAt: string; title: string; directory: string; reportSha256: string; sourcePins: ExportSourcePin[]; markdownFile: string }
function dataObject(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error("Expected a plain export JSON object.");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).length !== keys.length || keys.some(key => !descriptors[key]?.enumerable || !("value" in descriptors[key]!))) throw new Error("Export fields are missing or unsupported.");
  return Object.fromEntries(keys.map(key => [key, descriptors[key]!.value]));
}
export function validateReportExportInput(value: unknown): ExportInput {
  const input = dataObject(value, ["schemaVersion", "kind", "title", "items"]);
  if (input.schemaVersion !== "1.0" || input.kind !== "report_export_input" || typeof input.title !== "string" || !input.title.trim() || input.title.length > 200 || /[\x00-\x1f\x7f-\x9f]/u.test(input.title) || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 10) throw new Error("Supply a title and one to ten existing local records.");
  const descriptors = Object.getOwnPropertyDescriptors(input.items);
  if (Reflect.ownKeys(input.items).length !== input.items.length + 1) throw new Error("Export items must be a plain JSON array.");
  const items: Item[] = [], seen = new Set<string>();
  for (let index = 0; index < input.items.length; index++) {
    const descriptor = descriptors[String(index)]; if (!descriptor?.enumerable || !("value" in descriptor)) throw new Error("Export items must contain data properties only.");
    const item = dataObject(descriptor.value, ["kind", "id"]);
    if (typeof item.kind !== "string" || !["review", "action", "experiment", "comparison", "outcome_evidence"].includes(item.kind) || typeof item.id !== "string" || !uuid.test(item.id) || seen.has(`${item.kind}:${item.id}`)) throw new Error("Export record identities are invalid or duplicated.");
    seen.add(`${item.kind}:${item.id}`); items.push({ kind: item.kind as Kind, id: item.id });
  }
  if (items.filter(item => item.kind === "review").length > 5) throw new Error("An export can contain at most five controlled reviews.");
  return { schemaVersion: "1.0", kind: "report_export_input", title: input.title, items };
}
function pick(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("A selected record has unsupported structure.");
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const item = (value as Record<string, unknown>)[key];
    if (item !== null && typeof item !== "string" && typeof item !== "boolean" && !(typeof item === "number" && Number.isFinite(item)) || typeof item === "string" && item.length > 32_768) throw new Error("A selected record has unsupported fields.");
    result[key] = item;
  }
  return result;
}
function strings(value: unknown): string[] { if (!Array.isArray(value) || value.length > 100 || value.some(item => typeof item !== "string" || item.length > 8000)) throw new Error("Selected record text exceeds export policy."); return value; }
const originKeys = ["kind", "runId", "itemId", "evidenceRunId", "reportSha256", "sourceStatus"];
const publicRef = (pin: ExportSourcePin) => ({ kind: pin.kind, id: pin.id, hash: pin.hash, actionRevision: pin.action?.revision ?? null });

function reviewDependencies(store: WorkspaceStore, item: Item, expected?: ExportSourcePin): string[] {
  let ids: string[];
  if (item.kind === "review") ids = [item.id];
  else if (item.kind === "action" || item.kind === "experiment") {
    const origin = item.kind === "experiment" ? store.experimentPlan(item.id)?.actionVersion.origin : expected?.action ? store.actionEvents(item.id)[expected.action.revision - 1]?.after.origin : store.action(item.id)?.origin;
    if (!origin || !["browser_finding", "engineering_observation"].includes(origin.kind)) throw new Error("A selected source dependency is unavailable.");
    ids = origin.kind === "browser_finding" ? [origin.runId] : [];
  } else if (item.kind === "comparison") {
    const source = store.comparison(item.id); if (!source) throw new Error("A selected comparison dependency is unavailable."); ids = [source.baseline.reviewId, source.candidate.reviewId];
  } else if (item.kind === "outcome_evidence") {
    const source = store.outcomeEvidence(item.id); if (!source) throw new Error("A selected evidence-link dependency is unavailable."); ids = [source.sources.comparison.baseline.reviewId, source.sources.comparison.candidate.reviewId];
  } else throw new Error("Unsupported export source kind.");
  if (ids.some(id => typeof id !== "string" || !uuid.test(id))) throw new Error("A selected review dependency identity is invalid."); return ids;
}
function sourceReadBudget(store: WorkspaceStore, items: Item[], pinned = false): SourceReadBudget {
  const references = items.flatMap(item => {
    const pin = item as ExportSourcePin, ids = reviewDependencies(store, item, pinned ? pin : undefined);
    if (pinned && !isDeepStrictEqual(ids, pin.reviewDependencies)) throw new Error("An exported source dependency changed."); return ids;
  }), distinct = new Set(references).size;
  if (distinct > 5 || references.length > 10) throw new Error("Export dependencies exceed five distinct controlled reviews or ten review references, including transitive links.");
  return { maxDistinctReviews: 5, maxReviewReferences: 10, distinctReviews: distinct, reviewReferences: references.length };
}

async function capture(store: WorkspaceStore, item: Item, expected?: ExportSourcePin, transitive = false): Promise<{ pin: ExportSourcePin; record: ExportedRecord }> {
  const identity: Item = { kind: item.kind, id: item.id };
  let pin: ExportSourcePin, body: Record<string, unknown>;
  if (item.kind === "review") {
    const source = await readFixtureEvidence(store, item.id), report = source.report;
    if (!Array.isArray(report.executions) || report.executions.length > 2) throw new Error("Unsupported controlled execution coverage.");
    pin = { ...identity, hash: source.pin.reportSha256, fixture: source.pin };
    body = { ...pick(report, ["runId", "generatedAt", "outcome"]), scope: { ...pick(report.manifest, ["studyHash", "fixtureVariant", "fixtureBuildHash", "mode"]), requirement: pick(report.manifest.requirement, ["id", "sha256"]), runtime: pick(report.manifest.runtime, ["node", "playwright"]) },
      executions: report.executions.map(execution => ({ ...pick(execution, ["id", "role", "snapshotId", "status", "error", "baselineReady", "browserVersion", "browserSource", "startedAt", "finishedAt"]), assertion: execution.assertion === null ? null : pick(execution.assertion, ["observationId", "verdict", "expected", "actual", "visible"]), captureErrors: strings(execution.captureErrors), policyDenials: strings(execution.policyDenials) })),
      findings: report.findings.map(finding => pick(finding, ["id", "type", "status", "title", "requirementId", "primaryExecutionId", "verifierExecutionId", "severity", "severityBasis", "proposedAction", "businessHypothesis"])),
      artifactHashes: report.artifacts.map(artifact => pick(artifact, ["id", "owner", "mediaType", "sha256", "bytes"])), integrityErrors: strings(report.integrityErrors), limitations: strings(report.limitations) };
  } else if (item.kind === "action") {
    const checked = await readTrackedAction(store, item.id), revision = expected?.action?.revision ?? checked.record.revision, events = checked.events.slice(0, revision), record = events.at(-1)?.after;
    if (!record || record.revision !== revision) throw new Error("The selected historical action revision is unavailable.");
    const action: ActionVersionPin = { id: item.id, revision, sha256: sha256(JSON.stringify(record)), origin: record.origin };
    pin = { ...identity, hash: sha256(JSON.stringify({ record, events })), action };
    body = { record: { ...pick(record, ["id", "revision", "createdAt", "updatedAt", "title", "owner", "nextStep", "validationMethod", "status", "authorship", "verificationStatus", "execution"]), origin: pick(record.origin, originKeys) }, revisionHistory: events.map(event => ({ ...pick(event, ["revision", "at", "operation", "note"]), declaredStatus: event.after.status })), limitations: checked.limitations };
  } else if (item.kind === "experiment") {
    const report = await readExperimentPlan(store, item.id), summary = store.experimentPlan(item.id)!;
    pin = { ...identity, hash: summary.reportSha256 };
    body = { ...pick(report, ["id", "frozenAt", "state", "execution", "outcomeStatus", "independentOutcomeVerification"]), plan: report.plan, provenance: report.provenance, actionVersion: { ...pick(report.actionVersion, ["id", "revision", "sha256"]), origin: pick(report.actionVersion.origin, originKeys) }, limitations: strings(report.limitations) };
  } else if (item.kind === "comparison") {
    const report = await readStoredComparison(store, item.id), summary = store.comparison(item.id)!;
    pin = { ...identity, hash: summary.reportSha256 };
    body = { ...pick(report, ["id", "createdAt", "outcome", "verdict", "baselineState", "candidateState"]), baseline: pick(report.baseline, ["reviewId", "evidenceRunId", "reportSha256", "variant"]), candidate: pick(report.candidate, ["reviewId", "evidenceRunId", "reportSha256", "variant"]), scope: pick(report.scope, ["requirementId", "requirementHash", "studyHash", "baselineBuildHash", "candidateBuildHash"]), reasons: strings(report.reasons), boundaries: report.boundaries, limitations: strings(report.limitations) };
  } else if (item.kind === "outcome_evidence" && transitive) {
    const report = await readOutcomeEvidence(store, item.id), summary = store.outcomeEvidence(item.id)!;
    pin = { ...identity, hash: summary.reportSha256, outcome: { id: item.id, registeredAt: report.registeredAt, reportSha256: summary.reportSha256, sources: report.sources } }; body = publicOutcomeEvidence(report);
  } else throw new Error("Unsupported export source kind for this policy.");
  if (transitive) pin.reviewDependencies = reviewDependencies(store, item, expected);
  return { pin, record: { ...identity, snapshotHash: pin.hash, body } };
}
function checkPins(store: WorkspaceStore, pins: ExportSourcePin[]): undefined {
  for (const pin of pins) {
    if (pin.kind === "review") { if (!pin.fixture || pin.hash !== pin.fixture.reportSha256) throw new Error("Invalid exported review pin."); checkFixturePin(store, pin.fixture); }
    else if (pin.kind === "action") {
      if (!pin.action) throw new Error("Invalid exported action pin."); checkActionVersionAccess(store, pin.action);
      const events = store.actionEvents(pin.id).slice(0, pin.action.revision), record = events.at(-1)?.after;
      if (sha256(JSON.stringify({ record, events })) !== pin.hash) throw new Error("The exported action history changed.");
    } else if (pin.kind === "experiment") {
      const source = store.experimentPlan(pin.id); if (!source || source.reportSha256 !== pin.hash) throw new Error("The exported plan pin is unavailable."); checkActionVersionAccess(store, source.actionVersion);
    } else if (pin.kind === "comparison") {
      const source = store.comparison(pin.id); if (!source || source.reportSha256 !== pin.hash) throw new Error("The exported comparison pin is unavailable."); checkFixturePin(store, source.baseline); checkFixturePin(store, source.candidate);
    } else if (pin.kind === "outcome_evidence") {
      if (!pin.outcome || pin.outcome.id !== pin.id || pin.hash !== pin.outcome.reportSha256) throw new Error("Invalid exported outcome evidence pin."); checkOutcomeEvidencePin(store, pin.outcome);
    } else throw new Error("Unsupported exported source kind.");
    if (pin.reviewDependencies && !isDeepStrictEqual(reviewDependencies(store, pin, pin), pin.reviewDependencies)) throw new Error("An exported source dependency changed.");
  }
  return undefined;
}
function fenced(value: unknown): string { const json = JSON.stringify(value, null, 2); let length = 3; for (const match of json.matchAll(/`+/g)) length = Math.max(length, match[0].length + 1); const fence = "`".repeat(length); return `${fence}json\n${json}\n${fence}\n`; }
function markdown(id: string, createdAt: string, title: string, records: ExportedRecord[]): string {
  return `# Redteam local record report\n\nExport: ${id}\nCreated on the local clock: ${createdAt}\n\nTitle supplied by the operator:\n\n${fenced(title)}\nThis report preserves selected checked saved bytes and declared records. It runs no test or model. It establishes no new engineering, causal, research, customer, purchase, investment, funding, or commercial outcome. Source claims remain subject to their recorded limits. Delivered copies cannot be recalled.\n\n` + records.map((record, index) => `## Record ${index + 1}: ${record.kind} ${record.id}\n\nSnapshot SHA-256: ${record.snapshotHash}\n\n${fenced(record.body)}`).join("\n");
}
export async function createReportExport(store: WorkspaceStore, value: unknown): Promise<ReportExportSummary> {
  const input = validateReportExportInput(value), budget = sourceReadBudget(store, input.items), sources: Awaited<ReturnType<typeof capture>>[] = [];
  for (const item of input.items) sources.push(await capture(store, item, undefined, true));
  const pins = sources.map(source => source.pin), records = sources.map(source => source.record);
  const guard = async () => { if (!isDeepStrictEqual(sourceReadBudget(store, pins, true), budget)) throw new Error("The export dependency budget changed."); for (const source of sources) if (!isDeepStrictEqual(await capture(store, source.pin, source.pin, true), source)) throw new Error("A selected source changed during export."); checkPins(store, pins); };
  await guard(); const state = await realpath(store.directory), output = resolve(state, "report-exports"); await checkedDirectory(state);
  await mkdir(output, { mode: 0o700 }).catch(error => { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }); await checkedDirectory(output);
  const id = randomUUID(), createdAt = new Date().toISOString(), human = Buffer.from(markdown(id, createdAt, input.title, records));
  const base: Omit<ReportExport, "artifacts"> = { schemaVersion: "1.0" as const, kind: "local_report_export" as const, policyVersion, id, createdAt, title: input.title, sourceReadBudget: budget, sourceRefs: pins.map(publicRef), records, boundaries,
    limitations: ["Only the selected local controlled review, supplied action/plan, comparison, and evidence-link records are included. Missing records and stakeholders remain unassessed.", "Saved artifact integrity is checked; semantic claims and operator declarations are not independently adjudicated or promoted.", "No raw source code, session/credential store, research content, network log, image, or trace is copied automatically. Supplied text is included and can contain private information.", "Local clocks, metadata, coordinator, and filesystem are trusted. Exports are not signed, externally timestamped, or proof against a hostile local operator.", "Managed retrieval checks current source access and saved bytes. Delivered copies, unmanaged history, screenshots, and backups cannot be recalled.", "No app/model execution, intervention, recruitment, outcome collection, payment, external message, psychology calibration, purchase/investment prediction, or commercial validation occurs."] };
  if (human.length > 2_200_000 || Buffer.byteLength(JSON.stringify(base, null, 2)) > 1_990_000) throw new Error("Selected report content exceeds the bounded export size.");
  const evidence = await EvidenceStore.create(output, id); const artifact = await evidence.addBytes("human-readable-report", human, "md", "text/markdown");
  const report: ReportExport = { ...base, artifacts: evidence.artifacts }; await guard(); await evidence.writeRecord("report.json", report);
  const bytes = await boundedBytes(evidence.root, resolve(evidence.root, "report.json"), 2_000_000); await guard();
  const summary: ReportExportSummary = { id, createdAt, title: input.title, directory: evidence.root, reportSha256: sha256(bytes), sourcePins: pins, markdownFile: artifact.path };
  store.saveReportExport(summary, () => { if (!isDeepStrictEqual(sourceReadBudget(store, pins, true), budget)) throw new Error("The export dependency budget changed."); return checkPins(store, pins); }); return summary;
}
export function reportExportSummaries(store: WorkspaceStore) {
  return store.recentReportExports().flatMap(item => { try { checkPins(store, item.sourcePins); return [{ id: item.id, createdAt: item.createdAt, title: item.title, records: item.sourcePins.length, sources: item.sourcePins.map(publicRef), recordStatus: "cataloged_unverified" as const }]; } catch { return []; } });
}
export function checkReportExportAccess(store: WorkspaceStore, id: string, expected?: ReportExport): undefined {
  if (!uuid.test(id)) throw new Error("Supply a report export UUID."); const summary = store.reportExport(id); if (!summary) throw new Error("Report export not found.");
  if (expected && (summary.reportSha256 !== sha256(JSON.stringify(expected, null, 2) + "\n") || !isDeepStrictEqual(expected.sourceRefs, summary.sourcePins.map(publicRef)))) throw new Error("The checked export publication or sources changed before delivery.");
  if (summary.sourcePins.some(pin => pin.reviewDependencies !== undefined)) sourceReadBudget(store, summary.sourcePins, true);
  return checkPins(store, summary.sourcePins);
}
/** Render only a report returned by readReportExport; no filesystem content is loaded here. */
export function reportExportMarkdown(report: ReportExport): string { return markdown(report.id, report.createdAt, report.title, report.records); }
export async function readReportExport(store: WorkspaceStore, id: string): Promise<ReportExport> {
  if (!uuid.test(id)) throw new Error("Supply a report export UUID."); const summary = store.reportExport(id); if (!summary) throw new Error("Report export not found.");
  if (!Array.isArray(summary.sourcePins) || summary.sourcePins.length < 1 || summary.sourcePins.length > 10) throw new Error("The export source count is invalid."); checkPins(store, summary.sourcePins);
  const state = await realpath(store.directory), root = resolve(state, "report-exports", id); if (root !== summary.directory) throw new Error("The report export directory does not match its catalog.");
  await checkedParents(state, resolve(root, "report.json")); const bytes = await boundedBytes(root, resolve(root, "report.json"), 2_000_000); if (sha256(bytes) !== summary.reportSha256) throw new Error("The export publication has changed.");
  const report = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as ReportExport;
  if (report.schemaVersion !== "1.0" || report.kind !== "local_report_export" || ![policyVersion, legacyPolicyVersion].includes(report.policyVersion) || report.id !== id || report.createdAt !== summary.createdAt || report.title !== summary.title || !isDeepStrictEqual(report.boundaries, boundaries) || !isDeepStrictEqual(report.sourceRefs, summary.sourcePins.map(publicRef)) || !Array.isArray(report.records) || report.records.length !== summary.sourcePins.length || !Array.isArray(report.artifacts) || report.artifacts.length !== 1) throw new Error("The export contract or source references are invalid.");
  const transitive = report.policyVersion === policyVersion;
  if (transitive ? !isDeepStrictEqual(report.sourceReadBudget, sourceReadBudget(store, summary.sourcePins, true)) : report.sourceReadBudget !== undefined || summary.sourcePins.some(pin => pin.kind === "outcome_evidence" || pin.reviewDependencies !== undefined)) throw new Error("The export source dependency policy is invalid.");
  const artifact = report.artifacts[0]!;
  if (!artifact || artifact.owner !== "human-readable-report" || artifact.mediaType !== "text/markdown" || artifact.path !== summary.markdownFile || !/^artifacts\/[a-f0-9-]{36}\.md$/.test(artifact.path)) throw new Error("The export Markdown reference is invalid.");
  const human = await boundedBytes(root, resolve(root, artifact.path), 2_200_000); if (human.length !== artifact.bytes || sha256(human) !== artifact.sha256 || human.toString("utf8") !== markdown(id, report.createdAt, report.title, report.records)) throw new Error("The export Markdown has changed.");
  for (const [index, pin] of summary.sourcePins.entries()) { const source = await capture(store, pin, pin, transitive); if (!isDeepStrictEqual(source.pin, pin) || !isDeepStrictEqual(source.record, report.records[index])) throw new Error("An original exported source has changed."); }
  checkPins(store, summary.sourcePins); return report;
}
