# Managed saved analytical reports

Version 0.60 adds a saved analytical report view under **Reviews**. Run a configured terminal context analysis before starting the UI. Then open **Saved analytical reports** and select **Inspect analysis**.

The six analytical tracks cover product, engineering, customer and buyer questions, commercial questions, investor preparation, and verification. They are not researched people. Statements, proposed checks and source interpretations remain unreviewed. App execution, buyer or investor decisions, human behavioral validity, broad current global awareness and commercial usefulness are not established.

## Metadata and selection

**Refresh metadata** reads at most 50 task rows after cursor 0. **Next metadata window** reads the next bounded rowid window. Unrelated or unsupported tasks can be skipped. A window is not a complete or recent-first catalog. Metadata does not check source rights, task history or report validity and never authorizes report display.

Opening a task requests `GET /api/context-runs/TASK_ID/managed`. The browser requires the exact supported v2 projection, selected task/run UUIDs, valid report hash, typed paired citations and the declared unreviewed boundaries. A subsequent recheck must return the same report hash. Mixed, stale, oversized, invalid UTF-8 and unsupported data are withheld. These browser checks supplement the server's original full saved-data checks; they do not independently authenticate a source or validate reasoning.

The display uses literal text nodes. It does not open references or create clickable target links. Concerns retain brief-field and source-version hashes, declared source use, priority reasons, proposed unreviewed checks and uncovered tracks. Abstentions and unavailable analysis remain explicit. Recorded budget pools show configured-rate estimates and held liabilities. They are not invoices or a current ledger.

## Separate expiry contract

The existing v1 detail endpoint and historical saved report formats stay unchanged. The separate managed endpoint returns schema `2.0`, policy `context-report-api-v2`, and these checked access fields:

| Field | Meaning |
|---|---|
| `checkedAt` | Server wall-clock time after the original full inspection and current witness check |
| `effectiveExpiresAt` | Original manifest's effective processing/source permission expiry, rechecked against current records by the inspector |
| `displayUntil` | Earlier of effective permission expiry or `checkedAt + 30000 ms` |
| `maximumDisplayMs` | Declared 30000 ms display policy |
| `revalidation` | `explicit_request` |
| `revocation` | `detected_on_recheck_or_local_expiry` |
| `deliveredCopies` | `not_recallable` |

The original private delivery handle checks unchanged file/database witnesses, effective permission expiry and native cancellation after serialization. A managed view also cannot encode after its display window. A public access object grants no execution, publication, ownership, retry or recovery capability. Copies cannot replace the original private handle.

The display policy is separate from the inspector's existing 30-second delivery timeout. Neither duration extends a source permission. No historical report bytes are rewritten to add this access data.

## Managed display lifecycle

**Recheck source access** first removes the old report text, then performs a new full read. There is no background report polling. A revocation or changed byte is detected on the next explicit recheck. Otherwise managed text clears at the earlier known permission expiry or display deadline, within the browser event loop's scheduling limits.

A monotonic local deadline supplements the wall-clock expiry; focus and page-show checks cover overdue suspended timers. Hiding the page, navigation, closing the dialog or leaving the page removes managed text and aborts the owned request. A late response cannot reopen detail or replace another selection. A backward clock detected relative to the display's local start also clears it. This is not protection against an adversarial browser/runtime, arbitrary clock manipulation or copies already delivered.

One browser request occupies the view's local slot until it settles, including after cancellation. The service's existing one-active-report slot is shared with v1. A busy or failed read shows a fixed unavailable state and does not automatically retry. A slow source/report read can take seconds; the browser request allowance is 35 seconds, while the original server read deadline remains 30 seconds. Local synchronous SQLite work and resource cleanup are not preemptible hard deadlines.

No report body is saved in browser local/session storage. Memory, browser runtime, screenshots, downloads and already delivered copies remain outside recall. Literal free text can still quote private information; this feature is not a data-loss-prevention filter.

## Service boundary

The existing local service retains workspace coordinator ownership and its existing browser-job startup recovery. These GETs add no model request, key selection, new task/job/billing write or recovery. They do not enable web execution. Do not open a second service to bypass ownership. Terminal context start currently precedes opening the UI.

This is a trusted local single-user service. Semantic operator review, measured usefulness, independent research and paid demand remain separate gates.
