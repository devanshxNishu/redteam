import { DatabaseSync } from "node:sqlite";
import { chmodSync, lstatSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

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

  close(): void { this.db.close(); }
}
