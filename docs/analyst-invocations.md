# Durable analyst phase accounting

Version 0.32.0 adds `AnalystInvocations` in `src/analyst-invocation.ts`. It runs trusted coordinator callbacks under durable reservations. No HTTP transport, terminal/API run route or analytical result publisher is integrated yet. Authored callbacks in tests do not establish provider compatibility or real spend.

## Ownership and budget

Construction requires a fresh checked preparation and its matching running analyst task. It checks the workspace, run/task IDs, question key, one attempt, manifest/configuration/generation hashes, configured phase and total caps, and inference/coordinator deadlines. The manifest digest must equal the task's pin. This digest is over compact `JSON.stringify(manifest)` without a newline; the future coordinator must save those exact bytes. The coordinator must have saved and verified the exact manifest bytes before real integration. This component does not resolve an artifact file itself.

The task handle and phase accounting pin their resolved workspace before callbacks. Later working-directory changes cannot redirect ledger writes. A handle cannot acquire a budget in another workspace. Local path identity, clocks, stores, coordinator and filesystem remain trusted; this is not distributed isolation.

The component creates one budget run with the prepared total cap. It never adopts or reopens an existing run. Count and generation use deterministic per-run invocation identities, separate maxima and the investigation pool. Repeating a phase or starting concurrent duplicate callbacks is denied. Generation requires one successful bounded count.

Before a callback, it checks current source/task/deadline, records dispatch intent, reserves the exact phase cap, checks again and marks possible dispatch. If ownership fails while the reservation is still reserved, only that reservation can be released. Possible dispatch retains liability. There is no transaction spanning task and budget stores.

A callback is trusted transport code. Never give this object, callback, stores or receipt authority to a model. One callback does not prove one HTTP request; the later transport must enforce no redirects/retries and one bounded request per phase. No browser, shell, payment or delegation tool is provided here.

## Count and receipts

`count(callback)` supplies a frozen invocation identity, signal and phase maximum. It accepts an integer input count from 1 through the configured maximum. A returned count is not a cost receipt. The count reservation becomes uncertain and remains held in full, even after success. Invalid counts and callback errors block generation and cannot trigger replay.

`generate(callback)` additionally supplies the exact counted input and configured output maximum. Its trusted transport result has two data fields: `value` and `usage`. The envelope cannot have accessors or extra fields. Usage must be an exact plain pair of nonnegative safe integer `tokens` and `costMicrousd`; malformed or missing usage leaves the full cap uncertain. Receipt accessors are never executed.

The coordinator's transport must derive usage from the authenticated provider response and configured estimates. Model-written JSON cannot serve as trusted usage. This component checks receipt syntax and ledger consistency; it does not authenticate a provider or independently measure billing. A supplied receipt can include zero only when the trusted transport has suitable evidence; no zero is inferred automatically. Counting never uses a receipt through this callback.

A valid generation receipt settles before the final source/ownership check. If that check fails, no value is delivered, but known spend remains recorded. An overrun remains settled with its overrun flag and closes the budget run. It cannot return a current candidate. Missing usage can return an opaque value only with `liability: uncertain`; later acceptance must enforce the relevant runtime gates. No value is semantically approved, sealed or published here.

## Interruption and close

The signal combines task loss, local close and the explicit inference deadline. The owned deadline timer is unref'd and cleared on close. A stalled callback cannot keep the caller waiting after abort. Its background work may still finish; the component cannot kill arbitrary callback code or prove that a remote request stopped.

Late trusted generation receipts can settle factual liability after cancellation or budget closure. The stale value is never returned to the aborted caller or promoted. A late token count still leaves its cost unknown. Writes that fail preserve conservative in-flight liability rather than inventing a release.

`close()` is idempotent. It aborts callbacks and closes its budget run, preserving unresolved liability. The coordinator must separately close the task handle and check publication/recovery. Task state remains running or externally cancelled; phase accounting never completes a task. A close write failure must be reported and recovered explicitly.

Eighteen authored tests use actual task/budget databases. They cover manifest/source/workspace mismatch, exact phase caps, count held liability, callback ordering and duplicate denial, invalid counts, redacted failures, reservation denial, source loss immediately after reserve with exact release, cancellation, deadline, late receipts, malformed receipts, overrun, closure and no adoption/replay. Installed verification exercises the compiled modules. The full actor/budget/task regressions remain required.

Next: bounded analyst-specific HTTP transport, complete trusted usage parsing, source/processing rechecks at transmission and response, exclusive factual publication and conservative analyst recovery. I04c semantic review, live verification, human behavioral research and commercial gates remain separate.
