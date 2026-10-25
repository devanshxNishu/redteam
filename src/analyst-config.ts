import { randomUUID } from "node:crypto";
import { sha256 } from "./evidence.ts";
import { prepareAnalystGeneration } from "./analyst-generation.ts";
import { readAnalyticalPacket } from "./analytical-review.ts";
import { analystTaskPolicy } from "./analyst-task.ts";
import type { AnalystTaskPolicy } from "./analyst-task.ts";
import type { WorkspaceStore } from "./workspace.ts";

export interface AnalystPhaseCap { tokens: number; costMicrousd: number }
export interface AnalystConfiguration {
  schemaVersion: "1.0";
  kind: "analyst_configuration";
  provider: "openai";
  model: string;
  pricing: { inputUsdPerMillion: string; outputUsdPerMillion: string };
  processing: { mode: "external"; provider: "openai"; scope: "exact_brief_packet_and_generation"; briefId: string; packetSha256: string; authorized: true; basis: string; expiresAt: string };
  limits: { maximumInputTokens: number; maximumOutputTokens: number; count: AnalystPhaseCap; generation: AnalystPhaseCap; timeoutMs: number; finalizationMs: number };
  taskPolicy: AnalystTaskPolicy;
}
export class AnalystConfigurationError extends Error {}
const deny = (): never => { throw new AnalystConfigurationError("Analyst configuration or source binding is invalid or unavailable."); };
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return deny();
  const descriptors = Object.getOwnPropertyDescriptors(value), names = Reflect.ownKeys(descriptors);
  if (names.length !== keys.length || names.some(key => typeof key !== "string" || !keys.includes(key))) return deny();
  const copy: Record<string, unknown> = Object.create(null);
  for (const key of keys) { const field = descriptors[key]; if (!field?.enumerable || !("value" in field)) return deny(); copy[key] = field.value; }
  return copy;
}
function integer(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) return deny(); return value;
}
function rate(value: unknown): { text: string; units: bigint } {
  if (typeof value !== "string" || value.length > 32 || !/^\d+(\.\d{1,6})?$/.test(value)) return deny();
  const [whole, fraction = ""] = value.split("."), units = BigInt(whole!) * 1000000n + BigInt(fraction.padEnd(6, "0"));
  if (units < 1n || units > BigInt(Number.MAX_SAFE_INTEGER)) return deny();
  const tail = (units % 1000000n).toString().padStart(6, "0").replace(/0+$/, "");
  return { text: (units / 1000000n).toString() + (tail ? "." + tail : ""), units };
}
function cap(value: unknown): AnalystPhaseCap {
  const fields = object(value, ["tokens", "costMicrousd"]);
  return { tokens: integer(fields.tokens, 1, 2000000), costMicrousd: integer(fields.costMicrousd, 1) };
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { for (const item of Object.values(value)) freeze(item); Object.freeze(value); } return value;
}
function maximumCost(input: number, output: number, inputRate: bigint, outputRate: bigint): number {
  const cost = (BigInt(input) * inputRate + BigInt(output) * outputRate + 999999n) / 1000000n;
  if (cost > BigInt(Number.MAX_SAFE_INTEGER)) return deny(); return Number(cost);
}

/** Public data only. Parsing records an operator declaration, not verified rights or live compatibility. */
export function parseAnalystConfiguration(value: unknown): Readonly<AnalystConfiguration> {
  const fields = object(value, ["schemaVersion", "kind", "provider", "model", "pricing", "processing", "limits", "taskPolicy"]);
  if (fields.schemaVersion !== "1.0" || fields.kind !== "analyst_configuration" || fields.provider !== "openai"
    || typeof fields.model !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/.test(fields.model)) return deny();
  const pricing = object(fields.pricing, ["inputUsdPerMillion", "outputUsdPerMillion"]), inputRate = rate(pricing.inputUsdPerMillion), outputRate = rate(pricing.outputUsdPerMillion);
  const processing = object(fields.processing, ["mode", "provider", "scope", "briefId", "packetSha256", "authorized", "basis", "expiresAt"]);
  if (processing.mode !== "external" || processing.provider !== "openai" || processing.scope !== "exact_brief_packet_and_generation" || processing.authorized !== true
    || typeof processing.briefId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(processing.briefId)
    || typeof processing.packetSha256 !== "string" || !/^[a-f0-9]{64}$/.test(processing.packetSha256)
    || typeof processing.basis !== "string" || !processing.basis.trim() || processing.basis.length > 500 || /[\x00-\x1f\x7f-\x9f]/u.test(processing.basis)
    || typeof processing.expiresAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(processing.expiresAt)
    || !Number.isFinite(Date.parse(processing.expiresAt)) || new Date(processing.expiresAt).toISOString() !== processing.expiresAt) return deny();
  const limits = object(fields.limits, ["maximumInputTokens", "maximumOutputTokens", "count", "generation", "timeoutMs", "finalizationMs"]);
  const maximumInputTokens = integer(limits.maximumInputTokens, 1, 1000000), maximumOutputTokens = integer(limits.maximumOutputTokens, 16, 1000000), count = cap(limits.count), generation = cap(limits.generation);
  if (count.tokens < maximumInputTokens || generation.tokens < maximumInputTokens + maximumOutputTokens
    || generation.costMicrousd < maximumCost(maximumInputTokens, maximumOutputTokens, inputRate.units, outputRate.units)
    || BigInt(count.costMicrousd) + BigInt(generation.costMicrousd) > BigInt(Number.MAX_SAFE_INTEGER)) return deny();
  const rawPolicy = object(fields.taskPolicy, ["leaseMs", "heartbeatMs"]);
  let taskPolicy: AnalystTaskPolicy;
  try { taskPolicy = analystTaskPolicy({ leaseMs: integer(rawPolicy.leaseMs, 1, 60000), heartbeatMs: integer(rawPolicy.heartbeatMs, 1, 59999) }); } catch { return deny(); }
  return freeze({ schemaVersion: "1.0", kind: "analyst_configuration", provider: "openai", model: fields.model,
    pricing: { inputUsdPerMillion: inputRate.text, outputUsdPerMillion: outputRate.text },
    processing: { mode: "external", provider: "openai", scope: "exact_brief_packet_and_generation", briefId: processing.briefId, packetSha256: processing.packetSha256, authorized: true, basis: processing.basis, expiresAt: processing.expiresAt },
    limits: { maximumInputTokens, maximumOutputTokens, count, generation, timeoutMs: integer(limits.timeoutMs, 1, 300000), finalizationMs: integer(limits.finalizationMs, 1, 10000) }, taskPolicy });
}

/** Checked, unwritten run preparation. No environment, key, transport, task, ledger or result is opened. */
export async function prepareAnalystRun(store: WorkspaceStore, briefId: string, input: unknown) {
  // Normalize/copy before the first await; later caller mutations cannot alter authority.
  const configuration = parseAnalystConfiguration(input), generation = await prepareAnalystGeneration(store, briefId);
  if (configuration.processing.briefId !== briefId || configuration.processing.packetSha256 !== generation.packetSha256) return deny();
  const packet = await readAnalyticalPacket(store, briefId);
  if (packet.packetSha256 !== generation.packetSha256) return deny();
  const started = Date.now(), deadline = started + configuration.limits.timeoutMs, finalDeadline = deadline + configuration.limits.finalizationMs;
  if (!Number.isSafeInteger(started) || started < 0 || !Number.isSafeInteger(finalDeadline) || !Number.isFinite(new Date(finalDeadline).getTime()) || finalDeadline > Date.parse(configuration.processing.expiresAt)) return deny();
  const inputRate = rate(configuration.pricing.inputUsdPerMillion), outputRate = rate(configuration.pricing.outputUsdPerMillion);
  const manifest = { schemaVersion: "1.0" as const, kind: "analyst_run_manifest" as const, policyVersion: "brief-analyst-run-v1" as const,
    runId: randomUUID(), taskId: randomUUID(), questionKey: "supplied-brief-analysis", maximumAttempts: 1 as const,
    preparedAt: new Date(started).toISOString(), inferenceDeadlineAt: new Date(deadline).toISOString(), coordinatorDeadlineAt: new Date(finalDeadline).toISOString(),
    source: packet.brief, packetSha256: packet.packetSha256, generationPolicyVersion: generation.policyVersion,
    instructionsSha256: generation.instructionsSha256, schemaSha256: generation.schemaSha256, generationSha256: sha256(JSON.stringify(generation.generation)), generationPreviewSha256: generation.previewSha256,
    configurationSha256: sha256(JSON.stringify(configuration)), configuration,
    budget: { cap: { tokens: configuration.limits.count.tokens + configuration.limits.generation.tokens, costMicrousd: configuration.limits.count.costMicrousd + configuration.limits.generation.costMicrousd }, count: configuration.limits.count, generation: configuration.limits.generation, maximumConfiguredGenerationCostMicrousd: maximumCost(configuration.limits.maximumInputTokens, configuration.limits.maximumOutputTokens, inputRate.units, outputRate.units), costBasis: "operator_configured_estimate" as const, countCostBasis: "explicit_operator_liability_cap_not_assumed_free" as const },
    responseLimits: packet.limits, boundaries: { processingAuthority: "operator_declared_not_independently_verified", liveCompatibility: "not_checked", referencesOpened: false, modelCalls: 0, networkRequests: 0, taskCreated: false, budgetCreated: false, resultPublished: false, semanticReview: "unreviewed", stakeholderDecisions: "not_performed" } as const };
  const preparation = { schemaVersion: "1.0" as const, kind: "analyst_run_preparation" as const, state: "not_started" as const, manifest, manifestSha256: sha256(JSON.stringify(manifest)), generation: generation.generation };
  if (Buffer.byteLength(JSON.stringify(preparation, null, 2) + "\n") > 220000) return deny();
  return freeze(preparation);
}
