import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { ResearchRegistry } from "../src/research.ts";
import { runResearchDemo } from "../src/research-demo.ts";
import { validateRegisteredDecision } from "../src/domain/registered-decision.ts";
import type { DecisionContext } from "../src/domain/registered-decision.ts";
import type { DecisionRecord } from "../src/domain/decisions.ts";

async function temporary(work: (registry: ResearchRegistry, decision: DecisionRecord, context: DecisionContext) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-decision-registry-"));
  const registry = new ResearchRegistry(directory);
  try {
    const demo = runResearchDemo(registry);
    const context: DecisionContext = { runId: demo.decision.runId, actorRef: demo.decision.actorRef, scenarioRef: demo.decision.scenarioRef, scope: registry.model(demo.model.id, demo.model.version).scope, observationRefs: [] };
    await work(registry, demo.decision, context);
  } finally { registry.close(); await rm(directory, { recursive: true, force: true }); }
}

test("registered decisions resolve an active immutable model and allowed sources", async () => temporary(async (registry, decision, context) => {
  assert.deepEqual(validateRegisteredDecision(decision, registry, context), { valid: true, errors: [] });
  decision.model.version = "nonexistent";
  assert.match(validateRegisteredDecision(decision, registry, context).errors.join(";"), /not found/);
}));

test("actor, run, scenario, scope, and evidence cannot be widened by a decision record", async () => temporary(async (registry, decision, context) => {
  decision.actorRef = "another-actor"; decision.runId = "another-run"; decision.scenarioRef = "another-scenario";
  decision.evidenceRefs.push("not-permitted");
  const errors = validateRegisteredDecision(decision, registry, context).errors.join(";");
  assert.match(errors, /actorRef/); assert.match(errors, /runId/); assert.match(errors, /scenarioRef/); assert.match(errors, /not-permitted/);
  assert.match(validateRegisteredDecision(decision, registry, { ...context, scope: { ...context.scope, country: "elsewhere" } }).errors.join(";"), /outside/);
}));

test("known material constraints require resolved references and revoked research cannot support decisions", async () => temporary(async (registry, decision, context) => {
  decision.constraints[0]!.state = "unsatisfied";
  assert.match(validateRegisteredDecision(decision, registry, context).errors.join(";"), /requires permitted evidence/);
  decision.constraints[0]!.evidenceRefs = [decision.evidenceRefs[0]!];
  assert.equal(validateRegisteredDecision(decision, registry, context).valid, true);
  registry.revokeSource(decision.evidenceRefs[0]!, "Synthetic test withdrawal");
  assert.match(validateRegisteredDecision(decision, registry, context).errors.join(";"), /not permitted/);
}));

test("a decision cannot self-declare independent behavioral validation", async () => temporary(async (registry, decision, context) => {
  decision.model.use = "validated_within_scope"; decision.model.validationRef = "invented-review";
  assert.match(validateRegisteredDecision(decision, registry, context).errors.join(";"), /independent research review/);
}));
