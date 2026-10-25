import { randomUUID } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import { basename, isAbsolute, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { authorizeGrant } from "./access.ts";
import { boundedBytes, checkedParents } from "./local-files.ts";
import { sha256 } from "./evidence.ts";
import { readEngineeringReport } from "./engineering.ts";
import type { WorkspaceStore } from "./workspace.ts";
import { ActionConflictError } from "./domain/actions.ts";
import type { ActionInput, ActionOrigin, ActionOriginPin, ActionRecord, ActionStatus } from "./domain/actions.ts";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const identifier = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const statuses: ActionStatus[] = ["proposed", "in_progress", "blocked", "completed_declared", "cancelled"];
function object(value: unknown): asserts value is Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an action JSON object."); }
function exact(value: unknown, keys: string[]): asserts value is Record<string, unknown> { object(value); if (Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key))) throw new Error("Action input has missing or unsupported fields."); }
function text(value: unknown, maximum: number): value is string { return typeof value === "string" && value.trim().length > 0 && value.length <= maximum && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/u.test(value); }
function clone(value: unknown): unknown {
  try { const serialized = JSON.stringify(value); if (!serialized || Buffer.byteLength(serialized) > 16_384) throw new Error(); return JSON.parse(serialized); }
  catch { throw new Error("Action input must be JSON no larger than sixteen KiB."); }
}
function validateOrigin(value: unknown): asserts value is ActionOrigin {
  exact(value, ["kind", "runId", "itemId"]);
  if (typeof value.runId !== "string" || !uuid.test(value.runId) || typeof value.itemId !== "string"
    || (value.kind === "browser_finding" ? !uuid.test(value.itemId) : value.kind === "engineering_observation" ? !identifier.test(value.itemId) : true)) throw new Error("The action origin must name an existing finding or source note.");
}
export function validateActionInput(value: unknown): ActionInput {
  const input = clone(value); exact(input, ["schemaVersion", "kind", "origin", "title", "owner", "nextStep", "validationMethod"]); validateOrigin(input.origin);
  if (input.schemaVersion !== "1.0" || input.kind !== "action_input" || !text(input.title, 200) || !text(input.owner, 120) || !text(input.nextStep, 2000) || !text(input.validationMethod, 2000)) throw new Error("The action title, owner, step, or validation method is invalid.");
  return input as unknown as ActionInput;
}

function checkOriginAccess(store: WorkspaceStore, pin: ActionOriginPin): undefined {
  if (pin.kind === "engineering_observation") {
    const catalog = store.engineeringRun(pin.runId);
    if (!catalog || !pin.access || catalog.directory !== pin.directory || catalog.runId !== pin.evidenceRunId || catalog.reportSha256 !== pin.reportSha256 || catalog.grantId !== pin.access.grantId || catalog.target !== pin.access.target) throw new Error("The action origin pin no longer matches its source.");
    const grant = authorizeGrant(store, pin.access.grantId, "code:read", pin.access.target);
    if (grant.kind !== "directory" || grant.target !== pin.access.target) throw new Error("The action is outside current source permission.");
  } else {
    const job = store.job(pin.runId);
    if (!job || job.reportDirectory !== pin.directory || !["completed", "limited_coverage"].includes(job.status) || pin.access !== null || basename(pin.directory) !== pin.evidenceRunId) throw new Error("The action's browser review is unavailable.");
  }
  return undefined;
}

async function resolveOrigin(store: WorkspaceStore, origin: ActionOrigin): Promise<ActionOriginPin> {
  if (origin.kind === "engineering_observation") {
    const report = await readEngineeringReport(store, origin.runId), catalog = store.engineeringRun(origin.runId)!;
    if (report.observations.filter(item => item.id === origin.itemId).length !== 1) throw new Error("The engineering observation does not exist.");
    return { ...origin, evidenceRunId: report.runId, directory: catalog.directory, reportSha256: catalog.reportSha256, sourceStatus: "unreviewed", access: { grantId: catalog.grantId, target: catalog.target } };
  }
  const job = store.job(origin.runId);
  if (!job?.reportDirectory || !["completed", "limited_coverage"].includes(job.status)) throw new Error("The browser finding is unavailable.");
  const workspace = await realpath(resolve(store.directory, ".."));
  if (!isAbsolute(job.reportDirectory) || (await lstat(job.reportDirectory)).isSymbolicLink()) throw new Error("The browser finding directory is unsafe.");
  const directory = await realpath(job.reportDirectory);
  const evidenceRunId = basename(directory);
  if (!uuid.test(evidenceRunId) || ![resolve(workspace, ".redteam/runs", evidenceRunId), resolve(workspace, "outputs/runs", evidenceRunId)].includes(directory)) throw new Error("The browser finding directory is outside the supported workspace roots.");
  await checkedParents(workspace, resolve(directory, "report.json"));
  const bytes = await boundedBytes(directory, resolve(directory, "report.json"), 2_000_000), report: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  object(report); object(report.manifest);
  if (report.schemaVersion !== "1.0" || report.runId !== evidenceRunId || report.manifest.runId !== evidenceRunId || report.manifest.mode !== "deterministic_local_fixture" || report.manifest.fixtureVariant !== job.variant || typeof report.outcome !== "string" || !["completed", "findings_found", "limited_coverage"].includes(report.outcome)
    || !Array.isArray(report.findings) || report.findings.length > 100 || !Array.isArray(report.artifacts) || report.artifacts.length < 1 || report.artifacts.length > 20) throw new Error("The browser finding record is invalid.");
  const findings = report.findings.filter(item => item && typeof item === "object" && item.id === origin.itemId);
  if (findings.length !== 1 || findings[0].type !== "observed_requirement_mismatch" || !["reproduced", "not_reproduced", "inconclusive"].includes(findings[0].status)) throw new Error("The browser finding does not resolve uniquely.");
  const ids = new Set<string>(), paths = new Set<string>(); let total = 0;
  for (const item of report.artifacts) {
    object(item);
    if (typeof item.id !== "string" || !uuid.test(item.id) || ids.has(item.id) || typeof item.path !== "string" || !/^artifacts\/[a-f0-9-]{36}\.[a-z]{1,10}$/.test(item.path) || paths.has(item.path)
      || typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isSafeInteger(item.bytes) || Number(item.bytes) < 0 || Number(item.bytes) > 5_000_000 || (total += Number(item.bytes)) > 20_000_000) throw new Error("Browser evidence exceeds the supported integrity boundaries.");
    ids.add(item.id); paths.add(item.path);
    const content = await boundedBytes(directory, resolve(directory, item.path), 5_000_000);
    if (content.length !== item.bytes || sha256(content) !== item.sha256) throw new Error("The browser finding evidence has changed.");
  }
  return { ...origin, evidenceRunId, directory: job.reportDirectory, reportSha256: sha256(bytes), sourceStatus: findings[0].status, access: null };
}

async function verifyOrigin(store: WorkspaceStore, pin: ActionOriginPin): Promise<void> {
  checkOriginAccess(store, pin);
  const current = await resolveOrigin(store, { kind: pin.kind, runId: pin.runId, itemId: pin.itemId });
  if (!isDeepStrictEqual(current, pin)) throw new Error("The action's original source has changed.");
  checkOriginAccess(store, pin);
}

function checkedRecord(store: WorkspaceStore, id: string) {
  if (!uuid.test(id)) throw new Error("Supply an action UUID.");
  const { record: action, events } = store.actionSnapshot(id); if (!action) throw new Error("Action not found.");
  checkOriginAccess(store, action.origin);
  if (!Number.isInteger(action.revision) || action.revision < 1 || action.revision > 100 || events.length !== action.revision || !isDeepStrictEqual(events.at(-1)?.after, action)) throw new Error("The action revision history is inconsistent.");
  for (const [index, event] of events.entries()) {
    if (event.actionId !== id || event.revision !== index + 1 || event.operation !== (index ? "updated" : "created") || event.after.id !== id || event.after.revision !== index + 1 || !isDeepStrictEqual(event.after.origin, action.origin)
      || event.after.createdAt !== action.createdAt || event.after.authorship !== "operator_supplied" || event.after.verificationStatus !== "not_independently_verified" || event.after.execution !== "not_performed_by_tracking" || !statuses.includes(event.after.status)) throw new Error("The action revision history is inconsistent.");
  }
  return { record: action, events };
}

export async function createTrackedAction(store: WorkspaceStore, value: unknown): Promise<ActionRecord> {
  const input = validateActionInput(value), origin = await resolveOrigin(store, input.origin), now = new Date().toISOString();
  const action: ActionRecord = { ...input, kind: "tracked_action", id: randomUUID(), revision: 1, origin, createdAt: now, updatedAt: now, status: "proposed", authorship: "operator_supplied", verificationStatus: "not_independently_verified", execution: "not_performed_by_tracking" };
  store.saveAction(action, 0, "Operator created a plan. No external action was performed.", () => checkOriginAccess(store, origin));
  return action;
}

export async function readTrackedAction(store: WorkspaceStore, id: string) {
  const action = checkedRecord(store, id).record; await verifyOrigin(store, action.origin);
  // Return one consistent revision even when another operator updates during source inspection.
  const current = checkedRecord(store, id);
  if (current.record.revision !== action.revision) throw new ActionConflictError("The action changed during inspection. Read it again.");
  return { ...current, limitations: ["Owner, plan, progress, and completion are operator declarations, not independent validation.", "Tracking performs no code, test, model, message, payment, or external task assignment.", "Current source access and integrity govern the whole record and its history."] };
}

export function authorizedActionSummaries(store: WorkspaceStore) {
  return store.recentActions().flatMap(action => {
    try { const current = checkedRecord(store, action.id).record; return [{ id: current.id, revision: current.revision, title: current.title, owner: current.owner, status: current.status, updatedAt: current.updatedAt, origin: { kind: current.origin.kind, runId: current.origin.runId, itemId: current.origin.itemId }, recordStatus: "cataloged_unverified" as const }]; }
    catch { return []; }
  });
}

export async function updateTrackedAction(store: WorkspaceStore, id: string, value: unknown): Promise<ActionRecord> {
  const input = clone(value); object(input);
  const editable = ["title", "owner", "nextStep", "validationMethod", "status"], keys = Object.keys(input);
  if (keys.some(key => !["schemaVersion", "kind", "expectedRevision", "note", ...editable].includes(key)) || input.schemaVersion !== "1.0" || input.kind !== "action_update" || !Number.isSafeInteger(input.expectedRevision)
    || Number(input.expectedRevision) < 1 || !text(input.note, 1000) || !editable.some(key => key in input)) throw new Error("Supply an action update, expected revision, and a note.");
  for (const [key, maximum] of [["title", 200], ["owner", 120], ["nextStep", 2000], ["validationMethod", 2000]] as const) if (key in input && !text(input[key], maximum)) throw new Error("An action update field is invalid.");
  if ("status" in input && (typeof input.status !== "string" || !statuses.includes(input.status as ActionStatus))) throw new Error("Action progress must use a supported declaration status.");
  const action = checkedRecord(store, id).record; if (action.revision !== input.expectedRevision) throw new ActionConflictError("The action changed. Read its current revision before updating.");
  if (action.revision >= 100) throw new Error("This action reached its 100-revision limit.");
  await verifyOrigin(store, action.origin);
  const changes = Object.fromEntries(editable.filter(key => key in input).map(key => [key, input[key]]));
  if (Object.entries(changes).every(([key, value]) => action[key as keyof ActionRecord] === value)) throw new Error("The action update changes no tracked field.");
  const updated: ActionRecord = { ...action, ...changes, revision: action.revision + 1, updatedAt: new Date().toISOString() };
  store.saveAction(updated, action.revision, input.note, () => checkOriginAccess(store, action.origin));
  return updated;
}
