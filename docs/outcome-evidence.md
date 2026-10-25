# Controlled outcome evidence links

Version 0.21.0 adds terminal-only registration of checked controlled-signup evidence against a frozen supplied experiment plan. This prepares U06; independent outcome tracking and human adjudication remain open.

```sh
redteam experiments evidence register ./outcome-evidence.input.json
redteam experiments evidence list
redteam experiments evidence show EVIDENCE_ID
```

The packaged template is `examples/outcome-evidence.input.json`; use `redteam examples` to locate it. Replace its two IDs. Only `schemaVersion`, the fixed input `kind`, `planId`, `comparisonId`, and an optional nonempty note of up to 2000 characters are accepted. A supplied note is unreviewed text, not an outcome declaration. JSON is limited to 16 KiB. Unknown outcome/approval/execution fields, arbitrary paths, getters, and serializers are refused.

## Source and time requirements

1. Run the separate controlled broken signup review and create an action from its actual reproduced browser finding.
2. Freeze a supplied experiment plan against the displayed action revision before its future local-clock window starts. Do not use an unrelated source-note action for this first slice.
3. Run a separate controlled candidate review within that window. The candidate's recorded creation, execution, observation, finish, and report times must be consistent and fit the planned window. Both original jobs must remain completed. Registration itself runs no review or intervention.
4. Create the checked baseline/candidate comparison. It must be comparable, with distinct original evidence/datasets, complete coverage, matching requirement/study/instrumentation, and checked artifacts. A failing candidate may still provide evidence; no success verdict is required.
5. Register the plan/comparison link. The plan must pin the exact baseline review job, evidence ID, report hash, source finding, and compared requirement. Baseline capture and action revision must precede freeze; candidate capture must follow the planned start; comparison and registration must follow capture. Future, malformed, inconsistent, early, and late recorded times are unavailable.

The registration reuses full checked plan, action, comparison, and browser readers. It also freshly classifies the captured source pair, checks comparison contract consistency, pins historical action-event bytes, and checks observation chronology. A different baseline job is not silently substituted even if it names the same saved capture. The original frozen plan, action revision/history, comparison, jobs, and captured files stay unchanged. Later legitimate action updates can coexist with the original historical link; changed historical notes or source bytes cannot.

Local timestamps and hashes provide software ordering and consistency. They do not prove that an outcome was unknown, a study was prospectively registered with an independent authority, a planned intervention happened, provenance was authentic, or an operator could not change trusted local state.

## Result and limits

The immutable report has `state: evidence_registered`. It copies the factual controlled comparison verdict and its requirement/study hashes, records local time alignment, and preserves the supplied input and private source pins in two checked artifacts. Its fixed assessment is:

| Field | Value |
|---|---|
| Scope | `controlled_local_signup_only` |
| Planned intervention | `not_verified` |
| Semantic review | `unreviewed` |
| Protocol review | `not_assessed` |
| Sample adequacy | `not_assessed` |
| Hypothesis resolution | `not_assessed` |
| Independent outcome verification | `not_established` |
| Causal attribution | `not_assessed` |
| Chronology | `local_clock_only` |

A comparison result does not evaluate the supplied metric, success rule, intended sample count, population, selection, or hypothesis. The original plan still says `not_collected` and `not_started_by_tracking`; registration does not rewrite it. The action receives no automatic completion or verification. No inference, source test, participant recruitment, purchase, investment, funding decision, behavioral prediction, commercial validation, or independent human outcome is established.

Current controlled browser evidence uses no external target grant. Saved job availability, full checked source bytes, plan/comparison catalogs, and historical action pins govern access. An interrupted/failed/limited job hides a managed list entry and denies full reads. No external app, source-note outcome, actor/research data, arbitrary participant/result file, or broader hierarchy is enabled. There is no new API, dashboard, or report-export kind in this release.

## Local storage and uncertain results

Records are private under `.redteam/outcome-evidence/ID`. JSON and two artifacts use the existing bounded, nonsymlink, exclusive publication path. The immutable catalog and audit entry are inserted atomically under a synchronous current-source guard. The plan/comparison pair is unique: an ordinary duplicate is rejected before creating another directory; concurrent requests can publish private orphan directories, but only one catalog/audit entry wins.

Publication/source reads are rechecked around the write. The final transaction checks source catalog identities, current job states, action history, and time relations; it is not an atomic transaction with the filesystem. Local metadata, operator, filesystem, and backups remain trusted. This is no hostile-operator, external timestamp/signature, production isolation, or power-loss guarantee.

An error after file publication can leave private orphan bytes. Inspect records after an uncertain response. No automatic retry, adoption, replacement, cleanup, source rewrite, action promotion, or plan outcome promotion occurs. List entries are minimal `cataloged_unverified` metadata within a recent window of 100; full reads verify the publication, both artifacts, full source lineage, and fixed labels. Delivered copies cannot be recalled.

## Verification boundary

A real positive test freezes a plan before a separate later actual browser capture. Other positive mechanics and negative cases use explicitly authored local-clock plan fixtures over copied real capture bytes; they are software consistency tests, not new prospective studies or human evidence. Checks cover wrong sources/windows, future/observation times, source-note exclusion, limited/not-comparable sources, forged comparison verdicts, publication/artifact/history changes, unsafe paths, current availability, insertion races, duplicate concurrency, atomic audit, orphan preservation, fixed labels, later action updates, and terminal commands. The installed archive separately repeats the actual freeze-then-capture workflow without mocked time.
