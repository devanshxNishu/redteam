# Context analyst candidates

Version 0.50.0 adds an internal candidate publication step for ideas and apps. It uses the separate context v2 contracts. It does not add a terminal run command or final report.

## Runtime observation

A completed context transport return now has a private in-process observation. The observation binds the actual returned object to its original WorkspaceStore, preparation, task attempt and fence, result hash, and observed local time. The transport must finish within the original inference window. Both checked-unreviewed responses and observed rejections can have an observation. Failed phases and duplicate execution returns cannot.

Copies, frozen copies, JSON, prototype instances and getters cannot create an observation. Inspection checks the original successful manifest publication, complete current saved/source files, source and processing rights, clock order and the reserved coordinator deadline. Phase accounting can close before inspection. Inspection does not reopen inference or grant task, file-write, seal or report authority.

`explicitly_injected_fetch` means the caller supplied a fetch function. `default_runtime_fetch` means the function came from the current runtime default. The default can also be instrumented or replaced. These are local selection labels. Neither label independently authenticates a provider response, source facts or live compatibility. Installed checks use injected fixtures and deny other network access.

## Exclusive candidate publication

`saveContextAnalystCandidate` requires the original current running task, preparation and observed transport result. It checks the exact task specification, attempt, fence and two count/generation dispatch intents. It reads the existing task registry without creating or repairing a database. It rechecks the saved manifest, generation, complete current packet and source files, and revalidates the response structure and paired citations.

The candidate contains exact run/task/input/source/processing hashes, the local observation, the normalized transport result and fixed knowledge boundaries. It omits request input, instructions, raw source contents, private paths, credentials, hidden reasoning and raw provider errors. Analytical text can still contain supplied/model statements. Its citations and structure remain unreviewed.

Publication uses the existing private exclusive-link protocol for `candidate.json`, with a 64,000-byte bound. One publication attempt is allowed per original task. Concurrent callers produce at most one successful original receipt. Existing bytes are never replaced. An uncertain write consumes the attempt; removing its file does not restore permission to try again. A cutoff bounds the caller; delayed local I/O can leave diagnostic bytes but cannot return a late receipt. There is no atomic transaction across the local clock, files, permission records and SQLite.

After writing, full current source/task checks and exact candidate bytes must still pass before the receipt returns. Permission loss can leave an unsealed diagnostic candidate with no successful receipt. No task seal, completion or final report is automatic. The receipt's `taskSealed`, `taskCompleted` and `finalReportPublished` flags describe this publication step only.

`verifyContextAnalystCandidate` requires that same original in-process receipt and running owner. It checks full current source/task records and candidate bytes again immediately before return. Tampered, missing, public, linked, oversized or unsafe files are unavailable. Inspection does not repair them. A serialized receipt or orphan file cannot restore this capability after restart. A separate historical reader and conservative coordinator recovery remain to be implemented. After sealing, this running-owner verifier deliberately grants no further authority.

## Meaning and cost

A checked candidate is source-linked analytical content with semantic review still unreviewed. App execution, independent research validity, actual buying or investment, funding probabilities and commercial validation are not established. Frozen snapshot dates do not establish broad current global awareness.

The transport result records delivery-time liability classification. It is not a current budget snapshot. Use the verified durable ledger for held count liability, unknown generation liability and known configured usage estimates. Later trusted receipts can change current accounting. No count or candidate file proves that billing is free or stopped.

## Next work

Implement one bounded coordinator, final checked report, historical reading and conservative recovery. Preserve the first valid final JSON. Wait through the original coordinator deadline before a factual missing-publication record; never promote an unpublished seal or replay uncertain inference. Then add deliberate terminal run/list/show/recover operations. Real selected model/key/rates, current processing inputs, live compatibility, pilot usefulness, human research and paid demand remain separate required evidence.
