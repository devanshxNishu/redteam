import type { IncomingMessage } from "node:http";
import { isDeepStrictEqual } from "node:util";
import { sha256 } from "./evidence.ts";
import { fields, freeze, integer, list, text, timestamp } from "./context-data.ts";
import { ContextCollectionError, permittedContextIPv4, publicContextHeaders as headers, retrievePublicContext, createInjectedPublicContextTransport, checkPublicContextResponse, assertNativePublicContextResponse, describePublicContextTarget } from "./public-context-http.ts";
import type { ContextCollectorIO, PublicContextResponse } from "./public-context-http.ts";
export { ContextCollectionError, permittedContextIPv4 } from "./public-context-http.ts";
export type { CollectionFailure, ContextCollectorIO } from "./public-context-http.ts";
export interface PublicContextCollection {
  schemaVersion: "1.0";
  kind: "public_context_collection_input";
  adapter: "world_bank_population_v1";
  countryCode: string;
  years: { first: number; last: number };
  permissions: { collect: true; localReview: true; basis: string; expiresAt: string; externalProcessing: false; redistribution: false; training: false };
  limits: { timeoutMs: number; maximumBytes: number };
}
export function parsePublicContextCollection(value: unknown): PublicContextCollection {
  try {
    const raw = fields(value, ["schemaVersion", "kind", "adapter", "countryCode", "years", "permissions", "limits"]);
    if (raw.schemaVersion !== "1.0" || raw.kind !== "public_context_collection_input" || raw.adapter !== "world_bank_population_v1") throw 0;
    const countryCode = text(raw.countryCode, 3); if (!/^[A-Z]{3}$/u.test(countryCode)) throw 0;
    const years = fields(raw.years, ["first", "last"]), first = integer(years.first, 9999), last = integer(years.last, 9999);
    if (first < 1960 || last < first || last - first > 9 || last > new Date().getUTCFullYear()) throw 0;
    const permission = fields(raw.permissions, ["collect", "localReview", "basis", "expiresAt", "externalProcessing", "redistribution", "training"]);
    if (permission.collect !== true || permission.localReview !== true || permission.externalProcessing !== false || permission.redistribution !== false || permission.training !== false) throw 0;
    const limits = fields(raw.limits, ["timeoutMs", "maximumBytes"]), timeoutMs = integer(limits.timeoutMs, 30000), maximumBytes = integer(limits.maximumBytes, 32768);
    if (timeoutMs < 250) throw 0;
    return freeze({ schemaVersion: "1.0", kind: "public_context_collection_input", adapter: "world_bank_population_v1", countryCode, years: { first, last }, permissions: { collect: true, localReview: true, basis: text(permission.basis, 1000), expiresAt: timestamp(permission.expiresAt), externalProcessing: false, redistribution: false, training: false }, limits: { timeoutMs, maximumBytes } });
  } catch { throw new ContextCollectionError("invalid_input"); }
}
function collectionTarget(input: PublicContextCollection) { return { kind: "world_bank_population_v1", countryCode: input.countryCode, firstYear: input.years.first, lastYear: input.years.last }; }
function collectionURL(input: PublicContextCollection): URL { return new URL(describePublicContextTarget(collectionTarget(input)).url); }
function optionalText(value: unknown, max = 300): string { if (value === "") return ""; return text(value, max); }
function dateOnly(value: unknown): string {
  const date = text(value, 10); if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw 0; return date;
}
function dataset(rawText: string, input: PublicContextCollection, retrievedAt: string) {
  const body: unknown = JSON.parse(rawText);
  const pair = list(body, 2, item => item); if (pair.length !== 2) throw 0;
  const meta = fields(pair[0], ["page", "pages", "per_page", "total", "sourceid", "lastupdated"]);
  const total = integer(meta.total, 10), lastUpdated = dateOnly(meta.lastupdated);
  if (meta.page !== 1 || meta.pages !== 1 || meta.per_page !== 10 || meta.sourceid !== "2" || lastUpdated > retrievedAt.slice(0, 10)) throw 0;
  const seen = new Set<number>();
  const observations = list(pair[1], 10, item => {
    const row = fields(item, ["indicator", "country", "countryiso3code", "date", "value", "unit", "obs_status", "decimal"]);
    const indicator = fields(row.indicator, ["id", "value"]), country = fields(row.country, ["id", "value"]);
    if (indicator.id !== "SP.POP.TOTL" || row.countryiso3code !== input.countryCode || typeof row.date !== "string" || !/^\d{4}$/u.test(row.date)) throw 0;
    const year = Number(row.date); if (seen.has(year) || year < input.years.first || year > input.years.last) throw 0; seen.add(year);
    if (row.value !== null && (typeof row.value !== "number" || !Number.isSafeInteger(row.value) || row.value < 0)) throw 0;
    if (row.decimal !== 0) throw 0;
    return { year, value: row.value as number | null, indicatorLabel: text(indicator.value, 300), countryId: text(country.id, 3), countryLabel: text(country.value, 300), unit: optionalText(row.unit, 100), observationStatus: optionalText(row.obs_status, 100), decimal: 0 as const };
  });
  if (observations.length !== total || total > input.years.last - input.years.first + 1) throw 0;
  const missingYears: number[] = []; for (let year = input.years.first; year <= input.years.last; year++) if (!seen.has(year)) missingYears.push(year);
  return { publisher: "World Bank", sourceId: "2", indicator: "SP.POP.TOTL", countryCode: input.countryCode, language: "en", lastUpdated: { value: lastUpdated, precision: "date_only" }, publishedAt: null, observations, missingYears,
    interpretation: "Provider-reported population observations; nulls, units and status are preserved. No demand, psychology, trend or investment inference was made.", attribution: { indicatorURL: "https://data.worldbank.org/indicator/SP.POP.TOTL", termsURL: "https://www.worldbank.org/ext/en/legal/terms-conditions/datasets", termsStatus: "Operator-declared permitted local use; rights are not independently authenticated." } };
}

type Mode = "native_https" | "injected_test_io";
const nativeCaptures = new WeakSet<object>();
const nativeStarts = new WeakMap<object, number>();
export function assertNativeContextCapture(value: unknown, notBefore?: number): undefined {
  if (!value || typeof value !== "object" || !nativeCaptures.has(value) || notBefore !== undefined && (!Number.isFinite(notBefore) || notBefore < 0 || nativeStarts.get(value)! < notBefore)) throw new ContextCollectionError("not_native"); return undefined;
}
async function collect(value: unknown, transport: (target: unknown, authority: unknown, signal?: AbortSignal) => Promise<PublicContextResponse>, signal?: AbortSignal) {
  const input = parsePublicContextCollection(value), observed = await transport(collectionTarget(input), { permissions: input.permissions, limits: input.limits }, signal);
  checkPublicContextResponse(observed); let result;
  try { result = captureObject(input, observed.startedAt, observed.retrievedAt, undefined, observed.rawText, { contentType: observed.response.contentType, contentLength: observed.response.contentLength, date: observed.response.date, lastModified: observed.response.lastModified }, observed.provenance.transport, observed.provenance.peerIPv4, observed.provenance.bodyEvents); }
  catch { throw new ContextCollectionError("response_invalid"); }
  checkPublicContextResponse(observed);
  if (observed.provenance.transport === "native_https") { const monotonic = assertNativePublicContextResponse(observed); nativeCaptures.add(result); nativeStarts.set(result, monotonic); } return result;
}
export type PublicContextCapture = Awaited<ReturnType<typeof collect>>;
export function collectPublicContext(value: unknown, signal?: AbortSignal): Promise<PublicContextCapture> { return collect(value, retrievePublicContext, signal); }
export function createInjectedContextCollector(io: ContextCollectorIO): (value: unknown, signal?: AbortSignal) => Promise<PublicContextCapture> { const transport = createInjectedPublicContextTransport(io); return (value, signal) => collect(value, transport, signal); }
function captureObject(input: PublicContextCollection, startedAt: string, retrievedAt: string, finishedAt: string | undefined, rawText: string, response: ReturnType<typeof headers>, mode: Mode, address: string, chunks: number) {
  const parsed = dataset(rawText, input, retrievedAt);
  return freeze({ schemaVersion: "1.0", kind: "public_context_capture", policyVersion: "world-bank-population-capture-v1", input, inputSha256: sha256(JSON.stringify(input)), url: collectionURL(input).href,
    startedAt, retrievedAt, finishedAt: finishedAt ?? new Date().toISOString(), body: { text: rawText, bytes: Buffer.byteLength(rawText), sha256: sha256(rawText) }, response: { status: 200, ...response }, dataset: parsed,
    provenance: { transport: mode, networkObservation: mode === "native_https" ? "native_runtime_observation" : "simulated_unverified", logicalDnsOperations: 1, httpRequests: 1, redirects: 0, applicationRetries: 0, peerIPv4: address, addressPolicy: "public-ipv4-iana-2025-10-09-v1", bodyEvents: chunks, originalProviderBodyPreserved: true },
    boundaries: { semanticReview: "unreviewed", publisherFacts: "not_independently_authenticated", toolAuthority: "not_granted", externalProcessing: "not_authorized", redistribution: "not_authorized", training: "not_authorized", newsCoverage: "not_collected", currentGlobalAwareness: "not_established", researchValidated: false, stakeholderDecisions: false, storedSource: false } });
}
export type RecordedPublicContextCapture = Omit<PublicContextCapture, "body"> & { body: Omit<PublicContextCapture["body"], "text"> };
export function publicContextCaptureReceipt(capture: PublicContextCapture): RecordedPublicContextCapture {
  const { body, ...rest } = capture; return freeze({ ...rest, body: { bytes: body.bytes, sha256: body.sha256 } });
}
/** Historical policy/byte reconstruction only. Never registers a native runtime capability. */
export function readRecordedPublicContextCapture(value: unknown, rawText: string): PublicContextCapture {
  try {
    const raw = fields(value, ["schemaVersion", "kind", "policyVersion", "input", "inputSha256", "url", "startedAt", "retrievedAt", "finishedAt", "body", "response", "dataset", "provenance", "boundaries"]);
    const input = parsePublicContextCollection(raw.input), startedAt = timestamp(raw.startedAt), retrievedAt = timestamp(raw.retrievedAt), finishedAt = timestamp(raw.finishedAt);
    const start = Date.parse(startedAt), retrieved = Date.parse(retrievedAt), finish = Date.parse(finishedAt);
    if (retrieved < start || finish < retrieved || finish >= start + input.limits.timeoutMs || Date.parse(input.permissions.expiresAt) <= start + input.limits.timeoutMs || typeof rawText !== "string" || !Buffer.byteLength(rawText) || Buffer.byteLength(rawText) > input.limits.maximumBytes) throw 0;
    const response = fields(raw.response, ["status", "contentType", "contentLength", "date", "lastModified"]);
    if (response.status !== 200) throw 0;
    const rawHeaders: string[] = ["content-type", text(response.contentType, 512)];
    if (response.contentLength !== null) rawHeaders.push("content-length", String(integer(response.contentLength, input.limits.maximumBytes)));
    for (const [field, name] of [["date", "date"], ["lastModified", "last-modified"]]) if (response[field!] !== null) rawHeaders.push(name!, optionalText(response[field!], 512));
    const checkedHeaders = headers({ rawHeaders } as IncomingMessage, input.limits.maximumBytes);
    if (checkedHeaders.contentLength !== null && checkedHeaders.contentLength !== Buffer.byteLength(rawText)) throw 0;
    const provenance = fields(raw.provenance, ["transport", "networkObservation", "logicalDnsOperations", "httpRequests", "redirects", "applicationRetries", "peerIPv4", "addressPolicy", "bodyEvents", "originalProviderBodyPreserved"]);
    if (provenance.transport !== "native_https" || !permittedContextIPv4(provenance.peerIPv4)) throw 0;
    const capture = captureObject(input, startedAt, retrievedAt, finishedAt, rawText, checkedHeaders, "native_https", provenance.peerIPv4, integer(provenance.bodyEvents, 8192));
    if (!isDeepStrictEqual(value, publicContextCaptureReceipt(capture))) throw 0; return capture;
  } catch { throw new ContextCollectionError("response_invalid"); }
}
