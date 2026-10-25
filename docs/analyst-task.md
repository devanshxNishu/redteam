# Analyst task ownership

Version 0.30.0 adds an isolated coordinator handle. No CLI/API route creates an analyst run yet. A saved brief and `analysis prepare` still create no task or provider request.

## Contract

`src/analyst-task.ts` wraps the actual `TaskStore` with `kind: analyst` and exactly one attempt. It pins supplied run/task IDs, question key, manifest SHA-256, owner and a future deadline. The coordinator must construct that manifest from checked source, packet, generation policy, configuration and limits when runtime integration is added. This handle does not construct or verify a manifest's contents.

The default lease is 30 seconds. The heartbeat interval is one second. Explicit policies require positive integer durations, a lease of at most 60 seconds, and an interval shorter than the lease. The stored deadline caps all extensions. The coordinator and local clock remain trusted.

A coordinator supplies a synchronous source-authority callback. It must return `undefined`. Exceptions and other return values, including promises, deny work. Rejected native promises are consumed without awaiting permission. The callback runs before state acquisition and again after claiming, on heartbeat, before dispatch intent, before sealing and before completion. It must check exact current authority for the already fully checked source. A successful callback does not replace full byte/packet validation or authorize external processing.

The callback receives no new tool. Keep the handle, task store, owner/fence and callback inside the coordinator. Never pass them to a model.

## Operations

- `assertWorkspace(workspace)` checks the handle's resolved workspace identity. The path is pinned before invoking the source callback.
- `assertActive()` checks source authority and the current running owner, fence, lease and deadline. Source checks run before the final lease check, so a callback that cancels ownership cannot still authorize work.
- `beforeDispatch(invocationRef)` records intent under that lease. Repeating the same identity in the same attempt is idempotent. An intent is not a provider request, a reservation or permission to replay a request.
- `seal({artifactRef, sha256})` stores one opaque artifact reference and digest. It opens no artifact. The later coordinator must verify candidate bytes and response/source identity first.
- `complete(expectedHash)` checks current source, sealed state, output identity, exact digest, fence and deadline. Sealing removes the lease; completion uses the sealed fence rather than asserting a running lease.
- `stop(reason)` aborts the signal and stops the timer. Supported failures are `adapter_failed`, `policy_denied`, `invalid_output` and `limit_reached`. `cancelled` uses an atomic expected-fence cancellation, including after sealing. A stale owner cannot cancel a replacement. Failure after sealing preserves the seal for factual deadline recovery.
- `snapshot()` returns copied task/event metadata. It does not open candidate content or assess its meaning.
- `close()` stops the timer, aborts the signal and closes the connection. It is idempotent. An unfinished task remains available to factual expiry recovery; close does not invent completion or release unknown spend.

Authority loss aborts the signal and stops heartbeats. It need not immediately change durable task state. The coordinator can record a supported failure while its lease remains current. Otherwise explicit expiry recovery records interruption. A constructor failure after acquisition can similarly leave an unfinished record; it is not automatically retried or removed. Duplicate task/question creation never adopts an existing record.

A sealed task continues source/state/deadline checks without extending a lease. Completion stops its timer. Cancellation preserves an existing output reference/digest. None of these operations publishes or semantically accepts an analytical response. A completed task means only that the selected metadata was sealed and completed under the expected fence.

## Verification and remaining integration

Authored tests use the actual SQLite store and controlled timers. They cover pre-acquisition denial and accessor rejection, copied input pins, one owner/attempt, idempotent intent, current-source loss, cancellation during a callback, heartbeat expiry, sealed completion, wrong digest, asynchronous guard changes, unsupported output, fenced replacement cancellation, and connection/timer cleanup. Existing actor/task tests remain applicable.

No provider, credentials, model, rate, transport, budget, shell, browser, payment, delegation, source mutation or result publisher is instantiated by the handle. Analyst-specific configuration, count/generation transport, durable liability, checked exclusive publication, recovery and semantic review remain open. Actor acceptance and actor recovery cannot substitute for these parts. See the [generation boundary](analyst-generation.md) and [analytical plan](analytical-review-plan.md).
