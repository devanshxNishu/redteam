import { randomUUID } from "node:crypto";
import { readFile, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import type { Browser, BrowserContext, Page } from "playwright";
import { EvidenceStore, checkArtifacts, sha256 } from "./evidence.ts";
import { assertFixtureSourceUnchanged, assertSignupContract, createFixture, fixtureBuildHash } from "./fixture.ts";
import type { FixtureVariant } from "./fixture.ts";
import { ExecutionBudget, FixturePolicy, LimitError, PolicyError } from "./policy.ts";
import { withinDeadline } from "./deadline.ts";
import { parseStudy } from "./domain/study.ts";
import type { StudyPlan } from "./domain/study.ts";
import type { Execution, Finding, Observation, ReviewReport, RunManifest } from "./domain/review.ts";

export interface RunOptions {
  projectRoot: string;
  outputRoot: string;
  variant: FixtureVariant;
  createFixture?: typeof createFixture;
  cleanupTimeoutMs?: number;
  onProgress?: (event: { phase: "running" | "verifying" | "reporting"; directory: string; runId: string }) => void;
  launchBrowser?: (role: "primary" | "verifier", timeoutMs: number) => Promise<Browser>;
}

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }

async function execute(study: StudyPlan, store: EvidenceStore, role: Execution["role"], options: RunOptions): Promise<Execution> {
  const result: Execution = {
    id: randomUUID(), role, snapshotId: null, origin: null, buildHash: null, browserVersion: null, browserSource: null, baselineReady: false,
    startedAt: new Date().toISOString(), finishedAt: "", status: "tool_failed", error: null,
    assertion: null, observations: [], network: [], policyDenials: [], captureErrors: [], artifactIds: [],
  };
  const budget = new ExecutionBudget(study.limits.maxStepsPerExecution, study.limits.executionTimeoutMs);
  let fixture: Awaited<ReturnType<typeof createFixture>> | undefined;
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  let policy: FixturePolicy | undefined;
  const investigate = <T>(work: () => Promise<T>, label: string, onLateValue?: (value: T) => Promise<void>): Promise<T> => {
    const remaining = budget.remainingMs();
    return withinDeadline(work(), remaining, label, onLateValue);
  };
  try {
    fixture = await investigate(() => (options.createFixture ?? createFixture)(options.variant), "Provision fixture", value => value.close());
    result.snapshotId = fixture.snapshotId;
    result.origin = fixture.origin;
    result.buildHash = fixture.buildHash;
    result.baselineReady = fixture.baselineReady;
    if (!fixture.baselineReady) { result.status = "fixture_failed"; throw new Error("Fixture baseline failed."); }
    policy = new FixturePolicy(fixture.origin, study.limits.maxRequestsPerExecution);
    process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(options.projectRoot, ".cache/ms-playwright");
    const { chromium } = await investigate(() => import("playwright"), "Load browser driver");
    const launch = async (): Promise<{ browser: Browser; source: NonNullable<Execution["browserSource"]> }> => {
      if (options.launchBrowser) return { browser: await options.launchBrowser(role, budget.remainingMs()), source: "injected" };
      try {
        return { browser: await chromium.launch({ headless: true, timeout: budget.remainingMs() }), source: "pinned_chromium" };
      } catch (error) {
        const chromeAvailable = process.platform === "darwin" && existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
        if (!message(error).includes("Executable doesn't exist") || !chromeAvailable) throw error;
        return { browser: await chromium.launch({ channel: "chrome", headless: true, timeout: budget.remainingMs() }), source: "installed_chrome" };
      }
    };
    const launched = await investigate(launch, "Launch browser", value => value.browser.close());
    browser = launched.browser;
    result.browserSource = launched.source;
    result.browserVersion = browser.version();
    context = await investigate(() => browser!.newContext({ serviceWorkers: "block", acceptDownloads: false, viewport: { width: 1280, height: 900 } }), "Create browser context", value => value.close());
    await investigate(() => context!.route("**/*", async route => {
      const request = route.request();
      if (!policy!.request(request.url(), request.method())) {
        await store.recordEvent({ type: "policy_denied", executionId: result.id, url: request.url(), method: request.method() });
        await route.abort("blockedbyclient");
      } else await route.continue();
    }), "Install request policy");
    await investigate(() => context!.routeWebSocket("**/*", socket => {
      policy!.denials.push(`WebSocket denied: ${socket.url()}`);
      socket.close();
    }), "Install socket policy");
    context.on("response", response => {
      result.network.push({ url: response.url(), method: response.request().method(), status: response.status() });
    });
    await investigate(() => context!.tracing.start({ screenshots: true, snapshots: true, sources: false }), "Start tracing");
    page = await investigate(() => context!.newPage(), "Create page", value => value.close());
    context.on("page", popup => {
      policy!.denials.push("Unexpected new page denied.");
      void popup.close().catch(() => undefined);
    });
    for (const [index, step] of study.steps.entries()) {
      budget.beginStep();
      const timeout = Math.min(study.limits.operationTimeoutMs, budget.remainingMs());
      const observation: Observation = { id: randomUUID(), sequence: index + 1, operation: step.operation, at: new Date().toISOString(), result: "completed", actual: "" };
      await store.recordEvent({ type: "step_started", executionId: result.id, observationId: observation.id, sequence: observation.sequence, operation: step.operation });
      try {
        const action = await investigate(async (): Promise<{ actual: string; assertion?: NonNullable<Execution["assertion"]> }> => {
        if (step.operation === "navigate") {
          const destination = new URL(step.path, fixture!.origin).href;
          policy!.checkDestination(destination);
          const response = await page!.goto(destination, { waitUntil: "domcontentloaded", timeout });
          return { actual: `Navigation returned HTTP ${response?.status() ?? "unknown"}.` };
        } else if (step.operation === "fill") {
          await page!.locator(step.selector).fill(step.value, { timeout });
          return { actual: "Field filled with the configured synthetic value." };
        } else if (step.operation === "click") {
          await page!.locator(step.selector).click({ timeout });
          await page!.waitForLoadState("domcontentloaded", { timeout: Math.min(study.limits.operationTimeoutMs, budget.remainingMs()) });
          return { actual: "Click completed." };
        } else {
          const locator = page!.locator(step.selector);
          const count = await locator.count();
          if (count > 1) throw new Error("Assertion selector matches multiple elements.");
          const visible = count === 1 && await locator.isVisible();
          const actual = count === 1 ? (await locator.textContent({ timeout }))?.replace(/\s+/g, " ").trim() ?? "" : null;
          return { actual: `Visible: ${visible}; text: ${JSON.stringify(actual)}.`, assertion: { observationId: observation.id, verdict: visible && actual === step.expected ? "pass" : "fail", expected: step.expected, actual, visible } };
        }
        }, `Journey step ${index + 1}`);
        observation.actual = action.actual;
        if (action.assertion) result.assertion = action.assertion;
      } catch (error) {
        observation.result = "failed";
        observation.actual = message(error);
        result.observations.push(observation);
        await store.recordEvent({ type: "step_finished", executionId: result.id, observation });
        throw error;
      }
      result.observations.push(observation);
      await store.recordEvent({ type: "step_finished", executionId: result.id, observation });
    }
    budget.remainingMs();
    result.status = policy.limitReached ? "limit_reached" : policy.denials.length ? "policy_denied" : "completed";
  } catch (error) {
    result.error = message(error);
    if (error instanceof LimitError || policy?.limitReached) result.status = "limit_reached";
    else if (error instanceof PolicyError || policy?.denials.length) result.status = "policy_denied";
    else if (result.status !== "fixture_failed") result.status = "tool_failed";
  } finally {
    context?.removeAllListeners("response");
    const cleanupEnd = performance.now() + (options.cleanupTimeoutMs ?? 10000);
    const closeWithinBudget = <T>(work: () => Promise<T>, label: string): Promise<T> => withinDeadline(work(), Math.max(1, cleanupEnd - performance.now()), label);
    if (page && !page.isClosed()) {
      try {
        const bytes = await closeWithinBudget(() => page!.screenshot({ fullPage: true, timeout: 2000 }), "Capture screenshot");
        const artifact = await store.addBytes(result.id, bytes, "png", "image/png");
        result.artifactIds.push(artifact.id);
      } catch (error) { result.captureErrors.push(`Screenshot: ${message(error)}`); }
    }
    if (context) {
      try {
        const path = store.newArtifactPath("zip");
        await closeWithinBudget(() => context!.tracing.stop({ path: resolve(store.root, path) }), "Seal browser trace");
        const artifact = await store.register(result.id, path, "application/zip");
        result.artifactIds.push(artifact.id);
      } catch (error) { result.captureErrors.push(`Trace: ${message(error)}`); }
    }
    if (browser) {
      if (context) {
        try { await closeWithinBudget(() => context!.close(), "Close browser context"); } catch (error) { result.captureErrors.push(`Context cleanup: ${message(error)}`); }
      }
      try { await closeWithinBudget(() => browser!.close(), "Close browser"); } catch (error) { result.captureErrors.push(`Browser cleanup: ${message(error)}`); }
    }
    if (fixture) {
      try { await closeWithinBudget(() => fixture!.close(), "Close fixture"); } catch (error) { result.captureErrors.push(`Fixture cleanup: ${message(error)}`); }
    }
    result.policyDenials = policy?.denials ?? [];
    result.finishedAt = new Date().toISOString();
    const artifact = await store.addBytes(result.id, Buffer.from(JSON.stringify(result, null, 2)), "json", "application/json");
    result.artifactIds.push(artifact.id);
    await store.recordEvent({ type: "execution_finished", executionId: result.id, status: result.status });
  }
  return result;
}

export function deriveFindings(manifest: RunManifest, primary: Execution, verifier: Execution, integrityErrors: string[]): Finding[] {
  if (!manifest.requirement.id || !manifest.requirement.sha256) return [];
  if (primary.status !== "completed" || primary.assertion?.verdict !== "fail") return [];
  const reproducible = verifier.status === "completed" && verifier.assertion?.verdict === "fail"
    && primary.baselineReady && verifier.baselineReady && primary.snapshotId !== verifier.snapshotId
    && primary.buildHash === manifest.fixtureBuildHash && verifier.buildHash === manifest.fixtureBuildHash
    && primary.browserVersion !== null && primary.browserVersion === verifier.browserVersion
    && primary.assertion.expected === verifier.assertion.expected && primary.assertion.actual === verifier.assertion.actual
    && integrityErrors.length === 0;
  return [{
    id: randomUUID(), type: "observed_requirement_mismatch", status: reproducible ? "reproduced" : verifier.status === "completed" && verifier.assertion?.verdict === "pass" ? "not_reproduced" : "inconclusive",
    title: "The signup result does not meet the documented requirement.", requirementId: manifest.requirement.id,
    stakeholderGoal: manifest.study.stakeholderGoal, primaryExecutionId: primary.id, verifierExecutionId: verifier.id,
    severity: "blocks_tested_journey", severityBasis: "The configured valid signup did not show the required confirmation.",
    proposedAction: "Inspect signup handling, correct the failure, and repeat this requirement test.",
    businessHypothesis: "Signup friction may prevent interested users from reaching the product. Real customer impact remains unmeasured.",
  }];
}

function markdown(report: ReviewReport): string {
  const lines = ["# redteam: App review", "", `Run: ${report.runId}`, `Outcome: ${report.outcome}`, "", "## Decision", "", report.manifest.study.decision,
    "", "Scope: synthetic local fixture. Deterministic browser tests; stakeholder behavior was not simulated.", "", "## Execution evidence", "",
    "| Role | Execution | Result | Assertion | Browser |", "|---|---|---|---|---|"];
  for (const execution of report.executions) lines.push(`| ${execution.role} | ${execution.id} | ${execution.status} | ${execution.assertion?.verdict ?? "not evaluated"} | ${execution.browserVersion ?? "unavailable"} (${execution.browserSource ?? "unavailable"}) |`);
  lines.push("", "## Findings", "");
  if (!report.findings.length) lines.push(report.outcome === "completed" ? "The tested requirement passed in both fresh executions." : "No verified defect can be concluded from the available coverage.");
  for (const finding of report.findings) {
    const primary = report.executions.find(execution => execution.id === finding.primaryExecutionId);
    lines.push(`### ${finding.title}`, "", `Verification: ${finding.status}.`, `Expected-result source: ${finding.requirementId}.`, "",
      `Expected heading: ${JSON.stringify(primary?.assertion?.expected ?? "not evaluated")}.`,
      `Observed heading: ${JSON.stringify(primary?.assertion?.actual ?? "not evaluated")}.`, "",
      `Stakeholder goal: ${finding.stakeholderGoal}`, "", `Next action: ${finding.proposedAction}`, "", `Business hypothesis: ${finding.businessHypothesis}`, "");
  }
  lines.push("", "## Artifacts", "");
  for (const artifact of report.artifacts) lines.push(`- [${artifact.mediaType}: ${artifact.owner}](${artifact.path}) — SHA-256: ${artifact.sha256}`);
  lines.push("", "## Limits and incomplete work", "");
  for (const limitation of report.limitations) lines.push(`- ${limitation}`);
  for (const execution of report.executions) {
    if (execution.error) lines.push(`- ${execution.role}: ${execution.error.replace(/\n/g, " ")}`);
    for (const error of execution.captureErrors) lines.push(`- ${execution.role} capture: ${error.replace(/\n/g, " ")}`);
  }
  for (const error of report.integrityErrors) lines.push(`- Evidence integrity: ${error}`);
  lines.push("", "Model spending: US$0. Infrastructure cost: not calculated.", "");
  return lines.join("\n");
}

export async function runStudy(input: unknown, options: RunOptions): Promise<{ report: ReviewReport; directory: string }> {
  const study = parseStudy(input);
  if (!["broken", "fixed"].includes(options.variant)) throw new Error("Unknown fixture variant.");
  if (options.cleanupTimeoutMs !== undefined && (!Number.isFinite(options.cleanupTimeoutMs) || options.cleanupTimeoutMs < 10 || options.cleanupTimeoutMs > 10000)) {
    throw new Error("Cleanup timeout must be between 10 and 10000 milliseconds.");
  }
  assertSignupContract(study);
  await assertFixtureSourceUnchanged();
  const canonicalRoot = await realpath(options.projectRoot);
  const requirementPath = await realpath(resolve(canonicalRoot, study.requirementPath));
  const rel = relative(canonicalRoot, requirementPath);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error("Requirement must be inside the project.");
  const requirement = await readFile(requirementPath, "utf8");
  const requirementId = /^Requirement ID: ([A-Za-z0-9_-]+)$/m.exec(requirement)?.[1];
  const assertion = study.steps.at(-1);
  if (requirementId !== "DEMO-SIGNUP-001" || assertion?.operation !== "assert_text" || !requirement.includes(`\`${assertion.expected}\``)) {
    throw new Error("The requirement must identify itself and document the configured expected text.");
  }
  const runId = randomUUID();
  const store = await EvidenceStore.create(options.outputRoot, runId);
  const source = await store.addBytes("requirement", Buffer.from(requirement), "md", "text/markdown");
  const require = createRequire(import.meta.url);
  const manifest: RunManifest = {
    schemaVersion: "1.0", runId, createdAt: new Date().toISOString(), study, studyHash: sha256(JSON.stringify(study)),
    fixtureVariant: options.variant, fixtureBuildHash: await fixtureBuildHash(options.variant),
    requirement: { id: requirementId, artifactId: source.id, sha256: source.sha256 },
    runtime: { node: process.version, playwright: (require("playwright/package.json") as { version: string }).version },
    mode: "deterministic_local_fixture",
  };
  await store.writeRecord("manifest.json", manifest);
  options.onProgress?.({ phase: "running", directory: store.root, runId });
  const primary = await execute(study, store, "primary", options);
  options.onProgress?.({ phase: "verifying", directory: store.root, runId });
  const verifier = await execute(study, store, "verifier", options);
  options.onProgress?.({ phase: "reporting", directory: store.root, runId });
  const integrityErrors = await checkArtifacts(store.root, store.artifacts);
  const findings = deriveFindings(manifest, primary, verifier, integrityErrors);
  const complete = [primary, verifier].every(execution => execution.status === "completed" && execution.assertion !== null && execution.captureErrors.length === 0)
    && integrityErrors.length === 0 && primary.buildHash === manifest.fixtureBuildHash && verifier.buildHash === manifest.fixtureBuildHash
    && primary.browserVersion !== null && primary.browserVersion === verifier.browserVersion;
  const consistent = primary.assertion?.verdict === verifier.assertion?.verdict;
  const report: ReviewReport = {
    schemaVersion: "1.0", runId, generatedAt: new Date().toISOString(),
    outcome: !complete || !consistent || findings.some(finding => finding.status !== "reproduced") ? "limited_coverage" : findings.length ? "findings_found" : "completed",
    manifest, executions: [primary, verifier], findings, artifacts: store.artifacts, integrityErrors,
    modelSpendUsd: 0, infrastructureCost: "not_calculated",
    limitations: [
      "Only the configured synthetic signup journey was tested.",
      "The verifier repeats the procedure in a new browser and a separate fixture dataset. It is not an independent human review.",
      "The requirement is a documented fixture oracle; reproduction does not prove that an oracle is correct.",
      "No human psychology, purchase demand, investment behavior, or funding probability was validated.",
      "Local process checks are not a production network sandbox or multi-tenant security boundary.",
      "Artifact hashes check integrity against recorded metadata; the metadata is not cryptographically signed.",
    ],
  };
  await store.writeRecord("report.json", report);
  await writeFile(resolve(store.root, "report.md"), markdown(report), { flag: "wx", mode: 0o600 });
  return { report, directory: store.root };
}
