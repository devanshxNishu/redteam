# Local context analysis packets

Version 0.41 implements I05d1: an explicit local packet version 2 and a supplied-response check. It joins one checked idea/app brief to the exact sources in one saved context snapshot. It performs no analysis generation, external processing, source collection, task, budget or result publication. Existing brief-only packet/generation/configuration/manifests remain unchanged. This is not a completed review or an active news feed.

```sh
redteam analysis context-packet SNAPSHOT_ID
redteam analysis context-check SNAPSHOT_ID ./context-analytical-response.input.json
```

Both commands require an existing private workspace and an exact snapshot UUID. Use a snapshot created through the existing [source/snapshot workflow](context-records.md), including supported [primary release sources](node-release-sources.md). The commands do not select extra sources, follow references or refresh the snapshot. The supplied response example has placeholder IDs/hashes and is an authored abstention format, not generated analysis.

## Packet2

The separate `schemaVersion: "2.0"`, `kind: "analytical_review_packet"`, policy `brief-context-analysis-v1` binds the original brief/field hashes and exact v1 brief-packet hash, snapshot ID/policy/publication hash/creation time, frozen as-of assessment and declared claims. It includes every source selected by that snapshot, in order. There is no new clock/random ID. Hashing uses the fixed compact JSON base before appending `packetSha256`; this is local identity, not independent authentication.

Each source has its exact local UUID, record policy/version/lineage/hash, metadata hash, content hash/byte count and complete untrusted literal content. It preserves metadata, supplied observation period, storage/retrieval distinctions, current permission expiry, source provenance and frozen metadata eligibility/reasons/warnings. Release source dates keep original raw/canonical/precision and unknown material update; population dates retain provider date-only update and annual observation years/missing years. Private catalog paths, permission basis and unrelated research/jobs/actors are not added. Supplied source/brief text can itself contain private data.

The complete pretty packet plus newline is bounded to 300,000 UTF-8 bytes with at most 12 sources. Existing v1 brief-field bounds remain. Excess content fails; no source/text is silently omitted, truncated, summarized or split. Bytes are not token/cost limits. Raw JSON/Markdown/HTML/instructions/URLs remain data and grant no tools or authority.

Eligibility is relative to the **frozen snapshot as-of time**. It is not reinterpreted as live freshness when the packet is read later. Unknown/stale/future dates, coverage gaps, origin grouping and declared conflicts stay visible. Global applicability does not imply each country. Metadata/citation checks approve no source semantics, independence, relevance, trend, psychology, demand or investment intent.

Checked creation re-reads the full snapshot, brief and every selected source around construction; final synchronous guards bind unchanged current catalogs and source permission/state. Expiry, withdrawal, supersession, changed/unsafe/missing files or changed identity denies delivery. In-process packet identity is required for the pure validator, with current metadata/permission guards. Serialized/copy flags cannot recreate that identity. The managed response check builds and fully re-reads current packets before returning the frozen checked response. No filesystem/database transaction or independent fact attestation is claimed; local operator, clock, runtime, files, copies/backups and operation races remain boundaries.

## Supplied response

Exact top-level fields are `schemaVersion: "2.0"`, `kind: "analytical_review_response"`, `mode: "analytical_only"`, `reviewStatus: "unreviewed"`, `briefId`, `snapshotId`, `packetSha256`, `concerns` and `abstention`. IDs/hashes must match the checked packet. Zero concerns require a nonblank abstention. A check never registers an accepted review or promotes a source into a verified finding.

Concerns retain the six analytical tracks, unique C00–C99 IDs, `assumption_risk`, `evidence_gap` or `consistency_question` types, qualified priority/reason and proposed next check with unreviewed protocol. Text bounds match v1: 1,000 characters except `priorityReason` (500); at most 12 concerns, 6 citations each, and 32,768 compact UTF-8 response bytes. Named input files have the same total byte bound including formatting. Unknown fields, prediction/approval modes or numeric confidence/funding fields, unsupported controls, duplicate IDs/citations, getters/serializers/symbols and sparse/extra arrays fail. Free text can still contain unsupported reasoning; the checker does not adjudicate it.

Every concern must cite at least one supplied brief field. Citation shapes are:

| Kind | Required fields | Meaning |
|---|---|---|
| brief_field | kind, fieldId, fieldSha256 | Exact supplied field; no external truth is established |
| context_source | kind, sourceId, recordSha256, contentSha256, use | Exact whole selected source version; no quotation/range or semantic support is verified |

Source use is one of `context_at_snapshot`, `background_only` or `coverage_gap`. Context-at-snapshot requires eligible metadata under the frozen policy. Stale/unknown publication cannot silently support that use. Future-ineligible publication/update/event/retrieval cannot be background; it can only identify a coverage gap. Background is qualified unreviewed context, not current evidence. A source can be cited only once per concern, including across use labels. Unselected or changed source pairs fail.

## Processing and next work

The packet is `local_only_not_dispatchable`. Collection/local review and public visibility authorize no provider processing, redistribution or training. V1 analyst configuration still binds `exact_brief_packet_and_generation` and cannot accept this packet hash. Packet2 has no generation preparation, provider route, key lookup or execution authority.

Version 0.42 adds the first I05d2 slice: [separate explicit source-specific processing declarations](context-processing.md), exact purpose/provider/model/source version/hash/basis/expiry and current withdrawal. These declarations do not grant execution authority. Next version the generation/configuration/manifest/task/transport integration. Do not reinterpret old false declarations as authorization or rewrite old receipts. Dated reports/web views, wider permitted primary sources and human-reviewed retrieval/usefulness evaluation remain separate work. A functioning local check establishes no researched behavior or commercial validation.
