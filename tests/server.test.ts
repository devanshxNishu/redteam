import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { request } from "node:http";
import { createLocalServer } from "../src/server.ts";
import type { ReviewJob } from "../src/workspace.ts";
import type { ReviewReport } from "../src/domain/review.ts";
import { ResearchRegistry } from "../src/research.ts";
import { runResearchDemo } from "../src/research-demo.ts";

const assetsRoot = fileURLToPath(new URL("..", import.meta.url));
async function temporary(work: (server: Awaited<ReturnType<typeof createLocalServer>>) => Promise<void>): Promise<void> {
  const workspace = await mkdtemp(resolve(tmpdir(), "redteam-server-"));
  const server = await createLocalServer({ workspace, assetsRoot, port: 0 });
  try { await work(server); } finally { await server.close(); await rm(workspace, { recursive: true, force: true }); }
}

test("local API requires a session and rejects foreign origins and forged hosts", async () => temporary(async server => {
  assert.equal((await fetch(`${server.origin}/api/workspace`)).status, 401);
  const headers = { Authorization: `Bearer ${server.token}` };
  assert.equal((await fetch(`${server.origin}/api/workspace`, { headers: { ...headers, Origin: "https://untrusted.test" } })).status, 403);
  const forgedHostStatus = await new Promise<number | undefined>((accept, reject) => {
    const attempt = request(`${server.origin}/api/workspace`, { headers: { ...headers, Host: "untrusted.test" } }, response => {
      response.resume(); accept(response.statusCode);
    });
    attempt.on("error", reject); attempt.end();
  });
  assert.equal(forgedHostStatus, 421);
  const response = await fetch(server.origin);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const html = await response.text();
  assert(!html.includes("__REDTEAM_TOKEN__"));
  const state = await (await fetch(`${server.origin}/api/workspace`, { headers })).json() as { research: { validatedModels: number }; metrics: { reviews: number } };
  assert.equal(state.research.validatedModels, 0);
  assert.equal(state.metrics.reviews, 0);
}));

test("access API creates scoped grants, rejects session upload, and revokes", async () => temporary(async server => {
  const headers = { Authorization: `Bearer ${server.token}`, "Content-Type": "application/json" };
  const grantInput = { name: "Test app", target: "https://example.test", kind: "web", capabilities: ["browser:read"], expiresInHours: 2 };
  const response = await fetch(`${server.origin}/api/access`, { method: "POST", headers, body: JSON.stringify(grantInput) });
  assert.equal(response.status, 201);
  const grant = await response.json() as { id: string };
  const bad = await fetch(`${server.origin}/api/access`, { method: "POST", headers, body: JSON.stringify({ ...grantInput, storageState: { cookies: [], origins: [] } }) });
  assert.equal(bad.status, 400);
  assert.equal((await fetch(`${server.origin}/api/access/${grant.id}/revoke`, { method: "POST", headers })).status, 200);
  const state = await (await fetch(`${server.origin}/api/workspace`, { headers })).text();
  assert(!state.includes(server.token));
  assert(!state.includes('"session":'));
  assert.equal(server.store.grant(grant.id)?.hasSession, false);
  assert(server.store.grant(grant.id)?.revokedAt);
}));

test("dashboard observes registry updates without exposing raw research or outcomes", async () => temporary(async server => {
  const registry = new ResearchRegistry(resolve(server.store.directory, ".."));
  try { runResearchDemo(registry); } finally { registry.close(); }
  const response = await fetch(`${server.origin}/api/workspace`, { headers: { Authorization: `Bearer ${server.token}` } });
  const serialized = await response.text();
  const state = JSON.parse(serialized) as { research: { sources: number; models: { status: string }[]; evaluations: number; validatedModels: number } };
  assert.equal(state.research.sources, 3);
  assert.equal(state.research.models[0]?.status, "draft");
  assert.equal(state.research.evaluations, 1);
  assert.equal(state.research.validatedModels, 0);
  assert(!serialized.includes('"observedAction"'));
  assert(!serialized.includes('"predictionHash"'));
  assert(!serialized.includes('"content"'));
}));

test("actor API saves scripted decisions in the shared catalog and verifies their artifacts", async () => temporary(async server => {
  const headers = { Authorization: `Bearer ${server.token}` };
  const response = await fetch(`${server.origin}/api/actors/demo`, { method: "POST", headers });
  assert.equal(response.status, 201);
  const summary = await response.json() as { runId: string; directory: string; decisions: { action: string }[] };
  assert.deepEqual(summary.decisions.map(item => item.action), ["reject", "conditional_investment"]);
  assert.equal(server.store.actorRuns().length, 1);
  const detail = await fetch(`${server.origin}/api/actors/${summary.runId}`, { headers });
  const report = await detail.json() as { artifacts: { path: string }[]; reports: { backend: { mode: string } }[] };
  assert(report.reports.every(actor => actor.backend.mode === "scripted_fixture"));
  const verified = await (await fetch(`${server.origin}/api/actors/${summary.runId}/verify`, { method: "POST", headers })).json() as { valid: boolean; artifacts: number };
  assert.equal(verified.valid, true); assert.equal(verified.artifacts, 3);
  await writeFile(resolve(summary.directory, report.artifacts[0]!.path), "changed");
  const invalid = await (await fetch(`${server.origin}/api/actors/${summary.runId}/verify`, { method: "POST", headers })).json() as { valid: boolean };
  assert.equal(invalid.valid, false);
}));

test("API review produces real evidence, verifies it, and rejects changed artifacts", { timeout: 60000 }, async () => temporary(async server => {
  const headers = { Authorization: `Bearer ${server.token}`, "Content-Type": "application/json" };
  const response = await fetch(`${server.origin}/api/reviews`, { method: "POST", headers, body: JSON.stringify({ variant: "fixed" }) });
  assert.equal(response.status, 202);
  const queued = await response.json() as ReviewJob;
  const deadline = Date.now() + 50000;
  let job = server.store.job(queued.id)!;
  while (["queued", "running", "verifying", "reporting"].includes(job.status) && Date.now() < deadline) {
    await new Promise(accept => setTimeout(accept, 100));
    job = server.store.job(queued.id)!;
  }
  assert.equal(job.status, "completed");
  const report = await (await fetch(`${server.origin}/api/reviews/${job.id}`, { headers })).json() as ReviewReport;
  assert.equal(report.outcome, "completed");
  assert.equal(report.findings.length, 0);
  assert.equal(report.executions.length, 2);
  assert.equal(report.artifacts.length, 7);
  const verified = await (await fetch(`${server.origin}/api/reviews/${job.id}/verify`, { method: "POST", headers })).json() as { valid: boolean; artifacts: number };
  assert.deepEqual(verified, { valid: true, artifacts: 7, errors: [] });
  const artifact = report.artifacts.find(item => item.mediaType === "image/png")!;
  const image = await fetch(`${server.origin}/api/reviews/${job.id}/artifacts/${artifact.id}`, { headers });
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/png");
  assert((await image.arrayBuffer()).byteLength > 1000);
  await writeFile(resolve(job.reportDirectory!, artifact.path), "changed");
  assert.equal((await fetch(`${server.origin}/api/reviews/${job.id}/artifacts/${artifact.id}`, { headers })).status, 400);
  const invalid = await (await fetch(`${server.origin}/api/reviews/${job.id}/verify`, { method: "POST", headers })).json() as { valid: boolean };
  assert.equal(invalid.valid, false);
}));
