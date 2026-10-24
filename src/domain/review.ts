import type { Artifact } from "../evidence.ts";
import type { StudyPlan } from "./study.ts";
import type { FixtureVariant } from "../fixture.ts";

export interface Observation {
  id: string;
  sequence: number;
  operation: string;
  at: string;
  result: "completed" | "failed";
  actual: string;
}

export interface AssertionResult {
  observationId: string;
  verdict: "pass" | "fail";
  expected: string;
  actual: string | null;
  visible: boolean;
}

export interface Execution {
  id: string;
  role: "primary" | "verifier";
  snapshotId: string | null;
  origin: string | null;
  buildHash: string | null;
  browserVersion: string | null;
  browserSource: "pinned_chromium" | "installed_chrome" | "injected" | null;
  baselineReady: boolean;
  startedAt: string;
  finishedAt: string;
  status: "completed" | "policy_denied" | "fixture_failed" | "tool_failed" | "limit_reached";
  error: string | null;
  assertion: AssertionResult | null;
  observations: Observation[];
  network: { url: string; method: string; status: number }[];
  policyDenials: string[];
  captureErrors: string[];
  artifactIds: string[];
}

export interface RunManifest {
  schemaVersion: "1.0";
  runId: string;
  createdAt: string;
  study: StudyPlan;
  studyHash: string;
  fixtureVariant: FixtureVariant;
  fixtureBuildHash: string;
  requirement: { id: string; artifactId: string; sha256: string };
  runtime: { node: string; playwright: string };
  mode: "deterministic_local_fixture";
}

export interface Finding {
  id: string;
  type: "observed_requirement_mismatch";
  status: "reproduced" | "not_reproduced" | "inconclusive";
  title: string;
  requirementId: string;
  stakeholderGoal: string;
  primaryExecutionId: string;
  verifierExecutionId: string;
  severity: "blocks_tested_journey";
  severityBasis: string;
  proposedAction: string;
  businessHypothesis: string;
}

export interface ReviewReport {
  schemaVersion: "1.0";
  runId: string;
  generatedAt: string;
  outcome: "completed" | "findings_found" | "limited_coverage";
  manifest: RunManifest;
  executions: Execution[];
  findings: Finding[];
  artifacts: Artifact[];
  integrityErrors: string[];
  modelSpendUsd: 0;
  infrastructureCost: "not_calculated";
  limitations: string[];
}
