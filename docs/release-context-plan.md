# Next I05c adapter: primary software release context

After0.38, the bounded population retrieval/storage/terminal path is ready. The next useful context slice should capture a dated primary release announcement. It must not imply general news coverage. Version0.39 implements shared fixed-target transport and the internal native release helper; `docs/node-release-context.md` records the delivered contract. Release storage/reader/correction/snapshots and terminal integration remain next. This plan grants no source rights by itself.

## Candidate and retrieved documentation

Start with the public Node.js repository's GitHub release metadata/body. The official [Node.js website](https://nodejs.org/en/about/previous-releases) links its contribution workflow to `nodejs/node`. The [GitHub release API](https://docs.github.com/en/rest/releases/releases#get-the-latest-release) documents an unauthenticated public latest-release GET, response identity/body and publication fields. Latest-release ordering uses creation/commit semantics and excludes drafts/prereleases; it must not be labeled the newest publication or an applicable supported version for every app.

The inspected documentation examples currently use `X-GitHub-Api-Version: 2026-03-10`, even when the requested documentation URL supplied an older apiVersion parameter. Verify the selected version against explicit current documentation and an actual smoke before hard-coding it. Do not assume the URL parameter selected the rendered contract.

[Unauthenticated rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) apply by originating IP and are documented as60requests/hour. There may also be secondary limits. A denied request stays unavailable; no automatic wait/retry, token fallback, proxy rotation or credential load. [API terms](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#h-api-terms) require compliant use and restrict excessive/abusive requests. Public access is not blanket content/model/training/redistribution permission. Keep explicit operator local-use declarations and inspect source-specific terms before a real smoke.

## Proposed implementation

First extract a bounded native JSON transport behind trusted fixed adapter descriptors. Preserve World Bank URLs, payload/receipt policy, native identity, test provenance and historical records exactly. The transport must revalidate the constructed allowed host/path rather than accept an arbitrary endpoint. Native and injected modes remain distinct. Reuse dedicated cancellable DNS, pinned public IPv4, original TLS authority, no proxy/key/cookie, one GET, no redirect/retry, size/event/header/deadline/cancellation limits and static errors. Keep allowed hosts and request headers explicit per adapter; no broad generic network tool.

Then add one fixed `nodejs/node` latest-full-release GET to `api.github.com`. No arbitrary owner/repository/endpoint or private source query in the first adapter. Fix documented Accept/API-version/user-agent headers. Require200/identity UTF-8 JSON and bound raw response, nested arrays/objects, URLs and body text. Do not follow assets, tarball/zip/download URLs, links, author profiles or references embedded in release text. Do not render Markdown as HTML or execute instructions. A release body is publisher-provided announcement text, not an inspected destination article, security adjudication or evidence about users.

Keep an explicit supported release-capture record policy. Reconstruct exact metadata/receipt/raw bytes without casting the World Bank policy. Native publication still requires actual in-process identity and one publication attempt. Manual and injected records cannot claim native observations. Historical reading is a local recorded claim, not independent network attestation.

Use actual release ID/repository identity as stable citation identity. The mutable latest endpoint can later return a different release. Such a response must not supersede a prior release ID. Compare after capture and before publication; return a conflict and require explicit new-source intent. A new observation of the same release may create a new immutable version under existing current-source checks.

Preserve raw `published_at`, `created_at` and any supported material update separately. Use only a documented publication instant for publication freshness. A commit/asset update is not the release publication or material update. Keep original timestamp strings and precision when normalizing canonical UTC representation. Null, future or unsupported dates remain unavailable/unknown according to the existing policy. A later retrieval or changed body cannot refresh old publication time.

Tag English/software/Node.js scope explicitly; a global provider tag does not imply every country/language or market. Show one-source and language gaps. A release announcement does not establish adoption, buying psychology, investment intent, a validated trend or a security finding. The existing trend minimum and semantic-review boundaries remain enforced.

## Required verification

Run all existing collector/source/snapshot tests and old installed0.36 manual/v1 plus0.38 native/v2 compatibility. Add fake failures for host/header/identity/version/status/rate/schema drift, unbounded nested data, null/missing body/dates, future data, mutable latest selection, edits, embedded instructions/links, false native flags, cancellation and publication/state races. Preserve current source rights, local-only purpose and exact source-policy pins. If snapshot boundaries change, version them rather than rewriting old v2 expectations.

Perform one actual permitted native source/installed release capture after implementation. Record exact bytes, dates, ID, policy and limited scope under ignored local proofs. A browser/web documentation fetch is not a Redteam product smoke. If no supported release or permitted text is available, record that factual blocker and continue independent analyst/report work.

Then add additional permitted primary feeds/discovery, region/language and conflicting-source coverage, packet2/per-source external processing, dated report/web views and frozen human-reviewed retrieval/usefulness evaluation. No complete/perfect global awareness is enabled by this adapter alone.
