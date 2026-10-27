# Context analyst phase accounting

Version0.48 adds internal `ContextAnalystInvocations` in `src/context-analyst-invocation.ts`. A trusted coordinator can run one count callback and one generation callback under exact durable token and estimated-cost caps. This module creates no HTTP request, key, candidate file, seal, analytical report or CLI/API run route. Authored callbacks do not establish actual provider compatibility, measured billing or accepted analysis.

## Original identity and private ledger

`create(store, preparation, task)` needs the actual current task handle, its original same-Store preparation and successful saved manifest receipt. A private handle registry checks object identity before calling task methods. Copies, prototype objects, historical data and another Store or preparation cannot supply authority. Full saved/current source files and the one-attempt running task are checked before initialization. A task with prior dispatch intents or an output cannot start accounting.

The adapter pins the canonical private `budgets.sqlite` file. Existing main/WAL/SHM files must be regular, owner-only and single-link. An absent main file cannot have orphan sidecars. Read-only preflight checks exact table columns, WAL mode, the required invocation index and absence of triggers on budget tables. The checks repeat after asynchronous source reads before a writer can normalize files or create schema. Malformed existing stores are denied without repair. The existing task writer and original brief-only analyst contracts are unchanged.

The adapter creates one exact budget run with the prepared count-plus-generation cap, zero verification/report pools and the frozen inference deadline. Finalization has a separate time allowance; no paid synthesis allowance is created. Existing run rows or invocation rows for this run cannot be adopted. The factory attempt is consumed before writer initialization. A failure before a visible row or after commit cannot retry that task handle.

Every ledger operation checks the pinned file and immutable run identity, cap, reserves, deadline and creation time. Invocation identities are exactly `RUN_ID:context_count` and `RUN_ID:context_generation`. Task, pricing/configuration hash, pool and maxima must match the preparation. State, actual amount and overrun fields must be consistent. The ledger remains local trusted coordinator state, not tamper-proof storage.

## Dispatch and resources

Each phase can start once. Generation requires a valid returned count from1 through the configured input maximum. It receives that exact count and the configured output maximum. Concurrent duplicate initialization or phase calls cannot replay callbacks or adopt a matching reservation.

Before a callback, the adapter checks current ownership and full source files, reserves that phase's cap, awaits the task's full-file dispatch gate and marks possible dispatch. A final synchronous parent guard runs after the awaited file reads and before the task intent. A closed, aborted or changed parent cannot leave a late intent. Async guards and data return values are never permission. The task's lease/source check still runs after the guard.

If a phase fails while its acknowledged reservation is still undispatched, only that reservation can be released. After possible dispatch, error, timeout or cancellation retains liability. A task intent is not proof of a request. A trusted callback can still perform arbitrary work; the later bounded transport must enforce one request, exact payloads, no redirects/retries and cancellation. Never give operational objects, stores, callbacks or receipt authority to a model.

## Counts, receipts and current rights

A returned token count is not a cost receipt. Its entire positive reservation becomes uncertain and remains held, including after a successful count. Invalid counts block generation. There is no automatic retry or inferred zero charge.

A generation callback returns an exact plain `value`/`usage` envelope. Accessors and extra fields are denied without executing getters. Trusted usage is an exact nonnegative safe-integer `tokens`/`costMicrousd` pair. Missing or malformed usage leaves the full generation cap uncertain. An opaque value can return with `liability: uncertain`; it is never semantic approval. A later coordinator must enforce acceptance rules.

Valid supplied usage settles before the final current-rights/full-file checks. A known incurred charge is retained if source permission was lost. An overrun remains settled with its actual amount and closes the run; its value is denied. Receipt syntax does not authenticate the provider or independently measure prices. Model-written text must never supply usage authority.

The combined signal covers local close, actual task cancellation/loss and the original inference deadline. A stalled callback stops holding the caller after abort. Trusted late generation usage may still settle a factual liability after close. The stale value cannot return or become a result. A late count remains unknown spend. No callback code or remote request is proved stopped by an abort signal.

`close()` aborts the phase handle and closes its exact budget run. It preserves unknown liability, clears its owned timer and does not complete or close the task. The coordinator separately manages task finalization. A failed close write remains an explicit error. `snapshot()` reads accounting facts; it grants no source retrieval or execution authority after rights loss.

## Verification and next work

Twenty-three authored idea/app cases use actual task and budget stores. They cover object identity/getters, exact caps and receipts, positive count liability, phase order, duplicate denial, unsafe/malformed/changing schema, consumed initialization uncertainty, source loss before/after reservation, cancellation during full reads, stalled callbacks, late settlement, receipt overruns, immutable-row tampering, database replacement and working-directory changes. Existing brief-only analyst, task, budget and browser regressions remain required. Compiled installed verification must preserve actual old-version sources, publications, task rows and budgets.

Separate [bounded context transport](context-analyst-transport.md) now checks original preparation/task/manifest/payload identity, current full source files and trusted transport usage with injected fake fetch. Then implement coordinator/candidate/catalog/report/conservative recovery and explicit terminal operations. Actual model/key/rates/current permissions/live compatibility, broader dated news coverage, real pilot access, human usefulness/behavioral validation, paid demand and production isolation remain open.

Local operator/runtime/clock/database/filesystem trust, SQLite sidecar bookkeeping and changes after the last observed check remain boundaries. No atomic transaction across files, task and budget stores, independent rights authentication or behavioral prediction is claimed.

Version0.50 adds [context candidate publication](context-analyst-candidates.md). Actual in-process completed transport observations bind the original result, Store/preparation/task attempt/fence/hash and timely local return. Injected/default fetch selection is labeled as a local runtime assertion, not independent provider authentication. One private exclusive candidate attempt requires the original running owner, full current task/source files and revalidated typed response. Current receipt verification rechecks bytes after awaited source checks. Candidate publication does not seal/complete a task or publish a final report. Coordinator, historical candidate/report reading, final publication, conservative recovery and deliberate run/list/show/recover remain next; no replay or orphan adoption.
