# Actor report diagnostics

Status: implemented for the local terminal. The command inspects saved actor publications and their recorded artifact hashes. It does not repair a run, authorize report access, accept a decision, or assess research validity.

```sh
redteam actors diagnose RUN_ID
```

Run this from the workspace that owns the actor run. Output is JSON. Exit code 1 indicates an error-level diagnostic or invalid invocation. Exit code 0 means no error-level diagnostic was found; warnings and unassessed permissions can remain. This is not a passing app test or an accepted stakeholder result.

## Inspection scope

`src/actor-diagnostics.ts` reads `.redteam/actor-runs/RUN_ID/report.json` and the artifact references in a supported actor report. It supports configured and scripted actor report kinds. It checks the report's recorded run identity and basic structure, then compares bounded artifact bytes with the saved size and SHA-256 metadata.

The output contains fixed issue codes, severity, explanation, suggested inspection actions, artifact indices/counts, staging counts, and a report fingerprint when its bytes were readable. It does not return report notes, actor output, model/source content, artifact owners/paths, private field values, or parser error bodies.

| Observation | Meaning and next action |
|---|---|
| `publication_missing` | Inspect current tasks and budget. Guarded recovery can check the finalization window and research permission. |
| `publication_invalid_json` | Final bytes are not valid UTF-8 JSON. They may be incomplete or altered; the cause is unknown. Preserve them and compare with a trusted original copy. |
| `publication_invalid_record` | JSON is readable but its identity or structure is unsupported. Preserve it for inspection. |
| `artifact_missing` | A referenced file is absent at inspection. Check an original evidence copy. |
| `artifact_changed` | Saved size or hash differs. The diagnostic cannot determine how the file changed. |
| Unsafe or oversized file | The reference was refused. Inspect its type, size, and containment without replacing it automatically. |
| Staging candidates | Names remain outside the final report. They are not parsed, promoted, or deleted; their names do not establish whether a writer is active. |

The result includes commands to inspect current tasks and budget. It suggests recovery only when the publication is absent. It does not execute any suggested command. Existing invalid final files remain preserved and refused by recovery.

## Boundaries

The command never constructs `WorkspaceStore`, `TaskStore`, `BudgetLedger`, or `ResearchRegistry`. A missing workspace or database is not created. No catalog, task, lease, invocation, held liability, or research permission is changed. File contents, names, modification times, and permissions remain unchanged by inspection; normal reads can update operating-system access times.

This avoids opening live SQLite databases for this inspection. SQLite documents that read-only WAL access can require existing or creatable auxiliary files. Current task and budget state are separate queries, not facts inferred from a saved report. [SQLite WAL documentation](https://www.sqlite.org/wal.html).

Bounds are fixed: two million bytes per report/artifact, twenty artifact references, one hundred report entries, and one hundred directory entries per staging inventory. Reads use fixed allocations and reject symbolic links and nonregular files. Directory containment is checked before reading. Changes detected during a file read are reported; files can change afterward, and there is no transaction across the inspected files.

Hash matches rely on the report's recorded metadata. They do not authenticate that metadata, establish decision acceptance, grant research permission, or prove psychological realism. Current research access checks still apply when a report is retrieved through its report API. This local prototype assumes a trusted operator; it is not a production filesystem sandbox against a hostile concurrent process. There is no repair, cleanup, database diagnosis, or complete run-integrity verdict in this command.

## Verification

`tests/actor-diagnostics.test.ts` covers matching evidence, absent state, unchanged permissions, missing publication, invalid legacy JSON/UTF-8, unsupported identities, hostile field types, missing/changed artifacts, duplicated/escaping references, symlinks, nonregular and oversized files, inventory limits, private staging bytes, and terminal exit codes. Private fixture values and parser error bodies do not appear in output.

A test keeps expired task records and an in-flight budget invocation open while inspecting the report. File-tree fingerprints, names, modes, modification times, live database/WAL/shared-memory bytes, task state, and liability remain unchanged around the diagnostic itself. Test reads of the stores occur outside that file comparison because SQLite read queries can update shared-memory read marks. All test content is authored software data, not participant research or a live provider observation.
