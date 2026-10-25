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

## Current milestone: Version 0.7

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

Official token-counting and structured-output documentation was fetched during earlier integration. Cached copies are `work/openai-token-counting.md` and `work/openai-structured-outputs.md`. Verify current official API details before changing provider behavior. Do not reuse desktop authentication or invent rates.

Use synthetic fixtures for software verification. Keep them visibly separate from human research. Never promote synthetic fixtures into validated psychology.

## Next sequence

1. Repair catalog publication for an already completed normal report if the process ended between report writing and catalog insertion. Import only the exact recorded accepted worker artifact under its completed fence and current research permissions. Never promote an unfinished sealed candidate. This case is not handled by partial recovery yet.
2. Extend recovery checks to concurrent publication and remaining interruption points. Keep uncertain invocation identities and original sealed outputs unchanged. Do not broaden to specialist dispatch before its prerequisites.
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

Earlier release commits are `13ac283` (scenario constraints), `56d13cc` (durable inference ledger), and `f770971` (task-state foundation). The 0.7 installed verification is complete. `outputs/release-verification.json` and `outputs/release-verification-0.7.0.json` record its final package and checks. `outputs/test-results-0.7.0.txt` records the full suite. Preview services and test browsers are stopped.

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
