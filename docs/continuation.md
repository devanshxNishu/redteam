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

The web, terminal, registry, and actor mechanics are complete within their documented fixture scope. The archive is `outputs/redteam-0.5.1.tgz`. External target execution is not enabled by access grants yet.

The default demo adapter is an authored script. An optional OpenAI adapter is implemented and mock-verified. No live model credentials or real human research are configured. Runtime and registry contracts are in `docs/actor-runtime.md` and `docs/research-registry.md`.

The optional adapter and coordinator constraints are implemented and packaged. Continue with durable budget and task-state foundations. The original integration checklist is `docs/inference-adapter-plan.md`. Official token-counting and structured-output documentation was fetched during planning. Cached copies are in `work/openai-token-counting.md` and `work/openai-structured-outputs.md`; verify current API details before changing provider behavior. No API key was loaded and no live model request was made.

Use synthetic fixtures for software verification. Keep them visibly separate from human research. Never promote synthetic fixtures into validated psychology.

## Next sequence

1. Add durable atomic budget reservations and task-state foundations. Existing per-actor limits and single coordinator ownership are not distributed budget protection or durable analyst leases.
2. Verify competing reservations, idempotent settlement, uncertain calls, restart recovery, and cancellation without automatic release of unknown spend.
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
