import type { DecisionConstraint, DecisionRecord } from "./decisions.ts";

/** Scenario declarations are trusted inputs, not facts inferred by the actor. */
export function readScenarioConstraints(input: unknown, factRefs: readonly string[]): DecisionConstraint[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 100) throw new Error("Scenario constraints require an array of at most 100 entries.");
  const keys = new Set<string>();
  return input.map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item) || ![Object.prototype, null].includes(Object.getPrototypeOf(item))
      || Reflect.ownKeys(item).some(key => typeof key !== "string" || !["key", "state", "material", "evidenceRefs"].includes(key))
      || Object.values(Object.getOwnPropertyDescriptors(item)).some(field => !("value" in field))) throw new Error("Scenario constraints require plain supported fields.");
    const value = item as Record<string, unknown>;
    if (typeof value.key !== "string" || !value.key.trim() || value.key.length > 120 || keys.has(value.key)
      || typeof value.state !== "string" || !["satisfied", "unsatisfied", "unknown"].includes(value.state) || typeof value.material !== "boolean"
      || !Array.isArray(value.evidenceRefs) || value.evidenceRefs.length > 100
      || value.evidenceRefs.some(ref => typeof ref !== "string" || !factRefs.includes(ref)) || new Set(value.evidenceRefs).size !== value.evidenceRefs.length
      || (value.state !== "unknown" && value.evidenceRefs.length === 0)) throw new Error("Scenario constraints require unique keys, supported states, and scenario fact evidence for known states.");
    keys.add(value.key);
    return { key: value.key, state: value.state as DecisionConstraint["state"], material: value.material, evidenceRefs: [...value.evidenceRefs] as string[] };
  });
}

/** Hide both the state and its supporting citations until every required fact is seen. */
export function visibleScenarioConstraints(constraints: readonly DecisionConstraint[], seen: ReadonlySet<string>): DecisionConstraint[] {
  return constraints.map(item => item.evidenceRefs.every(ref => seen.has(ref))
    ? { ...item, evidenceRefs: [...item.evidenceRefs] }
    : { key: item.key, state: "unknown", material: item.material, evidenceRefs: [] });
}

export function checkScenarioConstraints(decision: DecisionRecord, constraints: readonly DecisionConstraint[], seen: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  const visible = visibleScenarioConstraints(constraints, seen);
  for (const expected of visible) {
    const actual = decision.constraints.find(item => item.key === expected.key);
    if (!actual || actual.state !== expected.state || actual.material !== expected.material
      || actual.evidenceRefs.length !== expected.evidenceRefs.length || actual.evidenceRefs.some(ref => !expected.evidenceRefs.includes(ref))) {
      errors.push(`Decision must preserve the observed coordinator constraint ${expected.key}.`);
    }
  }
  let required: string[] = [];
  if (decision.domain === "consumer" && ["buy", "renew"].includes(decision.action)) required = ["affordability", "payment_access", "purchase_authority"];
  if (decision.domain === "investor") {
    if (decision.action === "approve_investment") required = ["mandate", "available_capital", "decision_authority", "required_diligence"];
    if (decision.action === "recommend_investment") required = ["mandate", "available_capital", "required_diligence"];
    if (decision.action === "conditional_investment") required = ["mandate", "available_capital"];
    if (decision.action === "conditional_investment") for (const key of ["decision_authority", "required_diligence"]) {
      if (!visible.some(item => item.key === key && item.material)) errors.push(`${key} requires a material coordinator constraint.`);
    }
  }
  for (const key of required) if (!visible.some(item => item.key === key && item.material && item.state === "satisfied")) {
    errors.push(`${key} requires an observed, material, satisfied coordinator constraint.`);
  }
  return errors;
}
