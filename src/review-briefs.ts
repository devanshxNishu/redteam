import { randomUUID } from "node:crypto";
import { mkdir, realpath } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { boundedBytes, checkedDirectory, checkedParents } from "./local-files.ts";
import { publishExclusive } from "./publication.ts";
import { sha256 } from "./evidence.ts";
import type { WorkspaceStore } from "./workspace.ts";

const policyVersion = "review-brief-v1";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const maxInputBytes = 65_536, maxRecordBytes = 100_000;
interface Audience { users: string | null; buyers: string | null; market: string | null; language: string | null }
interface Idea { problem: string; solution: string; alternatives: string | null; valueProposition: string | null; businessModel: string | null; distribution: string | null; differentiation: string | null }
interface App { purpose: string; journey: string; expectedBehavior: string; url: string | null }
interface Common { schemaVersion: "1.0"; kind: "review_brief_input"; title: string; decision: string; audience: Audience; assumptions: string[]; suppliedEvidence: { label: string; description: string; reference: string | null }[]; unknowns: string[] }
export type ReviewBriefInput = Common & ({ subjectType: "idea"; idea: Idea } | { subjectType: "app"; app: App });
const boundaries = Object.freeze({ reviewExecuted: false, toolCalls: 0, modelCalls: 0, referencesOpened: false, accessGranted: false, stakeholderDecisions: false, researchValidated: false, demandEstablished: false } as const);
const provenance = Object.freeze({ input: "operator_supplied_unverified", evidenceReferences: "supplied_unopened_unverified", preview: "deterministic_questions_not_findings" } as const);
const limitations = Object.freeze(["This is supplied intake and a deterministic scope preview, not a completed review or independently verified evidence.", "Referenced URLs and files are stored as text. No target is fetched, credential imported, grant created, code executed, or model called.", "Customer and investor tracks contain analytical questions only. No consumer reaction, buying demand, investment decision, funding probability, or researched psychology is inferred.", "Only ideas and apps are accepted. The existing separate browser runner supports the controlled local signup fixture; arbitrary app execution remains unavailable.", "Supplied text may contain private information. Local records are plaintext, not signed or independently timestamped. Trusted local operator, metadata, clock, filesystem, copies and backups remain boundaries.", "Publication can precede a failed catalog or response. Inspect saved records before retrying; uncertain or orphan files are not automatically adopted, overwritten or deleted."]);
export interface ReviewBriefPreview { schemaVersion: "1.0"; kind: "review_scope_preview"; policyVersion: typeof policyVersion; subjectType: ReviewBriefInput["subjectType"]; title: string; decision: string; status: "not_a_review"; missingInputs: string[]; operatorUnknowns: string[]; suppliedEvidenceCount: number; assumptionCount: number; tracks: { id: string; state: "not_started"; basis: "analytical_questions_only"; questions: string[] }[]; boundaries: typeof boundaries }
export interface ReviewBrief { schemaVersion: "1.0"; kind: "review_brief"; policyVersion: typeof policyVersion; id: string; createdAt: string; state: "intake_saved"; reviewStatus: "not_started"; inputSha256: string; input: ReviewBriefInput; provenance: typeof provenance; preview: ReviewBriefPreview; boundaries: typeof boundaries; limitations: readonly string[] }
export interface ReviewBriefSummary { id: string; createdAt: string; subjectType: ReviewBriefInput["subjectType"]; title: string; inputSha256: string; directory: string; reportSha256: string }

function object(value: unknown, keys?: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error("Brief fields must be plain data objects.");
  const descriptors = Object.getOwnPropertyDescriptors(value), names = Reflect.ownKeys(descriptors);
  if (names.some(key => typeof key !== "string") || keys && (names.length !== keys.length || keys.some(key => !names.includes(key)))) throw new Error("Brief fields are missing or unsupported.");
  const data: Record<string, unknown> = Object.create(null);
  for (const name of names as string[]) { const field = descriptors[name]!; if (!field.enumerable || !("value" in field)) throw new Error("Brief fields must contain data properties only."); data[name] = field.value; }
  return data;
}
function text(value: unknown, max: number, multiline = true): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || (multiline ? /[\x00-\x08\x0b-\x1f\x7f-\x9f]/u : /[\x00-\x1f\x7f-\x9f]/u).test(value)) throw new Error(`Brief text must be nonblank and at most ${max} characters, without unsupported controls.`);
  return value;
}
const optionalText = (value: unknown, max: number, multiline = true) => value === null ? null : text(value, max, multiline);
function array<T>(value: unknown, max: number, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) throw new Error("Brief lists must be plain arrays.");
  const descriptors = Object.getOwnPropertyDescriptors(value), length = Object.getOwnPropertyDescriptor(value, "length")!.value as number;
  if (length > max || Reflect.ownKeys(descriptors).length !== length + 1) throw new Error(`Brief lists permit at most ${max} items without extra fields.`);
  const result: T[] = [];
  for (let index = 0; index < length; index++) { const item = descriptors[String(index)]; if (!item?.enumerable || !("value" in item)) throw new Error("Brief lists must contain data properties only."); result.push(parse(item.value)); }
  return result;
}
export function validateReviewBriefInput(value: unknown): ReviewBriefInput {
  const top = object(value), subjectType = top.subjectType;
  if (subjectType !== "idea" && subjectType !== "app") throw new Error("Only idea and app review briefs are supported.");
  const input = object(value, ["schemaVersion", "kind", "subjectType", "title", "decision", "audience", "assumptions", "suppliedEvidence", "unknowns", subjectType]);
  if (input.schemaVersion !== "1.0" || input.kind !== "review_brief_input") throw new Error("Supply a version 1.0 review_brief_input.");
  const audience = object(input.audience, ["users", "buyers", "market", "language"]);
  const common: Common = { schemaVersion: "1.0", kind: "review_brief_input", title: text(input.title, 200, false), decision: text(input.decision, 1000), audience: { users: optionalText(audience.users, 1000), buyers: optionalText(audience.buyers, 1000), market: optionalText(audience.market, 200, false), language: optionalText(audience.language, 100, false) }, assumptions: array(input.assumptions, 12, item => text(item, 500)), suppliedEvidence: array(input.suppliedEvidence, 10, item => { const evidence = object(item, ["label", "description", "reference"]); return { label: text(evidence.label, 160, false), description: text(evidence.description, 1000), reference: optionalText(evidence.reference, 2048, false) }; }), unknowns: array(input.unknowns, 12, item => text(item, 500)) };
  let result: ReviewBriefInput;
  if (subjectType === "idea") {
    const idea = object(input.idea, ["problem", "solution", "alternatives", "valueProposition", "businessModel", "distribution", "differentiation"]);
    result = { ...common, subjectType, idea: { problem: text(idea.problem, 2000), solution: text(idea.solution, 2000), alternatives: optionalText(idea.alternatives, 2000), valueProposition: optionalText(idea.valueProposition, 2000), businessModel: optionalText(idea.businessModel, 2000), distribution: optionalText(idea.distribution, 2000), differentiation: optionalText(idea.differentiation, 2000) } };
  } else {
    const app = object(input.app, ["purpose", "journey", "expectedBehavior", "url"]), url = optionalText(app.url, 2048, false);
    if (url !== null) { let parsed: URL; try { parsed = new URL(url); } catch { throw new Error("An app URL must be an absolute HTTP or HTTPS reference, or null."); } if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) throw new Error("An app URL must use HTTP or HTTPS without embedded credentials."); }
    result = { ...common, subjectType, app: { purpose: text(app.purpose, 2000), journey: text(app.journey, 2000), expectedBehavior: text(app.expectedBehavior, 2000), url } };
  }
  if (Buffer.byteLength(JSON.stringify(result)) > maxInputBytes) throw new Error("The complete brief exceeds 64 KiB.");
  return result;
}
function preview(input: ReviewBriefInput): ReviewBriefPreview {
  const missingInputs = Object.entries(input.audience).flatMap(([key, value]) => value === null ? [`audience.${key}`] : []);
  if (input.subjectType === "idea") for (const [key, value] of Object.entries(input.idea)) { if (value === null) missingInputs.push(`idea.${key}`); }
  else if (input.app.url === null) missingInputs.push("app.url");
  if (!input.suppliedEvidence.length) missingInputs.push("suppliedEvidence");
  const questions: Record<string, string[]> = {
    product: input.subjectType === "idea" ? ["Who has the stated problem, and what do they do now?", "Which assumption should be tested before building?"] : ["Which expected result defines this journey?", "What build, environment and access would a scoped test need?"],
    engineering: input.subjectType === "idea" ? ["Which feasibility constraint needs a prototype or expert evidence?"] : ["Which observed failure or scoped source evidence could support a finding?"],
    customer_buyer: ["What alternatives, budget, approval and payment constraints matter?", "What evidence would explain comparison, trial, rejection or delay?"],
    commercial: ["What supports acquisition, delivery, pricing, retention and cost assumptions?"],
    investor_preparation: ["Which stage, sector and mandate define the analytical investor lens?", "What proof is missing for further diligence?"],
    verification: ["Which claims have independent evidence, and which remain supplied or unknown?"]
  };
  return { schemaVersion: "1.0", kind: "review_scope_preview", policyVersion, subjectType: input.subjectType, title: input.title, decision: input.decision, status: "not_a_review", missingInputs, operatorUnknowns: input.unknowns, suppliedEvidenceCount: input.suppliedEvidence.length, assumptionCount: input.assumptions.length, tracks: Object.entries(questions).map(([id, questions]) => ({ id, state: "not_started", basis: "analytical_questions_only", questions })), boundaries };
}
export function previewReviewBrief(value: unknown): ReviewBriefPreview { return preview(validateReviewBriefInput(value)); }
function record(input: ReviewBriefInput, id: string, createdAt: string): ReviewBrief {
  return { schemaVersion: "1.0", kind: "review_brief", policyVersion, id, createdAt, state: "intake_saved", reviewStatus: "not_started", inputSha256: sha256(JSON.stringify(input)), input, provenance, preview: preview(input), boundaries, limitations };
}
function checkSummary(summary: ReviewBriefSummary): void {
  if (!summary || !uuid.test(summary.id) || !["idea", "app"].includes(summary.subjectType) || typeof summary.createdAt !== "string" || !Number.isFinite(Date.parse(summary.createdAt)) || new Date(summary.createdAt).toISOString() !== summary.createdAt || !/^[a-f0-9]{64}$/.test(summary.reportSha256) || !/^[a-f0-9]{64}$/.test(summary.inputSha256)) throw new Error("The review brief catalog is invalid.");
  text(summary.title, 200, false);
}
/** Reads only the explicitly named JSON input; references inside it are never opened. */
export async function readReviewBriefInput(file: string): Promise<ReviewBriefInput> {
  const path = resolve(file), root = await realpath(dirname(path));
  const bytes = await boundedBytes(root, resolve(root, basename(path)), maxInputBytes);
  let value: unknown; try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw new Error("The brief input must contain valid UTF-8 JSON."); }
  return validateReviewBriefInput(value);
}
export async function createReviewBrief(store: WorkspaceStore, value: unknown): Promise<ReviewBriefSummary> {
  const input = validateReviewBriefInput(value), state = await realpath(store.directory), output = resolve(state, "review-briefs"); await checkedDirectory(state);
  await mkdir(output, { mode: 0o700 }).catch(error => { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }); await checkedDirectory(output);
  const id = randomUUID(), createdAt = new Date().toISOString(), directory = resolve(output, id); await mkdir(directory, { mode: 0o700 }); await checkedDirectory(directory);
  const report = record(input, id, createdAt), bytes = Buffer.from(JSON.stringify(report, null, 2) + "\n"); if (bytes.length > maxRecordBytes) throw new Error("The saved brief exceeds its bounded size.");
  await checkedParents(state, resolve(directory, "report.json")); await publishExclusive(resolve(directory, "report.json"), bytes);
  if (!(await boundedBytes(state, resolve(directory, "report.json"), maxRecordBytes)).equals(bytes)) throw new Error("The brief changed during publication.");
  const summary: ReviewBriefSummary = { id, createdAt, subjectType: input.subjectType, title: input.title, inputSha256: report.inputSha256, directory, reportSha256: sha256(bytes) };
  store.saveReviewBrief(summary, () => { checkSummary(summary); return undefined; }); return summary;
}
export function reviewBriefSummaries(store: WorkspaceStore) {
  return store.recentReviewBriefs().flatMap(summary => { try { checkSummary(summary); return [{ id: summary.id, createdAt: summary.createdAt, subjectType: summary.subjectType, title: summary.title, inputSha256: summary.inputSha256, reportSha256: summary.reportSha256, recordStatus: "cataloged_unverified" as const, reviewStatus: "not_started" as const }]; } catch { return []; } });
}
export async function readReviewBrief(store: WorkspaceStore, id: string): Promise<ReviewBrief> {
  if (!uuid.test(id)) throw new Error("Supply a review brief UUID."); const summary = store.reviewBrief(id); if (!summary) throw new Error("Review brief not found."); checkSummary(summary);
  const state = await realpath(store.directory), root = resolve(state, "review-briefs", id); if (summary.directory !== root) throw new Error("The brief directory does not match its catalog.");
  const bytes = await boundedBytes(state, resolve(root, "report.json"), maxRecordBytes); if (sha256(bytes) !== summary.reportSha256) throw new Error("The saved brief has changed.");
  const report = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as ReviewBrief, input = validateReviewBriefInput(report.input), expected = record(input, id, summary.createdAt);
  if (summary.title !== input.title || summary.subjectType !== input.subjectType || summary.inputSha256 !== expected.inputSha256 || !isDeepStrictEqual(report, expected) || !isDeepStrictEqual(store.reviewBrief(id), summary)) throw new Error("The brief contract or catalog has changed.");
  return report;
}
