# Primary software release capture

Version0.39 adds internal `collectNodeRelease(input, signal?)` in `dist/node-release-context.js`. It retrieves one public Node.js full-release response through a fixed GitHub endpoint. This is a bounded primary announcement helper. It does not save a source record, snapshot, task, budget or review. There is no release collection CLI/API/web/feed or analytical-packet integration yet. Existing terminal population collection remains separate.

## Input and fixed scope

Use strict `schemaVersion: "1.0"`, `kind: "node_release_collection_input"`, `adapter: "nodejs_latest_release_v1"`, `permissions` and `limits`. Permission requires explicit `collect: true`, `localReview: true`, a nonempty bounded basis and canonical UTC expiry beyond the full configured deadline. External processing, redistribution and training must befalse. Timeout is250–30,000milliseconds; raw body is at most32,768bytes. The packaged example is disabled and expired. No key, arbitrary repository, private query, URL, header, language or endpoint is accepted.

The [GitHub releases API](https://docs.github.com/en/rest/releases/releases#get-the-latest-release) supports public access without authentication. Its latest-full-release selection excludes drafts/prereleases and uses creation/commit semantics. The result is not guaranteed to be the newest publication or appropriate version for an app. The official [Node.js project link](https://nodejs.org/en/about/previous-releases) identifies the public project repository. No version recommendation or security judgment is made.

The only new target is `https://api.github.com/repos/nodejs/node/releases/latest`. Request headers fix GitHub JSON Accept, identity encoding, product User-Agent and API version2026-03-10. The response must report the same single selected API version. The [API-version documentation](https://docs.github.com/en/rest/about-the-rest-api/api-versions) documents version selection. A real product smoke verified the requested/selected version; the initial attempted documentation path under `using-the-rest-api` was unavailable and the correct `about-the-rest-api` page was retrieved.

Public [rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) apply by originating IP, with a documented unauthenticated primary limit of60requests/hour plus possible secondary limits. A403/429 or other unavailable response fails; there is no retry, wait, token/proxy fallback or attempt to evade limits. [API terms](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#h-api-terms) and the project's [LICENSE](https://github.com/nodejs/node/blob/main/LICENSE) require source-specific consideration. Operator declarations are not independent permission authentication or blanket rights to user content. This helper authorizes no external processing, training or redistribution.

## Shared transport

`src/public-context-http.ts` now owns fixed target construction and the shared native HTTPS transport. Only the supported World Bank population descriptor and fixed Node.js descriptor are accepted. It never accepts a caller URL or dynamic tool from source content. Original World Bank request headers/URL and serialized capture/source/snapshot policies are preserved.

Each invocation uses explicit expiring local authority, one logical IPv4 DNS resolution and one GET. At most16 addresses, conservative versioned special/private/multicast denial, pinned lookup, original Host/SNI/certificate and exact peer/port checks remain. Fresh agent; no ambient key, session, cookie or proxy loading. Native and injected I/O remain distinct. Redirects, interim responses, upgrades, compression, partial representation headers, unsupported/duplicate headers and wrong status fail closed. Native16KiB headers, checked100pairs, explicit raw body and8,192event limits, complete strict UTF-8 body, cancellation and wall-clock/monotonic deadline remain enforced.

The internal wire result says `media_and_utf8_only_unreviewed`. JSON/schema validation belongs to its adapter. A wire result alone cannot authorize native source publication. Its in-process identity/deadline remain checkable after network cleanup; copied or forged objects fail. Native response identity is not independent attestation against the trusted local runtime/operator/CA/DNS. Full adapter validation stays inside the original deadline through direct guards. No background request or source persistence occurs.

## Release checks and dates

The adapter bounds JSON depth8, nodes2,048, object entries80, array entries100 and strings20,000characters before extracting fields. It supports known top-level fields, a positive safe release ID, exact repository/ID/tag URLs, full-release booleans, bounded literal name/announcement and at most20asset entries. Extra author/asset metadata remains bounded, uninterpreted raw data. It follows no asset, archive, author/profile, announcement link or reference. Markdown/HTML/instructions remain literal text with no tool authority.

It preserves exact received JSON bytes/hash and supported release identity, name/tag, selected API version and actual start/retrieval/finish clocks. Announcement output is a byte count/hash and literal-format label, without another copy of the announcement text. A receipt helper omits raw JSON text; there is no persisted receipt reader or release source policy yet.

`published_at`, `created_at` and provider `updated_at` each retain the original string, canonical UTC representation and second/millisecond precision. Invalid/future/unknown supported dates fail closed. Commit creation and provider update are not publication. `materialUpdatedAt` staysnull because the helper does not independently establish which material changed. Retrieval or a later provider update cannot refresh old publication. The raw body remains available only as unreviewed input.

The frozen result labels one English Node.js/software-release scope. A global tag does not imply each country, language, user group or supported app. Publication freshness/source applicability/semantic support still need later context assessment. No trend, adoption, buying psychology, investor intent or current global awareness is established.

Actual native adapter results have separate in-process identity and monotonic start. Injected/copy/JSON flags cannot pass it, and a release capture cannot use the existing population source writer. No implicit cast, source promotion or model tool is added.

## Next delivery

Add supported release-source storage and historical reconstruction, stable release-ID citation, correction preflight and one publication attempt. The mutable latest endpoint returning a different release ID must not supersede an older release. Preserve old manual/v1 and population/v2 bytes. Version snapshot boundaries when needed. Then expose explicit terminal release collection, wider permitted primary sources, packet2/per-source processing, dated report/web coverage and human-reviewed retrieval/usefulness evaluation.
