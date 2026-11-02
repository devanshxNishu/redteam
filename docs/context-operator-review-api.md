# Protected operator declaration reads

Version 0.63 adds read-only API access to declarations saved through `redteam context review save FILE`. The local service uses its existing bearer session, exact Host and Origin checks, no-store responses and content security policy. Run it with `redteam ui`. Use the session from that running service; do not place it in a URL or commit it.

A saved declaration is an operator statement. Its identity, inspected basis, dispositions and free text remain unverified. A successful read checks the saved data and current sources. It does not approve the original reasoning or establish an independent human outcome.

## Routes

| GET route | Result |
|---|---|
| `/api/context-operator-reviews` | Bounded unverified metadata window |
| `/api/context-operator-reviews?afterRowId=0&rowLimit=50` | Explicit metadata window |
| `/api/context-operator-reviews/REVIEW_ID` | Fixed checked declaration detail |

The cursor is an exact decimal rowid from zero to signed 64-bit maximum. The row limit is 1 to 100; the default is 50. Duplicate or unknown queries, leading zero forms and unsupported methods fail. Detail requires a canonical lowercase UUID and no query or suffix. V1 has no API create, start or execute route and no managed display contract. Version0.64 adds a separate [managed v2 route and browser view](context-operator-reviews-web.md).

Metadata contains record identities, timestamps and hashes. It reads no declaration body or source rights. Its status is `recorded_metadata_unverified`. A page is not a complete or recent catalog. Follow `nextAfterRowId` deliberately if `hasMoreRows` is true. The private catalog permits at most 8 MiB each for main and WAL files and 1 MiB for SHM, with one lookahead row and a two-second read window.

Detail uses policy `operator-declaration-api-v1` and status `operator_declaration_saved_unverified`. It contains exact report/brief/run pins, operator-supplied notes, selected original concerns, complete paired citations, concern hashes and unreviewed proposed checks. It excludes automatic private paths, raw source text, environment values and provider credentials. Operator text can itself contain private data; this projection is not a data-loss prevention service.

## Delivery checks

Each detail performs a fresh original storage read, canonical reconstruction and current complete source inspection. A private single-use wrapper binds the exact workspace, route, record ID and original read. The API serializes the complete bounded response before consuming the original final data check. It then checks its own native cancellation, read window and effective source expiry. Copied objects and public IDs cannot recreate that guard or authorize a write. Maximum encoded response size is 120,000 bytes and detail has a 30-second read window. File, schema, permission, link, byte, catalog or source changes can withhold the result; the service repairs nothing.

The response gives `checkedAt` and `effectiveExpiresAt`. It does not provide a managed browser `displayUntil` contract. A delivered copy cannot be recalled. Current sources must be checked again for a later read; do not treat an earlier successful read as continuing authority.

One asynchronous context-data read can run at a time, shared with existing checked report detail routes. New note metadata and detail return 409 with code `context_operator_review_busy` when that slot is occupied. A disconnected caller does not release an unsettled read early. Abort and service shutdown cancel delivery. There is no automatic retry. Unsupported or unavailable note reads return a static 404 with code `context_operator_review_unavailable`; local authentication and request-origin errors retain their existing statuses.

The new GET handlers create no task, job, budget entry, declaration, action, experiment or provider operation. Normal service startup still owns the workspace and performs its existing recovery; read-only GET behavior is measured after startup. SQLite read coordination is not a claim of zero filesystem activity. Separate CLI storage and existing report contracts remain unchanged.

## Verification and limits

Release verification covers the complete source regression, actual installed old 0.62 declaration compatibility, package byte checks and private GitHub synchronization. See the [implementation status](implementation-status.md) for current results. Authored test declarations and fake model callbacks are software fixtures. They do not establish participant research, human adjudication, commercial usefulness, purchase demand or investment behavior. A separate managed browser contract and user interface remain future work.
