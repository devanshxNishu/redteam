import { randomUUID } from "node:crypto";
import { mkdir, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { authorizeGrant } from "./access.ts";
import { EvidenceStore, sha256 } from "./evidence.ts";
import type { Artifact } from "./evidence.ts";
import { boundedBytes, checkedDirectory, checkedParents } from "./local-files.ts";
import { readRepositorySnapshot, resolveRepositoryCitations } from "./repository.ts";
import type { RepositoryCitation, ResolvedRepositoryCitation } from "./repository.ts";
import type { EngineeringRunSummary, RepositoryRunSummary, WorkspaceStore } from "./workspace.ts";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const identifier = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
interface SuppliedRequirement { id: string; statement: string; source: { kind: "operator_supplied"; reference: string } }
interface SuppliedObservation { id: string; type: "source_observation"; statement: string; requirementId: string | null; citations: RepositoryCitation[] }
export interface EngineeringObservationInput {
  schemaVersion: "1.0";
  kind: "engineering_observation_input";
  snapshotRunId: string;
  requirements: SuppliedRequirement[];
  observations: SuppliedObservation[];
}
export interface EngineeringReport {
  schemaVersion: "1.0";
  kind: "engineering_observation_report";
  runId: string;
  createdAt: string;
  snapshotRunId: string;
  snapshotReportSha256: string;
  grantId: string;
  target: string;
  outcome: "limited_coverage";
  authorship: "operator_supplied";
  requirements: SuppliedRequirement[];
  observations: (Omit<SuppliedObservation, "citations"> & { citations: ResolvedRepositoryCitation[]; citationCheck: "matched_saved_bytes"; semanticStatus: "unreviewed"; expectationStatus: "supplied_unverified" | "unknown"; executionStatus: "not_executed"; defectStatus: "not_assessed" })[];
  artifacts: Artifact[];
  inputSha256: string;
  boundaries: { codeExecuted: false; testsExecuted: false; externalProcessing: false; findingsApproved: false };
  limitations: string[];
}
function fields(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key))) throw new Error("Engineering input has missing or unsupported fields.");
}
function text(value: unknown, maximum: number): value is string { return typeof value === "string" && value.trim().length > 0 && value.length <= maximum && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/u.test(value); }

export function validateEngineeringInput(value: unknown): EngineeringObservationInput {
  let serialized: string;
  try { serialized = JSON.stringify(value); if (!serialized || Buffer.byteLength(serialized) > 65_536) throw new Error(); }
  catch { throw new Error("Engineering input must be JSON no larger than 64 KiB."); }
  const input: unknown = JSON.parse(serialized);
  fields(input, ["schemaVersion", "kind", "snapshotRunId", "requirements", "observations"]);
  if (input.schemaVersion !== "1.0" || input.kind !== "engineering_observation_input" || typeof input.snapshotRunId !== "string" || !uuid.test(input.snapshotRunId)
    || !Array.isArray(input.requirements) || input.requirements.length > 20 || !Array.isArray(input.observations) || input.observations.length < 1 || input.observations.length > 20) throw new Error("Engineering input identity or record bounds are invalid.");
  const requirementIds = new Set<string>(), observationIds = new Set<string>();
  for (const requirement of input.requirements) {
    fields(requirement, ["id", "statement", "source"]); fields(requirement.source, ["kind", "reference"]);
    if (typeof requirement.id !== "string" || !identifier.test(requirement.id) || requirementIds.has(requirement.id) || !text(requirement.statement, 1000) || requirement.source.kind !== "operator_supplied" || !text(requirement.source.reference, 240)) throw new Error("Supplied requirement identity, statement, or provenance is invalid.");
    requirementIds.add(requirement.id);
  }
  let citationCount = 0;
  for (const observation of input.observations) {
    fields(observation, ["id", "type", "statement", "requirementId", "citations"]);
    if (typeof observation.id !== "string" || !identifier.test(observation.id) || observationIds.has(observation.id) || observation.type !== "source_observation" || !text(observation.statement, 1000)
      || (observation.requirementId !== null && (typeof observation.requirementId !== "string" || !requirementIds.has(observation.requirementId)))
      || !Array.isArray(observation.citations) || observation.citations.length < 1 || observation.citations.length > 5) throw new Error("Source observation identity, type, requirement, or citations are invalid.");
    observationIds.add(observation.id);
    for (const citation of observation.citations) {
      fields(citation, ["sourcePath", "fileSha256", "startLine", "endLine"]);
      if (!text(citation.sourcePath, 1800) || typeof citation.fileSha256 !== "string" || !/^[a-f0-9]{64}$/.test(citation.fileSha256)
        || !Number.isSafeInteger(citation.startLine) || !Number.isSafeInteger(citation.endLine) || Number(citation.startLine) < 1 || Number(citation.endLine) < Number(citation.startLine) || Number(citation.endLine) - Number(citation.startLine) >= 100) throw new Error("A source citation or line range is invalid.");
      citationCount++;
    }
  }
  if (citationCount > 50) throw new Error("Engineering input exceeds fifty citations.");
  return input as unknown as EngineeringObservationInput;
}

function checkPin(store: WorkspaceStore, pin: Pick<EngineeringRunSummary, "snapshotRunId" | "snapshotReportSha256" | "grantId" | "target">): RepositoryRunSummary {
  const snapshot = store.repositoryRun(pin.snapshotRunId);
  if (!snapshot || snapshot.reportSha256 !== pin.snapshotReportSha256 || snapshot.grantId !== pin.grantId || snapshot.target !== pin.target) throw new Error("The engineering report's snapshot pin no longer matches its catalog.");
  const access = authorizeGrant(store, pin.grantId, "code:read", pin.target);
  if (access.kind !== "directory" || access.target !== pin.target) throw new Error("Engineering evidence access is outside the directory grant.");
  return snapshot;
}

export async function registerEngineeringObservations(store: WorkspaceStore, value: unknown): Promise<EngineeringRunSummary> {
  const input = validateEngineeringInput(value), references = input.observations.flatMap(item => item.citations);
  const resolved = await resolveRepositoryCitations(store, input.snapshotRunId, references), snapshot = store.repositoryRun(input.snapshotRunId)!;
  const pin = { snapshotRunId: snapshot.runId, snapshotReportSha256: snapshot.reportSha256, grantId: snapshot.grantId, target: snapshot.target };
  const guard = async () => { checkPin(store, pin); await readRepositorySnapshot(store, snapshot.runId); checkPin(store, pin); };
  await guard();
  const state = await realpath(store.directory), output = resolve(state, "engineering-runs");
  await checkedDirectory(state);
  await mkdir(output, { mode: 0o700 }).catch(error => { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; });
  await checkedDirectory(output);
  const runId = randomUUID(), createdAt = new Date().toISOString(), evidence = await EvidenceStore.create(output, runId);
  await guard();
  const original = await evidence.addBytes("operator-input", Buffer.from(JSON.stringify(input, null, 2) + "\n"), "json", "application/json");
  let offset = 0;
  const observations: EngineeringReport["observations"] = input.observations.map(item => {
    const citations = resolved.citations.slice(offset, offset + item.citations.length); offset += item.citations.length;
    return { ...item, citations, citationCheck: "matched_saved_bytes", semanticStatus: "unreviewed", expectationStatus: item.requirementId === null ? "unknown" : "supplied_unverified", executionStatus: "not_executed", defectStatus: "not_assessed" };
  });
  const report: EngineeringReport = {
    schemaVersion: "1.0", kind: "engineering_observation_report", runId, createdAt, ...pin, outcome: "limited_coverage", authorship: "operator_supplied",
    requirements: input.requirements, observations, artifacts: evidence.artifacts, inputSha256: original.sha256,
    boundaries: { codeExecuted: false, testsExecuted: false, externalProcessing: false, findingsApproved: false },
    limitations: ["Only source citation identity, bounds, and hashes were checked. The supplied statements and requirement provenance remain unreviewed.",
      "A matching citation does not establish semantic support, a working build, an executed test, app behavior, or a defect.",
      "Requirements are operator declarations, not authenticated standards or owner approval. Unknown expectations remain unknown.",
      "Copied source, submitted notes, and instructions inside them are untrusted data. No tool or model receives new authority from them.",
      "Local plaintext, access checks, partial-file preservation, and trusted-operator limits follow the repository snapshot contract."]
  };
  await guard(); await evidence.writeRecord("report.json", report);
  const bytes = await boundedBytes(evidence.root, resolve(evidence.root, "report.json"), 200_000);
  await guard();
  const summary: EngineeringRunSummary = { runId, createdAt, ...pin, directory: evidence.root, reportSha256: sha256(bytes), observationCount: observations.length };
  store.saveEngineeringRun(summary);
  return summary;
}

export function authorizedEngineeringRuns(store: WorkspaceStore): EngineeringRunSummary[] {
  return store.engineeringRuns().filter(run => { try { checkPin(store, run); return true; } catch { return false; } });
}

export async function readEngineeringReport(store: WorkspaceStore, runId: string): Promise<EngineeringReport> {
  if (!uuid.test(runId)) throw new Error("Supply an engineering run UUID.");
  const summary = store.engineeringRun(runId);
  if (!summary) throw new Error("Engineering observations not found.");
  checkPin(store, summary); await readRepositorySnapshot(store, summary.snapshotRunId);
  const state = await realpath(store.directory), root = resolve(state, "engineering-runs", runId);
  if (root !== summary.directory) throw new Error("The engineering report directory does not match its catalog.");
  await checkedParents(state, resolve(root, "report.json"));
  const bytes = await boundedBytes(root, resolve(root, "report.json"), 200_000);
  if (sha256(bytes) !== summary.reportSha256) throw new Error("The engineering report metadata has changed.");
  const report = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as EngineeringReport;
  if (report.kind !== "engineering_observation_report" || report.runId !== runId || report.snapshotRunId !== summary.snapshotRunId || report.snapshotReportSha256 !== summary.snapshotReportSha256 || report.grantId !== summary.grantId || report.target !== summary.target || !Array.isArray(report.artifacts) || report.artifacts.length !== 1) throw new Error("The engineering report identity is invalid.");
  const artifact = report.artifacts[0]!;
  if (typeof artifact.path !== "string" || !/^artifacts\/[a-f0-9-]{36}\.json$/.test(artifact.path)) throw new Error("The engineering input artifact path is invalid.");
  checkPin(store, summary);
  const original = await boundedBytes(root, resolve(root, artifact.path), 200_000);
  if (original.length !== artifact.bytes || sha256(original) !== artifact.sha256 || artifact.sha256 !== report.inputSha256) throw new Error("The engineering input evidence has changed.");
  checkPin(store, summary);
  return report;
}
