import { DatabaseSync } from "node:sqlite";
import { chmodSync, lstatSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { ActionRecord, ActionEvent } from "./domain/actions.ts";
import { ActionConflictError } from "./domain/actions.ts";
import type { ComparisonSummary } from "./comparisons.ts";

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

  constructor(workspace: string) {
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

  close(): void { this.db.close(); }
}
