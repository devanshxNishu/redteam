import { Resolver } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import type { RequestOptions } from "node:https";
import type { ClientRequest, IncomingMessage } from "node:http";
import { isIPv4 } from "node:net";
import type { TLSSocket } from "node:tls";
import { performance } from "node:perf_hooks";
import { fields, freeze, integer, list, text, timestamp } from "./context-data.ts";

export type CollectionFailure = "invalid_input" | "aborted" | "deadline" | "dns_denied" | "network_unavailable" | "response_invalid" | "response_bounds" | "not_native";
export class ContextCollectionError extends Error {
  readonly code: CollectionFailure;
  constructor(code: CollectionFailure) { super("The bounded public context collection is unavailable."); this.code = code; }
}
const policy = "public-ipv4-iana-2025-10-09-v1";
// Conservative: reject every special-purpose block, including globally reachable exceptions.
// The encompassing /24 and /4 entries cover the registry's more-specific entries.
const denied = ["0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24", "192.31.196.0/24", "192.52.193.0/24", "192.88.99.0/24", "192.168.0.0/16", "192.175.48.0/24", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4"];
function ipNumber(ip: string): number { return ip.split(".").reduce((n, part) => n * 256 + Number(part), 0); }
const ranges = denied.map(cidr => { const [ip, prefix] = cidr.split("/"); const size = 2 ** (32 - Number(prefix)); return { first: ipNumber(ip!), size }; });
export function permittedContextIPv4(value: unknown): value is string {
  return typeof value === "string" && isIPv4(value) && !ranges.some(range => ipNumber(value) >= range.first && ipNumber(value) < range.first + range.size);
}
export type PublicContextTarget = { kind: "world_bank_population_v1"; countryCode: string; firstYear: number; lastYear: number } | { kind: "nodejs_latest_release_v1" };
export interface PublicContextAuthority { permissions: { collect: true; localReview: true; basis: string; expiresAt: string; externalProcessing: false; redistribution: false; training: false }; limits: { timeoutMs: number; maximumBytes: number } }
export function describePublicContextTarget(value: unknown) {
  try {
    if (!value || typeof value !== "object") throw 0;
    const kind = Object.getOwnPropertyDescriptor(value, "kind")?.value;
    let url: URL;
    const commonHeaders = { "Accept-Encoding": "identity", "User-Agent": "Redteam-Public-Context/1.0", Connection: "close" };
    if (kind === "world_bank_population_v1") {
      const raw = fields(value, ["kind", "countryCode", "firstYear", "lastYear"]), country = text(raw.countryCode, 3), first = integer(raw.firstYear, 9999), last = integer(raw.lastYear, 9999);
      if (!/^[A-Z]{3}$/u.test(country) || first < 1960 || last < first || last - first > 9 || last > new Date().getUTCFullYear()) throw 0;
      url = new URL(`/v2/en/country/${country}/indicator/SP.POP.TOTL`, "https://api.worldbank.org");
      url.search = new URLSearchParams({ source: "2", format: "json", date: `${first}:${last}`, per_page: "10", page: "1" }).toString();
      return freeze({ kind: "world_bank_population_v1" as const, url: url.href, hostname: url.hostname, headers: { Accept: "application/json", ...commonHeaders } });
    }
    fields(value, ["kind"]); if (kind !== "nodejs_latest_release_v1") throw 0;
    url = new URL("https://api.github.com/repos/nodejs/node/releases/latest");
    return freeze({ kind: "nodejs_latest_release_v1" as const, url: url.href, hostname: url.hostname, headers: { Accept: "application/vnd.github+json", ...commonHeaders, "X-GitHub-Api-Version": "2026-03-10" } });
  } catch { throw new ContextCollectionError("invalid_input"); }
}
export function parsePublicContextAuthority(value: unknown): PublicContextAuthority {
  try {
    const raw = fields(value, ["permissions", "limits"]), permission = fields(raw.permissions, ["collect", "localReview", "basis", "expiresAt", "externalProcessing", "redistribution", "training"]);
    if (permission.collect !== true || permission.localReview !== true || permission.externalProcessing !== false || permission.redistribution !== false || permission.training !== false) throw 0;
    const limits = fields(raw.limits, ["timeoutMs", "maximumBytes"]), timeoutMs = integer(limits.timeoutMs, 30000), maximumBytes = integer(limits.maximumBytes, 32768); if (timeoutMs < 250) throw 0;
    return freeze({ permissions: { collect: true, localReview: true, basis: text(permission.basis, 1000), expiresAt: timestamp(permission.expiresAt), externalProcessing: false, redistribution: false, training: false }, limits: { timeoutMs, maximumBytes } });
  } catch { throw new ContextCollectionError("invalid_input"); }
}
/** Trusted test seam only. A supplied transport never receives native provenance. */
export interface ContextCollectorIO {
  resolver: (options: { timeout: number; tries: number }) => { resolve4: (hostname: string) => Promise<string[]>; cancel: () => void };
  request: (url: URL, options: RequestOptions, response: (message: IncomingMessage) => void) => ClientRequest;
}
const nativeIO: ContextCollectorIO = { resolver: options => new Resolver(options), request: (url, options, response) => httpsRequest(url, options, response) };
type Mode = "native_https" | "injected_test_io";
const responseStates = new WeakMap<object, { guard: () => void; monotonic: number; mode: Mode }>();
const signalAborted = Object.getOwnPropertyDescriptor(AbortSignal.prototype, "aborted")!.get!;
export function checkPublicContextResponse(value: unknown): undefined {
  if (!value || typeof value !== "object") throw new ContextCollectionError("invalid_input"); const state = responseStates.get(value); if (!state) throw new ContextCollectionError("invalid_input"); state.guard(); return undefined;
}
export function assertNativePublicContextResponse(value: unknown): number {
  if (!value || typeof value !== "object") throw new ContextCollectionError("not_native"); const state = responseStates.get(value); if (!state || state.mode !== "native_https") throw new ContextCollectionError("not_native"); return state.monotonic;
}
export function publicContextHeaders(message: IncomingMessage, maximumBytes: number) {
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
async function retrieve(targetInput: unknown, authorityInput: unknown, io: ContextCollectorIO, mode: Mode, signal?: AbortSignal) {
  const target = describePublicContextTarget(targetInput), input = parsePublicContextAuthority(authorityInput), host = target.hostname, started = Date.now(), monotonic = performance.now(), deadline = started + input.limits.timeoutMs, startedAt = new Date(started).toISOString();
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
    const address = addresses[0]!; const url = new URL(target.url);
    const capture = await new Promise<{ rawText: string; response: ReturnType<typeof publicContextHeaders>; chunks: number; selectedApiVersion: string | null }>((resolve, reject) => {
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
      let receivedHeaders: ReturnType<typeof publicContextHeaders>, selectedApiVersion: string | null = null;
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
          done = true; const result = { rawText, response: receivedHeaders, chunks, selectedApiVersion }; cleanup(); resolve(result);
        } catch (error) { fail(error instanceof ContextCollectionError ? error : new ContextCollectionError("response_invalid")); }
      };
      controller.signal.addEventListener("abort", cancelled, { once: true });
      try {
        guard();
        const options: RequestOptions = { method: "GET", agent: false, family: 4, servername: host, rejectUnauthorized: true, maxHeaderSize: 16384, signal: controller.signal,
          headers: { ...target.headers },
          lookup: (hostname, options, callback) => {
            try { guard(); if (hostname !== host) throw 0; if (options.all) callback(null, [{ address, family: 4 }]); else callback(null, address, 4); }
            catch { callback(new Error("Context lookup denied"), "", 4); }
          } };
        request = io.request(url, options, message => {
          if (done) { message.on("error", swallow); message.destroy(); return; }
          if (response) { message.on("error", swallow); message.destroy(); incomplete(); return; }
          response = message;
          try { guard(); checkPeer(message.socket as TLSSocket); if (message.statusCode !== 200) throw new ContextCollectionError("response_invalid"); receivedHeaders = publicContextHeaders(message, input.limits.maximumBytes);
            if (target.kind === "nodejs_latest_release_v1") {
              const versions = message.rawHeaders.flatMap((value, index) => index % 2 === 0 && value.toLowerCase() === "x-github-api-version-selected" ? [message.rawHeaders[index + 1]] : []);
              if (versions.length !== 1 || versions[0] !== "2026-03-10") throw new ContextCollectionError("response_invalid"); selectedApiVersion = versions[0];
            }
            message.on("data", data); message.once("end", end); message.on("error", failed); message.once("aborted", incomplete); message.once("close", responseClosed);
          } catch (error) { fail(error); }
        });
        if (done) { request.on("error", swallow); request.destroy(); return; }
        request.on("error", failed); request.once("close", requestClosed); request.once("socket", onSocket); request.once("information", incomplete); request.once("upgrade", upgraded); guard(); request.end();
      } catch (error) { fail(error); }
    });
    guard(); const result = freeze({ kind: "bounded_public_context_response" as const, target, authority: input, startedAt, retrievedAt: new Date().toISOString(), rawText: capture.rawText, response: { status: 200, ...capture.response }, apiVersion: { requested: target.kind === "nodejs_latest_release_v1" ? "2026-03-10" : null, selected: capture.selectedApiVersion }, provenance: { transport: mode, networkObservation: mode === "native_https" ? "native_runtime_observation" : "simulated_unverified", logicalDnsOperations: 1, httpRequests: 1, redirects: 0, applicationRetries: 0, peerIPv4: address, addressPolicy: policy, bodyEvents: capture.chunks }, validation: "media_and_utf8_only_unreviewed" as const });
    responseStates.set(result, { guard, monotonic, mode }); return result;
  } catch (error) { throw error instanceof ContextCollectionError ? error : new ContextCollectionError("network_unavailable"); }
  finally { clearTimeout(timer); if (signal) EventTarget.prototype.removeEventListener.call(signal, "abort", abort); try { resolver?.cancel(); } catch {} }
}
export type PublicContextResponse = Awaited<ReturnType<typeof retrieve>>;
export function retrievePublicContext(target: unknown, authority: unknown, signal?: AbortSignal): Promise<PublicContextResponse> { return retrieve(target, authority, nativeIO, "native_https", signal); }
export function createInjectedPublicContextTransport(io: ContextCollectorIO): (target: unknown, authority: unknown, signal?: AbortSignal) => Promise<PublicContextResponse> { return (target, authority, signal) => retrieve(target, authority, io, "injected_test_io", signal); }
