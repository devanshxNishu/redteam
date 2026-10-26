# Checked brief packets and analytical response checks

Version 0.28.0 implements I04a through the terminal. It prepares supplied context for later analysis and checks a separately supplied analytical response. It does not call an analyst, model, tool, target, consumer or investor. There is no new review result, approval, job, artifact publication, action, experiment or actor run.

Version 0.41 adds a separate [local packet2/context check](context-analysis.md). This v1 contract and existing analyst generation/configuration remain unchanged. Packet2 is not dispatchable.

## Terminal

Create a saved idea or app brief first. Then:

```sh
redteam analysis packet BRIEF_ID
redteam analysis check BRIEF_ID ./analytical-response.input.json
```

Both commands use the current workspace. Packet prints a deterministic packet from a fully checked brief. Check reads the explicitly named response JSON, builds a checked packet, validates response structure/references, and re-reads the source before returning. It prints an `analytical_response_check` envelope; it does not register the response as an accepted review. Existing workspace/store setup can occur when the CLI opens it; these operations add no packet/result/audit record. Invalid command shapes are refused. Only `briefs preview FILE` has the separate no-workspace promise.

Find `analytical-response.input.json` with `redteam examples`. Its zero IDs/hashes are placeholders; replace them with the actual packet identity. It is an authored format/abstention example, not generated analysis. A hand-edited response does not become a model run because it passes checks.

## Packet

Policy `brief-analysis-v1` binds the brief ID, brief policy/local creation time/subject type, exact publication SHA-256 and normalized input SHA-256. The packet has no new clock or random ID. `packetSha256` is SHA-256 of the compact JSON base before that hash is appended, using the fixed emitted field order. It is deterministic within this policy and exact source; this is not a general external JSON canonicalization or authenticity standard.

Stable field IDs are JSON-pointer-style local references such as `/idea/problem`, `/app/journey`, `/audience/buyers`, `/assumptions/0` or `/suppliedEvidence/0/reference`. They are not paths that a file loader follows. A reference is stable within the frozen brief; a new brief can have different list identities. Field hash binds its ID, state, provenance and exact value in fixed compact JSON order.

Each field is supplied text, an explicit unknown or an empty list. Empty lists receive a single explicit marker; nonempty lists preserve each entry and order. Evidence/URL reference slots remain `supplied_reference_unopened`, including an explicitly unknown reference. Other text is `operator_supplied_unverified`. Null and empty-list states are distinct. No field or unsupported population attribute is invented. A country/language is supplied context, not a psychological model.

The packet includes only the selected brief, fixed bounds and limitations. No private catalog/directory, session, credential, research vault, actor data or unrelated review is added automatically. Supplied text can itself contain private data, including a supplied path. No universal secret detector is claimed. URL and file references stay literal; they are not opened.

At most 80 fields and 100,000 bytes of the pretty JSON plus final newline are permitted. Excess content is rejected, not silently truncated or split. These byte/field bounds are separate from token, cost and time limits; there is no provider dispatch here. Deeply frozen emitted packet metadata/fields and hashes prevent accidental in-process mutation, not a hostile local operator.

## Response contract

Required exact fields:

- `schemaVersion: "1.0"`, `kind: "analytical_review_response"`, `mode: "analytical_only"`, `reviewStatus: "unreviewed"`.
- `briefId` and `packetSha256` equal the checked packet.
- `concerns`: zero to twelve entries; `abstention`: a nonblank reason up to 1,000 characters or `null`. Zero concerns require a reason and do not mean no issues.

Each concern has exactly:

| Field | Rule |
|---|---|
| `id` | Unique `C` plus two digits, such as `C01` |
| `track` | `product`, `engineering`, `customer_buyer`, `commercial`, `investor_preparation`, or `verification` |
| `type` | `assumption_risk`, `evidence_gap`, or `consistency_question` |
| `statement`, `whyItMatters` | Nonblank, at most 1,000 characters each |
| `basis` | One to six unique `{fieldId, fieldSha256}` citations matching exact packet fields |
| `priority` | `now`, `next`, or `later`; a supplied analytical ordering, not a measured score |
| `priorityReason` | Nonblank, at most 500 characters |
| `nextCheck` | Exactly `question`, `method`, `successRule` (each nonblank, at most 1,000 characters) and `protocolStatus: "unreviewed"` |

Canonical compact response JSON is at most 32,768 UTF-8 bytes. The explicitly supplied response file has the same byte bound including its formatting. Field text permits LF/tab but rejects other control characters. Unknown fields, changed/missing identities, unsupported result types, self-approval, claimed numeric confidence/funding fields, unresolved/changed/duplicate citations, getters, serializers, symbols, custom inherited objects and sparse/extra arrays are refused without invoking ordinary accessor/serializer fields.

The response reader uses the existing bounded regular single-link/no-follow/canonical-parent/consistent-file rules and valid UTF-8 JSON. It opens only that response file. It is not a reference crawler. Pure library validation expects a packet returned by the checked workspace reader; it does not authenticate externally supplied packets. Managed stored checks re-read the brief and require the same packet hash before printing.

## Meaning and limits

The result separately states `structure: passed`, `citations: matched_to_supplied_fields`, `semanticReview: unreviewed` and `researchValidity: not_established`. Uncovered tracks are explicit. Proposed checks stay unreviewed protocols. No operator declaration, experiment plan, source record or action is promoted.

A citation match establishes that supplied text exists. It does not establish truth, independent evidence, relevance, feasibility, correct reasoning or a researched person's reaction. Free text can still contain unsupported predictions despite a valid schema. This checker is not a semantic classifier and cannot certify their absence. The response remains unreviewed; semantic review/adversarial evaluation is a separate requirement.

The packet does not turn an app URL into a tested app. Do not attach unrelated local fixture results to another app. Actual findings need established target/build/journey/requirement association, granted execution, recorded evidence and independent verification. No researched psychology, population behavior, customer demand, purchase, investment commitment, funding probability or commercial validity is established by this milestone.

Local clocks/operator/metadata/filesystem and copies/backups remain trusted boundaries. Hashes provide consistency, not signatures or independent timestamps. Source checks and file delivery are not one atomic transaction; delivered copies cannot be recalled. I04b separately configured bounded analysis, I04c semantic review/report and wider research/commercial/isolation/hierarchy gates remain open.
