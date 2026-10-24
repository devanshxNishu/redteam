import test from "node:test";
import assert from "node:assert/strict";
import { ExecutionBudget, FixturePolicy, LimitError, PolicyError } from "../src/policy.ts";
import { parseStudy } from "../src/domain/study.ts";
import { readFile } from "node:fs/promises";

test("fixture policy requires the exact origin, port, protocol, and allowed method", () => {
  const policy = new FixturePolicy("http://127.0.0.1:45001", 10);
  assert.doesNotThrow(() => policy.checkDestination("http://127.0.0.1:45001/signup", "POST"));
  for (const url of ["http://127.0.0.1:45002/", "http://localhost:45001/", "https://127.0.0.1:45001/", "file:///etc/passwd", "http://127.0.0.1.evil.test:45001/", "http://user:password@127.0.0.1:45001/"]) {
    assert.throws(() => policy.checkDestination(url), PolicyError);
  }
  assert.throws(() => policy.checkDestination("http://127.0.0.1:45001/", "DELETE"), PolicyError);
});

test("request and journey limits stop work without labeling an app defect", () => {
  const policy = new FixturePolicy("http://127.0.0.1:45001", 1);
  assert.equal(policy.request("http://127.0.0.1:45001/", "GET"), true);
  assert.equal(policy.request("http://127.0.0.1:45001/", "GET"), false);
  assert.equal(policy.limitReached, true);
  const budget = new ExecutionBudget(1, 1000);
  budget.beginStep();
  assert.throws(() => budget.beginStep(), LimitError);
});

test("expired execution deadlines reject new operations", async () => {
  const budget = new ExecutionBudget(5, 1);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.throws(() => budget.beginStep(), LimitError);
});

test("study parser rejects unsupported capabilities and missing or ambiguous oracles", async () => {
  const fixture = JSON.parse(await readFile(new URL("../examples/pilot-signup.study.json", import.meta.url), "utf8")) as Record<string, unknown>;
  assert.equal(parseStudy(fixture).targetKind, "local_fixture");
  assert.throws(() => parseStudy({ ...fixture, targetKind: "remote_app" }));
  assert.throws(() => parseStudy({ ...fixture, shell: "anything" }));
  assert.throws(() => parseStudy({ ...fixture, requirementPath: "" }));
  const steps = fixture.steps as Record<string, unknown>[];
  for (const path of ["https://example.test/", "//example.test/", "/\\example.test/"]) {
    assert.throws(() => parseStudy({ ...fixture, steps: [{ operation: "navigate", path }, ...steps.slice(1)] }));
  }
  assert.throws(() => parseStudy({ ...fixture, steps: steps.slice(0, -1) }));
});
