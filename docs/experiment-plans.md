# Frozen experiment plans

Version 0.15.0 adds immutable, supplied experiment plans through the terminal and local API. A plan records intent against an exact checked action revision and its evidence source. Freezing does not execute work, recruit participants, collect outcomes, or establish a result.

## Workflow

Inspect the action and its current revision. Copy `examples/experiment-plan.input.json` from the directory printed by `redteam examples`. Replace the action UUID, expected revision, supplied text, and both future UTC timestamps.

```sh
redteam actions show ACTION_ID
redteam experiments freeze ./experiment-plan.input.json
redteam experiments list
redteam experiments show PLAN_ID
```

The input has exact fields: schema version, kind, action ID/revision, title, owner, hypothesis, intervention, outcome definition, sample plan, and planned window. Outcome fields are `measure`, `successRule`, and `collectionMethod`. Sample fields are `population`, `recruitment`, and integer `targetCount` from 1 to 100,000. The count is intended scope, not a record of people or observations. Unknown fields, execution/outcome promotion, accessor properties, custom serialization methods, and non-JSON data are rejected.

Policy `local-experiment-plan-v1` limits the compact input to 32 KiB. Title allows 200 characters, owner 120, hypothesis/intervention/collection method 2,000 each, and measure/success rule/population/recruitment 1,000 each. Text must be nonblank and exclude unsupported control characters. The window uses canonical UTC `YYYY-MM-DDTHH:mm:ss.sssZ` timestamps. It must start after freeze and within 730 days on the local clock. End must follow start by at most 366 days. Ordering and the latest action revision are checked again during publication and inside catalog insertion. A revision conflict requires a deliberate fresh read; it is not automatically retried.

## Fixed labels and lineage

Every saved report has these fixed labels:

- State: `plan_frozen`.
- Authorship: `operator_supplied`.
- Semantic review: `unreviewed`; protocol review: `not_assessed`.
- Chronology: `local_clock_only`.
- Execution: `not_started_by_tracking`.
- Outcome: `not_collected`; independent outcome verification: `not_assessed`.

A passed planned window changes none of those labels. A supplied owner does not assign or notify a person. A sample plan does not validate population coverage, recruitment, consent, research authority, statistical power, or a study protocol. The system checks the record contract and lineage; it does not approve the hypothesis, intervention, metric, success rule, or method.

The action pin contains its ID, revision, canonical JSON hash, and full original source pin. Two private artifacts preserve the exact parsed input and historical action version. Later declared action revisions do not rewrite or automatically invalidate that historical plan. Retrieval still checks the current complete action history, its pinned historical content, source permission, and source artifacts. Changed historical bytes, source withdrawal/expiry, or broken source integrity deny access. A new grant does not replace the original source grant. Creating a revised plan creates another ID; there is no overwrite, unfreeze, update, or automatic supersession operation.

A local future window and immutable record cannot prove outcomes were unknown when written, that research was prospective, or that any independent authority registered it. Current clocks, hashes, metadata, coordinator, and filesystem assume a trusted local operator. They provide no external timestamp, signature, or hostile-operator guarantee. This feature does not establish psychology, demand, conversion, purchase, investment, funding, causality, or independent outcome validity. U06 outcome collection and adjudication remain separate.

## API and storage

These routes require the current local session and existing Host/Origin protections. Responses use `Cache-Control: no-store`.

- GET `/api/experiments`: at most the latest 100 permitted catalog summaries, labeled `cataloged_unverified`. This is not a fresh artifact check.
- POST `/api/experiments`: freeze the exact input contract; 201 on success, 409 when the action revision changed, or a static 400 for invalid/unavailable input and sources.
- GET `/api/experiments/PLAN_ID`: checked detail; static 404 on source/history/publication failure without private text or filesystem errors.

There is no outcome, execution, mutation, or artifact-download route. Version 0.16.0 adds the dashboard workflow described below. A save can commit before its response is lost. Read recent plans before deciding to retry; no automatic idempotent retry or server undo is supplied.

Private plaintext is stored under `.redteam/experiments/PLAN_ID`; SQLite pins its publication hash and action version, with an atomic catalog/audit insert. Files use the existing exclusive publication path and bounded regular-file readers. Publication and source files are not one filesystem/database transaction. Failed catalog insertion can leave private orphan bytes. They are preserved and never adopted or automatically removed. Permission denial does not erase delivered data, database history, backups, or unmanaged copies. No live provider call or external processing is used by plan tracking.

## Dashboard in version 0.16

Open an action in Reviews, then choose **Freeze an experiment plan**. Supply the hypothesis, intervention, measure, success rule, method, intended population/selection/count, owner, title, and planned start/end. These fields are declarations. Nothing is executed or collected. Start/end inputs use the browser’s local time zone; the preview shows the exact UTC timestamps to be saved. Ambiguous daylight-saving times follow the browser’s conversion rules. Check the UTC preview before freezing. Server bounds and local-clock limitations still apply.

A freeze uses the action revision shown when the form opened. Routine refresh checks current source access, integrity, and action revision. A newer revision warns without replacing the draft. A 409 preserves the draft and offers an explicit fresh action read that discards it. The client does not silently rebase or repeat the write. A lost or aborted response can follow a server commit; read recent plans before deciding to retry.

Reviews lists recent permitted plans with uncollected outcomes and unverified catalog labels. Checked detail shows supplied scope/method/sample/window, fixed unreviewed/unassessed labels, and historical action/source hashes. Later declared action updates do not rewrite the plan. Detail and drafts clear on source denial, known expiry, failed metadata refresh, or integrity rejection. Polling is at most ten seconds apart while idle, plus bounded request time. Mixed catalog/workspace responses are filtered against current known source rights; catalog membership alone is not proof of access or integrity.

Dialog ownership and cancellation prevent a late read or committed-save response from restoring a closed, replaced, or restricted view. Text uses DOM text/value properties, and the client stores no draft or report in local/session storage. Unmanaged browser history, delivered data, screenshots, OS caches, and backups cannot be recalled. Independent outcome collection and U06 adjudication remain unfinished.
