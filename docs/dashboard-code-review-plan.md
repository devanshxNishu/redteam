# U15 dashboard implementation checkpoint

Prepared against version 0.9.1 on October 25, 2026. This was the implementation plan. Version 0.10.0 implements the controls and records verification in `docs/continuation.md` and `docs/implementation-status.md`. The required checks below remain useful regression coverage.

## Current integration points

`web/index.html` already has a Reviews panel with `reviews-body`. Add repository and engineering record cards beneath that history. Reuse the existing `card`, `grant-item`, `grant-main`, and `small-button` patterns. Keep the five existing navigation views.

`web/app.js` provides `node()`, which uses `textContent`, and an authenticated `api()` helper. `refresh()` currently reads `/api/workspace`; the idle interval is ten seconds. `review-dialog`, `detail-title`, and `detail-content` are shared by browser reviews and actor reports. The existing close handler clears detail DOM and image URLs. `openedActorRun` currently controls actor withdrawal closure.

The implemented `/api/code-runs` route returns `repositoryRuns` and `engineeringRuns`. These are current-authorized catalog summaries, with `recordStatus: cataloged_unverified`. Listing does not check artifact integrity. Detail GET routes are `/api/code-runs/repositories/RUN_ID` and `/api/code-runs/observations/RUN_ID`; both check current access and integrity. Denied detail returns static 404 `code_record_unavailable`.

## Rendering contract

- Show an explicit empty state with terminal capture/note commands. Creating or opening a card must not create a grant, capture, test, or model request.
- Lists show the collection date, target, counts, and the unverified catalog label. Do not turn their presence into a successful app review or verified finding metric.
- Repository detail shows collection interval, policy/bounds, exclusions, incomplete coverage, file paths, and hashes. It shows no copied source text or artifact download control.
- Engineering detail shows supplied requirements and document references, notes, file/line/range hashes, and limitations. Keep supplied/unverified, unreviewed, not-executed, not-assessed, and unknown expectation labels visible.
- Render all operator text, paths, IDs, and error labels with `textContent`. Do not use HTML insertion or interpret note instructions. Long hashes and paths must wrap at 390 px.

## Request and access lifecycle

Implement a shared detail generation or equivalent ownership token. Change it when a different detail opens, the dialog closes, access fails, or a request is cancelled. A delayed response may render only while it still owns the current generation. Abort old requests where possible; abortion alone cannot replace the ownership check. Preserve existing actor and browser review behavior.

Keep only current catalog metadata and the open record identity in managed JavaScript state. Do not cache full engineering reports, supplied notes, or copied content globally, in storage, or in service workers. Detail DOM must clear on close and access failure.

Fetch fresh catalog metadata during refresh. For an open code detail, check membership and its current grant, capability, exact target, and expiry from workspace state. Also re-fetch the detail while it remains open: catalog membership alone cannot detect changed evidence. A failed detail/integrity request closes and clears the dialog.

Schedule local expiry invalidation so a detail does not wait for the ten-second idle poll after its known expiry. Recheck after timer or visibility changes. Local clock behavior retains the existing trusted-operator boundary.

If refresh cannot establish current permission, clear code rows and close/clear code detail. Do not retain old private metadata on a failed refresh. A failed catalog request must not replace an already cleared state with an older successful response. A late detail response must not reopen a dialog after revocation or navigation.

The API cannot recall data delivered earlier or erase unmanaged screenshots/browser memory. The UI must accurately state its polling and local expiry behavior rather than claim instantaneous remote revocation.

## Required verification

Use the real installed package and owned synthetic source/notes. Verify desktop and 390 px views, empty and populated states, exact labels, range hashes, long paths, no overflow, and no uncaught browser errors. An HTML-like note must display as text and create no image/script element.

Exercise external CLI/API revocation while detail is open, expiry, changed dependent source artifacts, network failure, closing during an in-flight request, and deliberately delayed successful responses arriving after revocation. Confirm detail closes, DOM clears, catalog metadata disappears where required, and stale responses cannot restore it. Reopening a restricted link must fail through the API.

Retain the existing browser review and actor detail flows. Run type checking and appropriate tests, then the full suite. Inspect desktop/mobile screenshots, stop all owned services/browsers, build/pack/install, and record exact release proof. Do not mark U15 complete before these checks pass.
