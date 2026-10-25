# Engineering observation records

Version 0.9.0 adds a local operator workflow for recording source observations. It binds supplied requirements and notes to copied repository ranges. It checks citation integrity. It does not review the meaning of a note, execute code, or approve a finding.

## Procedure

1. Capture a repository with an exact `code:read` grant.
2. Run `redteam code show SNAPSHOT_RUN_ID` to find captured paths and file hashes.
3. Copy `engineering-observations.input.json` from the directory printed by `redteam examples`.
4. Replace the example snapshot UUID, source path, file hash, and line range.
5. Supply the requirement, its document reference, and an observation. Use a null requirement ID when the expected result is unknown.
6. Save the input and register it:

```sh
redteam code observations add ./engineering-observations.input.json
redteam code observations list
redteam code observations show ENGINEERING_RUN_ID
```

The template has placeholder identifiers and hashes. It is not a completed review or a valid citation to an existing snapshot.

Add returns a catalog summary. Show returns the supplied notes, supplied requirements, resolved citation metadata, fixed status labels, and limitations. It does not add excerpts from copied source. Operator text can itself contain private material; it is intentionally returned by this explicit inspection command under current permission. Snapshot `code show` continues to return metadata without source text.

## Input contract

The exact root fields are `schemaVersion`, `kind`, `snapshotRunId`, `requirements`, and `observations`. The schema version is `1.0`; the kind is `engineering_observation_input`.

A requirement contains an `id`, `statement`, and `source`. The source has kind `operator_supplied` and a document `reference`. This reference is recorded, not fetched or authenticated. There can be zero to twenty requirements.

An observation contains an `id`, type `source_observation`, `statement`, `requirementId`, and `citations`. A requirement ID must name a supplied requirement or be null. Observation IDs and requirement IDs are unique within their own collections. Identifiers allow letters, digits, underscore, and hyphen, up to 64 characters.

There must be one to twenty observations. Each has one to five citations; the whole input has at most fifty citations. Statements are nonempty and at most 1,000 characters. Requirement references have at most 240 characters. The compact serialized JSON input is limited to 65,536 bytes. Unsupported fields and types are rejected, including caller-supplied execution status, verification status, approved findings, and defect verdicts.

A citation contains exactly `sourcePath`, `fileSha256`, `startLine`, and `endLine`. The path and full-file SHA-256 must resolve to one file and artifact in the saved snapshot. The current filesystem source is not substituted for saved evidence.

Line numbers start at one and include both endpoints. LF separates lines; CR before LF remains part of the captured bytes. The selected range retains original UTF-8 bytes, including a leading byte-order mark, multibyte characters, and its last LF when present. A final LF does not create an extra empty line. An empty file has no citable lines. A range has at most 100 lines and 16,384 bytes.

The resolver returns an artifact ID, range byte count, and range SHA-256. It does not return the range text. A matching hash establishes byte identity within the trusted local records. It is not a signature or semantic judgment.

## Fixed result labels

| Field | Result |
|---|---|
| Authorship | `operator_supplied` |
| Outcome | `limited_coverage` |
| Citation check | `matched_saved_bytes` |
| Semantic status | `unreviewed` |
| Expectation status with a requirement | `supplied_unverified` |
| Expectation status without a requirement | `unknown` |
| Execution status | `not_executed` |
| Defect status | `not_assessed` |
| Approved findings | false |

A supplied note can be wrong even when its citation matches. A declared package script does not establish a test run. A requirement declaration does not authenticate owner approval or a standard. An observation without an expected-result source remains unknown. The workflow does not infer runtime behavior, business impact, purchase demand, or investor interest.

## Storage and access

Records use `.redteam/engineering-runs/RUN_ID/` with private local plaintext. The original normalized input is an immutable byte artifact. The report pins that input hash, the snapshot's report hash, grant, and target. A separate immutable SQLite catalog pins the engineering report hash and its snapshot relationship. Acceptance emits an audit event.

Registration verifies saved snapshot artifacts, citation ranges, current permission, and the snapshot pin before publication and catalog acceptance. Inspection checks current permission, snapshot integrity, report hash, and original input integrity. Revocation or expiry hides list metadata and denies inspection. A changed report, input artifact, snapshot artifact, or snapshot catalog pin is denied.

Failed or killed registrations can leave private uncataloged files. These remain preserved. There is no automatic adoption, retry, repair, or cleanup. Revocation does not erase already copied files or backups. Filesystem reads can update access times.

This is a trusted local operator workflow. It does not isolate hostile processes, authenticate external provenance, or make cross-process permission checks and file writes atomic. Normal repository snapshot exclusions, bounds, and interpretation limits continue to apply. Source content, requirements, and submitted notes remain untrusted data. None can grant tools or change policy.

No source text or submitted note is sent to a model by this feature. The actor runtime does not receive these records automatically. A future engineering analyst needs a separate tool and processing policy. Executed verification and independent finding review remain later milestones.

## Local inspection API

Version 0.9.1 prepares the API for later dashboard controls. It adds three GET routes behind the existing bearer session, Host/Origin checks, and `no-store` response policy:

- `/api/code-runs` returns authorized repository and engineering catalog summaries.
- `/api/code-runs/repositories/RUN_ID` verifies current access and saved snapshot integrity before returning snapshot metadata.
- `/api/code-runs/observations/RUN_ID` verifies current access, the snapshot pin and artifacts, report hash, and original input before returning supplied notes and citation metadata.

Catalog entries have `recordStatus: cataloged_unverified`. Listing does not read every artifact or certify integrity. It omits note statements and storage directories. Detail requests perform the checks. A missing, expired, revoked, unsafe, or changed record returns the same 404 body with code `code_record_unavailable`. Denials do not return source/notes text, parser errors, or filesystem paths.

No copied source excerpts, source artifact download, capture, or note-registration endpoint is provided. The detail response intentionally includes supplied operator text; a future dashboard must render it as text. Current permission applies on every request. A response already delivered cannot be recalled. Dashboard rendering and open-dialog/cache invalidation remain a separate unfinished step; these routes alone do not provide those UI controls.
