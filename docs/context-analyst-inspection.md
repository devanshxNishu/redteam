# Inspect a saved context report

Use an existing workspace and the task ID from the bounded metadata list:

```sh
redteam context runs list
redteam context runs show TASK_ID
```

The list returns unverified recorded metadata. The show command reads an existing normal report through `inspectContextAnalystReport`. It does not start or resume a review. It returns `checked_historical_context_report_data` with the original report and its hash. Analytical content remains unreviewed. This command has no model or key option and sends no provider request.

Show requires the existing private workspace and task databases, a task-backed manifest, a supported terminal task and ordered events, exact report and candidate bytes, and current brief, source and processing access. It reuses the [historical reader](context-analyst-report-reader.md). A missing report, unpublished candidate, sealed output alone, unsupported record or revoked source is unavailable. A task ID or completed label in the list does not bypass these checks.

The workspace opens with `WorkspaceStore(workspace, { readOnly: true })`. This separate constructor branch requires existing canonical private state, a regular single-link private database, safe WAL/shared-memory files and WAL mode. It uses SQLite read-only/defensive access, performs no schema setup or chmod, and acquires no coordinator slot. The default writable constructor retains its existing behavior. The read-only object still has the class methods; SQLite denies writes. This is a database access mode, not a separate security principal or production sandbox.

Inspection caps each workspace/task main database and WAL at 32 MiB and each shared-memory file at 1 MiB. It pins database identity, private mode, links, size and timestamps before opening. It also pins every checked source, brief, snapshot, processing, manifest, generation, report and optional candidate file before the final full read. After the asynchronous reader returns and the workspace connection closes, it checks these witnesses again. A concurrent catalog write, replacement, permission change or source mutation is conservatively unavailable. It preserves source and report bytes and neither creates missing state nor normalizes unsafe modes.

The local delivery window is 30000 ms from entry. A backward clock or expired window withholds the result. This is not a hard native execution deadline: synchronous SQLite work cannot be interrupted by a JavaScript timer, and the legacy task-event query lacks a dedicated task index. Database size and returned-event bounds do not prove a scan-time bound. SQLite read-only coordination can use filesystem state; no zero-filesystem-activity claim is made. The checks do not form an atomic transaction across all files, clocks and databases.

The output contains authorized local report content. Its budget is a historical configured-rate snapshot, not a provider invoice or a new receipt. Show never opens or creates the current billing database, settles held costs, recovers work, adopts ownership or promotes a decision. Local records are not independently authenticated. There is no API/web report route or terminal execution/recovery route in this slice. It does not establish semantic usefulness, app correctness, current global awareness, researched psychology, consumer demand, investment decisions or commercial validation.

Verification covers idea/app reports, factual failure and held liabilities, missing billing, read-only schema/byte preservation, strict arguments, static denials, unsafe files, closure-time revocation and mutation, and local delivery-window changes. Authored fake HTTP and controlled fixture clocks remain distinct from native provider compatibility and full browser regression. Exact current counts, archive/install results and open release gates are in the implementation status and continuation checkpoint.

An absent WAL and a private zero-byte WAL are equivalent for the content witness. SQLite can create an empty WAL during a first read-only open after the last writer closes. Such a file contains no database frames. Its type, private mode, link count and size are still checked. Main-database metadata remains pinned, and every non-empty WAL remains pinned exactly. New WAL frames, committed main changes and unsafe empty sidecars remain unavailable; no file is repaired or normalized.


The inspector now accepts a strict optional native signal, linked through a private relay during reading. Final closure and later original one-use data delivery enforce the effective processing/source expiry, the unchanged 30000 ms read cutoff and original cancellation state. The [protected API](context-analyst-api.md) consumes this data check after serialization in its response frame. Copies cannot recreate that check; it supplies no ownership, receipt or execution authority. The CLI continues to return checked saved data.
