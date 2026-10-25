import { lstat, realpath } from "node:fs/promises";
import { basename, isAbsolute, resolve } from "node:path";
import { boundedBytes, checkedParents } from "./local-files.ts";
import { sha256 } from "./evidence.ts";
import type { ReviewReport } from "./domain/review.ts";
import type { WorkspaceStore } from "./workspace.ts";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
function object(value: unknown): asserts value is Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The browser evidence record is invalid."); }
export interface FixtureEvidencePin { reviewId: string; evidenceRunId: string; directory: string; reportSha256: string; variant: "broken" | "fixed" }
export interface FixtureEvidence { pin: FixtureEvidencePin; report: ReviewReport; artifactBytes: ReadonlyMap<string, Buffer> }
export function checkFixturePin(store: WorkspaceStore, pin: FixtureEvidencePin): undefined {
  const job = store.job(pin.reviewId);
  if (!job || job.reportDirectory !== pin.directory || job.variant !== pin.variant || !["completed", "limited_coverage"].includes(job.status) || basename(pin.directory) !== pin.evidenceRunId) throw new Error("The controlled browser review pin is unavailable.");
  return undefined;
}

/** Verifies basic identity and bounded saved bytes; semantic coverage is a caller-owned check. */
export async function readFixtureEvidence(store: WorkspaceStore, reviewId: string): Promise<FixtureEvidence> {
  if (!uuid.test(reviewId)) throw new Error("Supply a browser review/job UUID.");
  const job = store.job(reviewId);
  if (!job?.reportDirectory || !["completed", "limited_coverage"].includes(job.status)) throw new Error("The controlled browser review is unavailable.");
  const workspace = await realpath(resolve(store.directory, ".."));
  if (!isAbsolute(job.reportDirectory) || (await lstat(job.reportDirectory)).isSymbolicLink()) throw new Error("The browser review directory is unsafe.");
  const directory = await realpath(job.reportDirectory), evidenceRunId = basename(directory);
  if (!uuid.test(evidenceRunId) || ![resolve(workspace, ".redteam/runs", evidenceRunId), resolve(workspace, "outputs/runs", evidenceRunId)].includes(directory)) throw new Error("The browser review directory is outside supported workspace roots.");
  await checkedParents(workspace, resolve(directory, "report.json"));
  const bytes = await boundedBytes(directory, resolve(directory, "report.json"), 2_000_000), report: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  object(report); object(report.manifest);
  if (report.schemaVersion !== "1.0" || report.runId !== evidenceRunId || report.manifest.runId !== evidenceRunId || report.manifest.mode !== "deterministic_local_fixture" || report.manifest.fixtureVariant !== job.variant
    || typeof report.outcome !== "string" || !["completed", "findings_found", "limited_coverage"].includes(report.outcome) || !Array.isArray(report.findings) || report.findings.length > 100
    || !Array.isArray(report.artifacts) || report.artifacts.length < 1 || report.artifacts.length > 20) throw new Error("The controlled browser review record is invalid.");
  const ids = new Set<string>(), paths = new Set<string>(), artifactBytes = new Map<string, Buffer>(); let total = 0;
  for (const item of report.artifacts) {
    object(item);
    if (typeof item.id !== "string" || !uuid.test(item.id) || ids.has(item.id) || typeof item.path !== "string" || !/^artifacts\/[a-f0-9-]{36}\.[a-z]{1,10}$/.test(item.path) || paths.has(item.path)
      || typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isSafeInteger(item.bytes) || Number(item.bytes) < 0 || Number(item.bytes) > 5_000_000 || (total += Number(item.bytes)) > 20_000_000) throw new Error("Browser evidence exceeds the supported integrity boundaries.");
    ids.add(item.id); paths.add(item.path);
    const content = await boundedBytes(directory, resolve(directory, item.path), 5_000_000);
    if (content.length !== item.bytes || sha256(content) !== item.sha256) throw new Error("The browser finding evidence has changed.");
    artifactBytes.set(item.id, content);
  }
  const pin: FixtureEvidencePin = { reviewId, evidenceRunId, directory: job.reportDirectory, reportSha256: sha256(bytes), variant: job.variant };
  checkFixturePin(store, pin);
  return { pin, report: report as unknown as ReviewReport, artifactBytes };
}
