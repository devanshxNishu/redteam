# Local analyst generation preview

Version 0.29.0 implements the preparation slice I04b1. It does not implement provider dispatch or a live analyst.

```sh
redteam analysis prepare BRIEF_ID
```

The terminal reads a fully checked saved idea/app brief through its deterministic analytical packet. It prints `analyst_generation_preview` with `state: not_dispatched`. It contains trusted analytical instructions, the exact packet serialized as input, and a strict analytical JSON schema. It is model-independent; no model, price, key, processing authorization, task, reservation or token count is selected or created. Environment key/model values are not read by this operation. Normal workspace opening still applies.

The preview binds brief/packet identity, instruction hash, schema hash and a hash of the compact preview base before its own hash is appended. At most 200,000 bytes of pretty JSON plus its newline can be printed. It refuses excess content without removing packet fields or schema branches. No source or saved result changes; no new audit/job/actor/grant, provider request, URL/file-reference load, shell, browser, payment or delegation occurs.

## Schema and instructions

Every object is closed with all of its properties required. Optional abstention uses string/null. Metadata enums bind exact brief/packet identity. Each citation alternative binds one known local field ID to its exact hash; IDs and hashes cannot be mixed as independent lists. Concern tracks/types/priorities and unreviewed status/protocol use fixed enums.

The schema uses basic object, array, string, null, enum and nested `anyOf` shapes. The local response checker separately enforces text/list/byte bounds, duplicate IDs/citations, abstention and other cross-field rules. This is deliberate; provider schema support and model compatibility need their own configured live check. Schema agreement cannot certify correct reasoning or research validity.

The official [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) documents strict schema requirements, nullable fields, refusals and incomplete output; it also states that structured responses can still contain mistakes. The future transport must handle those cases explicitly and keep the local checker.

Supplied content is serialized only in input. It is not interpolated into trusted instructions or schema descriptions. The instructions ask for evidence gaps, assumption risks and consistency questions within the supplied basis, with unreviewed proposed checks and explicit abstention. They establish no model-level prompt-injection guarantee. No tools are included, and this preview executes no model.

## Next runtime boundary

Version 0.30.0 adds an isolated [analyst ownership handle](analyst-task.md). It is not connected to this command. Version 0.31.0 adds strict internal [configuration and unwritten manifest preparation](analyst-configuration.md). The rest of I04b2 requires configured runtime integration, exact source/packet checks, one fenced analyst task, durable reservations and unknown-liability handling, bounded transport and exclusive factual publication/recovery. The existing stakeholder adapter accepts inspect/decide actions and must not receive a cast analytical packet. Generic task and budget primitives can be reused where their authority and types fit.

Count the complete same instructions/input/schema together before generation; the official [token counting guide](https://developers.openai.com/api/docs/guides/token-counting) describes this payload relationship. Byte bounds are not token estimates, provider billing caps or measured cost. No model/rate/account availability is inferred from these documents. Refusal, incomplete output, invalid citations, unknown usage and interrupted requests cannot produce an accepted analytical conclusion or trigger automatic replay.

Fake transport tests precede a separately recorded live check. The current preparation and its tests use no real credential or provider call. I04c semantic review/report, real pilot usefulness, empirical consumer/investor models, paid demand, external isolation and wider hierarchy remain separate gates. Local operator/metadata/filesystem, private supplied text, delivered copies and backups remain boundaries.
