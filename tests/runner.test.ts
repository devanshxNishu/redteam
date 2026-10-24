import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkArtifacts } from "../src/evidence.ts";
import { createFixture } from "../src/fixture.ts";
import { runStudy } from "../src/runner.ts";
import type { Browser } from "playwright";
import { parseStudy } from "../src/domain/study.ts";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const input = JSON.parse(await readFile(resolve(projectRoot, "examples/pilot-signup.study.json"), "utf8")) as unknown;

test("broken signup produces a reproduced mismatch with real browser artifacts", { timeout: 60000 }, async () => {
  const outputRoot = await mkdtemp(resolve(tmpdir(), "redteam-broken-"));
  try {
    const { report, directory } = await runStudy(input, { projectRoot, outputRoot, variant: "broken" });
    assert.equal(report.outcome, "findings_found", JSON.stringify(report.executions.map(({ status, error, captureErrors }) => ({ status, error, captureErrors }))));
    assert.equal(report.findings.length, 1);
    assert.equal(report.findings[0]?.status, "reproduced");
    assert.notEqual(report.executions[0]?.snapshotId, report.executions[1]?.snapshotId);
    assert.notEqual(report.executions[0]?.origin, report.executions[1]?.origin);
    for (const execution of report.executions) {
      assert.equal(execution.status, "completed");
      assert.equal(execution.assertion?.actual, "We could not start your pilot");
      assert(execution.network.some(item => item.status === 500));
      assert.equal(execution.artifactIds.length, 3);
    }
    assert.deepEqual(await checkArtifacts(directory, report.artifacts), []);
    assert.equal(report.modelSpendUsd, 0);
    const markdown = await readFile(resolve(directory, "report.md"), "utf8");
    assert.match(markdown, /Business hypothesis:/);
    assert.match(markdown, /not an independent human review/);
  } finally { await rm(outputRoot, { recursive: true, force: true }); }
});

test("fixed signup passes the same oracle without a defect", { timeout: 60000 }, async () => {
  const outputRoot = await mkdtemp(resolve(tmpdir(), "redteam-fixed-"));
  try {
    const { report } = await runStudy(input, { projectRoot, outputRoot, variant: "fixed" });
    assert.equal(report.outcome, "completed");
    assert.deepEqual(report.findings, []);
    assert(report.executions.every(execution => execution.assertion?.verdict === "pass"));
  } finally { await rm(outputRoot, { recursive: true, force: true }); }
});

test("browser infrastructure failures preserve partial reports without false app defects", async () => {
  const outputRoot = await mkdtemp(resolve(tmpdir(), "redteam-tool-"));
  try {
    const { report, directory } = await runStudy(input, {
      projectRoot, outputRoot, variant: "broken",
      launchBrowser: async () => { throw new Error("Browser worker unavailable"); },
    });
    assert.equal(report.outcome, "limited_coverage");
    assert.deepEqual(report.findings, []);
    assert(report.executions.every(execution => execution.status === "tool_failed" && execution.assertion === null));
    assert.match(await readFile(resolve(directory, "report.md"), "utf8"), /Browser worker unavailable/);
  } finally { await rm(outputRoot, { recursive: true, force: true }); }
});

test("step exhaustion records limited coverage instead of a product failure", { timeout: 60000 }, async () => {
  const outputRoot = await mkdtemp(resolve(tmpdir(), "redteam-limit-"));
  try {
    const study = parseStudy(input);
    study.limits.maxStepsPerExecution = 1;
    const { report } = await runStudy(study, { projectRoot, outputRoot, variant: "broken" });
    assert.equal(report.outcome, "limited_coverage");
    assert.deepEqual(report.findings, []);
    assert(report.executions.every(execution => execution.status === "limit_reached" && execution.observations.length === 1));
  } finally { await rm(outputRoot, { recursive: true, force: true }); }
});

test("failed fixture preconditions prevent browser execution and defect classification", async () => {
  const outputRoot = await mkdtemp(resolve(tmpdir(), "redteam-fixture-"));
  try {
    const { report } = await runStudy(input, {
      projectRoot, outputRoot, variant: "broken",
      createFixture: async variant => ({ ...await createFixture(variant), baselineReady: false }),
      launchBrowser: async () => { throw new Error("Browser must not launch"); },
    });
    assert.equal(report.outcome, "limited_coverage");
    assert.deepEqual(report.findings, []);
    assert(report.executions.every(execution => execution.status === "fixture_failed"));
  } finally { await rm(outputRoot, { recursive: true, force: true }); }
});

test("missing requirement source cannot produce a defect report", async () => {
  const outputRoot = await mkdtemp(resolve(tmpdir(), "redteam-oracle-"));
  try {
    const study = parseStudy(input);
    study.requirementPath = "fixtures/missing.requirement.md";
    await assert.rejects(() => runStudy(study, { projectRoot, outputRoot, variant: "broken" }), /ENOENT/);
  } finally { await rm(outputRoot, { recursive: true, force: true }); }
});

test("skipped signup or invalid details cannot manufacture a defect on the fixed build", async () => {
  const outputRoot = await mkdtemp(resolve(tmpdir(), "redteam-precondition-"));
  try {
    const skipped = parseStudy(input);
    skipped.steps = [skipped.steps[0]!, skipped.steps.at(-1)!];
    await assert.rejects(() => runStudy(skipped, { projectRoot, outputRoot, variant: "fixed" }), /approved signup journey/);
    const invalid = parseStudy(input);
    const email = invalid.steps[2]!;
    assert.equal(email.operation, "fill");
    if (email.operation === "fill") email.value = "invalid-address";
    await assert.rejects(() => runStudy(invalid, { projectRoot, outputRoot, variant: "fixed" }), /approved signup journey/);
  } finally { await rm(outputRoot, { recursive: true, force: true }); }
});

test("a stalled browser launch terminates within the phase budget", { timeout: 5000 }, async () => {
  const outputRoot = await mkdtemp(resolve(tmpdir(), "redteam-stalled-launch-"));
  try {
    const study = parseStudy(input);
    study.limits.executionTimeoutMs = 500;
    study.limits.operationTimeoutMs = 100;
    const { report } = await runStudy(study, {
      projectRoot, outputRoot, variant: "broken",
      launchBrowser: () => new Promise<Browser>(() => undefined),
    });
    assert.equal(report.outcome, "limited_coverage");
    assert.deepEqual(report.findings, []);
    assert(report.executions.every(execution => execution.status === "limit_reached"));
  } finally { await rm(outputRoot, { recursive: true, force: true }); }
});

test("stalled browser cleanup cannot prevent a factual partial report", { timeout: 5000 }, async () => {
  const outputRoot = await mkdtemp(resolve(tmpdir(), "redteam-stalled-close-"));
  try {
    const unavailableBrowser = {
      version: () => "test-browser",
      newContext: async () => { throw new Error("Context worker unavailable"); },
      close: () => new Promise<void>(() => undefined),
    } as unknown as Browser;
    const { report } = await runStudy(input, {
      projectRoot, outputRoot, variant: "broken", cleanupTimeoutMs: 20,
      launchBrowser: async () => unavailableBrowser,
    });
    assert.equal(report.outcome, "limited_coverage");
    assert.deepEqual(report.findings, []);
    assert(report.executions.every(execution => execution.captureErrors.some(error => error.includes("Close browser"))));
  } finally { await rm(outputRoot, { recursive: true, force: true }); }
});
