# Next isolated slice: fenced analyst ownership

Repository-only continuation design after verified 0.29.0. No analyst task wrapper or dispatch is implemented by this plan. Read the generation and analytical contracts first.

## Fit with existing code

`TaskStore` already permits `kind: analyst`. Its generic lease, fence, cancellation, output seal and deadline mechanics can support one bounded analyst. `ActorTask`, `withDurableBudget`, stakeholder adapters, actor acceptance and actor recovery use actor-specific types and authority. Do not pass an analytical packet through an actor action contract or borrow research processing permission.

The next isolated implementation can add `src/analyst-task.ts` and `tests/analyst-task.test.ts` without a provider, new UI or live credential. Keep the verified actor path unchanged. A wrapper is a coordinator handle, not a tool given to the model.

## Required contract

- Create exactly one `analyst` task with one maximum attempt. Bind run/task IDs, an analytical question key, immutable manifest hash, explicit deadline and owner. The manifest must later cover exact packet/source, generation policy/schema, selected provider/configuration and limits; the wrapper must not invent a model or grant.
- Use explicit bounded lease/heartbeat policy, with heartbeat shorter than lease and a deadline cap already enforced by TaskStore. Validate policy and a synchronous source-authority callback before acquiring task state. An asynchronous or non-undefined callback result must fail; do not treat it as permission.
- Claim/start through TaskStore and retain the private owner/fence handle. Provide a signal and static policy errors. Before a dispatch intent, check signal, current running lease/deadline and exact current source authority. A lost lease/source aborts the signal and stops the heartbeat. No model receives the handle or callback.
- Preserve `recordDispatchIntent` semantics: the same invocation ID in the same attempt is idempotent, not a second provider dispatch. Actual dispatch needs the later ledger/transport state machine and cannot follow merely from an intent. Do not test or implement a contradictory duplicate-intent rule.
- Sealed output is an opaque artifact reference and SHA-256, not a path to open or approval of its content. The later coordinator must fully check candidate bytes/source/response before sealing. If completion follows sealing, pass the exact expected digest and fence. `seal` removes the lease: do not call `assertRunning` after it and mistake that expected state for lost ownership. Recheck source authority appropriately without inventing a new lease.
- Completed task state means the selected bytes were sealed under the coordinator's fence. It is not semantic review, a researched stakeholder decision, or commercial acceptance. Reasoning and protocols remain unreviewed.
- Use only existing failure reasons: `adapter_failed`, `policy_denied`, `invalid_output`, `limit_reached`; source denial can map to policy denial with factual separate metadata in the later runtime. Cancellation must never mutate a replacement owner's state. Expired/stale leases cannot seal or complete. Generic expired recovery marks interrupted state and never reconstructs or promotes an analytical response.
- Close timers/connections explicitly. An unfinished close may leave a lease for factual recovery; it must not fabricate success, replay a provider request or release unknown liability. The wrapper itself must not instantiate an adapter, budget, browser, shell, payment, delegation, source mutation or result publisher.

## Meaningful verification

Use authored software fixtures: exact analyst kind/one attempt/manifest, source guard before acquisition, rejected asynchronous guard, one running owner/fence, idempotent dispatch intent, stale/cancelled/source-denied signal and no seal, deadline/lease recovery, exact sealed digest/fence completion, no semantic acceptance, timer/connection cleanup, and unchanged actor behavior. Check actual task/event metadata, not a mocked substitute for TaskStore. Run focused tests, typecheck, then the full suite and installed package before claiming a released milestone.

## Runtime after the wrapper

Add an analyst-specific typed transport and request configuration. Count/generation both transmit supplied context and require the same configured processing authority. They are distinct HTTP phases inside one bounded attempt; never equate one attempt with one network request or assume counting has no account/billing implications without verification. Reserve before possible dispatch, preserve unknown liability and authenticated usage boundaries, deny redirects/automatic retries, handle refusal/incomplete/invalid output, and recheck source after response and around exclusive publication/catalog insertion.

Recovery needs its own analyst candidate/report and budget checks. Actor recovery deliberately filters actors and cannot silently accept analyst records. No live key, model, rate, external processing choice, human study or pilot demand is known available. Fake transport and factual interruption cases remain useful independent work. I04c semantic review/report, real research, C03 paid demand, arbitrary app isolation and the wider hierarchy remain separate gates.
