# Bounded analyst HTTP transport

Version 0.33.0 adds `createOpenAIAnalystTransport` in `src/analyst-transport.ts`. It connects one checked preparation to matching durable analyst phases. Tests use injected fake fetch and actual task/budget stores. No live provider run, terminal/API analyst execution command, result publication or analyst recovery is implemented by this slice.

## Inputs and requests

The constructor requires a fresh `prepareAnalystRun` result and an explicit credential. It loads no environment or key file. The key stays in a closure and the Authorization header. It refuses a request containing that known credential. No model, rate, endpoint, source or tool is selected from brief instructions.

It checks manifest/configuration/generation/instructions/schema hashes, exact packet/source identity and reconstructed strict schema. It copies request bodies before asynchronous work. `AnalystInvocations.assertManifest` binds the exact run/task/manifest to the active phase owner. One transport instance can run once; durable phase records separately prevent replay through another instance.

Both phases send the same model, instructions, serialized packet, strict text schema, empty tool list, no tool choice and disabled truncation. Generation adds the configured output ceiling, `store: false`, `stream: false` and `background: false`. No conversation, previous response, tool execution or source-reference fetching is supplied. Count and generation use only the fixed OpenAI Responses endpoints. Fetch uses `redirect: error`; there is no application retry or continuation loop.

The official [count reference](https://developers.openai.com/api/reference/typescript/resources/responses/subresources/input_tokens/methods/count) describes the count endpoint and returned object/count. The [count guide](https://developers.openai.com/api/docs/guides/token-counting) explains why full instructions and schemas must be counted together. The [Responses reference](https://developers.openai.com/api/reference/typescript/resources/responses/methods/create) and its expanded parameter schema were checked for request flags and usage/output shapes. Output limits include visible and reasoning tokens. No current price, model availability, account permission or storage guarantee is inferred.

Request hashes cover exact compact HTTP bodies, excluding credential headers. Count response hash and generation envelope hash are factual byte identities. They do not authenticate local records or prove provider/model execution when fetch is injected.

## Bounds and cleanup

Each request body is at most 220,000 bytes. Count response is at most 16,384 bytes; generation envelope is at most 1,000,000 bytes. Each body allows at most 8,192 reads, including empty chunks. Direct deadline checks prevent a rapid empty-chunk stream from starving a timer. Analytical output has a separate 32,768-byte UTF-8 bound. Excess content is refused without truncation.

Fetch and each body read race the inference signal owned by durable phase accounting. Late fetch responses are cancelled; incomplete readers are cancelled and unlocked without awaiting a stalled cancellation. A provider or injected transport can still ignore abort. Discarded or incomplete envelopes keep spend unknown. Already parsed trusted receipts may settle through accounting even when final source/ownership checks block delivery. No interrupted candidate can later reach the caller.

UTF-8 decoding is strict. Invalid JSON, missing/nonobject envelopes, failed HTTP, observed redirects/unexpected response URLs, invalid counts and interrupted phases have static reason codes. Network failures do not infer a more precise cause. Provider error bodies and exception text are excluded from results.

## Usage and analytical output

Generation usage comes only from the successful transport envelope. It requires the expected response object, a bounded response identity, an exact configured model match, nonnegative safe input/output/total integers, consistent totals and representable integer cost. Decimal configured rates use ceiling arithmetic. Missing, contradictory, overflowing or different-model usage remains unknown; it is never assumed free. Exact model matching deliberately does not accept an unverified alias-to-snapshot change.

Known usage settles even when output is refused, incomplete, malformed or fails citation checks. An actual reservation overrun remains recorded and closes dispatch. A successful count still holds its separate cap; its token count is not a billing receipt. Rates remain configured estimates, not independently measured charges or provider billing caps.

Only one completed assistant message with bounded text is eligible. Unknown/tool output items and external annotations are rejected. Reasoning items are ignored and never returned. Refusal, incomplete status, usage gaps, count/usage mismatch and invalid analytical output produce rejected results with no checked candidate. The official [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) documents refusal/incomplete cases and possible mistakes despite format conformance.

The exact local response checker validates structure, supplied-field citations and abstention. The returned check projects response, check status and uncovered tracks; it omits the standalone checker's no-model-execution boundary because provider work has a separate scope. Reasoning and proposed protocols remain unreviewed, research validity is not established, and no human buying/investment conclusion is validated.

## Verification and next integration

Twenty-three authored tests cover idea/app payload and source identity, headers/hashes, private credentials, manifest binding, phase order/no retry, count/body/UTF-8/read/time bounds, source loss between phases, refusal/incomplete/unknown usage, model/count/output mismatch, overflow/overrun, invalid JSON/citations/tools/annotations, hidden reasoning, stalled fetch/body cancellation and known spend after source denial. They use fake provider responses and do not prove live compatibility.

The next coordinator must save and verify exact compact manifest bytes, acquire ownership, perform full current-source checks around dispatch/response/publication, and exclusively publish factual unreviewed analytical records. Analyst-specific recovery must inspect its own artifacts/tasks/budgets; actor recovery cannot accept them. First valid publication wins, with no replay or orphan adoption. Semantic review and a separately configured live check remain open.
