# Terminal primary release sources

Version0.40 adds explicit local publication of the bounded [Node.js release capture](node-release-context.md). It supports one fixed public full-release response, not a general news feed or current global awareness. Analytical packets still contain only the supplied brief.

```sh
redteam context sources collect-release FILE
redteam context sources list
redteam context sources show SOURCE_ID
redteam context sources withdraw SOURCE_ID 1 "Withdrawal reason"
```

Start with disabled `examples/node-release-source-collection.input.json`. The strict10,000-byte normal single-link input requires `schemaVersion: "1.0"`, `kind: "node_release_source_collection_input"`, the supported `collection`, and `supersedes`. Explicit collection/local-review declarations, source-specific basis and expiry beyond the complete request deadline are required. External processing, redistribution and training stayfalse. No private brief enters the public request.

Disabled, malformed, unsupported and expired input fails before new workspace state or DNS. Corrections require existing private workspace state. A valid new collection can create local state before a later network failure. Only this deliberate command performs release collection; list/show, snapshots, UI startup and ordinary reviews perform no collection. SIGINT/SIGTERM cancels owned retrieval and publication guards. No API/web collection route, automatic feed/retry, token fallback, asset/link follow, model call or general execution is added.

## Stable identity and corrections

For a new source, use `supersedes: null`. For an explicit new observation of an existing source, use `supersedes: {"sourceId": "EXACT_UUID", "expectedRevision": 1}`. The current predecessor must be active, readable and locally permitted. An opaque same-workspace preflight must precede the actual native capture, including monotonic ordering when wall times share a millisecond. Copied preflight objects confer no authority.

The provider's latest endpoint can select another release later. A correction must keep the actual `nodejs/node` release ID. A different ID produces a state conflict before source files are created; use an explicit new-source operation if that is intended. Same-ID observations create a new immutable UUID/version and preserve old files. This is a new observation, not an assertion that the publisher issued a correction. Withdrawn/superseded sources cannot be restored.

## Record and permission checks

The separate `context-source-node-release-v1` policy saves exact received UTF-8 JSON as private `source.txt` and a canonical bounded64,000-byte `record.json`. The record includes local rights, storage time, input/metadata/content hashes, lineage, fixed unreviewed boundaries and a capture receipt without duplicate raw text. Its distinct input kind is `context_source_node_release_input`. Manual imports and population records retain their original policies and cannot accept release flags or substitute for this policy.

Generated citation ID uses the actual release ID; the origin groups announcements from the same repository. Metadata uses the stable release API ID URL. The original title, tag and supported source fields remain in the receipt. Publication metadata uses only the supported `published_at` instant. The receipt separately preserves its original string/canonical form/precision, creation and provider update. Metadata update/event remainunknown; provider update is not known material change. Retrieval/storage cannot refresh old publication.

English/Node.js/software-release/global scope is explicit. Global does not mean each country, language, app version or stakeholder. The capture's nested `storedSource: false` describes the earlier retrieval; the enclosing source record is the later local publication. Literal announcement instructions never grant tools or processing rights.

Only the exact native in-process capture can reach the writer. Injected, copied, deserialized and historically reconstructed claims have no native capability. Once publication can start, one attempt consumes the native capture on success or failure; no uncertain replay or orphan adoption. Rejected authority/preflight/identity checks publish nothing.

Publication shares exclusive private writes/readback, full predecessor re-reads, exact new files, expiry/cancellation guards and atomic catalog/state/history/audit checks. Failed publication can leave factual uncataloged files. No transaction spans remote service, filesystem and SQLite. Current permission, history, canonical bytes/policy/hash and private single-link file checks govern delivery. Administrative withdrawal still works after expiry/content loss and preserves original files. Delivered copies/backups cannot be recalled.

Historical reconstruction recomputes the supported input, fixed endpoint/API version, response/limits, clocks, release fields, date precision, body identity and boundaries. It creates no new native identity. A local historical runtime assertion is not independent publisher/network attestation; owner-controlled internally consistent alternate data cannot be authenticated by hashes.

## Snapshots and remaining scope

Any snapshot with a release source uses `context-snapshot-v3`, pins every exact source policy and distinguishes recorded release/population sources. It keeps explicit-selection/local-only/unreviewed boundaries and makes no network request. Existing manual-only v1 and manual/population v2 reconstruct unchanged. Source expiry/withdrawal/supersession/tamper denies dependent delivery without rewriting snapshot files. Metadata eligibility does not approve source semantics or a trend.

Authored historical tests verify mechanical checks and grant no native capability. Separate native installed verification covers actual collection, same-ID correction, late preflight denial, an explicitly authored different-ID parent, final-insertion withdrawal, preserved orphan bytes, replay denial and actual old-package v1/v2 compatibility. This does not establish broader news coverage, human behavior, demand or investment validity.

Next: additional permitted primary sources and coverage/discovery, packet2 with per-source processing permission, dated report/web integration, and frozen human-reviewed usefulness evaluation.
