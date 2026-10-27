# Bounded context coordinator

Version 0.52.0 adds an internal normal coordinator for ideas and apps. `runOpenAIContextAnalyst` joins the existing context v2 components. It creates one private unreviewed run report. Terminal/API/web run routes, historical final-report checking, catalogs and conservative recovery remain open.

## Explicit setup

The caller supplies the model configuration, rates, current processing declaration and API key. The coordinator selects no default model or price and reads no environment key. A supplied fetch function is labeled as injected; the default remains the current runtime fetch selection. Neither label independently authenticates provider execution or live compatibility.

Invalid configuration, keys, options, getter fields and already-aborted callers fail before run side effects. A key echoed inside the prepared input is denied before publication. The owned total caller cutoff starts before read-only preparation. It can be stricter than the original manifest's inference/coordinator windows; it never extends either window. A clock reversal denies authority.

## One original pipeline

The coordinator prepares and publishes exact input, acquires one original task, initializes its matching durable phases and uses the bounded transport for one count and one generation. It closes phase accounting after inference. Checked or rejected observed output can publish one candidate under its original running-owner receipt. The coordinator verifies that receipt, passes only `{artifactRef, sha256}` to sealing, and completes the exact sealed output. It then reads linked candidate data through the separate historical reader. Completion remains mechanical and the text remains unreviewed.

The task now accepts an optional trusted synchronous coordinator guard. The guard must return `undefined`; async or value-returning guards are denied. It is checked before/after awaited factory validation and in the existing task source-authority checks. Cancellation or an expired owner cannot regain dispatch/finalization authority after a delayed read. Models never receive this callback, task, Store, phases, key or receipt.

There is no automatic provider retry, replacement UUID, copied receipt, orphan adoption or inference replay. One run is not a specialist hierarchy, shared resource scheduler or production worker isolation.

## Unreviewed report

The private compact `report.json` has a 128,000-byte bound and exclusive publication. It records exact source/context/processing identities, the checked-unreviewed candidate or an explicit absence, factual task state and a report-time budget snapshot. A rejected or failed transport produces limited coverage. A failed phase cannot invent analytical output, a free request or a usage receipt. Exact task specification and indexed row identity are checked before and after publication, including failure paths.

The budget snapshot uses configured estimates and preserves held count and unknown generation liability. Current ledger identity is checked again after publication, while later trusted receipts can change amounts. The saved snapshot is not a provider invoice or a settlement command.

Existing final bytes are never replaced or adopted. An existing or uncertain publication withholds the buffered payload and returns a static unavailable result. Full current source/task/candidate/report checks apply around publication and delivery. Source or processing loss can leave diagnostic bytes with no returned report. A cleanup failure also withholds success. After successful resource closure, a separately bounded final check repeats complete current source/manifest/candidate/report reads and ledger identity before returning the buffered payload. Permission or byte changes during closure deny delivery. After the final asynchronous check yields, the public return frame again checks current metadata authority and a synchronous report-file witness. Canonical private identity, mode, links, size, mtime and ctime must still match the final byte read. A changed witness withholds the payload even if a later independent read might confirm identical bytes. The file explicitly says it was created before resource closure; it cannot prove cleanup succeeded.

The report has no request-input, raw-source, coordinator-path, key or provider-error fields. Analytical text can still quote supplied/model statements. Semantic review, research validity, app execution, broad global awareness and stakeholder decisions remain unestablished or not performed. A local operator/runtime assertion is not independent provider, behavioral or commercial evidence.

## Cancellation and uncertainty

An explicit caller signal and the owned cutoff stop the caller and revoke ongoing task authority. Phase/task resources close explicitly. Delayed local I/O can leave diagnostic records; an already-dispatched remote request may still incur cost. Unknown liability is not released. No stale model value or late publication receipt is returned. Local clock, file, SQLite and permission changes do not form an atomic transaction.

A complete task or saved seal is not an accepted final report. Historical final-report inspection and conservative recovery still need separate contracts. Recovery must wait through the original coordinator deadline before a factual missing-publication report, preserve a valid final JSON winner, and promote no unpublished candidate or seal. Source loss can restrict delivery while task/budget facts remain.

Native selected model/key/rates/current processing/live compatibility, actual partner app journeys, human research, held-out behavior, usefulness, paid demand, broader news coverage and production isolation remain separate evidence requirements. Software fixtures do not supply them.
