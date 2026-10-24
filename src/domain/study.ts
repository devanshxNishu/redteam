export type Step =
  | { operation: "navigate"; path: string }
  | { operation: "fill"; selector: string; value: string }
  | { operation: "click"; selector: string }
  | { operation: "assert_text"; selector: string; expected: string };

export interface StudyPlan {
  schemaVersion: "1.0";
  id: string;
  title: string;
  decision: string;
  stakeholderGoal: string;
  targetKind: "local_fixture";
  requirementPath: string;
  limits: {
    maxStepsPerExecution: number;
    maxRequestsPerExecution: number;
    operationTimeoutMs: number;
    executionTimeoutMs: number;
  };
  steps: Step[];
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, allowed: string[], label: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Error(`${label} contains unsupported field: ${key}`);
  }
}

function text(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 2000) throw new Error(`${label} must contain 1–2000 characters.`);
}

function integer(value: unknown, label: string, min: number, max: number): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}.`);
  }
}

export function parseStudy(input: unknown): StudyPlan {
  const study = object(input, "Study");
  keys(study, ["schemaVersion", "id", "title", "decision", "stakeholderGoal", "targetKind", "requirementPath", "limits", "steps"], "Study");
  if (study.schemaVersion !== "1.0" || study.targetKind !== "local_fixture") {
    throw new Error("This milestone accepts schema 1.0 local_fixture studies only.");
  }
  for (const key of ["id", "title", "decision", "stakeholderGoal", "requirementPath"]) text(study[key], key);
  const limits = object(study.limits, "Limits");
  keys(limits, ["maxStepsPerExecution", "maxRequestsPerExecution", "operationTimeoutMs", "executionTimeoutMs"], "Limits");
  integer(limits.maxStepsPerExecution, "Step limit", 1, 100);
  integer(limits.maxRequestsPerExecution, "Request limit", 1, 500);
  integer(limits.operationTimeoutMs, "Operation timeout", 100, 10000);
  integer(limits.executionTimeoutMs, "Execution timeout", 500, 60000);
  if (limits.operationTimeoutMs > limits.executionTimeoutMs) throw new Error("Operation timeout exceeds the execution timeout.");
  if (!Array.isArray(study.steps) || study.steps.length < 1 || study.steps.length > 100) throw new Error("Study requires 1–100 steps.");
  let assertions = 0;
  for (const [index, value] of study.steps.entries()) {
    const step = object(value, `Step ${index + 1}`);
    if (step.operation === "navigate") {
      keys(step, ["operation", "path"], "Navigate");
      text(step.path, "Navigation path");
      if (!step.path.startsWith("/") || step.path.startsWith("//") || step.path.includes("\\")) {
        throw new Error("Navigation requires an absolute local path, not a URL.");
      }
    } else if (step.operation === "fill") {
      keys(step, ["operation", "selector", "value"], "Fill");
      text(step.selector, "Fill selector");
      text(step.value, "Fill value");
    } else if (step.operation === "click") {
      keys(step, ["operation", "selector"], "Click");
      text(step.selector, "Click selector");
    } else if (step.operation === "assert_text") {
      keys(step, ["operation", "selector", "expected"], "Assertion");
      text(step.selector, "Assertion selector");
      text(step.expected, "Expected text");
      if (index !== study.steps.length - 1) throw new Error("The assertion must be the final step.");
      assertions++;
    } else throw new Error("Unsupported browser operation.");
  }
  if (assertions !== 1 || (study.steps[0] as Record<string, unknown>).operation !== "navigate") {
    throw new Error("Study requires initial navigation and exactly one final assertion.");
  }
  return structuredClone(study) as unknown as StudyPlan;
}
