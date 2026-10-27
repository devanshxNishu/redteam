import { DatabaseSync } from "node:sqlite";
import { chmodSync, lstatSync, mkdirSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { ActionRecord, ActionEvent } from "./domain/actions.ts";
import { ActionConflictError } from "./domain/actions.ts";
import type { ComparisonSummary } from "./comparisons.ts";
import type { ExperimentPlanSummary } from "./experiments.ts";
import type { ReportExportSummary } from "./report-export.ts";
import type { OutcomeEvidenceSummary } from "./outcome-evidence.ts";
import type { ReviewBriefSummary } from "./review-briefs.ts";
import type { ContextSourceCatalog, ContextSourceState } from "./context-sources.ts";
import type { ContextSnapshotSummary } from "./context-snapshots.ts";
import type { ContextProcessingCatalog, ContextProcessingState } from "./context-processing.ts";
import { ContextDataError, ContextStateConflict } from "./context-data.ts";

export type GrantCapability = "browser:read" | "browser:interact" | "code:read" | "code:test";
export interface AccessGrant {
  id: string;
  name: string;
  kind: "web" | "directory";
  target: string;
  capabilities: GrantCapability[];
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  hasSession: boolean;
}
export type JobState = "queued" | "running" | "verifying" | "reporting" | "completed" | "limited_coverage" | "failed" | "interrupted";
export interface ReviewJob {
  id: string;
  variant: "broken" | "fixed";
  status: JobState;
  createdAt: string;
  updatedAt: string;
  reportDirectory: string | null;
  findingCount: number;
  artifactCount: number;
  error: string | null;
}
export interface ActorRunSummary {
  runId: string;
  taskId?: string;
  kind: "scripted_actor_demo" | "model_actor_run";
  createdAt: string;
  outcome: "completed" | "limited_coverage";
  directory: string;
  decisions: { domain?: "consumer" | "investor"; action?: string; outcome: string }[];
  artifacts: number;
  modelVersions?: { id: string; version: string }[];
}
export interface RepositoryRunSummary {
  runId: string;
  grantId: string;
  target: string;
  createdAt: string;
  directory: string;
  reportSha256: string;
  fileCount: number;
  totalBytes: number;
}
export interface EngineeringRunSummary {
  runId: string;
  snapshotRunId: string;
  snapshotReportSha256: string;
  grantId: string;
  target: string;
  createdAt: string;
  directory: string;
  reportSha256: string;
  observationCount: number;
}

export function workspaceDirectory(workspace: string): string {
  const directory = resolve(workspace, ".redteam");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (lstatSync(directory).isSymbolicLink()) throw new Error("The workspace state directory must not be a symbolic link.");
  chmodSync(directory, 0o700);
  return directory;
}

export class WorkspaceStore {
  readonly directory: string;
  private readonly db: DatabaseSync;

  constructor(workspace: string, options?: { readOnly: true }) {
    if (options !== undefined) {
      if (Object.getPrototypeOf(options) !== Object.prototype || Reflect.ownKeys(options).length !== 1 || Object.getOwnPropertyDescriptor(options, "readOnly")?.value !== true) throw new ContextDataError();
      const root = realpathSync(workspace), directory = resolve(root, ".redteam"), state = lstatSync(directory);
      if (!state.isDirectory() || state.isSymbolicLink() || state.mode & 0o077 || realpathSync(directory) !== directory) throw new ContextDataError();
      const file = resolve(directory, "workspace.sqlite"), check = () => {
        const currentState = lstatSync(directory);
        if (!currentState.isDirectory() || currentState.isSymbolicLink() || currentState.mode & 0o077 || currentState.dev !== state.dev || currentState.ino !== state.ino || realpathSync(directory) !== directory) throw new ContextDataError();
        const i = lstatSync(file);
        if (!i.isFile() || i.isSymbolicLink() || i.nlink !== 1 || i.mode & 0o077) throw new ContextDataError();
        for (const suffix of ["-wal", "-shm"]) {
          const sidecar = lstatSync(file + suffix, { throwIfNoEntry: false });
          if (sidecar && (!sidecar.isFile() || sidecar.isSymbolicLink() || sidecar.nlink !== 1 || sidecar.mode & 0o077)) throw new ContextDataError();
        }
        return i;
      }, pinned = check();
      this.directory = directory;
      this.db = new DatabaseSync(file, { readOnly: true, allowExtension: false, defensive: true, timeout: 1000 });
      try {
        const current = check();
        if (current.dev !== pinned.dev || current.ino !== pinned.ino || this.db.prepare("PRAGMA journal_mode").get()?.journal_mode !== "wal") throw new ContextDataError();
      } catch (error) { this.db.close(); throw error; }
      return;
    }
    this.directory = workspaceDirectory(workspace);
    const file = resolve(this.directory, "workspace.sqlite");
    if (lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error("The workspace database must not be a symbolic link.");
    this.db = new DatabaseSync(file);
    chmodSync(file, 0o600);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS grants (id TEXT PRIMARY KEY, document TEXT NOT NULL, session TEXT);
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, document TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS coordinator (slot INTEGER PRIMARY KEY CHECK(slot=1), owner TEXT NOT NULL, pid INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS actor_runs (id TEXT PRIMARY KEY, document TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS repository_runs (id TEXT PRIMARY KEY, document TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS engineering_runs (id TEXT PRIMARY KEY, document TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS actions (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, document TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS action_events (action_id TEXT NOT NULL, revision INTEGER NOT NULL, document TEXT NOT NULL, PRIMARY KEY(action_id, revision));
      CREATE TABLE IF NOT EXISTS comparisons (id TEXT PRIMARY KEY, document TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS experiment_plans (id TEXT PRIMARY KEY, document TEXT NOT NULL, frozen_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS report_exports (id TEXT PRIMARY KEY, document TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS outcome_evidence (id TEXT PRIMARY KEY, plan_id TEXT NOT NULL, comparison_id TEXT NOT NULL, document TEXT NOT NULL, registered_at TEXT NOT NULL, UNIQUE(plan_id, comparison_id));
      CREATE TABLE IF NOT EXISTS context_sources (id TEXT PRIMARY KEY, lineage_root_id TEXT NOT NULL, version INTEGER NOT NULL, revision INTEGER NOT NULL, document TEXT NOT NULL, imported_at TEXT NOT NULL, UNIQUE(lineage_root_id, version));
      CREATE TABLE IF NOT EXISTS context_source_events (source_id TEXT NOT NULL, revision INTEGER NOT NULL, document TEXT NOT NULL, PRIMARY KEY(source_id, revision));
      CREATE TABLE IF NOT EXISTS context_snapshots (id TEXT PRIMARY KEY, document TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS context_processing (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, packet_sha256 TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL, document TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS context_processing_active_scope ON context_processing(packet_sha256, provider, model) WHERE revision=1;
      CREATE TABLE IF NOT EXISTS context_processing_events (authorization_id TEXT NOT NULL, revision INTEGER NOT NULL, document TEXT NOT NULL, PRIMARY KEY(authorization_id, revision));
      CREATE TABLE IF NOT EXISTS review_briefs (id TEXT PRIMARY KEY, document TEXT NOT NULL, created_at TEXT NOT NULL);
    `);
  }

  private audit(action: string, entity: string): void {
    this.db.prepare("INSERT INTO audit(at, action, entity) VALUES (?, ?, ?)").run(new Date().toISOString(), action, entity);
  }

  acquireCoordinator(owner: string): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const lease = this.db.prepare("SELECT owner, pid FROM coordinator WHERE slot=1").get();
      if (lease) {
        let alive = true;
        try { process.kill(Number(lease.pid), 0); } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ESRCH") alive = false;
        }
        if (alive) throw new Error("A review service already owns this workspace. Use its dashboard or terminal connection.");
      }
      this.db.prepare("INSERT INTO coordinator(slot, owner, pid) VALUES (1, ?, ?) ON CONFLICT(slot) DO UPDATE SET owner=excluded.owner, pid=excluded.pid").run(owner, process.pid);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  releaseCoordinator(owner: string): void {
    this.db.prepare("DELETE FROM coordinator WHERE slot=1 AND owner=?").run(owner);
  }

  addGrant(grant: AccessGrant, encryptedSession: string | null): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("INSERT INTO grants(id, document, session) VALUES (?, ?, ?)").run(grant.id, JSON.stringify(grant), encryptedSession);
      this.audit("grant_created", grant.id);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  grants(): AccessGrant[] {
    return this.db.prepare("SELECT document FROM grants ORDER BY id").all().map(row => JSON.parse(String(row.document)) as AccessGrant);
  }

  grant(id: string): AccessGrant | null {
    const row = this.db.prepare("SELECT document FROM grants WHERE id = ?").get(id);
    return row ? JSON.parse(String(row.document)) as AccessGrant : null;
  }

  encryptedSession(id: string): string | null {
    const row = this.db.prepare("SELECT session FROM grants WHERE id = ?").get(id);
    return row?.session ? String(row.session) : null;
  }

  revokeGrant(id: string): AccessGrant {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const grant = this.grant(id);
      if (!grant) throw new Error("Access grant not found.");
      grant.revokedAt ??= new Date().toISOString();
      grant.hasSession = false;
      this.db.prepare("UPDATE grants SET document = ?, session = NULL WHERE id = ?").run(JSON.stringify(grant), id);
      this.audit("grant_revoked", id);
      this.db.exec("COMMIT");
      return grant;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  saveJob(job: ReviewJob): void {
    this.db.prepare("INSERT INTO jobs(id, document, created_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET document = excluded.document")
      .run(job.id, JSON.stringify(job), job.createdAt);
  }

  job(id: string): ReviewJob | null {
    const row = this.db.prepare("SELECT document FROM jobs WHERE id = ?").get(id);
    return row ? JSON.parse(String(row.document)) as ReviewJob : null;
  }

  jobs(): ReviewJob[] {
    return this.db.prepare("SELECT document FROM jobs ORDER BY created_at DESC").all().map(row => JSON.parse(String(row.document)) as ReviewJob);
  }

  createJob(variant: "broken" | "fixed"): ReviewJob {
    const now = new Date().toISOString();
    const job: ReviewJob = { id: randomUUID(), variant, status: "queued", createdAt: now, updatedAt: now, reportDirectory: null, findingCount: 0, artifactCount: 0, error: null };
    this.saveJob(job);
    return job;
  }

  recoverInterruptedJobs(): void {
    for (const job of this.jobs()) {
      if (["queued", "running", "verifying", "reporting"].includes(job.status)) {
        this.saveJob({ ...job, status: "interrupted", updatedAt: new Date().toISOString(), error: "The previous service stopped. This job was not replayed." });
      }
    }
  }

  auditLog(): { at: string; action: string; entity: string }[] {
    return this.db.prepare("SELECT at, action, entity FROM audit ORDER BY id DESC LIMIT 100").all()
      .map(row => ({ at: String(row.at), action: String(row.action), entity: String(row.entity) }));
  }

  saveActorRun(run: ActorRunSummary): void {
    this.db.prepare("INSERT INTO actor_runs(id, document, created_at) VALUES (?, ?, ?)").run(run.runId, JSON.stringify(run), run.createdAt);
  }

  actorRuns(): ActorRunSummary[] {
    return this.db.prepare("SELECT document FROM actor_runs ORDER BY created_at DESC").all().map(row => JSON.parse(String(row.document)) as ActorRunSummary);
  }

  actorRun(id: string): ActorRunSummary | null {
    const row = this.db.prepare("SELECT document FROM actor_runs WHERE id=?").get(id);
    return row ? JSON.parse(String(row.document)) as ActorRunSummary : null;
  }

  saveRepositoryRun(run: RepositoryRunSummary): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("INSERT INTO repository_runs(id, document, created_at) VALUES (?, ?, ?)").run(run.runId, JSON.stringify(run), run.createdAt);
      this.audit("repository_snapshot_saved", run.runId);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  repositoryRuns(): RepositoryRunSummary[] {
    return this.db.prepare("SELECT document FROM repository_runs ORDER BY created_at DESC").all().map(row => JSON.parse(String(row.document)) as RepositoryRunSummary);
  }

  repositoryRun(id: string): RepositoryRunSummary | null {
    const row = this.db.prepare("SELECT document FROM repository_runs WHERE id=?").get(id);
    return row ? JSON.parse(String(row.document)) as RepositoryRunSummary : null;
  }

  saveEngineeringRun(run: EngineeringRunSummary): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("INSERT INTO engineering_runs(id, document, created_at) VALUES (?, ?, ?)").run(run.runId, JSON.stringify(run), run.createdAt);
      this.audit("engineering_observations_saved", run.runId);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  engineeringRuns(): EngineeringRunSummary[] {
    return this.db.prepare("SELECT document FROM engineering_runs ORDER BY created_at DESC").all().map(row => JSON.parse(String(row.document)) as EngineeringRunSummary);
  }

  engineeringRun(id: string): EngineeringRunSummary | null {
    const row = this.db.prepare("SELECT document FROM engineering_runs WHERE id=?").get(id);
    return row ? JSON.parse(String(row.document)) as EngineeringRunSummary : null;
  }

  action(id: string): ActionRecord | null {
    const row = this.db.prepare("SELECT document FROM actions WHERE id=?").get(id);
    return row ? JSON.parse(String(row.document)) as ActionRecord : null;
  }

  recentActions(): ActionRecord[] {
    return this.db.prepare("SELECT document FROM actions ORDER BY updated_at DESC, id LIMIT 100").all().map(row => JSON.parse(String(row.document)) as ActionRecord);
  }

  actionEvents(id: string): ActionEvent[] {
    return this.db.prepare("SELECT document FROM action_events WHERE action_id=? ORDER BY revision LIMIT 100").all(id).map(row => JSON.parse(String(row.document)) as ActionEvent);
  }

  actionSnapshot(id: string): { record: ActionRecord | null; events: ActionEvent[] } {
    this.db.exec("BEGIN");
    try {
      const result = { record: this.action(id), events: this.actionEvents(id) };
      this.db.exec("COMMIT"); return result;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  saveAction(action: ActionRecord, expectedRevision: number, note: string, authorize: () => undefined): void {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= 100 || action.revision !== expectedRevision + 1) throw new Error("Action revisions must increase by one within the supported bound.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const authorization: unknown = authorize();
      if (authorization !== undefined) {
        if (authorization instanceof Promise) void authorization.catch(() => undefined);
        throw new Error("Action write permission checks must finish synchronously.");
      }
      if (expectedRevision === 0) {
        this.db.prepare("INSERT INTO actions(id, revision, document, updated_at) VALUES (?, ?, ?, ?)").run(action.id, action.revision, JSON.stringify(action), action.updatedAt);
      } else {
        const result = this.db.prepare("UPDATE actions SET revision=?, document=?, updated_at=? WHERE id=? AND revision=?").run(action.revision, JSON.stringify(action), action.updatedAt, action.id, expectedRevision);
        if (result.changes !== 1) throw new ActionConflictError("The action changed. Read its current revision before updating.");
      }
      const event: ActionEvent = { actionId: action.id, revision: action.revision, at: action.updatedAt, operation: expectedRevision === 0 ? "created" : "updated", note, after: action };
      this.db.prepare("INSERT INTO action_events(action_id, revision, document) VALUES (?, ?, ?)").run(action.id, action.revision, JSON.stringify(event));
      this.audit(expectedRevision === 0 ? "action_created" : "action_updated", action.id);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  saveComparison(summary: ComparisonSummary, authorize: () => undefined): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const authorization: unknown = authorize();
      if (authorization !== undefined) { if (authorization instanceof Promise) void authorization.catch(() => undefined); throw new Error("Comparison source checks must finish synchronously."); }
      this.db.prepare("INSERT INTO comparisons(id, document, created_at) VALUES (?, ?, ?)").run(summary.id, JSON.stringify(summary), summary.createdAt);
      this.audit("comparison_saved", summary.id); this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  comparison(id: string): ComparisonSummary | null {
    const row = this.db.prepare("SELECT document FROM comparisons WHERE id=?").get(id);
    return row ? JSON.parse(String(row.document)) as ComparisonSummary : null;
  }

  recentComparisons(): ComparisonSummary[] {
    return this.db.prepare("SELECT document FROM comparisons ORDER BY created_at DESC LIMIT 100").all().map(row => JSON.parse(String(row.document)) as ComparisonSummary);
  }

  saveExperimentPlan(summary: ExperimentPlanSummary, authorize: () => undefined): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const authorization: unknown = authorize();
      if (authorization !== undefined) { if (authorization instanceof Promise) void authorization.catch(() => undefined); throw new Error("Experiment source checks must finish synchronously."); }
      this.db.prepare("INSERT INTO experiment_plans(id, document, frozen_at) VALUES (?, ?, ?)").run(summary.id, JSON.stringify(summary), summary.frozenAt);
      this.audit("experiment_plan_frozen", summary.id); this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  experimentPlan(id: string): ExperimentPlanSummary | null {
    const row = this.db.prepare("SELECT document FROM experiment_plans WHERE id=?").get(id);
    return row ? JSON.parse(String(row.document)) as ExperimentPlanSummary : null;
  }

  recentExperimentPlans(): ExperimentPlanSummary[] {
    return this.db.prepare("SELECT document FROM experiment_plans ORDER BY frozen_at DESC, id LIMIT 100").all().map(row => JSON.parse(String(row.document)) as ExperimentPlanSummary);
  }

  saveReviewBrief(summary: ReviewBriefSummary, authorize: () => undefined): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const authorization: unknown = authorize();
      if (authorization !== undefined) { if (authorization instanceof Promise) void authorization.catch(() => undefined); throw new Error("Brief checks must finish synchronously."); }
      this.db.prepare("INSERT INTO review_briefs(id, document, created_at) VALUES (?, ?, ?)").run(summary.id, JSON.stringify(summary), summary.createdAt);
      this.audit("review_brief_saved", summary.id); this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  reviewBrief(id: string): ReviewBriefSummary | null {
    const row = this.db.prepare("SELECT document FROM review_briefs WHERE id=?").get(id);
    return row ? JSON.parse(String(row.document)) as ReviewBriefSummary : null;
  }

  recentReviewBriefs(): ReviewBriefSummary[] {
    return this.db.prepare("SELECT document FROM review_briefs ORDER BY created_at DESC, id LIMIT 100").all().map(row => JSON.parse(String(row.document)) as ReviewBriefSummary);
  }

  private contextGuard(authorize: () => undefined): void {
    const result: unknown = authorize();
    if (result !== undefined) { if (result instanceof Promise) void result.catch(() => undefined); throw new ContextDataError(); }
  }

  contextSource(id: string): ContextSourceCatalog | null {
    const row = this.db.prepare("SELECT id, lineage_root_id, version, revision, document FROM context_sources WHERE id=?").get(id);
    if (!row) return null; const source = JSON.parse(String(row.document)) as ContextSourceCatalog;
    if (source.id !== row.id || source.lineageRootId !== row.lineage_root_id || source.version !== Number(row.version) || source.state.revision !== Number(row.revision)) throw new ContextDataError(); return source;
  }

  contextSourceEvents(id: string): ContextSourceState[] {
    return this.db.prepare("SELECT revision, document FROM context_source_events WHERE source_id=? ORDER BY revision LIMIT 3").all(id).map(row => { const state = JSON.parse(String(row.document)) as ContextSourceState; if (state.revision !== Number(row.revision)) throw new ContextDataError(); return state; });
  }

  recentContextSources(): ContextSourceCatalog[] {
    return this.db.prepare("SELECT id FROM context_sources ORDER BY imported_at DESC, id LIMIT 100").all().map(row => this.contextSource(String(row.id))!);
  }

  saveContextSource(summary: ContextSourceCatalog, supersedes: { sourceId: string; expectedRevision: number } | null, authorize: () => undefined): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.contextGuard(authorize);
      if (summary.state.revision !== 1 || summary.state.status !== "active") throw new ContextDataError();
      if (supersedes) {
        const prior = this.contextSource(supersedes.sourceId);
        if (!prior || prior.state.revision !== supersedes.expectedRevision || prior.state.status !== "active") throw new ContextStateConflict();
        if (summary.lineageRootId !== prior.lineageRootId || summary.version !== prior.version + 1 || summary.recordPolicy !== prior.recordPolicy || summary.metadataId !== prior.metadataId || summary.originId !== prior.originId || Date.parse(summary.importedAt) < Date.parse(prior.importedAt)) throw new ContextDataError();
        const state: ContextSourceState = { revision: 2, status: "superseded", at: summary.importedAt, reason: "replaced_by_new_source_version", replacementId: summary.id };
        const changed = this.db.prepare("UPDATE context_sources SET revision=2, document=? WHERE id=? AND revision=?").run(JSON.stringify({ ...prior, state }), prior.id, supersedes.expectedRevision);
        if (changed.changes !== 1) throw new ContextStateConflict();
        this.db.prepare("INSERT INTO context_source_events(source_id, revision, document) VALUES (?, 2, ?)").run(prior.id, JSON.stringify(state)); this.audit("context_source_superseded", prior.id);
      } else if (summary.version !== 1 || summary.lineageRootId !== summary.id) throw new ContextDataError();
      this.db.prepare("INSERT INTO context_sources(id, lineage_root_id, version, revision, document, imported_at) VALUES (?, ?, ?, 1, ?, ?)").run(summary.id, summary.lineageRootId, summary.version, JSON.stringify(summary), summary.importedAt);
      this.db.prepare("INSERT INTO context_source_events(source_id, revision, document) VALUES (?, 1, ?)").run(summary.id, JSON.stringify(summary.state)); this.audit(summary.recordPolicy ? "context_source_captured" : "context_source_imported", summary.id); this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  withdrawContextSource(id: string, expectedRevision: number, reason: string, authorize: () => undefined): ContextSourceState {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const prior = this.contextSource(id);
      if (!prior || prior.state.revision !== expectedRevision || prior.state.status !== "active") throw new ContextStateConflict();
      this.contextGuard(authorize);
      const state: ContextSourceState = { revision: 2, status: "withdrawn", at: new Date().toISOString(), reason, replacementId: null };
      if (Date.parse(state.at) < Date.parse(prior.importedAt)) throw new ContextDataError();
      const changed = this.db.prepare("UPDATE context_sources SET revision=2, document=? WHERE id=? AND revision=?").run(JSON.stringify({ ...prior, state }), id, expectedRevision);
      if (changed.changes !== 1) throw new ContextStateConflict();
      this.db.prepare("INSERT INTO context_source_events(source_id, revision, document) VALUES (?, 2, ?)").run(id, JSON.stringify(state)); this.audit("context_source_withdrawn", id); this.db.exec("COMMIT"); return state;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  saveContextSnapshot(summary: ContextSnapshotSummary, authorize: () => undefined): void {
    this.db.exec("BEGIN IMMEDIATE");
    try { this.contextGuard(authorize); this.db.prepare("INSERT INTO context_snapshots(id, document, created_at) VALUES (?, ?, ?)").run(summary.id, JSON.stringify(summary), summary.createdAt); this.audit("context_snapshot_saved", summary.id); this.db.exec("COMMIT"); }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  contextSnapshot(id: string): ContextSnapshotSummary | null {
    const row = this.db.prepare("SELECT document FROM context_snapshots WHERE id=?").get(id); return row ? JSON.parse(String(row.document)) as ContextSnapshotSummary : null;
  }

  recentContextSnapshots(): ContextSnapshotSummary[] {
    return this.db.prepare("SELECT document FROM context_snapshots ORDER BY created_at DESC, id LIMIT 100").all().map(row => JSON.parse(String(row.document)) as ContextSnapshotSummary);
  }

  contextProcessingAuthorization(id: string): ContextProcessingCatalog | null {
    const row = this.db.prepare("SELECT id, revision, packet_sha256, provider, model, created_at, document FROM context_processing WHERE id=?").get(id); if (!row) return null;
    const summary = JSON.parse(String(row.document)) as ContextProcessingCatalog;
    if (summary.id !== row.id || summary.state.revision !== Number(row.revision) || summary.packetSha256 !== row.packet_sha256 || summary.provider !== row.provider || summary.model !== row.model || summary.createdAt !== row.created_at) throw new ContextDataError(); return summary;
  }

  contextProcessingEvents(id: string): ContextProcessingState[] {
    return this.db.prepare("SELECT revision, document FROM context_processing_events WHERE authorization_id=? ORDER BY revision LIMIT 3").all(id).map(row => { const event = JSON.parse(String(row.document)) as ContextProcessingState; if (event.revision !== Number(row.revision)) throw new ContextDataError(); return event; });
  }

  activeContextProcessing(packetSha256: string, provider: string, model: string): ContextProcessingCatalog | null {
    const row = this.db.prepare("SELECT id FROM context_processing WHERE packet_sha256=? AND provider=? AND model=? AND revision=1").get(packetSha256, provider, model); return row ? this.contextProcessingAuthorization(String(row.id)) : null;
  }

  recentContextProcessing(): ContextProcessingCatalog[] {
    return this.db.prepare("SELECT id FROM context_processing ORDER BY created_at DESC, id LIMIT 100").all().map(row => this.contextProcessingAuthorization(String(row.id))!);
  }

  saveContextProcessingAuthorization(summary: ContextProcessingCatalog, authorize: () => undefined): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.contextGuard(authorize); if (summary.state.revision !== 1 || summary.state.status !== "active") throw new ContextDataError();
      if (this.activeContextProcessing(summary.packetSha256, summary.provider, summary.model)) throw new ContextStateConflict();
      this.db.prepare("INSERT INTO context_processing(id, revision, packet_sha256, provider, model, document, created_at) VALUES (?, 1, ?, ?, ?, ?, ?)").run(summary.id, summary.packetSha256, summary.provider, summary.model, JSON.stringify(summary), summary.createdAt);
      this.db.prepare("INSERT INTO context_processing_events(authorization_id, revision, document) VALUES (?, 1, ?)").run(summary.id, JSON.stringify(summary.state)); this.audit("context_processing_declared", summary.id); this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  revokeContextProcessingAuthorization(id: string, expectedRevision: number, reason: string, authorize: () => undefined): ContextProcessingState {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const prior = this.contextProcessingAuthorization(id); if (!prior || prior.state.revision !== expectedRevision || prior.state.status !== "active") throw new ContextStateConflict(); this.contextGuard(authorize);
      const state: ContextProcessingState = { revision: 2, status: "revoked", at: new Date().toISOString(), reason }; if (Date.parse(state.at) < Date.parse(prior.createdAt)) throw new ContextDataError();
      const changed = this.db.prepare("UPDATE context_processing SET revision=2, document=? WHERE id=? AND revision=?").run(JSON.stringify({ ...prior, state }), id, expectedRevision); if (changed.changes !== 1) throw new ContextStateConflict();
      this.db.prepare("INSERT INTO context_processing_events(authorization_id, revision, document) VALUES (?, 2, ?)").run(id, JSON.stringify(state)); this.audit("context_processing_revoked", id); this.db.exec("COMMIT"); return state;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  saveReportExport(summary: ReportExportSummary, authorize: () => undefined): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const authorization: unknown = authorize();
      if (authorization !== undefined) { if (authorization instanceof Promise) void authorization.catch(() => undefined); throw new Error("Export source checks must finish synchronously."); }
      this.db.prepare("INSERT INTO report_exports(id, document, created_at) VALUES (?, ?, ?)").run(summary.id, JSON.stringify(summary), summary.createdAt);
      this.audit("report_export_saved", summary.id); this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  reportExport(id: string): ReportExportSummary | null {
    const row = this.db.prepare("SELECT document FROM report_exports WHERE id=?").get(id);
    return row ? JSON.parse(String(row.document)) as ReportExportSummary : null;
  }

  recentReportExports(): ReportExportSummary[] {
    return this.db.prepare("SELECT document FROM report_exports ORDER BY created_at DESC, id LIMIT 100").all().map(row => JSON.parse(String(row.document)) as ReportExportSummary);
  }

  saveOutcomeEvidence(summary: OutcomeEvidenceSummary, authorize: () => undefined): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const authorization: unknown = authorize();
      if (authorization !== undefined) { if (authorization instanceof Promise) void authorization.catch(() => undefined); throw new Error("Outcome evidence source checks must finish synchronously."); }
      if (this.db.prepare("SELECT id FROM outcome_evidence WHERE plan_id=? AND comparison_id=?").get(summary.planId, summary.comparisonId)) throw new Error("This plan/comparison pair is already registered. Inspect the saved record; do not retry publication.");
      this.db.prepare("INSERT INTO outcome_evidence(id, plan_id, comparison_id, document, registered_at) VALUES (?, ?, ?, ?, ?)").run(summary.id, summary.planId, summary.comparisonId, JSON.stringify(summary), summary.registeredAt);
      this.audit("outcome_evidence_registered", summary.id); this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  outcomeEvidence(id: string): OutcomeEvidenceSummary | null {
    const row = this.db.prepare("SELECT document FROM outcome_evidence WHERE id=?").get(id);
    return row ? JSON.parse(String(row.document)) as OutcomeEvidenceSummary : null;
  }

  outcomeEvidenceFor(planId: string, comparisonId: string): OutcomeEvidenceSummary | null {
    const row = this.db.prepare("SELECT document FROM outcome_evidence WHERE plan_id=? AND comparison_id=?").get(planId, comparisonId);
    return row ? JSON.parse(String(row.document)) as OutcomeEvidenceSummary : null;
  }

  recentOutcomeEvidence(): OutcomeEvidenceSummary[] {
    return this.db.prepare("SELECT document FROM outcome_evidence ORDER BY registered_at DESC, id LIMIT 100").all().map(row => JSON.parse(String(row.document)) as OutcomeEvidenceSummary);
  }

  close(): void { this.db.close(); }
}
