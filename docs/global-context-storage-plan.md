# Next global context slice: inspected-source records and snapshots

I05a in0.35 checks supplied metadata only. I05b must preserve the exact permitted source bytes and provenance before any analytical packet can claim source-backed news context. Keep discovery, actual collection and source-use semantics separate. Version0.36 implements this local import/storage/snapshot slice; see `docs/context-records.md`. It includes no actual collection or external processing. This development design remains repository-only.

## Source records

Use a separate context-source catalog and private fixed UUID directories under `.redteam/context-sources`. Do not register news as human behavioral research or grant model training/grounding status in ResearchRegistry. Base source versions are immutable; corrections create a new version that names the previous source and preserves the original bytes. Withdrawal restricts new use and checked delivery through an audited current state.

An explicit terminal import reads one bounded metadata file and one explicitly named permitted text file. Nothing in metadata is opened as a URL, local path or script. Preserve supplied publication/update/event/retrieval/data-period dates separately from the actual local import time. Unknown dates remain unknown. An import today cannot prove an earlier retrieval. Sources that were not independently collected must say `operator_imported_unverified`; exact imported bytes do not authenticate the publisher, dates, scope, truth or rights.

Bound raw text to a documented small size and strict UTF-8; preserve exact bytes without normalizing or truncating them. Reject symlinks, extra hard links, unsafe parents, unsupported controls/encoding and size overflow. Record raw byte count, SHA, metadata SHA, import time, source version and the declared permitted purpose. Use canonical private fixed files, exclusive flushed publication, checked bounded readback, then insert-only catalog plus atomic audit under a synchronous final guard. File/database publication is not one transaction. A post-publication failure can leave orphans; no automatic adoption, replacement, deletion or uncertain-write retry.

Keep source content, supplier provenance and allowed local review use distinct from external provider processing, redistribution/export, training and research participation. Required declarations must be explicit and expire where applicable. No source title, URL, hash, public visibility or robots rule grants every purpose. No automatic credential/environment/session import. The local operator and declarations remain trusted; source text can contain sensitive information.

A collector can later register its own captured bytes with distinct provenance under I05c. Do not let manual input impersonate a collector/provider receipt or a trusted network observation. Preserve discovery-only metadata separately and make it ineligible for inspected-source support.

## Current state and checked reads

Add versioned append-only withdrawal/supersession events and a current catalog projection. Use atomic expected-revision writes for changes. No implicit restoration. Define whether expiry and withdrawal deny all checked local delivery, analytical use, external processing or each purpose separately; expose the exact restriction. Never infer local retention rights from external-processing expiry. Previously delivered copies cannot be recalled.

Checked retrieval reconstructs the supported source metadata/record and exact file identities, checks canonical bounded private regular single-link bytes and catalog/source revision, verifies hashes and current use rights before delivery, then checks again. Static errors must exclude source text and private paths. Catalog projections return minimal unverified metadata and no raw content/private directory. Reading imports nothing, acquires no task and cannot grant model/network access. Local DB schema setup/connection activity is a separate filesystem effect, not execution authority.

## Immutable context snapshots

A snapshot selects explicit source IDs/versions for a specific checked brief and explicit scope/as-of/freshness policy. Use a new source identity for each import; I05a's originId is a declared origin chain, not the private source UUID. Bind every selected assessment source to exact imported metadata/content digest and provenance. Do not silently recompute or replace supplied dates, source chains, applicability or citation IDs. Reject mismatch.

Save selected source identities, deterministic assessment, byte hashes and actual snapshot time. New selection or later collection creates a new snapshot. Preserve partial coverage, stale/unknown/ineligible sources and declared conflicts visibly; do not label a snapshot reviewed because metadata passes. A complete coverage grid is not complete world knowledge. Trend time-series method, units, source independence and claim semantics stay unreviewed until their own checks exist.

On checked reading, re-read exact source versions, snapshot bytes and current use restrictions. A later legitimate source state can restrict delivery; it cannot rewrite the historical selection or manufacture earlier knowledge. For later external processing, check per-source explicit purpose/expiry and the new packet version. Original brief-only packets must remain compatible and cannot claim this context was read.

## Terminal and test scope

Implement explicit source import/list/show/withdraw and snapshot preview/create/list/show commands only after the storage/read contracts pass. Preview creates no source/store/result; where a preview needs an existing store, state that explicitly rather than promising zero file activity. No web/API, automatic source discovery, arbitrary fetching or model dispatch is needed for I05b.

Use real stores with authored imported text for tests. Cover exact raw bytes, independent import time, actual manual provenance, false collector identity denial, exact citations/source version/brief binding, rights purposes/expiry, current withdrawal/supersession, concurrent expected revisions/catalog inserts, source/snapshot tampering, unsafe file links/permissions/bounds, publication failure/orphans, no retry, and literal/static terminal output. A separate actual permitted public collection smoke is still required for I05c; do not count authored text as actual news awareness. Continue regular private GitHub verification after a ready milestone.
