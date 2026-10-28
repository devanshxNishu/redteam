# Terminal context analysis

The terminal can now start one bounded analysis of an existing idea or app brief and its saved context snapshot:

```sh
redteam context runs start ./context-analyst.config.json --key-env REDTEAM_ANALYST_KEY
```

Set the named variable in your process environment before the command. Pass its name, not its value. The command reads that exact variable once after argument and configuration checks. There is no automatic `OPENAI_API_KEY` fallback. The session vault stores browser sessions; it is not used for analysis keys. The selected value stays in memory and is excluded from public configuration, manifest and result data.

The command requires an existing private workspace, a checked brief/snapshot with current source versions and local-use rights, a separate current processing declaration for the exact packet/provider/model, and a valid context-v2 configuration. See [processing declarations](context-processing.md) and [configuration](context-analyst-configuration.md). The configuration must state model, supplied rates, positive count/generation caps, and task/time limits. Shipped authored configuration examples do not establish current source rights or a working native model. The command performs no automatic grant, pricing lookup or model selection.

The configuration file is bounded to 16000 bytes. Argument syntax is exactly `CONFIG_FILE --key-env ENV_NAME`; malformed input is rejected before file or key access. The initial file read has a 30000 ms cancellation window. It does not extend coordinator inference/finalization windows, source permissions or processing expiry. The [workspace bridge](context-analyst-workspace.md) acquires the one existing workspace slot, calls the original coordinator once, releases its owner and closes before checked saved-report delivery. A live owner blocks the new run. Queued browser work is not recovered or interrupted by this command.

| Exit code | Result |
|---|---|
| 0 | A checked saved report with `checked_unreviewed` outcome |
| 2 | A checked saved report with `limited_coverage` outcome |
| 1 | Input, access, ownership, timeout, cleanup or run unavailable |
| 130 | SIGINT cancellation |
| 143 | SIGTERM cancellation |

A published result is JSON `context_workspace_run_outcome` containing checked historical report data. A factual unavailable outcome can contain identifiers and a reason with `report: null`; other failures print a fixed error without partial report text or exception details. Exit 0 confirms mechanical data checks. Analytical reasoning is still unreviewed.

The first SIGINT or SIGTERM cancels the original signal and withholds output. The command observes late promise failures and removes only its own handlers. Handler cleanup failure withholds success. Pending I/O can still finish bounded cleanup; synchronous SQLite is not preempted by JavaScript timers. Cancellation is not evidence of zero provider cost. Unknown liabilities stay held under the original coordinator's configured-rate ledger. Neither cancellation nor an uncertain send authorizes automatic retry, orphan adoption or reconstructed receipts.

Use `redteam context runs list` for bounded unverified metadata and `redteam context runs show TASK_ID` for checked existing report data. These commands do not select a key or start inference. An empty workspace without a task database is unavailable rather than a newly created catalog.

Verification uses authored idea/app text, actual subprocess file/environment selection, native SIGINT/SIGTERM and injected fake HTTP. No operator credential or native provider request is used. This establishes terminal mechanics, not live model compatibility, semantic usefulness, current global awareness, human psychology, demand, investment decisions or funding probability. This command does not execute the reviewed app. API/web execution controls and conservative context recovery remain separate work.
