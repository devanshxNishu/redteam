# Bounded local report export plan

Next slice: U08, after the verified 0.16.0 web/terminal action, experiment-plan, and controlled-comparison workflows. This is technical export of existing checked records, not a new startup assessment or stakeholder judgment.

## Input and limits

Accept exact plain JSON `{schemaVersion:"1.0",kind:"report_export_input",title,items}`. Title is nonblank, at most 200 characters, with supported controls only. Items are one to ten unique `{kind,id}` records. Kinds are `review`, `action`, `experiment`, and `comparison`; IDs are strict UUIDs. At most five reviews. Reject unknown fields, getters/custom serializers, duplicates, unsupported records, and empty selection. Do not add actor/research/raw-code/session/credential exports implicitly.

## Read and lineage

Use existing checked readers. Reviews use `readFixtureEvidence`; exports check saved bytes and preserve recorded outcomes without independently adjudicating their semantic claims. Action exports pin a historical revision and exact prefix of its checked history. Later declared revisions can coexist with the frozen export; changed historical content cannot. Experiment/comparison publications retain their immutable catalog hashes and current parent source checks. Keep synchronous source-pin/access checks available inside the export catalog transaction. Re-read selected sources around publication; deny a changed projection/pin. Listing checks current pin availability only and must remain labeled `cataloged_unverified`; opening verifies all selected sources and saved export artifacts.

## Projection

Whitelist fields into public records. Omit automatic internal directories, access-grant targets, artifact paths, network logs, images, traces, code bytes, and unrelated records. Supplied text remains supplied text and may itself contain private material; no universal secret detector is claimed. Include public IDs/hashes, review execution/assertion/finding facts as recorded, action declaration/history metadata, exact supplied plan/fixed labels, comparison states/scope/reasons, and limitations. No model, app test, external message, recruitment, payment, or outcome collection occurs.

## Publication

Create a private immutable `.redteam/report-exports/EXPORT_ID` directory with JSON plus a human-readable Markdown artifact. Limit public JSON to 2 MiB and Markdown to a bounded size. Render supplied data literally in escaped Markdown or safe fenced JSON; untrusted text cannot create active HTML/images or spoof generated headings. Hash both artifacts. Keep full private source pins in the local catalog, public source references in the exported report. Use existing exclusive publication and bounded regular-file readers, guarded atomic catalog/audit insertion, and preserve unaccepted orphans without adoption/cleanup.

## Interface and verification

Start with `redteam reports export FILE`, `reports list`, and `reports show EXPORT_ID`; keep UI/API downloads for the next slice. Show directory/report locations to the terminal operator. No destination overwrite or remote publishing is needed. Later managed download links must recheck the source chain and use no-store/current sessions. Delivered copies cannot be recalled after revocation.

Meaningful checks: mixed valid selections, exact operator labels and source hashes, no additional jobs/models/actions, safe rendering, exclusion of private raw code/session/key/path markers, invalid inputs, bounded selection/output, unchanged source bytes, historical action updates/tamper, source grant withdrawal/expiry, changed artifacts/publications, symlink/path boundaries, guarded insertion/audit/orphan preservation, CLI errors, full regressions, and compiled isolated installation. Authored fixtures establish software mechanics only. No human, demand, purchase, investment, funding, causal, paid-demand, or production-validity claim is added.
