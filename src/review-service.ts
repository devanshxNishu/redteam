import { readFile, readdir, realpath } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { runStudy } from "./runner.ts";
import type { ReviewReport } from "./domain/review.ts";
import { WorkspaceStore } from "./workspace.ts";
import type { ReviewJob } from "./workspace.ts";

export class ReviewService {
  readonly store: WorkspaceStore;
  readonly workspace: string;
  readonly assetsRoot: string;
  private busy = false;
  private stopping = false;
  private active: Promise<void> | null = null;
  private readonly owner = randomUUID();

  constructor(store: WorkspaceStore, workspace: string, assetsRoot: string) {
    this.store = store;
    this.workspace = workspace;
    this.assetsRoot = assetsRoot;
    store.acquireCoordinator(this.owner);
    try { store.recoverInterruptedJobs(); } catch (error) { store.releaseCoordinator(this.owner); throw error; }
  }

  async importLegacyRuns(): Promise<void> {
    const root = resolve(this.workspace, "outputs/runs");
    let names: string[];
    try { names = await readdir(root); } catch { return; }
    for (const id of names.slice(0, 100)) {
      if (!/^[a-f0-9-]{36}$/.test(id) || this.store.job(id)) continue;
      const directory = resolve(root, id);
      try {
        const report = await this.readAllowedReport(directory);
        if (report.runId !== id) continue;
        this.store.saveJob({ id, variant: report.manifest.fixtureVariant, status: report.outcome === "limited_coverage" ? "limited_coverage" : "completed", createdAt: report.manifest.createdAt, updatedAt: report.generatedAt, reportDirectory: directory, findingCount: report.findings.length, artifactCount: report.artifacts.length, error: null });
      } catch { /* Unrecognized or incomplete directories are not imported. */ }
    }
  }

  submit(variant: "broken" | "fixed"): ReviewJob {
    if (this.stopping) throw new Error("The service is shutting down.");
    if (!["broken", "fixed"].includes(variant)) throw new Error("Choose the broken or fixed local fixture.");
    if (this.store.jobs().filter(job => ["queued", "running", "verifying", "reporting"].includes(job.status)).length >= 8) throw new Error("The review queue is full.");
    const job = this.store.createJob(variant);
    this.drain();
    return job;
  }

  private drain(): void {
    if (this.busy || this.stopping) return;
    const job = this.store.jobs().filter(item => item.status === "queued").at(-1);
    if (!job) return;
    this.busy = true;
    this.active = this.execute(job).catch(error => {
      console.error("Review storage failed:", error instanceof Error ? error.message : "Unknown storage error.");
    }).finally(() => {
      this.busy = false;
      this.active = null;
      if (!this.stopping) this.drain();
    });
  }

  private async execute(job: ReviewJob): Promise<void> {
    try {
      const input = JSON.parse(await readFile(resolve(this.assetsRoot, "examples/pilot-signup.study.json"), "utf8")) as unknown;
      const { report, directory } = await runStudy(input, {
        projectRoot: this.assetsRoot, outputRoot: resolve(this.workspace, ".redteam/runs"), variant: job.variant,
        onProgress: event => {
          job.status = event.phase;
          job.reportDirectory = event.directory;
          job.updatedAt = new Date().toISOString();
          this.store.saveJob(job);
        },
      });
      Object.assign(job, { status: report.outcome === "limited_coverage" ? "limited_coverage" : "completed", reportDirectory: directory, findingCount: report.findings.length, artifactCount: report.artifacts.length, updatedAt: new Date().toISOString() });
      this.store.saveJob(job);
    } catch (error) {
      Object.assign(job, { status: "failed", error: error instanceof Error ? error.message : "Review execution failed.", updatedAt: new Date().toISOString() });
      this.store.saveJob(job);
    }
  }

  async report(id: string): Promise<ReviewReport> {
    const job = this.store.job(id);
    if (!job?.reportDirectory || !["completed", "limited_coverage"].includes(job.status)) throw new Error("The review report is not ready.");
    return this.readAllowedReport(job.reportDirectory);
  }

  private async readAllowedReport(directory: string): Promise<ReviewReport> {
    const canonical = await realpath(directory);
    let permitted = false;
    for (const allowed of [resolve(this.workspace, ".redteam/runs"), resolve(this.workspace, "outputs/runs")]) {
      let root: string;
      try { root = await realpath(allowed); } catch { continue; }
      const path = relative(root, canonical);
      if (path && !path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path)) permitted = true;
    }
    if (!permitted) throw new Error("Report directory is outside the workspace.");
    const value = JSON.parse(await readFile(resolve(canonical, "report.json"), "utf8")) as ReviewReport;
    if (value.schemaVersion !== "1.0" || !Array.isArray(value.findings) || !Array.isArray(value.artifacts) || !Array.isArray(value.executions)
      || !["broken", "fixed"].includes(value.manifest?.fixtureVariant)) throw new Error("Unrecognized report format.");
    return value;
  }

  async stop(): Promise<void> {
    this.stopping = true;
    await this.active;
    for (const job of this.store.jobs()) {
      if (job.status === "queued") this.store.saveJob({ ...job, status: "interrupted", updatedAt: new Date().toISOString(), error: "Service closed before execution." });
    }
    this.store.releaseCoordinator(this.owner);
  }
}
