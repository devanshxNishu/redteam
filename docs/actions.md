# Scoped action tracking

Version 0.11.0 introduced local action records through the terminal and API. Version 0.12.0 adds the dashboard workflow. Tracking records plans and operator-declared progress. It does not perform the plan or verify its result.

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

A detail unavailable through permission or integrity checks returns static 404 `action_unavailable`. A conflicting revision returns 409. Invalid write input returns 400. No route executes tests, sends messages, invokes a model, makes payments, starts a worker, or records an independently observed outcome. The dashboard now uses these routes with current source checks, draft ownership, revision conflict handling, and managed-view clearing.


## Dashboard workflow

Open a source observation or controlled-browser finding and select **Plan a next step**. Enter a title, owner label, next step, and separate validation method. Saving creates a proposed record. It does not assign external work.

Reviews shows recent permitted action summaries. Open a record to inspect its pinned source, declared progress, and revision history. Select **Edit declared action** to change tracked fields and record a reason. Completion stays declared and not independently verified.

Edits keep the revision that the operator opened. A newer background revision does not overwrite the draft. A 409 read/write conflict preserves the draft and offers an explicit latest-record read that discards it. The client never reapplies a conflicting update automatically.

Current workspace grants also filter catalog rows. Older code/action responses cannot override newer known revocation, even within one refresh. Open action views and forms inherit source permission, known expiry, detail checks, request ownership, and managed clearing. HTML-like operator text stays text. Browser finding creation sends the workspace job ID; the server supplies its distinct evidence pin.

A save may commit before its response is lost or aborted. The client does not undo that commit or repeat the write. Read recent actions before deciding to retry an unconfirmed save. Source denial, expiry, or failed access refresh clears private managed forms and details. Data already delivered, unmanaged screenshots, browser history, OS caches, and backups cannot be recalled.

These controls inherit the [code dashboard timing and local-operator limits](code-dashboard.md). Structured experiment plans, independent outcome records, causal impact, and stakeholder predictions remain separate work.
