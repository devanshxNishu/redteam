import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { WorkspaceStore } from "../src/workspace.ts";
import { ReviewService } from "../src/review-service.ts";
import { ResearchRegistry } from "../src/research.ts";

async function temporary(work: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-workspace-"));
  try { await work(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

test("workspace state persists and unfinished jobs are interrupted without replay", async () => temporary(async directory => {
  let store = new WorkspaceStore(directory);
  const job = store.createJob("broken");
  store.saveJob({ ...job, status: "verifying" });
  store.close();
  store = new WorkspaceStore(directory);
  try {
    assert.equal(store.job(job.id)?.status, "verifying");
    store.recoverInterruptedJobs();
    assert.equal(store.job(job.id)?.status, "interrupted");
    assert.match(store.job(job.id)?.error ?? "", /not replayed/);
    assert.equal(store.jobs().length, 1);
  } finally { store.close(); }
}));

test("one coordinator owns a workspace and an unrelated release cannot unlock it", async () => temporary(async directory => {
  const first = new WorkspaceStore(directory);
  const second = new WorkspaceStore(directory);
  try {
    first.acquireCoordinator("first");
    assert.throws(() => second.acquireCoordinator("second"), /already owns/);
    second.releaseCoordinator("second");
    assert.throws(() => second.acquireCoordinator("second"), /already owns/);
    first.releaseCoordinator("first");
    second.acquireCoordinator("second");
    second.releaseCoordinator("second");
  } finally { first.close(); second.close(); }
}));

test("a rejected second service does not interrupt the active owner's jobs", async () => temporary(async directory => {
  const first = new WorkspaceStore(directory);
  const second = new WorkspaceStore(directory);
  const service = new ReviewService(first, directory, directory);
  try {
    const job = first.createJob("fixed");
    assert.throws(() => new ReviewService(second, directory, directory), /already owns/);
    assert.equal(first.job(job.id)?.status, "queued");
  } finally { await service.stop(); first.close(); second.close(); }
}));

test("database setup rejects dangling symbolic links before creating their targets", async () => temporary(async directory => {
  await mkdir(resolve(directory, ".redteam"));
  const destination = resolve(directory, "outside.sqlite");
  await symlink(destination, resolve(directory, ".redteam/workspace.sqlite"));
  await symlink(destination, resolve(directory, ".redteam/research.sqlite"));
  assert.throws(() => new WorkspaceStore(directory), /symbolic link/);
  assert.throws(() => new ResearchRegistry(directory), /symbolic link/);
  await assert.rejects(access(destination));
}));
