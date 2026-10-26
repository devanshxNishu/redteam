import { Resolver } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import type { RequestOptions } from "node:https";
import type { ClientRequest, IncomingMessage } from "node:http";
import { isIPv4 } from "node:net";
import type { TLSSocket } from "node:tls";
import { performance } from "node:perf_hooks";
import { sha256 } from "./evidence.ts";
import { fields, freeze, integer, list, text, timestamp } from "./context-data.ts";

export type CollectionFailure = "invalid_input" | "aborted" | "deadline" | "dns_denied" | "network_unavailable" | "response_invalid" | "response_bounds" | "not_native";
export class ContextCollectionError extends Error {
  readonly code: CollectionFailure;
  constructor(code: CollectionFailure) { super("The bounded public context collection is unavailable."); this.code = code; }
}
export interface PublicContextCollection {
  schemaVersion: "1.0";
  kind: "public_context_collection_input";
  adapter: "world_bank_population_v1";
  countryCode: string;
  years: { first: number; last: number };
  permissions: { collect: true; localReview: true; basis: string; expiresAt: string; externalProcessing: false; redistribution: false; training: false };
  limits: { timeoutMs: number; maximumBytes: number };
}
const origin = "https://api.worldbank.org";
const host = "api.worldbank.org";
const policy = "public-ipv4-iana-2025-10-09-v1";
// Conservative: reject every special-purpose block, including globally reachable exceptions.
// The encompassing /24 and /4 entries cover the registry's more-specific entries.
const denied = ["0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24", "192.31.196.0/24", "192.52.193.0/24", "192.88.99.0/24", "192.168.0.0/16", "192.175.48.0/24", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4"];
function ipNumber(ip: string): number { return ip.split(".").reduce((n, part) => n * 256 + Number(part), 0); }
const ranges = denied.map(cidr => { const [ip, prefix] = cidr.split("/"); const size = 2 ** (32 - Number(prefix)); return { first: ipNumber(ip!), size }; });
export function permittedContextIPv4(value: unknown): value is string {
  return typeof value === "string" && isIPv4(value) && !ranges.some(range => ipNumber(value) >= range.first && ipNumber(value) < range.first + range.size);
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
function collectionURL(input: PublicContextCollection): URL {
  const url = new URL(`/v2/en/country/${input.countryCode}/indicator/SP.POP.TOTL`, origin);
  url.search = new URLSearchParams({ source: "2", format: "json", date: `${input.years.first}:${input.years.last}`, per_page: "10", page: "1" }).toString(); return url;
}
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

/** Trusted test seam only. A supplied transport never receives native provenance. */
export interface ContextCollectorIO {
  resolver: (options: { timeout: number; tries: number }) => { resolve4: (hostname: string) => Promise<string[]>; cancel: () => void };
  request: (url: URL, options: RequestOptions, response: (message: IncomingMessage) => void) => ClientRequest;
}
const nativeIO: ContextCollectorIO = { resolver: options => new Resolver(options), request: (url, options, response) => httpsRequest(url, options, response) };
type Mode = "native_https" | "injected_test_io";
const nativeCaptures = new WeakSet<object>();
const signalAborted = Object.getOwnPropertyDescriptor(AbortSignal.prototype, "aborted")!.get!;
export function assertNativeContextCapture(value: unknown): undefined {
  if (!value || typeof value !== "object" || !nativeCaptures.has(value)) throw new ContextCollectionError("not_native"); return undefined;
}
function headers(message: IncomingMessage, maximumBytes: number) {
  const all = message.rawHeaders;
  if (!Array.isArray(all) || all.length % 2 || all.length > 200) throw new ContextCollectionError("response_bounds");
  let size = 0; const selected = new Map<string, string>();
  for (let i = 0; i < all.length; i += 2) {
    const name = all[i], value = all[i + 1];
    if (typeof name !== "string" || typeof value !== "string" || !/^[!#$%&'*+.^_`|~0-9a-z-]+$/iu.test(name) || /[\x00-\x1f\x7f]/u.test(value)) throw new ContextCollectionError("response_invalid");
    size += Buffer.byteLength(name) + Buffer.byteLength(value) + 4;
    if (size > 16384) throw new ContextCollectionError("response_bounds");
    const key = name.toLowerCase(); if (key === "content-range") throw new ContextCollectionError("response_invalid");
    if (["content-type", "content-length", "content-encoding", "date", "last-modified", "transfer-encoding"].includes(key)) {
      if (selected.has(key) || value.length > 512) throw new ContextCollectionError("response_invalid"); selected.set(key, value);
    }
  }
  const type = selected.get("content-type"), encoding = selected.get("content-encoding");
  if (!type || !/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/iu.test(type) || encoding !== undefined && encoding.toLowerCase() !== "identity") throw new ContextCollectionError("response_invalid");
  const length = selected.get("content-length");
  if (length !== undefined && (!/^[1-9]\d*$/u.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > maximumBytes)) throw new ContextCollectionError("response_bounds");
  if (length && selected.has("transfer-encoding")) throw new ContextCollectionError("response_invalid");
  return { contentType: type, contentLength: length === undefined ? null : Number(length), date: selected.get("date") ?? null, lastModified: selected.get("last-modified") ?? null };
}
async function collect(value: unknown, io: ContextCollectorIO, mode: Mode, signal?: AbortSignal) {
  const input = parsePublicContextCollection(value), started = Date.now(), monotonic = performance.now(), deadline = started + input.limits.timeoutMs, startedAt = new Date(started).toISOString();
  if (Date.parse(input.permissions.expiresAt) <= deadline) throw new ContextCollectionError("invalid_input");
  try {
    if (signal && !(signal instanceof AbortSignal)) throw 0;
    if (signal && signalAborted.call(signal)) throw new ContextCollectionError("aborted");
  } catch (error) { throw error instanceof ContextCollectionError ? error : new ContextCollectionError("invalid_input"); }
  const controller = new AbortController(); let reason: CollectionFailure = "deadline";
  const abort = () => { reason = "aborted"; controller.abort(); }; if (signal) EventTarget.prototype.addEventListener.call(signal, "abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(), input.limits.timeoutMs);
  const guard = () => {
    if (controller.signal.aborted) throw new ContextCollectionError(reason);
    if (signal && signalAborted.call(signal)) throw new ContextCollectionError("aborted");
    if (Date.now() < started || Date.now() >= deadline || Date.now() >= Date.parse(input.permissions.expiresAt) || performance.now() - monotonic >= input.limits.timeoutMs) throw new ContextCollectionError("deadline");
  };
  let resolver: ReturnType<ContextCollectorIO["resolver"]> | undefined;
  try {
    guard(); resolver = io.resolver({ timeout: input.limits.timeoutMs, tries: 1 });
    const answers = await new Promise<string[]>((resolve, reject) => {
      const cancel = () => { try { resolver?.cancel(); } catch {} reject(new ContextCollectionError(reason)); };
      controller.signal.addEventListener("abort", cancel, { once: true });
      try { resolver!.resolve4(host).then(resolve, () => reject(new ContextCollectionError("network_unavailable"))).finally(() => controller.signal.removeEventListener("abort", cancel)); }
      catch { controller.signal.removeEventListener("abort", cancel); reject(new ContextCollectionError("network_unavailable")); }
    });
    guard();
    let addresses: string[];
    try { addresses = list(answers, 16, value => { if (!permittedContextIPv4(value)) throw 0; return value; }); if (!addresses.length) throw 0; } catch { throw new ContextCollectionError("dns_denied"); }
    const address = addresses[0]!; const url = collectionURL(input);
    const capture = await new Promise<{ rawText: string; response: ReturnType<typeof headers>; chunks: number }>((resolve, reject) => {
      let request: ClientRequest | undefined, response: IncomingMessage | undefined, done = false;
      let chunks = 0, length = 0; const parts: Buffer[] = [];
      const checkPeer = (socket: TLSSocket) => { if (!socket || socket.encrypted !== true || socket.authorized !== true || socket.remoteAddress !== address || socket.remoteFamily !== "IPv4" || socket.remotePort !== 443) throw new ContextCollectionError("network_unavailable"); };
      const swallow = () => {};
      const cleanup = () => {
        controller.signal.removeEventListener("abort", cancelled);
        socket?.off("secureConnect", connected);
        request?.off("socket", onSocket); request?.off("error", failed); request?.off("close", requestClosed); request?.off("information", incomplete); request?.off("upgrade", upgraded);
        response?.off("data", data); response?.off("end", end); response?.off("error", failed); response?.off("aborted", incomplete); response?.off("close", responseClosed);
        // destroy can emit an asynchronous error. Keep a harmless guard through close.
        for (const stream of [request, response]) if (stream) { stream.on("error", swallow); stream.once("close", () => stream.off("error", swallow)); stream.destroy(); }
        parts.length = 0;
      };
      const fail = (error: unknown) => { if (done) return; done = true; cleanup(); reject(error instanceof ContextCollectionError ? error : new ContextCollectionError("network_unavailable")); };
      const failed = () => fail(new ContextCollectionError("network_unavailable"));
      const cancelled = () => fail(new ContextCollectionError(reason));
      const incomplete = () => fail(new ContextCollectionError("response_invalid"));
      const upgraded = (_message: IncomingMessage, upgradedSocket: TLSSocket) => { upgradedSocket.destroy(); incomplete(); };
      const requestClosed = () => { if (!response) failed(); };
      const responseClosed = () => { if (!done) incomplete(); };
      let socket: TLSSocket | undefined;
      const connected = () => { try { guard(); checkPeer(socket!); } catch (error) { fail(error); } };
      const onSocket = (value: TLSSocket) => { socket = value; socket.once("secureConnect", connected); socket.once("close", () => socket?.off("secureConnect", connected)); };
      let receivedHeaders: ReturnType<typeof headers>;
      const data = (chunk: unknown) => {
        if (done) return;
        try { guard(); if (!Buffer.isBuffer(chunk) || ++chunks > 8192 || length + chunk.length > input.limits.maximumBytes) throw new ContextCollectionError("response_bounds"); length += chunk.length; parts.push(Buffer.from(chunk)); }
        catch (error) { fail(error); }
      };
      const end = () => {
        if (done) return;
        try {
          guard(); if (!response?.complete || !length || receivedHeaders.contentLength !== null && receivedHeaders.contentLength !== length) throw new ContextCollectionError("response_invalid");
          const bytes = Buffer.concat(parts, length), rawText = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
          if (!Buffer.from(rawText).equals(bytes)) throw new ContextCollectionError("response_invalid");
          done = true; const result = { rawText, response: receivedHeaders, chunks }; cleanup(); resolve(result);
        } catch (error) { fail(error instanceof ContextCollectionError ? error : new ContextCollectionError("response_invalid")); }
      };
      controller.signal.addEventListener("abort", cancelled, { once: true });
      try {
        guard();
        const options: RequestOptions = { method: "GET", agent: false, family: 4, servername: host, rejectUnauthorized: true, maxHeaderSize: 16384, signal: controller.signal,
          headers: { Accept: "application/json", "Accept-Encoding": "identity", "User-Agent": "Redteam-Public-Context/1.0", Connection: "close" },
          lookup: (hostname, options, callback) => {
            try { guard(); if (hostname !== host) throw 0; if (options.all) callback(null, [{ address, family: 4 }]); else callback(null, address, 4); }
            catch { callback(new Error("Context lookup denied"), "", 4); }
          } };
        request = io.request(url, options, message => {
          if (done) { message.on("error", swallow); message.destroy(); return; }
          if (response) { message.on("error", swallow); message.destroy(); incomplete(); return; }
          response = message;
          try { guard(); checkPeer(message.socket as TLSSocket); if (message.statusCode !== 200) throw new ContextCollectionError("response_invalid"); receivedHeaders = headers(message, input.limits.maximumBytes);
            message.on("data", data); message.once("end", end); message.on("error", failed); message.once("aborted", incomplete); message.once("close", responseClosed);
          } catch (error) { fail(error); }
        });
        if (done) { request.on("error", swallow); request.destroy(); return; }
        request.on("error", failed); request.once("close", requestClosed); request.once("socket", onSocket); request.once("information", incomplete); request.once("upgrade", upgraded); guard(); request.end();
      } catch (error) { fail(error); }
    });
    guard(); const retrievedAt = new Date().toISOString(); let data;
    try { data = dataset(capture.rawText, input, retrievedAt); } catch { throw new ContextCollectionError("response_invalid"); }
    guard();
    const result = freeze({ schemaVersion: "1.0", kind: "public_context_capture", policyVersion: "world-bank-population-capture-v1", input, inputSha256: sha256(JSON.stringify(input)), url: url.href,
      startedAt, retrievedAt, finishedAt: new Date().toISOString(), body: { text: capture.rawText, bytes: Buffer.byteLength(capture.rawText), sha256: sha256(capture.rawText) }, response: { status: 200, ...capture.response }, dataset: data,
      provenance: { transport: mode, networkObservation: mode === "native_https" ? "native_runtime_observation" : "simulated_unverified", logicalDnsOperations: 1, httpRequests: 1, redirects: 0, applicationRetries: 0, peerIPv4: address, addressPolicy: policy, bodyEvents: capture.chunks, originalProviderBodyPreserved: true },
      boundaries: { semanticReview: "unreviewed", publisherFacts: "not_independently_authenticated", toolAuthority: "not_granted", externalProcessing: "not_authorized", redistribution: "not_authorized", training: "not_authorized", newsCoverage: "not_collected", currentGlobalAwareness: "not_established", researchValidated: false, stakeholderDecisions: false, storedSource: false } });
    guard(); if (mode === "native_https") nativeCaptures.add(result); return result;
  } catch (error) { throw error instanceof ContextCollectionError ? error : new ContextCollectionError("network_unavailable"); }
  finally { clearTimeout(timer); if (signal) EventTarget.prototype.removeEventListener.call(signal, "abort", abort); try { resolver?.cancel(); } catch {} }
}
export type PublicContextCapture = Awaited<ReturnType<typeof collect>>;
export function collectPublicContext(value: unknown, signal?: AbortSignal): Promise<PublicContextCapture> { return collect(value, nativeIO, "native_https", signal); }
export function createInjectedContextCollector(io: ContextCollectorIO): (value: unknown, signal?: AbortSignal) => Promise<PublicContextCapture> { return (value, signal) => collect(value, io, "injected_test_io", signal); }
