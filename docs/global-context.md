# Global context metadata checks

Version 0.35.0 implements I05a through the terminal and the internal `src/global-context.ts` helpers. It assesses supplied metadata against an explicit scope and freshness policy. It collects no news, reads no source content and does not establish current global awareness, source truth or behavioral validity. The full collection and integration sequence remains in [the global context plan](global-context-plan.md).

```sh
redteam context assess FILE
```

Start with `examples/global-context.input.json`. The example has a fixed historical as-of time, illustrative operating windows and no sources or claims. It returns `no_eligible_context`. No live data or research is included. Change the explicit scope/policy and supply your own permitted source metadata before assessment. Policy values are operator choices, not validated thresholds.

## Input

The strict version1.0 `global_context_input` contains `scope`, `policy`, `sources` and `claims`. Scope requires an exact UTC ISO `asOf` and nonempty distinct `regions`, `languages` and `topics`. These are lower-case declared tags, not authenticated geographic applicability, ISO codes or language coverage. Up to6 regions,4 languages and6 topics produce at most144 coverage cells. A `global` region matches only an explicitly requested `global` tag; it does not automatically cover every country. No current time or freshness default is selected.

Policy requires positive integer `maximumRetrievalAgeHours`, all five `maximumPublicationAgeHours` values (`news`, `release`, `research`, `dataset`, `forecast`), and `minimumDeclaredOriginsForTrend` from1 to16. Age limits are at most87,600hours. All bounds are recorded in the result; a permissive supplied policy is not an independent quality approval.

Each source requires these exact fields:

| Field | Meaning |
|---|---|
| `id`, `originId` | Distinct source ID and declared original source chain; bounded lower-case identifiers |
| `kind` | `news`, `release`, `research`, `dataset` or `forecast` |
| `publisher`, `title`, `url` | Supplied publisher/title and HTTP(S) reference without embedded credentials |
| `publishedAt`, `updatedAt`, `eventAt` | Separate canonical UTC timestamps or explicit null for unknown |
| `retrievedAt` | Canonical declared UTC retrieval time |
| `status` | `available`, `withdrawn` or `superseded` |
| `inspection`, `contentSha256` | `declared_inspected` with a64-character lower-case SHA-256, or `metadata_only` with null |
| `regions`, `language`, `topics`, `applicabilityBasis` | Declared applicability; language may be null and region/topic lists may be empty |

Inspection, timestamps, source status, content digest and applicability are operator declarations. This command does not load or authenticate the matching bytes. URL validation is structural; it is not approval to fetch a URL or proof against private-network access. Collectors need their own controls.

Each claim requires distinct `id`, `kind`, bounded single-line `statement`, `sourceIds` and `contradictionSourceIds`. Kinds are `reported_statement`, `trend_hypothesis`, `forecast` or `analyst_inference`. Every reference must name an existing source; lists must be distinct and supporting/contradicting references cannot overlap in this contract. Empty support is allowed and visibly fails source checks. Each reference list permits8 entries; input permits32 sources and32 claims. Unknown fields, accessors, sparse/extended arrays, duplicate identifiers, invalid dates/URLs and unsupported controls are rejected.

## Results

The deeply frozen assessment pins normalized input SHA-256, scope, policy and the supplied as-of time. It checks metadata only. Eligible source metadata requires declared inspection/availability, known timely publication, timely retrieval, no later publication/update/event than the available time, and a matching requested region/language/topic combination. Unknown event time stays a warning. Forecast events may be future-dated but keep `forecast_not_observed_outcome`; future publication or retrieval is still ineligible.

A fresh retrieval or update does not refresh an old publication. News describing an old event is also excluded from current eligibility by its configured news window. Exact age boundaries are inclusive. A later retrieval or correction cannot leak into a frozen earlier assessment. Historical background can be preserved in the input but is not silently admitted as current context.

Origin counts merge declared common origins and identical canonical URLs, ignoring fragments, including transitive chains. Different publishers or IDs do not make a known duplicate independent. Other URL variants and undisclosed shared sources can remain undetected; independent provenance is not authenticated.

Each coverage cell lists eligible source IDs and distinct declared origin groups. Missing cells remain explicit. Each claim checks its references, source eligibility, declared conflicts and the configured trend origin minimum. Contrary references stay visible even when their current source eligibility fails. `met_unreviewed` means only that metadata/reference conditions pass. It never approves the statement, the meaning of a citation, a quantitative trend, a forecast, source independence or stakeholder behavior. Trend validity and forecast accuracy remain `not_assessed`; all semantics remain `unreviewed`.

Outcomes are `no_eligible_context`, `partial_metadata_coverage` or `metadata_checks_passed`. None means a complete world review. The command creates no workspace, saved context snapshot, task, budget, provider request, app test, grant or stakeholder decision. Referenced URLs are never opened. It does not modify a supplied file. One bounded named JSON file is read using strict UTF-8 and canonical-parent/no-follow/normal single-link checks, with a128KiB input cap and512,000-byte output cap. Errors exclude source content.

## Verification and next work

Sixteen authored tests cover copied/frozen deterministic metadata; empty/gapped coverage; stale publication/event/retrieval; future and post-retrieval material; unknown dates; withdrawn/superseded/uninspected records; exact per-kind windows; exact region/language/topic scope; declared and identical-URL transitive duplicates; conflicts; forecasts; unsupported references/fields; accessor/array/size/file-link/UTF-8 guards; and terminal operation without workspace creation or automatic fetch.

Version0.36 adds [I05b explicit imported-source records, current access and immutable snapshots](context-records.md). This is exact local text integrity, not publisher authentication or actual collection. I05c must add actual permitted bounded discovery/collection before active news awareness can be claimed. A new packet version, per-source processing authority, context-aware report and frozen human-reviewed usefulness tests follow. The existing analytical packet remains supplied-brief-only. News never establishes population psychology, purchase demand, investor commitment or funding probability by itself.
