# Idea and app intake through the terminal

Version 0.25.0 adds supplied review briefs and deterministic scope previews. Only `idea` and `app` are accepted. This is intake, not an executed review, a live agent roundtable, market research, app access, or a stakeholder decision.

## Commands

Find the example directory with `redteam examples`. Copy `idea-review-brief.input.json` or `app-review-brief.input.json` into your working directory and replace the example text.

```sh
redteam briefs preview ./idea-review-brief.input.json
redteam briefs add ./idea-review-brief.input.json
redteam briefs add ./app-review-brief.input.json
redteam briefs list
redteam briefs show BRIEF_ID
```

Preview reads only the explicitly named JSON input. It creates no workspace or record. Add saves an immutable private record and catalog/audit entry. List returns at most 100 metadata summaries, labeled `cataloged_unverified`; it does not verify saved file bytes. Show checks the saved file, hash, exact catalog binding, input contract, provenance, limits, and deterministic preview again. A later version of an idea or app brief is a new record; no update/delete operation is provided.

The terminal is a supported entry point for both subjects. An idea does not need an app or URL. For an app, the URL is a supplied reference and does not grant or start execution. Use existing separate `redteam access grant` commands to record scoped app/project permission. The current runner still supports only the controlled local signup fixture. Capturing local source requires its own exact directory grant. No terminal brief command opens an arbitrary target or runs its code.

## Input contract

Required common fields are `schemaVersion: "1.0"`, `kind: "review_brief_input"`, `subjectType`, `title`, `decision`, `audience`, `assumptions`, `suppliedEvidence`, and `unknowns`. Include exactly one subject object: `idea` for an idea, or `app` for an app. Unknown fields, missing fields, other subjects, mixed subject objects, getters, serializers, symbols, inherited custom objects, sparse/extra arrays and asserted result fields are refused.

| Field | Requirement |
|---|---|
| Title | Nonblank, at most 200 characters, one line |
| Decision | Nonblank, at most 1,000 characters |
| Audience | Exactly `users`, `buyers`, `market`, `language`; each supplied text or explicit `null` for unknown |
| Audience limits | Users/buyers 1,000 characters each; market 200; language 100; market/language one line |
| Assumptions and unknowns | Arrays of at most 12 nonblank strings each; 500 characters per item |
| Supplied evidence | At most 10 objects with exactly `label`, `description`, `reference`; label up to 160 characters; description up to 1,000; reference up to 2,048 or `null` |
| Idea | Exactly `problem`, `solution`, `alternatives`, `valueProposition`, `businessModel`, `distribution`, `differentiation`; each up to 2,000 characters; problem/solution required nonblank, other values may be `null` |
| App | Exactly `purpose`, `journey`, `expectedBehavior`, `url`; first three nonblank, up to 2,000 characters each; URL up to 2,048 or `null` |

App URLs must be absolute HTTP/HTTPS without embedded username/password. References in supplied evidence are literal text; no URL/file loader follows them. Labels and references use one line. Multi-line description fields accept LF and tab; other control characters, including terminal escape sequences and CR, are refused. Text is preserved after validation, including its whitespace; the validator does not rewrite supplied claims.

The complete normalized input is at most 65,536 UTF-8 bytes. The explicit CLI JSON file also has that byte limit, including formatting. The input reader refuses final symbolic links, hard links, nonregular files, invalid UTF-8/JSON, changed files, and unsafe boundaries. It does not read additional files named inside the brief. A canonical parent alias can resolve before the explicit input read; this is not an arbitrary path crawler.

## Preview and meaning

The preview reports the subject, title, requested decision, explicit null/missing evidence fields, supplied evidence and assumption counts, and the operator's unknowns. Six unstarted tracks contain fixed analytical questions: product, engineering, customer/buyer, commercial, investor preparation, and verification. Counts describe supplied coverage only; ten unsupported claims are not stronger evidence than one.

The preview has `status: "not_a_review"`. The saved brief has `state: "intake_saved"` and `reviewStatus: "not_started"`. Provenance is `operator_supplied_unverified`; references are `supplied_unopened_unverified`. There is no score, objection generated from a model, observed finding, consumer response, purchase or investment decision, population psychology, demand, funding probability, or calibration result. Country/language fields provide supplied context, not psychological traits or representative population weights.

## Private storage and integrity

Private `.redteam/review-briefs/BRIEF_ID/report.json` is published exclusively with owner-only permissions. Its SHA-256 binds the canonical saved bytes; `inputSha256` binds the normalized input with stable field order. The private SQLite catalog is insert-only through the product API. Catalog insertion and its audit are atomic; synchronous checks cannot be replaced by an asynchronous callback. No raw input text is placed in the audit entity. Hashes establish local consistency, not authenticity, independent research or an external timestamp.

Checked reads use bounded regular single-link files, no-follow opening, canonical directory boundaries and consistency checks. They reconstruct the expected v1 record/preview and reject altered claims, extra fields, unsupported policies, source/type/title/hash mismatches and catalog changes. Local records are plaintext. Supplied text, including references, can contain private information; no universal secret detector exists. An operator with account access, local clocks/metadata/filesystem, delivered copies and backups remain trusted boundaries.

Publication can succeed before a catalog or response fails. Private orphan bytes remain for inspection; the program does not adopt, overwrite or delete them automatically. An intentional second add creates another ID; it is not automatic recovery or a revision to the original. Inspect the catalog before retrying an uncertain write.

Protected brief API and explicit web intake are next milestones. Existing exports do not include a brief automatically, and adding a brief does not change existing findings, plans, actions, jobs, actors, grants, or research permissions.
