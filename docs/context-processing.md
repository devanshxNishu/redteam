# Context processing declarations

Version 0.42 implements the first part of I05d2: separate local processing declarations for an exact context packet. It stores an operator's stated permission. It does not authenticate content rights, check provider compatibility, prepare generation, load credentials, transmit data, or create a task, budget or result. A checked record reports `executionAuthority: "not_granted"`.

```sh
redteam context processing declare ./context-processing.input.json
redteam context processing list
redteam context processing show AUTHORIZATION_ID
redteam context processing revoke AUTHORIZATION_ID 1 "Stop future use"
```

All four commands require existing private workspace state. `declare` reads only the named bounded JSON input before opening the store. It reads the selected checked packet locally; references and URLs remain literal data. The packaged example is disabled: its false declarations and placeholder identities must fail. It grants no permission by default.

## Exact declaration

Input schema 1.0, kind `context_processing_declaration_input`, has these fields:

| Field | Required value or scope |
|---|---|
| provider, model | `openai` and one explicitly supplied model string; no default or availability claim |
| purpose | `input_count_and_analysis_inference`; input counting also transmits content in a future provider path |
| packet | Exact snapshot UUID and packet2 SHA256 |
| packetDeclaration | Explicit `authorized: true`, nonblank `basis`, canonical UTC `expiresAt`; covers the original brief, supplied snapshot metadata and future derived generation instructions/schema |
| sources | Every selected source in packet order, each with exact UUID, record/content hashes, explicit true declaration, separate basis and expiry |
| training, redistribution | Both false; no authority is granted for these uses |

The packet declaration cannot replace any source declaration. Missing, extra, reordered, duplicate or changed source pairs fail. Unknown fields, provider endpoints, keys, alternate purposes and wider authorities fail. Up to 12 sources, one-line basis of at most 1,000 characters each, model syntax of at most 120 characters, 24,000 pretty UTF-8 input bytes and 64,000 immutable record bytes are permitted. Named-file formatting counts toward its input limit. Getters, serializers, symbols, sparse arrays, unsafe links and invalid UTF-8 fail.

Each source declaration must expire no later than that source's existing local permission. Effective expiry is the earliest packet, source or local permission expiry and must be after creation. Public visibility, permission to collect, or local use does not imply permission to send content to a provider. This is a separate **later explicit operator declaration**; original local-only policies and `externalProcessing: false` receipts remain unchanged. The software cannot establish that the operator has the stated rights or that a provider's terms satisfy them.

## Immutable identity and current checks

Policy `context-processing-declaration-v1` records normalized input/hash, exact original brief/v1 packet, snapshot policy/record hash, packet2 hash, and every source's record policy/version/lineage/metadata/content hash/byte count/current revision/local expiry. No source body or private catalog path is added. Supplied basis can itself contain private information. The record is published exclusively as owner-only `.redteam/context-processing/UUID/record.json`; the catalog, initial event and audit commit together.

Creation and checked reading fully re-read the current brief, snapshot, selected sources and declaration file around construction. Final synchronous guards check current catalogs, source rights, expiry and declaration state. Altered, missing or unsafe files, changed hashes/semantics, withdrawn/superseded sources, invalid history or an expired/revoked declaration deny checked delivery. Checked object identity is tied to its Store. Copied/serialized flags do not recreate it. The synchronous in-process guard checks metadata/expiry only; a later transmission must perform full managed file reads too.

At most one active catalog entry exists for an exact packet/provider/model tuple. Expiry does not silently change its revision or free the tuple. Explicitly revoke the previous record before recording a replacement under a new UUID. Revoked IDs never become active again. Different explicit models have separate records. A concurrent losing writer or failed catalog transaction can leave factual uncataloged bytes; they are never adopted, replayed, or treated as permission.

`list` is administrative metadata, labeled `cataloged_unverified` and `processingAuthority: "not_checked"`. It includes expired/revoked entries without reading source or declaration files and exposes no paths, bodies or basis. `show` requires complete current checks. Administrative revocation works after expiry, source loss/withdrawal or declaration-file loss, and preserves immutable bytes with a second revision event. It does not recall copies or transmissions already delivered. Local operator, runtime, clock, database, filesystem, backups and operation races remain trusted boundaries; no cross-file atomic transaction is claimed.

## Remaining integration

Packet2 remains `local_only_not_dispatchable`. V1 generation/configuration/manifests/transport remain brief-only and unchanged. The new declaration is necessary future input, not an execution capability. Before any context transmission, version generation/configuration/manifests/task/accounting/transport together: bind exact current grant ID/hash/revision/expiry, all complete input and schema bytes, exact model/provider, rates and count/generation/finalization budgets. Check full sources and current declaration around preparation, each transmission, response, seal, publication and later delivery. Do not cast packet2 into v1 paths. Separately configured live compatibility, analyst result publication/recovery, dated report/web, wider permitted sources, semantic review and human usefulness/behavior evaluation remain open.
