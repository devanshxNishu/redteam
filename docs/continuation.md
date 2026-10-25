# redteam: Continuation checkpoint

## Standing instruction

Continue useful development autonomously while account usage is available. Respect natural usage resets. Preserve a checkpoint before each stop.

Recurring continuation is enabled in this chat every 30 minutes. Automation ID: `continue-redteam-development`.

The local computer and app must remain available for local scheduled work. Do not purchase credits or redeem reset credits.

## Standing GitHub instruction

Push each verified milestone to the private repository https://github.com/devanshxNishu/redteam using this checkout's `origin/main`. Preserve remote work and never force-push. Verify the pushed SHA and exclude local evidence, vaults, credentials, sessions, dependencies, caches, and generated files. See `docs/github-sync.md`.

## Project location

`/Users/devansh/Documents/ChatGPT/RedTeam`

Read `docs/master-plan.md`, `docs/development-backlog.md`, and `docs/implementation-status.md` before choosing a milestone.

## Verified baseline

- D1 implements one approved signup journey against healthy and broken local fixtures.
- Version 0.2 adds a verified dashboard, installable CLI, local service, scoped access grants, and encrypted session import.
- Version 0.3 adds an encrypted research registry, immutable model versions, permissions, revocation, scope checks, evaluation locks, cross-evaluation exposure checks, and registered decision validation.
- Version 0.4 adds a bounded actor runtime, scripted consumer and investor demos, shared actor reports, and web inspection with artifact verification.
- Type checking and 83 tests passed after actor runtime and API integration.
- Desktop and all five mobile views passed browser checks. Evidence verification and access creation/revocation worked.
- The packaged CLI installed into an isolated prefix; help, version, and an actual fixed review passed.
- The installed 0.4.0 package served the dashboard. Desktop and mobile flows, actor inspection, evidence checks, and a connected CLI review passed. The fixed review produced seven valid artifacts; the actor demo produced three.
- Both saved demo runs passed artifact checks.
- Browser verification used fresh headless Google Chrome sessions.
- The pinned Chromium installer encountered cache-lock failures. The runner has a tested installed-Chrome fallback on macOS.
- Consumer and investor decision records have consistency guards. No researched actors or behavioral predictions exist yet.

## Version 0.5 verification

- External processing permissions, optional OpenAI adapter, configured terminal runs, usage provenance, and report revocation gates are implemented.
- Type checking and the full 105-test suite passed. Provider tests used only fake transport. No real API key or live request was used.
- `docs/live-inference.md` documents explicit configuration and pricing estimates. `redteam examples` locates packaged templates.
- Version 0.5 packed and installed into the isolated prefix. Version, bundled examples, scripted actor execution, persisted catalog, and missing-key rejection passed. The installed server passed desktop and mobile flows and artifact checks. A browser withdrawal check confirmed that cached report content is cleared and the run is restricted.

## Version 0.5.1 verification

- Coordinator-owned constraint parsing, visibility projection, and acceptance checks are in `src/domain/scenario-constraints.ts` and `src/actor.ts`.
- `src/actor-execution.ts` accepts the new scenario field. `src/actor-demo.ts`, `examples/inference-scenario.synthetic.json`, and the OpenAI instructions use it.
- Positive purchase and investment actions require the appropriate observed, material coordinator states. Actors cannot omit or alter supplied constraints or replace their evidence.
- Hidden states remain unknown until every supporting fact is read. Deferral and conditional investment remain possible when material information is unknown.
- Type checking passed. The full suite passed: 113 tests, zero failures or skips. The focused actor/provider/processing suite passed all 39 tests. Provider verification used fake transport only.
- Package version is 0.5.1. Build, archive, and isolated installed CLI passed. Version, bundled constraint example, both scripted actor actions, persisted catalog, and all three artifact hashes passed. Results are in `outputs/installed-verification-0.5.1.json`. Earlier 0.5.0 web verification remains recorded separately.
- Runtime, inference, and README documentation explain the contract and migration. Scenario declarations still require semantic review; this change authenticates no human research or actual money, authority, diligence, amounts, or terms.

## Version 0.6 verification

The web, terminal, registry, and actor mechanics are complete within their documented fixture scope. The archive is `outputs/redteam-0.6.0.tgz`. External target execution is not enabled by access grants yet.

Version 0.6.0 adds the durable inference ledger in `src/budget.ts`, the pre-dispatch wrapper in `src/budgeted-inference.ts`, and configured-run integration in `src/actor-execution.ts`. Current budget inspection is in `src/cli.ts`; report typing is in `src/actor-reports.ts`. The contract is `docs/budget-ledger.md`. Tests are `tests/budget.test.ts` and the extended `tests/configured-actor.test.ts`.

Type checking and the full 125-test suite passed with zero failures or skips. The focused ledger/configured suite passed 17 tests. Six competing processes could reserve only the available pool. Unknown spend stayed held after cancellation and restart. A late receipt reconciled a closed run without rewriting its report. No live provider requests were used.

Version 0.6.0 built, packed, and installed in an isolated prefix. `work/verify-installed-0.6.0.mjs` verified compiled help/version/examples, registered synthetic inputs, configured fake transport (four requests), two settled reservations, 360 micro-USD estimated spend, zero held cost, current-budget CLI, both scripted demo decisions, persisted catalog, and all artifact hashes. Results are in `outputs/installed-verification-0.6.0.json`. Real credentials were not loaded.

## Version 0.7 verification

Task ownership and factual partial recovery are integrated. Type checking, build, and the full 148-test suite passed with zero failures or skips. `outputs/redteam-0.7.0.tgz` is built and installed. `work/verify-installed-0.7.0.mjs` passed compiled CLI and desktop/mobile browser checks. It verified a four-artifact accepted fake-provider run, a three-artifact interrupted recovery with unsettled usage and no decision, task inspection/recovery, scripted demos, three catalog entries, and source withdrawal restricting both dependent reports. No overflow or browser errors were observed. Results are `outputs/installed-verification-0.7.0.json`; screenshots are under `outputs/preview/`. The temporary service and browser are stopped.

Exact implementation files:

- `src/actor-task.ts`: one-attempt configured actor, fenced ownership, heartbeat, bounded finalization, and conservative expired-task recovery.
- `src/tasks.ts`: guarded task records, sealed-output hashes, dispatch intents, expiry, and no automatic retry. An unpublished seal is interrupted after its deadline while its digest remains intact.
- `src/actor-execution.ts`: private manifest before inference, model/hash pin, same task/budget invocation IDs, verified worker bytes, current-source recheck, and coordinator acceptance. Rejected candidates do not enter accepted decisions.
- `src/budgeted-inference.ts`: ownership checks before reservation/dispatch; only provably undispatched liability can be released. Late receipts still settle after a stopped run.
- `src/actor-recovery.ts`: frozen-manifest and sealed-byte checks, factual partial report, catalog entry, idempotent recovery, no inference calls, and no accepted decision promotion. It repairs a missing catalog entry for its own partial report.
- `src/cli.ts`: task list/show/cancel/recover and SIGINT/SIGTERM cancellation. New configured runs also check earlier expired tasks.
- `src/actor-reports.ts`: catalog model references protect recovered report retrieval after withdrawal, even with an empty actor-result list.
- `web/app.js`: report outcome/task state and unsettled usage are visible in the dialog.
- `tests/configured-actor.test.ts`: sixteen integration checks, including killed-worker recovery, shared identities, lease renewal, cancellation, stale-output rejection, and recovery publication while the cancelled coordinator finishes. An existing verified recovery report is preserved instead of overwritten.
- `tests/actor-recovery.test.ts`: six recovery checks; `tests/tasks.test.ts`: nine task-state checks. All are authored software fixtures.

Contracts are `docs/task-state.md`, `docs/budget-ledger.md`, and `docs/live-inference.md`. The default demo remains a script. No live API key, live model smoke test, real participant research, or behavioral validation is recorded.

## Version 0.7.1 verification

Normal publication catalog repair is implemented in `src/actor-recovery.ts`. It scans completed configured tasks as well as failed, cancelled, and interrupted ones. A saved normal report must match the durable task record and full transition history, frozen manifest, unique bounded artifact identities/paths, budget/task evidence snapshots, and original sealed worker bytes under the completed fence. The pinned model must remain permitted in the recorded scope. An accepted simulation is restored exactly; a rejected publication stays rejected. A missing Markdown presentation does not prevent JSON publication restoration. No report, artifact, task, budget, or provider request is changed by catalog repair. Report-time budget evidence remains valid after a later receipt updates the ledger.

`tests/configured-actor.test.ts` now has 28 checks, including 12 new publication checks. They cover concurrent restoration, unchanged bytes and records, changed decisions/fences/transitions/budgets, omitted and duplicate artifacts, altered sealed bytes, absent JSON publication, withdrawal, and rejected output. Existing cancellation and late-receipt checks also verify restoration. The full suite passed 160 tests with zero failures or skips; type checking and build passed. The log is `outputs/test-results-0.7.1.txt`.

The archive is `outputs/redteam-0.7.1.tgz`. The installed compiled CLI passed `work/verify-installed-0.7.1.mjs`: four fake transport requests, four valid artifacts, the original simulated action, one catalog entry under concurrent recovery, unchanged report/artifact/task/budget records, task and budget commands, source withdrawal denial, and the scripted demo. Results are `outputs/installed-verification-0.7.1.json`. Its isolated workspace is recorded in that file. No live key or provider was used. No server or browser was started. Browser verification remains the recorded 0.7.0 baseline because the only web edit changes the install command's version text.

Package metadata, README, and `web/index.html` use 0.7.1. Contracts and status are updated in `docs/task-state.md`, `docs/live-inference.md`, `docs/development-backlog.md`, and `docs/implementation-status.md`.

Recovery returns `research_restricted` without catalog insertion when current research permission blocks normal restoration. Missing or invalid records return `missing_or_invalid_records`. In particular, a completed task with no JSON publication stays completed and unavailable; no accepted decision is constructed from its seal. Existing files remain untouched. These stores and hashes assume a trusted local coordinator/operator.

## Version 0.7.2 verification

`src/publication.ts` adds private staging writes, file flush/close, an exclusive hard link to the final name, staging cleanup, and directory flush. It preserves `EEXIST` and never replaces or removes a final record. Unsupported link or directory-sync operations return errors. An error after the final link can leave a complete published file; callers must inspect it rather than replace it. `src/evidence.ts` uses this path for `writeRecord` JSON and `addBytes` artifacts. It rejects unsupported JSON serialization before writing and checks canonical parent containment. Browser captures registered from external tools, Markdown presentations, and appended events keep their existing paths.

Exact checks:

- `tests/publication.test.ts`: nine checks. Real filesystem flush/close order and permissions; injected write/file-sync/directory-sync/link failures; six competing processes; real writers killed during staging, after file flush, and after publication.
- `tests/evidence.test.ts`: six checks, including serialization failure, final dangling symlinks, and escaped parent directories.
- `tests/configured-actor.test.ts`: 31 checks. New checks kill actual coordinators before/after the actual JSON write and confirm staging files are excluded. A post-publication crash restores the exact accepted simulation; a pre-publication crash remains unavailable. Task, inference identities, and budget are unchanged by recovery.
- Type checking and build passed. The full suite passed 175 tests, zero failures or skips. The focused publication/evidence/configured/recovery suite passed 52 checks. Log: `outputs/test-results-0.7.2.txt`.

The archive is `outputs/redteam-0.7.2.tgz`. `work/verify-installed-0.7.2.mjs` passed against an isolated installed package. It verified compiled exclusive publication, no staging names after successful writes, fake-transport actor execution (four requests, four artifacts, 360 micro-USD configured estimate), exact catalog restoration, concurrent recovery, withdrawal denial, scripted actors, and task/budget commands. Installed real-browser broken and fixed fixture reviews produced the expected one/zero findings and seven valid artifacts each. Results: `outputs/installed-verification-0.7.2.json`. Browser processes closed; no persistent service was started. No live provider request or real API key was used.

Contract: `docs/evidence-publication.md`, also included in the package. README, package metadata, `web/index.html`, task contract, backlog, and implementation status describe 0.7.2. Earlier dashboard layout verification remains the 0.7.0 baseline; this release only changes the install command's version text in the web assets.

Local macOS supports the tested hard-link and directory-sync operations. Node documents storage-dependent flush behavior. There is no tested power-loss, network-filesystem, Windows, or hostile-operator guarantee. Orphan `.pending` files are left private and are never promoted or automatically removed; another writer might still own them. Legacy truncated final files remain refused without overwrite. A completed task without saved JSON is still unavailable. No broader hierarchy or psychological claim has been enabled.

## Version 0.7.3 verification

Completed-task publication-gap recovery is implemented. During the task's frozen finalization window, `recoverConfiguredActors` returns `unavailable` with `publication_pending` and changes no task or budget. After the deadline, it verifies the pinned manifest/model/scenario/deadline and exact sealed bytes under current research permission. It can then publish `limited_coverage` with an empty actor-result list, recovery reason `publication_missing`, and acceptance `{ status: "unavailable", reason: "publication_missing" }`. The task remains completed. No stakeholder action is reconstructed or published from its seal, and no provider request is replayed.

Exact files:

- `src/actor-recovery.ts`: finalization guard; distinct publication-gap report/catalog label; permission checks before recovery and around publication/catalog insertion; preserved task and seal; closure of an open budget without release of unresolved liability; catalog repair for the new report. Existing closed budget reasons remain unchanged.
- `src/actor-reports.ts`: the distinct recovery reason and independently verified manifest model pin for recovered report access. Empty legacy catalog references cannot bypass withdrawal. `src/actor-execution.ts`: unavailable acceptance type, preservation of the first valid JSON, and retention of the recovery timestamp/model references when a delayed coordinator inserts the catalog after a recovery interruption.
- `src/actor-recovery.ts` also writes Markdown only after winning JSON publication. The losing recovery writer cannot claim the original coordinator's Markdown path first.
- `web/app.js`: the dialog explicitly states that decision publication is unavailable. `web/index.html` updates the install command to 0.7.3.
- `tests/actor-recovery.test.ts`: 15 checks, including nine new completed-task, pending, concurrency, changed-byte, withdrawal, and legacy-catalog cases. `tests/configured-actor.test.ts`: 34 checks, including two new delayed-writer orders and one interrupted-catalog permission/timestamp check. Its real pre-publication killed-coordinator check now verifies pending state followed by factual recovery after the deadline.

Type checking and build passed. The full suite passed 187 tests, zero failures or skips, including 49 configured/recovery checks. Log: `outputs/test-results-0.7.3.txt`.

The archive is `outputs/redteam-0.7.3.tgz`. `work/verify-installed-0.7.3.mjs` passed against an isolated installed package. It injected a stop before original JSON publication in an actual configured fake-provider run, checked `publication_pending`, waited through finalization, and recovered four verified artifacts with no actor result. It confirmed the exact seal, unchanged completed task and closed budget, concurrent catalog repair, and four total fake transport requests with a 360 micro-USD configured-rate estimate. No real API key or live provider call was used.

Installed desktop and 390 px browser checks passed the new dialog, explicit unavailable-decision text, hash verification, no overflow, and zero uncaught errors. A synthetic legacy catalog entry with empty model references exercised the independent manifest permission check. Live source withdrawal closed the open dialog, cleared cached detail, disabled retrieval, and denied report access. The browser and temporary service are stopped. Results are `outputs/installed-verification-0.7.3.json`; screenshots are `outputs/preview/publication-gap-desktop-0.7.3.png` and `outputs/preview/publication-gap-mobile-0.7.3.png`, both visually inspected. The isolated workspace is recorded in the verification JSON. Existing 0.7.2 installed fixture checks and the current full suite cover browser execution.

README, package metadata, status, backlog, `docs/task-state.md`, `docs/evidence-publication.md`, `docs/live-inference.md`, and `docs/budget-ledger.md` describe the current boundary. Catalogs and report APIs remain permission checked. Legacy invalid final files and unowned staging files are preserved. Broader hierarchy, external target tools, real human research, live provider verification, and commercial gates remain open.

## Version 0.7.4 verification

Bounded terminal actor publication diagnostics are implemented. `redteam actors diagnose RUN_ID` inspects the saved report and its recorded artifact hashes. It distinguishes absent/unreadable/unsafe/oversized files, invalid UTF-8 JSON, unsupported report identity/structure, missing/changed artifacts, invalid/duplicate references, and bounded staging inventory. Unparseable final JSON is not assumed to be a crash: its cause remains unknown. Existing bytes remain preserved.

Exact files:

- `src/actor-diagnostics.ts`: direct bounded reads, canonical directory checks, regular-file/no-follow checks, fixed allocations, change detection during reads, static issue codes/actions, artifact indices/counts, staging counts, and a report fingerprint. It prints no note, actor/source/model content, owner/path values, or parser error body. It does not construct any store, evaluate research permission or decision acceptance, execute recovery, open a database, or replay inference.
- `src/cli.ts`: `actors diagnose RUN_ID`, help, and nonzero exit for error-level findings. Exit zero can still contain warnings and is not an app-test verdict.
- `tests/actor-diagnostics.test.ts`: 13 checks. File-tree bytes/names/modes/modification times remain unchanged; a live-store check also preserves expired task state, in-flight liability, database/WAL/shared-memory bytes. Store queries occur outside the file comparison because those queries can update SQLite shared-memory read marks. CLI checks confirm no state creation in an empty workspace and no private fixture text in diagnostic output.
- `docs/report-diagnostics.md`: scope, bounds, issue meanings, error codes, privacy, SQLite rationale, and limitations; included in the package. README, task contract, package metadata, and `web/index.html` use 0.7.4.

Type checking and build passed. The full suite passed 200 tests with zero failures or skips. The focused diagnostic suite passed all 13 checks. Log: `outputs/test-results-0.7.4.txt`.

The archive is `outputs/redteam-0.7.4.tgz`. `work/verify-installed-0.7.4.mjs` passed compiled CLI help/version, an actual scripted demo with three matching artifacts, absent state, invalid JSON/fingerprint, missing and changed artifacts, staging preservation, private-content suppression, and error exit codes. Complete file-tree comparisons around each diagnostic checked content, names, permissions, and modification times. No task or budget database was created. Results are `outputs/installed-verification-0.7.4.json`; its isolated workspace is recorded there. No provider request, real key, browser, or service was used in this terminal verification. Dashboard behavior remains the 0.7.3 verified baseline; the only web change is install-version text.

Bounds: two million bytes per file, twenty artifact references, one hundred report entries, one hundred entries per directory inventory. Normal read access can update filesystem access times. Hash checks rely on the saved metadata, do not authenticate it, and do not assess research permission, acceptance, psychology, or current task/budget state. Staging files are counted without parsing, promoting, or deleting them. The inspection assumes a trusted local operator and is not a hostile-process sandbox. Existing recovery semantics remain unchanged.

Official token-counting and structured-output documentation was fetched during earlier integration. Cached copies are `work/openai-token-counting.md` and `work/openai-structured-outputs.md`. Verify current official API details before changing provider behavior. Do not reuse desktop authentication or invent rates.

Use synthetic fixtures for software verification. Keep them visibly separate from human research. Never promote synthetic fixtures into validated psychology.

## Version 0.8.0 verification

B12 bounded local repository capture is implemented. `redteam code snapshot --grant GRANT_ID --path DIRECTORY`, `code list`, and `code show RUN_ID` share existing workspace grants. The exact canonical directory needs `code:read`. The feature copies local text only. It executes no source file, declared package script, test command, shell, or model request. Every report states limited coverage.

Exact files:

- `src/repository.ts`: fixed `local-text-v1` policy; 50 files, 65,536 bytes per file, 262,144 total source bytes, 500 examined entries, depth six, and a ten-second deadline checked between filesystem operations. It skips hidden/sensitive/generated names, unsupported extensions, invalid UTF-8, NUL text, symbolic links, multiple-hard-link files, and nonregular files. It checks canonical parents, root identity, file identity/size/times, and current permission during capture and before acceptance. Bounded source bytes remain local, owner-only plaintext artifacts. Metadata records paths, hashes, mappings, collection interval, skip counters, and incomplete coverage.
- `src/workspace.ts`: immutable repository catalog entries with the grant, target, run directory, and report hash; an audit event records acceptance. Existing stores gain the new table through normal schema setup.
- `src/cli.ts`: capture/list/show commands. Output contains metadata without copied source text. Inspection requires current exact access and verifies the report and all copied artifacts. Revocation and expiry hide listings and deny inspection.
- `tests/repository.test.ts`: 15 checks. Owned fixtures include an executable source sentinel and declared scripts; neither executes. The checks cover exact capabilities/targets, expired and revoked grants, revocation during traversal and artifact publication, changed grant target, actual root replacement, source preservation, private permissions, exclusions/links, bounds/deadline, changed report/evidence, later source changes, and actual CLI behavior.
- `docs/repository-snapshots.md`: packaged contract, policy, local storage, error behavior, exclusions, access, and interpretation. README, status, backlog, package metadata, and web install text use 0.8.0.

Type checking and build passed. The full suite passed 215 tests, zero failures or skips. The focused repository suite passed all 15 checks. Log: `outputs/test-results-0.8.0.txt`.

`outputs/redteam-0.8.0.tgz` is installed under `work/install-verified-0.8.0`. `work/verify-installed-0.8.0.mjs` verified compiled help/version, a shared grant, two copied text artifacts, exclusions/symlink refusal, hashes, owner-only permissions, unchanged source bytes/names/modes/modification times, metadata-only output, changed-evidence denial, and revocation for listing and inspection. Results are `outputs/installed-verification-0.8.0.json`; its isolated workspace is recorded there. No target code, test, provider request, real credential, browser, or service ran in the installed check. The current full suite retains the real controlled-browser checks. Dashboard JavaScript is unchanged; its verified 0.7.3 browser baseline remains applicable. The web edit changes install-version text only.

A capture is a sequence of file observations, not an atomic Git revision or build. It does not prove a test or defect. Excluded directories have uncounted descendants. The policy does not interpret ignore rules or detect secrets inside allowed source text. Normal reads can change access times. Filesystem operations can exceed the duration target when unresponsive. Checks assume a trusted local operator, not hostile-process or production isolation. Cross-process revocation and writes are not one transaction. Failed/killed captures can leave private uncataloged files, which are preserved and never adopted automatically. Revocation does not erase copied bytes. No capture recovery, cleanup, external processing, or automatic actor access is enabled.

## Version 0.9.0 verification

B13 now records operator-supplied engineering notes and requirements against copied source ranges. This is a citation integrity workflow, not semantic source review, executed testing, or approved findings. The terminal commands are `redteam code observations add FILE`, `list`, and `show RUN_ID`.

Exact files:

- `src/local-files.ts`: extracts the existing bounded no-follow/nonblocking regular-file reader and canonical parent checks from repository capture. Its logic remains shared across snapshots and engineering records.
- `src/repository.ts`: `resolveRepositoryCitations` checks one to fifty exact saved path/file-hash references, unique artifacts, inclusive one-based line bounds, at most 100 lines and 16,384 bytes per range, and current access. Range hashes preserve UTF-8 byte-order marks, multibyte text, actual LF/CRLF bytes, and a final line without a newline. A trailing LF creates no extra citable EOF line. It returns hashes and metadata, not source excerpts. All fifteen prior repository checks still pass.
- `src/engineering.ts`: strict, cloned input with up to twenty requirements, twenty observations, five citations per observation, fifty total citations, 1,000-character statements, and 65,536 compact JSON bytes. Unsupported fields, execution/verdict escalation, duplicate identities, unresolved requirements, stale citations, and out-of-range references fail. Supplied requirement provenance stays unverified. Null requirements stay unknown. Every observation is unreviewed, not executed, and not assessed for defects. Original input bytes and the report are exclusively published as private local records. Snapshot/report/input hashes and current permission protect acceptance and inspection.
- `src/workspace.ts`: immutable engineering catalog, original snapshot report pin, and acceptance audit event. `src/cli.ts`: add/list/show use the same store and access checks. Show intentionally returns supplied text under current permission; it adds no copied source excerpt. No new actor/model tool is enabled.
- `tests/engineering.test.ts`: eleven checks covering exact UTF-8/BOM and newline ranges, strict fields/types/bounds, unsupported claim escalation, copied input isolation, expectation statuses, hash/citation failures, changed original source evidence, changed report/input bytes, symlinks, changed snapshot pin, unsafe output, expiry/revocation, revocation during input publication, and real CLI commands.
- `examples/engineering-observations.input.json`: packaged placeholder template. `docs/engineering-observations.md`: packaged input, range/hash, storage, access, interpretation, and failure contract. README, status, backlog, package versions, and web install text use 0.9.0.

Type checking and build passed. The full suite passed 226 tests with zero failures or skips, including eleven new engineering and fifteen existing repository checks. Log: `outputs/test-results-0.9.0.txt`. The focused engineering suite passed all eleven checks, including expiry and strict citation limits.

`outputs/redteam-0.9.0.tgz` is installed under `work/install-final-0.9.0`. `work/verify-installed-0.9.0.mjs` verified compiled help/version, shared grants/capture, two range citations with exact UTF-8 BOM, CRLF, and final-line hashes, supplied and unknown expectations, fixed result labels, original input preservation, private permissions, no added source excerpts, unsupported approval rejection, changed-snapshot denial, and revocation. Results are `outputs/installed-verification-0.9.0.json`; its isolated workspace is recorded there. No target code, test, provider request, real credential, browser, or service ran in this installed check. The full suite retains controlled browser execution checks. Dashboard JavaScript is unchanged; only install-version text changed, so the 0.7.3 browser baseline remains recorded.

The feature does not authenticate requirement provenance, inspect a note's semantic truth, execute source/tests, approve defects, or feed content to a model. Supplied notes can be wrong despite matching citations. Unknown expectations remain unknown. Local plaintext, file access-time changes, trusted-operator assumptions, non-atomic cross-process access/write boundaries, and preserved uncataloged partial files remain explicit. Revocation denies supported retrieval but does not erase copied bytes or backups. No automatic recovery, retry, adoption, cleanup, or actor access is enabled.

## Version 0.9.1 verification

The API portion of U15 is implemented. Dashboard controls are not yet implemented. This release creates the protected read path needed before UI rendering and cache/permission transitions.

Exact files:

- `src/server.ts`: authenticated GET `/api/code-runs` returns minimal current-authorized catalog summaries without note text or storage directories. Entries are labelled `cataloged_unverified`; listing is not an artifact check. GET `/api/code-runs/repositories/RUN_ID` and `/observations/RUN_ID` use the existing permission-checked, hash-verified readers. Missing, revoked, expired, unsafe, and changed records share a static 404 `code_record_unavailable` body, without filesystem/parser/content details. Existing session, Host, Origin, JSON, and no-store boundaries apply. No source download, capture, or note registration route is added.
- `tests/code-api.test.ts`: six real-service checks for session/Host/Origin, no-store/nosniff JSON, minimal catalog fields, fixed note statuses, no copied source, dependency tampering, static denials, expiry, revocation before missing-file reads, and absent write/download actions. The HTML-like operator note is JSON data; future UI still needs text rendering and browser verification.
- `docs/engineering-observations.md`: packaged API contract and explicit unfinished UI boundary. README, status, backlog, package metadata, and web install text use 0.9.1. Dashboard JavaScript is unchanged.

Type checking, build, and all 232 tests passed with zero failures or skips. The focused six API checks also passed. Log: `outputs/test-results-0.9.1.txt`.

`outputs/redteam-0.9.1.tgz` is installed under `work/install-release-0.9.1`. `work/verify-installed-0.9.1.mjs` verified compiled CLI/server, session and Origin denial, no-store minimal unverified catalogs, source-text exclusion, unknown/unreviewed/not-assessed labels, changed dependent evidence denial with a static body, revocation, and absent write endpoints. Results are `outputs/installed-verification-0.9.1.json`; its owned fixture workspace is recorded there. The temporary service is stopped. No real credential, target-code execution, provider call, or browser was used in this installed check. Existing browser fixtures still pass in the full suite. The dashboard browser baseline remains 0.7.3; these new records have no dashboard controls yet.

These APIs cannot recall data already delivered. Client refresh, cached-detail removal, dialog closure on access changes, text escaping, and desktop/mobile verification remain required before U15 is complete. Local trusted-operator and non-atomic cross-process permission/write limits remain. No source execution, model processing, stakeholder validity, or approved engineering finding is added.

## Usage and UI preparation: October 25, 04:14 UTC

The account check reported ordinary usage allowed with 99% of the five-hour window used. The reported natural reset is October 25, 2026 at 04:33:09 UTC. No credit was purchased or reset credit redeemed. The existing half-hour continuation remains active and can resume after that reset.

`docs/dashboard-code-review-plan.md` records the inspected DOM, API, and refresh integration points, exact rendering labels, request-generation guards, expiry timers, fresh detail integrity checks, fail-closed network handling, and installed browser verification cases. The plan was prepared from the current `web/app.js` and `web/index.html`; no product source was changed. The verified product remains 0.9.1 at commit `42bbc97`, with 232 passing tests and its existing release archive. No tests were rerun for this documentation-only preparation. No service or browser was started. U15 dashboard controls are still unfinished.

## Version 0.10.0 verification

U15 local dashboard inspection is implemented. Reviews now lists repository snapshots and engineering notes, with unverified catalog labels and protected detail retrieval. Supplied requirements, unknown expectations, unreviewed notes, not-executed checks, and not-assessed defects stay explicit. Copied source text and download controls remain absent.

Exact files:

- `web/index.html`: two record cards in the existing Reviews view, empty-state terminal instructions, and updated install version. The five navigation views remain.
- `web/app.js`: fresh workspace/catalog polling, current exact-grant checks, known-expiry timers, detail integrity rechecks, safe text rendering, and code metadata/detail clearing on failure. Detail requests share generation ownership and abort guards across browser, actor, and code reports. Old successful detail/catalog responses cannot restore a newer cleared view. Focus/visibility changes recheck access. Full reports are not saved in persistent storage or a global detail cache. Close clears managed DOM and image URLs.
- `web/styles.css`: wrapping for long paths/hashes, code cards, and responsive headings. `docs/code-dashboard.md` is included in the package and describes polling, timeout, local expiry, cache, and trusted-operator limits. README, API contract, backlog, status, and the earlier dashboard plan reflect the current build.
- `tests/dashboard.test.ts`: one real-browser integration test with assertions for empty/populated records, literal HTML-like notes, no source text, labels, desktop/390 px overflow, snapshot display, changed dependent evidence, network failure, pending and visible external revocation, known expiry, navigation during a pending request, and stale catalog responses. Existing source API/repository tests remain unchanged.

Type checking and build passed. The full suite passed 233 tests, zero failures or skips. The focused browser lifecycle test passed. Log: `outputs/test-results-0.10.0.txt`.

`outputs/redteam-0.10.0.tgz` is installed under `work/install-release-0.10.0`. `work/verify-installed-0.10.0.mjs` verified compiled CLI, actual installed desktop/390 px views, empty/populated catalogs, literal operator text, correct supplied/unknown/unreviewed/not-executed/not-assessed labels, long paths/hashes, no overflow, terminal revocation detected by the normal idle poll, cleared detail DOM, denied restricted links, and empty local/session storage. It also exercised the existing scripted actor report and an actual fixed browser review with a captured screenshot. No uncaught error, real credential, or provider request occurred. The browser and temporary service are stopped. Results are `outputs/installed-verification-0.10.0.json`; its owned fixture workspace is recorded there.

Screenshots `outputs/preview/code-notes-desktop-0.10.0.png`, `code-notes-mobile-0.10.0.png`, and `code-snapshot-mobile-0.10.0.png` were visually inspected. The installed verifier's first run stopped at an ambiguous test locator shared by the hidden activity panel and review table. Scoping that locator to `#reviews-body` corrected the verifier; product source did not change for that issue.

Idle polls wait ten seconds after refresh, with five-second client request timeouts. Known expiry has a local timer. Delivered responses, unmanaged browser history/screenshots, and OS caches cannot be recalled. This is not instant remote revocation, production tenant authentication, worker isolation, semantic code verification, stakeholder research, or approved findings. Partial records and unknown inference liability remain preserved.

## Version 0.11.0 verification

U04 scoped action storage, terminal, and API are implemented. The action dashboard remains unfinished. Records link an owner label, title, next step, validation method, and declared progress to an existing engineering observation or controlled browser finding. Creating/updating a record performs no external task, message, code, test, model call, or budget cancellation.

Exact files:

- `src/domain/actions.ts`: input/origin/record/event types, supported declaration statuses, and typed revision conflicts. `completed_declared` never changes `not_independently_verified` or `not_performed_by_tracking`.
- `src/actions.ts`: strict cloned 16 KiB input, owner/step/method limits, supplied provenance, source report/evidence pins, current source permission/integrity, exact history checks, and updates capped at 100 revisions. Engineering origins inherit the original grant and snapshot chain. Browser origins read bounded controlled-fixture reports/artifacts under exact workspace roots; canonical aliases are normalized and symlink directories rejected. `origin.runId` is the workspace review/job ID for browser findings; computed `origin.evidenceRunId` pins the report's separate evidence UUID. The installed check caught this queued-ID distinction and the regression test now uses distinct IDs.
- `src/workspace.ts`: action/current-state and append-only event tables. Expected revisions, event append, and workspace audit commit together. Current source permission is checked synchronously inside the write transaction; async authorization callbacks are rejected. A read transaction supplies a consistent state/history pair. Listings use a bounded recent-100 window and an unverified catalog label, without re-reading every source artifact.
- `src/cli.ts`: `actions add FILE`, `list`, `show ACTION_ID`, and `update ACTION_ID FILE`. `src/server.ts`: authenticated GET/POST `/api/actions`, GET/PATCH `/api/actions/ACTION_ID`, static unavailable detail, and 409 revision conflicts. No action UI is present yet; the code dashboard remains the 0.10.0 behavior with updated install text.
- `tests/actions.test.ts`: ten checks for strict fields, source pins, fixed declaration labels, note/hash failures, expiry/revocation, synchronous transaction permission, competing terminal processes, history disagreement, no-op updates, an actual broken-fixture finding with distinct job/evidence IDs, and HTTP permission/conflict behavior.
- `docs/actions.md` and placeholder `examples/action.input.json` / `action.update.json` are packaged. README, status, backlog, package metadata, and install text use 0.11.0.

Type checking and build passed. The full suite passed 243 tests, zero failures or skips. All ten focused action checks passed, including the real browser source setup. Log: `outputs/test-results-0.11.0.txt`.

`outputs/redteam-0.11.0.tgz` is installed under `work/install-release-0.11.0`. `work/verify-installed-0.11.0.mjs` verified compiled CLI/API, source-note and actual queued browser-finding plans, seven fixture artifacts, distinct review/evidence IDs, two competing processes with one successful update, exact history, declared completion without verification promotion, stale HTTP 409, current source revocation, dependent title/history denial, and an unrelated permitted fixture action. Tracking started no additional review. Results are `outputs/installed-verification-0.11.0.json`; its owned fixture workspace is recorded there. The service and review browsers are stopped. No real credential or provider request occurred. Current full-suite browser regression passes; installed action UI verification is not claimed.

Owner labels are not external assignment. Plans, progress, and completion remain operator declarations. Source hash checks do not authenticate external provenance or prove fixes/outcomes. Current-source reads and file/database writes are not one filesystem transaction. Local trusted-operator, plaintext/journal/backup, clock, and managed-view limits remain. No automatic recovery, replay, cleanup, or unknown-cost release is enabled.

## Current milestone: Version 0.12.0

U04's scoped action workflow is available in the web, terminal, and API. Structured experiment/outcome records remain separate unfinished work. The dashboard can create a plan from a permitted engineering observation or controlled-browser finding, inspect source/history, and save declared updates. No external assignment or execution is performed.

Exact files:

- `web/app.js`: action catalog, source-linked forms, current-grant filtering, declared detail/history, explicit expected revisions, and preserved drafts on 409 read/write conflicts. A fresh read/discard is deliberate; no write is retried automatically. Forms/views share request ownership, source integrity checks, known expiry, and clearing. Catalog rows are filtered through current workspace grants, so an old code/action response in the same refresh cannot override known revocation. Metadata failure also clears open private actor detail. Browser finding buttons send `job.id`; evidence IDs remain server-owned.
- `web/index.html`: a follow-up action card in Reviews and programmatic detail-heading focus. `web/styles.css`: accessible textarea/focus styles and long title/history wrapping. Forms use text/value APIs; no HTML insertion or persistent draft storage is added.
- `tests/action-dashboard.test.ts`: four real-browser integration checks for creation, fixed declaration labels, 390 px wrapping and HTML-like title safety, external updates without draft overwrite, read/write 409 handling, an already-saved late response after revocation without duplicate/reopened action, mixed same-refresh old catalogs/new revocation, and unsaved-form expiry. `tests/dashboard.test.ts` additionally verifies private actor detail clears on failed metadata refresh. Existing action backend checks remain intact.
- README, `docs/actions.md`, `docs/code-dashboard.md`, status, backlog, package versions, and install text use 0.12.0.

Type checking and build passed. The full suite passed 247 tests, zero failures or skips. The focused four action UI tests and shared dashboard lifecycle test passed. Log: `outputs/test-results-0.12.0.txt`.

`outputs/redteam-0.12.0.tgz` is installed under `work/install-release-0.12.0`. `work/verify-installed-0.12.0.mjs` verified actual source-linked UI creation, declared completion without verification promotion, desktop/390 px views, long title/hash wrapping, a real CLI revision conflict that preserves the draft, deliberate latest-record read, normal-poll terminal revocation, managed DOM clearing, denied dependent links, no persistent storage, existing actor detail, and plan creation from an actual reproduced browser finding with distinct job/evidence IDs. Tracking started no new review. No uncaught error, real credential, or provider request occurred. Browser and service are stopped. Results are `outputs/installed-verification-0.12.0.json`; the owned fixture workspace is recorded there.

Screenshots `outputs/preview/action-create-desktop-0.12.0.png`, `action-detail-desktop-0.12.0.png`, `action-detail-mobile-0.12.0.png`, and `action-conflict-mobile-0.12.0.png` were visually inspected. The initial installed verifier needed to wait for asynchronous finding detail before asserting its text; only the verifier changed for that timing issue.

Actions remain operator declarations. A lost/aborted response can follow a committed local write; the UI neither undoes it nor retries automatically. Current-source checks, local clock/poll/timeout limits, delivered-data limits, private plaintext/history/backups, and trusted-operator assumptions remain. No structured experiment, independent outcome, causal improvement, researched stakeholder behavior, commercial validation, broad hierarchy, or production isolation is claimed.

## Next sequence

1. Prototype U05 bounded release comparison for existing controlled-fixture reports. Pin the baseline and comparison review/job IDs separately from their evidence run IDs. Verify both reports/artifacts, requirement identity/hash, study/scope compatibility, build identity, and completed execution coverage before describing a tested mismatch as absent in the comparison.
2. Treat missing/incomplete evidence, changed requirements, incompatible studies, missing execution results, or unverified outcomes as unavailable/not comparable. Do not infer a fix from an empty finding list. Keep release comparison separate from declared action progress; do not upgrade action verification automatically.
3. Preserve parent access, immutable source pins, evidence IDs, and current integrity in any saved comparison. Execute no app code or model by comparing saved evidence. Use owned broken/fixed fixture runs first and verify terminal/API before adding UI controls.
4. Structured experiment/outcome records remain unfinished. Real human research, commercial C03, external isolation, and live provider inputs remain missing; do not fabricate or silently pass them. Continue independent technical work.
5. Preserve sealed actor outputs, invocation identities, unknown-cost reservations, and uncataloged/staging bytes. Action status and comparison inspection cannot trigger automatic adoption, replay, repair, cleanup, external messages, or budget release.

## Last substantive fixes

- Browser contexts close before browser shutdown; cleanup has a ten-second allowance.
- Actor timeout classification uses the actual deadline exception, not elapsed-clock comparison. Early timer rounding cannot label a deadline as adapter failure.
- Timed-out or failed adapter calls retain an unreceipted-call marker and requested reservation; they are not silently recorded as free.
- The local service stops new requests and waits for an active scripted actor report before closing its stores.
- Dangling symlinks for workspace and research databases are rejected before target creation. Target authorization rejects credentials embedded in URLs.

The temporary preview service is stopped during turn teardown. Reopen it with `npm run ui` when needed. Runtime data remains in `.redteam/` and is excluded from Git and release archives.

Earlier release commits are `13ac283` (scenario constraints), `56d13cc` (durable inference ledger), `f770971` (task-state foundation), `3da6b62` (guarded actor integration and factual recovery), `a999dfb` (normal publication catalog repair), `7f96811` (atomic publication), and `e379e38` (completed-task publication gaps and permission protection). Version 0.7.4 is committed as `cd93137`. Version 0.8.0 is committed as `42d663b`. Version 0.9.0 is committed as `71e2bf4`. Version 0.9.1 is committed as `42bbc97`; documentation preparation is `733838c`. Version 0.10.0 is committed as `313b1c1`. Version 0.11.0 is committed as `834c1f6`. The 0.12.0 verification is complete. `outputs/release-verification.json` and `outputs/release-verification-0.12.0.json` record its final package and checks. `outputs/test-results-0.12.0.txt` records the full suite. Preview services and test browsers are stopped.

## External inputs still required

- A real pilot app, market, and decision scope.
- Consented stakeholder observations and a human research protocol.
- Defined model credentials or a configured local inference backend for live LLM actors.
- Commercial evidence for the broader hierarchy investment gate.

Continue independent implementation while these inputs are missing. Do not claim that research, commercial, or predictive gates have passed.

## Verification procedure

Run `npm run typecheck` and tests appropriate to each change. The complete suite runs with `npm test`.

Use `npm run demo`, `npm run demo:fixed`, and `npm run verify -- RUN_DIRECTORY` when browser behavior changes.

Update this checkpoint with exact results, remaining work, and blockers. Avoid repeated work without new evidence.

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
