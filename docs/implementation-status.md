# redteam: Implementation status

Current build: 0.27.0, local web and terminal workspace with configured actor ownership, coordinator acceptance, durable inference reservations, atomic JSON publication, factual recovery, terminal diagnostics, bounded local repository snapshots, requirement-linked source notes, and scoped operator action records. The provider path is mock-verified; no live API smoke test is recorded.

This record separates implemented code from the broader product plan. The browser runner reviews one controlled signup journey. Registered actor models can be used through the configured path, but no independent human behavioral validation is recorded.

## Implemented

| Area | Current behavior | Boundary |
|---|---|---|
| Idea/app intake | Web form/literal checked detail, terminal preview/add/list/show, and protected local API creation/catalog/detail; strict supplied input; immutable local input/provenance/hash; deterministic missing-input and six-track question preview | Intake only; not a review, no references opened, grants, execution or stakeholder decisions |
| Web dashboard | Overview, reviews, source snapshot/note inspection, findings, evidence, access, models, and terminal instructions | Local single-user service; source notes remain unreviewed |
| Installable CLI | Compiled JavaScript package; UI startup, review submission, run list, grants, artifact checks | npm archive; not published to a registry |
| Shared workspace | SQLite jobs, grants, audit events, and one coordinator | `.redteam/` under the current directory |
| Job lifecycle | Queue, primary run, verifier run, reporting, completion, limited coverage, failure, interruption | One active review; up to eight active or queued jobs |
| Startup recovery | Marks unfinished jobs interrupted | Does not replay browser actions automatically |
| Access grants | Exact web origins or canonical directories; capabilities, expiry, and revocation | Local text capture is enabled; external runner and code execution remain unavailable |
| Checked report export | Selected controlled reviews, supplied actions/plans, comparisons, and controlled evidence links; immutable JSON/Markdown, source hashes, historical action prefix, current source rights | Web/terminal/API; no raw source/research/credentials, new judgments, independent outcomes, or recall of delivered copies |
| Frozen experiment plans | Exact supplied plan and action revision, hypothesis/intervention/metric/sample/window/owner, immutable artifacts, current source rights, historical action integrity | Web/terminal/API; unreviewed protocol, local clock only, no execution or collected/independent outcome |
| Controlled comparison | Saved signup reports, pinned study/requirement/source hashes, complete distinct execution pairs, recorded instrumentation, explicit verdicts and coverage reasons | Web/terminal/API; no new execution, causal fix, action promotion, or arbitrary release matching |
| Tracked actions | Owner labels, next steps, validation methods, declared progress, source pins, revision history, atomic expected-revision writes, and current source access | Web/terminal/API; no external assignment/execution, independent outcome, or verified completion |
| Engineering notes | Supplied requirements and notes, exact saved-file/range hashes, original input artifact, snapshot pin, private report, current access, and immutable catalog | Citation integrity only; statements/provenance remain unreviewed, execution not performed, defects not assessed |
| Repository evidence | Exact `code:read` grant, bounded text artifacts, file hashes, exclusion counters, immutable catalog, and permission-checked inspection | Local plaintext, trusted operator, no code/test/model execution, no atomic revision or engineering judgment |
| Browser sessions | CLI import; encrypted local storage; metadata-only API responses | Local key beside the database; no OS keychain integration |
| Local API | Bearer session, Host and Origin checks, CSP, and protected code catalog/detail inspection | No remote tenant authentication; refresh/expiry timing is explicit |
| Study contract | Approved signup steps and valid input preconditions | Local fixtures only; one final text assertion |
| Expected result | Captured requirement identifier and source | Documented fixture oracle |
| Browser evidence | Actual screenshots, traces, events, execution records, hashes | Missing evidence restricts coverage |
| Reproduction | Fresh browser and fixture dataset per execution | Repeated procedure; not independent human assessment |
| Findings | Expected and actual result, verification, next action, business hypothesis | No measured adoption impact |
| Reports | JSON, Markdown, and dashboard detail | No complete startup assessment engine |
| Evidence publication | Private staged writes, file flush, exclusive final link, staging cleanup, and directory flush for JSON records and evidence-store byte artifacts | Local filesystem with hard-link/directory-sync support; Markdown, append streams, and external captures retain their existing path |
| Decision contract | Consumer and investor record consistency checks | No independent behavioral validity |
| Research sources | Immutable metadata, encrypted content, separate grounding/training/evaluation uses, expiry, and withdrawal | Operator-declared provenance; not authenticated research |
| Model versions | Immutable specification and hash; draft, declared research grounding, and restriction | Synthetic sources cannot ground models; no validated status |
| Evaluation locks | Registered cases, model and source hashes, horizon, baseline, thresholds, and immutable predictions | Software agreement check; no independent research approval |
| Leakage controls | Participant separation, denied held-out retrieval, and exposure tracking across evaluations | Uses declared identities and references; not external provenance authentication |
| Registered decisions | Model, scope, coordinator identity, and reference resolution | Verifies consistency and permissions; not behavioral truth |
| External processing | Separate source, scenario, and fact permissions; legacy records stay local-only | Operator declarations; no consent authentication |
| Configured inference | Optional OpenAI adapter, exact token preflight, strict action format, refusals, count drift, usage provenance, and estimates | Fake transport verified; real credentials and live availability not tested |
| Actor runtime | Permitted inspection, coordinator-owned identity, observed citations, checked decisions, limits, cancellation, and usage receipts | Scripted adapter plus optional configured OpenAI adapter; no live smoke test |
| Scenario constraints | Coordinator states bind decisions; hidden states remain unknown until every supporting fact is observed; positive purchase and investment requirements fail closed | Operator declarations; no authentication of actual funds, authority, diligence, amounts, or terms |
| Durable inference budget | Atomic token/cost reservations, fixed protected pools, invocation identities, dispatch guards, actual settlement, overrun stop, and uncertain liability across restart | Local SQLite; configured rates, not provider billing; no complete analyst task scheduler |
| Budget inspection | `redteam budgets show RUN_ID` reads current amounts and transition events; configured reports save a budget artifact | Report-time snapshots can precede later receipts |
| Configured actor task | Frozen manifest, one fenced attempt, heartbeats, dispatch identity, verified worker artifact, permission/model recheck, and coordinator acceptance | One local actor; no specialist scheduler or production worker isolation |
| Task control | List/show/cancel/recover commands; SIGINT/SIGTERM cancellation; stale outputs rejected | Local trusted coordinator and clock; database contention can affect latency |
| Interrupted reports | Factual partial evidence; saved normal reports can regain a missing catalog entry after task, sealed-byte, artifact, and permission checks | No inference replay or decision promotion from an unpublished seal |
| Missing publication | A completed task stays pending through its frozen deadline; afterward a permitted partial report preserves its task, seal, and budget with the decision unavailable | First valid JSON wins; no reconstructed action, task downgrade, or unknown-cost release |
| Report diagnostics | `redteam actors diagnose RUN_ID` distinguishes missing/unreadable publications, invalid JSON/identity, and missing/changed/unsafe artifacts; returns fixed guidance and a fingerprint | Does not open databases, change records, print report content, authorize research access, or accept decisions |
| Consumer and investor demo | Scripted rejection and conditional investment, with reasons, conditions, gaps, and evidence | Authored software fixtures; not behavioral predictions |
| Shared actor reports | Scripted and configured run catalog, report detail, permission checks, and artifact verification | Not durable live-agent task orchestration |

Revocation removes the active encrypted session and denies subsequent retrieval. It does not invalidate credentials at their provider or securely erase backups and old database pages.

The runner has deadlines for setup, actions, evidence capture, and cleanup. Browser contexts close explicitly before browser shutdown. The default cleanup allowance is ten seconds. Cleanup failures remain visible and prevent complete coverage.

## Recorded verification

Environment: Node v24.16.0, npm 11.13.0, installed Google Chrome 155.0.8059.86.

| Check | Result |
|---|---|
| Type checking | Passed |
| Full automated suite | 425 passed, zero failed or skipped |
| Build | Compiled JavaScript and declarations emitted |
| Packaged installation | npm archive installed into an isolated prefix; installed help and version worked |
| Web and terminal sharing | CLI review connected to the running dashboard service and saved one reproduced defect with seven artifacts |
| Desktop dashboard | Real metrics, review detail, captured screenshot, and artifact verification passed |
| Mobile dashboard | All five views checked at 390 px; no page overflow |
| Access flow | Browser created and revoked a scoped test grant |
| API boundaries | Missing session, foreign Origin, and forged Host denied |
| Evidence tampering | Changed artifact denied; verification returned invalid |
| Session handling | Encryption, owner-only files, metadata exclusion, revocation, expiry, and target checks passed |
| Coordinator ownership | Concurrent owner denied without interrupting active jobs |
| Registry controls | Twelve tests passed for immutability, scope, permissions, locks, exposure, withdrawal, and synthetic status |
| Decision resolution | Four tests passed for version resolution, identity, scope, references, withdrawal, and denied validation claims |
| Vault integrity | Record-bound authentication, modified ciphertext rejection, and missing-key behavior passed |
| Registry dashboard | Actual source counts and draft model cards passed desktop and mobile browser checks |
| Packaged repository CLI | Installed 0.8.0 capture/list/show, shared grants, two private hashed artifacts, source preservation, metadata-only output, evidence tampering, and revocation passed |
| Packaged web service | Installed 0.7.3 publication-gap dialog passed desktop and 390 px checks, unavailable-decision text, artifact verification, live withdrawal closure/cache clearing, and restricted retrieval; earlier completed/interrupted dialogs remain verified on 0.7.0 |
| Actor runtime checks | Eighteen tests passed, including coordinator constraint omission, state escalation, evidence substitution, hidden states, unknown barriers, and positive-action requirements |
| Actor demo evidence | Consumer and investor reports saved; three artifacts passed hash checks |
| Shared actor API | Saved both scripted decisions, served the report, and detected artifact changes |
| Actor dashboard | Scripted run, report inspection, artifact verification, and mobile layout passed browser checks |
| Provider verification | Eleven fake-transport checks passed; no real API requests |
| Processing permissions | Five checks passed, including legacy defaults and zero dispatch on denial |
| Configured execution | Thirty-four checks passed, including coordinator crashes, both publication orders, Markdown ownership, catalog interruption, preserved permission references/timestamp, withdrawal, and late receipts |
| Durable ledger | Nine checks passed, including six competing processes, protected pools, immutable identities, restart, closure, settlement, overruns, permissions, and symlinks |
| Task ownership | Nine checks passed, including competing claims, stale fences, bounded renewal, sealed output, safe pre-dispatch retry, restart, and private state files |
| Partial report recovery | Fifteen checks passed for factual reports, completed-task gaps, pending deadlines, unchanged task state, held liability, catalog repair, changed bytes, symlinks, withdrawal, and empty legacy catalog permissions |
| Normal publication recovery | Twelve added checks passed, including concurrent repair, byte preservation, changed decisions/fences/events/budgets, missing/duplicate artifacts, absent publication, rejection, and withdrawal |
| Atomic file publication | Nine checks passed for flush/close order, storage failures, unsupported links, six competing processes, and real writers killed at three publication boundaries |
| Evidence store | Six checks passed for artifact integrity, immutable records, serialization failure, final symlinks, and parent-directory escape |
| Read-only diagnostic | Thirteen checks passed for malformed/unsupported records, privacy, file and inventory bounds, unsafe references, staging, CLI behavior, and unchanged live task/budget/SQLite files |
| Action dashboard | Four real-browser checks passed creation, declared completion, text wrapping/escaping, live revision conflicts with preserved drafts, late save responses, mixed snapshot revocation, and unsaved-form expiry |
| Action tracking | Ten checks passed for strict input, fixed declaration labels, source integrity/access, expiry/revocation, transactional authorization, competing processes, history consistency, real queued fixture findings, distinct evidence IDs, CLI, and API conflicts |
| Code dashboard lifecycle | A real-browser integration check passed empty/populated cards, safe text, desktop/390 px, expiry, visible/pending revocation, changed evidence, network failure, and stale detail/catalog responses |
| Code inspection API | Six checks passed for session/Host/Origin, no-store JSON, minimal unverified lists, current permission, expiry/revocation, dependent tamper denial, static errors, and absent write/download routes |
| Engineering observations | Eleven checks passed for exact UTF-8/BOM/newline ranges, strict fields/types/bounds, stale references, fixed unreviewed labels, unknown expectations, input/report/source tampering, expiry/revocation, partial publication, snapshot pins, unsafe paths, and CLI commands |
| Repository snapshot | Fifteen checks passed for exact grants, expiry, revocation during reads/publication, root replacement, source preservation, no execution, private output, exclusions, file/byte/entry/depth/deadline bounds, changed evidence, and CLI behavior |
| Report withdrawal | API checks passed; a browser check confirmed the open report closes and cached detail is cleared |
| Local file boundaries | Dangling database symlinks denied before target creation; credential-bearing target URLs rejected |
| Pinned Chromium download | Earlier cache-lock failure; installed Chrome fallback verified |

An initial test pass attempt exposed browser shutdown deadlines under load. The implementation now closes contexts explicitly and uses the documented bounded cleanup allowance. The full suite passed after that correction. An installed-build review from before that correction correctly reported limited coverage; it did not report an app defect.

The current installable archive is `outputs/redteam-0.12.0.tgz`. `work/verify-installed-0.12.0.mjs` verified source-linked plan creation, declared completion, desktop/390 px detail and forms, long-title wrapping, a real CLI update causing a preserved-draft HTTP conflict, normal-poll terminal revocation, cleared detail, denied dependent links, no persistent storage, existing actor detail, and creation from an actual broken-fixture finding with distinct job/evidence IDs. Tracking started no additional review. Results are `outputs/installed-verification-0.12.0.json`; action creation/detail/conflict screenshots under `outputs/preview/` were visually inspected. Browser and service are stopped. No uncaught browser error, real credential, or provider request occurred. Full suite: `outputs/test-results-0.12.0.txt`.

The 0.11.0 backend checks remain in `outputs/installed-verification-0.11.0.json`. They cover source pins, atomic expected revisions, history, permission, and controlled finding lineage. U04's scoped action workflow is now available in the web, terminal, and API. Structured experiment/outcome records and independent validation remain unfinished.

The installed 0.10.0 UI checks remain in `outputs/installed-verification-0.10.0.json`. They cover desktop/390 px code inspection, safe text, long paths/hashes, no overflow, normal-poll terminal revocation, cleared detail, actor detail, and a real fixed browser review. Its screenshots remain under `outputs/preview/` and were visually inspected. That release predates action controls; the current release adds them with the same shared dialog ownership. The current suite still passes that browser lifecycle regression.

The 0.9.1 API checks remain in `outputs/installed-verification-0.9.1.json`. They cover protected code catalogs/detail, current access, hash checks, static denials, and absent write/download actions. U15 local inspection is now implemented; it does not provide source execution or semantic review. Cross-process permission changes are detected by refresh and known local expiry, with explicit timing limits.

The 0.9.0 CLI checks remain in `outputs/installed-verification-0.9.0.json`. They cover note registration, exact range hashes, snapshot/input pins, fixed result labels, and revocation. That release predated the current dashboard controls; its earlier browser baseline was 0.7.3.

The 0.8.0 installed checks remain in `outputs/installed-verification-0.8.0.json`. They cover repository capture, metadata inspection, source preservation, private artifacts, hashes, exclusions, and revocation. The current suite also passed all fifteen original snapshot checks after extracting the common bounded local-file reader. Dashboard JavaScript remains unchanged in 0.9.0; only install-version text changed. Its browser baseline remains the verified 0.7.3 release.

The 0.7.4 installed checks remain in `outputs/installed-verification-0.7.4.json`. They cover terminal diagnostics, three matching scripted artifacts, malformed/missing/changed publications and evidence, staging preservation, private-content suppression, and unchanged file trees. Its earlier browser baseline is recorded separately below.

The 0.7.3 installed checks remain in `outputs/installed-verification-0.7.3.json`. They cover completed-task publication-gap recovery, exact seals, concurrent catalog repair, and permission protection for empty legacy catalog references. The new dialog passed desktop/mobile checks, hash verification, live withdrawal closure/cache clearing, and denied retrieval. Screenshots remain under `outputs/preview/`; that temporary browser and service are stopped.

The earlier 0.7.2 installed checks remain in `outputs/installed-verification-0.7.2.json`. They cover compiled exclusive publication and both real-browser signup fixtures with seven valid artifacts each. The current full suite also passed the fixture runner checks.

The earlier 0.7.0 installed browser checks remain recorded in `outputs/installed-verification-0.7.0.json`. Completed and recovered report dialogs passed desktop/mobile checks with no overflow or browser errors; withdrawal restricted both dependent reports. Screenshots are under `outputs/preview/`. The temporary service and browser are stopped. Generated data is excluded from Git.

Earlier D1 reports remain under `outputs/runs/`. The dashboard imports recognized reports from that directory. New service runs use `.redteam/runs/`.


## Version 0.13 verification

Bounded comparison of saved controlled-signup evidence is implemented through the terminal and protected local API. This is a scoped U05 prototype. It does not run another browser review, source code, model, or tracked action. Baseline/candidate review job IDs and their distinct evidence IDs are pinned with report hashes. Matching parsed study and captured requirement hashes, recorded runtime/browser identity, chronology, complete primary/verifier coverage, distinct execution/dataset IDs, consistent assertions/findings, checked artifact bytes, required capture signatures, and matching execution JSON are required before a result is comparable. An empty finding list cannot imply that the requirement passed. Different observations on the same recorded build receive a distinct verdict. Causal improvement and wider release correctness remain unknown.

Exact implementation files:

- `src/browser-evidence.ts`: shared bounded identity/artifact reader for controlled fixtures; `src/actions.ts` uses it without upgrading action semantics.
- `src/comparisons.ts`: coverage and consistency assessment, static reason codes, six factual verdicts, immutable private publication, source-pin artifact, checked retrieval, and bounded unverified catalog summaries.
- `src/workspace.ts`: immutable comparison catalog, synchronous source-pin check inside an atomic insert/audit transaction.
- `src/cli.ts`: `comparisons create --baseline REVIEW_ID --candidate REVIEW_ID`, list, and show. A saved `not_comparable` create exits with status 1.
- `src/server.ts`: authenticated no-store list/create/detail routes, one active comparison per service, static creation/detail denials. No source download or arbitrary execution is added.
- `tests/comparisons.test.ts`: 25 checks, including actual broken/fixed fixture pairs, all four observed state combinations, unchanged action/history/source records, incomplete/altered coverage, missing and reused datasets, changed scope/instrumentation, inconsistent assertions/sealed records, chronology, aliases, tampered/symlink artifacts, publication/source changes, guarded catalog insertion, preserved orphan bytes, strict input, compiled-by-build CLI paths, and protected API behavior. Negative metadata cases are authored software fixtures.

Type checking, build, and the full suite passed: 272 tests, zero failures or skips. Log: `outputs/test-results-0.13.0.txt`. The package contains 106 files and is installed into an isolated prefix. `work/verify-installed-0.13.0.mjs` verifies the compiled CLI and API with actual broken/fixed captures, fourteen source artifacts, job/evidence identity separation, source pins, declared-action preservation, no extra review jobs, a saved reversed-time not-comparable result with exit 1, static changed-source denial, session/Origin controls, and no-store responses. Results are in `outputs/installed-verification-0.13.0.json`. All temporary browser/server resources are stopped. No live provider request or credential was used.

Contract: `docs/comparisons.md`. Dashboard comparison is the next ready milestone; current web behavior remains the 0.12.0 workflow, with only install-version text changed. The existing action and source-dashboard browser regressions passed in the current full suite. Arbitrary releases, semantic finding matching, independent outcomes, real research, calibrated stakeholder models, live-provider verification, commercial validation, worker isolation, and broad hierarchy remain open. Current metadata/hashes assume a trusted local operator, local clock, and filesystem; no external signatures or causal/behavioral validation are claimed. Failed publication/catalog attempts preserve private orphan bytes without automatic adoption or cleanup.


## Version 0.14 verification

The saved controlled-review comparison now has a dashboard workflow. Reviews provides explicit baseline/candidate selection, same-review rejection before submission, preserved selections during refresh, catalog inspection, checked factual results, coverage reasons, requirement/study scope, distinct job/evidence IDs, report/build hashes, and limits. Reasons appear before long provenance detail. Not-comparable records remain visible as that result. No review, app code, model, or follow-up action is executed by comparison, and action declarations/history remain unchanged.

Exact files:

- `web/index.html`: comparison card and create control in Reviews; install text uses 0.14.0.
- `web/app.js`: protected comparison catalog refresh, current-parent filtering, explicit selection form, checked detail, normal-poll integrity recheck, and shared-dialog ownership/cancellation. Source rejection, parent unavailability, or failed metadata refresh clears managed content. A closed or replaced view cannot be restored by a late response. A committed create is not undone or automatically retried after response loss.
- `web/styles.css`: bounded selection controls, wrapping, and form spacing.
- `tests/comparison-dashboard.test.ts`: six real-browser checks for desktop/mobile creation and not-comparable reasons, unchanged declared actions, safe text, source tamper, delayed detail after navigation, delayed committed create after close, selected-parent loss, mixed catalog/workspace snapshots, metadata failure, and no persistent browser storage.
- `docs/comparisons.md`, README, package metadata, status, backlog, and continuation describe the exact scope.

Type checking and build passed. The full suite passed 278 tests, zero failures or skips, including existing source/action dashboard regressions and all 25 comparison backend checks. The focused six-check comparison browser suite also passed after the final copy/detail ordering change. Logs: `outputs/test-results-0.14.0.txt` and `outputs/comparison-dashboard-targeted.txt`.

`outputs/redteam-0.14.0.tgz` contains 106 files and is installed into an isolated prefix. `work/verify-installed-0.14.0.mjs` checks compiled CLI/API behavior, real broken/fixed fixture evidence, fourteen source artifacts, explicit comparison creation in the installed dashboard, desktop/390 px layouts, source/scope identities, visible not-comparable reasons, unchanged action history, two unchanged review jobs, normal idle-poll source-tamper closure without a forced refresh, cleared detail, no persistent browser storage, and zero uncaught browser errors. Results: `outputs/installed-verification-0.14.0.json`. Four desktop/mobile screenshots are under `outputs/preview/comparison-*-0.14.0.png` and were visually inspected. Temporary browser and service resources are stopped. No live provider request or credential was used.

U05 now supports saved controlled-signup evidence in web, terminal, and API. Arbitrary release matching, causal fixes, independent outcomes, live providers, researched stakeholder calibration, broad hierarchy, worker isolation, and commercial validation remain open. Current local clock, trusted-operator, plaintext/backups, refresh latency, and delivered-data limits remain explicit. No research, purchase, investment, or funding claim has been added.

Next ready milestone: U04 immutable structured experiment plans linked to a checked action revision and source evidence. Capture hypothesis, intervention, metric/outcome definition, method, sample plan, planned horizon, owner, and limits before any later reported outcome. Keep supplied plans/provenance unreviewed and outcome collection unavailable until implemented; do not claim prospective human validation from timestamps or software fixtures. U06 independent outcome tracking remains separate.


## Version 0.15 verification

U04 now has immutable structured experiment plans through the terminal and protected local API. Each supplied hypothesis, intervention, outcome measure, success rule, collection method, population/recruitment/count plan, future UTC window, owner, and title is frozen against an exact checked action revision and original source pin. Two private artifacts preserve the parsed input and historical action. Later declared action updates preserve the frozen version; new freezes require the latest revision. Source access, complete action history, historical content hashes, and artifact integrity govern retrieval. A passed window does not imply execution or an outcome.

Exact files:

- `src/experiments.ts`: strict plain-JSON contract without accessor/custom-serializer execution, policy `local-experiment-plan-v1`, input/text/sample/time bounds, local future-window and revision checks around publication and inside insertion, immutable evidence, fixed unreviewed/unassessed labels, current-source reads, and bounded unverified catalog summaries.
- `src/actions.ts`: shared checked-history routine and synchronous historical action-version pin/access check. Action tracking semantics remain operator declarations.
- `src/workspace.ts`: immutable experiment-plan catalog, synchronous guards, atomic insert/audit.
- `src/cli.ts`: `experiments freeze FILE`, list, and show. `src/server.ts`: session/Host/Origin/no-store list/freeze/detail routes, revision-conflict 409, static invalid-input 400 and unavailable-detail 404. No experiment execution, result, mutation, or artifact-download route exists.
- `examples/experiment-plan.input.json` and `docs/experiment-plans.md`: packaged template and full bounds, lineage, access, chronology, and epistemic limits. Replace placeholder IDs/timestamps before use.
- `tests/experiments.test.ts`: 17 checks covering exact input/action preservation, later revisions, stale expectations, authority/outcome escalation, getters/serialization, invalid windows, elapsed-window state, revocation/expiry, source/publication/artifact/history tamper, unsafe links, insertion withdrawal/revision/time races, atomic audit/immutability, CLI/API, and a real browser finding with distinct job/evidence IDs. All plans and negative cases are authored software fixtures.

Type checking, build, and the full suite passed: 295 tests, zero failures or skips. Log: `outputs/test-results-0.15.0.txt`. `outputs/redteam-0.15.0.tgz` contains 110 files and is installed into an isolated prefix. `work/verify-installed-0.15.0.mjs` verifies compiled help/version/template, exact input and action pin, two checked artifacts, historical readability after a real CLI update, stale-revision denial, preserved source and action/job/actor state, protected API, fixed unreviewed/uncollected labels, unsupported outcome-route denial, and terminal revocation denying both API and CLI without private detail leaks. Results are `outputs/installed-verification-0.15.0.json`. The temporary service is stopped; no browser, credential, or live provider request was used by that installed check. The full suite includes the actual browser-plan fixture and all dashboard regressions.

The existing dashboard remains the verified 0.14.0 comparison/action workflow; only install-version text changed. Its installed desktop/mobile and normal-poll comparison checks remain in `outputs/installed-verification-0.14.0.json`. Experiment controls are next. Local timestamps do not prove prospective research, unknown prior outcomes, external registration, or consent/protocol approval. No human, purchase, investment, funding, causal, commercial, or independent-outcome validation is established. No orphan adoption, automatic retry/cleanup, execution, recruitment, collection, or action-status promotion is enabled.

Next ready milestone: U04 web creation and inspection of supplied frozen experiment plans, with deliberate revision conflicts, source access/expiry/integrity checks, safe text, desktop/mobile layout, and late-response guards. U06 independent outcome collection/adjudication, arbitrary releases, human research, live providers, worker isolation, paid demand, and broader specialist hierarchy remain open.


## Version 0.16 verification

U04 supplied experiment plans now support creation and checked inspection in the dashboard. Open a checked action and freeze a plan against its displayed revision. The form captures hypothesis, intervention, measurement/success/collection method, intended population/selection/count, title, owner, and local-time start/end with a UTC preview. Client bounds prevent ordinary empty/oversized/invalid-window saves; the server retains its full policy. Plans execute no work, recruit nobody, and collect no outcomes.

Exact files:

- `web/index.html`: frozen-plan catalog in Reviews; install text uses 0.16.0.
- `web/app.js`: five-endpoint refresh, current-source filtering of mixed plan/workspace metadata, shared permission/expiry/detail checks, supplied-plan form, exact expected revision, local-time-to-UTC conversion, checked historical/source detail, fixed unreviewed/uncollected labels, draft-preserving conflicts, explicit discard/fresh-read control, and no automatic retry. Late committed responses cannot restore closed/restricted views.
- `web/styles.css`: bounded form controls, wrapped titles, and spacing.
- `src/experiments.ts`: authorized summaries add minimal origin IDs for client filtering against current source rights. No private source bytes or full plan are added to catalogs.
- `tests/experiment-dashboard.test.ts`: seven real-browser checks for exact UTC storage from an Asia/Kolkata browser context, desktop/mobile safe text and wrapping, unchanged action state, historical pin after later declared completion, conflict preservation/deliberate reload, revocation, delayed committed response, known expiry, mixed metadata, failed refresh, and absent persistent browser storage.
- `docs/experiment-plans.md`, README, package metadata, status, backlog, and continuation describe the implemented workflow and timing/time-zone limits.

Type checking, build, and the full suite passed: 302 tests, zero failures or skips. Log: `outputs/test-results-0.16.0.txt`. The focused seven-check browser log is `outputs/experiment-dashboard-targeted.txt`. Existing action, code, comparison, actor, registry, source, budget, publication, and recovery regressions pass.

`outputs/redteam-0.16.0.tgz` contains 110 files and is installed into an isolated prefix. `work/verify-installed-0.16.0.mjs` verifies compiled CLI/API/template behavior, two checked plan artifacts, web freezing against action revision 2, exact UTC timestamps, checked historical detail, HTML-like/long supplied text, desktop/390 px layouts, no overflow, a real CLI change causing preserved-draft 409 without another plan, deliberate fresh read, normal idle-poll terminal revocation without a forced refresh, cleared private detail/catalog, no persistent browser storage, unchanged source, zero review/actor jobs, and zero uncaught browser errors. Results are in `outputs/installed-verification-0.16.0.json`. Five form/detail/conflict screenshots under `outputs/preview/experiment-*-0.16.0.png` were visually inspected. Browser and temporary service are stopped. No live credential or provider request was used.

U04 and U05 now provide their scoped local action/plan/comparison workflows across web, terminal, and API. This does not establish prospective human research, consent/protocol approval, independent outcomes, causal fixes, researched psychology, actual purchase/investment demand, funding probabilities, paid commercial validation, production isolation, or broader hierarchy. Current rights/integrity, local clocks and time-zone conversion, trusted operator/filesystem, polling, plaintext/backups, response-loss, and delivered-data limitations remain explicit.

Next ready work: a bounded U08 report export workflow for checked local review/action/plan/comparison records, preserving source/provenance labels and current permission checks without exporting sessions, provider secrets, raw source snapshots, or research content. Independent outcome intake/adjudication remains a separate U06 milestone and must not be inferred from frozen plans or synthetic checks. External research, real pilot access, credentials, and C03 paid demand remain missing inputs; continue independent work without claiming those gates passed.


## Version 0.17 verification

U08 now has bounded terminal report export for selected controlled review, supplied action, frozen experiment-plan, and comparison records. One to ten unique typed IDs (at most five reviews) produce immutable public JSON and a Markdown evidence appendix. Fixed projections omit automatic internal source paths/grant targets, source artifact paths, raw code, network logs, images/traces, sessions, credential stores, research, and unrelated records. Supplied text remains supplied text and may contain private content; no universal secret detector is claimed. No new judgment, execution, outcome, or stakeholder assessment is generated.

Exact files:

- `src/report-export.ts`: strict descriptor-based selection parser, existing checked readers, private source pins/public references, historical action revision/history-prefix hashes, current source permissions, bounded projections, literal JSON fences, 2 MB JSON/2.2 MB Markdown limits, exclusive publication, guarded catalog insertion, unverified bounded listing, and checked source/publication/Markdown retrieval.
- `src/workspace.ts`: immutable report-export catalog and atomic synchronous source-check/insert/audit transaction.
- `src/cli.ts`: `reports export FILE`, list, and show. Export prints the private JSON/Markdown paths. There is no report download/create API or dashboard export control yet.
- `examples/report-export.input.json`, `docs/report-export.md`, and `docs/report-export-plan.md`: template, implemented contract, and design boundary. Replace placeholder IDs before use; the design plan is repository-only.
- `tests/report-export.test.ts`: 13 checks for source/action preservation, a mixed actual browser/action/plan/comparison export, distinct identities/provenance, private raw-code/credential/path marker exclusion, strict unsupported/duplicate/getter/size selection, historical updates and note tamper, withdrawal/expiry, source/publication/Markdown changes, unsafe links, literal untrusted HTML/Markdown, guarded insertion/audit/orphan preservation, immutable/synchronous catalog checks, CLI, and oversized valid authored histories.

Type checking, build, and the full suite passed: 315 tests, zero failures or skips. Log: `outputs/test-results-0.17.0.txt`. `outputs/redteam-0.17.0.tgz` contains 114 files and is installed into an isolated prefix. `work/verify-installed-0.17.0.mjs` verifies compiled help/template/CLI/API behavior, actual broken/fixed captures, comparison, action and frozen plan, four selected record kinds in the exported JSON/Markdown, checked hashes, omitted raw-code/credential/directory markers, preserved historical revision after a real CLI update, source/job/actor preservation, and terminal revocation denying managed export/plan retrieval while delivered bytes remain unchanged. Results: `outputs/installed-verification-0.17.0.json`. Browser contexts used by capture closed; the temporary service stopped. No provider credential or live model request was used.

Existing dashboard behavior remains the installed 0.16.0 workflow; only install-version text changes in this release. All dashboard browser regressions passed in the current suite. Checked export preserves saved source semantics and supplied labels; it does not independently adjudicate claims, approve a protocol, authenticate provenance, establish prospective human research, collect outcomes, or validate demand/purchase/investment/funding/causality. Local operator/clock/metadata/filesystem, plaintext/backups, delivered-copy, and orphan limits remain explicit. Broad hierarchy still requires C03 paid demand and other research/isolation gates.

Next ready milestone: protected U08 report-export API and dashboard selection/inspection/download. Reuse current source/pin checks and no-store session/Host/Origin boundaries. Keep full private pins out of catalogs/downloads, allow only selected typed records, render supplied text safely, recheck access immediately before response/download, prevent stale responses from restoring closed/restricted views, and state that delivered copies cannot be recalled. Actor/research export and U06 independent outcome intake/adjudication remain separate.


## Version 0.18 verification

U08 report export now has protected creation, catalog/detail, and exact JSON/Markdown attachment downloads through the local API. Session/Host/Origin/no-store protections apply. Full selected-source and saved-file checks precede detail/download; a synchronous current-source/access check runs again immediately before response headers and bytes. Catalogs contain minimal public references, without private source pins or directories. Unsupported formats/mutations/source-artifact routes remain unavailable.

Exact files:

- `src/report-export.ts`: minimal public source refs in authorized summaries, a synchronous final access guard, and Markdown rendering from an already checked in-memory public report. It does not reopen an arbitrary path after the access check.
- `src/server.ts`: GET/POST `/api/report-exports`, checked detail, `/download.json`, and `/download.md`; one active creation per service; static 400/404/409 responses; UUID-derived attachment names, exact byte length and SHA-256 header, no-store, and final access guard.
- `tests/report-export-api.test.ts`: six checks for confirmed creation, exact attachment/file bytes/hash/length, public catalog projection, session/Origin/real forged-Host protection, strict inputs, unavailable/tampered publications, unsupported formats/mutations, withdrawal/expiry, unchanged delivered copies, historical action updates/note tamper, and revocation injected after full source verification but before attachment delivery. The last check receives static 404 with no attachment headers or private body.
- `docs/report-export.md`, README, package metadata, status/backlog/continuation describe the API and delivery boundary. `docs/report-export-dashboard-plan.md` records the next UI work and verification; it is repository-only.

Type checking, build, and the full suite passed: 321 tests, zero failures or skips. Log: `outputs/test-results-0.18.0.txt`. Focused API log: `outputs/report-export-api-targeted.txt`. `outputs/redteam-0.18.0.tgz` contains 114 files and is installed into an isolated prefix. `work/verify-installed-0.18.0.mjs` verifies the compiled mixed actual browser/action/plan/comparison export, protected API creation, public catalog omission of private pins/paths, exact JSON/Markdown attachments, length/hash/no-store headers, unsupported route/input denials, historical preservation, terminal withdrawal blocking both downloads/detail/catalog/CLI, preserved delivered bytes, unchanged source/jobs/actors, and zero live credentials/provider calls. Results: `outputs/installed-verification-0.18.0.json`. Browser capture contexts closed and the temporary service stopped.

Dashboard behavior remains the verified 0.16.0 workflow, with only install-version text changed. All current dashboard regressions pass. Delivered copies cannot be recalled. Current-source checks are local boundaries rather than atomic transactions with external receipt/files. Local metadata/operator/clock/filesystem/backups, declaration semantics, absent independent outcomes, and research/commercial/isolation/hierarchy gates remain as documented.

Next ready milestone: implement the protected export dashboard selection, checked inspection, and JSON/Markdown download workflow in `docs/report-export-dashboard-plan.md`. Preserve all existing managed-view protections and keep exported source scope unchanged. U06 independent outcomes, actor/research export, real research/pilot/provider inputs, C03 paid demand, and broader scheduling/isolation remain open.

During this continuing run, a later account check reported ordinary usage available, primary 24% used and secondary 4% used. No credits or reset credits were purchased or redeemed. Continue useful work; do not stop at an individual release checkpoint.


## GitHub synchronization enabled

The user authorized ongoing GitHub pushes. Created and verified the private repository `https://github.com/devanshxNishu/redteam`, attached it as this checkout's HTTPS `origin`, and set `main` to track `origin/main`. The initial remote SHA matched product commit `4778e08a3d3df5f315e4eba56cc83b140ff3936a` exactly. Source history and ignored-path checks completed before the first push; generated evidence, workspaces, local vaults, dependencies, caches, archives, sessions, and `.env` remain outside Git. Existing GitHub CLI authentication is used through a repo-local helper; no credential is committed or embedded in the remote URL.

`docs/github-sync.md` records the standing workflow. After every verified milestone, inspect and commit only ready source/tests/docs, push ordinary commits, and verify the remote `main` SHA. Preserve remote contributions; never force-push. The existing `continue-redteam-development` heartbeat prompt was updated through the automation tool and reread to confirm GitHub instructions are saved, status remains ACTIVE, cadence remains every 30 minutes, and the target chat is unchanged. No credits or reset credits were used.

This synchronization checkpoint changes documentation only. Product verification remains 0.18.0 with 321 passing tests and its installed evidence. No extra test run is needed for the GitHub/documentation setup. Continue the planned export dashboard work; the broader product is not complete.


## Version 0.19 verification

U08 checked local report export now has dashboard selection, creation, catalog/detail inspection, and verified JSON/Markdown native-download requests. The selector preserves its title/typed IDs across refresh, removes unselected withdrawn-source labels, and closes when a selected source is unavailable. It offers up to 25 recent permitted options per kind plus selected records still known in current catalogs, with one-to-ten/at-most-five-review bounds. Backend source checks still control publication. Known expiry uses the earliest grant across selected sources.

Exact files:

- `web/index.html`: checked-export card, select control, and recent catalog in Reviews; install text uses 0.19.0.
- `web/app.js`: six-endpoint refresh, current-parent/source filtering, multi-grant expiry, explicit typed selection, fixed source scope, checked safe-text detail/collapsed record JSON, current-view download guards, bounded stream/length/SHA-256 verification, native Blob download dispatch, and managed URL cleanup. Pending selection controls remain locked during refresh. Old detail/create/download responses cannot restore restricted views or dispatch a download. No automatic create retry or reduced-bundle submission occurs.
- `web/styles.css`: wrapping, bounded checkbox groups, literal JSON display, and mobile download controls.
- `tests/report-export-dashboard.test.ts`: 11 real-browser checks covering a mixed actual review/action/plan/comparison bundle, exact native JSON/Markdown bytes, literal HTML/long text, desktop/mobile wrapping, title/selection preservation, selected/unselected withdrawal, earliest of two grant expiries, empty/excess selection, saved artifact tamper, late initial detail, late committed create, late download after withdrawal, altered download hash, mixed old/current metadata, failed refresh, Blob cleanup, no duplicate writes, and no local/session storage.
- `docs/report-export.md`, README, package metadata, status/backlog/continuation describe delivered-copy and current-catalog/time-bound limits. `docs/installation-check-plan.md` records the next independent technical slice and is repository-only.

Type checking, build, and the full suite passed: 332 tests, zero failures or skips. Log: `outputs/test-results-0.19.0.txt`. Focused browser log: `outputs/report-export-dashboard-targeted.txt`. Existing source/action/plan/comparison/actor and publication/recovery/registry/budget tests all pass.

`outputs/redteam-0.19.0.tgz` contains 114 files and is installed into an isolated prefix. `work/verify-installed-0.19.0.mjs` verifies the compiled mixed real-fixture export and protected API, web selection/title preservation, a four-kind bundle, literal/long text, checked collapsed bodies, desktop/390 px layout without overflow, both native downloads exactly matching saved JSON/Markdown, omitted raw-source/credential markers, normal idle-poll terminal revocation clearing view/catalog without a forced refresh, no persistent browser storage, unchanged source/action/jobs/actors, and zero uncaught browser errors. Results: `outputs/installed-verification-0.19.0.json`. Four selection/detail desktop/mobile screenshots under `outputs/preview/report-export-*-0.19.0.png` were visually inspected. Browser and temporary service stopped. No live provider request or credential was used.

The repository is private at `https://github.com/devanshxNishu/redteam`. Per the user's standing authorization, verified ready changes are committed, pushed to `origin/main`, and checked against the remote SHA. `outputs/release-verification-0.19.0.json` and `outputs/github-sync-verification.json` record exact version/commit/remote results locally. Generated evidence, workspaces, caches, dependencies, vaults, sessions, credentials, and archives remain outside Git. The existing continuation heartbeat includes GitHub sync instructions and remains ACTIVE every 30 minutes.

U04/U05/U08 now provide their scoped local action/plan/comparison/export workflows across web, terminal, and protected API. Exports preserve recorded claims and supplied labels rather than independently adjudicating or promoting them. Download dispatch is not proof of completed filesystem save, and delivered copies cannot be recalled. Current rights/integrity, local metadata/operator/clocks/filesystem, current catalog windows, bounded requests, plaintext/backups, and response-loss limitations remain. No human/research/prospective/causal/customer/purchase/investment/funding/commercial/production validity is claimed. C03, real research/pilot/provider inputs, actor/research export, external execution/isolation, independent outcomes, and broader hierarchy remain open.

Next ready milestone: implement U16 read-only local installation preflight and scope limits from `docs/installation-check-plan.md`. Verify exact pinned headless-browser discovery before using it; never treat an executable-path hint or file presence as a successful browser launch. Do not create stores, read private runtime content, load keys, launch tools/providers, install/repair automatically, or infer stakeholder validity from readiness.

## Remaining scope

- Authorized external app execution and production worker isolation.
- Semantic source-code review, executed code-test tools, and independent engineering verification; supplied notes currently receive citation checks only.
- Verified human research provenance, consent-document review, and representative sampling.
- Real held-out human evaluation, uncertainty analysis, and independent research review.
- A verified live provider run, empirical actor calibration, analyst leads, subagents, and the roundtable.
- Country adaptation, consumer buying models, and investor decision models.
- Validated purchase, conversion, investment, or population predictions.
- Hosted tenant authentication, durable distributed workers, analyst task leases, and integration of shared parent budgets with a specialist scheduler.
- Arbitrary release matching, independent outcome tracking, and commercial demand evidence.

No real provider calls occurred in the recorded checks. Scripted runs report zero model spend. Configured runs retain rate-based estimates and unknown-usage markers. Infrastructure cost is not calculated.

## Next milestone

The active subject scope is **ideas and apps only**, as confirmed by the user. The checked evidence-link export is implemented in 0.24.0. I01 strict terminal idea/app briefs and deterministic scope preview are now implemented. I02 now adds the protected brief API. I03 explicit web intake is implemented. Next, define and implement I04 bounded evidence-linked analyst review from `docs/idea-and-app-scope.md`. Saving a brief is not a completed review. Do not fetch supplied URLs/files, grant access, execute tools/models, fabricate app evidence for ideas, or infer demand/investment. Independent human outcomes, external isolation, real research/pilot/provider inputs, C03 paid demand, and broader hierarchy remain open. Continue normal verified GitHub pushes.

App review, grounded scenarios, and validated prediction retain separate release gates. Current software tests establish neither behavioral validity nor production readiness.

## Earlier continuation preparation

October 25, 04:14 UTC: product source remains 0.9.1 (`42bbc97`), with its recorded 232 passing tests. `docs/dashboard-code-review-plan.md` now specifies the remaining U15 UI and race/access verification work. This is a documentation-only checkpoint; no new product verification is claimed. Usage was 99% used, with a reported natural reset at 04:33:09 UTC. Scheduled continuation remains active. No credits or reset credits were used.

The natural five-hour usage reset was observed on the 04:44 UTC continuation (0% used). No credits or reset credits were used. Product development resumed within the same chat and checkout.

## Version 0.20 verification

U16 adds read-only terminal installation preflight with `redteam doctor`. It checks the declared stable Node range, bounded trusted package/driver metadata, source or compiled assets, the exact pinned Chromium headless-shell candidate, and workspace/state directory boundaries. Explicit cache settings and initial-directory precedence match the pinned driver. A fixed macOS Chrome file is only a fallback hint after a missing shell; no launch, signing, libraries, write access, or runtime success is inferred. Unsupported metadata/host overrides and missing/unsafe files return static issue codes and attention exits. Absolute runtime locations and unrelated environment/private content are omitted. No store, key, session, research, SQLite content, target source, service, browser, or provider is opened by this command; no repair/install/write occurs.

Exact files:

- `src/installation.ts`: versioned report, strict stable-version comparison, pinned shell/cache/platform discovery without driver import or environment mutation, bounded metadata and safe asset-parent checks, metadata/access states, static guidance, and explicit capability/effect limits.
- `src/cli.ts`: strict no-argument doctor command, help, JSON output, and attention exit 1 before any store/service branch.
- `tests/installation.test.ts`: 12 checks covering five cache modes against the actual pinned driver in isolated processes, authored platform/Rosetta layouts, source/compiled fixtures, complete fresh/private tree preservation, invalid SQLite/credential sentinel exclusion, absent/nonexecutable/unsafe candidates, unsafe assets/state paths, bounded/unsupported metadata, unsupported runtime/host settings, and CLI arguments/exit/no-store behavior. These preflight checks launch no browser.
- `docs/installation-preflight.md`, README, package metadata, and terminal install text document separate setup and runtime checks. `docs/outcome-evidence-plan.md` specifies the next repository-only slice.

Type checking, build, and the full suite passed: 344 tests, zero failures or skips. Log: `outputs/test-results-0.20.0.txt`. Focused log: `outputs/installation-targeted.txt`. Existing browser/dashboard/source/action/plan/comparison/export/actor and storage regressions all pass.

`outputs/redteam-0.20.0.tgz` contains 117 files and is installed in an isolated prefix. `work/verify-installed-0.20.0.mjs` verifies compiled help/version/contract, fresh and private-invalid-SQLite workspace preservation, strict arguments, explicit-cache metadata-only candidates, nonexecutable attention exit, omitted absolute/private markers, and scope limits. A separate actual fixed signup review produced zero findings, seven valid artifacts, distinct job/evidence IDs, and fresh primary/verifier datasets. Both executions used installed Chrome 155.0.8059.86. The doctor reported `mac_chrome_fallback_hint` and never claimed that it launched a browser. Results: `outputs/installed-verification-0.20.0.json`. Review browsers closed; no persistent service, real credential, or provider request was used.

The only web change adds the doctor command and 0.20.0 archive text to installation instructions. All dashboard regressions pass; the visually inspected 0.19.0 installed desktop/mobile export baseline remains recorded separately. Installation readiness establishes no researched psychology, human/population validity, purchase/investment/funding/customer demand, commercial validation, or production isolation. Local operator/clock/filesystem/metadata and later-operation races remain explicit.

Next ready milestone: the terminal-only controlled outcome evidence link in `docs/outcome-evidence-plan.md`. Keep full source/time lineage and fixed unadjudicated labels. U06 independent human outcome tracking is not complete. External execution/isolation, real research/pilot/provider inputs, C03 paid demand, and broader hierarchy remain open. Continue normal verified pushes to the private GitHub repository.

## Version 0.21 verification

A terminal-only controlled outcome evidence link now connects a frozen supplied plan to a later checked signup comparison. It requires the exact baseline finding/action/requirement and completed original jobs, fresh full comparison classification, source hashes, historical action-event bytes, and consistent local baseline/action/freeze/window/candidate/observation/comparison times. It preserves all source records and fixes hypothesis resolution, sample adequacy, independent verification, intervention verification, protocol/semantic review, and causality to unapproved states. This is preparation for U06, not completed independent human outcome tracking.

Exact files:

- `src/outcome-evidence.ts`: strict bounded plain input, full checked source capture, exact lineage and clock-window rules, fresh source classification, immutable private JSON/two artifacts, repeated file/source guards, current completed-job/catalog/history checks, checked reads, minimal unverified catalogs, and early sequential-duplicate rejection.
- `src/workspace.ts`: private immutable outcome-evidence catalog, unique plan/comparison pair, atomic synchronous authorization/insert/audit, and bounded list/lookup methods. Concurrent losing writers can leave private orphan bytes; no adoption/retry/deletion occurs.
- `src/comparisons.ts`: exports its existing pure controlled evidence classifier for fresh registration checks; original comparison behavior is preserved.
- `src/cli.ts`: strict `experiments evidence register FILE|list|show EVIDENCE_ID` commands and help.
- `tests/outcome-evidence.test.ts`: 23 checks covering a genuine freeze-before-later-real-capture workflow, copied-capture/authored-clock negative fixtures, wrong source/type/window, future and observation times, limited/not-comparable sources, freshly detected forged verdicts, changed plan/comparison/browser/own evidence/history, current source availability, unsafe paths, insertion-time source/history/clock races, concurrent uniqueness/atomic audit, orphan preservation, no additional sequential-duplicate directory, later legitimate action revisions, source preservation/fixed labels, strict input and CLI commands.
- `examples/outcome-evidence.input.json`, `docs/outcome-evidence.md`, README, package metadata, status/backlog/continuation document the scope. `docs/outcome-evidence-api-plan.md` is the repository-only next slice.

Type checking, build, and the full suite passed: 367 tests, zero failures or skips. Log: `outputs/test-results-0.21.0.txt`. The earlier focused 23-check log is `outputs/outcome-evidence-targeted.txt`; the full suite also verifies the later 1000 ms real-plan setup margin. Existing browser/dashboard/source/action/plan/comparison/export/actor, budget, publication, and recovery regressions pass.

`outputs/redteam-0.21.0.tgz` contains 121 files and is installed into an isolated prefix. `work/verify-installed-0.21.0.mjs` verifies compiled CLI/help/template/contract, fresh doctor/no-store, an actual broken capture and finding/action, genuine plan freeze followed by a separate later fixed capture without mocked time, fourteen checked source artifacts, exact job/evidence IDs and requirement lineage, checked comparison/link/two artifacts, fixed unadjudicated labels, unchanged source reports/plan/comparison/action/jobs/actors, minimal catalog, sequential duplicate rejection without a new directory, and historical readability after a real declared action update. Results: `outputs/installed-verification-0.21.0.json`. Capture browsers closed; no service, real credential, live provider, participant research, or human outcome was used.

The dashboard only changes archive-version text. All browser regressions pass; its visually inspected installed 0.19.0 desktop/mobile export baseline remains recorded. A linked comparison verdict does not approve a supplied hypothesis, success rule, sample, planned intervention, independent outcome, human behavior, commercial demand, or causal effect. The original plan remains uncollected and the action is never automatically completed. Local operator/clock/metadata/filesystem and publication/response uncertainty remain explicit. Controlled local fixture source access uses no target grant; saved source availability and checked lineage govern reads.

Next ready milestone: protected minimal catalog, strict creation, and whitelisted checked detail in `docs/outcome-evidence-api-plan.md`, with final synchronous source guards and static denials. No new dashboard, artifact download, report-export kind, arbitrary outcome upload, independent human adjudication, or broad hierarchy is enabled yet. Continue normal verified GitHub pushes.

## Version 0.22 verification

Controlled outcome evidence now has protected local API creation, minimal catalog, and whitelisted checked detail. The existing exact-source/window/immutable-lineage and fixed unadjudicated contract remains unchanged. Session/Host/Origin/no-store and bounded-body rules apply; one active creation receives the work and another receives 409. Unavailable detail uses static 404. An unconfirmed create uses static 400 with inspect-records guidance because a record may already be committed. No automatic retry or state promotion occurs.

Exact files:

- `src/outcome-evidence.ts`: an explicit public projection omits private directories, target/grant data, catalog fingerprints, history pins, and artifact paths. A final synchronous guard binds the checked canonical publication hash and selected source identities to current catalog/job/history/time state. It supplements the full asynchronous source/file reader.
- `src/server.ts`: GET/POST `/api/outcome-evidence`, GET `/api/outcome-evidence/ID`, one active registration, checked projection before response, immediate final source guard, no-store, and static 400/404/409 messages. Unsupported mutation/approval/download/artifact routes remain unavailable.
- `tests/outcome-evidence.test.ts`: eight added API checks (31 total in this file) cover exact public fields and fixed labels, session/Origin/actual forged Host, strict inputs/unknown routes/static errors, legitimate later action revisions, historical/own/source tamper, unavailable/limited sources, source change and publication-catalog change injected after a complete read, uncertain committed creation, and an actual partial HTTP body holding the active-create slot while another receives 409.
- `docs/outcome-evidence.md`, README, package metadata, status/backlog/continuation document API scope and delivered-copy/uncertain-response limits. `docs/outcome-evidence-dashboard-plan.md` is repository-only next work.

Type checking, build, and the full suite passed: 375 tests, zero failures or skips. Log: `outputs/test-results-0.22.0.txt`. Focused 31-check log: `outputs/outcome-evidence-api-targeted.txt`. Existing browser/dashboard/source/action/plan/comparison/export/actor and storage regressions pass.

`outputs/redteam-0.22.0.tgz` contains 121 files and is installed into an isolated prefix. `work/verify-installed-0.22.0.mjs` verifies compiled CLI/template/contract and doctor/no-store, actual broken/fixed captures with a genuinely frozen plan before the candidate and no mocked time, fourteen checked source artifacts, exact finding/requirement lineage, protected API creation and public detail/catalog, two checked link artifacts, omitted private fields/paths, fixed unadjudicated labels, unsupported routes/claims, session/Origin/no-store boundaries, sequential duplicate rejection without another directory, source/action/jobs/actors preservation, historical readability after a real terminal action update, and API/CLI denial under authored source-job unavailability with successful checked retrieval after restoration. Results: `outputs/installed-verification-0.22.0.json`. Capture browsers and temporary service stopped; no real credential, provider request, participant research, or human outcome was used.

The dashboard only changes archive-version text. All browser regressions pass; its visually inspected installed 0.19.0 desktop/mobile export baseline remains recorded separately. The API establishes no independent human outcome, researched psychology, hypothesis/sample/intervention/protocol approval, causal effect, demand, buying/investment/funding outcome, or production isolation. Current sources and local operator/clock/metadata/filesystem boundaries remain explicit; delivered bytes cannot be recalled and final response checks are not atomic with filesystem changes or receipt.

Next ready milestone: `docs/outcome-evidence-dashboard-plan.md` adds explicit web selection, registration, minimal catalog, and checked literal detail under shared managed-view guards. Preserve the existing contract and four report-export kinds. Independent human outcomes, external execution/isolation, real research/pilot/provider inputs, C03 paid demand, and broad hierarchy remain open. Continue normal verified GitHub pushes.

## Version 0.23 verification

Controlled outcome evidence now supports explicit dashboard selection/registration, minimal catalog, and checked literal detail. Open a frozen browser-finding plan, select a saved comparable comparison for its exact baseline, and optionally supply a bounded note. Nothing is selected automatically. The backend retains full requirement/window/lineage/byte checks. Fixed unadjudicated limits remain visible; the original plan/action/source records are unchanged.

Exact files:

- `web/app.js`: seven-endpoint all-or-nothing refresh; current known plan/comparison/completed-job filtering; source-linked form with primitive selected IDs and note preservation; selected/unselected source loss handling; locked pending controls; full plan/selected-comparison refresh; checked public detail with fixed limits, local chronology, source IDs/hashes, artifact metadata, and collapsed literal JSON. Existing shared dialog/abort/reset/generation guards prevent late initial/detail/committed-create restoration. No persistent browser storage, global full-report cache, automatic retry, artifact download, source substitution or state promotion is added.
- `web/index.html`: linked controlled evidence card in Reviews; install text uses 0.23.0. Existing shared styles wrap the form, literal long notes, hashes, and mobile detail.
- `tests/outcome-evidence-dashboard.test.ts`: eight real-browser checks cover a genuinely frozen plan and later actual capture for the positive web path, exact input/unchanged sources/fixed labels, empty and out-of-window creation, refresh draft preservation, desktop/390 px literal long text, selected/unselected source loss, normal idle-poll clearing, own/source tamper, late initial and committed response, locked pending controls, mixed old/current catalogs, failed metadata refresh, no duplicate creation, and absent persistent browser storage. Other negative cases use explicitly authored clock fixtures over copied real captures.
- `docs/outcome-evidence.md`, README, package/status/backlog/continuation describe current-catalog timing and no-adjudication limits. `docs/outcome-evidence-export-plan.md` is repository-only next work.

Type checking, JavaScript syntax check, build, and the full suite passed: 383 tests, zero failures or skips. Log: `outputs/test-results-0.23.0.txt`. Focused eight-browser-check log: `outputs/outcome-evidence-dashboard-targeted.txt`. All existing dashboard, API, source/action/plan/comparison/export/actor, budget, publication and recovery regressions pass.

`outputs/redteam-0.23.0.tgz` contains 121 files and is installed into an isolated prefix. `work/verify-installed-0.23.0.mjs` verifies compiled CLI/API/template/contract/doctor, actual broken/fixed captures around a genuinely frozen plan without mocked time, fourteen checked source artifacts, exact source lineage, web selection/note preservation across metadata refresh, confirmed web registration and two checked link artifacts, literal long supplied text, desktop/390 px layout without horizontal overflow, collapsed public JSON, no artifact download, public API field exclusion, fixed unadjudicated labels, duplicate rejection without another directory, historical readability after real terminal action update, normal idle-poll source-loss closure/catalog clearing, no persistent browser storage or uncaught browser errors, API/CLI denial under authored source-job unavailability, and checked retrieval after restoration. Results: `outputs/installed-verification-0.23.0.json`. Four form/detail desktop/mobile screenshots are under `outputs/preview/outcome-evidence-*-0.23.0.png`; visual inspection is recorded in the release proof. The temporary browser and service stop. No real credential, provider, participant research, or human outcome is used.

This is a controlled software evidence workflow, not independent U06 human outcome tracking, a validated hypothesis/sample/intervention/protocol, researched psychology, causal effect, buying/investment/funding/customer demand, commercial validation or production isolation. Current parent catalog windows, idle poll/request timing, trusted local operator/clock/metadata/filesystem, uncertain writes and delivered copies remain explicit. The four report-export kinds remain unchanged.

Next ready milestone: bounded fifth-kind evidence-link export in `docs/outcome-evidence-export-plan.md`, preserving old export compatibility, exact link/transitive source pins, unadjudicated labels, current availability and existing limits. Do not bypass browser/size budgets through transitive links or enable artifact/participant/actor/research export. Continue normal verified GitHub pushes; external research/pilot/provider, C03 paid demand, independent adjudication, production isolation and broader hierarchy gates remain open.


## Version 0.24 verification

U08 now permits an explicitly selected fifth `outcome_evidence` record under `local-record-export-v2`. The public projection preserves exact link/source IDs and hashes, supplied notes, local chronology, factual comparison and fixed unadjudicated labels. It adds no interpretation or state promotion. Actual saved v1 four-kind exports remain readable and downloadable unchanged.

Changed implementation:

- `src/report-export.ts`: strict fifth-kind selection, complete checked outcome reader/public whitelist, private exact link/source/history pins, metadata-first transitive dependency limits, pinned dependency rechecks around publication/catalog insertion/retrieval, legacy v1 read policy, and canonical publication/public-source binding for final response checks. V2 permits five distinct underlying review IDs and ten references including repeats. These count logical references, not disk IO, bytes, time or cost; existing source/serialized-byte bounds remain.
- `src/outcome-evidence.ts`: synchronous current publication/source/clock check for a private pin already produced by a full checked read.
- `src/server.ts`: final detail/JSON/Markdown checks bind the already checked canonical report and public references to its current catalog before delivery.
- `web/app.js`, `web/index.html`: explicit unadjudicated fifth group, shared exact-parent filtering, dependency counters on selection/submit, checked literal detail/native downloads, and normal idle source-loss clearing. No automatic selection, artifact download, or persistent storage.
- `tests/outcome-evidence.test.ts`: ten added backend/API checks for mixed public bundles, authored v1 format compatibility, distinct/repeated comparison/link dependency caps before source readers, historical update/tamper, link/plan/comparison/browser tamper and source loss, insertion/final-download races, and clock rollback.
- `tests/outcome-evidence-dashboard.test.ts`: extended genuine prospective five-kind path plus two added browser checks for transitive selection refusal and normal-poll export/link clearing. All earlier dashboard tests remain.
- `docs/idea-and-app-scope.md`, master plan v1.3 and backlog v1.3: record the user's idea/app-only scope, next I01 intake, separate analytical lenses and researched behavior, and existing commercial/evaluation gates. No idea review runtime is claimed. README/package/export/outcome/continuation docs state actual capability.

Type checking, JavaScript syntax checking, build and the full suite passed: **395 tests, zero failures or skips**. Log: `outputs/test-results-0.24.0.txt`. Focused backend/API41 and browser21 logs: `outputs/report-export-v2-linked-targeted.txt` and `outputs/report-export-v2-dashboard-targeted.txt`.

`outputs/redteam-0.24.0.tgz` contains 122 files. Final installed prefix: `work/install-release-0.24.0/node_modules/redteam`. `work/verify-installed-0.24.0.mjs` checks compiled CLI/doctor, actual broken/fixed captures around a genuinely frozen plan, fourteen source/two link artifacts, web-selected five-kind v2 export, exact two-distinct/seven-reference counts, draft preservation across all seven metadata responses, long literal supplied text, collapsed JSON/desktop/390 px/no overflow, actual native JSON and Markdown bytes equal checked saved files, exact public projection, later legitimate action update preserving historical exports, and normal idle-poll source-job loss clearing both link and export catalogs/detail. It creates an actual v1 bundle using the prior installed 0.23.0 library, then checks new-reader/API compatibility and exact unchanged JSON/Markdown before and after the action update. Source loss denies both old/new exports; restoration restores reads. No browser storage or uncaught errors, real credentials/provider calls/participant research/human outcomes. Browsers and service stop. Proof: `outputs/installed-verification-0.24.0.json`.

Four new export selection/detail desktop/mobile screenshots are `outputs/preview/report-export-*-0.24.0.png`; visual inspection is recorded in the release proof. Archive whitelist, SHA-512/size, exact installed/source bytes, and high-confidence credential pattern checks use the existing release helper. A normal push and exact private `origin/main` SHA check follow; ignored release/GitHub proofs record the exact source SHA.

The source-reference limits do not constitute a shared all-resource budget. Trusted local metadata/clocks/operator/filesystem, source catalog windows, uncertain writes, non-atomic filesystem/delivery boundaries and copies outside managed recall remain explicit. Independent U06 human adjudication, researched psychology, buyer/investor prediction, customer demand, commercial validation, external app execution/isolation and broad hierarchy are not established.

Next ready work: I01 strict immutable idea/app briefs and deterministic scope preview, then protected API and web intake. Keep all other subject types deferred and preserve the current controlled app evidence workflows.


## Version 0.25 verification

I01 now accepts **ideas and apps through the terminal**. `briefs preview FILE` checks a supplied brief and shows deterministic scope/questions without creating a workspace. `briefs add FILE|list|show BRIEF_ID` stores and checks private immutable intake with stable input/publication hashes, fixed supplied/unverified provenance, explicit unknowns and `reviewStatus: not_started`. App URLs and evidence references are unopened text. Access grants and execution remain separate.

Changed files:

- `src/review-briefs.ts`: exact versioned idea/app discriminated input; bounded fields/lists/UTF-8; descriptor-only validation; distinct subject fields; HTTP/HTTPS app reference without userinfo; explicit unknown/missing-input preview and six unstarted analytical-question tracks; frozen boundary/provenance constants; bounded no-follow explicit input reader; private exclusive JSON publication; immutable summary; minimal catalog and checked canonical contract/preview/source binding. No target/file-reference fetch, grant, tool/model call, finding or stakeholder decision.
- `src/workspace.ts`: insert-only review-brief table; atomic synchronous guard/insert/audit; bounded list and lookup. Existing data is preserved.
- `src/cli.ts`: strict preview/add/list/show commands and help. Preview validates the explicitly named JSON input without a store. Creation returns minimal IDs/hash/status, without private directories or full context.
- `examples/idea-review-brief.input.json`, `examples/app-review-brief.input.json`, `docs/review-briefs.md`: installed templates and exact contract/bounds/effects/limitations. README and idea/app scope/backlog/status/checkpoint record I01 implemented and I02 API/I03 web next. The web changes only archive-version text; web intake is not claimed.
- `tests/review-briefs.test.ts`: 13 tests for idea/app unknowns and no-result semantics; unsupported/mixed/outcome fields; nested getters/serializers/symbols/sparse/extra arrays; field/list/complete UTF-8 bounds; exact input/hash/private modes; unopened actual HTTP/file references; no jobs/actors/grants; own-byte/rehashed false-claim/preview/catalog/policy tamper; symlink/hardlink/oversize/unsafe parent; unsafe output target preservation; atomic duplicate/failed/asynchronous guard rejection; preserved orphan publication; explicit unsafe/invalid input; and real source CLI preview/no-workspace/add/list/show/error behavior.

Type checking, JavaScript syntax check, build and the full suite passed: **408 tests, zero failures or skips**, `outputs/test-results-0.25.0.txt`. Focused log: `outputs/review-briefs-targeted.txt`. All existing app/browser/dashboard/registry/action/plan/comparison/export/outcome/actor/budget/publication/recovery checks pass.

`outputs/redteam-0.25.0.tgz` has 127 files. Final installed prefix: `work/install-release-0.25.0/node_modules/redteam`. `work/verify-installed-0.25.0.mjs` checks compiled idea/app templates, preview without store, exact literal supplied input/hash/not-started provenance/six analytical tracks, and a second app brief added by CLI while the existing single web coordinator owns the workspace. Jobs/actors/grants stay unchanged by intake. It also repeats the genuine controlled broken/fixed captures around a frozen plan, linked evidence, explicit five-kind web export, exact native JSON/Markdown bytes, actual old installed 0.23 v1 compatibility, historical action preservation, normal idle source-loss clearing/restoration and no browser storage/errors. Results: `outputs/installed-verification-0.25.0.json`. Temporary service and browsers stop; no provider request, actual secret, research participant or human outcome. Existing app UI has no new intake controls; its visually inspected 0.24 export baseline remains recorded.

The release helper checks archive whitelist/size/SHA512/every installed source byte/credential patterns. Normal private GitHub push and exact remote/source SHA verification are recorded in ignored release/GitHub proofs. No npm registry publishing.

A saved brief is not idea analysis or an app review. Supplied counts do not measure evidence quality. No country psychology, buyer demand, investment outcome/probability, independent validation, commercial demand or broader hierarchy is established. Local plaintext/operator/clock/metadata/filesystem, uncertain writes/orphans, copies and backups remain explicit. An intentional second add creates a new record, not an automatic retry or mutation of the prior record.

Next ready milestone: I02 protected local idea/app brief creation/catalog/detail API. Preserve fixed provenance/no-execution semantics, exact checked publication binding before responses, minimal catalogs, no private directories, one active creation, bounded input, static denials, no uncertain-write retry, session/Host/Origin/no-store, and existing app workflows. I03 explicit web intake follows. External app execution/isolation, research/pilot/provider inputs, C03 paid demand, independent outcomes, calibration and broad hierarchy remain open.


## Version 0.26 verification

I02 adds protected local creation, minimal catalogs and checked detail for idea/app briefs. It preserves I01 supplied/unverified provenance and `not_started` semantics. There is no web intake control yet.

- `src/server.ts`: GET/POST `/api/review-briefs` and GET `/api/review-briefs/ID`; existing session/Host/Origin/no-store rules; strict UTF-8 request parsing for this route; 64 KiB body bound; one active create including incomplete input; static 400/404/409; minimal creation confirmation/catalogs; full checked detail; final exact catalog/publication checks. No preview/execute/mutation/download/artifact route, target fetch or grant.
- `src/review-briefs.ts`: synchronous final guard for a completely checked report and its initial private catalog snapshot, including every private summary field and canonical publication hash. Delivered copies cannot be recalled; this is not atomic with filesystem changes or receipt.
- `tests/review-briefs-api.test.ts`: eight cases for both subjects and exact provenance/hash/minimal output; session/Origin/forged Host; unsupported/claimed results/body/UTF-8/content type/routes; own-byte/unsafe path tamper and restoration; final detail catalog/hash/directory/title/input-hash races; final creation race; authored post-commit failure preserving one record/bytes without automatic retry; partial-body busy guard; aborted-body release; authored metadata-only 100-row window and static corrupt-catalog denial. No actual behavioral or commercial data is generated.
- `docs/review-briefs.md`, README/scope/backlog/status/checkpoint/version text describe the API, uncertain writes, current plaintext/operator boundaries and next web intake. The shared body parser retains previous route behavior by default; only brief requests opt into strict UTF-8.

Typecheck, JavaScript syntax, build and full suite passed: **416 tests, zero failures/skips**, `outputs/test-results-0.26.0.txt`. Focused combined terminal/API: 21 passed, `outputs/review-briefs-api-targeted.txt`.

`outputs/redteam-0.26.0.tgz` has 127 files. Final prefix: `work/install-release-0.26.0/node_modules/redteam`. `work/verify-installed-0.26.0.mjs` checks compiled terminal idea/app templates/preview/no-workspace/hash/provenance, CLI writes beside one live coordinator, actual API idea/app creation/minimal confirmation/catalog/checked canonical detail, no-store/session/foreign-Origin/unsupported subject, authored saved-byte denial then restoration, and no new jobs/actors/grants. It also repeats the controlled prospective capture/evidence workflow, five-kind web export/exact native JSON/Markdown, actual old installed 0.23 v1 compatibility, historical action preservation, normal idle source-loss clearing/restoration, no browser storage/errors. Proof: `outputs/installed-verification-0.26.0.json`. All services/browsers stop; no actual provider request, credential, research participant or human outcome. Existing UI changes only archive-version text; visually inspected export baseline remains 0.24.

Archive whitelist/size/SHA512/every installed source byte/credential-pattern checks and normal private GitHub push/exact remote SHA are recorded in ignored release/GitHub proofs. No registry publication. A saved brief or its analytical questions are not a completed review, researched psychology, buying demand, investment decision, funding probability or customer validation.

Next ready milestone: I03 explicit idea/app web intake and literal checked detail using this API. Preserve separate subject fields, draft lifecycle, deliberate submission, no automatic retry/execution, visible fixed boundaries, failed-refresh clearing, managed-view generations/aborts and current catalog/hash checks, desktop/mobile and installed verification. I04 bounded evidence-linked analyst review, external execution/isolation, research, real pilot/provider inputs, paid demand and broad hierarchy remain open.


## Version 0.27 verification

I03 makes idea/app intake available through the web as well as terminal and protected API. Reviews → Ideas and apps offers an explicit supplied-input form, an unverified catalog and checked literal detail. Saving intake does not execute a review, app, model, agent, grant or stakeholder decision.

- `web/app.js`: eighth metadata endpoint under existing shared refresh generation/abort; brief catalog and known current public pin; separate idea/app fields and optional audience/evidence/assumption/unknown inputs; subject drafts retained only in the open form; optional blanks become null; required/list/evidence/URL/UTF-8 prechecks; deliberate locked submit; no automatic uncertain retry; managed close/navigation/reset/late reply guards; exact checked JSON SHA-256/client metadata binding; human field labels and literal detail/collapsed JSON; fixed not-started provenance and missing-input/questions preview. Current detail integrity is checked on normal polls. A file-tampered unverified catalog row can remain while full retrieval is denied.
- `web/index.html`, `web/styles.css`: Ideas and apps card, explicit intake action, current install version, long title/text/form wrapping. No new browser storage, external link/target loader or full-report cache.
- `tests/review-briefs-dashboard.test.ts`: nine checks for real idea/literal/unknown/provenance/no-effect intake, app-only fields and draft switching/close clearing/no external requests, pre-submit validation, eight-endpoint draft refresh/pending locks, late initial reply versus a new draft, late committed creation after navigation with one write, normal idle saved-file tamper closure, failed catalog clearing, substituted response hash denial and current selected-pin changes.
- README/contract/scope/backlog/status/checkpoint/package docs record I01–I03 implemented and I04 next. `docs/analytical-review-plan.md` defines packet/output contract → one bounded configured analyst → semantic review/report gates. It enables no model, researched person or broader hierarchy by itself.

Typecheck, JS syntax, build and full suite passed: **425 tests, zero failures/skips**, `outputs/test-results-0.27.0.txt`. Focused nine-browser-case log: `outputs/review-briefs-dashboard-targeted.txt`; it also passes after final human-readable field labels and shorter mobile dialog title. Existing app, API, export, actor/research/budget/publication/recovery regressions pass.

`outputs/redteam-0.27.0.tgz` has 128 files. Final prefix: `work/install-release-0.27.0/node_modules/redteam`. `work/verify-installed-0.27.0.mjs` checks actual compiled CLI/API and two web-submitted idea/app briefs in one workspace, exact supplied long literal text/unknowns/separate subject fields/not-started semantics, draft preservation across all eight metadata responses, draft clearing on close, no links or rendered supplied HTML, collapsed JSON, desktop/390 px without overflow, and no intake job/actor/grant change. It repeats the actual prospective controlled capture/evidence workflow, five-kind native JSON/Markdown exact bytes, old installed 0.23 v1 compatibility, historical action preservation, normal idle source-loss clearing/restoration, no browser storage/errors. Proof: `outputs/installed-verification-0.27.0.json`. Four intake form/detail desktop/mobile screenshots are `outputs/preview/review-brief-*-0.27.0.png`; visual inspection is recorded in release proof. All browsers/service stop; no real credential/provider/participant/human outcome.

Archive whitelist/size/SHA512/every installed source byte/credential-pattern checks and normal private GitHub push/exact SHA are recorded in ignored release/GitHub proofs. No npm registry publication. Supplied coverage counts and matching hashes establish no semantic truth, buyer reaction, psychology, demand, investor commitment, funding probability, human research or commercial validity.

Next ready work: I04a bounded checked-brief analytical packet and strict citation/output contract from `docs/analytical-review-plan.md`. Initial packet contains supplied brief claims and explicit unknowns only. Do not attach unrelated fixture evidence to a claimed app. Add no model/tool/target access or outcome until its separate runtime and evaluation gates pass. Broader hierarchy, live configuration, research/pilot inputs, C03 paid demand, external isolation and independent outcomes remain open.
