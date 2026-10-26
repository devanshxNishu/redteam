# Captured-source storage handoff

Version0.37 provides internal bounded native population retrieval. The next I05c slice connects that result to existing versioned local source records and snapshots, then exposes deliberate terminal collection. This repository-only handoff is a design proposal; it grants no execution or source rights.

## Native writer and historical reader

1. Keep manual `context_source_import_input` strict. It must reject collector flags, receipts and a new captured-source policy. Never add a caller JSON field that promotes an import to native observation.
2. Create a separate captured record policy. Its writer accepts only the exact deeply frozen native result object that passes the collector's in-process WeakSet assertion. Injected, serialized, copied or reconstructed results cannot use this writer. A test-only path must remain explicitly simulated and cannot enter native catalogs.
3. Recheck current copied collection/local-review expiry and all times before publication and immediately before catalog insertion. The native result is not execution authority for another request. If caller options permit a correction, bind exact prior UUID/revision/hash/family before collection and recheck after collection and publication. A changed predecessor must fail without replacing its files.
4. Store the exact captured raw JSON as `source.txt`. Do not repeat raw body text in the record. Include a bounded capture receipt with exact input/hash, constructed URL, body size/hash, actual clocks, selected response headers, fixed transport/address policy and checked normalized dataset. Reconstruct it exactly from supported configuration/raw bytes/receipt on historical reads. Pin canonical record bytes in the catalog.
5. Historical reading checks the supported recorded policy, identity, canonical private single-link files, exact hashes, bounds, state/history and current local-use expiry. It does not create a new native runtime capability or assert independent historical network attestation. A trusted machine owner can alter code/databases; this remains explicit.

The existing source catalog, version/correction/withdrawal transaction, private publication and snapshot selection can share their common fields. Add an explicit supported union or equivalent branch for record policies; do not cast a new record into the manual contract. Old manual files and snapshots must reconstruct unchanged. Native capture failure or post-capture publication failure cannot create an active source or adopt an orphan.

## Derived metadata

Generate fixed metadata from the adapter rather than accepting arbitrary source claims. The title, source/series identity and canonical API URL derive from the actual capture. Use the same stable citation/origin identity when a correction replaces a version; retain exact predecessor pins. Distinct country/series entries remain distinct.

Use explicit provider country/economy query identifiers and English/population tags. These are adapter applicability tags, not authenticated stakeholder segments. `WLD` or another aggregate cannot imply coverage for all countries or languages. No unsupported tags from the brief may be added to make coverage appear complete.

`retrievedAt` uses the actual capture clock. Provider `lastupdated` stays separately date-only and annual values stay annual. `publishedAt`, exact material update and event instants remain unknown unless supported by an approved precision policy. Current I05a may therefore keep this dataset ineligible for a current claim. Do not manufacture midnight timestamps or reset publication age using retrieval/HTTP dates. Capture inspection means exact received bytes/schema were checked, not semantic or research approval.

Local collection/review declarations do not authorize external processing, redistribution or training. The captured source must retain those denials. The current analytical packet remains brief-only until I05d.

## Terminal and failure behavior

After storage/reader integration passes, add one explicit terminal collection operation reading one bounded named JSON file. Parse disabled/malformed/expired input before creating a workspace or performing DNS. No automatic collection on list/show/preview, UI startup or ordinary review. There is no uncertain network replay or automatic retry after a file/catalog failure.

Return a minimal confirmation with no private path or raw source text. Checked source show remains the deliberate text delivery operation. List/source/snapshot rights and version rules must apply to both policies. Preserve factual orphan files and raw failure diagnostics without promoting them into inspected content. An actual permitted native installed smoke must verify capture, exact bytes, checked read, version correction, withdrawal and dependent snapshot denial.

Required tests include manual/native policy substitution, injected/copied capability denial, self-rehashed false receipts, changed raw bytes and catalog, correction races/expiry/withdrawal during collection and final insertion, unsafe paths/links, partial publication, old manual/snapshot compatibility, current source access, CLI early denial and zero tasks/budgets/model requests. Do not rely on an LLM to approve provenance.

Then implement permitted news discovery/feeds and their actual smokes, packet2/per-source processing, dated coverage/report views and frozen human-reviewed retrieval/usefulness evaluation. A single annual population dataset does not complete global news awareness or validate consumer/investor behavior.
