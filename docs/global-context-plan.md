# Global news and trend context

User requirement, October 26, 2026: Redteam must use relevant global news and trends when it reviews an idea or app. This is a required development track. Version 0.34.0 records the design. Version0.35 implements [I05a supplied metadata checks](global-context.md); version0.36 adds [I05b explicit local source records and snapshots](context-records.md). Version0.37 adds the [internal bounded World Bank population collector](context-collector.md), verified with native HTTPS. Version0.38 adds [checked captured-source storage and terminal collection](context-collection.md), immutable native receipts, compatible snapshots and current correction/withdrawal controls. Version0.39 adds the internal native Node.js primary-release helper with checked dates/API version. Version0.40 adds checked release-source storage, stable-ID correction/withdrawal, deliberate terminal collection and compatible v3 snapshots. Version 0.41 adds I05d1 local packet2 and typed supplied-response checks over exact snapshots; external-processing/runtime integration and wider news remain open. Version0.42 adds separate source-specific processing declarations with exact packet/provider/model, expiry and revocation; context generation/dispatch integration remains open. Current global coverage is not established.

## Product behavior

Each review gets a dated context brief for its decision, sector, users and target markets. It covers relevant changes in technology, competitors, customer constraints, economic conditions, policy and investment conditions. The review shows what was checked, when, where and in which languages. It names missing coverage. No review claims complete world knowledge or a perfect decision.

Each material claim needs an inspected source and a clear connection to the product decision. The report separates source statements, corroboration, contradictions, forecasts, supplied assumptions and the analyst's inference. A recent headline alone cannot establish a trend, customer demand, population psychology or investor intent.

## Evidence flow

1. Define the review scope, public research topics, target regions/languages and a fixed as-of time. Keep private brief contents out of public search unless separately authorized.
2. Discover candidate sources through configured public search, permitted feeds and official datasets. Store the query, retrieval time, provider and coverage limits. A discovery result is not inspected evidence.
3. Read permitted material through bounded collectors. Save the original URL, resolved URL, publisher, title, source class, language, geographic applicability and exact permitted bytes/hash. Save only metadata when content rights or access are absent.
4. Keep publication time, correction/update time, event time, data observation period and retrieval time as separate fields. Unknown dates stay unknown. A new retrieval does not make an old event new.
5. Deduplicate syndicated stories and shared source chains. Record origin relationships. Several copies of one announcement do not become independent corroboration.
6. Check material claims against direct sources where possible. Retain contrary evidence and corrections. Company announcements show what that company states; they do not independently prove performance or adoption.
7. Build an immutable, bounded context snapshot. Link exact claim/source identities, scope, dates, freshness policy, unresolved conflicts and missing coverage. Freeze the snapshot into the review's analytical packet before inference.
8. Recheck current access, source status and applicable freshness before new use. A later update creates a new snapshot; it does not rewrite a historical report. Reports carry their original as-of time and can be marked as needing refresh.

The Atom standard defines distinct publication and update metadata; collectors must preserve that distinction rather than treating feed order as event time. See [RFC 4287](https://www.rfc-editor.org/rfc/rfc4287.txt). Crawlers must respect applicable publisher controls and terms. Robots rules are not access authorization; see [RFC 9309](https://www.rfc-editor.org/info/rfc9309/). Feed metadata and operator declarations do not authenticate a claim or grant training rights.

## Shared context and review roles

Use one checked snapshot per review. Product, engineering, buyer, commercial and investor lenses receive only relevant, permitted entries with exact citations. A future context researcher can collect evidence. A separate verifier checks source support and conflicts. Reusing the same snapshot avoids giving each agent a different unrecorded news history. Specialist/subagent execution still needs the existing scheduling, cost, isolation and release gates.

| Lens | Useful context | Required limit |
|---|---|---|
| Product | Changes in user problems, alternatives, distribution and competitor releases | Coverage and market relevance remain explicit |
| Engineering | Platform changes, vendor support, technical releases and security notices | Verify the applicable version and tested app; news is not reproduced app evidence |
| Consumer/buyer | Local prices, payment access, purchasing constraints and credible research | No country-wide personality or willingness-to-pay inference from headlines |
| Commercial | Acquisition conditions, operating inputs and demand indicators | Report indicators and uncertainty; do not invent sales or demand |
| Investor preparation | Published mandates, funding conditions, comparable disclosures and diligence needs | No named investor impersonation, commitment or funding probability |
| Verification | Primary support, corrections, source chains, disagreement and missing regions | May reject unsupported or stale current claims |

## Freshness and coverage policy

Freshness depends on the question. Breaking events, platform/API details, prices and security notices need short configured windows. Slow research and datasets need their own release and observation-period rules. Record policy values and version in each snapshot. Initial values are operating hypotheses to evaluate, not claims of scientific validity.

Check the source's material publication/update date as well as retrieval age. Unknown, future, stale, withdrawn and metadata-only entries cannot silently support a current claim. A review with no relevant current evidence must say `current context unavailable` or `limited coverage`. Old material can remain labeled historical background. Future-dated material is ineligible at a frozen as-of time; this also prevents retrospective evaluation leakage.

Request specific regions and languages. Global applicability must be justified from the material; publisher country is not audience geography. Show missing region/language/topic cells. Search rank, English-language volume and article count are not population weights. Quantitative trend claims require suitable data periods, units, revisions, methodology and an explicit inference rule. Forecasts and weak signals stay labeled.

## Collection, storage and authority

Use explicit configured collectors with time, request, byte, source and cost limits. Keep discovery and inspected evidence separate. No fixed search/news provider, paid subscription, model, price or broad browser permission is selected by this plan. Authenticated/licensed collection needs actual configuration. Failures and partial results remain visible.

Treat remote content as untrusted data. It cannot add tools, change prompts, choose endpoints, run code, read local files, load credentials or grant processing rights. Collection must prevent local/private-network access, unsafe URL schemes, credential-bearing URLs and unchecked redirects. XML parsers must disable external entities and enforce depth/size bounds. Do not bypass paywalls, logins or publisher controls. Keep bounded permitted text and source links; content unavailable for lawful storage/use stays metadata-only. Source access, use for review, external model processing and model training are separate purposes.

Store versioned local evidence and context snapshots before enabling analyst retrieval. Source corrections and withdrawal must affect new use and checked delivery. Local hashes record byte identity under the trusted operator; they do not authenticate independent news, research or a real-world event. No private research/participant records enter public news search or exports by default.

## Delivery sequence and release gates

| Step | Ready work | Required verification |
|---|---|---|
| I05a, implemented0.35 | Strict supplied source/claim/scope/freshness policy and deterministic terminal metadata assessment; no source authentication | Stale/unknown/future dates, metadata-only sources, wrong region/language/topic, duplicate origins, conflict and look-ahead cases |
| I05b, implemented0.36 | Explicit imported text/versioned source registry and immutable checked snapshots with terminal operations | Exact bytes/citations, current access, bounded private storage, tamper/unsafe-file denial, no automatic fetch or execution |
| I05c, population0.37–0.38 and release0.39–0.40 | Native bounded population and primary Node.js release capture, separate checked source policies, snapshots and deliberate terminal paths; discovery and more providers remain | Real permitted public smoke plus fake failures, limits, redirects/private-network defense, stable release-ID correction, withdrawal and old policy/byte preservation |
| I05d1, implemented 0.41 | Explicit local packet2 over the exact snapshot, complete literal sources, frozen coverage/dates and typed supplied-response citations | Old brief packet/generation and snapshot compatibility, exact source pairs, source loss, bounded untrusted text and no dispatch |
| I05d2, records implemented 0.42; runtime open | Explicit source-specific processing declarations, then versioned generation/configuration/manifest/task/transport integration | Exact source/purpose/provider/model/basis/expiry, current withdrawal, complete payload/budget binding and no v1 policy casting |
| I05e | Context-aware terminal/web report with dated coverage and refresh status | Exact citations, no unsupported current claims, failed/partial collection and current-access guards |
| I05f | Frozen human-reviewed retrieval and review-usefulness evaluation | Relevance, source support, freshness, coverage, conflicting evidence and zero future leakage; thresholds set before evaluation |

I05a metadata checks and I05b explicit imported-source storage/snapshots are implemented. I05c has native-verified population and primary release collection, separate checked storage policies and deliberate terminal paths. I05d1 now adds a separate local context packet and supplied-response check. I05d2 now adds separate processing declarations without dispatch. Add more permitted sources/discovery and I05d2 generation/provider/runtime integration while bounded analyst coordinator/report/recovery work continues. Do not silently add network access or reinterpret the existing brief-only provider contracts. An actual feed, source pack or model call is reported only after it occurs. Real research, pilot usefulness, paid demand and separate consumer/investor predictive validation remain open.
