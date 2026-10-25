# redteam: Implementation status

Current build: 0.15.0, local web and terminal workspace with configured actor ownership, coordinator acceptance, durable inference reservations, atomic JSON publication, factual recovery, terminal diagnostics, bounded local repository snapshots, requirement-linked source notes, and scoped operator action records. The provider path is mock-verified; no live API smoke test is recorded.

This record separates implemented code from the broader product plan. The browser runner reviews one controlled signup journey. Registered actor models can be used through the configured path, but no independent human behavioral validation is recorded.

## Implemented

| Area | Current behavior | Boundary |
|---|---|---|
| Web dashboard | Overview, reviews, source snapshot/note inspection, findings, evidence, access, models, and terminal instructions | Local single-user service; source notes remain unreviewed |
| Installable CLI | Compiled JavaScript package; UI startup, review submission, run list, grants, artifact checks | npm archive; not published to a registry |
| Shared workspace | SQLite jobs, grants, audit events, and one coordinator | `.redteam/` under the current directory |
| Job lifecycle | Queue, primary run, verifier run, reporting, completion, limited coverage, failure, interruption | One active review; up to eight active or queued jobs |
| Startup recovery | Marks unfinished jobs interrupted | Does not replay browser actions automatically |
| Access grants | Exact web origins or canonical directories; capabilities, expiry, and revocation | Local text capture is enabled; external runner and code execution remain unavailable |
| Frozen experiment plans | Exact supplied plan and action revision, hypothesis/intervention/metric/sample/window/owner, immutable artifacts, current source rights, historical action integrity | Terminal/API; unreviewed protocol, local clock only, no execution or collected/independent outcome |
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
| Full automated suite | 295 passed, zero failed or skipped |
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

## Remaining scope

- Authorized external app execution and production worker isolation.
- Semantic source-code review, executed code-test tools, and independent engineering verification; supplied notes currently receive citation checks only.
- Verified human research provenance, consent-document review, and representative sampling.
- Real held-out human evaluation, uncertainty analysis, and independent research review.
- A verified live provider run, empirical actor calibration, analyst leads, subagents, and the roundtable.
- Country adaptation, consumer buying models, and investor decision models.
- Validated purchase, conversion, investment, or population predictions.
- Hosted tenant authentication, durable distributed workers, analyst task leases, and integration of shared parent budgets with a specialist scheduler.
- Web experiment controls, arbitrary release matching, independent outcome tracking, and commercial demand evidence.

No real provider calls occurred in the recorded checks. Scripted runs report zero model spend. Configured runs retain rate-based estimates and unknown-usage markers. Infrastructure cost is not calculated.

## Next milestone

U04 now freezes immutable supplied experiment plans through terminal/API. Add web creation and checked inspection from action detail, preserving declared provenance, exact historical revision/source pins, explicit future windows, unchanged action state, and uncollected outcomes. Apply deliberate revision conflicts, current rights/expiry/integrity refresh, managed-content clearing, safe text, desktop/mobile layout, and late-response ownership. U06 independent outcome collection and adjudication remain separate. Arbitrary releases, semantic review, specialist scheduling, isolation, real research, commercial validation, and live providers remain open.

App review, grounded scenarios, and validated prediction retain separate release gates. Current software tests establish neither behavioral validity nor production readiness.

## Earlier continuation preparation

October 25, 04:14 UTC: product source remains 0.9.1 (`42bbc97`), with its recorded 232 passing tests. `docs/dashboard-code-review-plan.md` now specifies the remaining U15 UI and race/access verification work. This is a documentation-only checkpoint; no new product verification is claimed. Usage was 99% used, with a reported natural reset at 04:33:09 UTC. Scheduled continuation remains active. No credits or reset credits were used.

The natural five-hour usage reset was observed on the 04:44 UTC continuation (0% used). No credits or reset credits were used. Product development resumed within the same chat and checkout.
