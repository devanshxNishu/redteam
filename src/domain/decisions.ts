/** Decisions are simulations. This contract does not execute purchases or investments. */
export type DecisionConstraint = {
  key: string;
  state: "satisfied" | "unsatisfied" | "unknown";
  material: boolean;
  evidenceRefs: string[];
};

export type DecisionModel = {
  id: string;
  version: string;
  use: "exploratory" | "validated_within_scope";
  validationRef?: string;
  scopeMatch: "within" | "outside" | "unknown";
};

export type DecisionBase = {
  id: string;
  runId: string;
  mode: "simulated";
  scenarioRef: string;
  actorRef: string;
  model: DecisionModel;
  evidenceRefs: string[];
  constraints: DecisionConstraint[];
  rationale: string;
  missingInformation: string[];
  limitations: string[];
  changeConditions: string[];
};

export type ConsumerAction =
  | "buy" | "trial" | "compare" | "request_approval" | "defer"
  | "reject" | "abandon" | "renew" | "cancel" | "abstain";

export type InvestorAction =
  | "pass" | "monitor" | "request_information" | "begin_diligence"
  | "recommend_investment" | "approve_investment"
  | "conditional_investment" | "abstain";

export type DecisionRecord = DecisionBase & (
  | { domain: "consumer"; action: ConsumerAction }
  | {
      domain: "investor";
      action: InvestorAction;
      decisionBody: "individual" | "committee";
      /** For unresolved material constraints, include their exact keys in these terms. */
      conditions: string[];
    }
);

export type DecisionValidation = { valid: boolean; errors: string[] };

const baseKeys = [
  "id", "runId", "mode", "scenarioRef", "actorRef", "model", "evidenceRefs",
  "constraints", "rationale", "missingInformation", "limitations", "changeConditions",
  "domain", "action",
];
export const consumerActions = Object.freeze([
  "buy", "trial", "compare", "request_approval", "defer", "reject", "abandon",
  "renew", "cancel", "abstain",
] as const);
export const investorActions = Object.freeze([
  "pass", "monitor", "request_information", "begin_diligence",
  "recommend_investment", "approve_investment", "conditional_investment", "abstain",
] as const);

/** Validates structure and decision constraints, not research truth or reference resolution. */
export function validateDecisionRecord(input: unknown): DecisionValidation {
  const errors: string[] = [];
  try {
    validate(input, errors);
  } catch {
    errors.push("decision must contain plain data that can be read safely");
  }
  return { valid: errors.length === 0, errors };
}

function validate(input: unknown, errors: string[]): void {
  const value = dataObject(input, "decision", errors);
  if (!value) return;

  allowKeys(value, value.domain === "investor"
    ? [...baseKeys, "decisionBody", "conditions"] : baseKeys, "decision", errors);
  for (const key of ["id", "runId", "scenarioRef", "actorRef", "rationale"]) {
    nonempty(value[key], key, errors);
  }
  choice(value.mode, ["simulated"], "mode", errors);
  choice(value.domain, ["consumer", "investor"], "domain", errors);
  for (const key of ["evidenceRefs", "missingInformation", "limitations", "changeConditions"]) {
    textList(value[key], key, errors);
  }

  const model = dataObject(value.model, "model", errors);
  if (model) {
    allowKeys(model, ["id", "version", "use", "validationRef", "scopeMatch"], "model", errors);
    nonempty(model.id, "model.id", errors);
    nonempty(model.version, "model.version", errors);
    choice(model.use, ["exploratory", "validated_within_scope"], "model.use", errors);
    choice(model.scopeMatch, ["within", "outside", "unknown"], "model.scopeMatch", errors);
    if (Object.hasOwn(model, "validationRef")) nonempty(model.validationRef, "model.validationRef", errors);
    if (model.use === "validated_within_scope") {
      nonempty(model.validationRef, "model.validationRef", errors);
      if (model.scopeMatch !== "within") errors.push("validated models require scopeMatch within");
    }
    if (model.use === "exploratory" || model.scopeMatch !== "within") {
      if (!Array.isArray(value.limitations) || value.limitations.length === 0) {
        errors.push("exploratory or unscoped decisions require limitations");
      }
    }
  }

  const constraints = readConstraints(value.constraints, errors);
  const unresolved = constraints.filter((item) => item.material && item.state !== "satisfied");

  if (value.domain === "consumer") {
    choice(value.action, consumerActions, "action", errors);
    if (value.action === "buy" || value.action === "renew") {
      requireSatisfied(constraints,
        ["affordability", "payment_access", "purchase_authority"], errors);
    }
    if (typeof value.action === "string" && ["buy", "renew", "trial"].includes(value.action)
      && unresolved.length > 0) {
      errors.push("positive consumer actions require all material constraints to be satisfied");
    }
  }

  if (value.domain === "investor") {
    choice(value.action, investorActions, "action", errors);
    choice(value.decisionBody, ["individual", "committee"], "decisionBody", errors);
    const conditions = textList(value.conditions, "conditions", errors);
    if (value.action === "approve_investment") {
      requireSatisfied(constraints,
        ["mandate", "available_capital", "decision_authority", "required_diligence"], errors);
    }
    if (value.action === "recommend_investment") {
      requireSatisfied(constraints, ["mandate", "available_capital", "required_diligence"], errors);
    }
    if (typeof value.action === "string" && ["approve_investment", "recommend_investment"].includes(value.action)
      && unresolved.length > 0) {
      errors.push("unconditional investment decisions require all material constraints to be satisfied");
    }
    if (value.action === "conditional_investment") {
      requireSatisfied(constraints, ["mandate", "available_capital"], errors);
      requireMaterial(constraints, ["decision_authority", "required_diligence"], errors);
      if (conditions.length === 0) errors.push("conditional investment requires explicit conditions");
      for (const constraint of unresolved) {
        if (!conditions.some((term) => term.includes(constraint.key))) {
          errors.push(`conditions must identify unresolved material constraint ${constraint.key}`);
        }
      }
    }
  }

  if (unresolved.some((item) => item.state === "unknown")) {
    if (!Array.isArray(value.missingInformation) || value.missingInformation.length === 0) {
      errors.push("unknown material constraints require missingInformation");
    }
  }
}

function readConstraints(input: unknown, errors: string[]): DecisionConstraint[] {
  if (!Array.isArray(input)) {
    errors.push("constraints must be an array");
    return [];
  }
  const result: DecisionConstraint[] = [];
  const keys = new Set<string>();
  for (const [index, entry] of input.entries()) {
    const path = `constraints[${index}]`;
    const value = dataObject(entry, path, errors);
    if (!value) continue;
    allowKeys(value, ["key", "state", "material", "evidenceRefs"], path, errors);
    const validKey = nonempty(value.key, `${path}.key`, errors);
    const validState = choice(value.state, ["satisfied", "unsatisfied", "unknown"], `${path}.state`, errors);
    if (typeof value.material !== "boolean") errors.push(`${path}.material must be a boolean`);
    const refs = textList(value.evidenceRefs, `${path}.evidenceRefs`, errors);
    if (validKey) {
      const key = value.key as string;
      if (keys.has(key)) errors.push(`duplicate constraint key ${key}`);
      keys.add(key);
    }
    if (validKey && validState && typeof value.material === "boolean") {
      result.push({
        key: value.key as string,
        state: value.state as DecisionConstraint["state"],
        material: value.material,
        evidenceRefs: refs,
      });
    }
  }
  return result;
}

function requireSatisfied(constraints: DecisionConstraint[], keys: string[], errors: string[]): void {
  for (const key of keys) {
    const constraint = constraints.find((item) => item.key === key);
    if (!constraint || !constraint.material || constraint.state !== "satisfied") {
      errors.push(`${key} must be present, material, and satisfied`);
    }
  }
}

function requireMaterial(constraints: DecisionConstraint[], keys: string[], errors: string[]): void {
  for (const key of keys) {
    const constraint = constraints.find((item) => item.key === key);
    if (!constraint || !constraint.material) errors.push(`${key} must be present and material`);
  }
}

function dataObject(input: unknown, path: string, errors: string[]): Record<string, unknown> | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    errors.push(`${path} must be a plain object`);
    return;
  }
  if (Object.values(Object.getOwnPropertyDescriptors(input)).some((field) => !("value" in field))) {
    errors.push(`${path} must not contain accessors`);
    return;
  }
  return input as Record<string, unknown>;
}

function allowKeys(value: Record<string, unknown>, keys: string[], path: string, errors: string[]): void {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !keys.includes(key)) {
      errors.push(`${path} contains unsupported field ${String(key)}`);
    }
  }
}

function nonempty(value: unknown, path: string, errors: string[]): boolean {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${path} must be a nonempty string`);
    return false;
  }
  return true;
}

function choice(value: unknown, choices: readonly string[], path: string, errors: string[]): boolean {
  if (typeof value !== "string" || !choices.includes(value)) {
    errors.push(`${path} must be one of: ${choices.join(", ")}`);
    return false;
  }
  return true;
}

function textList(value: unknown, path: string, errors: string[]): string[] {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array of nonempty strings`);
    return [];
  }
  const result: string[] = [];
  for (const [index, item] of value.entries()) {
    if (nonempty(item, `${path}[${index}]`, errors)) result.push(item as string);
  }
  return result;
}
