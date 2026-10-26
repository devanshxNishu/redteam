# redteam

Private source repository: [devanshxNishu/redteam](https://github.com/devanshxNishu/redteam). Verified development milestones are pushed to `main`.

Redteam is planned for **ideas and apps** through a web dashboard and terminal CLI. The current build provides controlled app evidence and local record workflows. Web, terminal and protected API idea/app intake are implemented; analytical idea review is next; researched stakeholder predictions and the live roundtable remain gated. See the [active scope](docs/idea-and-app-scope.md) and [next analytical review slices](docs/analytical-review-plan.md).

Version 0.35.0 provides a local workspace, an installable CLI, scoped access grants, browser evidence, local repository snapshots, requirement-linked source notes, scoped action tracking, a research registry, and bounded stakeholder runtime mechanics. Configured actors use fenced task ownership, durable budget reservations, atomic JSON publication, factual crash recovery, and terminal report diagnostics. Optional OpenAI inference is tested with fake transport. A live smoke test and the agent roundtable remain development milestones. The [global context metadata checks](docs/global-context.md) now assess supplied news/trend records for dates, declared coverage, origin duplication and conflicts. [Automatic collection and source-backed review integration](docs/global-context-plan.md) remain development work; no active feed or current global awareness is claimed.

## Start from source

Use Node.js 24.12 or later and npm:

```sh
npm install
npm run browser:install
npm run redteam -- doctor
npm run ui
```

Open the printed URL, normally `http://127.0.0.1:4317`. The dashboard provides review history, live job status, findings, evidence inspection, artifact verification, access grants, and terminal instructions. It reads actual workspace records.

The browser installer downloads Chromium into `.cache/ms-playwright`. On macOS, the runner can use installed Google Chrome if the pinned executable is missing. It starts fresh headless sessions, separate from your normal Chrome profile. No model API key is required for the demonstration.

## Install through the terminal

Create and install a local release archive:

```sh
npm pack
npm install --global ./redteam-0.35.0.tgz
redteam --help
redteam doctor
redteam context assess FILE
```

The package contains compiled JavaScript, dashboard assets, and the fixture. `redteam doctor` checks runtime, package assets, exact pinned browser candidates, and directory boundaries without creating stores or running tools. It prints static setup advice and current capability limits; file preflight does not prove a successful launch. See [installation preflight](docs/installation-preflight.md). It does not require TypeScript execution after installation. Registry publication is not required.

From the directory where you want to keep your review data:

```sh
redteam ui
redteam review --demo broken
redteam review --demo fixed
redteam runs list
```

Web and terminal share `.redteam/` in the current directory. A terminal review connects to the running local service when available. Otherwise, it starts a bounded review directly. One coordinator can own a workspace at a time. Interrupted jobs are marked and are not replayed automatically.

The dashboard binds to `127.0.0.1`. It uses an ephemeral local session, checks Host and Origin, and does not permit cross-origin API access. This is a single-user local build. Remote hosting, tenant authentication, and production isolation require further implementation.

## Submit an idea or app through the terminal

Copy `idea-review-brief.input.json` or `app-review-brief.input.json` from `redteam examples`, then edit the supplied context:

```sh
redteam briefs preview ./idea-review-brief.input.json
redteam briefs add ./idea-review-brief.input.json
redteam briefs add ./app-review-brief.input.json
redteam briefs list
redteam briefs show BRIEF_ID
```

Preview requires no workspace. Add saves a strict immutable brief with supplied claims, assumptions, evidence references and unknowns; show checks the saved hash/contract. Six unstarted tracks ask product, engineering, buyer, commercial, investor and verification questions. This is **intake, not a completed review**. An idea needs no app. App URLs and evidence references remain unopened text; grants and app execution are separate. The protected local brief API and Reviews → **Ideas and apps** also save and inspect intake. The web form preserves separate subject fields while open, clears drafts on close/navigation, and displays checked literal detail without following references. See the [terminal brief contract](docs/review-briefs.md).

## Prepare an analytical review packet

```sh
redteam analysis packet BRIEF_ID
redteam analysis prepare BRIEF_ID
redteam analysis check BRIEF_ID ./analytical-response.input.json
```

Packet reads the checked idea/app brief and assigns exact supplied-field references. Check validates a separately supplied response against those references and lists uncovered tracks. It calls no model and creates no review result. Structure/reference checks leave reasoning and proposed protocols unreviewed. See the [analytical contract](docs/analytical-review.md); [Local generation preparation](docs/analyst-generation.md) also previews instructions/input/schema without a model, key or request. An isolated [analyst ownership handle](docs/analyst-task.md) now provides one fenced task and current-source checks for future integration. Internal [explicit analyst configuration and manifest preparation](docs/analyst-configuration.md) also pins exact source permission and separate phase caps without creating a run. Internal [durable analyst phase accounting](docs/analyst-invocations.md) now holds count liability and handles cancellation/late receipts under matching task ownership. The internal [bounded analyst HTTP transport](docs/analyst-transport.md) now connects matching durable phases, verified with fake provider responses. Internal [saved analyst manifests](docs/analyst-manifests.md) now preserve exact checked input bytes before ownership and support task-bound historical reading without execution authority. A complete terminal run, report publication/recovery, semantic review and a live provider check remain later steps.

## Grant access

Record a web origin or a local project directory:

```sh
redteam access grant --target https://staging.example.com --name Staging
redteam access grant --path ./my-app --allow code:read,code:test
redteam access list
redteam access revoke GRANT_ID
```

Grants specify their target, capabilities, and expiry. The default duration is 24 hours; `--hours` supports up to 720 hours. An origin grant can cover paths on that exact origin. A directory grant currently names one canonical directory.

Import an authenticated Playwright storage-state file through the CLI:

```sh
redteam access grant --target https://staging.example.com --session ./storage-state.json
```

Redteam checks the imported cookie domains and storage origins. It encrypts stored session values with AES-256-GCM and an owner-only local key. API responses and command output contain grant metadata, without session values. Revocation denies subsequent access and removes the stored encrypted session. This does not log out the app or revoke credentials at its provider. Secure deletion of old database pages and backups is not provided.

The key is stored beside the database under `.redteam/`. This protects against accidental plaintext disclosure; it does not protect against someone who can read the entire local account. Keep the source session file private and manage it separately.

Creating a grant does not start a review. The browser runner accepts the controlled local fixture only. External app execution and source-code test tools remain unavailable.

## Capture local source evidence

```sh
redteam access grant --path ./my-app --allow code:read
redteam code snapshot --grant GRANT_ID --path ./my-app
redteam code list
redteam code show RUN_ID
```

The snapshot copies up to 50 eligible text files under the exact directory grant. It records hashes, skip reasons, and incomplete coverage. Hidden files, common generated and credential paths, symbolic links, hard links, unsupported file types, and oversized files are excluded. Source files remain unchanged.

Captured bytes are owner-only local plaintext. Name exclusions are not a secret detector and do not interpret Git ignore rules. The commands return metadata without source text. Current expiry and revocation govern inspection. Capture runs no app code, shell, test, or model call. A source grant does not authorize external processing. See the [snapshot contract](docs/repository-snapshots.md) for bounds and limitations.

## Record requirement-linked source notes

```sh
redteam code observations add ./engineering-observations.input.json
redteam code observations list
redteam code observations show ENGINEERING_RUN_ID
```

Start with the example input under `redteam examples`. Replace its placeholders with a saved snapshot ID, captured file hash, line range, supplied requirement, and note. Each citation must resolve to the copied bytes. Registration preserves the input and pins the snapshot and report hashes.

These are operator-supplied, unreviewed source notes. Matching a citation does not verify the note's meaning. Requirements remain supplied and unverified; a null requirement keeps the expectation unknown. Execution stays `not_executed` and defects stay `not_assessed`. Inspection returns supplied text under the current grant, without adding source excerpts. See the [observation contract](docs/engineering-observations.md).

The local service also provides authenticated GET inspection at `/api/code-runs` and its `repositories/RUN_ID` and `observations/RUN_ID` detail routes. Listings are explicitly unverified catalog summaries; detail requests check current access and saved evidence. Reviews now shows both record types. Detail keeps unreviewed labels visible, refreshes access and integrity, and clears on denial, known expiry, or a failed refresh. See the [dashboard contract](docs/code-dashboard.md). No source download, capture, or registration action is exposed through these routes.

## Inspect browser evidence

The broken demonstration contains an intentional signup failure. Redteam repeats the journey in a fresh browser and fixture dataset. A reproduced mismatch produces one finding. The fixed build must pass the same requirement without a finding.

The report keeps observed facts, verification, and business hypotheses distinct. It does not establish customer demand or investor interest.

```sh
redteam verify RUN_DIRECTORY
```

Replace `RUN_DIRECTORY` with the path printed by the review. Verification checks registered artifact paths, sizes, and SHA-256 hashes. Metadata is not signed; a successful check does not prove that a requirement is correct.

Each run includes `manifest.json`, `events.jsonl`, `report.json`, `report.md`, screenshots, browser traces, and execution records. Dashboard and service runs save evidence under `.redteam/runs/`. The legacy `npm run demo` command saves under `outputs/runs/`; the dashboard can import recognized legacy runs.

Unavailable tools, incomplete evidence, or inconsistent results produce limited coverage. A cleanup failure cannot become an app defect. Browser setup, journey actions, evidence capture, and cleanup all have deadlines.

## Track a scoped follow-up

```sh
redteam actions add ./action.input.json
redteam actions list
redteam actions show ACTION_ID
redteam actions update ACTION_ID ./action.update.json
```

Templates are under `redteam examples`. Link a plan to an existing controlled-browser finding or engineering note. Record an owner label, next step, and validation method. Updates use an expected revision and preserve history. Source revocation and expiry restrict dependent plans.

Progress is operator-declared, including `completed_declared`. Tracking sends no message, assigns no external task, executes no code, and verifies no outcome. Reviews now supports source-linked plan creation, action/history inspection, and revision-aware declared updates. Conflicts preserve the draft and require a deliberate fresh read; source expiry or denial clears managed views. See the [action contract](docs/actions.md).

Structured experiment plans can be frozen against a checked action revision through `redteam experiments freeze FILE`, then inspected with `experiments list` and `experiments show PLAN_ID`. Plans preserve the supplied hypothesis, intervention, measurement rule, sample plan, future window, owner, and original action version. Action detail also offers a supplied-plan form; Reviews provides checked frozen-plan inspection. Revision conflicts preserve the draft until a deliberate fresh action read. They execute no work and collect no outcome. See the [experiment-plan contract](docs/experiment-plans.md) and packaged input template.

Selected checked review, action, experiment-plan, comparison, and controlled evidence-link records can be exported through `redteam reports export FILE`, then inspected with `reports list` and `reports show EXPORT_ID`. The private JSON/Markdown bundle preserves their source references and declaration limits. New v2 exports count transitive dependencies (at most five distinct underlying reviews and ten references); saved v1 exports remain readable without rewriting. The dashboard and protected local API also create, inspect, and download checked exports with current access checks before delivery. The dashboard verifies byte length/hash before requesting a native download and clears managed state after source denial. It adds no test, model, raw source, research, or credential content automatically. See the [report-export contract](docs/report-export.md).

Saved controlled reviews can also be compared without executing another test:

```sh
redteam comparisons create --baseline BASELINE_REVIEW_ID --candidate CANDIDATE_REVIEW_ID
redteam comparisons list
redteam comparisons show COMPARISON_ID
```

The comparison requires matching study and requirement scope, checked artifacts, complete fresh execution pairs, and consistent recorded instrumentation. It reports the observed requirement states and explicit reasons when evidence is not comparable. It does not establish a causal fix or change action declarations. See the [comparison contract](docs/comparisons.md). Reviews also provides baseline/candidate selection, checked detail, source pins, coverage reasons, and refresh-time source-integrity rejection. Closing a pending save does not undo its commit; read recent comparisons before retrying.


## Link controlled outcome evidence

After freezing a plan from an actual controlled browser finding, run a separate later candidate within its window and create the checked comparison. Register the exact plan/comparison link:

```sh
redteam experiments evidence register ./outcome-evidence.input.json
redteam experiments evidence list
redteam experiments evidence show EVIDENCE_ID
```

The record preserves source hashes, historical action lineage, local time alignment, and the factual comparison verdict. It performs no work and adjudicates no hypothesis, sample adequacy, independent outcome, or causal effect. Plans and action declarations stay unchanged. The web dashboard, terminal, and protected local API support this controlled-fixture slice. In Reviews, open a frozen browser-finding plan, choose **Link controlled evidence**, select an explicit saved comparison, and optionally supply a note. The checked detail retains fixed unadjudicated labels; source loss clears managed content on refresh. It prepares U06; human outcome tracking remains open. The API returns whitelisted IDs, hashes, fixed labels and supplied notes; internal paths/history pins remain private. See [the contract](docs/outcome-evidence.md).

## Development checks

```sh
npm run typecheck
npm test
npm run build
```

The suite covers deadlines, fixture preconditions, request limits, evidence changes, decision consistency, encrypted grants, revocation, coordinator ownership, local API boundaries, and actual browser review execution. See the implementation status for the latest recorded results.

## Research registry

```sh
redteam research demo
redteam research sources
redteam research models
```

The demo registers three synthetic sources, one immutable draft consumer model, a frozen evaluation, and a scripted decision record. It checks software controls. Its expected choices are authored fixtures, rather than model output or human observations. The dashboard shows actual source counts and model status.

Use JSON files to register research and model versions:

```sh
redteam research source add SOURCE.json
redteam research model add MODEL.json
redteam research model ground MODEL_ID VERSION
redteam research evaluation register EVALUATION.json
redteam research evaluation lock EVALUATION_ID PREDICTIONS.json
redteam research evaluation score EVALUATION_ID
redteam research source revoke SOURCE_ID --reason 'Participant withdrawal'
```

Grounding and training permissions are distinct. Held-out outcome sources cannot be retrieved for either purpose. Evaluation requires a complete, immutable prediction set before outcome access. After exposure, affected participant records cannot become a fresh blind test. Models frozen before exposure can share a comparison set.

Source withdrawal denies subsequent use, removes active encrypted content, and restricts dependent models. Human provenance is operator-declared; the software does not authenticate research, verify consent documents, or establish representative sampling. Model scope matching is exact across market, language, segment, category, and decision identifiers.

Scoring reports categorical agreement against registered thresholds and an operator-declared baseline. It never promotes a model into validated status. Independent research review and appropriate statistical evaluation remain required. See the [registry contract](docs/research-registry.md) and generated declarations in `dist/research.d.ts` for input fields.

## Stakeholder runtime demonstration

```sh
redteam actors demo
redteam actors list
redteam verify RUN_DIRECTORY
```

The same scripted demo is available in the dashboard's Stakeholder models view. It saves a consumer rejection and a conditional investor decision, including constraints, evidence, missing information, and conditions. Both interfaces use the shared actor-run catalog.

Configured terminal runs also save a durable budget snapshot. Use `redteam budgets show RUN_ID` to inspect current reported spend and unsettled reservations, including late receipts. Unknown cost remains held after timeout or restart. This protects local allocation at configured rates; it does not establish actual provider billing. See [the ledger contract](docs/budget-ledger.md).

Use `redteam tasks list`, `redteam tasks show TASK_ID`, or `redteam tasks cancel TASK_ID` to inspect and stop a configured actor from another terminal. Ctrl+C requests bounded cancellation. `redteam tasks recover RUN_ID` publishes available partial evidence from an interrupted run without repeating provider requests or accepting an unfinished decision. See [task ownership and recovery](docs/task-state.md).

The same recovery command restores a missing catalog entry when a normal report was saved before its process stopped. An accepted report must match its completed task, original sealed worker bytes, evidence snapshots, and current research permission. Recovery preserves the saved files and simulated action.

If a completed task has no JSON report, recovery returns `publication_pending` until its frozen finalization deadline. After that deadline, it can publish a factual partial report with the completed task, verified seal, and budget. Its decision is `unavailable`, with reason `publication_missing`; no stakeholder action is reconstructed. Current research permission is required. A delayed coordinator preserves the first valid publication, and no inference request is repeated.

JSON records and byte artifacts saved through the evidence store use private staging files and exclusive publication. Readers see a complete final record, and an existing entry cannot be replaced. Interrupted staging files remain outside the report and are never promoted during recovery. See the [publication contract](docs/evidence-publication.md) for filesystem requirements and the boundary between publication and acceptance.

Use `redteam actors diagnose RUN_ID` to inspect a saved actor publication before repair. It distinguishes missing or unreadable reports, invalid JSON, unsupported identity, and missing or changed artifacts. It prints fixed diagnostic messages, counts, and a report fingerprint; it does not print report content, make inference calls, open workspace databases, or change stored records. Error-level findings return exit code 1. Hash matches do not authorize report access or validate stakeholder behavior. See [report diagnostics](docs/report-diagnostics.md).

The adapter is an authored software fixture. It makes no live model calls and does not predict demand or funding. The runtime enforces information access, observed references, decision consistency, step and read limits, context and output size, usage receipts, timeouts, and cancellation. Unknown usage remains visible when a call ends without a receipt.

See the [runtime contract](docs/actor-runtime.md). The optional configured provider path is described below. Analyst subagents remain a later milestone.

Consumer and investor decision contracts check structure and material constraints. The actor runtime also binds decisions to coordinator-supplied scenario constraints. It blocks positive purchase and investment actions when the required observed funds, access, authority, mandate, or diligence declarations are missing. Registered decision validation resolves model versions, scopes, permitted references, and coordinator identities. These controls do not prove behavioral truth or authenticate scenario declarations. No live API run or human behavioral validation has been recorded. Country psychology models, purchase forecasts, and investment forecasts remain unvalidated.

## Optional configured inference

The OpenAI adapter and `redteam actors run` are verified with fake transport. A real API key, selected model, and current pricing are required for a live run. None were loaded or selected during development.

Sources, the scenario, and every fact must explicitly allow external model processing. Existing records default to local processing. The adapter checks input tokens before generation, limits output, handles refusal and incomplete responses, and keeps known usage. Cost is estimated from configured rates, rather than verified provider billing.

See [configured inference](docs/live-inference.md) for templates and commands. `redteam examples` locates bundled templates after installation. The dashboard run button continues to use the authored script.

See the [master plan](docs/master-plan.md), [development backlog](docs/development-backlog.md), and [implementation status](docs/implementation-status.md).
