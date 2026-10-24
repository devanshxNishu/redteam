import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { ResearchRegistry } from "../src/research.ts";
import { runActorDemo } from "../src/actor-demo.ts";
import { checkArtifacts } from "../src/evidence.ts";
import type { Artifact } from "../src/evidence.ts";

test("packaged actor demo saves auditable scripted consumer and investor decisions", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-actor-demo-"));
  const registry = new ResearchRegistry(directory);
  try {
    const result = await runActorDemo(directory, registry);
    assert.equal(result.outcome, "completed"); assert.equal(result.kind, "scripted_actor_demo");
    assert.deepEqual(result.decisions.map(item => item.action), ["reject", "conditional_investment"]);
    const report = JSON.parse(await readFile(resolve(result.directory, "report.json"), "utf8")) as { artifacts: Artifact[]; reports: { backend: { mode: string }; usage: { costMicrousd: number; unreceiptedCalls: number } }[] };
    assert.equal(report.artifacts.length, 3); assert.deepEqual(await checkArtifacts(result.directory, report.artifacts), []);
    assert(report.reports.every(item => item.backend.mode === "scripted_fixture" && item.usage.costMicrousd === 0 && item.usage.unreceiptedCalls === 0));
    assert(registry.models().every(model => model.status === "draft"));
    assert.match(await readFile(resolve(result.directory, "report.md"), "utf8"), /No live inference/);
  } finally { registry.close(); await rm(directory, { recursive: true, force: true }); }
});
