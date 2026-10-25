import { realpath } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { boundedBytes } from "./local-files.ts";
import { sha256 } from "./evidence.ts";
import { readReviewBrief, checkReviewBriefAccess } from "./review-briefs.ts";
import type { ReviewBrief, ReviewBriefSummary } from "./review-briefs.ts";
import type { WorkspaceStore } from "./workspace.ts";

const policyVersion = "brief-analysis-v1";
const tracks = ["product", "engineering", "customer_buyer", "commercial", "investor_preparation", "verification"] as const;
type Track = typeof tracks[number];
const limits = Object.freeze({ maxPacketBytes: 100_000, maxFields: 80, maxResponseBytes: 32_768, maxConcerns: 12, maxCitationsPerConcern: 6 });
const boundaries = Object.freeze({ coverage: "single_supplied_brief_only", appExecution: "not_performed", stakeholderDecisions: "not_performed", referencesOpened: false, toolCalls: 0, modelCalls: 0, semanticReview: "unreviewed", researchValidity: "not_established" } as const);
const limitations = Object.freeze(["Packet fields are supplied claims, assumptions, explicit unknowns or unopened references. Their existence and hashes do not establish truth.", "No external facts, actual app observations or unrelated local fixture evidence are added. A claimed app needs an established target/build/journey/requirement association before evidence can support it.", "A response check covers structure and references only. Free text can still contain incorrect reasoning or unsupported predictions; semantic review and evaluation remain separate.", "No model, tool, URL/file-reference load, grant, new job, action, experiment, purchase or investment decision occurs. Byte bounds are not token, cost or time budgets.", "Supplied text can contain private information. Local operator, metadata, clock, filesystem, copies and backups remain trusted boundaries; these hashes provide no external attestation."]);
export interface PacketField { readonly id: string; readonly state: "supplied_text" | "explicit_unknown" | "empty_list"; readonly provenance: "operator_supplied_unverified" | "supplied_reference_unopened"; readonly value: string | null; readonly sha256: string }
export interface AnalyticalPacket { readonly schemaVersion: "1.0"; readonly kind: "analytical_review_packet"; readonly policyVersion: typeof policyVersion; readonly brief: Readonly<{ id: string; policyVersion: ReviewBrief["policyVersion"]; createdAt: string; subjectType: ReviewBrief["input"]["subjectType"]; reportSha256: string; inputSha256: string }>; readonly fields: readonly PacketField[]; readonly boundaries: typeof boundaries; readonly limits: typeof limits; readonly limitations: readonly string[]; readonly packetSha256: string }
interface Citation { fieldId: string; fieldSha256: string }
interface Concern { id: string; track: Track; type: "assumption_risk" | "evidence_gap" | "consistency_question"; statement: string; basis: Citation[]; whyItMatters: string; priority: "now" | "next" | "later"; priorityReason: string; nextCheck: { question: string; method: string; successRule: string; protocolStatus: "unreviewed" } }
export interface AnalyticalResponse { schemaVersion: "1.0"; kind: "analytical_review_response"; mode: "analytical_only"; reviewStatus: "unreviewed"; briefId: string; packetSha256: string; concerns: Concern[]; abstention: string | null }

function packetFor(report: ReviewBrief, summary: ReviewBriefSummary): AnalyticalPacket {
  const fields: PacketField[] = [];
  const add = (id: string, value: string | null, empty = false, reference = false) => {
    const field = { id, state: empty ? "empty_list" as const : value === null ? "explicit_unknown" as const : "supplied_text" as const, provenance: reference ? "supplied_reference_unopened" as const : "operator_supplied_unverified" as const, value };
    fields.push(Object.freeze({ ...field, sha256: sha256(JSON.stringify(field)) }));
  };
  add("/subjectType", report.input.subjectType); add("/title", report.input.title); add("/decision", report.input.decision);
  for (const [key, value] of Object.entries(report.input.audience)) add(`/audience/${key}`, value);
  for (const [key, value] of Object.entries(report.input.subjectType === "idea" ? report.input.idea : report.input.app)) add(`/${report.input.subjectType}/${key}`, value, false, key === "url");
  for (const key of ["assumptions", "unknowns"] as const) { const values = report.input[key]; if (!values.length) add(`/${key}`, null, true); else values.forEach((value, index) => add(`/${key}/${index}`, value)); }
  if (!report.input.suppliedEvidence.length) add("/suppliedEvidence", null, true);
  else report.input.suppliedEvidence.forEach((item, index) => { for (const [key, value] of Object.entries(item)) add(`/suppliedEvidence/${index}/${key}`, value, false, key === "reference"); });
  if (fields.length > limits.maxFields) throw new Error("The analytical packet exceeds its field bound.");
  const base: Omit<AnalyticalPacket, "packetSha256"> = { schemaVersion: "1.0" as const, kind: "analytical_review_packet" as const, policyVersion, brief: Object.freeze({ id: report.id, policyVersion: report.policyVersion, createdAt: report.createdAt, subjectType: report.input.subjectType, reportSha256: summary.reportSha256, inputSha256: report.inputSha256 }), fields: Object.freeze(fields), boundaries, limits, limitations };
  const packet: AnalyticalPacket = Object.freeze({ ...base, packetSha256: sha256(JSON.stringify(base)) });
  if (Buffer.byteLength(JSON.stringify(packet, null, 2) + "\n") > limits.maxPacketBytes) throw new Error("The complete analytical packet exceeds 100,000 bytes; no fields were silently omitted.");
  return packet;
}
export async function readAnalyticalPacket(store: WorkspaceStore, id: string): Promise<AnalyticalPacket> {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) throw new Error("Supply a review brief UUID.");
  const summary = store.reviewBrief(id); if (!summary) throw new Error("Review brief unavailable.");
  const report = await readReviewBrief(store, id), packet = packetFor(report, summary); checkReviewBriefAccess(store, report, summary); return packet;
}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error("Analytical responses require plain data objects.");
  const descriptors = Object.getOwnPropertyDescriptors(value), names = Reflect.ownKeys(descriptors);
  if (names.length !== keys.length || names.some(name => typeof name !== "string" || !keys.includes(name))) throw new Error("Analytical response fields are missing or unsupported.");
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) { const field = descriptors[key]!; if (!field.enumerable || !("value" in field)) throw new Error("Analytical response fields must contain data properties only."); result[key] = field.value; }
  return result;
}
function text(value: unknown, max: number): string { if (typeof value !== "string" || !value.trim() || value.length > max || /[\x00-\x08\x0b-\x1f\x7f-\x9f]/u.test(value)) throw new Error(`Analytical text must be nonblank and at most ${max} characters without unsupported controls.`); return value; }
function array<T>(value: unknown, min: number, max: number, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) throw new Error("Analytical response lists must be plain arrays.");
  const descriptors = Object.getOwnPropertyDescriptors(value), length = Object.getOwnPropertyDescriptor(value, "length")!.value as number;
  if (length < min || length > max || Reflect.ownKeys(descriptors).length !== length + 1) throw new Error("Analytical response list bounds or fields are invalid.");
  const result: T[] = []; for (let index = 0; index < length; index++) { const item = descriptors[String(index)]; if (!item?.enumerable || !("value" in item)) throw new Error("Analytical lists must contain data properties only."); result.push(parse(item.value)); } return result;
}
/** The packet must come from readAnalyticalPacket. This is not an external packet authenticity check. */
export function validateAnalyticalResponse(value: unknown, packet: AnalyticalPacket) {
  const input = object(value, ["schemaVersion", "kind", "mode", "reviewStatus", "briefId", "packetSha256", "concerns", "abstention"]);
  if (input.schemaVersion !== "1.0" || input.kind !== "analytical_review_response" || input.mode !== "analytical_only" || input.reviewStatus !== "unreviewed" || input.briefId !== packet.brief.id || input.packetSha256 !== packet.packetSha256) throw new Error("The analytical response type, scope or packet identity is invalid.");
  const ids = new Set<string>();
  const concerns = array(input.concerns, 0, limits.maxConcerns, value => {
    const item = object(value, ["id", "track", "type", "statement", "basis", "whyItMatters", "priority", "priorityReason", "nextCheck"]);
    if (typeof item.id !== "string" || !/^C[0-9]{2}$/.test(item.id) || ids.has(item.id) || !tracks.includes(item.track as Track) || !["assumption_risk", "evidence_gap", "consistency_question"].includes(item.type as string) || !["now", "next", "later"].includes(item.priority as string)) throw new Error("The analytical concern identity, type, track or priority is invalid."); ids.add(item.id);
    const cited = new Set<string>(), basis = array(item.basis, 1, limits.maxCitationsPerConcern, value => {
      const citation = object(value, ["fieldId", "fieldSha256"]), field = packet.fields.find(field => field.id === citation.fieldId);
      if (!field || field.sha256 !== citation.fieldSha256 || cited.has(field.id)) throw new Error("An analytical citation is unknown, changed or duplicated."); cited.add(field.id); return { fieldId: field.id, fieldSha256: field.sha256 };
    }), next = object(item.nextCheck, ["question", "method", "successRule", "protocolStatus"]);
    if (next.protocolStatus !== "unreviewed") throw new Error("A proposed check cannot approve its own protocol.");
    return { id: item.id, track: item.track as Track, type: item.type as Concern["type"], statement: text(item.statement, 1000), basis, whyItMatters: text(item.whyItMatters, 1000), priority: item.priority as Concern["priority"], priorityReason: text(item.priorityReason, 500), nextCheck: { question: text(next.question, 1000), method: text(next.method, 1000), successRule: text(next.successRule, 1000), protocolStatus: "unreviewed" as const } };
  });
  const abstention = input.abstention === null ? null : text(input.abstention, 1000); if (!concerns.length && abstention === null) throw new Error("An empty analytical response must state why it abstained; it cannot mean no issues.");
  const response: AnalyticalResponse = { schemaVersion: "1.0", kind: "analytical_review_response", mode: "analytical_only", reviewStatus: "unreviewed", briefId: packet.brief.id, packetSha256: packet.packetSha256, concerns, abstention };
  if (Buffer.byteLength(JSON.stringify(response)) > limits.maxResponseBytes) throw new Error("The complete analytical response exceeds 32 KiB.");
  return { schemaVersion: "1.0" as const, kind: "analytical_response_check" as const, response, checks: { structure: "passed" as const, citations: "matched_to_supplied_fields" as const, semanticReview: "unreviewed" as const, researchValidity: "not_established" as const }, tracksNotCovered: tracks.filter(track => !concerns.some(concern => concern.track === track)), boundaries, limitations };
}
/** Reads only the explicit response JSON; no supplied reference is followed. */
export async function readAnalyticalResponseInput(file: string): Promise<unknown> {
  const path = resolve(file), root = await realpath(dirname(path)), bytes = await boundedBytes(root, resolve(root, basename(path)), limits.maxResponseBytes);
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown; } catch { throw new Error("Supply valid UTF-8 analytical response JSON within 32 KiB."); }
}
export async function checkStoredAnalyticalResponse(store: WorkspaceStore, id: string, value: unknown) {
  const packet = await readAnalyticalPacket(store, id), result = validateAnalyticalResponse(value, packet), current = await readAnalyticalPacket(store, id);
  if (current.packetSha256 !== packet.packetSha256) throw new Error("The analytical source changed during the response check."); return result;
}
