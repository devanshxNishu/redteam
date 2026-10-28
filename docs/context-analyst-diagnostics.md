# Context run diagnostics

Use the terminal to inspect one saved context task:

```sh
redteam context runs diagnose TASK_ID
```

The command returns fixed metadata about the selected task and four publication paths. It can help explain a missing report before you choose a next step. It does not start or recover work.

The command requires an existing canonical private `.redteam` directory and a private supported task database. It opens that database in read-only mode and reads at most one selected context task document, bounded to 65536 bytes. It checks the indexed task/run identity, supported specification fields and recorded timestamps. The task state and original deadline are labeled `recorded_metadata_unverified`. Event history, lease, fence, output seal and process ownership are not validated. Actor tasks and unsupported records are unavailable.

The fixed paths are `manifest.json`, `generation.json`, `candidate.json` and `report.json` under the recorded run UUID. Each path is classified as missing, unsafe, oversized or a private file observed. The respective size limits are 24000, 500000, 64000 and 128000 bytes. Publication file bodies and their JSON are not read. An unsafe or absent parent stops child inspection. Symbolic links are not traversed. File presence does not establish valid JSON, a matching manifest, a receipt or an accepted report.

| Guidance code | Meaning |
|---|---|
| `report_file_present_unverified` | A private report file was observed. Use the existing checked `show` command for report content. |
| `report_missing_before_recorded_deadline` | The report is absent and the recorded deadline has not elapsed. This does not confirm a live writer. |
| `report_missing_at_or_after_recorded_deadline` | The report is absent at or after the recorded deadline. No recovery, replay or candidate promotion occurs. |
| `publication_paths_unavailable` | Required directories or selected paths are missing, unsafe or outside size limits. Preserve them for inspection. |

Successful diagnostic output is `context_analyst_run_diagnostic`. Exit 0 means that this bounded metadata inspection completed. Report content remains unavailable through this command. Invalid input or unavailable/changed required state gives exit 1 and a fixed error with no partial output. Raw task documents, owner labels, source text, keys, provider errors and absolute paths are not returned.

The command uses no environment key, source permission lookup, workspace owner, current budget ledger or model transport. It creates no missing database and changes no task, job or report. A read-only SQLite connection can create private empty WAL/SHM coordination files and reads can affect operating-system access times. Only absent/private empty WAL content is treated as equivalent; main database and nonempty WAL identity remain pinned. Unsafe modes are not repaired.

Main/WAL bounds are 32 MiB each; SHM is bounded to 1 MiB. The library defaults to a 2000 ms read window and accepts at most 5000 ms plus a native cancellation signal. The CLI uses the default. Checks around database closure and before return withhold changed or late observations. JavaScript timers do not preempt synchronous SQLite. This is not an atomic cross-file/database/clock view or a guarantee against an adversarial local runtime. Files can change after inspection.

Use `redteam context runs show TASK_ID` for the separate complete current source/report checks. A diagnostic UUID, file, deadline or seal grants no source rights, ownership, execution or publication authority. Unknown billing remains unknown; this command does not read, settle or release it. Separately versioned factual recovery and the explicit semantic review gate remain future work. No stakeholder psychology, demand, investment, funding or commercial validity is established.
