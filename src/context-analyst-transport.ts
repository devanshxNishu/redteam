import { isDeepStrictEqual } from "node:util";
import { sha256 } from "./evidence.ts";
import { parseContextAnalystConfiguration } from "./context-analyst-config.ts";
import { checkContextAnalystPreparationAccess, checkContextAnalystFinalizationAccess } from "./context-analyst-config.ts";
import type { ContextAnalystPreparation } from "./context-analyst-config.ts";
import { verifySavedContextAnalystManifest, verifyContextAnalystFinalizationFiles } from "./context-analyst-artifacts.ts";
import type { WorkspaceStore } from "./workspace.ts";
import { contextAnalyticalResponseSchema } from "./context-analyst-generation.ts";
import { validateContextAnalyticalResponse, readContextAnalyticalPacket } from "./context-analysis.ts";
import { checkContextAnalystInvocationBinding, readContextAnalystInvocationOrigin } from "./context-analyst-invocation.ts";
import type { ContextAnalystInvocations } from "./context-analyst-invocation.ts";
import type { ContextAnalystPhase, ContextAnalystGenerationPhase } from "./context-analyst-invocation.ts";
import type { BudgetAmount } from "./budget.ts";

type Preparation = ContextAnalystPreparation;
type Check = Pick<ReturnType<typeof validateContextAnalyticalResponse>, "response" | "checks" | "tracksNotCovered">;
type Failure = "phase_denied" | "interrupted" | "request_failed" | "redirect_denied" | "http_error" | "response_too_large" | "invalid_utf8" | "invalid_json" | "invalid_envelope" | "invalid_count" | "budget_overrun";
type Rejection = "refused" | "incomplete" | "provider_failed" | "provider_model_mismatch" | "usage_unavailable" | "preflight_mismatch" | "invalid_output";
export class ContextAnalystTransportError extends Error {
  readonly code: Failure;
  constructor(code: Failure) { super(`Context analyst provider phase failed: ${code}.`); this.code = code; }
}
const endpoint = "https://api.openai.com/v1/responses";
const limits = Object.freeze({ requestBytes: 520000, countResponseBytes: 16384, generationResponseBytes: 1000000, analyticalResponseBytes: 32768, bodyReads: 8192 });
function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function integer(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function cancel(body: ReadableStream<Uint8Array> | null): void { try { void body?.cancel().catch(() => {}); } catch { /* Cancellation must not delay the bounded caller. */ } }
function abortable<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((accept, reject) => {
    const aborted = () => { signal.removeEventListener("abort", aborted); reject(new ContextAnalystTransportError("interrupted")); };
    signal.addEventListener("abort", aborted, { once: true });
    pending.then(value => { signal.removeEventListener("abort", aborted); accept(value); }, error => { signal.removeEventListener("abort", aborted); reject(error); });
    if (signal.aborted) aborted();
  });
}
async function bodyJSON(response: Response, signal: AbortSignal, maximum: number, deadline: number): Promise<{ body: Record<string, unknown>; sha256: string }> {
  if (!response.body) throw new ContextAnalystTransportError("invalid_envelope");
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0, reads = 0, completed = false;
  try {
    while (true) {
      if (signal.aborted || Date.now() >= deadline) throw new ContextAnalystTransportError("interrupted");
      if (++reads > limits.bodyReads) throw new ContextAnalystTransportError("response_too_large");
      const next = await abortable(reader.read(), signal);
      if (next.done) { completed = true; break; }
      size += next.value.byteLength;
      if (size > maximum) throw new ContextAnalystTransportError("response_too_large");
      chunks.push(next.value);
    }
    const bytes = Buffer.concat(chunks); let text: string, body: unknown;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new ContextAnalystTransportError("invalid_utf8"); }
    try { body = JSON.parse(text); } catch { throw new ContextAnalystTransportError("invalid_json"); }
    if (!record(body)) throw new ContextAnalystTransportError("invalid_envelope");
    return { body, sha256: sha256(bytes) };
  } finally {
    if (!completed) { try { void reader.cancel().catch(() => {}); } catch { /* Keep partial usage unknown. */ } }
    try { reader.releaseLock(); } catch { /* A hostile injected stream cannot delay cleanup. */ }
  }
}
interface Candidate {
  status: "checked_unreviewed" | "rejected";
  reason: Rejection | null;
  check: Check | null;
  provider: { responseId: string | null; model: string | null; status: string | null; responseSha256: string };
}
/** Original checked preparation/publication only. Internal helper; no environment lookup or run command. */
async function prepareTransport(store: WorkspaceStore, preparation: Preparation, apiKey: string, transport: typeof fetch, runtimeRoute: "explicitly_injected_fetch" | "default_runtime_fetch") {
  if (typeof apiKey !== "string" || apiKey.length < 8 || apiKey.length > 2048 || /[^\x21-\x7e]/u.test(apiKey) || typeof transport !== "function") throw new ContextAnalystTransportError("phase_denied");
  checkContextAnalystPreparationAccess(store, preparation); await verifySavedContextAnalystManifest(store, preparation);
  const config = parseContextAnalystConfiguration(preparation.manifest.configuration), manifest = preparation.manifest, generation = preparation.generation;
  const packet = await readContextAnalyticalPacket(store, config.context.snapshotId), { packetSha256, ...packetBase } = packet;
  if (preparation.kind !== "context_analyst_run_preparation" || preparation.state !== "not_started" || preparation.manifestSha256 !== sha256(JSON.stringify(manifest))
    || manifest.configurationSha256 !== sha256(JSON.stringify(config)) || manifest.generationSha256 !== sha256(JSON.stringify(generation)) || config.context.generationSha256 !== manifest.generationSha256
    || manifest.instructionsSha256 !== sha256(generation.instructions) || manifest.inputSha256 !== sha256(generation.input) || manifest.schemaSha256 !== sha256(JSON.stringify(generation.text.format.schema))
    || packetSha256 !== sha256(JSON.stringify(packetBase)) || packetSha256 !== manifest.packetSha256 || packetSha256 !== config.context.packetSha256 || generation.input !== JSON.stringify(packet)
    || !isDeepStrictEqual(packet.brief, manifest.source) || packet.context.snapshotRecordSha256 !== manifest.context.snapshotRecordSha256
    || !isDeepStrictEqual(generation.text, { format: { type: "json_schema", name: "redteam_context_analytical_review_v1", strict: true, schema: contextAnalyticalResponseSchema(packet) } })) throw new ContextAnalystTransportError("phase_denied");
  await verifySavedContextAnalystManifest(store, preparation); checkContextAnalystPreparationAccess(store, preparation);
  const common = { model: config.model, instructions: generation.instructions, input: generation.input, text: generation.text, tools: [], tool_choice: "none", truncation: "disabled" };
  const countBody = JSON.stringify(common), generationBody = JSON.stringify({ ...common, max_output_tokens: config.limits.maximumOutputTokens, store: false, stream: false, background: false });
  const secret = (value: string) => value.includes(apiKey) || value.includes(JSON.stringify(apiKey).slice(1, -1));
  if (Buffer.byteLength(countBody) > limits.requestBytes || Buffer.byteLength(generationBody) > limits.requestBytes || secret(generation.input) || secret(countBody) || secret(generationBody)) throw new ContextAnalystTransportError("phase_denied");
  const identity = Object.freeze({ runId: manifest.runId, taskId: manifest.taskId, sha256: preparation.manifestSha256 });
  const metadata = freeze({ policyVersion: "brief-context-analyst-openai-v1", provider: "openai", model: config.model, manifestSha256: identity.sha256, packetSha256, configurationSha256: manifest.configurationSha256,
    context: { snapshotId: manifest.context.snapshotId, snapshotRecordSha256: manifest.context.snapshotRecordSha256, asOf: manifest.context.asOf, timeBasis: manifest.context.timeBasis }, processingRecordSha256: manifest.processing.recordSha256, countRequestSha256: sha256(countBody), generationRequestSha256: sha256(generationBody), limits, liveVerification: "not_performed", costBasis: "configured_rate_estimate", countBilling: "not_inferred" });
  const inputRate = BigInt(config.pricing.inputUsdPerMillion.split(".")[0]!) * 1000000n + BigInt((config.pricing.inputUsdPerMillion.split(".")[1] ?? "").padEnd(6, "0"));
  const outputRate = BigInt(config.pricing.outputUsdPerMillion.split(".")[0]!) * 1000000n + BigInt((config.pricing.outputUsdPerMillion.split(".")[1] ?? "").padEnd(6, "0"));
  const deadline = Date.parse(manifest.inferenceDeadlineAt), expiry = Date.parse(manifest.processing.effectiveExpiresAt);
  let used = false;
  const safeId = (value: unknown) => typeof value === "string" && value.length > 0 && value.length <= 200 && !/[^\x21-\x7e]/u.test(value) && !secret(value) ? value : null;
  const usage = (body: Record<string, unknown>): BudgetAmount | null => {
    if (body.object !== "response" || body.model !== config.model || !safeId(body.id) || !record(body.usage)) return null;
    const { input_tokens: input, output_tokens: output, total_tokens: total } = body.usage;
    if (!integer(input) || !integer(output) || !integer(total) || !Number.isSafeInteger(input + output) || total !== input + output) return null;
    const cost = (BigInt(input) * inputRate + BigInt(output) * outputRate + 999999n) / 1000000n;
    return cost <= BigInt(Number.MAX_SAFE_INTEGER) ? { tokens: total, costMicrousd: Number(cost) } : null;
  };
  const decode = (body: Record<string, unknown>, digest: string, counted: number): { value: Candidate; usage: BudgetAmount | null } => {
    const receipt = usage(body), provider = { responseId: safeId(body.id), model: safeId(body.model), status: ["completed", "incomplete", "failed", "cancelled", "queued", "in_progress"].includes(body.status as string) ? body.status as string : null, responseSha256: digest };
    const rejected = (reason: Rejection) => ({ value: { status: "rejected" as const, reason, check: null, provider }, usage: receipt });
    if (body.object !== "response" || !provider.responseId || !provider.model) return rejected("invalid_output");
    if (body.model !== config.model) return rejected("provider_model_mismatch");
    if (body.status === "incomplete") return rejected("incomplete");
    if (body.status !== "completed" || body.error != null || body.incomplete_details != null) return rejected("provider_failed");
    if (!Array.isArray(body.output)) return rejected("invalid_output");
    let messages = 0, size = 0; const texts: string[] = [];
    for (const item of body.output) {
      if (!record(item)) return rejected("invalid_output");
      if (item.type === "reasoning") continue; // Never return hidden reasoning or request another step.
      if (item.type !== "message" || item.role !== "assistant" || item.status !== "completed" || !Array.isArray(item.content) || ++messages > 1) return rejected("invalid_output");
      for (const content of item.content) {
        if (!record(content)) return rejected("invalid_output");
        if (content.type === "refusal") return rejected("refused");
        if (content.type !== "output_text" || typeof content.text !== "string" || (content.annotations !== undefined && (!Array.isArray(content.annotations) || content.annotations.length))) return rejected("invalid_output");
        size += Buffer.byteLength(content.text); if (size > limits.analyticalResponseBytes) return rejected("invalid_output"); texts.push(content.text);
      }
    }
    if (!receipt) return rejected("usage_unavailable");
    const rawUsage = body.usage as Record<string, unknown>;
    if (rawUsage.input_tokens !== counted || (rawUsage.output_tokens as number) > config.limits.maximumOutputTokens) return rejected("preflight_mismatch");
    if (!messages || !texts.length || secret(JSON.stringify(body))) return rejected("invalid_output");
    try {
      const validated = validateContextAnalyticalResponse(JSON.parse(texts.join("")), packet), check: Check = { response: validated.response, checks: validated.checks, tracksNotCovered: validated.tracksNotCovered };
      if (secret(JSON.stringify(check.response))) return rejected("invalid_output");
      return { value: { status: "checked_unreviewed", reason: null, check, provider }, usage: receipt };
    } catch { return rejected("invalid_output"); }
  };
  return Object.freeze({ metadata, run: async (phases: ContextAnalystInvocations) => {
    let checkedSignal: AbortSignal | undefined;
    let phase: "count" | "generation" = "count", failure: Failure | null = null, counted: number | null = null, countedResponseSha256: string | null = null, overrun = false;
    const requestsStarted = { count: false, generation: false };
    const result = (status: "failed", reason: Failure) => freeze({ schemaVersion: "2.0", kind: "context_analyst_transport_result", status, reason, phase, check: null, provider: null, countedInputTokens: counted, countResponseSha256: countedResponseSha256 as string | null, generationLiability: "not_returned" as const, requestsStarted, metadata });
    if (used) return result("failed", "phase_denied"); used = true;
    const post = async (context: ContextAnalystPhase, url: string, body: string, maximum: number) => {
      try {
        try { await phases.checkTransmissionFiles(); checkContextAnalystInvocationBinding(store, preparation, phases); } catch { throw new ContextAnalystTransportError("phase_denied"); }
        if (context.signal.aborted || Date.now() >= deadline || Date.now() >= expiry) throw new ContextAnalystTransportError("interrupted");
        requestsStarted[phase] = true;
        const pending = Promise.resolve(transport(url, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body, signal: context.signal, redirect: "error" }));
        void pending.then(response => { if (context.signal.aborted) cancel(response.body); }, () => {}).catch(() => {});
        const response = await abortable(pending, context.signal);
        if (response.redirected || (response.status >= 300 && response.status < 400) || (response.url && response.url !== url)) { cancel(response.body); throw new ContextAnalystTransportError("redirect_denied"); }
        if (!response.ok) { cancel(response.body); throw new ContextAnalystTransportError("http_error"); }
        return await bodyJSON(response, context.signal, maximum, deadline);
      } catch (error) {
        failure = error instanceof ContextAnalystTransportError ? error.code : "request_failed";
        throw new ContextAnalystTransportError(failure);
      }
    };
    try {
      checkContextAnalystInvocationBinding(store, preparation, phases); checkedSignal = phases.signal;
      phases.assertManifest(identity);
      counted = await phases.count(async context => {
        const { body, sha256: digest } = await post(context, endpoint + "/input_tokens", countBody, limits.countResponseBytes); countedResponseSha256 = digest;
        if (body.object !== "response.input_tokens" || !integer(body.input_tokens) || body.input_tokens < 1 || body.input_tokens > config.limits.maximumInputTokens) { failure = "invalid_count"; throw new ContextAnalystTransportError(failure); }
        return body.input_tokens;
      });
      phase = "generation";
      const generated = await phases.generate(async (context: ContextAnalystGenerationPhase) => {
        if (context.inputTokens !== counted || context.maximumOutputTokens !== config.limits.maximumOutputTokens) { failure = "phase_denied"; throw new ContextAnalystTransportError(failure); }
        const { body, sha256: digest } = await post(context, endpoint, generationBody, limits.generationResponseBytes), decoded = decode(body, digest, context.inputTokens);
        if (decoded.usage && (decoded.usage.tokens > context.maximum.tokens || decoded.usage.costMicrousd > context.maximum.costMicrousd)) overrun = true;
        return decoded;
      });
      checkContextAnalystInvocationBinding(store, preparation, phases);
      const value = freeze({ schemaVersion: "2.0", kind: "context_analyst_transport_result", ...generated.value, phase, countedInputTokens: counted, countResponseSha256: countedResponseSha256 as string | null, generationLiability: generated.liability, requestsStarted, metadata });
      const resultSha256 = sha256(JSON.stringify(value)), observedAt = new Date().toISOString(), origin = readContextAnalystInvocationOrigin(store, preparation, phases);
      checkContextAnalystInvocationBinding(store, preparation, phases);
      observations.set(value, { store, preparation, observation: freeze({ schemaVersion: "2.0", kind: "context_analyst_transport_observation", runtimeRoute, provenance: "local_runtime_assertion_not_independent_provider_evidence", observedAt, resultSha256, ...origin }) });
      return value;
    } catch { return result("failed", checkedSignal?.aborted ? "interrupted" : overrun ? "budget_overrun" : failure ?? "phase_denied"); }
  } });
}

/** Read-only setup has its own frozen inference cutoff; late file reads cannot return a usable transport. */
export async function createOpenAIContextAnalystTransport(store: WorkspaceStore, preparation: Preparation, apiKey: string, suppliedTransport?: typeof fetch) {
  const runtimeRoute = suppliedTransport === undefined ? "default_runtime_fetch" : "explicitly_injected_fetch", transport = suppliedTransport === undefined ? fetch : suppliedTransport;
  if (typeof apiKey !== "string" || apiKey.length < 8 || apiKey.length > 2048 || /[^\x21-\x7e]/u.test(apiKey) || typeof transport !== "function") throw new ContextAnalystTransportError("phase_denied");
  checkContextAnalystPreparationAccess(store, preparation);
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), Math.max(1, Date.parse(preparation.manifest.inferenceDeadlineAt) - Date.now())); timer.unref();
  try { const result = await abortable(prepareTransport(store, preparation, apiKey, transport, runtimeRoute), controller.signal); checkContextAnalystPreparationAccess(store, preparation); return result; }
  finally { clearTimeout(timer); }
}

export type ContextAnalystTransportResult = Awaited<ReturnType<Awaited<ReturnType<typeof createOpenAIContextAnalystTransport>>["run"]>>;
type Observation = Readonly<{ schemaVersion: string; kind: string; runtimeRoute: "explicitly_injected_fetch" | "default_runtime_fetch"; provenance: string; observedAt: string; resultSha256: string; taskId: string; attempt: number; fence: number }>;
const observations = new WeakMap<object, { store: WorkspaceStore; preparation: Preparation; observation: Observation }>();

/** Actual returned object only. Data checks during finalization grant no publication, ownership or replay. */
export async function inspectContextAnalystTransportObservation(store: WorkspaceStore, preparation: Preparation, result: unknown) {
  try {
    const checked = observations.get(result as object);
    if (!checked || checked.store !== store || checked.preparation !== preparation) throw new Error();
    const { observation } = checked, now = Date.now(), at = Date.parse(observation.observedAt);
    checkContextAnalystFinalizationAccess(store, preparation);
    if (at < Date.parse(preparation.manifest.preparedAt) || at >= Date.parse(preparation.manifest.inferenceDeadlineAt) || at > now || sha256(JSON.stringify(result)) !== observation.resultSha256) throw new Error();
    await verifyContextAnalystFinalizationFiles(store, preparation);
    checkContextAnalystFinalizationAccess(store, preparation);
    if (Date.now() < at) throw new Error();
    return observation;
  } catch { throw new ContextAnalystTransportError("phase_denied"); }
}
