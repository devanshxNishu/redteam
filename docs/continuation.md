# Redteam continuation checkpoint

Latest verified product: **0.25.0**. Read `docs/implementation-status.md`, `docs/development-backlog.md`, `docs/master-plan.md`, `docs/idea-and-app-scope.md`, and `docs/review-briefs.md` for scope/history. Earlier verification remains in status, Git history and ignored local proofs.

## Standing instructions

Continue useful development autonomously while ordinary account usage is available. Respect natural usage resets; never buy credits or redeem reset credits. Do not stop simply because one narrow milestone is done. Preserve this checkpoint before stopping.

Work in `/Users/devansh/Documents/ChatGPT/RedTeam`, the existing chat and checkout. Recurring continuation ID: `continue-redteam-development`, active every 30 minutes. The local app/computer must remain available. Keep notifications to verified milestones, completion, failure, or required user action. Disable continuation only when the agreed scope is complete or the user asks to stop.

User authorized regular pushes to private `https://github.com/devanshxNishu/redteam`. Use `origin/main`, never force-push, preserve remote work, and verify the remote SHA after each verified milestone. See `docs/github-sync.md`. Exact release/source/remote SHAs are recorded in `outputs/release-verification-0.25.0.json` and `outputs/github-sync-verification.json` after the push. Keep dependencies, evidence, workspaces, vaults, sessions, credentials, caches, archives, and generated outputs out of Git.

The product is installable through the terminal and has a local web dashboard. Its eventual stakeholder/consumer/investor specialists and subagents require research, evaluation, operating, and commercial gates. Do not fabricate participants, psychology validity, population behavior, demand, purchases, investments, funding probabilities, or commercial validation. Broad hierarchy remains gated by C03 paid concierge demand. Do not spawn coding subagents unless current human or applicable repository/skill instructions explicitly authorize delegation.

The latest user scope is **ideas and apps only**. Earlier universal/CV/service expansion was superseded. No such implementation was made. Terminal idea/app intake and deterministic scope preview are implemented; protected API then web intake are the next milestones; neither intake nor a preview is a completed review. Preserve the app evidence path and the distinction between analytical objections, supplied claims, observed behavior, and researched predictions.

## Current verified milestone

Version 0.25.0 implements I01 terminal intake for **ideas and apps only**. The user explicitly confirmed terminal entry for both. `briefs preview FILE` does not create a workspace; add/list/show save/check a strict immutable supplied brief, stable hashes, explicit unknowns, unverified provenance and deterministic six-track analytical questions. It is not a completed review. App URL and evidence references are not opened; grants, target execution, research and model calls remain separate.

Exact changed files:

- `src/review-briefs.ts`: strict bounded idea/app input and explicit file reader; deterministic missing-input/questions preview; frozen fixed provenance/boundaries; private exclusive JSON; immutable summary; minimal metadata; checked canonical contract/hash/preview/catalog.
- `src/workspace.ts`: review-brief table with atomic synchronous guard/insert/audit, lookup and bounded catalog. `src/cli.ts`: strict preview/add/list/show/help.
- `tests/review-briefs.test.ts`: 13 cases for unknowns/no-result semantics, unsupported/mixed/claimed outcomes, nested descriptors/arrays, UTF-8 and field bounds, hashes/private modes, actual unopened HTTP/file references, no jobs/actors/grants, saved/rehashed/contract/catalog/unsafe file tamper, unsafe output preservation, duplicate/failed/async catalog rollback, preserved orphans and actual CLI preview/no-store/add/list/show/errors.
- `examples/{idea,app}-review-brief.input.json`, `docs/review-briefs.md`, README/package/scope/backlog/status/checkpoint. Web archive-version text only; protected brief API and web intake are not implemented yet.

The 0.24 v2 fifth-kind outcome-evidence export remains implemented. It counts at most five distinct underlying reviews and ten logical references including repeats; these are not disk IO or total resource budgets. Private exact lineage/source/history pins and full checked readers govern access. Actual old v1 four-kind exports remain unchanged/readable. Existing sources/plans/actions are never promoted.

## Verification and release files

- Node 24.16.0, npm 11.13.0, Playwright 1.64.1, real macOS Chrome 155.0.8059.86. Other platform layouts are authored fixtures.
- Typecheck/JS syntax/build passed; full suite **408 passed, zero failed/skipped**, `outputs/test-results-0.25.0.txt`; focused 13 cases `outputs/review-briefs-targeted.txt`.
- Archive `outputs/redteam-0.25.0.tgz`, **127 files**; manifest `outputs/package-manifest-0.25.0.json`. Final prefix `work/install-release-0.25.0/node_modules/redteam`.
- Installed `work/verify-installed-0.25.0.mjs`, proof `outputs/installed-verification-0.25.0.json`: compiled idea/app templates, preview no workspace, exact literal input/hash/provenance/six unstarted tracks, CLI app brief alongside one live coordinator, no intake job/actor/grant changes. Also genuine freeze-before-later controlled capture, 14 source/2 link artifacts, five-kind UI export with 2 distinct/7 references, native JSON/Markdown exact bytes, actual prior installed 0.23 v1 export compatibility, later action update, idle source-job loss clearing/restoration, no storage or uncaught errors. All services/browsers stop. No real provider/credential/research/human outcome.
- No new UI intake control. Visually inspected export desktop/mobile baseline remains 0.24 (`outputs/preview/report-export-*-0.24.0.png`); all current browser regressions pass.
- `work/verify-release-files.mjs VERSION FILECOUNT TESTCOUNT`: archive whitelist/size/SHA512/all installed-source bytes/high-confidence credential patterns. `work/verify-github-sync.mjs VERSION`: private exact remote/source SHA. Ignored version/latest release and GitHub proofs record exact source SHA after push. No npm registry publication.

## Next ready work

Implement I02: protected local idea/app brief API creation/minimal catalog/checked detail, then I03 explicit web intake. Keep input/provenance/no-execution semantics, 64 KiB request bound, exact canonical publication/current catalog binding before delivery, no private directories, one active creation, static denials, session/Host/Origin/no-store and no automatic uncertain-write retry. No URL/file-reference loading, access grant, tool/model execution or stakeholder result. Preserve existing controlled app records and workflows. I04 bounded evidence-linked analyst review follows these, with its own useful-output and pilot gates.

Independent U06 human outcomes remain unfinished. Missing real partner/app/journeys/market/test accounts, research/protocol/consent/held-out outcomes, live provider configuration/verification, and C03 paid demand are external inputs. Continue independent work. External execution/worker isolation, semantic engineering verification, empirically supported country/buying/investment models, shared resource budgets/scheduler and broad hierarchy remain open.

## Important implementation constraints

- Only the controlled local five-step signup fixture executes. Source snapshots/notes do not run target code/tests/models. Optional actor/provider mechanics remain scripted/fake-transport verified. Actor tools cannot acquire shell/browser/payment/delegation privileges.
- `WorkspaceStore` uses private local SQLite. Never create another `ReviewService` while the UI coordinator owns the workspace. Plain bounded store/CLI reads and action updates are allowed; one coordinator is enforced.
- Review job ID differs from evidence UUID. Each comparison checks fresh primary/verifier execution and dataset identities, requirement/study/runtime/browser consistency and every saved artifact. Source/compiled fixture build hashes can differ; do not mix them and claim causality.
- Frozen plans retain a historical action record. Evidence links additionally pin the historical event prefix; legitimate later action revisions remain readable, changed old notes do not. Controlled fixture sources use no target grant; current completed saved jobs/source integrity govern access.
- Creation and reads use bounded no-follow files, canonical parents and exclusive first-valid publication. Final synchronous transactions/response guards check metadata/current rights/history; they are not atomic with filesystem changes or external receipt. Never adopt, overwrite, delete or replay uncertain/orphan bytes automatically.
- Source/cached managed-view data must clear on permission/source failure and old async replies cannot restore it. API/download copies already delivered cannot be recalled. Use literal DOM text; do not render supplied HTML or Markdown.
- Compile/pack/install final docs into a **new prefix**; same-version npm caches can retain old docs. Compare every installed manifest file, whitelist/private exclusion and SHA-512. Commit ready explicit files; normal push and remote SHA verification follow successful meaningful checks. Continue the next ready work while usage remains available.

The last relevant usage read at 2026-10-25 13:32 UTC allowed ordinary usage (primary 56%, secondary 18% used). Historical only. No credits or reset credits used. Check again only when relevant, and respect natural limits.
