# Bounded stakeholder runtime

The runtime executes a simulated decision against one registered model version and a coordinator-supplied scenario. It has an injected inference adapter. The packaged demonstration uses an authored script. No live provider is configured by default. Optional configured OpenAI runs are documented in `docs/live-inference.md` and have been verified with fake transport only.

## Information boundary

The coordinator supplies facts with an identifier, label, value, origin, and visibility. Initial facts are visible immediately. Requested facts reveal their value only after an allowed inspection. The adapter can also request permitted grounding sources attached to the model version.

The adapter receives a frozen snapshot. It receives no filesystem handle, browser, shell, payment tool, or evaluation outcome tool. Arbitrary references and unsupported action types stop the actor. Held-out sources remain unavailable through registry grounding access.

This boundary limits supplied information. It cannot remove a language model's prior knowledge or establish realistic human attention, timing, beliefs, or behavior.

## Accepted actions

- `inspect`: read one permitted reference.
- `decide`: return a simulated consumer or investor decision body.

The coordinator supplies run, actor, scenario, model, scope, and decision-body identity. The adapter cannot replace those fields. Final records must pass structural checks, material constraint checks, registered model and scope access, and evidence resolution. Cited information must have been observed by that actor.

## Coordinator constraints

A scenario can include `constraints`, each with `key`, `state`, `material`, and `evidenceRefs`. Known states require references to scenario facts. Research references, duplicate keys, unsupported fields, and known states without evidence are rejected before adapter dispatch.

The adapter receives each constraint as `unknown` with no citations until it has observed every supporting fact. An explicit unknown state with no evidence is visible immediately. Its decision must preserve every supplied constraint, including material status and the observed evidence references. It cannot omit a barrier, change its state, or substitute a different citation. A deferred decision can preserve an unobserved constraint as unknown and identify the missing information.

Purchases and renewals require observed, material, satisfied coordinator constraints for `affordability`, `payment_access`, and `purchase_authority`. Investment approval requires `mandate`, `available_capital`, `decision_authority`, and `required_diligence`. Recommendations require mandate, capital, and diligence. Conditional investment requires satisfied mandate and capital, explicit material authority and diligence states, and conditions for unresolved barriers. Self-declared actor states cannot supply these requirements.

An older scenario without constraints can still produce a negative or information-seeking decision. Positive purchase and investment decisions now fail closed without the required coordinator declarations. Update existing scenario files before using those actions.

These declarations establish a software boundary. They do not authenticate funds, authority, diligence, or human behavior. Additional actor interpretations and cited references still require semantic evidence review. The runtime does not derive affordability from prices or validate proposed investment amounts and terms.

## Limits and failure

Every run has step, read, context, output, token, cost, and time limits. Revoked research blocks later decision acceptance. An uncooperative adapter cannot prevent local timeout or cancellation from returning a partial report.

Trusted adapters must bound provider request liability before dispatch and return usage receipts. The runtime checks receipts and stops after an overrun. Receipt checks cannot undo provider charges. A failed or timed-out call without a valid receipt retains an unknown-cost marker and its requested reservation.

Configured terminal runs now reserve tokens and estimated cost in a durable SQLite ledger before dispatch. A coordinator-owned task records the same invocation identities and guards ownership. Uncertain liability survives restart and cancellation. Late valid usage can settle without reopening a stopped run. `redteam budgets show RUN_ID` reads current state. Direct calls to the injected `runActor` function retain its in-memory limits; callers must explicitly attach durable budget and task controls. See `docs/budget-ledger.md` and `docs/task-state.md` for the contracts. Provider billing reconciliation, specialist scheduling, and production isolation remain open.

No invalid or partial decision is accepted as a complete result. Reports separate completed, policy-denied, invalid-decision, adapter-failed, cancelled, and limited runs.

## Demonstration

```sh
redteam actors demo
redteam verify RUN_DIRECTORY
```

The demo registers synthetic draft consumer and investor models. It runs two scripted scenarios:

1. A consumer rejects a 20-unit offer when the supplied fixture budget is 5 units.
2. An investor returns a conditional decision while authority and diligence remain unknown.

These are authored expected responses. They are not model-generated psychology or measured stakeholder behavior. The report, scenario snapshot, adapter code hash, event records, and artifact hashes are saved under `.redteam/actor-runs/`.

The runtime currently exposes no real app actions and no actor delegation. Future consultation tools need scenario-specific permission. Analyst subagents require a separate coordinator, parent budgets, task leases, and evidence contracts.
