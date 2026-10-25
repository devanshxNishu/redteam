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

## Current milestone

The web, terminal, registry, and actor mechanics are complete within their documented fixture scope. The archive is `outputs/redteam-0.6.0.tgz`. External target execution is not enabled by access grants yet.

Version 0.6.0 adds the durable inference ledger in `src/budget.ts`, the pre-dispatch wrapper in `src/budgeted-inference.ts`, and configured-run integration in `src/actor-execution.ts`. Current budget inspection is in `src/cli.ts`; report typing is in `src/actor-reports.ts`. The contract is `docs/budget-ledger.md`. Tests are `tests/budget.test.ts` and the extended `tests/configured-actor.test.ts`.

Type checking and the full 125-test suite passed with zero failures or skips. The focused ledger/configured suite passed 17 tests. Six competing processes could reserve only the available pool. Unknown spend stayed held after cancellation and restart. A late receipt reconciled a closed run without rewriting its report. No live provider requests were used.

Version 0.6.0 built, packed, and installed in an isolated prefix. `work/verify-installed-0.6.0.mjs` verified compiled help/version/examples, registered synthetic inputs, configured fake transport (four requests), two settled reservations, 360 micro-USD estimated spend, zero held cost, current-budget CLI, both scripted demo decisions, persisted catalog, and all artifact hashes. Results are in `outputs/installed-verification-0.6.0.json`. Real credentials were not loaded.

The default demo adapter is an authored script. An optional OpenAI adapter is implemented and mock-verified. No live model credentials or real human research are configured. Runtime and registry contracts are in `docs/actor-runtime.md` and `docs/research-registry.md`.

The optional adapter, coordinator constraints, and durable inference reservations are packaged. Continue with task-state foundations. The original integration checklist is `docs/inference-adapter-plan.md`. Official token-counting and structured-output documentation was fetched during planning. Cached copies are in `work/openai-token-counting.md` and `work/openai-structured-outputs.md`; verify current API details before changing provider behavior. No API key was loaded and no live model request was made.

Use synthetic fixtures for software verification. Keep them visibly separate from human research. Never promote synthetic fixtures into validated psychology.

## Next sequence

An unreleased task-state prototype is implemented in `src/tasks.ts`. `tests/tasks.test.ts` passed all nine checks; type checking and the compiled build passed. Its transition and integration contract is `docs/task-state.md`. It is not connected to configured actor execution and is not in the existing 0.6.0 archive. The last full released-path suite passed 125 tests before this independent prototype; the new task suite was verified separately. No new live calls or real credentials were used.

The prototype stores immutable task specifications/question keys, bounded attempts, fenced leases, dispatch intents, sealed artifact metadata, and transition events. Four competing processes could claim only once. Expired ownership cannot publish or heartbeat, recovery never requeues, and any dispatch intent blocks the pre-dispatch retry method. Task cancellation does not free budget liability. Sealed metadata is not artifact-byte or semantic verification.

1. Integrate one configured actor task with the durable wrapper using `docs/task-state.md`. Freeze a manifest, protect current ownership before dispatch, preserve the same invocation identity, renew leases, and verify artifacts before accepting outputs. Keep a separate bounded coordinator finalization allowance so actor timeout does not require unsafe lease resurrection.
2. Test ownership expiry during a fake provider call, stale output, cancellation, and restart. Do not automatically replay a possibly dispatched invocation. The ledger protects inference allocation but does not schedule workers or cover browser/tool/infrastructure fees.
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

Release commits from this continuation are `13ac283` (scenario constraints) and `56d13cc` (durable inference ledger). `outputs/release-verification.json` now records the installed 0.6.0 release (71 packaged files). No preview service was started during this continuation.

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
