import test from "node:test";
import assert from "node:assert/strict";
import {
  validateDecisionRecord,
  type DecisionConstraint,
  type DecisionRecord,
} from "../src/domain/decisions.ts";

function satisfied(key: string): DecisionConstraint {
  return { key, state: "satisfied", material: true, evidenceRefs: ["scenario-1"] };
}

function consumer(): DecisionRecord {
  return {
    id: "decision-1", runId: "run-1", mode: "simulated", scenarioRef: "scenario-1",
    actorRef: "actor-1", domain: "consumer", action: "buy",
    model: {
      id: "model-1", version: "1", use: "validated_within_scope",
      validationRef: "validation-1", scopeMatch: "within",
    },
    evidenceRefs: ["evidence-1"],
    constraints: ["affordability", "payment_access", "purchase_authority"].map(satisfied),
    rationale: "The simulated choice meets the supplied scenario constraints.",
    missingInformation: [], limitations: ["This is a simulated choice."], changeConditions: [],
  };
}

function investor(): DecisionRecord {
  return {
    ...consumer(), domain: "investor", action: "approve_investment",
    decisionBody: "committee", conditions: [],
    constraints: ["mandate", "available_capital", "decision_authority", "required_diligence"].map(satisfied),
  };
}

function invalid(value: unknown, pattern: RegExp): void {
  const result = validateDecisionRecord(value);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), pattern);
}

test("accepts scoped simulated purchase and committee investment records", () => {
  assert.deepEqual(validateDecisionRecord(consumer()), { valid: true, errors: [] });
  assert.deepEqual(validateDecisionRecord(investor()), { valid: true, errors: [] });
});

test("rejects non-record inputs and scalar coercion", () => {
  for (const value of [undefined, null, false, 1, "{}", [], new Date()]) {
    invalid(value, /plain object/);
  }
  invalid({ ...consumer(), mode: true }, /mode/);
  invalid({ ...consumer(), id: 10 }, /id must be a nonempty string/);
  invalid({ ...consumer(), evidenceRefs: "evidence-1" }, /evidenceRefs must be an array/);
  invalid({ ...consumer(), evidenceRefs: new Array(1) }, /evidenceRefs\[0\]/);
  let converted = false;
  invalid({ ...consumer(), action: { toString() { converted = true; return "buy"; } } }, /action/);
  assert.equal(converted, false);
  const record = consumer();
  (record.constraints[0] as unknown as Record<string, unknown>).material = "true";
  invalid(record, /material must be a boolean/);
});

test("rejects probabilities, actual commitments, and unknown nested fields", () => {
  invalid({ ...consumer(), probability: 0.8 }, /unsupported field probability/);
  invalid({ ...investor(), actualCommitment: true }, /unsupported field actualCommitment/);
  invalid({ ...investor(), mode: "actual" }, /mode/);
  invalid({ ...investor(), action: "committed" }, /action/);
  const record = consumer();
  invalid({ ...record, model: { ...record.model, confidence: 0.9 } }, /unsupported field confidence/);
});

test("purchases and renewals require funds, payment access, and purchase authority", () => {
  for (const action of ["buy", "renew"] as const) {
    for (const key of ["affordability", "payment_access", "purchase_authority"]) {
      const record = consumer();
      record.action = action;
      record.constraints = record.constraints.filter((item) => item.key !== key);
      invalid(record, new RegExp(`${key} must be present`));
    }
  }
  const record = consumer();
  const affordability = record.constraints[0];
  assert.ok(affordability);
  affordability.material = false;
  invalid(record, /affordability must be present, material, and satisfied/);
});

test("investment approval requires mandate, capital, authority, and completed required diligence", () => {
  for (const key of ["mandate", "available_capital", "decision_authority", "required_diligence"]) {
    const record = investor();
    record.constraints = record.constraints.filter((item) => item.key !== key);
    invalid(record, new RegExp(`${key} must be present`));
  }
  const record = investor();
  record.constraints.find((item) => item.key === "decision_authority")!.state = "unsatisfied";
  invalid(record, /decision_authority must be present/);
});

test("unknown material evidence blocks a positive decision and requires a missing-data explanation", () => {
  const record = consumer();
  record.constraints.push({ key: "total_price", state: "unknown", material: true, evidenceRefs: [] });
  invalid(record, /positive consumer actions/);
  record.action = "abstain";
  invalid(record, /require missingInformation/);
  record.missingInformation = ["The complete price is unavailable."];
  assert.equal(validateDecisionRecord(record).valid, true);
});

test("deferral and information requests remain valid while material facts are unknown", () => {
  const purchase = consumer();
  purchase.action = "defer";
  const approval = purchase.constraints.find((item) => item.key === "purchase_authority");
  assert.ok(approval);
  approval.state = "unknown";
  purchase.missingInformation = ["The budget owner's approval is pending."];
  assert.deepEqual(validateDecisionRecord(purchase), { valid: true, errors: [] });

  const investment = investor();
  investment.action = "request_information";
  const capital = investment.constraints.find((item) => item.key === "available_capital");
  assert.ok(capital);
  capital.state = "unknown";
  investment.missingInformation = ["The available investment allocation is unknown."];
  assert.deepEqual(validateDecisionRecord(investment), { valid: true, errors: [] });
});

test("unsatisfied material constraints permit rejection but block unconditional positive choices", () => {
  const record = consumer();
  const affordability = record.constraints[0];
  assert.ok(affordability);
  affordability.state = "unsatisfied";
  invalid(record, /positive consumer actions/);
  record.action = "reject";
  assert.equal(validateDecisionRecord(record).valid, true);

  const investment = investor();
  investment.constraints.push({ key: "portfolio_conflict", state: "unsatisfied", material: true, evidenceRefs: ["evidence-1"] });
  investment.action = "recommend_investment";
  invalid(investment, /unconditional investment decisions/);
  investment.action = "pass";
  assert.equal(validateDecisionRecord(investment).valid, true);
});

test("conditional investment must identify unresolved constraints and explicit terms", () => {
  const record = investor();
  if (record.domain !== "investor") throw new Error("fixture domain mismatch");
  record.action = "conditional_investment";
  record.constraints.find((item) => item.key === "decision_authority")!.state = "unknown";
  record.missingInformation = ["The committee decision is pending."];
  invalid(record, /requires explicit conditions/);
  record.conditions = ["subject to further review"];
  invalid(record, /identify unresolved material constraint decision_authority/);
  record.conditions = ["decision_authority: committee approval must be recorded"];
  assert.equal(validateDecisionRecord(record).valid, true);
  record.constraints.find((item) => item.key === "available_capital")!.state = "unsatisfied";
  invalid(record, /available_capital must be present/);
});

test("individual recommendations remain distinct from committee approval", () => {
  const record = investor();
  if (record.domain !== "investor") throw new Error("fixture domain mismatch");
  record.action = "recommend_investment";
  record.decisionBody = "individual";
  record.constraints = record.constraints.filter((item) => item.key !== "decision_authority");
  assert.equal(validateDecisionRecord(record).valid, true);
  record.action = "approve_investment";
  invalid(record, /decision_authority must be present/);
});

test("investment recommendations cannot omit capital or diligence evidence", () => {
  for (const key of ["mandate", "available_capital", "required_diligence"]) {
    const record = investor();
    if (record.domain !== "investor") throw new Error("fixture domain mismatch");
    record.action = "recommend_investment";
    record.constraints = record.constraints.filter((item) => item.key !== key);
    invalid(record, new RegExp(`${key} must be present`));
  }
});

test("conditional investment cannot hide unresolved authority or diligence by omitting them", () => {
  const record = investor();
  if (record.domain !== "investor") throw new Error("fixture domain mismatch");
  record.action = "conditional_investment";
  record.conditions = ["A final price must be agreed."];
  record.constraints = record.constraints.filter((item) => item.key !== "required_diligence");
  invalid(record, /required_diligence must be present and material/);
});

test("validated status requires an evaluation reference and matching scope", () => {
  const record = consumer();
  delete record.model.validationRef;
  invalid(record, /model.validationRef/);
  record.model.validationRef = "validation-1";
  record.model.scopeMatch = "outside";
  invalid(record, /validated models require scopeMatch within/);
  record.model.use = "exploratory";
  assert.equal(validateDecisionRecord(record).valid, true);
  record.limitations = [];
  invalid(record, /require limitations/);
});

test("rejects duplicate constraint keys and unsafe accessor objects without invoking getters", () => {
  const record = consumer();
  record.constraints.push(satisfied("affordability"));
  invalid(record, /duplicate constraint key affordability/);
  let invoked = false;
  invalid({ get mode() { invoked = true; return "simulated"; } }, /must not contain accessors/);
  assert.equal(invoked, false);
  invalid({ ...consumer(), [Symbol("probability")]: 0.9 }, /unsupported field Symbol/);
});
