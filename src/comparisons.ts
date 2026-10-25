import { randomUUID } from "node:crypto";
import { mkdir, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { EvidenceStore, sha256 } from "./evidence.ts";
import type { Artifact } from "./evidence.ts";
import { boundedBytes, checkedDirectory, checkedParents } from "./local-files.ts";
import { readFixtureEvidence, checkFixturePin } from "./browser-evidence.ts";
import type { FixtureEvidence, FixtureEvidencePin } from "./browser-evidence.ts";
import { parseStudy } from "./domain/study.ts";
import { assertSignupContract } from "./fixture.ts";
import type { WorkspaceStore } from "./workspace.ts";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const hash = /^[a-f0-9]{64}$/;
const policyVersion = "controlled-signup-comparison-v1";
type ObservedState = "requirement_passed" | "mismatch_reproduced" | "unknown";
export type ComparisonVerdict = "mismatch_not_observed_in_candidate" | "mismatch_observed_in_candidate" | "requirement_passed_in_both" | "mismatch_reproduced_in_both" | "changed_observation_same_build" | "not_comparable";
interface Assessment { state: ObservedState; reasons: string[]; studyHash: string; requirementId: string; requirementHash: string; buildHash: string; runtime: string; browser: string; generatedAt: number; executionIds: string[]; snapshotIds: string[] }
export interface ComparisonReport {
  schemaVersion: "1.0";
  kind: "controlled_fixture_comparison";
  policyVersion: typeof policyVersion;
  id: string;
  createdAt: string;
  baseline: FixtureEvidencePin;
  candidate: FixtureEvidencePin;
  outcome: "compared" | "not_comparable";
  verdict: ComparisonVerdict;
  baselineState: ObservedState;
  candidateState: ObservedState;
  reasons: string[];
  scope: { requirementId: string | null; requirementHash: string | null; studyHash: string | null; baselineBuildHash: string | null; candidateBuildHash: string | null };
  artifacts: Artifact[];
  boundaries: { testsExecuted: false; modelCalls: 0; actionStatusChanged: false; causalEffectEstablished: false; sourceKind: "controlled_local_fixture" };
  limitations: string[];
}
export interface ComparisonSummary { id: string; createdAt: string; directory: string; reportSha256: string; baseline: FixtureEvidencePin; candidate: FixtureEvidencePin; outcome: ComparisonReport["outcome"]; verdict: ComparisonVerdict }
const validTime = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));

function assess(source: FixtureEvidence): Assessment {
  const report = source.report, manifest = report.manifest;
  const result: Assessment = { state: "unknown", reasons: [], studyHash: "", requirementId: "", requirementHash: "", buildHash: "", runtime: "", browser: "", generatedAt: NaN, executionIds: [], snapshotIds: [] };
  const reason = (value: string) => { if (!result.reasons.includes(value)) result.reasons.push(value); };
  try {
    const study = parseStudy(manifest.study); assertSignupContract(study);
    if (manifest.studyHash !== sha256(JSON.stringify(study))) reason("study_hash_mismatch");
    else result.studyHash = manifest.studyHash;
    const assertion = study.steps.at(-1); if (assertion?.operation !== "assert_text") throw new Error();
    const requirement = manifest.requirement, refs = report.artifacts.filter(item => item.id === requirement?.artifactId);
    if (!requirement || requirement.id !== "DEMO-SIGNUP-001" || !hash.test(requirement.sha256) || refs.length !== 1 || refs[0]!.owner !== "requirement" || refs[0]!.sha256 !== requirement.sha256) reason("requirement_source_mismatch");
    else {
      const bytes = source.artifactBytes.get(requirement.artifactId)!;
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (!/^Requirement ID: DEMO-SIGNUP-001$/m.test(text) || !text.includes(`\`${assertion.expected}\``)) reason("requirement_source_mismatch");
      else { result.requirementId = requirement.id; result.requirementHash = requirement.sha256; }
    }
    if (!hash.test(manifest.fixtureBuildHash)) reason("build_identity_missing"); else result.buildHash = manifest.fixtureBuildHash;
    if (!manifest.runtime || typeof manifest.runtime.node !== "string" || !manifest.runtime.node || typeof manifest.runtime.playwright !== "string" || !manifest.runtime.playwright) reason("runtime_identity_missing");
    else result.runtime = JSON.stringify([manifest.runtime.node, manifest.runtime.playwright]);
    if (!validTime(report.generatedAt) || !validTime(manifest.createdAt) || Date.parse(report.generatedAt) < Date.parse(manifest.createdAt)) reason("invalid_capture_time"); else result.generatedAt = Date.parse(report.generatedAt);
    if (!Array.isArray(report.integrityErrors) || report.integrityErrors.length || report.outcome === "limited_coverage") reason("incomplete_report");
    if (!Array.isArray(report.executions) || report.executions.length !== 2 || report.executions.filter(item => item?.role === "primary").length !== 1 || report.executions.filter(item => item?.role === "verifier").length !== 1) { reason("missing_fresh_execution_pair"); return result; }
    const verdicts: string[] = [], actuals: unknown[] = [], browsers: string[] = [];
    for (const execution of report.executions) {
      if (!execution || !uuid.test(execution.id) || typeof execution.snapshotId !== "string" || !uuid.test(execution.snapshotId)) { reason("missing_execution_or_dataset_identity"); continue; }
      result.executionIds.push(execution.id); result.snapshotIds.push(execution.snapshotId);
      if (execution.status !== "completed" || !execution.baselineReady || execution.error !== null || !Array.isArray(execution.captureErrors) || execution.captureErrors.length || !Array.isArray(execution.policyDenials) || execution.policyDenials.length) reason("incomplete_execution");
      if (execution.buildHash !== manifest.fixtureBuildHash) reason("execution_build_mismatch");
      if (typeof execution.browserVersion !== "string" || !execution.browserVersion || !["pinned_chromium", "installed_chrome"].includes(execution.browserSource ?? "")) reason("browser_identity_missing");
      else browsers.push(JSON.stringify([execution.browserVersion, execution.browserSource]));
      if (!validTime(execution.startedAt) || !validTime(execution.finishedAt) || Date.parse(execution.finishedAt) < Date.parse(execution.startedAt) || Date.parse(execution.startedAt) < Date.parse(manifest.createdAt) || Date.parse(execution.finishedAt) > Date.parse(report.generatedAt)) reason("invalid_execution_time");
      const observations = execution.observations;
      if (!Array.isArray(observations) || observations.length !== study.steps.length || observations.some((item, index) => !item || !uuid.test(item.id) || item.sequence !== index + 1 || item.operation !== study.steps[index]!.operation || item.result !== "completed") || new Set(observations.map(item => item.id)).size !== observations.length) reason("incomplete_observation_sequence");
      const recorded = execution.assertion;
      if (!recorded || recorded.expected !== assertion.expected || typeof recorded.visible !== "boolean" || (recorded.actual !== null && typeof recorded.actual !== "string") || recorded.observationId !== observations?.at(-1)?.id
        || recorded.verdict !== (recorded.visible && recorded.actual === recorded.expected ? "pass" : "fail")) reason("assertion_inconsistent");
      else { verdicts.push(recorded.verdict); actuals.push(recorded.actual); }
      if (!Array.isArray(execution.artifactIds) || new Set(execution.artifactIds).size !== execution.artifactIds.length) { reason("execution_artifact_links_invalid"); continue; }
      const artifacts = execution.artifactIds.map(id => report.artifacts.find(item => item.id === id));
      if (artifacts.some(item => !item || item.owner !== execution.id)) { reason("execution_artifact_links_invalid"); continue; }
      const screenshots = artifacts.filter(item => item?.mediaType === "image/png"), traces = artifacts.filter(item => item?.mediaType === "application/zip"), records = artifacts.filter(item => item?.mediaType === "application/json");
      if (!screenshots.length || !traces.length || records.length !== 1) reason("required_capture_missing");
      else {
        if (screenshots.some(item => !source.artifactBytes.get(item!.id)!.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) || traces.some(item => !source.artifactBytes.get(item!.id)!.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])))) reason("capture_signature_invalid");
        const saved = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(source.artifactBytes.get(records[0]!.id)!));
        if (!isDeepStrictEqual(saved, { ...execution, artifactIds: execution.artifactIds.filter(id => id !== records[0]!.id) })) reason("execution_record_mismatch");
      }
    }
    if (new Set(result.executionIds).size !== 2 || new Set(result.snapshotIds).size !== 2) reason("reused_execution_or_dataset");
    if (browsers.length !== 2 || new Set(browsers).size !== 1) reason("inconsistent_browser"); else result.browser = browsers[0]!;
    if (verdicts.length !== 2 || verdicts[0] !== verdicts[1] || !isDeepStrictEqual(actuals[0], actuals[1])) reason("within_run_disagreement");
    else if (verdicts[0] === "pass") {
      if (report.findings.length || report.outcome !== "completed") reason("finding_assertion_mismatch"); else result.state = "requirement_passed";
    } else {
      const finding = report.findings[0], primary = report.executions.find(item => item.role === "primary")!, verifier = report.executions.find(item => item.role === "verifier")!;
      if (report.findings.length !== 1 || report.outcome !== "findings_found" || finding?.type !== "observed_requirement_mismatch" || finding.status !== "reproduced" || finding.requirementId !== result.requirementId || finding.primaryExecutionId !== primary.id || finding.verifierExecutionId !== verifier.id) reason("finding_assertion_mismatch");
      else result.state = "mismatch_reproduced";
    }
  } catch { reason("unsupported_or_invalid_capture"); }
  return result;
}

function classify(baseline: FixtureEvidence, candidate: FixtureEvidence) {
  const a = assess(baseline), b = assess(candidate), reasons = [...a.reasons.map(value => `baseline:${value}`), ...b.reasons.map(value => `candidate:${value}`)];
  if (baseline.pin.evidenceRunId === candidate.pin.evidenceRunId || new Set([...a.executionIds, ...b.executionIds]).size !== 4 || new Set([...a.snapshotIds, ...b.snapshotIds]).size !== 4) reasons.push("saved_runs_are_not_distinct");
  if (!a.studyHash || a.studyHash !== b.studyHash) reasons.push("study_scope_changed");
  if (!a.requirementId || a.requirementId !== b.requirementId || a.requirementHash !== b.requirementHash) reasons.push("requirement_changed_or_missing");
  if (!a.runtime || a.runtime !== b.runtime || !a.browser || a.browser !== b.browser) reasons.push("recorded_instrumentation_changed_or_missing");
  if (!Number.isFinite(a.generatedAt) || !Number.isFinite(b.generatedAt) || b.generatedAt < a.generatedAt) reasons.push("candidate_time_precedes_baseline_or_is_invalid");
  let verdict: ComparisonVerdict = "not_comparable";
  if (!reasons.length) {
    if (a.state !== b.state && a.buildHash === b.buildHash) verdict = "changed_observation_same_build";
    else if (a.state === "mismatch_reproduced" && b.state === "requirement_passed") verdict = "mismatch_not_observed_in_candidate";
    else if (a.state === "requirement_passed" && b.state === "mismatch_reproduced") verdict = "mismatch_observed_in_candidate";
    else if (a.state === "requirement_passed" && b.state === "requirement_passed") verdict = "requirement_passed_in_both";
    else if (a.state === "mismatch_reproduced" && b.state === "mismatch_reproduced") verdict = "mismatch_reproduced_in_both";
    else reasons.push("observation_state_unknown");
  }
  return { outcome: reasons.length ? "not_comparable" as const : "compared" as const, verdict, baselineState: a.state, candidateState: b.state, reasons,
    scope: { requirementId: a.requirementId && a.requirementId === b.requirementId ? a.requirementId : null, requirementHash: a.requirementHash && a.requirementHash === b.requirementHash ? a.requirementHash : null, studyHash: a.studyHash && a.studyHash === b.studyHash ? a.studyHash : null, baselineBuildHash: a.buildHash || null, candidateBuildHash: b.buildHash || null } };
}

export async function createStoredComparison(store: WorkspaceStore, value: unknown): Promise<ComparisonSummary> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 2 || Object.keys(value).some(key => !["baselineReviewId", "candidateReviewId"].includes(key))) throw new Error("Supply exactly baselineReviewId and candidateReviewId.");
  const input = value as { baselineReviewId: unknown; candidateReviewId: unknown };
  if (typeof input.baselineReviewId !== "string" || !uuid.test(input.baselineReviewId) || typeof input.candidateReviewId !== "string" || !uuid.test(input.candidateReviewId) || input.baselineReviewId === input.candidateReviewId) throw new Error("Supply two different controlled review/job UUIDs.");
  const baseline = await readFixtureEvidence(store, input.baselineReviewId), candidate = await readFixtureEvidence(store, input.candidateReviewId), classification = classify(baseline, candidate);
  const assertPins = () => { checkFixturePin(store, baseline.pin); checkFixturePin(store, candidate.pin); return undefined; };
  const guard = async () => {
    for (const pin of [baseline.pin, candidate.pin]) if (!isDeepStrictEqual((await readFixtureEvidence(store, pin.reviewId)).pin, pin)) throw new Error("Comparison source evidence changed during publication.");
    assertPins();
  };
  await guard(); const state = await realpath(store.directory), output = resolve(state, "comparisons"); await checkedDirectory(state);
  await mkdir(output, { mode: 0o700 }).catch(error => { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }); await checkedDirectory(output);
  const id = randomUUID(), createdAt = new Date().toISOString(), evidence = await EvidenceStore.create(output, id);
  const sourceRefs = { policyVersion, baseline: baseline.pin, candidate: candidate.pin };
  await evidence.addBytes("comparison-source-pins", Buffer.from(JSON.stringify(sourceRefs, null, 2) + "\n"), "json", "application/json");
  const report: ComparisonReport = { schemaVersion: "1.0", kind: "controlled_fixture_comparison", policyVersion, id, createdAt, baseline: baseline.pin, candidate: candidate.pin, ...classification, artifacts: evidence.artifacts,
    boundaries: { testsExecuted: false, modelCalls: 0, actionStatusChanged: false, causalEffectEstablished: false, sourceKind: "controlled_local_fixture" },
    limitations: ["Only saved controlled signup fixture evidence is compared. No test, app code, or model is executed by comparison.", "A mismatch absent in the candidate is limited to this captured requirement and fresh execution pair. It does not establish a causal fix or wider app quality.", "Action progress remains an operator declaration and is not upgraded by this comparison.", "Artifact hashes and capture consistency rely on trusted local metadata, not signatures or independent human adjudication.", "Recorded clocks, runtimes, browser versions, scope, coverage, and source availability constrain comparison. Unrecorded environment differences remain unknown.", "No human psychology, customer demand, investment decision, funding probability, commercial validation, or real deployment is established."] };
  await guard(); await evidence.writeRecord("report.json", report); const bytes = await boundedBytes(evidence.root, resolve(evidence.root, "report.json"), 200_000); await guard();
  const summary: ComparisonSummary = { id, createdAt, directory: evidence.root, reportSha256: sha256(bytes), baseline: baseline.pin, candidate: candidate.pin, outcome: report.outcome, verdict: report.verdict };
  store.saveComparison(summary, assertPins); return summary;
}

export function comparisonSummaries(store: WorkspaceStore) {
  return store.recentComparisons().flatMap(summary => { try { checkFixturePin(store, summary.baseline); checkFixturePin(store, summary.candidate); return [{ id: summary.id, createdAt: summary.createdAt, baselineReviewId: summary.baseline.reviewId, candidateReviewId: summary.candidate.reviewId, outcome: summary.outcome, verdict: summary.verdict, recordStatus: "cataloged_unverified" }]; } catch { return []; } });
}
export async function readStoredComparison(store: WorkspaceStore, id: string): Promise<ComparisonReport> {
  if (!uuid.test(id)) throw new Error("Supply a comparison UUID."); const summary = store.comparison(id); if (!summary) throw new Error("Comparison not found.");
  checkFixturePin(store, summary.baseline); checkFixturePin(store, summary.candidate);
  const state = await realpath(store.directory), root = resolve(state, "comparisons", id); if (root !== summary.directory) throw new Error("Comparison directory does not match its catalog.");
  await checkedParents(state, resolve(root, "report.json")); const bytes = await boundedBytes(root, resolve(root, "report.json"), 200_000); if (sha256(bytes) !== summary.reportSha256) throw new Error("Comparison publication has changed.");
  const report = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as ComparisonReport;
  if (report.kind !== "controlled_fixture_comparison" || report.id !== id || report.policyVersion !== policyVersion || !isDeepStrictEqual(report.baseline, summary.baseline) || !isDeepStrictEqual(report.candidate, summary.candidate) || !Array.isArray(report.artifacts) || report.artifacts.length !== 1) throw new Error("Comparison identity or source pins are invalid.");
  const artifact = report.artifacts[0]!; if (!artifact || typeof artifact.path !== "string" || !/^artifacts\/[a-f0-9-]{36}\.json$/.test(artifact.path)) throw new Error("Comparison source artifact path is invalid.");
  const content = await boundedBytes(root, resolve(root, artifact.path), 64_000); if (content.length !== artifact.bytes || sha256(content) !== artifact.sha256 || !isDeepStrictEqual(JSON.parse(content.toString("utf8")), { policyVersion, baseline: report.baseline, candidate: report.candidate })) throw new Error("Comparison source manifest has changed.");
  for (const pin of [report.baseline, report.candidate]) if (!isDeepStrictEqual((await readFixtureEvidence(store, pin.reviewId)).pin, pin)) throw new Error("The original comparison source has changed.");
  checkFixturePin(store, summary.baseline); checkFixturePin(store, summary.candidate); return report;
}
