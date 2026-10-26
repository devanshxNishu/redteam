import { sha256 } from "./evidence.ts";
import type { IncomingMessage } from "node:http";
import { isDeepStrictEqual } from "node:util";
import { fields, freeze, integer, text, timestamp } from "./context-data.ts";
import { ContextCollectionError, parsePublicContextAuthority, retrievePublicContext, createInjectedPublicContextTransport, checkPublicContextResponse, assertNativePublicContextResponse, describePublicContextTarget, publicContextHeaders, permittedContextIPv4 } from "./public-context-http.ts";
import type { ContextCollectorIO, PublicContextAuthority, PublicContextResponse } from "./public-context-http.ts";

export interface NodeReleaseCollection extends PublicContextAuthority { schemaVersion: "1.0"; kind: "node_release_collection_input"; adapter: "nodejs_latest_release_v1" }
export function parseNodeReleaseCollection(value: unknown): NodeReleaseCollection {
  try {
    const raw = fields(value, ["schemaVersion", "kind", "adapter", "permissions", "limits"]);
    if (raw.schemaVersion !== "1.0" || raw.kind !== "node_release_collection_input" || raw.adapter !== "nodejs_latest_release_v1") throw 0;
    return freeze({ schemaVersion: "1.0", kind: "node_release_collection_input", adapter: "nodejs_latest_release_v1", ...parsePublicContextAuthority({ permissions: raw.permissions, limits: raw.limits }) });
  } catch { throw new ContextCollectionError("invalid_input"); }
}
function providedTime(value: unknown, retrievedAt: string) {
  const raw = text(value, 24); if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/u.test(raw)) throw 0;
  const time = Date.parse(raw); if (!Number.isFinite(time) || time > Date.parse(retrievedAt)) throw 0;
  const canonical = new Date(time).toISOString(), precision = raw.includes(".") ? "millisecond" as const : "second" as const;
  if ((precision === "second" ? canonical.replace(".000Z", "Z") : canonical) !== raw) throw 0;
  return { raw, canonical, precision };
}
function boundedJSON(value: unknown): void {
  const pending = [{ value, depth: 0 }]; let nodes = 0;
  while (pending.length) {
    const current = pending.pop()!; if (++nodes > 2048 || current.depth > 8) throw 0;
    if (typeof current.value === "string") { if (current.value.length > 20000 || /[\uD800-\uDFFF]/u.test(current.value)) throw 0; }
    else if (typeof current.value === "number") { if (!Number.isFinite(current.value)) throw 0; }
    else if (current.value && typeof current.value === "object") {
      const entries = Object.entries(current.value); if (entries.length > (Array.isArray(current.value) ? 100 : 80)) throw 0;
      for (const [key, child] of entries) { if (key.length > 100) throw 0; pending.push({ value: child, depth: current.depth + 1 }); }
    }
  }
}
function release(rawText: string, retrievedAt: string) {
  const value: unknown = JSON.parse(rawText); boundedJSON(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw 0;
  const required = ["url", "assets_url", "upload_url", "html_url", "id", "author", "node_id", "tag_name", "target_commitish", "name", "draft", "immutable", "prerelease", "created_at", "updated_at", "published_at", "assets", "tarball_url", "zipball_url", "body"];
  const optional = ["reactions", "discussion_url", "mentions_count"].filter(key => Object.hasOwn(value, key));
  const raw = fields(value, [...required, ...optional]), id = integer(raw.id, Number.MAX_SAFE_INTEGER), tag = text(raw.tag_name, 80);
  if (!/^v\d{1,4}\.\d{1,4}\.\d{1,4}$/u.test(tag) || raw.draft !== false || raw.prerelease !== false || typeof raw.immutable !== "boolean") throw 0;
  const url = `https://api.github.com/repos/nodejs/node/releases/${id}`, htmlURL = `https://github.com/nodejs/node/releases/tag/${tag}`;
  if (raw.url !== url || raw.html_url !== htmlURL || raw.assets_url !== `${url}/assets` || raw.upload_url !== `https://uploads.github.com/repos/nodejs/node/releases/${id}/assets{?name,label}`
    || raw.tarball_url !== `https://api.github.com/repos/nodejs/node/tarball/${tag}` || raw.zipball_url !== `https://api.github.com/repos/nodejs/node/zipball/${tag}`) throw 0;
  if (!Array.isArray(raw.assets) || raw.assets.length > 20 || !raw.author || typeof raw.author !== "object" || Array.isArray(raw.author)) throw 0;
  text(raw.node_id, 120); text(raw.target_commitish, 200);
  if (typeof raw.body !== "string" || !raw.body.trim() || raw.body.length > 16000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/u.test(raw.body)) throw 0;
  const providedName = raw.name === null ? null : text(raw.name, 300);
  return { id, repository: "nodejs/node", tag, title: providedName ?? tag, providedName, url, htmlURL, publisher: "Node.js public repository release",
    timestamps: { published: providedTime(raw.published_at, retrievedAt), created: providedTime(raw.created_at, retrievedAt), providedUpdated: providedTime(raw.updated_at, retrievedAt) }, materialUpdatedAt: null,
    announcement: { bytes: Buffer.byteLength(raw.body), sha256: sha256(raw.body), format: "untrusted_markdown_literal" }, assetCount: raw.assets.length, draft: false, prerelease: false, providerImmutableFlag: raw.immutable,
    applicability: { regions: ["global"], language: "en", topics: ["nodejs", "software-releases"], basis: "One public repository release only; global does not imply every country, supported app version, stakeholder or language." }, latestMeaning: "Provider latest-full-release selection; not guaranteed newest publication or appropriate version for an app." };
}
const nativeCaptures = new WeakMap<object, number>();
export function assertNativeNodeReleaseCapture(value: unknown, notBefore?: number): undefined {
  if (!value || typeof value !== "object" || !nativeCaptures.has(value) || notBefore !== undefined && (!Number.isFinite(notBefore) || notBefore < 0 || nativeCaptures.get(value)! < notBefore)) throw new ContextCollectionError("not_native"); return undefined;
}
type ReleaseObservation = Pick<PublicContextResponse, "target" | "rawText" | "startedAt" | "retrievedAt" | "response" | "apiVersion" | "provenance">;
function captureObject(input: NodeReleaseCollection, observed: ReleaseObservation, finishedAt?: string) {
  const parsed = release(observed.rawText, observed.retrievedAt);
  if (observed.target.kind !== "nodejs_latest_release_v1" || observed.apiVersion.requested !== "2026-03-10" || observed.apiVersion.selected !== "2026-03-10") throw 0;
  return freeze({ schemaVersion: "1.0", kind: "node_release_capture", policyVersion: "nodejs-release-capture-v1", input, inputSha256: sha256(JSON.stringify(input)), request: { url: observed.target.url, apiVersion: observed.apiVersion },
    startedAt: observed.startedAt, retrievedAt: observed.retrievedAt, finishedAt: finishedAt ?? new Date().toISOString(), body: { text: observed.rawText, bytes: Buffer.byteLength(observed.rawText), sha256: sha256(observed.rawText) }, response: observed.response, release: parsed, provenance: observed.provenance,
    boundaries: { semanticReview: "unreviewed", publisherFacts: "not_independently_authenticated", toolAuthority: "not_granted", linksFollowed: 0, assetsDownloaded: 0, externalProcessing: "not_authorized", redistribution: "not_authorized", training: "not_authorized", storedSource: false, packetIntegrated: false, currentGlobalAwareness: "not_established", behavioralValidity: false } });
}
async function collect(value: unknown, transport: (target: unknown, authority: unknown, signal?: AbortSignal) => Promise<PublicContextResponse>, signal?: AbortSignal) {
  const input = parseNodeReleaseCollection(value), observed = await transport({ kind: "nodejs_latest_release_v1" }, { permissions: input.permissions, limits: input.limits }, signal);
  checkPublicContextResponse(observed); let result;
  try { result = captureObject(input, observed); } catch { throw new ContextCollectionError("response_invalid"); }
  checkPublicContextResponse(observed);
  if (observed.provenance.transport === "native_https") nativeCaptures.set(result, assertNativePublicContextResponse(observed)); return result;
}
export type NodeReleaseCapture = Awaited<ReturnType<typeof collect>>;
export function collectNodeRelease(value: unknown, signal?: AbortSignal): Promise<NodeReleaseCapture> { return collect(value, retrievePublicContext, signal); }
export function createInjectedNodeReleaseCollector(io: ContextCollectorIO): (value: unknown, signal?: AbortSignal) => Promise<NodeReleaseCapture> {
  const transport = createInjectedPublicContextTransport(io); return (value, signal) => collect(value, transport, signal);
}
export function nodeReleaseReceipt(capture: NodeReleaseCapture) { const { body, ...rest } = capture; return freeze({ ...rest, body: { bytes: body.bytes, sha256: body.sha256 } }); }

/** Checked historical local claim only. Reconstruction never creates a native capability. */
export function readRecordedNodeReleaseCapture(value: unknown, rawText: string): NodeReleaseCapture {
  try {
    const raw = fields(value, ["schemaVersion", "kind", "policyVersion", "input", "inputSha256", "request", "startedAt", "retrievedAt", "finishedAt", "body", "response", "release", "provenance", "boundaries"]);
    const input = parseNodeReleaseCollection(raw.input), startedAt = timestamp(raw.startedAt), retrievedAt = timestamp(raw.retrievedAt), finishedAt = timestamp(raw.finishedAt);
    const start = Date.parse(startedAt), retrieved = Date.parse(retrievedAt), finish = Date.parse(finishedAt);
    if (retrieved < start || finish < retrieved || finish >= start + input.limits.timeoutMs || Date.parse(input.permissions.expiresAt) <= start + input.limits.timeoutMs || typeof rawText !== "string" || !Buffer.byteLength(rawText) || Buffer.byteLength(rawText) > input.limits.maximumBytes
      || new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(Buffer.from(rawText)) !== rawText) throw 0;
    const response = fields(raw.response, ["status", "contentType", "contentLength", "date", "lastModified"]); if (response.status !== 200) throw 0;
    const rawHeaders = ["content-type", text(response.contentType, 512)];
    if (response.contentLength !== null) rawHeaders.push("content-length", String(integer(response.contentLength, input.limits.maximumBytes)));
    for (const [key, header] of [["date", "date"], ["lastModified", "last-modified"]] as const) if (response[key] !== null) { const value = response[key]; if (typeof value !== "string" || value.length > 512) throw 0; rawHeaders.push(header, value); }
    const checkedHeaders = publicContextHeaders({ rawHeaders } as IncomingMessage, input.limits.maximumBytes); if (checkedHeaders.contentLength !== null && checkedHeaders.contentLength !== Buffer.byteLength(rawText)) throw 0;
    const provenance = fields(raw.provenance, ["transport", "networkObservation", "logicalDnsOperations", "httpRequests", "redirects", "applicationRetries", "peerIPv4", "addressPolicy", "bodyEvents"]);
    if (provenance.transport !== "native_https" || !permittedContextIPv4(provenance.peerIPv4)) throw 0;
    const observed: ReleaseObservation = { target: describePublicContextTarget({ kind: "nodejs_latest_release_v1" }), startedAt, retrievedAt, rawText, response: { status: 200, ...checkedHeaders }, apiVersion: { requested: "2026-03-10", selected: "2026-03-10" },
      provenance: { transport: "native_https", networkObservation: "native_runtime_observation", logicalDnsOperations: 1, httpRequests: 1, redirects: 0, applicationRetries: 0, peerIPv4: provenance.peerIPv4, addressPolicy: "public-ipv4-iana-2025-10-09-v1", bodyEvents: integer(provenance.bodyEvents, 8192) } };
    const capture = captureObject(input, observed, finishedAt); if (!isDeepStrictEqual(value, nodeReleaseReceipt(capture))) throw 0; return capture;
  } catch { throw new ContextCollectionError("response_invalid"); }
}
