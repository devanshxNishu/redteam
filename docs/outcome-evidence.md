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

Current controlled browser evidence uses no external target grant. Saved job availability, full checked source bytes, plan/comparison catalogs, and historical action pins govern access. An interrupted/failed/limited job hides a managed list entry and denies full reads. No external app, source-note outcome, actor/research data, arbitrary participant/result file, or broader hierarchy is enabled. Version 0.22.0 adds the protected local API below. Version 0.23.0 adds the dashboard workflow below. Version 0.24.0 adds explicit fifth-kind selection in checked [report exports](report-export.md), with full source checks and unadjudicated labels.

## Local storage and uncertain results

Records are private under `.redteam/outcome-evidence/ID`. JSON and two artifacts use the existing bounded, nonsymlink, exclusive publication path. The immutable catalog and audit entry are inserted atomically under a synchronous current-source guard. The plan/comparison pair is unique: an ordinary duplicate is rejected before creating another directory; concurrent requests can publish private orphan directories, but only one catalog/audit entry wins.

Publication/source reads are rechecked around the write. The final transaction checks source catalog identities, current job states, action history, and time relations; it is not an atomic transaction with the filesystem. Local metadata, operator, filesystem, and backups remain trusted. This is no hostile-operator, external timestamp/signature, production isolation, or power-loss guarantee.

An error after file publication can leave private orphan bytes. Inspect records after an uncertain response. No automatic retry, adoption, replacement, cleanup, source rewrite, action promotion, or plan outcome promotion occurs. List entries are minimal `cataloged_unverified` metadata within a recent window of 100; full reads verify the publication, both artifacts, full source lineage, and fixed labels. Delivered copies cannot be recalled.

## Verification boundary

A real positive test freezes a plan before a separate later actual browser capture. Other positive mechanics and negative cases use explicitly authored local-clock plan fixtures over copied real capture bytes; they are software consistency tests, not new prospective studies or human evidence. Checks cover wrong sources/windows, future/observation times, source-note exclusion, limited/not-comparable sources, forged comparison verdicts, publication/artifact/history changes, unsafe paths, current availability, insertion races, duplicate concurrency, atomic audit, orphan preservation, fixed labels, later action updates, and terminal commands. The installed archive separately repeats the actual freeze-then-capture workflow without mocked time.

## Protected local API (0.22.0)

- `GET /api/outcome-evidence` returns the minimal recent catalog with unverified labels.
- `POST /api/outcome-evidence` accepts the same strict input and returns a checked public report with status 201.
- `GET /api/outcome-evidence/ID` returns the same checked public projection.

The existing ephemeral bearer session, exact local Host/Origin, no-store, nosniff, and bounded JSON body rules apply. One active registration is allowed per service; another receives 409. Creation failures return static 400 with instructions to inspect records before retrying. A saved record may exist after that response. An unavailable detail returns static 404 without paths, notes or raw error content. Unknown mutations, approvals, artifact routes, and downloads remain unavailable.

The whitelist preserves supplied input, fixed assessment, factual observation, local alignment, minimal source IDs/report hashes, action version identifiers, artifact IDs/owners/hashes/sizes/types, and limitations. It omits directories, targets/grants, source catalog fingerprints, private history pins, artifact paths, browser bytes, code, research/actor data, sessions, and credentials. A supplied note may itself contain private text; no universal secret detector is claimed.

Full asynchronous file/source verification precedes response projection. A final synchronous guard binds the response to the exact canonical saved publication hash and selected source identities, then rechecks current completed jobs, source catalogs, historical action prefix, and local time immediately before headers/bytes. It opens no arbitrary path afterward. This is not an atomic transaction with the filesystem or external receipt. Delivered copies cannot be recalled.

Eight API checks cover confirmed projection, private field exclusion, session/Origin/actual forged-Host rules, static errors, unsupported routes/input, later legitimate action updates, history and artifact changes, limited/unavailable sources, current-source and publication-catalog changes injected after a full read, uncertain committed creation, and a real partial-body concurrent request receiving 409. These are owned local software fixtures. The installed archive separately verifies API behavior over genuinely frozen plans and later actual browser captures.

## Dashboard (0.23.0)

In Reviews, open a checked frozen plan whose source is a controlled browser finding. Choose **Link controlled evidence**. The form shows the exact baseline/finding and frozen UTC window. Choose one saved comparable comparison for that baseline and optionally supply a note. It offers up to 25 recent known available comparisons plus a selected record still present in current catalogs. No source or outcome is chosen automatically. The server retains full timing, requirement, source, and artifact checks; a catalog option does not guarantee that its capture fits the plan.

The note and selected ID survive metadata refresh. Unselected unavailable options disappear. Loss of a selected source closes and clears the form; it never silently substitutes another candidate. Pending controls stay locked across refresh. Empty or invalid selections/notes cannot create records. A failed or uncertain create closes with inspect-records guidance; it is not automatically retried. No action or plan status is promoted.

Checked detail shows fixed limits first, the factual comparison, literal supplied note, local time alignment, source IDs/hashes and historical action revision, and two checked artifact metadata entries without download links. The public record JSON is collapsed and literal. HTML/Markdown is never rendered from supplied text. Internal paths/history pins are absent from API content.

The shared refresh now obtains seven metadata endpoints together, filters through exact known plan/comparison/completed-job parents, and rereads active full detail. An open form also rereads its plan and selected comparison; saved-file/source tamper can close it. Missing parents outside catalog windows are unavailable. Idle checks run at most ten seconds between polls plus bounded request time; known failure clears managed views and catalogs. These are local timing boundaries, not a recall guarantee for already delivered data. A changed selection makes a stale comparison-check error irrelevant to its replacement.

Shared dialog generations, abort/reset, expected-close handling and current-source checks prevent old initial/detail/committed-create replies from restoring a closed/restricted view. Only primitive selected IDs and current-view draft memory are added. No local/session storage or global full-report cache is used. Version 0.24.0 adds a fifth export option for this public record; old four-kind exports retain their saved format and meaning.

Eight real-browser checks cover a genuinely frozen plan and actual later controlled capture in the positive web path, exact input/unchanged sources/fixed labels, empty and out-of-window registration, desktop/390 px literal long-note layout, refresh draft preservation, selected/unselected source loss, normal idle-poll detail/catalog clearing, own/source byte tamper, late initial and committed-create responses, mixed stale/current catalogs, failed metadata refresh, locked pending controls, no duplicate creation, and absent persistent browser storage. Other negative cases use explicitly authored clock fixtures over copied real captures. They establish software behavior only.
