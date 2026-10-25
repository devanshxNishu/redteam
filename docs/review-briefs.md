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

Version 0.26.0 adds the protected local brief API below. Version 0.27.0 adds explicit web intake below. Existing exports do not include a brief automatically, and adding a brief does not change existing findings, plans, actions, jobs, actors, grants, or research permissions.


## Protected local API (0.26.0)

All routes require the existing bearer session, exact local Host/Origin rules, and `Cache-Control: no-store`. This is a single-user loopback service, not a hosted multi-tenant API.

- GET `/api/review-briefs`: at most 100 minimal metadata summaries, with IDs, title, subject type, local time and input/report hashes. Rows are `cataloged_unverified` and `reviewStatus: not_started`. It does not check file bytes or return input, decision, preview, references, or private directories. Invalid catalog storage returns a static denial.
- POST `/api/review-briefs`: the exact idea/app input contract above. The JSON request must have `application/json`, valid UTF-8, and at most 65,536 bytes including formatting. It returns 201 only after checked saved-file retrieval and final current-catalog/publication binding. Confirmation contains ID, title, subject type, time, hashes, and not-started status. It does not return a private directory or execute a review.
- GET `/api/review-briefs/BRIEF_ID`: full checked intake and deterministic preview, with fixed provenance/boundaries. Supplied references remain text. A final synchronous check binds every field of the initial private catalog snapshot and the canonical publication hash immediately before delivery.

One API create can be active per local service, including while its request body is incomplete. A competing create receives static 409 `review_brief_busy` and performs no new work. Completion, error or aborted input releases the slot. The byte bound is not a new request-time or shared resource budget; the local HTTP server's existing timeout/connection boundaries still apply.

Invalid/unconfirmed creation returns static 400 `review_brief_not_confirmed`. Unavailable or changed detail returns static 404 `review_brief_unavailable`. Errors do not reflect input, saved content, directories or internal failures. The initial catalog snapshot and final check are not atomic with filesystem changes or client receipt. Copies already delivered cannot be recalled. This intake currently has no source grant/revocation relationship: references are unverified supplied text, not an access right or a copied source.

A committed brief can outlive an unconfirmed response. The service does not automatically retry, delete, adopt or overwrite it. Inspect recent briefs before an intentional retry; another add creates another ID. Mutations, execute/approve actions, arbitrary preview/file loading, downloads and artifact routes are not provided. Terminal preview remains available without starting a service. No full review, model inference, purchase/investment decision, research or commercial validity is added.


## Web intake and checked detail (0.27.0)

In Reviews, **Ideas and apps → Add idea or app brief** opens a supplied-input form. Choose Idea or App. Common fields state title, decision, audience, market/language context, assumptions, unknowns and optional evidence entries. Subject fields remain separate. Blank optional fields become explicit `null`; empty assumption/unknown lines are omitted. The form allows at most ten evidence entries, each with label, description and optional unopened reference. It shows questions only after saving, as part of the checked deterministic preview.

Subject switching preserves both drafts inside the open form, but submits only the selected subject. Routine metadata refresh preserves the form. Close, navigation, failed metadata refresh or loss of the current managed view clears it. No draft/brief is stored in local/session storage or a global full-report cache. Submitting locks controls; an unconfirmed or aborted response is never automatically retried. Inspect recent briefs before intentionally creating another record. A commit can succeed after the dialog closes; a late response cannot reopen it or overwrite a newer draft.

The eighth metadata endpoint joins the existing shared refresh generation/abort boundary. Catalog rows are unverified metadata, limited to the current 100-record window. Full detail must pass the protected API reader and the client's SHA-256 check against current catalog identity/title/type/time/input/report hashes. A changed selected pin or failed refresh closes and clears the managed view. Detail is checked again during routine idle polls (ten seconds plus request time; active app jobs use the existing shorter interval). A file-tampered row may remain in the unverified catalog while full retrieval is denied. This is not a new grant/revocation relationship for supplied references.

Detail states intake/not-started limits first, then supplied audience/subject/assumptions/unknowns/evidence, explicit missing fields and six unstarted question tracks. All text uses DOM text/value properties. References are never links or loaded targets. Literal full JSON is collapsed and wraps on mobile. Copies already delivered, browser history, screenshots, OS caches and backups cannot be recalled. Saving or inspecting intake runs no test/model/agent, grants no access, and establishes no consumer reaction, investment decision or commercial validity.
