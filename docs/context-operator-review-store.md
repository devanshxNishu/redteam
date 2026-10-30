# Saved operator declarations

Use the terminal to save a supplied declaration against an exact saved idea/app context report:

```sh
redteam context review preview ./operator-review.input.json
redteam context review save ./operator-review.input.json
redteam context review list
redteam context review list 0 25
redteam context review show REVIEW_ID
```

Use the same explicit input as the [input preview](context-operator-review.md). Save reads the input again and performs a fresh complete source inspection. A preview, copied response, UUID or file cannot replace that flow. The command does not require a model credential or make a provider request.

The saved status is `operator_declaration_saved_unverified`. Reviewer identity, inspected basis and each disposition are operator declarations. They are not an authenticated person, independent evidence, semantic approval or a validated outcome. Original report reasoning remains unreviewed. Save creates no task, job, budget entry, action, experiment, app execution or stakeholder decision.

## Immutable source binding

The system assigns a new review UUID. The canonical record preserves the normalized input, its hash, local creation time, exact task/run/brief/report identity, and the complete selected original concerns with their hashes and paired citations. Concern selection and report-limits cases follow the existing input rules. Abstention and unavailable analysis retain their original state. A proposed next check remains an unreviewed protocol.

Each save is a new declaration. Existing records are never overwritten or adopted because their bytes happen to match. Revision, deletion and supersession commands are not provided. An operator can deliberately save another declaration, but an uncertain response must not trigger an automatic retry.

Show requires a committed catalog row and matching private record bytes. It performs a fresh original source inspection, reconstructs the supported record, and compares the complete canonical bytes and catalog pins. Rehashed formatting or altered original concerns are not accepted. A directory scan is not a registry. Orphan files cannot recreate a publication receipt or become registered after restart.

The original source, task and workspace database guards remain in force. A separate catalog avoids changing those witnesses during a source read. No primary workspace/task/job/budget row is written by this operation. SQLite may create private coordination files while it reads a database; this is not a claim of zero filesystem activity.

## Storage and failure states

Storage uses private canonical directories below `.redteam/context-operator-reviews/`, a separate WAL catalog, and immutable `records/REVIEW_ID.json` files. Catalog schema, application identity and version are fixed. Unsupported state, unsafe permissions, links, oversized files and unexpected journal files are rejected. Existing permissions and schemas are not repaired. Setup can leave incomplete catalog files after a failure; this implementation does not recover them automatically.

Publication must complete exclusive linking, owned staging cleanup and directory sync before an internal original receipt is available. Only that original successful flow can insert a catalog row. A partial publication or lost response never authorizes replacement, adoption, inference replay or cleanup of another writer's path.

| Result | Meaning | Next step |
|---|---|---|
| `not_created` | No saved declaration was created by this attempt; catalog setup files may exist | Check the explicit input, current sources and workspace |
| `not_confirmed` | Publication or catalog confirmation failed; an orphan or committed row may exist | Inspect metadata before a deliberate new save |
| `committed_unavailable` | Commit returned successfully, but closure or current delivery checks failed | Inspect metadata; show content only while its source checks pass |
| Successful detail | The original response passed its final checks | Preserve the returned ID for later checked retrieval |

Normal command errors print no partial JSON or underlying exception text. Local writes and source permission changes are not atomic across stores. A commit can succeed before confirmation is lost. Registered records remain factual storage; later access loss does not erase them. Metadata can remain available while content is unavailable.

## Bounded discovery and delivery

List returns unverified scalar metadata: IDs, local creation time and hashes. It reads no declaration body or source content and checks no source rights. It exposes no reviewer label or comment. The cursor is a rowid window, with 50 inspected rows by default, at most 100, and one lookahead row. Malformed scalar metadata is skipped with a count. This is not a complete or recent catalog claim. An absent review directory returns an empty window without creating one.

Main and WAL files are each bounded to 8 MiB. SHM is bounded to 1 MiB. Record bytes are bounded to 100000; complete encoded responses are bounded to 120000. Input retains the existing 24000-byte bound. SQLite lock wait is 1 ms. Metadata uses a 2-second default checked window, configurable from 1 to 5000 ms through the library. Show has a 30-second outer checked window and retains the original source inspection window and effective expiry. Save retains its original source window through publication, commit and delivery. Catalog setup and input-file I/O precede that source window. These checks do not preempt blocking OS or SQLite calls.

Only an original response can pass the final encoder once under its exact workspace binding. Serialization precedes the final catalog, record, expiry, cancellation and original source checks. Changed catalog state can invalidate a response even if another save changed an unrelated row. There is no automatic retry or refresh. Already delivered copies cannot be recalled.

Records are local plaintext. Local operator, filesystem, SQLite, runtime, clocks, copies and backups remain trusted. Hashes and declared labels do not authenticate independent research or prevent a trusted operator from rewriting all related state. Supplied text can contain private information; no data-loss-prevention filter is claimed.

API/web declaration management, semantic adjudication, independent human outcomes, native model compatibility and measured pilot usefulness remain separate work. These declarations do not establish consumer demand, investment decisions, researched psychology or commercial validation.
