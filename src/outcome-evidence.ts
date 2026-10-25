import { randomUUID } from "node:crypto";
import { mkdir, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { EvidenceStore, sha256 } from "./evidence.ts";
import type { Artifact } from "./evidence.ts";
import { boundedBytes, checkedDirectory, checkedParents } from "./local-files.ts";
import { checkActionVersionAccess, readTrackedAction } from "./actions.ts";
import type { ActionVersionPin } from "./actions.ts";
import { readExperimentPlan } from "./experiments.ts";
import { classifyFixtureEvidence, readStoredComparison } from "./comparisons.ts";
import type { ComparisonReport } from "./comparisons.ts";
import { checkFixturePin, readFixtureEvidence } from "./browser-evidence.ts";
import type { FixtureEvidencePin } from "./browser-evidence.ts";
import type { ReviewReport } from "./domain/review.ts";
import type { WorkspaceStore } from "./workspace.ts";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/, hash = /^[a-f0-9]{64}$/;
const policyVersion = "controlled-outcome-evidence-v1";
const assessment = { scope: "controlled_local_signup_only", semanticReview: "unreviewed", protocolReview: "not_assessed", plannedIntervention: "not_verified", sampleAdequacy: "not_assessed", hypothesisResolution: "not_assessed", independentOutcomeVerification: "not_established", causalAttribution: "not_assessed", chronology: "local_clock_only" } as const;
export interface OutcomeEvidenceInput { schemaVersion: "1.0"; kind: "controlled_outcome_evidence_input"; planId: string; comparisonId: string; note?: string }
export interface OutcomeEvidenceSources {
  plan: { id: string; reportSha256: string; projectionSha256: string; catalogSha256: string };
  comparison: { id: string; reportSha256: string; projectionSha256: string; catalogSha256: string; baseline: FixtureEvidencePin; candidate: FixtureEvidencePin };
  actionVersion: ActionVersionPin; actionHistorySha256: string;
}
interface Alignment { baselineGeneratedAt: string; frozenAt: string; startsAt: string; endsAt: string; candidateCreatedAt: string; candidateExecutions: { id: string; startedAt: string; finishedAt: string }[]; candidateGeneratedAt: string; comparisonCreatedAt: string }
interface Observation { verdict: ComparisonReport["verdict"]; baselineState: ComparisonReport["baselineState"]; candidateState: ComparisonReport["candidateState"]; requirementId: string; requirementHash: string; studyHash: string }
export interface OutcomeEvidenceReport { schemaVersion: "1.0"; kind: "controlled_outcome_evidence"; policyVersion: typeof policyVersion; id: string; registeredAt: string; input: OutcomeEvidenceInput; state: "evidence_registered"; execution: "not_performed_by_tracking"; assessment: typeof assessment; observation: Observation; alignment: Alignment; sources: OutcomeEvidenceSources; artifacts: Artifact[]; limitations: string[] }
export interface OutcomeEvidenceSummary { id: string; registeredAt: string; planId: string; comparisonId: string; directory: string; reportSha256: string; sources: OutcomeEvidenceSources; verdict: Observation["verdict"] }
export interface OutcomeEvidencePin { id: string; registeredAt: string; reportSha256: string; sources: OutcomeEvidenceSources }

export function validateOutcomeEvidenceInput(value: unknown): OutcomeEvidenceInput {
  const fail = () => { throw new Error("Supply a plain controlled_outcome_evidence_input with schemaVersion, planId, comparisonId, and an optional note of 1 to 2000 characters."); };
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return fail();
  const copy: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !["schemaVersion", "kind", "planId", "comparisonId", "note"].includes(key)) return fail();
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!; if (!descriptor.enumerable || !("value" in descriptor) || typeof descriptor.value !== "string") return fail(); copy[key] = descriptor.value;
  }
  if (Object.keys(copy).length !== ("note" in copy ? 5 : 4) || copy.schemaVersion !== "1.0" || copy.kind !== "controlled_outcome_evidence_input" || typeof copy.planId !== "string" || !uuid.test(copy.planId) || typeof copy.comparisonId !== "string" || !uuid.test(copy.comparisonId)
    || "note" in copy && (typeof copy.note !== "string" || !copy.note.trim() || copy.note.length > 2000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/u.test(copy.note)) || Buffer.byteLength(JSON.stringify(copy)) > 16_384) return fail();
  return JSON.parse(JSON.stringify(copy)) as OutcomeEvidenceInput;
}
function time(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) throw new Error("Source chronology is unavailable or inconsistent.");
  const parsed = Date.parse(value); if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error("Source chronology is unavailable or inconsistent."); return parsed;
}
function validateAlignment(alignment: Alignment, at: number): void {
  const baseline = time(alignment.baselineGeneratedAt), frozen = time(alignment.frozenAt), start = time(alignment.startsAt), end = time(alignment.endsAt), created = time(alignment.candidateCreatedAt), generated = time(alignment.candidateGeneratedAt), compared = time(alignment.comparisonCreatedAt);
  if (!(baseline <= frozen && frozen < start && start <= created && created <= generated && generated <= end && generated <= compared && compared <= at) || alignment.candidateExecutions.length !== 2 || new Set(alignment.candidateExecutions.map(item => item.id)).size !== 2) throw new Error("The controlled capture does not match the frozen local-clock window and source order.");
  for (const execution of alignment.candidateExecutions) if (!(created <= time(execution.startedAt) && time(execution.startedAt) <= time(execution.finishedAt) && time(execution.finishedAt) <= generated)) throw new Error("The candidate executions are outside the frozen capture window or inconsistent.");
}
function historyHash(store: WorkspaceStore, version: ActionVersionPin): string { return sha256(JSON.stringify(store.actionEvents(version.id).slice(0, version.revision))); }
function validateCaptureChronology(report: ReviewReport): void {
  for (const execution of report.executions) {
    let previous = time(execution.startedAt); const finish = time(execution.finishedAt);
    if (!(time(report.manifest.createdAt) <= previous && previous <= finish && finish <= time(report.generatedAt))) throw new Error("Capture chronology is unavailable or inconsistent.");
    for (const observation of execution.observations) { const at = time(observation.at); if (at < previous || at > finish) throw new Error("Observation chronology is unavailable or inconsistent."); previous = at; }
  }
}
function checkSources(store: WorkspaceStore, sources: OutcomeEvidenceSources): undefined {
  if (sha256(JSON.stringify(store.experimentPlan(sources.plan.id))) !== sources.plan.catalogSha256 || sha256(JSON.stringify(store.comparison(sources.comparison.id))) !== sources.comparison.catalogSha256) throw new Error("An outcome evidence source catalog has changed.");
  checkActionVersionAccess(store, sources.actionVersion); checkFixturePin(store, sources.comparison.baseline); checkFixturePin(store, sources.comparison.candidate);
  if ([sources.comparison.baseline, sources.comparison.candidate].some(pin => store.job(pin.reviewId)?.status !== "completed")) throw new Error("Only completed controlled review jobs can support an evidence link.");
  if (historyHash(store, sources.actionVersion) !== sources.actionHistorySha256) throw new Error("The frozen action history has changed."); return undefined;
}
async function captureSources(store: WorkspaceStore, input: OutcomeEvidenceInput) {
  const plan = await readExperimentPlan(store, input.planId), comparison = await readStoredComparison(store, input.comparisonId), baseline = await readFixtureEvidence(store, comparison.baseline.reviewId), candidate = await readFixtureEvidence(store, comparison.candidate.reviewId);
  const action = await readTrackedAction(store, plan.actionVersion.id), version = action.events[plan.actionVersion.revision - 1]?.after, classification = classifyFixtureEvidence(baseline, candidate);
  if (!version || sha256(JSON.stringify(version)) !== plan.actionVersion.sha256 || !isDeepStrictEqual(baseline.pin, comparison.baseline) || !isDeepStrictEqual(candidate.pin, comparison.candidate) || classification.outcome !== "compared"
    || Object.entries(classification).some(([key, value]) => !isDeepStrictEqual(value, comparison[key as keyof ComparisonReport]))) throw new Error("Only a fully checked comparable controlled capture can be linked.");
  const origin = plan.actionVersion.origin, finding = baseline.report.findings.find(item => item.id === origin.itemId);
  if (origin.kind !== "browser_finding" || origin.runId !== baseline.pin.reviewId || origin.evidenceRunId !== baseline.pin.evidenceRunId || origin.directory !== baseline.pin.directory || origin.reportSha256 !== baseline.pin.reportSha256 || origin.access !== null
    || !finding || finding.status !== "reproduced" || finding.requirementId !== comparison.scope.requirementId || !comparison.scope.requirementId || !comparison.scope.requirementHash || !comparison.scope.studyHash) throw new Error("The plan must pin the exact baseline controlled finding and compared requirement.");
  const alignment: Alignment = { baselineGeneratedAt: baseline.report.generatedAt, frozenAt: plan.frozenAt, ...plan.plan.horizon, candidateCreatedAt: candidate.report.manifest.createdAt, candidateExecutions: candidate.report.executions.map(item => ({ id: item.id, startedAt: item.startedAt, finishedAt: item.finishedAt })), candidateGeneratedAt: candidate.report.generatedAt, comparisonCreatedAt: comparison.createdAt };
  validateAlignment(alignment, Date.now());
  if (!(time(baseline.report.generatedAt) <= time(version.createdAt) && time(version.createdAt) <= time(version.updatedAt) && time(version.updatedAt) <= time(plan.frozenAt))) throw new Error("The pinned action version must follow the baseline and precede plan freeze on the local clock.");
  validateCaptureChronology(baseline.report); validateCaptureChronology(candidate.report);
  const planCatalog = store.experimentPlan(input.planId), comparisonCatalog = store.comparison(input.comparisonId);
  if (!planCatalog || !comparisonCatalog || planCatalog.reportSha256 !== sha256(await boundedBytes(planCatalog.directory, resolve(planCatalog.directory, "report.json"), 100_000)) || comparisonCatalog.reportSha256 !== sha256(await boundedBytes(comparisonCatalog.directory, resolve(comparisonCatalog.directory, "report.json"), 200_000))) throw new Error("Source catalogs or publications changed during capture.");
  if (comparison.schemaVersion !== "1.0" || comparison.createdAt !== comparisonCatalog.createdAt || comparison.outcome !== comparisonCatalog.outcome || comparison.verdict !== comparisonCatalog.verdict || !isDeepStrictEqual(comparison.boundaries, { testsExecuted: false, modelCalls: 0, actionStatusChanged: false, causalEffectEstablished: false, sourceKind: "controlled_local_fixture" })) throw new Error("The checked comparison contract is inconsistent.");
  const sources: OutcomeEvidenceSources = { plan: { id: input.planId, reportSha256: planCatalog.reportSha256, projectionSha256: sha256(JSON.stringify(plan)), catalogSha256: sha256(JSON.stringify(planCatalog)) }, comparison: { id: input.comparisonId, reportSha256: comparisonCatalog.reportSha256, projectionSha256: sha256(JSON.stringify(comparison)), catalogSha256: sha256(JSON.stringify(comparisonCatalog)), baseline: baseline.pin, candidate: candidate.pin }, actionVersion: plan.actionVersion, actionHistorySha256: historyHash(store, plan.actionVersion) };
  checkSources(store, sources);
  const observation: Observation = { verdict: classification.verdict, baselineState: classification.baselineState, candidateState: classification.candidateState, requirementId: comparison.scope.requirementId, requirementHash: comparison.scope.requirementHash, studyHash: comparison.scope.studyHash };
  return { sources, alignment, observation };
}
export async function registerOutcomeEvidence(store: WorkspaceStore, value: unknown): Promise<OutcomeEvidenceSummary> {
  const input = validateOutcomeEvidenceInput(value);
  if (store.outcomeEvidenceFor(input.planId, input.comparisonId)) throw new Error("This plan/comparison pair is already registered. Inspect the saved record; do not retry publication.");
  const captured = await captureSources(store, input);
  const guard = async () => { if (!isDeepStrictEqual(await captureSources(store, input), captured)) throw new Error("Outcome evidence sources changed during publication."); checkSources(store, captured.sources); };
  await guard(); const state = await realpath(store.directory), output = resolve(state, "outcome-evidence"); await checkedDirectory(state);
  await mkdir(output, { mode: 0o700 }).catch(error => { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }); await checkedDirectory(output);
  const id = randomUUID(), registeredAt = new Date().toISOString(), evidence = await EvidenceStore.create(output, id); validateAlignment(captured.alignment, time(registeredAt));
  await evidence.addBytes("outcome-evidence-input", Buffer.from(JSON.stringify(input, null, 2) + "\n"), "json", "application/json");
  await evidence.addBytes("outcome-evidence-source-pins", Buffer.from(JSON.stringify(captured.sources, null, 2) + "\n"), "json", "application/json");
  const report: OutcomeEvidenceReport = { schemaVersion: "1.0", kind: "controlled_outcome_evidence", policyVersion, id, registeredAt, input, ...captured, state: "evidence_registered", execution: "not_performed_by_tracking", assessment: { ...assessment }, artifacts: evidence.artifacts,
    limitations: ["This links selected saved controlled-signup evidence to a supplied frozen plan. It runs no intervention, app, test command, model, or participant collection.", "The factual comparison verdict does not adjudicate the hypothesis, declared metric/success rule, target sample, selection, protocol, planned intervention, independent outcome, or causal effect.", "The original plan remains frozen and marked uncollected; action progress and source records are unchanged. Later legitimate action declarations do not rewrite this evidence link.", "Chronology checks use trusted local recorded clocks and metadata, not an external prospective registration, proof that outcomes were unknown, or authentication of provenance.", "Controlled local fixture evidence uses no target-access grant. Current saved source availability, action history, and all checked bytes govern retrieval. This does not authorize an external app or research source.", "The local operator, metadata, filesystem, and backups remain trusted. Source-file and permission races with later operations are not eliminated; delivered copies cannot be recalled.", "No human or population behavior, researched psychology, purchase, investment, funding probability, customer demand, commercial validity, independent human evaluation, or production readiness is established.", "Immutable publication may leave private orphan bytes if catalog insertion fails. No automatic adoption, replacement, retry, deletion, plan promotion, or action completion occurs."] };
  await guard(); await evidence.writeRecord("report.json", report); const bytes = await boundedBytes(evidence.root, resolve(evidence.root, "report.json"), 200_000); await guard();
  const summary: OutcomeEvidenceSummary = { id, registeredAt, planId: input.planId, comparisonId: input.comparisonId, directory: evidence.root, reportSha256: sha256(bytes), sources: captured.sources, verdict: captured.observation.verdict };
  store.saveOutcomeEvidence(summary, () => { checkSources(store, captured.sources); validateAlignment(captured.alignment, Date.now()); if (Date.now() < time(registeredAt)) throw new Error("Local time changed during registration."); return undefined; }); return summary;
}
export function outcomeEvidenceSummaries(store: WorkspaceStore) {
  return store.recentOutcomeEvidence().flatMap(summary => { try { checkSources(store, summary.sources); return [{ id: summary.id, registeredAt: summary.registeredAt, planId: summary.planId, comparisonId: summary.comparisonId, verdict: summary.verdict, recordStatus: "cataloged_unverified" as const }]; } catch { return []; } });
}
/** Final synchronous guard after a complete checked read; not a replacement for file verification. */
export function checkOutcomeEvidenceAccess(store: WorkspaceStore, report: OutcomeEvidenceReport): undefined {
  const id = report.id;
  if (!uuid.test(id)) throw new Error("Supply an outcome evidence UUID."); const summary = store.outcomeEvidence(id); if (!summary) throw new Error("Outcome evidence not found.");
  if (summary.reportSha256 !== sha256(JSON.stringify(report, null, 2) + "\n") || summary.planId !== report.input.planId || summary.comparisonId !== report.input.comparisonId || summary.registeredAt !== report.registeredAt || summary.verdict !== report.observation.verdict || !isDeepStrictEqual(summary.sources, report.sources)) throw new Error("The checked outcome evidence catalog changed before delivery.");
  checkSources(store, report.sources); if (Date.now() < time(report.registeredAt)) throw new Error("The record is ahead of the current local clock."); return undefined;
}
/** Current metadata/source check for a private pin produced by a complete checked read. */
export function checkOutcomeEvidencePin(store: WorkspaceStore, pin: OutcomeEvidencePin): undefined {
  const summary = store.outcomeEvidence(pin.id);
  if (!summary || summary.reportSha256 !== pin.reportSha256 || summary.registeredAt !== pin.registeredAt || !isDeepStrictEqual(summary.sources, pin.sources)) throw new Error("The pinned outcome evidence publication changed.");
  checkSources(store, pin.sources); if (Date.now() < time(pin.registeredAt)) throw new Error("The evidence pin is ahead of the current local clock."); return undefined;
}
/** Whitelist for a report returned by readOutcomeEvidence; never spread private source pins. */
export function publicOutcomeEvidence(report: OutcomeEvidenceReport) {
  const publicReviewPin = (pin: FixtureEvidencePin) => ({ reviewId: pin.reviewId, evidenceRunId: pin.evidenceRunId, reportSha256: pin.reportSha256 });
  const version = report.sources.actionVersion, origin = version.origin;
  return {
    schemaVersion: report.schemaVersion, kind: report.kind, policyVersion: report.policyVersion, id: report.id, registeredAt: report.registeredAt,
    input: { ...report.input }, state: report.state, execution: report.execution, assessment: { ...report.assessment }, observation: { ...report.observation },
    alignment: { ...report.alignment, candidateExecutions: report.alignment.candidateExecutions.map(item => ({ id: item.id, startedAt: item.startedAt, finishedAt: item.finishedAt })) },
    sources: { plan: { id: report.sources.plan.id, reportSha256: report.sources.plan.reportSha256 }, comparison: { id: report.sources.comparison.id, reportSha256: report.sources.comparison.reportSha256, baseline: publicReviewPin(report.sources.comparison.baseline), candidate: publicReviewPin(report.sources.comparison.candidate) }, actionVersion: { id: version.id, revision: version.revision, sha256: version.sha256, origin: { kind: origin.kind, runId: origin.runId, itemId: origin.itemId, evidenceRunId: origin.evidenceRunId, reportSha256: origin.reportSha256 } } },
    artifacts: report.artifacts.map(item => ({ id: item.id, owner: item.owner, mediaType: item.mediaType, bytes: item.bytes, sha256: item.sha256 })), limitations: [...report.limitations],
  };
}
export async function readOutcomeEvidence(store: WorkspaceStore, id: string): Promise<OutcomeEvidenceReport> {
  if (!uuid.test(id)) throw new Error("Supply an outcome evidence UUID."); const summary = store.outcomeEvidence(id); if (!summary) throw new Error("Outcome evidence not found."); checkSources(store, summary.sources);
  const state = await realpath(store.directory), root = resolve(state, "outcome-evidence", id); if (summary.directory !== root) throw new Error("The outcome evidence directory does not match its catalog.");
  await checkedParents(state, resolve(root, "report.json")); const bytes = await boundedBytes(root, resolve(root, "report.json"), 200_000); if (sha256(bytes) !== summary.reportSha256) throw new Error("The outcome evidence publication changed.");
  const report = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as OutcomeEvidenceReport;
  if (report.schemaVersion !== "1.0" || report.kind !== "controlled_outcome_evidence" || report.policyVersion !== policyVersion || report.id !== id || report.registeredAt !== summary.registeredAt || report.state !== "evidence_registered" || report.execution !== "not_performed_by_tracking" || !isDeepStrictEqual(report.assessment, assessment) || !isDeepStrictEqual(report.sources, summary.sources) || report.observation?.verdict !== summary.verdict || !Array.isArray(report.artifacts) || report.artifacts.length !== 2) throw new Error("The saved outcome evidence contract is invalid.");
  const input = validateOutcomeEvidenceInput(report.input); if (input.planId !== summary.planId || input.comparisonId !== summary.comparisonId) throw new Error("The saved outcome evidence source identity is invalid.");
  const captured = await captureSources(store, input); if (!isDeepStrictEqual(captured, { sources: report.sources, alignment: report.alignment, observation: report.observation })) throw new Error("The original outcome evidence sources changed."); validateAlignment(captured.alignment, time(report.registeredAt));
  const expected = new Map<string, unknown>([["outcome-evidence-input", input], ["outcome-evidence-source-pins", captured.sources]]), ids = new Set<string>(), paths = new Set<string>();
  for (const artifact of report.artifacts) {
    if (!artifact || !uuid.test(artifact.id) || ids.has(artifact.id) || typeof artifact.path !== "string" || !/^artifacts\/[a-f0-9-]{36}\.json$/.test(artifact.path) || paths.has(artifact.path) || !expected.has(artifact.owner) || artifact.mediaType !== "application/json" || !hash.test(artifact.sha256)) throw new Error("The outcome evidence artifact manifest is invalid.");
    ids.add(artifact.id); paths.add(artifact.path); const content = await boundedBytes(root, resolve(root, artifact.path), 64_000); if (content.length !== artifact.bytes || sha256(content) !== artifact.sha256 || !isDeepStrictEqual(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(content)), expected.get(artifact.owner))) throw new Error("An outcome evidence artifact changed."); expected.delete(artifact.owner);
  }
  if (expected.size) throw new Error("An outcome evidence artifact is missing.");
  if (!isDeepStrictEqual(await captureSources(store, input), captured) || Date.now() < time(report.registeredAt)) throw new Error("Outcome evidence sources or local time changed during inspection."); checkSources(store, summary.sources); return report;
}
