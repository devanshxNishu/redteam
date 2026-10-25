# Scoped action tracking

Version 0.11.0 adds local action records through the terminal and API. It tracks plans and operator-declared progress. It does not perform the plan or verify its result. Dashboard action controls are a later step.

## Terminal commands

```sh
redteam actions add ./action.input.json
redteam actions list
redteam actions show ACTION_ID
redteam actions update ACTION_ID ./action.update.json
```

Copy the templates from the directory printed by `redteam examples`. Replace placeholder origin identifiers with an existing engineering observation or controlled-browser finding. The templates are not completed reviews or observations.

Creation requires a title, owner label, next step, validation method, and origin. It starts at revision one with status `proposed`. The owner is a local label. It does not resolve, contact, notify, or assign a task to a person or external app.

Each update requires the current `expectedRevision` and a nonempty note. It can change the title, owner, next step, validation method, or progress. An update that changes no tracked field is rejected. Updates cannot alter origin, creation identity, verification, execution, or authorship fields.

Read the latest record before retrying a revision conflict. Tracking does not retry updates automatically. API conflicts return 409; terminal commands return a nonzero exit code.

## Progress and interpretation

| Status | Meaning |
|---|---|
| `proposed` | An operator recorded a plan |
| `in_progress` | The operator declares work in progress |
| `blocked` | The operator declares a blocker |
| `completed_declared` | The operator declares completion |
| `cancelled` | The operator no longer intends to track the plan as active |

All records retain `authorship: operator_supplied`, `verificationStatus: not_independently_verified`, and `execution: not_performed_by_tracking`. Completion does not establish a passing test, reproduced fix, measured improvement, research result, purchase, investment, or business outcome. Cancellation does not cancel a worker, release a budget reservation, or reverse an external action.

The original source status remains recorded. Engineering observations remain unreviewed. A browser finding retains its recorded status from the controlled fixture. Tracking does not promote either source.

## Supported origins and current access

An `engineering_observation` origin names an engineering run and observation ID. The record pins its report hash and current grant/target. Inspection and updates verify the engineering report, original input, pinned source snapshot, and copied artifacts through the existing readers. Current expiry and revocation restrict the entire action, including its title, owner, and history. A new grant cannot silently replace the original source permission.

A `browser_finding` origin uses `runId` for the workspace review/job ID returned by `redteam review` or `runs list`, plus the finding UUID as `itemId`. The evidence run UUID can differ. The server records both IDs; callers cannot supply the evidence pin. The supported reports are controlled local fixtures under that workspace's `.redteam/runs/EVIDENCE_RUN_ID` or `outputs/runs/EVIDENCE_RUN_ID`. The reader canonicalizes filesystem aliases and rejects unsafe directories, symlinks, and escapes. It pins the report and checks every declared artifact. Arbitrary external app reports are not enabled by this origin type.

Browser evidence has bounded inspection: a two-million-byte report, at most twenty unique artifact references, five million bytes per artifact, and twenty million total artifact bytes. Unsupported or changed evidence denies action inspection and updates. Hashes rely on trusted local records, not external signatures.

## Persistence and concurrency

The existing private workspace SQLite database stores the current action and append-only revision events. Supported APIs do not edit earlier events or replace the source pin. One read transaction supplies the record and its event history. The reader checks revision sequence, fixed provenance, immutable origin/creation identity, and the last saved state.

Updates compare the expected revision in the database write. Competing requests for the same revision cannot overwrite each other. The event and workspace audit entry commit with the current state. Source permission is checked again inside that write transaction. Filesystem integrity and database writes are not one transaction; the feature retains trusted-local-operator limits.

Records support at most 100 revisions. Lists inspect the most recent 100 stored records and return the permitted subset, with `cataloged_unverified` labels. Listing does not re-read all source files or claim complete workspace coverage. Direct detail performs current source integrity checks.

Input must be a JSON object with supported fields and at most 16,384 compact serialized bytes. Titles allow 200 characters, owner labels 120, next steps and validation methods 2,000 each, and update notes 1,000. Earlier data is private local plaintext, including SQLite journal files and backups. Revocation denies supported retrieval; it does not erase those copies.

## Local API

The existing bearer session, Host/Origin rules, and no-store policy protect these routes:

- GET `/api/actions`: recent permitted catalog summaries.
- POST `/api/actions`: create a plan from the input contract.
- GET `/api/actions/ACTION_ID`: current checked record and revision history.
- PATCH `/api/actions/ACTION_ID`: a declared update with an expected revision.

A detail unavailable through permission or integrity checks returns static 404 `action_unavailable`. A conflicting revision returns 409. Invalid write input returns 400. No route executes tests, sends messages, invokes a model, makes payments, starts a worker, or records an independently observed outcome. Action UI and managed client caching remain unfinished in this release.
