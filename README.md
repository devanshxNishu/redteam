# redteam

Evidence-based app review and researched stakeholder decision models, available through a web dashboard and terminal CLI.

Version 0.4 provides a local workspace, an installable CLI, scoped access grants, browser evidence, a research registry, and bounded stakeholder runtime mechanics. Live inference and the agent roundtable remain development milestones.

## Start from source

Use Node.js 24.12 or later and npm:

```sh
npm install
npm run browser:install
npm run ui
```

Open the printed URL, normally `http://127.0.0.1:4317`. The dashboard provides review history, live job status, findings, evidence inspection, artifact verification, access grants, and terminal instructions. It reads actual workspace records.

The browser installer downloads Chromium into `.cache/ms-playwright`. On macOS, the runner can use installed Google Chrome if the pinned executable is missing. It starts fresh headless sessions, separate from your normal Chrome profile. No model API key is required for the demonstration.

## Install through the terminal

Create and install a local release archive:

```sh
npm pack
npm install --global ./redteam-0.4.0.tgz
redteam --help
```

The package contains compiled JavaScript, dashboard assets, and the fixture. It does not require TypeScript execution after installation. Registry publication is not required.

From the directory where you want to keep your review data:

```sh
redteam ui
redteam review --demo broken
redteam review --demo fixed
redteam runs list
```

Web and terminal share `.redteam/` in the current directory. A terminal review connects to the running local service when available. Otherwise, it starts a bounded review directly. One coordinator can own a workspace at a time. Interrupted jobs are marked and are not replayed automatically.

The dashboard binds to `127.0.0.1`. It uses an ephemeral local session, checks Host and Origin, and does not permit cross-origin API access. This is a single-user local build. Remote hosting, tenant authentication, and production isolation require further implementation.

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

**Access grants are implemented; external app execution and code tools are not enabled yet.** Creating a grant does not start an external review. The current runner accepts the controlled local fixture only.

## Inspect browser evidence

The broken demonstration contains an intentional signup failure. Redteam repeats the journey in a fresh browser and fixture dataset. A reproduced mismatch produces one finding. The fixed build must pass the same requirement without a finding.

The report keeps observed facts, verification, and business hypotheses distinct. It does not establish customer demand or investor interest.

```sh
redteam verify RUN_DIRECTORY
```

Replace `RUN_DIRECTORY` with the path printed by the review. Verification checks registered artifact paths, sizes, and SHA-256 hashes. Metadata is not signed; a successful check does not prove that a requirement is correct.

Each run includes `manifest.json`, `events.jsonl`, `report.json`, `report.md`, screenshots, browser traces, and execution records. Dashboard and service runs save evidence under `.redteam/runs/`. The legacy `npm run demo` command saves under `outputs/runs/`; the dashboard can import recognized legacy runs.

Unavailable tools, incomplete evidence, or inconsistent results produce limited coverage. A cleanup failure cannot become an app defect. Browser setup, journey actions, evidence capture, and cleanup all have deadlines.

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

The adapter is an authored software fixture. It makes no live model calls and does not predict demand or funding. The runtime enforces information access, observed references, decision consistency, step and read limits, context and output size, usage receipts, timeouts, and cancellation. Unknown usage remains visible when a call ends without a receipt.

See the [runtime contract](docs/actor-runtime.md). Live provider integration and analyst subagents remain later milestones.

Consumer and investor decision contracts check structure and material constraints. Registered decision validation additionally resolves model versions, scopes, permitted references, and coordinator identities. These controls do not generate decisions or prove behavioral truth. There are no live LLM actors, country psychology models, purchase forecasts, or investment forecasts in this build.

See the [master plan](docs/master-plan.md), [development backlog](docs/development-backlog.md), and [implementation status](docs/implementation-status.md).
