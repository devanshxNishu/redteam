# Bounded public context collector

Version0.37 adds the internal `collectPublicContext(input, signal?)` helper in `dist/context-collector.js`. It retrieves one small World Bank population response. It does not create a source record, snapshot, review, task, budget or access grant. There is no collection CLI, API, web control or scheduled feed yet. Existing manual source records and brief-only analytical packets are unchanged.

## Supported input

The strict `public_context_collection_input` schema requires `schemaVersion: "1.0"` and `adapter: "world_bank_population_v1"`. Supply a three-letter uppercase provider country/economy code and `years: {first, last}`. Years must be1960 or later, at most the current UTC year, and cover at most10years. A code is a provider query identifier, not a validated market or population segment. Aggregates remain possible.

`permissions` requires `collect: true`, `localReview: true`, a bounded nonempty `basis`, and canonical UTC `expiresAt` later than the entire configured deadline. `externalProcessing`, `redistribution` and `training` must all befalse. These are explicit operator declarations; the software does not authenticate the operator's rights or erase delivered copies after expiry. The packaged example has disabled permission and past dates. It performs no collection until an operator supplies valid authorized input.

`limits.timeoutMs` is250–30,000milliseconds. `limits.maximumBytes` is1–32,768bytes. No URL, credential, arbitrary header, proxy, method, indicator, source, callback, language or pagination field is accepted. The adapter constructs one HTTPS URL for `api.worldbank.org`, port443, English, World Development Indicators source2, indicator `SP.POP.TOTL`, exact requested years, page1 and per_page10. No private brief content enters this public query.

The World Bank documents [key-free API access](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation) and [JSON, dates and page parameters](https://datahelpdesk.worldbank.org/knowledgebase/articles/898581-api-basic-call-structures). The [population indicator page](https://data.worldbank.org/indicator/SP.POP.TOTL) labels its license. [Dataset terms](https://www.worldbank.org/ext/en/legal/terms-conditions/datasets) include attribution, additional conditions and third-party exceptions. This adapter does not infer blanket rights for other indicators or enable external processing, redistribution or training.

## Network and resource limits

Each invocation uses a dedicated cancellable IPv4 DNS resolver and one HTTPS GET. It allows no application retry, redirect, automatic next page or fallback address. At most16 returned addresses are accepted. All answers must pass the fixed `public-ipv4-iana-2025-10-09-v1` policy. It rejects every special-purpose block in the inspected [IANA registry](https://www.iana.org/assignments/iana-ipv4-special-registry/), including globally reachable exceptions, plus multicast. IPv6-only or mixed unsafe answers are unavailable. Registry changes require policy review.

The first permitted address is pinned into lookup. The original hostname remains the Host/TLS name and native certificate verification stays enabled. The connected peer must match the pinned address, IPv4, authenticated TLS and port443. `agent: false` supplies a fresh connection. No environment proxy, cookie, key, session, client certificate or custom agent is loaded by this helper. The trusted runtime, CA configuration, operating-system DNS servers, network and local code remain boundaries. The policy is not a production egress sandbox or independent DNS/publisher attestation. One logical DNS resolution can involve several wire queries or configured nameservers; the count does not claim one DNS packet.

Only status200 and uncompressed UTF-8 `application/json` are accepted. Interim responses, protocol upgrades, partial representation headers, duplicate selected headers, unsupported encoding and malformed metadata fail closed. Native response headers are limited to16KiB; the helper also checks the raw header size and100-pair bound. The request asks for identity encoding. The collector keeps at most8,192body events and the explicit maximum body bytes. Empty chunks cannot extend the event limit. It rejects incomplete, empty, invalid UTF-8, BOM-prefixed JSON, wrong-length, malformed or unsupported responses without truncation.

One wall-clock and monotonic deadline spans DNS, TLS, body and validation. Cancellation destroys owned HTTP streams, cancels the dedicated resolver and clears the overall timer/caller listener. Errors expose only a fixed message and supported code; they contain no remote response or exception details. Rejected bodies are not published. No partial capture or retry is promoted after failure. A local runtime or operating-system stall can delay scheduling; these controls do not promise a precise real-time deadline.

The implementation uses [Node24 HTTPS](https://nodejs.org/download/release/v24.16.0/docs/api/https.html), [HTTP request and abort controls](https://nodejs.org/download/release/v24.16.0/docs/api/http.html), and [per-resolver DNS cancellation](https://nodejs.org/download/release/v24.16.0/docs/api/dns.html). Socket timeout alone does not implement the overall cancellation policy.

## Capture identity and interpretation

The frozen result contains the exact received UTF-8 JSON text, byte count and SHA-256, constructed URL, copied input/hash, actual start/retrieval/finish clocks, selected response headers, connected IPv4 address and transport policy. Only Content-Type, Content-Length, Date and Last-Modified are returned. Other response headers, including cookies, are excluded. Received strings remain untrusted data with no tool authority.

The parser accepts one matching source/indicator/country annual series, no pagination, at most10 distinct requested years and consistent counts. Missing years are listed. Null values remain null; numeric zero stays zero. Provider labels, units and observation status are preserved. Population values must be nonnegative safe integers. Schema drift is unavailable until reviewed. A provider's country label or observation is not independent fact authentication.

The provider's `lastupdated` remains a date with `date_only` precision. Annual observations remain years. `publishedAt` staysnull. Neither HTTP dates nor actual retrieval create an exact publication instant or fresh current-context eligibility. No trend, demand, psychology, purchase or investment conclusion is generated.

`collectPublicContext` uses native runtime HTTPS. The separate trusted test factory `createInjectedContextCollector(io)` always labels its output `injected_test_io` and `simulated_unverified`. Only an actual result object from the native helper passes `assertNativeContextCapture`; a serialized, copied or forged flag cannot pass the in-process WeakSet check. This is local process identity, not durable attestation against a machine owner who controls the runtime.

## Delivery and next work

This release verifies native public dataset retrieval and failure controls. Authored tests do not count as actual news or research. The actual capture proof is kept under ignored local outputs; it is not a news feed or a researched stakeholder model.

Next add a separate captured-source storage policy, exact checked reading, current local-use checks and terminal collection. Manual import must continue to reject claimed collector provenance. Then add permitted news discovery/feeds, per-source processing in packet2, dated report/web coverage, and frozen human-reviewed retrieval/usefulness evaluation. The first dataset capture does not complete I05c or establish current global awareness.
