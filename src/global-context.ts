import { basename, dirname, resolve } from "node:path";
import { realpath } from "node:fs/promises";
import { boundedBytes } from "./local-files.ts";
import { sha256 } from "./evidence.ts";

const kinds = ["news", "release", "research", "dataset", "forecast"] as const;
type SourceKind = typeof kinds[number];
interface Scope { asOf: string; regions: string[]; languages: string[]; topics: string[] }
interface Source {
  id: string; originId: string; kind: SourceKind; publisher: string; title: string; url: string;
  publishedAt: string | null; updatedAt: string | null; eventAt: string | null; retrievedAt: string;
  status: "available" | "withdrawn" | "superseded"; inspection: "declared_inspected" | "metadata_only";
  contentSha256: string | null; regions: string[]; language: string | null; topics: string[]; applicabilityBasis: string;
}
interface Claim { id: string; kind: "reported_statement" | "trend_hypothesis" | "forecast" | "analyst_inference"; statement: string; sourceIds: string[]; contradictionSourceIds: string[] }
export interface GlobalContextInput {
  schemaVersion: "1.0"; kind: "global_context_input"; scope: Scope;
  policy: { maximumRetrievalAgeHours: number; maximumPublicationAgeHours: Record<SourceKind, number>; minimumDeclaredOriginsForTrend: number };
  sources: Source[]; claims: Claim[];
}
export class GlobalContextError extends Error { constructor() { super("Global context requires bounded supported metadata, exact citations, explicit scope and freshness policy."); } }
const maxInputBytes = 131072;
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new GlobalContextError();
  const descriptors = Object.getOwnPropertyDescriptors(value), names = Reflect.ownKeys(descriptors);
  if (names.length !== keys.length || names.some(key => typeof key !== "string" || !keys.includes(key))) throw new GlobalContextError();
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) { const item = descriptors[key]; if (!item?.enumerable || !("value" in item)) throw new GlobalContextError(); result[key] = item.value; }
  return result;
}
function text(value: unknown, maximum: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum || /[\x00-\x1f\x7f-\x9f]/u.test(value)) throw new GlobalContextError(); return value;
}
function id(value: unknown): string { const result = text(value, 80); if (!/^[a-z0-9][a-z0-9._:-]*$/u.test(result)) throw new GlobalContextError(); return result; }
function tag(value: unknown): string { const result = text(value, 40); if (!/^[a-z0-9][a-z0-9-]*$/u.test(result)) throw new GlobalContextError(); return result; }
function timestamp(value: unknown): string { if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new GlobalContextError(); return value; }
const dateOrUnknown = (value: unknown) => value === null ? null : timestamp(value);
function integer(value: unknown, maximum: number): number { if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > maximum) throw new GlobalContextError(); return value; }
function choice<T extends string>(value: unknown, choices: readonly T[]): T { if (!choices.includes(value as T)) throw new GlobalContextError(); return value as T; }
function list<T>(value: unknown, maximum: number, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) throw new GlobalContextError();
  const fields = Object.getOwnPropertyDescriptors(value), length = Object.getOwnPropertyDescriptor(value, "length")!.value as number;
  if (length > maximum || Reflect.ownKeys(fields).length !== length + 1) throw new GlobalContextError();
  const result: T[] = []; for (let i = 0; i < length; i++) { const field = fields[String(i)]; if (!field?.enumerable || !("value" in field)) throw new GlobalContextError(); result.push(parse(field.value)); } return result;
}
function unique<T>(values: T[]): T[] { if (new Set(values).size !== values.length) throw new GlobalContextError(); return values; }
function tags(value: unknown, maximum: number, required = false): string[] { const result = unique(list(value, maximum, tag)); if (required && !result.length) throw new GlobalContextError(); return result; }
function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
export function parseGlobalContextInput(value: unknown): GlobalContextInput {
  try {
    const raw = object(value, ["schemaVersion", "kind", "scope", "policy", "sources", "claims"]);
    if (raw.schemaVersion !== "1.0" || raw.kind !== "global_context_input") throw new GlobalContextError();
    const scope = object(raw.scope, ["asOf", "regions", "languages", "topics"]), policy = object(raw.policy, ["maximumRetrievalAgeHours", "maximumPublicationAgeHours", "minimumDeclaredOriginsForTrend"]), ages = object(policy.maximumPublicationAgeHours, [...kinds]);
    const sources = list(raw.sources, 32, item => {
      const source = object(item, ["id", "originId", "kind", "publisher", "title", "url", "publishedAt", "updatedAt", "eventAt", "retrievedAt", "status", "inspection", "contentSha256", "regions", "language", "topics", "applicabilityBasis"]);
      const url = text(source.url, 2048), parsed = new URL(url); if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) throw new GlobalContextError();
      const inspection = choice(source.inspection, ["declared_inspected", "metadata_only"] as const), digest = source.contentSha256;
      if (inspection === "declared_inspected" ? typeof digest !== "string" || !/^[a-f0-9]{64}$/u.test(digest) : digest !== null) throw new GlobalContextError();
      const publishedAt = dateOrUnknown(source.publishedAt), updatedAt = dateOrUnknown(source.updatedAt);
      if (publishedAt && updatedAt && Date.parse(updatedAt) < Date.parse(publishedAt)) throw new GlobalContextError();
      return { id: id(source.id), originId: id(source.originId), kind: choice(source.kind, kinds), publisher: text(source.publisher, 200), title: text(source.title, 300), url,
        publishedAt, updatedAt, eventAt: dateOrUnknown(source.eventAt), retrievedAt: timestamp(source.retrievedAt), status: choice(source.status, ["available", "withdrawn", "superseded"] as const), inspection, contentSha256: digest as string | null,
        regions: tags(source.regions, 8), language: source.language === null ? null : tag(source.language), topics: tags(source.topics, 8), applicabilityBasis: text(source.applicabilityBasis, 500) };
    });
    unique(sources.map(source => source.id)); const sourceIds = new Set(sources.map(source => source.id));
    const claims = list(raw.claims, 32, item => {
      const claim = object(item, ["id", "kind", "statement", "sourceIds", "contradictionSourceIds"]), support = unique(list(claim.sourceIds, 8, id)), contradiction = unique(list(claim.contradictionSourceIds, 8, id));
      if ([...support, ...contradiction].some(ref => !sourceIds.has(ref)) || support.some(ref => contradiction.includes(ref))) throw new GlobalContextError();
      return { id: id(claim.id), kind: choice(claim.kind, ["reported_statement", "trend_hypothesis", "forecast", "analyst_inference"] as const), statement: text(claim.statement, 2000), sourceIds: support, contradictionSourceIds: contradiction };
    }); unique(claims.map(claim => claim.id));
    const result: GlobalContextInput = { schemaVersion: "1.0", kind: "global_context_input", scope: { asOf: timestamp(scope.asOf), regions: tags(scope.regions, 6, true), languages: tags(scope.languages, 4, true), topics: tags(scope.topics, 6, true) }, policy: { maximumRetrievalAgeHours: integer(policy.maximumRetrievalAgeHours, 87600), maximumPublicationAgeHours: { news: integer(ages.news, 87600), release: integer(ages.release, 87600), research: integer(ages.research, 87600), dataset: integer(ages.dataset, 87600), forecast: integer(ages.forecast, 87600) }, minimumDeclaredOriginsForTrend: integer(policy.minimumDeclaredOriginsForTrend, 16) }, sources, claims };
    if (Buffer.byteLength(JSON.stringify(result)) > maxInputBytes) throw new GlobalContextError(); return freeze(result);
  } catch { throw new GlobalContextError(); }
}

/** Deterministic checks of supplied metadata only. No source, truth, independence or permission authentication. */
export function assessGlobalContext(value: unknown) {
  const input = parseGlobalContextInput(value), { scope, policy } = input, asOf = Date.parse(scope.asOf), hour = 3600000;
  // Merge declared shared origins and identical canonical URLs, including transitive chains.
  // This prevents known duplicates inflating counts; it does not authenticate independence.
  const roots = input.sources.map((_, index) => index), find = (index: number): number => { while (roots[index] !== index) index = roots[index]!; return index; };
  const urls = input.sources.map(source => { const url = new URL(source.url); url.hash = ""; return url.href; });
  for (let i = 0; i < input.sources.length; i++) for (let j = 0; j < i; j++) if (input.sources[i]!.originId === input.sources[j]!.originId || urls[i] === urls[j]) roots[find(i)] = find(j);
  const originGroups = new Map(input.sources.map((source, index) => [source.id, input.sources[find(index)]!.id]));
  const sources = input.sources.map(source => {
    const reasons: string[] = [], warnings: string[] = [];
    if (source.inspection !== "declared_inspected") reasons.push("not_inspected");
    if (source.status !== "available") reasons.push(`source_${source.status}`);
    const retrievedAt = Date.parse(source.retrievedAt);
    if (retrievedAt > asOf) reasons.push("retrieved_after_as_of");
    else if (asOf - retrievedAt > policy.maximumRetrievalAgeHours * hour) reasons.push("retrieval_too_old");
    if (!source.publishedAt) reasons.push("publication_time_unknown");
    else if (Date.parse(source.publishedAt) > Math.min(asOf, retrievedAt)) reasons.push("published_after_available_time");
    else if (asOf - Date.parse(source.publishedAt) > policy.maximumPublicationAgeHours[source.kind] * hour) reasons.push("publication_too_old");
    if (source.updatedAt && Date.parse(source.updatedAt) > Math.min(asOf, retrievedAt)) reasons.push("updated_after_available_time");
    if (source.eventAt) {
      if (Date.parse(source.eventAt) > Math.min(asOf, retrievedAt) && source.kind !== "forecast") reasons.push("event_after_available_time");
      else if (source.kind === "news" && asOf - Date.parse(source.eventAt) > policy.maximumPublicationAgeHours.news * hour) reasons.push("historical_event");
    } else warnings.push("event_time_unknown");
    if (source.kind === "forecast") warnings.push("forecast_not_observed_outcome");
    if (!scope.regions.some(region => source.regions.includes(region)) || !source.language || !scope.languages.includes(source.language) || !scope.topics.some(topic => source.topics.includes(topic))) reasons.push("outside_declared_scope");
    return { id: source.id, originId: source.originId, declaredOriginGroup: originGroups.get(source.id)!, eligibleByMetadata: reasons.length === 0, reasons, warnings };
  });
  const eligible = new Set(sources.filter(source => source.eligibleByMetadata).map(source => source.id));
  const coverage = scope.regions.flatMap(region => scope.languages.flatMap(language => scope.topics.map(topic => {
    const ids = input.sources.filter(source => eligible.has(source.id) && source.regions.includes(region) && source.language === language && source.topics.includes(topic)).map(source => source.id);
    return { region, language, topic, eligibleSourceIds: ids, distinctDeclaredOriginGroups: new Set(ids.map(id => originGroups.get(id)!)).size };
  })));
  const claims = input.claims.map(claim => {
    const reasons: string[] = [], ids = claim.sourceIds.filter(id => eligible.has(id)), origins = new Set(ids.map(id => originGroups.get(id)!));
    if (!claim.sourceIds.length) reasons.push("no_supporting_sources");
    if (ids.length !== claim.sourceIds.length) reasons.push("ineligible_supporting_source");
    if (claim.contradictionSourceIds.length) reasons.push("declared_conflict_requires_review");
    if (claim.kind === "trend_hypothesis" && origins.size < policy.minimumDeclaredOriginsForTrend) reasons.push("insufficient_declared_origins");
    return { id: claim.id, kind: claim.kind, sourceIds: claim.sourceIds, contradictionSourceIds: claim.contradictionSourceIds, distinctEligibleDeclaredOriginGroups: origins.size,
      sourceChecks: reasons.length ? "not_met" : "met_unreviewed", reasons, semanticReview: "unreviewed", trendValidity: "not_assessed", forecastAccuracy: "not_assessed" };
  });
  const missingCoverage = coverage.filter(cell => !cell.eligibleSourceIds.length).map(({ region, language, topic }) => ({ region, language, topic }));
  const result = { schemaVersion: "1.0", kind: "global_context_assessment", policyVersion: "global-context-metadata-v1", inputSha256: sha256(JSON.stringify(input)), asOf: scope.asOf, timeBasis: "relative_to_supplied_as_of",
    outcome: !eligible.size ? "no_eligible_context" : missingCoverage.length || claims.some(claim => claim.sourceChecks === "not_met") ? "partial_metadata_coverage" : "metadata_checks_passed",
    scope, policy, sources, claims, coverage, missingCoverage, distinctEligibleDeclaredOriginGroups: new Set(sources.filter(source => source.eligibleByMetadata).map(source => source.declaredOriginGroup)).size,
    boundaries: { provenance: "operator_supplied_unverified", inspection: "operator_declared_not_authenticated", sourceContentsRead: false, citationMeaning: "not_checked", independence: "declared_origins_not_authenticated", deduplication: "declared_origin_or_identical_canonical_url", currentGlobalAwareness: "not_established", semanticReview: "unreviewed", trendValidity: "not_assessed", researchValidated: false, networkRequests: 0, modelCalls: 0, referencesOpened: false, accessGranted: false, stakeholderDecisions: false, purchaseDemandEstablished: false, investmentOutcomeEstablished: false } };
  if (Buffer.byteLength(JSON.stringify(result)) > 512000) throw new GlobalContextError(); return freeze(result);
}

/** Reads only the named bounded JSON input. URLs inside it are never opened. */
export async function readGlobalContextInput(file: string): Promise<GlobalContextInput> {
  try {
    const path = resolve(file), root = await realpath(dirname(path)), bytes = await boundedBytes(root, resolve(root, basename(path)), maxInputBytes);
    return parseGlobalContextInput(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown);
  } catch { throw new GlobalContextError(); }
}
