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

Constraint references establish traceability. They do not prove that an interpretation is correct. Semantic evidence review remains necessary.

## Limits and failure

Every run has step, read, context, output, token, cost, and time limits. Revoked research blocks later decision acceptance. An uncooperative adapter cannot prevent local timeout or cancellation from returning a partial report.

Trusted adapters must bound provider request liability before dispatch and return usage receipts. The runtime checks receipts and stops after an overrun. Receipt checks cannot undo provider charges. A failed or timed-out call without a valid receipt retains an unknown-cost marker and its requested reservation. Provider billing reconciliation, durable reservations, and production isolation are later work.

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
