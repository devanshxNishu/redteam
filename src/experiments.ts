import { randomUUID } from "node:crypto";
import { mkdir, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { EvidenceStore, sha256 } from "./evidence.ts";
import type { Artifact } from "./evidence.ts";
import { boundedBytes, checkedDirectory, checkedParents } from "./local-files.ts";
import { checkActionVersionAccess, readTrackedAction } from "./actions.ts";
import type { ActionVersionPin } from "./actions.ts";
import { ActionConflictError } from "./domain/actions.ts";
import type { WorkspaceStore } from "./workspace.ts";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const day = 86_400_000;
const policyVersion = "local-experiment-plan-v1";
export interface ExperimentPlanInput {
  schemaVersion: "1.0";
  kind: "experiment_plan_input";
  actionId: string;
  expectedActionRevision: number;
  title: string;
  owner: string;
  hypothesis: string;
  intervention: string;
  outcome: { measure: string; successRule: string; collectionMethod: string };
  samplePlan: { population: string; recruitment: string; targetCount: number };
  horizon: { startsAt: string; endsAt: string };
}
export interface ExperimentPlanReport {
  schemaVersion: "1.0";
  kind: "frozen_experiment_plan";
  policyVersion: typeof policyVersion;
  id: string;
  frozenAt: string;
  plan: ExperimentPlanInput;
  actionVersion: ActionVersionPin;
  provenance: { authorship: "operator_supplied"; semanticReview: "unreviewed"; protocolReview: "not_assessed"; chronology: "local_clock_only" };
  state: "plan_frozen";
  execution: "not_started_by_tracking";
  outcomeStatus: "not_collected";
  independentOutcomeVerification: "not_assessed";
  artifacts: Artifact[];
  limitations: string[];
}
export interface ExperimentPlanSummary { id: string; frozenAt: string; title: string; owner: string; directory: string; reportSha256: string; actionVersion: ActionVersionPin }
function text(value: unknown, max: number): value is string { return typeof value === "string" && value.trim().length > 0 && value.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/u.test(value); }
function exact(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key))) throw new Error("Experiment plan fields are missing or unsupported.");
}
// Accept plain JSON data without invoking accessor properties or toJSON methods.
function plainInput(value: unknown): unknown {
  let nodes = 0; const seen = new WeakSet<object>();
  function copy(item: unknown, depth: number): unknown {
    if (++nodes > 200 || depth > 5) throw new Error();
    if (typeof item === "string" && Buffer.byteLength(item) > 32_768) throw new Error();
    if (item === null || typeof item === "string" || typeof item === "boolean" || typeof item === "number" && Number.isFinite(item)) return item;
    if (!item || typeof item !== "object" || Array.isArray(item) || seen.has(item) || ![Object.prototype, null].includes(Object.getPrototypeOf(item))) throw new Error();
    seen.add(item); const result = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(item)) {
      if (typeof key !== "string" || ["__proto__", "constructor", "prototype"].includes(key)) throw new Error();
      const property = Object.getOwnPropertyDescriptor(item, key)!; if (!property.enumerable || !("value" in property)) throw new Error();
      result[key] = copy(property.value, depth + 1);
    }
    return result;
  }
  try { const serialized = JSON.stringify(copy(value, 0)); if (Buffer.byteLength(serialized) > 32_768) throw new Error(); return JSON.parse(serialized); }
  catch { throw new Error("Experiment input must be plain JSON no larger than 32 KiB."); }
}
function validTime(value: unknown): value is string { if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false; const time = Date.parse(value); return Number.isFinite(time) && new Date(time).toISOString() === value; }
export function validateExperimentPlan(value: unknown): ExperimentPlanInput {
  const input = plainInput(value); exact(input, ["schemaVersion", "kind", "actionId", "expectedActionRevision", "title", "owner", "hypothesis", "intervention", "outcome", "samplePlan", "horizon"]);
  exact(input.outcome, ["measure", "successRule", "collectionMethod"]); exact(input.samplePlan, ["population", "recruitment", "targetCount"]); exact(input.horizon, ["startsAt", "endsAt"]);
  if (input.schemaVersion !== "1.0" || input.kind !== "experiment_plan_input" || typeof input.actionId !== "string" || !uuid.test(input.actionId) || !Number.isSafeInteger(input.expectedActionRevision) || Number(input.expectedActionRevision) < 1 || Number(input.expectedActionRevision) > 100
    || !text(input.title, 200) || !text(input.owner, 120) || !text(input.hypothesis, 2000) || !text(input.intervention, 2000)
    || !text(input.outcome.measure, 1000) || !text(input.outcome.successRule, 1000) || !text(input.outcome.collectionMethod, 2000) || !text(input.samplePlan.population, 1000) || !text(input.samplePlan.recruitment, 1000)
    || !Number.isSafeInteger(input.samplePlan.targetCount) || Number(input.samplePlan.targetCount) < 1 || Number(input.samplePlan.targetCount) > 100_000) throw new Error("Experiment scope, action revision, or supplied plan text is invalid.");
  if (!validTime(input.horizon.startsAt) || !validTime(input.horizon.endsAt) || Date.parse(input.horizon.endsAt) <= Date.parse(input.horizon.startsAt) || Date.parse(input.horizon.endsAt) - Date.parse(input.horizon.startsAt) > 366 * day) throw new Error("Use a canonical UTC planned window longer than zero and no longer than 366 days.");
  return input as unknown as ExperimentPlanInput;
}
function prospectiveWindow(plan: ExperimentPlanInput): void {
  const start = Date.parse(plan.horizon.startsAt), now = Date.now();
  if (start <= now || start - now > 730 * day) throw new Error("The planned window must start after freeze and within 730 days on the local clock.");
}
export async function freezeExperimentPlan(store: WorkspaceStore, value: unknown): Promise<ExperimentPlanSummary> {
  const plan = validateExperimentPlan(value); prospectiveWindow(plan);
  const action = (await readTrackedAction(store, plan.actionId)).record;
  if (action.revision !== plan.expectedActionRevision) throw new ActionConflictError("The action changed. Read its current revision before freezing a plan.");
  const actionVersion: ActionVersionPin = { id: action.id, revision: action.revision, sha256: sha256(JSON.stringify(action)), origin: action.origin };
  const authorize = () => { prospectiveWindow(plan); return checkActionVersionAccess(store, actionVersion, true); };
  const guard = async () => { const checked = await readTrackedAction(store, action.id); if (!isDeepStrictEqual(checked.record, action)) throw new ActionConflictError("The action changed during plan publication."); authorize(); };
  await guard(); const state = await realpath(store.directory), output = resolve(state, "experiments"); await checkedDirectory(state);
  await mkdir(output, { mode: 0o700 }).catch(error => { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }); await checkedDirectory(output);
  const id = randomUUID(), frozenAt = new Date().toISOString(), evidence = await EvidenceStore.create(output, id);
  await evidence.addBytes("experiment-plan-input", Buffer.from(JSON.stringify(plan, null, 2) + "\n"), "json", "application/json");
  await evidence.addBytes("frozen-action-version", Buffer.from(JSON.stringify(action, null, 2) + "\n"), "json", "application/json");
  const report: ExperimentPlanReport = { schemaVersion: "1.0", kind: "frozen_experiment_plan", policyVersion, id, frozenAt, plan, actionVersion, provenance: { authorship: "operator_supplied", semanticReview: "unreviewed", protocolReview: "not_assessed", chronology: "local_clock_only" }, state: "plan_frozen", execution: "not_started_by_tracking", outcomeStatus: "not_collected", independentOutcomeVerification: "not_assessed", artifacts: evidence.artifacts,
    limitations: ["This record freezes a supplied plan and a historical action revision. It does not execute an intervention, recruit participants, collect outcomes, or verify a result.", "Population, sample size, method, success rule, hypothesis, owner, authority, and consent remain operator declarations and have no semantic or protocol approval.", "A future window and immutable local publication provide local ordering only. They cannot prove that outcomes were unknown, that a study was prospective, or that an external authority registered it.", "The local clock, coordinator, metadata, and filesystem are trusted. No external timestamp, signature, power-loss guarantee, or hostile-operator protection is established.", "Current source permission and integrity govern access to this plan, its input, and its frozen action. Later declared action revisions do not rewrite this plan.", "No researched psychology, customer demand, buying choice, investment decision, funding probability, causal effect, or independent outcome is established."] };
  await guard(); await evidence.writeRecord("report.json", report); const bytes = await boundedBytes(evidence.root, resolve(evidence.root, "report.json"), 100_000); await guard();
  const summary: ExperimentPlanSummary = { id, frozenAt, title: plan.title, owner: plan.owner, directory: evidence.root, reportSha256: sha256(bytes), actionVersion };
  store.saveExperimentPlan(summary, authorize); return summary;
}
export function experimentPlanSummaries(store: WorkspaceStore) {
  return store.recentExperimentPlans().flatMap(item => { try { checkActionVersionAccess(store, item.actionVersion); return [{ id: item.id, frozenAt: item.frozenAt, title: item.title, owner: item.owner, actionId: item.actionVersion.id, actionRevision: item.actionVersion.revision, recordStatus: "cataloged_unverified" as const }]; } catch { return []; } });
}
export async function readExperimentPlan(store: WorkspaceStore, id: string): Promise<ExperimentPlanReport> {
  if (!uuid.test(id)) throw new Error("Supply an experiment plan UUID."); const summary = store.experimentPlan(id); if (!summary) throw new Error("Experiment plan not found.");
  checkActionVersionAccess(store, summary.actionVersion); const checked = await readTrackedAction(store, summary.actionVersion.id), version = checked.events[summary.actionVersion.revision - 1]?.after;
  if (!version || sha256(JSON.stringify(version)) !== summary.actionVersion.sha256) throw new Error("The frozen action version has changed.");
  const state = await realpath(store.directory), root = resolve(state, "experiments", id); if (summary.directory !== root) throw new Error("The plan directory does not match its catalog.");
  await checkedParents(state, resolve(root, "report.json")); const bytes = await boundedBytes(root, resolve(root, "report.json"), 100_000); if (sha256(bytes) !== summary.reportSha256) throw new Error("The frozen plan publication has changed.");
  const report = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as ExperimentPlanReport;
  if (report.schemaVersion !== "1.0" || report.kind !== "frozen_experiment_plan" || report.policyVersion !== policyVersion || report.id !== id || report.frozenAt !== summary.frozenAt || !validTime(report.frozenAt) || !isDeepStrictEqual(report.actionVersion, summary.actionVersion) || !Array.isArray(report.artifacts) || report.artifacts.length !== 2) throw new Error("The frozen plan identity is invalid.");
  const plan = validateExperimentPlan(report.plan);
  if (plan.actionId !== summary.actionVersion.id || plan.expectedActionRevision !== summary.actionVersion.revision || plan.title !== summary.title || plan.owner !== summary.owner || Date.parse(plan.horizon.startsAt) <= Date.parse(report.frozenAt) || Date.parse(plan.horizon.startsAt) - Date.parse(report.frozenAt) > 730 * day
    || report.state !== "plan_frozen" || report.execution !== "not_started_by_tracking" || report.outcomeStatus !== "not_collected" || report.independentOutcomeVerification !== "not_assessed" || !isDeepStrictEqual(report.provenance, { authorship: "operator_supplied", semanticReview: "unreviewed", protocolReview: "not_assessed", chronology: "local_clock_only" })) throw new Error("The saved plan contract is invalid.");
  const expected = new Map<string, unknown>([["experiment-plan-input", plan], ["frozen-action-version", version]]), ids = new Set<string>(), paths = new Set<string>();
  for (const artifact of report.artifacts) {
    if (!artifact || typeof artifact.id !== "string" || !uuid.test(artifact.id) || ids.has(artifact.id) || typeof artifact.path !== "string" || !/^artifacts\/[a-f0-9-]{36}\.json$/.test(artifact.path) || paths.has(artifact.path) || !expected.has(artifact.owner) || artifact.mediaType !== "application/json" || !/^[a-f0-9]{64}$/.test(artifact.sha256)) throw new Error("The saved plan artifact manifest is invalid.");
    ids.add(artifact.id); paths.add(artifact.path); const content = await boundedBytes(root, resolve(root, artifact.path), 64_000);
    if (content.length !== artifact.bytes || sha256(content) !== artifact.sha256 || !isDeepStrictEqual(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(content)), expected.get(artifact.owner))) throw new Error("A frozen plan artifact has changed."); expected.delete(artifact.owner);
  }
  if (expected.size) throw new Error("A frozen plan artifact is missing.");
  await readTrackedAction(store, summary.actionVersion.id); checkActionVersionAccess(store, summary.actionVersion); return report;
}
