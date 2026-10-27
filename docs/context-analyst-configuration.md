# Context analyst configuration and unwritten plan

Version0.44 adds internal typed preparation in `src/context-analyst-config.ts`. It binds an exact local context generation preview to a current source-processing declaration and explicit public resource settings. It writes no manifest, creates no task or ledger, reads no credential, and calls no provider. There is no new run command or API route. Local `analysis context-prepare` remains separate and model-independent.

## Separate configuration

`parseContextAnalystConfiguration(value)` accepts exact plain data properties, copies them before asynchronous work, and deeply freezes normalized public data. Unknown fields, hidden/accessor/serializer properties, symbols, keys, endpoints, tools and unsupported processing scopes fail. Named-file reading has a16,000-byte UTF-8 bound and safe single-link rules; it opens no references or workspace.

| Field | Required scope |
|---|---|
| schemaVersion / kind | `2.0` / `context_analyst_configuration` |
| provider / model | `openai` and one explicit model identifier; no default or live availability claim |
| context | Exact snapshot UUID, packet2 SHA256 and complete generation SHA256 from the local preview |
| processing | External mode, scope `exact_context_packet_and_generation`, exact stored authorization UUID/record SHA256 and expectedRevision1 |
| pricing | Explicit positive decimal input/output USD-per-million rates, at most six fraction digits; supplied estimates, not verified prices |
| limits | Explicit maximum input/output, separate positive count/generation token and micro-USD caps, inference timeout and finalization allowance |
| taskPolicy | Explicit bounded lease/heartbeat policy; it acquires no ownership |

A configuration reference is not a processing permission. A caller must supply a matching current [separate source declaration](context-processing.md). No new true/basis field can replace that record. Permission must match exact provider, model, count-and-inference purpose, packet and snapshot; its exact ID/hash/revision stays bound. An expired/revoked record cannot be silently replaced by another declaration for the same packet.

`examples/context-analyst-configuration.input.json` is disabled with expectedRevision0 and placeholder identities. Its rates/caps are authored examples and do not recommend actual settings. No command consumes it yet. Do not infer provider/account/model compatibility or content rights from parsing.

## Resource arithmetic

The existing brief-only parser now shares only pure public resource parsing through `parseAnalystResources` in `src/analyst-config.ts`. This helper does not parse, synthesize, remap or grant processing authority. V1 scope, normalized field order, hashes, instructions and generation remain unchanged.

Input/output local maxima are1,000,000tokens each, output minimum16. Count tokens cover at least maximum input; generation tokens cover maximum input plus output. Separate caps are positive and cannot overflow safe combined cost. Generation maximum cost uses integer multiplication and ceiling division by1,000,000 and must fit its cap. Count cost remains an explicit liability cap and is never assumed free. Timeouts are1–300,000ms, finalization1–10,000ms. Finalization does not add inference time or billing allowance. These are local planning bounds, not model limits, measured spend or provider-enforced billing caps. Actual full payload counting and durable reservations are later gates.

## Checked unwritten manifest

`prepareContextAnalystRun(store, input)` normalizes configuration before awaits, fully reads and checks the named processing declaration, prepares the exact checked local context generation, re-reads the complete packet/files and declaration, and requires unchanged identities. It compares the configured generation hash and exact serialized packet input. Final synchronous checks bind current metadata/rights/state. Source/grant tamper, file loss, unsafe links, expiry, withdrawal, correction, mismatched model or changed generation denies preparation.

Only after full checks does the helper freeze preparation time and inference/coordinator deadlines. The entire inference plus finalization window must fit the declaration's effective expiry, which already cannot extend any local source permission. Equality is allowed; a one-millisecond shortfall fails. A backward local clock before declaration creation also fails. Deadlines do not slide on later checks.

The unwritten schemaVersion2 manifest, policy `brief-context-analyst-run-v1`, binds one-attempt run/task UUIDs, brief, exact snapshot policy/publication/as-of, declaration policy/record/input hash/revision/effective expiry/provider/model/purpose, all source policy/version/lineage/metadata/content/byte/state/local-expiry pins, packet/original brief-packet, complete input/instructions/schema/generation/preview/configuration hashes, separate and summed phase caps, estimated generation maximum and response limits. The manifest has a24,000-byte pretty bound; complete preparation has520,000bytes. Fail excess without truncation. It returns `state: not_started`, `executionAuthority: not_granted` and `manifestSaved: false`; no files, budget, task, result or audit changes occur.

Checked preparation identity is tied to the exact Store object. Copies or flags do not recreate it. Its synchronous guard checks metadata/expiry and frozen inference deadline only; full managed file checks remain necessary before new use. Revocation/source loss invalidates old checked preparations. Replacements need a new explicit ID/hash and new preparation. V1 prepare/saved-manifest paths reject the new contract. Local operator, runtime, clock, filesystem/database, operation races, copies and backups remain trusted boundaries; checks are not a cross-file transaction or independent rights attestation.

## Remaining runtime

Separate versioned saved context manifest publication, receipt-bound pre-ownership verification and task-bound historical data inspection are implemented. Separate context-specific fenced ownership and inference/finalization guards are implemented. Separate original-handle-bound phase accounting is implemented. Next integrate bounded context transport and conservative publication/recovery. Require full current files and authority around each count/inference transmission, response, seal, publication and later delivery; complete payload/schema/token/cost identity and frozen deadlines must match. Do not cast context preparations into v1 or actor paths. No automatic replay, orphan adoption or acceptance from an unpublished seal.

Separately configured live compatibility, wider permitted news, dated report/web, semantic review, human research/usefulness/consumer/investor behavior validation, paid demand and production isolation remain open. This preparation is not a completed review, model result or proof of market demand.

Version0.46 adds [task-bound historical context manifest inspection](context-analyst-manifests.md) through a direct read-only connection to the existing private task registry. It rechecks exact task/spec/file/source pins, preserves ownership and task records, and grants no execution or adoption capability. The0.45 exclusive-publication receipt remains required before new ownership. Version0.47 adds separate [context task ownership](context-analyst-task.md), with original receipt binding, private database preflight, one fenced attempt and distinct frozen inference/finalization windows. Version0.48 adds separate [context phase accounting](context-analyst-invocations.md), with original task/preparation/Store binding, exact private ledger state, positive count liability and late trusted receipt settlement. Bounded context transport, coordinator/report/recovery and live integration remain open.
