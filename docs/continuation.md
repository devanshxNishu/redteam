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

## Current milestone

The web, terminal, registry, and actor mechanics are complete within their documented fixture scope. The archive is `outputs/redteam-0.4.0.tgz`. External target execution is not enabled by access grants yet.

The packaged adapter is an authored software script. No live model credentials or real human research are configured. Runtime and registry contracts are in `docs/actor-runtime.md` and `docs/research-registry.md`.

Next, implement the live adapter prerequisites in `docs/inference-adapter-plan.md`. Official token-counting and structured-output documentation was fetched during planning. Cached copies are in `work/openai-token-counting.md` and `work/openai-structured-outputs.md`; verify current API details before implementing. No API key was loaded and no live model request was made.

Use synthetic fixtures for software verification. Keep them visibly separate from human research. Never promote synthetic fixtures into validated psychology.

## Next sequence

1. Add separate external-model processing permission for sources, derived model content, and scenario facts. Default existing records to local-only.
2. Implement a configured inference adapter with exact token preflight, output limits, structured action parsing, refusal handling, and receipt reconciliation. Test with fake transport first.
3. Add an explicit terminal command for configured live runs. Do not select a paid model or infer valid credentials without evidence.
4. Add durable task coordination and evidence-based roundtable mechanics when their prerequisites are met.
5. Continue authorized external runner work after its isolation and access prerequisites are met.

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
