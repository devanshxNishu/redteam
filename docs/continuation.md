# redteam: Continuation checkpoint

## Standing instruction

Continue useful development autonomously while account usage is available. Respect natural usage resets. Preserve a checkpoint before each stop.

Recurring continuation is enabled in this chat every 30 minutes. Automation ID: `continue-redteam-development`.

The local computer and app must remain available for local scheduled work. Do not purchase credits or redeem reset credits.

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

## Current milestone: Version 0.9.0

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

## Next sequence

1. Implement U15: show repository snapshots and engineering notes in the existing local review view. Add protected list/detail endpoints with current exact-grant checks and hash verification. Keep copied source text out of the initial dashboard response. Make supplied/unverified, unreviewed, not-executed, not-assessed, and unknown expectation labels visible.
2. Follow the existing actor-report revocation pattern: deny stale links, refresh access state, close and clear an open report on expiry/revocation, and avoid retaining restricted detail in managed caches. Verify the actual installed dashboard at desktop and 390 px, including text escaping, hash failures, and live revocation. Do not conflate listing metadata with a verified report.
3. Semantic engineering review requires captured requirements, a bounded engineering tool policy, separate external-processing permission where relevant, and independent verification before defect approval. Source/requirement/note text cannot authorize tools. Do not execute app scripts or send content to the stakeholder runtime through this path.
4. Preserve sealed actor outputs, invocation identities, uncataloged repository/engineering records, and unowned `.pending` files. No automatic repair, replay, retry, cleanup, or cost release is authorized by inspection.
5. Broad specialist fan-out remains gated by C03 paid concierge demand. Live provider verification needs valid explicit configuration/credentials/current rates and processing permission. External execution needs isolation/access prerequisites. Continue independent work while these inputs are missing.

## Last substantive fixes

- Browser contexts close before browser shutdown; cleanup has a ten-second allowance.
- Actor timeout classification uses the actual deadline exception, not elapsed-clock comparison. Early timer rounding cannot label a deadline as adapter failure.
- Timed-out or failed adapter calls retain an unreceipted-call marker and requested reservation; they are not silently recorded as free.
- The local service stops new requests and waits for an active scripted actor report before closing its stores.
- Dangling symlinks for workspace and research databases are rejected before target creation. Target authorization rejects credentials embedded in URLs.

The temporary preview service is stopped during turn teardown. Reopen it with `npm run ui` when needed. Runtime data remains in `.redteam/` and is excluded from Git and release archives.

Earlier release commits are `13ac283` (scenario constraints), `56d13cc` (durable inference ledger), `f770971` (task-state foundation), `3da6b62` (guarded actor integration and factual recovery), `a999dfb` (normal publication catalog repair), `7f96811` (atomic publication), and `e379e38` (completed-task publication gaps and permission protection). Version 0.7.4 is committed as `cd93137`. Version 0.8.0 is committed as `42d663b`. The 0.9.0 verification is complete. `outputs/release-verification.json` and `outputs/release-verification-0.9.0.json` record its final package and checks. `outputs/test-results-0.9.0.txt` records the full suite. Preview services and test browsers are stopped.

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
