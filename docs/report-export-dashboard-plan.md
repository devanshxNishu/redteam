# Report-export dashboard plan

Baseline: 0.18.0 protected API, compiled downloads, and 321 passing tests. Implement the remaining U08 local dashboard slice without expanding export scope to actors, research, source snapshots, or credentials.

## Read state and current rights

Add `/api/report-exports` to the existing refresh batch. Catalog summaries expose only public `sources` references, never private pins/directories. `codeEntry("report-exports",id)` must resolve every source through the current review/action/experiment/comparison catalogs and workspace grants. Use the earliest current source expiry for the shared timer. Missing parents or a revoked/expired source close detail and remove rows. Conservative hiding outside current catalog windows is acceptable and must be documented. Keep `cataloged_unverified` labels; fresh detail verifies saved source bytes.

## Explicit selection

Reviews gets a report-export card, bounded selector, and recent catalog. Input stays exactly the terminal/API contract. Offer up to 25 recent currently permitted options per source kind, plus already selected options that remain known/permitted. Preserve selected typed IDs and operator title across refresh. Rebuild option labels from current permitted metadata so an unselected withdrawn source cannot leave private text in the form. Close the whole managed form when a selected parent becomes unavailable. Do not silently remove selected content and submit a different bundle.

Keep only primitive selected IDs/title in the form lifecycle, not full reports. Validate one to ten items and at most five reviews; indicate source checks run before export. Action catalog revisions can change before creation; the export pins the revision actually read by the backend and exposes it in checked detail. No expected-action-revision field or stale cache authority is invented. Create uses a checked API POST, no automatic retry, and shared dialog generation/cancellation. A commit can precede response loss. Read recent exports before deliberately retrying.

## Checked detail and downloads

Use the shared private source/detail lifecycle. Render public title, selected kinds/IDs/hashes, record counts, source declaration/provenance limits, factual scopes/states, and literals safely with DOM text/value properties. Do not render downloaded Markdown as HTML. Full record bodies can be collapsed JSON/preformatted text; preserve readability and wrapping at 390 px. All old views must still work.

Provide explicit JSON and Markdown download buttons. Fetch with bearer/no-store and bounded timeout/abort. Check current dialog ownership and current known source rights before triggering a native download. Verify the response byte hash/length against the supplied headers. Use Blob URLs only in managed memory; revoke on close/replacement and after dispatch, and never put session tokens into anchor URLs or storage. A closed/restricted view or a delayed response cannot start a new download. Data already delivered/native copies cannot be recalled; describe this plainly. A browser dispatch is not proof that the filesystem save completed.

## Meaningful verification

Real-browser desktop/mobile creation and checked detail; all supported source kinds in a compiled mixed bundle where practical; literal HTML/Markdown/long titles; no overflow; input bounds; exact JSON/Markdown downloads and hashes; current grants including multiple grants/earliest expiry; selection preservation; selected/unselected withdrawal; mixed old catalogs/current workspace; failed metadata refresh; source/artifact tamper; late initial detail; late committed create after close/revocation; late download after close/revocation; no duplicate writes; no persistent browser storage; existing actor/action/plan/comparison regressions. Verify the installed archive with real local fixtures. Do not claim human, commercial, independent outcome, causal, research, predictive, or production validity.
