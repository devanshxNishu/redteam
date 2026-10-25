import { mkdir, lstat, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { boundedBytes, checkedDirectory, checkedParents } from "./local-files.ts";
import { publishExclusive } from "./publication.ts";
import { sha256 } from "./evidence.ts";
import { parseAnalystConfiguration } from "./analyst-config.ts";
import type { prepareAnalystRun } from "./analyst-config.ts";
import { prepareAnalystGeneration } from "./analyst-generation.ts";
import { readAnalyticalPacket } from "./analytical-review.ts";
import { readReviewBrief, checkReviewBriefAccess } from "./review-briefs.ts";
import { TaskStore } from "./tasks.ts";
import type { WorkspaceStore } from "./workspace.ts";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const bounds = Object.freeze({ manifestBytes: 16000, generationBytes: 220000 });
export class AnalystManifestError extends Error { constructor() { super("The saved analyst manifest, task or current source is unavailable."); } }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new AnalystManifestError(); return value as Record<string, unknown>; }
function timestamp(value: unknown): string { if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new AnalystManifestError(); return value; }
function rate(value: string): bigint { const [whole, fraction = ""] = value.split("."); return BigInt(whole!) * 1000000n + BigInt(fraction.padEnd(6, "0")); }
function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function json(bytes: Buffer): unknown { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown; }

async function checkedManifest(store: WorkspaceStore, value: unknown, suppliedGeneration: unknown) {
  const raw = object(value), config = parseAnalystConfiguration(raw.configuration);
  if (typeof raw.runId !== "string" || !uuid.test(raw.runId) || typeof raw.taskId !== "string" || !uuid.test(raw.taskId) || raw.runId === raw.taskId) throw new AnalystManifestError();
  const runId = raw.runId, taskId = raw.taskId;
  const preparedAt = timestamp(raw.preparedAt), inferenceDeadlineAt = timestamp(raw.inferenceDeadlineAt), coordinatorDeadlineAt = timestamp(raw.coordinatorDeadlineAt);
  if (Date.parse(inferenceDeadlineAt) - Date.parse(preparedAt) !== config.limits.timeoutMs
    || Date.parse(coordinatorDeadlineAt) - Date.parse(inferenceDeadlineAt) !== config.limits.finalizationMs || Date.parse(config.processing.expiresAt) < Date.parse(coordinatorDeadlineAt)) throw new AnalystManifestError();
  const summary = store.reviewBrief(config.processing.briefId); if (!summary) throw new AnalystManifestError();
  const source = await readReviewBrief(store, summary.id), preview = await prepareAnalystGeneration(store, summary.id), packet = await readAnalyticalPacket(store, summary.id);
  if (packet.packetSha256 !== preview.packetSha256 || packet.packetSha256 !== config.processing.packetSha256 || !isDeepStrictEqual(suppliedGeneration, preview.generation)) throw new AnalystManifestError();
  const maximumCost = Number((BigInt(config.limits.maximumInputTokens) * rate(config.pricing.inputUsdPerMillion) + BigInt(config.limits.maximumOutputTokens) * rate(config.pricing.outputUsdPerMillion) + 999999n) / 1000000n);
  const manifest = { schemaVersion: "1.0" as const, kind: "analyst_run_manifest" as const, policyVersion: "brief-analyst-run-v1" as const,
    runId, taskId, questionKey: "supplied-brief-analysis", maximumAttempts: 1 as const, preparedAt, inferenceDeadlineAt, coordinatorDeadlineAt,
    source: packet.brief, packetSha256: packet.packetSha256, generationPolicyVersion: preview.policyVersion, instructionsSha256: preview.instructionsSha256, schemaSha256: preview.schemaSha256,
    generationSha256: sha256(JSON.stringify(preview.generation)), generationPreviewSha256: preview.previewSha256, configurationSha256: sha256(JSON.stringify(config)), configuration: config,
    budget: { cap: { tokens: config.limits.count.tokens + config.limits.generation.tokens, costMicrousd: config.limits.count.costMicrousd + config.limits.generation.costMicrousd }, count: config.limits.count, generation: config.limits.generation, maximumConfiguredGenerationCostMicrousd: maximumCost, costBasis: "operator_configured_estimate" as const, countCostBasis: "explicit_operator_liability_cap_not_assumed_free" as const },
    responseLimits: packet.limits, boundaries: { processingAuthority: "operator_declared_not_independently_verified", liveCompatibility: "not_checked", referencesOpened: false, modelCalls: 0, networkRequests: 0, taskCreated: false, budgetCreated: false, resultPublished: false, semanticReview: "unreviewed", stakeholderDecisions: "not_performed" } as const };
  if (!isDeepStrictEqual(raw, manifest)) throw new AnalystManifestError();
  const guard = () => checkReviewBriefAccess(store, source, summary); guard();
  return { manifest, generation: preview.generation, guard };
}
async function privateBytes(state: string, file: string, maximum: number): Promise<Buffer> {
  if ((await lstat(file)).mode & 0o077) throw new AnalystManifestError();
  return boundedBytes(state, file, maximum);
}
async function privateDirectory(path: string): Promise<void> {
  await checkedDirectory(path); if ((await lstat(path)).mode & 0o077) throw new AnalystManifestError();
}

/** Saves only checked public manifest/generation bytes. It creates no task, ledger, provider or result. */
export async function saveAnalystManifest(store: WorkspaceStore, preparation: Awaited<ReturnType<typeof prepareAnalystRun>>) {
  try {
    const checked = await checkedManifest(store, preparation.manifest, preparation.generation);
    const manifestBytes = Buffer.from(JSON.stringify(checked.manifest)), generationBytes = Buffer.from(JSON.stringify(checked.generation));
    if (preparation.kind !== "analyst_run_preparation" || preparation.state !== "not_started" || manifestBytes.length > bounds.manifestBytes || generationBytes.length > bounds.generationBytes
      || preparation.manifestSha256 !== sha256(manifestBytes) || Date.now() >= Date.parse(checked.manifest.inferenceDeadlineAt)) throw new AnalystManifestError();
    const state = await realpath(store.directory), parent = resolve(state, "analyst-runs"), directory = resolve(parent, checked.manifest.runId);
    await privateDirectory(state);
    try { await mkdir(parent, { mode: 0o700 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    await privateDirectory(parent); checked.guard();
    await mkdir(directory, { mode: 0o700 }); await privateDirectory(directory);
    for (const [name, bytes, maximum] of [["manifest.json", manifestBytes, bounds.manifestBytes], ["generation.json", generationBytes, bounds.generationBytes]] as const) {
      const file = resolve(directory, name); await checkedParents(state, file); checked.guard(); await publishExclusive(file, bytes);
      if (!(await privateBytes(state, file, maximum)).equals(bytes)) throw new AnalystManifestError();
    }
    await checkedManifest(store, checked.manifest, checked.generation); checked.guard();
    if (Date.now() >= Date.parse(checked.manifest.inferenceDeadlineAt)) throw new AnalystManifestError();
    return freeze({ runId: checked.manifest.runId, taskId: checked.manifest.taskId, directory, manifestSha256: sha256(manifestBytes), generationSha256: sha256(generationBytes) });
  } catch { throw new AnalystManifestError(); }
}

/** Historical checked data only. Reading cannot acquire ownership or authorize another request. */
export async function readAnalystManifest(store: WorkspaceStore, taskId: string) {
  let tasks: TaskStore | undefined;
  try {
    if (!uuid.test(taskId)) throw new AnalystManifestError();
    const state = await realpath(store.directory); await privateDirectory(state);
    const database = resolve(state, "tasks.sqlite"), info = await lstat(database);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || (info.mode & 0o077)) throw new AnalystManifestError();
    tasks = new TaskStore(dirname(state)); const task = tasks.task(taskId);
    if (task.spec.kind !== "analyst" || task.spec.maximumAttempts !== 1 || task.spec.id !== taskId || !uuid.test(task.spec.runId)) throw new AnalystManifestError();
    const directory = resolve(state, "analyst-runs", task.spec.runId); await privateDirectory(state); await privateDirectory(resolve(state, "analyst-runs")); await privateDirectory(directory);
    const manifestBytes = await privateBytes(state, resolve(directory, "manifest.json"), bounds.manifestBytes), generationBytes = await privateBytes(state, resolve(directory, "generation.json"), bounds.generationBytes);
    if (sha256(manifestBytes) !== task.spec.manifestHash) throw new AnalystManifestError();
    const checked = await checkedManifest(store, json(manifestBytes), json(generationBytes));
    if (manifestBytes.toString("utf8") !== JSON.stringify(checked.manifest) || generationBytes.toString("utf8") !== JSON.stringify(checked.generation)
      || checked.manifest.runId !== task.spec.runId || checked.manifest.taskId !== taskId || checked.manifest.questionKey !== task.spec.questionKey || checked.manifest.coordinatorDeadlineAt !== task.spec.deadlineAt
      || !isDeepStrictEqual(tasks.task(taskId).spec, task.spec)) throw new AnalystManifestError();
    const currentManifest = await privateBytes(state, resolve(directory, "manifest.json"), bounds.manifestBytes), currentGeneration = await privateBytes(state, resolve(directory, "generation.json"), bounds.generationBytes);
    if (!currentManifest.equals(manifestBytes) || !currentGeneration.equals(generationBytes)) throw new AnalystManifestError(); checked.guard();
    return freeze({ schemaVersion: "1.0", kind: "saved_analyst_manifest", runId: task.spec.runId, taskId, directory, manifestSha256: sha256(manifestBytes), generationSha256: sha256(generationBytes), manifest: checked.manifest, generation: checked.generation, executionAuthority: "not_granted" });
  } catch { throw new AnalystManifestError(); } finally { tasks?.close(); }
}
