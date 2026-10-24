import { validateDecisionRecord } from "./decisions.ts";
import type { DecisionRecord, DecisionValidation } from "./decisions.ts";
import { ResearchRegistry } from "../research.ts";
import type { ModelScope } from "../research.ts";

/** Context is supplied by the trusted coordinator, never by the acting model. */
export interface DecisionContext {
  runId: string;
  actorRef: string;
  scenarioRef: string;
  scope: ModelScope;
  observationRefs: string[];
}

/** Resolves model versions and permitted references. It cannot verify behavioral truth. */
export function validateRegisteredDecision(input: unknown, registry: ResearchRegistry, context: DecisionContext): DecisionValidation {
  const structural = validateDecisionRecord(input);
  if (!structural.valid) return structural;
  const decision = input as DecisionRecord;
  const errors: string[] = [];
  for (const key of ["runId", "actorRef", "scenarioRef"] as const) {
    if (decision[key] !== context[key]) errors.push(`${key} does not match the coordinator's decision context`);
  }
  try {
    const model = registry.authorizeModel(decision.model.id, decision.model.version, context.scope, decision.model.use);
    if (decision.domain !== model.domain) errors.push("decision domain does not match the registered model");
    if (decision.model.scopeMatch !== "within") errors.push("decision must declare the verified model scope match");
    const available = new Set([...model.sourceIds, ...context.observationRefs]);
    const references = [...decision.evidenceRefs, ...decision.constraints.flatMap(constraint => constraint.evidenceRefs)];
    for (const ref of new Set(references)) if (!available.has(ref)) errors.push(`evidence reference ${ref} is not available in the coordinator's context`);
    for (const constraint of decision.constraints) {
      if (constraint.material && constraint.state !== "unknown" && constraint.evidenceRefs.length === 0) errors.push(`material constraint ${constraint.key} requires permitted evidence references`);
    }
  } catch (error) { errors.push(error instanceof Error ? error.message : "Registered model access failed."); }
  return { valid: errors.length === 0, errors };
}
