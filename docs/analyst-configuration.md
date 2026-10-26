# Analyst configuration and unwritten manifest

Version 0.31.0 adds typed internal helpers in `src/analyst-config.ts`. They prepare public configuration and a source-bound manifest for later runtime integration. No terminal/API run route, provider dispatch, task, ledger or result is added by these helpers. Version0.44 adds a separate [context configuration/unwritten plan](context-analyst-configuration.md); only pure public resource parsing is shared, with no v1 processing remapping. Existing terminal `analysis prepare` still returns its model-independent generation preview.

`parseAnalystConfiguration(value)` requires exact plain data properties. It refuses missing/extra fields, accessors, hidden fields, symbols, custom prototypes and credential/endpoint/tool fields. It copies and deeply freezes normalized public data. It reads no environment or key. This is separate from actor configuration and research processing permission.

## Required fields

| Field | Contract |
|---|---|
| schemaVersion / kind | `1.0` / `analyst_configuration` |
| provider / model | `openai` and an explicit bounded model identifier; no automatic selection or live compatibility claim |
| pricing | Explicit positive USD-per-million decimal strings, at most six decimal places; canonical decimal output, integer arithmetic |
| processing | Exact external provider/scope, brief UUID, packet SHA-256, `authorized: true`, nonblank one-line basis at most 500 characters and canonical UTC millisecond expiry |
| limits | Explicit maximum input/output, separate count and generation token/cost caps, timeout and finalization |
| taskPolicy | Explicit lease/heartbeat under the existing analyst ownership policy |

The processing scope is `exact_brief_packet_and_generation`. It records the operator's declaration for that exact context and destination. It does not independently verify legal rights, consent, provider terms or research permission. It authorizes no URL/file-reference fetch, target execution, unrelated source, participant record or actor model. Later dispatch must recheck exact current source and authority.

Maximum input and output each have a local ceiling of 1,000,000 tokens. Output has a local minimum of 16 tokens. These are local planning bounds, not a model's supported context or recommended settings. Timeout is 1–300,000 ms; finalization is 1–10,000 ms. The finalization allowance cannot increase inference time, tokens or cost.

Each phase cap requires positive safe integer tokens and micro-USD. The count cap covers at least maximum input; the generation cap covers at least maximum input plus output. Estimated worst-case generation cost must fit its phase cap. Calculation uses integer products and ceiling division by 1,000,000. Unsafe precision or combined cost overflow is refused. The total cap is the sum of both phase caps; held count liability cannot be silently reused for generation.

Counting also transmits the full context. Its separate positive cap is an explicit operator liability bound; the helper does not infer a zero charge, measured spend or a provider-enforced billing cap. Rate strings and estimates are supplied inputs, not verified current prices. A future transport must preserve unknown count liability unless a suitable authenticated receipt resolves it. A returned token count alone is not a cost receipt.

## Manifest preparation

`prepareAnalystRun(store, briefId, configuration)` copies configuration before awaiting source reads. It prepares checked generation data, verifies exact processing identity, then fully re-reads the packet and requires unchanged identity. The processing declaration must remain valid through the complete inference plus finalization window, measured after those reads.

The unwritten manifest binds generated run/task UUIDs, one attempt, question key, preparation/inference/coordinator times, exact source metadata and packet hash, instructions/schema/generation-preview/generation-payload hashes, normalized configuration/hash, phase and total caps, estimated generation maximum and response bounds. The preparation includes exact generation data and the compact manifest SHA-256. All public data is deeply frozen. Pretty preparation plus newline cannot exceed 220,000 bytes; nothing is truncated.

The generation payload remains model-independent instructions/input/schema. Its hash is not a complete HTTP request hash. The selected provider/model are separately bound through configuration. No request is constructed or sent, and no manifest is saved. A later coordinator must save and verify the exact manifest bytes before acquiring ownership. Hashes are consistency checks, not independent attestation against a local operator who controls records.

`examples/analyst-configuration.input.json` is deliberately unavailable: permission is false, expiry is past and source/model identifiers are placeholders. Its rate/cap values are authored examples, not current prices or recommended budgets. Replace them from actual authorized configuration before future use. No command consumes this template yet.

Ten authored tests check descriptor-safe parsing and frozen copies, exact processing declarations, separate liability caps, rounding/overflow, idea/app source/hash/deadline/cap manifests without state/network effects, expired/wrong sources, mutation during asynchronous reads and changed bytes before or between full reads. Installed verification exercises the compiled helpers. These are software checks; no analytical conclusion, human observation, predictive validity or commercial demand is established.

Next: analyst-specific bounded transport and durable per-transmission reservations, source/authority checks at dispatch and after response, refusal/incomplete/invalid-output handling, exclusive publication and factual recovery. The [ownership handle](analyst-task.md) is available; semantic review remains a separate I04c gate.

Version 0.32.0 adds [durable phase accounting](analyst-invocations.md) for later coordinator integration. Preparation itself still creates no task, ledger or callback.
