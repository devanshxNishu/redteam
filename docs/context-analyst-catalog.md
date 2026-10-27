# Context task metadata in the terminal

From an existing workspace, run:

```sh
redteam context runs list
redteam context runs list 0 20
redteam context runs list NEXT_AFTER_ROW_ID 20
```

The optional first value is a decimal SQLite row cursor. The optional second value is the number of rows to inspect, from 1 to 100. The default is 50. Use the returned `nextAfterRowId` for another window. No workspace or task database is created when either is absent.

The output contains context task/run IDs, recorded state and local creation/update times. Each entry has `status: recorded_metadata_unverified`. Recorded `completed` state is a task label. It does not establish an accepted report or a completed review. Orphan task metadata can appear. The command does not validate manifests, sources, current source rights, event history, budgets or final reports. It grants no ownership, model call, retry or recovery.

A window scans by indexed rowid. It inspects at most the requested rows and reads one additional bounded row for lookahead. Unrelated task documents are not loaded. Sparse windows can contain fewer context entries because other task kinds occupy rows. Unsupported context metadata is counted and skipped without repair. `hasMoreRows: false` ends the positive-rowid window; it does not establish a complete or independently verified catalog. Concurrent changes and data outside the cursor range remain possible.

The direct `scanContextAnalystTasks(stateDirectory, options?)` helper requires an existing canonical private directory and task database. It does not construct a WorkspaceStore, TaskStore or BudgetLedger. Database/sidecar links, private modes, supported table columns and main/WAL identity must remain safe through the read transaction and connection closure. The file limits are 32 MiB for main and WAL each, and 1 MiB for SHM. Selected context documents are at most 64 KiB. The command returns no owners, paths, manifest hashes, private source text or output text.

The helper accepts a native `AbortSignal`, `afterRowId`, `rowLimit` and `maximumReadMs` from 1 to 5000, with a 2000 ms default. This is a delivery guard. A JavaScript timeout cannot interrupt synchronous native SQLite work while the event loop is blocked. File/query bounds limit this metadata operation; hard native execution-time isolation remains separate work. A read-only SQLite connection can use filesystem coordination; the helper does not claim zero filesystem activity.

Unsafe or changed files are unavailable. The reader does not normalize modes, create missing databases, repair schemas, update tasks or infer zero billing. List retrieval is separate from current source/report permission checks. Terminal show/start/recover and source-backed inspection are separate future steps. No public API or web metadata route is added by this slice.

Verification uses real local TaskStore rows, private file checks, authored clock cases and terminal subprocesses with network denial. It does not establish native model compatibility, researched psychology, purchase demand, investment decisions or commercial validity.
