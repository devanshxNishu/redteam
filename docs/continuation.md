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

## Current milestone: Version 0.7.2

`src/publication.ts` adds private staging writes, file flush/close, an exclusive hard link to the final name, staging cleanup, and directory flush. It preserves `EEXIST` and never replaces or removes a final record. Unsupported link or directory-sync operations return errors. An error after the final link can leave a complete published file; callers must inspect it rather than replace it. `src/evidence.ts` uses this path for `writeRecord` JSON and `addBytes` artifacts. It rejects unsupported JSON serialization before writing and checks canonical parent containment. Browser captures registered from external tools, Markdown presentations, and appended events keep their existing paths.

Exact checks:

- `tests/publication.test.ts`: nine checks. Real filesystem flush/close order and permissions; injected write/file-sync/directory-sync/link failures; six competing processes; real writers killed during staging, after file flush, and after publication.
- `tests/evidence.test.ts`: six checks, including serialization failure, final dangling symlinks, and escaped parent directories.
- `tests/configured-actor.test.ts`: 31 checks. New checks kill actual coordinators before/after the actual JSON write and confirm staging files are excluded. A post-publication crash restores the exact accepted simulation; a pre-publication crash remains unavailable. Task, inference identities, and budget are unchanged by recovery.
- Type checking and build passed. The full suite passed 175 tests, zero failures or skips. The focused publication/evidence/configured/recovery suite passed 52 checks. Log: `outputs/test-results-0.7.2.txt`.

The archive is `outputs/redteam-0.7.2.tgz`. `work/verify-installed-0.7.2.mjs` passed against an isolated installed package. It verified compiled exclusive publication, no staging names after successful writes, fake-transport actor execution (four requests, four artifacts, 360 micro-USD configured estimate), exact catalog restoration, concurrent recovery, withdrawal denial, scripted actors, and task/budget commands. Installed real-browser broken and fixed fixture reviews produced the expected one/zero findings and seven valid artifacts each. Results: `outputs/installed-verification-0.7.2.json`. Browser processes closed; no persistent service was started. No live provider request or real API key was used.

Contract: `docs/evidence-publication.md`, also included in the package. README, package metadata, `web/index.html`, task contract, backlog, and implementation status describe 0.7.2. Earlier dashboard layout verification remains the 0.7.0 baseline; this release only changes the install command's version text in the web assets.

Local macOS supports the tested hard-link and directory-sync operations. Node documents storage-dependent flush behavior. There is no tested power-loss, network-filesystem, Windows, or hostile-operator guarantee. Orphan `.pending` files are left private and are never promoted or automatically removed; another writer might still own them. Legacy truncated final files remain refused without overwrite. A completed task without saved JSON is still unavailable. No broader hierarchy or psychological claim has been enabled.

Official token-counting and structured-output documentation was fetched during earlier integration. Cached copies are `work/openai-token-counting.md` and `work/openai-structured-outputs.md`. Verify current official API details before changing provider behavior. Do not reuse desktop authentication or invent rates.

Use synthetic fixtures for software verification. Keep them visibly separate from human research. Never promote synthetic fixtures into validated psychology.

## Next sequence

1. Cover task completion before JSON publication with a factual partial report that states publication uncertainty. Current behavior is conservative `unavailable`. Preserve the completed task and original sealed bytes, but do not infer a published accepted decision or replay inference. Keep a distinct recovery reason and test current research restrictions and races with a delayed coordinator before changing the boundary.
2. Cover remaining interruption points and inspect legacy incomplete final records without overwriting them. Keep uncertain invocation identities unchanged. Do not automatically delete `.pending` files or broaden specialist dispatch before its prerequisites.
3. Add bounded analyst task coordination when prerequisites permit. The commercial hierarchy gate remains unproven; do not enable broad specialist fan-out or claim the roundtable is complete.
4. A live API smoke test needs explicit model configuration, valid credentials, current rates, and processing permission. Do not reuse desktop authentication or invent pricing. Continue independent work if these inputs are missing.
5. Continue external runner work after isolation and access prerequisites are met.

## Last substantive fixes

- Browser contexts close before browser shutdown; cleanup has a ten-second allowance.
- Actor timeout classification uses the actual deadline exception, not elapsed-clock comparison. Early timer rounding cannot label a deadline as adapter failure.
- Timed-out or failed adapter calls retain an unreceipted-call marker and requested reservation; they are not silently recorded as free.
- The local service stops new requests and waits for an active scripted actor report before closing its stores.
- Dangling symlinks for workspace and research databases are rejected before target creation. Target authorization rejects credentials embedded in URLs.

The temporary preview service is stopped during turn teardown. Reopen it with `npm run ui` when needed. Runtime data remains in `.redteam/` and is excluded from Git and release archives.

Earlier release commits are `13ac283` (scenario constraints), `56d13cc` (durable inference ledger), `f770971` (task-state foundation), `3da6b62` (guarded actor integration and factual recovery), and `a999dfb` (normal publication catalog repair). The 0.7.2 verification is complete. `outputs/release-verification.json` and `outputs/release-verification-0.7.2.json` record its final package and checks. `outputs/test-results-0.7.2.txt` records the full suite. Preview services and test browsers are stopped.

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
