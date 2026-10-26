# Terminal public-source collection

Version0.38 adds deliberate terminal collection and a separate native captured-source storage policy. The first adapter supports one small World Bank population series. It does not collect news or change the current brief-only analytical packet.

```sh
redteam context sources collect COLLECTION_FILE
redteam context sources list
redteam context sources show SOURCE_ID
redteam context sources withdraw SOURCE_ID 1 "Reason for withdrawal"
```

Use `examples/context-source-collection.input.json` as a disabled template. The strict wrapper requires `schemaVersion: "1.0"`, `kind: "context_source_collection_input"`, `collection` and `supersedes`. The nested collection uses the [bounded collector contract](context-collector.md). Enable explicit collection/local-review declarations, supply their basis and an expiry beyond the configured deadline, and select the permitted query. Other purposes remain denied.

For a new source, `supersedes` isnull. For a deliberate replacement, set `supersedes: {"sourceId": "EXACT_UUID", "expectedRevision": 1}`. A replacement must use the same supported country/economy and annual query range. The predecessor must remain active and permitted. This is a new observation/version, not a claim that the publisher issued a correction. A withdrawn or superseded source cannot be restored.

Only the explicit collect command opens the configured public URL. List, show, preview, UI startup and ordinary app review do not collect. There is no collection API, web control, scheduled feed, retry, fallback, search-provider key or model call. No private brief text enters the public request.

The CLI reads one bounded10,000-byte normal single-link JSON file. Disabled, malformed, expired or unsupported input fails before new state or DNS. A correction requires an existing private workspace. A valid new collection can create workspace state even if the later network request fails. The confirmation returns identity/hash/version fields without private paths or raw text. `show` is the deliberate current-permission text delivery operation. SIGINT/SIGTERM cancels the owned collection and later publication guards.

## Captured record policy

Manual imports retain `context-source-import-v1`. They cannot accept native input, collector flags or receipts. The native writer requires the exact frozen native runtime result. Copied, injected, reconstructed or JSON-forged results cannot use it. A correction additionally requires an opaque current-source preflight created before the actual collection. A monotonic native-start identity prevents a later preflight from authorizing an earlier capture.

One native result can make one publication attempt. Once publication can start, success or failure consumes that attempt. No orphan adoption, uncertain replay or automatic recollection occurs. Rejected preflight/authority checks perform no publication. A new explicit collection is required after a consumed attempt.

`context-source-native-capture-v1` saves exact raw UTF-8 JSON as private `source.txt`, plus a canonical bounded64,000-byte `record.json`. The record has generated metadata, local-use permission, actual storage time, separate raw/input/metadata/record hashes and a bounded capture receipt without a second copy of raw text. The receipt preserves configured query, actual clocks, selected headers, transport/address policy, body identity, annual observations, nulls, units, status and missing years. Its nested `storedSource: false` describes the earlier capture operation; the surrounding source record is the later local publication.

Metadata uses only the supported provider query identifier, English and population tags. Aggregate identifiers do not imply every country, language or consumer group. The inspection label means byte/schema checking; semantics remain unreviewed. Source `lastupdated` retains date-only precision inside the receipt. Annual values remain years. Publication, precise update and event instants stay unknown. Retrieval and storage time cannot manufacture current eligibility.

Source publication shares private exclusive writes/readback, immutable UUID versions and atomic catalog/state/history/audit transactions with manual records. It re-reads the full predecessor after collection and again after publication. Final guards bind unchanged current catalog/rights, exact new files, cancellation and expiry. No atomic transaction across remote request, filesystem and SQLite is claimed. Failed writes can leave factual uncataloged files. A trusted local operator, runtime, CA/DNS, clock, database, filesystem, backups and operation races remain boundaries.

## Checked reads and snapshots

Historical reads reconstruct the supported receipt, raw bytes, generated metadata, input and canonical record. They check private single-link files, exact catalog hashes, lineage/history and current local permission. An expiry, withdrawal, supersession, unsafe file, loss or changed byte denies delivery. A historical receipt is a recorded local runtime assertion; it is not independent network/publisher attestation or a new native execution capability. Owner-controlled valid alternate data cannot be independently authenticated by hashes.

Captured catalogs are explicitly unverified. No raw text or private directory is returned in list/confirmation. Administrative withdrawal remains possible after expiry or content loss and preserves original bytes.

Snapshots containing a captured source use `context-snapshot-v2`, pin each exact source policy/version/hash and retain local-only/unreviewed boundaries. Snapshot creation itself makes no request. Missing exact publication time can make the dataset ineligible under the existing freshness policy. That gap stays visible. Manual-only v1 sources/snapshots reconstruct unchanged, including records created by the actual installed0.36 package. Withdrawal/supersession denies dependent snapshot delivery without rewriting historical bytes or recalling copies.

The shipped test suite uses authored/injected historical fixtures for mechanical checks. They do not establish historical network events. Separate native source and installed smokes verify actual small public requests and the complete storage lifecycle. No human research, news coverage, stakeholder prediction or commercial validation is inferred.

Next add permitted bounded news discovery/feed adapters, their actual captures and correction/coverage policy, then packet2 with per-source external-processing declarations, dated context report/web views and frozen human-reviewed usefulness evaluation. Current global awareness remains unestablished.
