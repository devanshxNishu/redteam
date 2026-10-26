# Imported context sources and snapshots

Version0.36 implements I05b for local terminal use. It preserves exact explicitly supplied text and versioned source records, then freezes selected sources and metadata checks against an idea/app brief. It performs no automatic discovery, collection, model call, source authentication or semantic approval. Original analytical packets remain brief-only. Automatic collection, packet v2 integration and context-aware review follow separately.

## Terminal workflow

```sh
redteam context sources import METADATA_FILE TEXT_FILE
redteam context sources list
redteam context sources show SOURCE_ID
redteam context sources withdraw SOURCE_ID 1 "Reason for this deliberate withdrawal"
redteam context snapshots preview FILE
redteam context snapshots create FILE
redteam context snapshots list
redteam context snapshots show SNAPSHOT_ID
```

`context assess FILE` remains a separate metadata-only command without workspace creation. Source import reads exactly two named files. URLs and paths inside them are never opened. Metadata and text must pass before a new workspace is opened. Other source/snapshot commands require an existing normal private workspace database; missing/unsafe state is denied before the store constructor can create or normalize it. Opening an existing store can run normal schema/WAL setup. Preview creates no source, snapshot, task or audit record; it requires that existing store.

Use packaged `context-source.import.json` and `context-source.authored.txt` only as a disabled authored example. The template has false local-use permission and expired fixed dates. It contains no actual news. Replace metadata, exact text digest, permitted purpose and expiry deliberately. `context-snapshot.input.json` has a placeholder brief UUID, historical as-of and no sources; it is not a completed review or ready source selection.

## Source import contract

A strict version1.0 `context_source_import_input` has `metadata`, `observationPeriod`, `permissions` and `supersedes` in addition to schema/kind. Metadata uses the exact [I05a source fields](global-context.md). It must declare available/inspected content and pin the actual imported text SHA-256. This is an operator declaration, not publisher authentication. A discovery-only metadata result cannot claim inspected text through this contract.

Permissions require explicit `localReview: true`, a bounded single-line basis, a canonical UTC expiry after import, and `externalProcessing: false`, `redistribution: false`, `training: false`. This slice grants none of those other purposes. Local review permission governs checked local text delivery, snapshot creation and checked snapshot delivery until expiry or withdrawal. It does not establish a retention policy, legal ownership, consent authentication or recall of delivered copies. The local operator must choose permitted text; there is no universal secret detector.

`observationPeriod` is null or explicit start/end canonical UTC timestamps. End must follow start and must not exceed the declared retrieval time or actual import time. It remains supplied metadata, separate from publication/update/event dates. No quantitative trend methodology is approved. `supersedes` is null for a first version, or `{ sourceId, expectedRevision: 1 }` for an explicit correction of an active permitted source. Citation ID and declared origin ID stay the same within a version family.

Text is at most32,768bytes and must be nonblank strict UTF-8 without unsupported controls. Original BOM, tabs, CRLF, newlines and bytes are preserved exactly; nothing is normalized or truncated. Metadata input/record is at most24,000bytes. Explicit inputs use canonical-parent bounded normal single-link no-follow reads. Stored source records/text use canonical owner-only UUID directories/files, exclusive flushed publication, bounded checked readback and stable current state. Existing entries are never replaced, adopted or deleted automatically. Files/database are not one transaction; a failed catalog/response can leave factual orphan bytes. Inspect before deliberately retrying. No automatic uncertain-write retry or orphan adoption occurs.

Records distinguish actual local `importedAt` from supplied `retrievedAt`. Provenance is always `operator_imported_unverified`; collector identity cannot be supplied or promoted. Raw text, metadata, normalized input and record have separate hashes. These bind local bytes under the trusted operator, clock, database, filesystem and backups; they do not authenticate independent news, dates, origin chains, facts or rights.

## Versioning and withdrawal

Each source version has a new UUID and immutable private text/record. A correction pins the prior record hash, version and lineage root. The new insert, prior supersession event/current state and audit commit in one SQLite transaction under final synchronous authority. One correction wins; failures roll back catalog/events/audit while preserving any already published orphan files. Prior source bytes are unchanged. The child checks the pinned predecessor catalog relation; it does not read or reuse the superseded text under expired/withdrawn permissions.

State history is append-only: active revision1 can become withdrawn or superseded revision2. There is no implicit restoration or later overwrite. Stale expected revisions fail. Administrative withdrawal can still stop an expired source or one whose text is missing; it needs no text read. Withdrawn, superseded and expired versions are hidden from the usable unverified catalog and unavailable through checked text reads. Current state changes can restrict older snapshots but cannot rewrite them or recall copies already delivered.

Source list returns minimal unverified metadata and record hashes for explicit selection. Source show returns checked text/record/current state. Import/snapshot confirmations exclude private directories. No new API, dashboard or artifact download is enabled.

## Frozen snapshots

A strict `context_snapshot_input` contains a checked idea/app `briefId`, explicit `selection`, and the full I05a `context` input. Each of at most12 distinct selections pins `{ sourceId, recordSha256, expectedStateRevision: 1 }`. Context source entries must exactly match those imported versions, in the same order; mismatched metadata, hashes, revisions or citations fail. Nothing is silently substituted.

The supplied scope/policy/as-of are explicit. Creation/preview rejects a future as-of or one before any selected source's actual import time. An import today cannot manufacture earlier observed knowledge from a claimed old retrieval. The snapshot records its own actual creation time, exact brief/packet identity, source version/metadata/text hashes, local-use expiry and deterministic assessment. It stores no source text. Assessment still checks metadata only; outer snapshot boundaries say source bytes were read for local integrity, with no source authentication, semantic review or actual news collection.

Empty or partial selections remain `no_eligible_context` or `partial_metadata_coverage`; passing metadata does not approve a statement or trend. Old brief-only packet bytes are unchanged. New context selection, correction or collection requires another snapshot. No task, actor, app execution, grant, provider or stakeholder decision is started.

Checked snapshot reading reconstructs supported input/assessment/source pins from fully checked current sources and brief, verifies exact canonical private record bytes/catalog/hash, and rechecks current authority before delivery. Withdrawal, supersession, expiry, source loss, changed text/brief/record, unsupported assertions, unsafe links/permissions/size or changed private pins deny it. Source and record checks cannot be atomic with every filesystem mutation. Local operator control of all files/metadata is outside independent hash authentication. No candidate or orphan becomes approved context through recovery.

## Verification and next work

Twenty-nine authored actual-store tests cover exact bytes/time/provenance/purpose, strict early denial and mutable callers, withdrawal/expiry/versions/concurrency/atomic rollback, publication orphans, false rehashed assertions, unsafe files/parents/database, exact brief/source/selection/as-of binding, empty/partial metadata coverage, current source loss and terminal operation without automatic fetch. They are software evidence, not real news or human research.

I05c must next add a configured permitted bounded discovery/collection adapter with distinct actual capture provenance and a real public smoke. Research primary provider/format/network rules first. Do not let manual import claim collector execution or silently add external processing. Packet v2/per-source processing, context-aware report and frozen human-reviewed retrieval/usefulness evaluation follow. Source facts, independent trend data, psychology, demand and investment outcomes remain unvalidated.
