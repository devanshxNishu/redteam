# Historical context candidate inspection

Version 0.51.0 adds an internal reader for the separate context v2 candidate format from 0.50.0. It reads linked candidate data. It does not restore a runtime observation, publication receipt, ownership or a final report.

## Required records

`readContextAnalystCandidate(store, taskId)` needs an existing private task registry, a checked saved context manifest/generation and a private candidate file. The task must be a sealed or completed context analyst task with one attempt and fence. Its exact specification, two count/generation intents, deterministic candidate reference and output hash must agree. Its lease and stop reason must be null. Queued, running, cancelled, failed, unrelated and orphan records are unavailable.

The reader uses direct read-only SQLite connections. It checks the exact task table and row fields, WAL mode, canonical private database/main/sidecars and stable main-file identity. It creates no task, ledger, catalog or source publication and does not repair permissions or schema. Stored task documents are limited to one million bytes. Existing manifest/generation/source limits still apply; the candidate is limited to 64,000 bytes.

## Data checks

The reader reconstructs the complete supported candidate/result/observation record. Exact compact bytes must match. Extra fields, duplicate keys, changed formatting, alternate escaped spelling, invalid UTF-8 and unsupported versions are denied.

Request hashes and transport metadata are rebuilt from the checked saved configuration and complete generation. The reader checks positive bounded count values, response hashes, status/reason/liability combinations, selected model for checked output, fixed knowledge boundaries and original task/observation time order. It revalidates the typed response and paired citations over a freshly checked complete packet. A checked response remains semantically unreviewed. Refusal and unknown-usage records remain rejections with their recorded delivery-time liability labels.

A provider response hash cannot authenticate a provider. The original provider body and credential are not available to this reader. The saved observation is a local runtime assertion. `explicitly_injected_fetch` and `default_runtime_fetch` remain selection labels; neither establishes native provider execution or live compatibility. A local operator who controls every database and file can alter records. Hashes and these checks do not independently authenticate that operator's claims.

## Current rights and delivery

The reader rechecks complete current source, processing, manifest, generation, task and candidate records. It compares task identity and candidate bytes again after awaited source validation. A final synchronous check covers database identity, task data, source metadata and processing rights. Changes during the final read deny delivery.

The task's inference/coordinator cutoff does not grant new execution through historical reading. A historical candidate can be read after that cutoff while current source and processing rights still permit it. Under the existing policy, processing expiry or revocation also restricts historical inspection. Reading does not create new processing or retention permission. Source withdrawal and expiry remain effective. Previously delivered copies and backups cannot be recalled by these checks.

The result has no coordinator path, raw-source/generation payload or lease-owner fields. Analytical text can still quote supplied/model statements. It states that runtime observation and publication receipt were not recreated, execution and ownership were not granted, semantic review remains unreviewed, and the final report was not verified. Source/citation integrity does not establish app execution, country psychology, buying, investment, funding or commercial validity.

The candidate's liability field describes a past delivery. Current durable accounting remains separate. This reader cannot infer usage receipts, free count calls, stopped billing or released unknown spend. Source clocks, SQLite, files and permission records do not form one atomic transaction.

## Next work

Implement one bounded coordinator, final report and conservative recovery. Original in-process candidate verification remains restricted to the running owner before sealing. This historical reader is a separate data path. It cannot promote a completed task or unpublished seal into accepted final analysis. Preserve the first valid final JSON, wait through the original deadline before a factual missing-publication record, and replay no uncertain request. Deliberate terminal run/list/show/recover operations follow those checks.
