# Saved analyst manifests

Version 0.34.0 adds internal `saveAnalystManifest` and `readAnalystManifest` helpers in `src/analyst-artifacts.ts`. They preserve the exact source-bound manifest and generation input before task ownership. They add no execution command, provider request, analytical report, catalog or recovery operation.

## Save before ownership

The writer reconstructs the supported manifest from the current checked brief, analytical packet, generation preview and strict public configuration. It checks exact fields, hashes, identifiers, deadlines, phase caps and policies. Mutable caller data cannot redirect the validated run identifier during source reads.

Compact `JSON.stringify` bytes without a newline define both files and their SHA-256 digests. Manifest bytes are limited to 16,000; generation bytes to 220,000. Files live at `.redteam/analyst-runs/RUN_ID/manifest.json` and `generation.json`. Directories must be canonical and owner-only; published files must be owner-only, regular and single-link. Writes use exclusive flushed publication and bounded checked readback. The exact directory is created once, before any future task or ledger acquisition.

The writer checks current source identity around publication and fully re-reads it before return. It rejects an expired preparation. Existing directories and files are never adopted, replaced or deleted. A failed write or source withdrawal can leave complete orphan bytes. Those bytes do not prove a task, request or result. Retrying the writer does not adopt them.

The writer saves public configuration and supplied source content. It receives no credential and creates no task, budget, actor, review result or audit event.

## Read historical data

The reader requires an existing normal single-link private task database and a matching one-attempt durable analyst task. It rejects unsafe workspace/database permissions before opening the task store; it does not repair those permissions or create a missing database. The task must pin the exact compact manifest digest and match the run, task, question and frozen coordinator deadline.

The reader reconstructs all supported fields and current source/packet/generation identities. It checks canonical parents, owner-only permissions, regular single-link bounded files, exact hashes/formatting and stable task specifications. It reads both files again before delivery and checks current source availability. Changed, unsupported or unsafe records are unavailable. They are not rewritten into valid data.

The deeply frozen result says `executionAuthority: "not_granted"`. Reading does not claim ownership, change task state, dispatch, settle spend, approve analysis or enable replay. Opening the existing SQLite store can use its normal connection/schema setup; this is not a promise of zero filesystem activity.

Original external-processing expiry applies to new transmission. A historical local read can occur after that expiry or the task deadline, subject to current source availability. The processing declaration is not a local retention policy or independently verified consent. A saved manifest is not a current execution grant.

## Limits and verification

Twelve authored actual-store tests cover exact private bytes and absence of task/budget/result side effects; matching queued/running tasks; historical expiry; duplicate and concurrent writers; wrong task kind/pins; modified bytes/fields/formatting; symlinks, hard links, permissions, sizes and unsafe parents; source withdrawal before and during publication; preserved orphans; mutable identifiers; and database checks before permission normalization.

Hashes bind local bytes under a trusted operator, clock, filesystem and database. They do not authenticate independent research or provider execution. Source checks are not atomic with every possible filesystem mutation. Delivered local data cannot be recalled. The run coordinator, checked candidate/report contract, catalog, conservative analyst recovery and terminal execution remain separate integration work. No semantic review, researched psychology, purchase demand, investment outcome or live provider compatibility is established.
