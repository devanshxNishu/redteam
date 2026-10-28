# Saved context report API

The existing local service provides two authenticated GET routes:

```text
GET /api/context-runs?afterRowId=0&rowLimit=50
GET /api/context-runs/TASK_ID
```

Use the existing local bearer session, Host and Origin rules. Start the local UI service after terminal analysis. Its normal startup owns the workspace coordinator and can perform existing browser-job recovery. These GET handlers add no recovery or inference.

The catalog returns bounded unverified task metadata, using the [existing cursor rules](context-analyst-catalog.md). Only `afterRowId` and `rowLimit` are accepted. Duplicate or unknown query keys are unavailable. Limits are 1 to 100 rows; the default is 50. A listed ID or recorded state does not establish report validity or source rights. Missing task state is not created.

Detail accepts one strict task UUID and no query parameters. It returns `context_analyst_report_view`, a fixed projection of an actually checked existing normal report. It includes report identity/hash/time, brief ID, frozen snapshot identity/as-of time, analytical concerns and typed paired citations, unreviewed next checks, uncovered tracks or abstention, factual failure and recorded budget pools. Known and held cost remain separate. Rates are configured estimates, not provider invoices or current ledger amounts.

The projection excludes internal directories, manifests, generation inputs, raw task/lease/fence/dispatch records, invocation identities and provider response fields. Literal analytical text remains untrusted and can quote supplied private information. Hash and citation consistency does not establish source truth, semantic support, human psychology, purchase demand or investment outcomes. A described app has not been executed by this review.

| Status | Meaning |
|---|---|
| 200 | Bounded unverified catalog, or a checked saved-data report projection whose reasoning remains unreviewed |
| 401 / 403 / 421 | Existing session, Origin or Host rule denied the request |
| 404 | Unsupported input/method/route, missing state, source loss, changed/unsafe files or unavailable checked data |
| 409 | One local checked report response is already active |

Errors are fixed and contain no partial view, raw exception or provider error. Responses use JSON and the existing no-store, CSP and content-type protections. POST, execution and recovery routes are not added.

## Final delivery

The managed inspector reads complete current source, processing, task and publication data. It pins required immutable paths and private workspace/task database witnesses before the final reads. After its read-only connection closes, it checks those witnesses and effective permission expiry. The minimum processing expiry also bounds the local source permissions recorded in that declaration. Main/nonempty WAL identity remains strict; private empty WAL coordination retains its existing handling.

A private in-process handle permits one original inspection to pass its final data-delivery check. The API creates a separate fixed public view, serializes at most 64000 bytes, then consumes the original check in the HTTP response frame. Changed files, task/catalog state, expired rights, clock reversal, cancellation, copied/forged views and cross-workspace/task bindings withhold output. The handle is not ownership, a publication receipt, a provider observation or execution authority.

An original native cancellation signal is linked through a private signal while the read is active. Native getters and listener methods avoid invoking caller overrides. Only owned listeners are removed. Final delivery still checks the original signal after that listener is removed. The original 30000 ms read window is not extended. One active checked response limits overlapping managed reads; pending filesystem cleanup can continue after cancellation. Synchronous SQLite cannot be preempted by JavaScript timers. Local clock/files/database/runtime remain trusted and do not form an atomic transaction.

The final expiry check also closes a reproduced old-reader gap: effective processing rights could expire during the outer connection closure without exhausting the read window. An authored-clock negative regression uses actual archived 0.58 compiled code; the current guard denies that delivery. No real participant data or native provider was used to reproduce it.

These routes provide saved-data access. Managed web inspection, explicit operator semantic review, independent human evaluation, measured usefulness and separately versioned factual recovery remain separate work. Current checks cannot recall copies already delivered under valid access.
