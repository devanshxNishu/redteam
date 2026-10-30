# Operator review input preview

The terminal can check a supplied review input against an exact saved idea/app context report:

```sh
redteam context review preview ./operator-review.input.json
```

Use `context runs list` and the checked report inspection to select the task and report SHA-256. Copy the packaged example, replace its placeholders, and describe only the basis that you actually inspected. The example is not participant research or an actual adjudication.

This command previews input. It creates no review record, approval, action, experiment, task, job or billing entry. The source report retains its original unreviewed status. Review publication and checked retrieval require a separate storage contract and remain open.

## Input

The exact schema1 `context_operator_review_input` has eight fields: `schemaVersion`, `kind`, `taskId`, `reportSha256`, `reviewerLabel`, `coverage`, `reportNote`, and `items`. Extra fields and unsupported values are rejected.

| Field | Rule |
|---|---|
| Task and report hash | Exact checked task UUID and saved report SHA-256 |
| Reviewer label | Nonempty single-line text, at most 120 characters; operator-declared identity only |
| Coverage | `selected_concerns` or `report_limits` |
| Report note | Nonempty single-line limitations or explanation, at most 1000 characters |
| Items | At most 12 distinct existing concern IDs; unknown or duplicate IDs are rejected |
| Item reason | Nonempty single-line text, at most 500 characters |
| Item basis inspected | Nonempty single-line description, at most 1000 characters; no reference is opened |
| Item disposition | `operator_declared_supported`, `operator_declared_unsupported`, or `needs_more_evidence` |

Each item has exactly `concernId`, `disposition`, `reason`, and `basisInspected`. A supported disposition is an operator assertion, not authenticated identity, independent evidence or semantic approval.

`selected_concerns` requires at least one actual concern in a checked response. The preview lists concerns not selected. Selecting every available concern still establishes no semantic validity. Use `report_limits` with an empty item list only when the report has no available concerns, including abstention or unavailable analysis. Do not create a concern ID to represent an abstention.

The explicit local file and complete normalized input are bounded to 24000 bytes. The file reader rejects final symlinks, hard links, unsupported entries, invalid UTF-8 and malformed JSON. Parsed values are normalized before hashing; `normalizedInputSha256` is not a raw-file hash or independent provenance. Normal JSON parsing applies. The input is a captured value snapshot and is not claimed to track later changes to that input file. No environment key or supplied reference is read.

## Preview and current access

A fresh complete inspection checks the original report, task, source files, processing rights and saved hashes. The expected report hash and selected concern IDs must match. The preview includes the original concern statement, typed paired basis citations and a hash of the complete original concern. These fields identify supplied data; source truth and support remain unverified.

The result is `context_operator_review_preview`, policy `operator-review-preview-v1`, status `input_checked_not_saved`. It labels the reviewer and inspected basis as operator declarations. The source outcome, abstention or unavailable-analysis state remains visible. An exact reviewed or authenticated status cannot be supplied through this contract.

The original private data guard is consumed after serialization, just before terminal output. It rechecks file/database witnesses, effective permission expiry, the original 30-second read window and native cancellation. A changed, revoked, expired, copied, reused or cross-workspace preview is unavailable. Complete output is bounded to 48000 bytes; failure emits no partial preview through the normal error path. The CLI outputs one encoded JSON value. OS termination or terminal write failures are not atomic-delivery guarantees.

Input-file I/O occurs before the saved-report read window. Byte bounds do not imply preemptible OS I/O. Local clocks, filesystem, runtime and operator remain trusted. Already delivered copies cannot be recalled. Free text can contain private information; this is not a data-loss-prevention filter.

The preview is data only. It is not a publication receipt, saved review, execution capability, authenticated human outcome or future write authorization. A later write operation must perform its own original full checks. No source database is changed to store the preview. An existing workspace owner and queued browser work are preserved.

## Next gate

Persisted operator declarations need separate private publication/catalog rules. The current inspector pins workspace/task database witnesses. Writing a review row there during a read would invalidate the original guard. Do not bypass that check or accept a saved preview as a receipt.

Semantic review, independent human outcomes, measured pilot usefulness, native model compatibility and paid demand remain separate gates. Authored tests of this command establish software behavior only.
