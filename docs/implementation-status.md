# redteam: Implementation status

Current build: 0.7.0, local web and terminal workspace with configured actor ownership, coordinator acceptance, durable inference reservations, and partial crash reports. The provider path is mock-verified; no live API smoke test is recorded.

This record separates implemented code from the broader product plan. The browser runner reviews one controlled signup journey. Registered actor models can be used through the configured path, but no independent human behavioral validation is recorded.

## Implemented

| Area | Current behavior | Boundary |
|---|---|---|
| Web dashboard | Overview, live jobs, review history, findings, evidence, access, and terminal instructions | Local single-user service |
| Installable CLI | Compiled JavaScript package; UI startup, review submission, run list, grants, artifact checks | npm archive; not published to a registry |
| Shared workspace | SQLite jobs, grants, audit events, and one coordinator | `.redteam/` under the current directory |
| Job lifecycle | Queue, primary run, verifier run, reporting, completion, limited coverage, failure, interruption | One active review; up to eight active or queued jobs |
| Startup recovery | Marks unfinished jobs interrupted | Does not replay browser actions automatically |
| Access grants | Exact web origins or canonical directories; capabilities, expiry, and revocation | External runner and code tools are not enabled |
| Browser sessions | CLI import; encrypted local storage; metadata-only API responses | Local key beside the database; no OS keychain integration |
| Local API | Bearer session, Host and Origin checks, CSP, no cross-origin API access | Not remote tenant authentication |
| Study contract | Approved signup steps and valid input preconditions | Local fixtures only; one final text assertion |
| Expected result | Captured requirement identifier and source | Documented fixture oracle |
| Browser evidence | Actual screenshots, traces, events, execution records, hashes | Missing evidence restricts coverage |
| Reproduction | Fresh browser and fixture dataset per execution | Repeated procedure; not independent human assessment |
| Findings | Expected and actual result, verification, next action, business hypothesis | No measured adoption impact |
| Reports | JSON, Markdown, and dashboard detail | No complete startup assessment engine |
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
| Interrupted reports | Expired tasks and uncertain spend stay recorded; verified frozen/sealed evidence produces a partial report with no accepted decision | No inference replay; repair of a completed normal report missing its catalog entry remains open |
| Consumer and investor demo | Scripted rejection and conditional investment, with reasons, conditions, gaps, and evidence | Authored software fixtures; not behavioral predictions |
| Shared actor reports | Scripted and configured run catalog, report detail, permission checks, and artifact verification | Not durable live-agent task orchestration |

Revocation removes the active encrypted session and denies subsequent retrieval. It does not invalidate credentials at their provider or securely erase backups and old database pages.

The runner has deadlines for setup, actions, evidence capture, and cleanup. Browser contexts close explicitly before browser shutdown. The default cleanup allowance is ten seconds. Cleanup failures remain visible and prevent complete coverage.

## Recorded verification

Environment: Node v24.16.0, npm 11.13.0, installed Google Chrome 155.0.8059.86.

| Check | Result |
|---|---|
| Type checking | Passed |
| Full automated suite | 148 passed, zero failed or skipped |
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
| Packaged installation | Installed 0.7.0 version/help/examples, configured fake provider, task and budget CLI, partial recovery, scripted demo, catalog, and artifact verification passed |
| Packaged web service | Installed 0.7.0 completed/recovered dialogs passed desktop and 390 px checks, artifact verification, and withdrawal restrictions; broader five-view flows remain verified on 0.5.0 |
| Actor runtime checks | Eighteen tests passed, including coordinator constraint omission, state escalation, evidence substitution, hidden states, unknown barriers, and positive-action requirements |
| Actor demo evidence | Consumer and investor reports saved; three artifacts passed hash checks |
| Shared actor API | Saved both scripted decisions, served the report, and detected artifact changes |
| Actor dashboard | Scripted run, report inspection, artifact verification, and mobile layout passed browser checks |
| Provider verification | Eleven fake-transport checks passed; no real API requests |
| Processing permissions | Five checks passed, including legacy defaults and zero dispatch on denial |
| Configured execution | Sixteen checks passed, including manifests, shared identities, cancellation, concurrent recovery publication, heartbeat renewal, expired output, a killed worker, budgets, redaction, and missing credentials |
| Durable ledger | Nine checks passed, including six competing processes, protected pools, immutable identities, restart, closure, settlement, overruns, permissions, and symlinks |
| Task ownership | Nine checks passed, including competing claims, stale fences, bounded renewal, sealed output, safe pre-dispatch retry, restart, and private state files |
| Partial report recovery | Six checks passed for factual reports, catalog repair, idempotency, unpublished sealed candidates, changed/symlink evidence, active-task preservation, and research withdrawal |
| Report withdrawal | API checks passed; a browser check confirmed the open report closes and cached detail is cleared |
| Local file boundaries | Dangling database symlinks denied before target creation; credential-bearing target URLs rejected |
| Pinned Chromium download | Earlier cache-lock failure; installed Chrome fallback verified |

An initial test pass attempt exposed browser shutdown deadlines under load. The implementation now closes contexts explicitly and uses the documented bounded cleanup allowance. The full suite passed after that correction. An installed-build review from before that correction correctly reported limited coverage; it did not report an app defect.

The current installable archive is `outputs/redteam-0.7.0.tgz`. Installed verification recorded four fake provider requests, an accepted completed task with four valid artifacts, a recovered interrupted run with three valid artifacts and no accepted decision, task CLI inspection, scripted demos, and three catalog entries. Completed and recovered report dialogs passed desktop/mobile checks with no overflow or browser errors. Withdrawing the source restricted both affected reports. Screenshots are under `outputs/preview/`; results are in `outputs/installed-verification-0.7.0.json`. The temporary service and browser are stopped. No live provider calls occurred. Generated data is excluded from Git.

Earlier D1 reports remain under `outputs/runs/`. The dashboard imports recognized reports from that directory. New service runs use `.redteam/runs/`.

## Remaining scope

- Authorized external app execution and production worker isolation.
- Source-code review and scoped code-test tools.
- Verified human research provenance, consent-document review, and representative sampling.
- Real held-out human evaluation, uncertainty analysis, and independent research review.
- A verified live provider run, empirical actor calibration, analyst leads, subagents, and the roundtable.
- Country adaptation, consumer buying models, and investor decision models.
- Validated purchase, conversion, investment, or population predictions.
- Hosted tenant authentication, durable distributed workers, analyst task leases, and integration of shared parent budgets with a specialist scheduler.
- Release comparison, real-world outcome tracking, and commercial demand evidence.

No real provider calls occurred in the recorded checks. Scripted runs report zero model spend. Configured runs retain rate-based estimates and unknown-usage markers. Infrastructure cost is not calculated.

## Next milestone

Configured task ownership and partial crash reports are implemented and verified through the installed package and browser. Next, repair catalog publication after a crash involving an already completed normal report, while preserving its exact accepted artifact and permission boundaries. Shared specialist scheduling, browser/tool/infrastructure budgets, and production isolation remain open. Broader hierarchy still depends on commercial evidence. Live provider and human evaluation require their actual external inputs.

App review, grounded scenarios, and validated prediction retain separate release gates. Current software tests establish neither behavioral validity nor production readiness.
