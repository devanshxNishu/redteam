# Local context analyst generation preview

Version 0.43 adds the local generation-preparation part of I05d2. It prepares trusted instructions, the exact checked context packet2 as serialized input, and a closed response schema. It creates no provider request or analytical result. Existing brief-only v1 generation and processing contracts remain unchanged.

```sh
redteam analysis context-prepare SNAPSHOT_ID
```

The command requires an exact snapshot UUID and existing private workspace. Use the [context source/snapshot workflow](context-records.md), including supported native population or primary release sources. It does not collect or refresh sources, follow references, read environment model/key values, select a provider/model, acquire ownership, reserve budgets or count tokens. The preview reports `state: not_dispatched`, `processing: local_only_not_dispatchable` and `processingDeclaration: not_checked`.

## Identity, bounds and current access

The separate schemaVersion2.0 / `analyst_generation_preview`, policy `brief-context-analyst-prompt-v1`, binds brief/snapshot/packet identity, original v1 brief-packet hash and snapshot publication hash. It hashes instructions, exact serialized input, schema, complete generation object, and the compact preview base before appending `previewSha256`. The generation format name is `redteam_context_analytical_review_v1`; it is separate from the unchanged v1 brief-only format. Saved IDs, dates and source bytes make preparation deterministic; it adds no clock or random identity.

The complete pretty UTF-8 preview plus newline has a separate 500,000-byte bound. The original packet bound remains 300,000 bytes with at most12sources. A valid packet can still exceed the preview bound after JSON escaping and schema inclusion. Fail without truncating, summarizing, splitting or omitting source text or citation alternatives. Byte bounds are not token counts, billing caps or provider compatibility checks.

Preparation fully re-reads the current brief, snapshot and every source around construction, compares packet identity, and applies final current metadata/rights guards. Changed, unsafe or missing files, expired local permission, withdrawal or supersession deny preparation. The pure schema helper requires the exact checked in-process packet; copies or serialized flags do not recreate it. Returned preview/schema objects are frozen and grant no execution authority. Future use must perform current full managed file checks again. Local operator, runtime, clock, database, filesystem, races, delivered copies and backups remain boundaries; no cross-file atomicity or independent fact authentication is claimed.

## Typed response schema

The schema binds exact v2 brief/snapshot/packet identity and fixed analytical/unreviewed modes. Each citation alternative pairs either one typed brief-field ID/hash or one typed whole-source UUID/record hash/content hash. Independent lists cannot mix source/hash pairs. Every concern must cite at least one brief field; this and other cross-field rules remain the local checker's responsibility.

Source-use enums reflect only frozen snapshot metadata eligibility. Eligible context permits `context_at_snapshot`, `background_only` and `coverage_gap`. Stale/unknown publication allows background/gap. A future-ineligible publication, update, event or retrieval date allows only gap. The preview does not turn any source into a verified fact, relevant claim, independent corroboration or current coverage.

Every schema object has all fields required and forbids extra properties; abstention is string/null, with nested anyOf citation alternatives under an object root. This follows the basic shapes described in the official [OpenAI Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs), checked October26,2026. No model is selected and live schema compatibility is not tested. The local [v2 response checker](context-analysis.md) still enforces mandatory brief basis, IDs, duplicates, list/text/UTF-8 bounds, abstention, current access and citation-use rules. Format agreement approves no reasoning or research.

Trusted instructions remain fixed, while all supplied text, metadata, URLs and commands stay in serialized input. Instructions ask for qualified assumption risks, evidence gaps and consistency questions with unreviewed proposed checks and explicit abstention. They forbid invented research, observed app defects, consumer/investor decisions, demand, funding probabilities or completeness claims. No tools are included. These instructions are unvalidated prompts, not proof of model behavior or prompt-injection resistance.

## Processing and next work

Local preparation does not read the separate [processing declarations](context-processing.md). Adding or revoking a declaration does not change a permitted local preview or authorize it for transmission. Original packet/source policies stay local only. The future runtime must require an exact current declaration in addition to local access, bind its ID/hash/revision/expiry, explicitly configure matching provider/model/rates, bind all complete instructions/input/schema/payload bytes, and reserve count/generation/finalization resources under fenced ownership. Full current rights/files must surround preparation, each send, response, seal, publication and later delivery.

Version0.44 adds separate [declaration-bound configuration/unwritten manifest preparation](context-analyst-configuration.md). Saved context manifests/task/accounting/transport integration remains separate; do not cast this preview into v1 contracts or infer permission from public visibility. Bounded analyst coordinator/report/catalog/recovery, dated context report/web, wider permitted sources, separately configured live compatibility, semantic review, human usefulness/behavior evaluation and paid demand remain open. A local preview is not a completed idea/app review or an active global news feed.

Version0.45 adds separate [exclusive context manifest publication and pre-ownership verification](context-analyst-manifests.md), with canonical reconstruction, current full rights/files and a successful in-process publication receipt. It creates no task or provider request. Task-bound historical reader and runtime integration remain open.
