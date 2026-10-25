# Next integration: saved analyst runs and conservative recovery

After verified 0.34.0, preparation, ownership, phase accounting, bounded HTTP and checked manifest/generation storage are ready internal components. `src/analyst-artifacts.ts` implements the save-before-ownership and task-bound historical manifest reader; its result grants no execution authority. Implement a checked record contract, coordinator and recovery before enabling a terminal run command. Keep actor acceptance/recovery and generic app execution unchanged. No predictive or semantic approval is included.

## Records and publication

Use owner-only `.redteam/analyst-runs/RUN_ID` with fixed contained JSON filenames. Save exact compact manifest bytes first, without a newline, and verify their SHA against the prepared digest before acquiring a task. Save exact generation data/hash separately. Do not save credentials, Authorization headers or environment values. The existing transport result is a normalized checked/rejected outcome, not the original provider envelope; preserve that distinction. Wire hashes cannot substitute for absent original wire bytes.

Bound every read/write and use canonical parents, no-follow regular single-link bytes and exclusive flushed first-valid publication. Reuse lower-level publication and checked-byte helpers; generic EvidenceStore reads alone do not enforce all required bounds/link rules. A failed write can leave complete orphan bytes. Never replace, adopt, delete or replay them automatically.

The manifest, normalized transport candidate, report-time task/budget snapshots and final report need exact identities and hashes. Candidate artifact reference can be deterministic per run. Pin the candidate digest with task seal and completion only after full current source/packet/response checks. Task completion remains mechanical; response reasoning and protocols stay unreviewed. No fixture evidence is attached to an unrelated claimed app.

Add an insert-only analyst catalog in WorkspaceStore, with atomic audit and a synchronous final current-source guard. Minimal metadata should include run/task/brief identity, subject type/title/time, outcome, private directory and report SHA as appropriate for a local private store. Public projections must omit paths/private pins and analytical content until checked retrieval. No new web/API exposure is required for the first terminal slice.

## Coordinator

Validate/normalize input and explicit key/configuration before side effects. Read the checked brief/generation/packet and retain exact private source metadata for a synchronous guard. Create the checked run directory/manifest/generation, acquire one analyst task pinned to exact manifest bytes and create the matching phase ledger. Register caller/terminal cancellation. One count/generation attempt only; no automatic retry.

Re-read full current packet before transmission and after response, around candidate validation/sealing and before publication/catalog insertion. Synchronous source authority binds the fully checked source and catalog; it is not itself a file read. The existing generation/transport bodies must still match the original manifest. Source or processing expiry blocks new transmissions. Original external-processing expiry does not retroactively claim local read/retention rights; define this separately and clearly for historical reports.

Close phase accounting after inference without increasing its deadline or releasing unknown spend. Close task/timers/connections explicitly. Candidate publication, supported task failure or exact sealed completion, and final factual report must preserve known/unknown spend and unreviewed status. Checked output can be shown only as supplied-source analytical content, never an approved finding, consumer purchase, investor action or funding probability.

The report-time budget is historical. A later trusted receipt may settle current ledger liability. Reading a historical report must not require current budget bytes to equal its earlier snapshot; verify immutable invocation identities/caps and allowed transitions instead. Never infer a receipt from a count or candidate JSON.

## Checked reading

Treat all persisted JSON as untrusted data, not a typed in-memory preparation. Strictly parse/reconstruct supported manifest/configuration/record schemas. Bind the manifest to the durable analyst task and exact source, generation/candidate bytes, task output reference/fence and recorded statuses. Recheck current source/catalog and byte hashes before delivery. Unsupported/changed/symlink/extra-hard-link/oversized records are unavailable, not repaired into valid analysis.

A local operator who controls databases and all files remains outside hash authentication. Do not claim independent provider execution from injected fetch, artifact hashes or a local clock. Preserve partial coverage and absent evidence visibly.

## Recovery

Filter analyst tasks/run roots separately; actor recovery cannot accept analyst records. Leave healthy active ownership alone. Expired/cancelled/failed tasks can close their own budget conservatively and publish a factual partial record when exact manifest/current source checks permit. Missing budget/candidate records stay explicit. Never dispatch during recovery.

If a completed/sealed task has no final publication, wait through its frozen coordinator deadline. Afterwards publish a limited record with no accepted analytical response, keeping any verified seal diagnostic only. Do not promote an unpublished candidate. Unsealed/orphan candidate files cannot become acceptance evidence.

An existing first-valid final JSON can be checked and cataloged without changing it. Concurrent repair inserts one matching catalog row. A delayed normal coordinator must preserve a valid recovery winner; it cannot replace that report or attach its buffered candidate as accepted output. Existing incompatible bytes remain untouched/unavailable. Current-source failure denies recovery and later checked reading.

## Terminal and verification

Only after coordinator/reader/recovery pass, add explicit run/list/show/recover terminal operations. Read one bounded config file; load the explicit environment key only for the run operation. Missing/invalid configuration/key must fail before task/provider side effects. No default model or price, no automatic supplied URL/file-reference fetch, and no automatic uncertain-write retry. API/web integration follows its own managed-view guards.

Use real stores and injected fake fetch for success, refusal, invalid/unknown usage, cancellation/expiry, source withdrawal before/after response, all publication boundaries, sealed/completed-but-unpublished cases, late receipts, reader tamper/link/size errors, concurrent first-valid publication/catalog repair, original-source preservation and no replay/semantic promotion. Native provider/live verification remains separately blocked by actual selected key/model/rates/processing inputs. Run full regressions, archive/install/source-byte checks and ordinary private exact-SHA pushes.
