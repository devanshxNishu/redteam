# Checked local report export

Version 0.17.0 adds a bounded terminal export of selected saved records. It bundles their checked evidence references and declarations into JSON and Markdown. It makes no new engineering, stakeholder, causal, or commercial judgment.

## Terminal

Copy `examples/report-export.input.json` from the directory printed by `redteam examples`. Replace the example ID with a permitted current record ID.

```sh
redteam reports export ./report-export.input.json
redteam reports list
redteam reports show EXPORT_ID
```

Input has exactly `schemaVersion: "1.0"`, `kind: "report_export_input"`, `title`, and `items`. Title is nonblank, at most 200 characters, without control characters. Each item has exactly `kind` and a UUID `id`. Supported kinds are `review` (workspace review/job ID), `action`, `experiment` (frozen plan ID), and `comparison`. Choose one to ten unique items, with at most five reviews. Unknown fields, getters, duplicate references, unsupported types, and excess selections are rejected. No referenced parent is added to the report automatically.

Create returns the export ID and private JSON/Markdown locations. List returns at most the latest 100 catalog entries with currently available source pins, labeled `cataloged_unverified`. Show checks source permission, lineage, artifact bytes, publication hash, and the Markdown again. It does not read arbitrary user-supplied paths or replay any review.

## Included content and meaning

Policy `local-record-export-v1` copies a fixed field projection:

- Reviews: recorded scope hashes, requirement identity, runtime, execution/assertion states, findings, capture/integrity limits, and artifact hashes. A review ID can differ from its evidence run ID.
- Actions: a pinned historical revision, supplied plan/owner/progress, fixed declaration labels, minimal source IDs/hashes, and revision-history metadata through that revision.
- Experiments: the exact supplied frozen plan, historical action/source references, and fixed unreviewed, unassessed, not-started, and not-collected labels.
- Comparisons: pinned review references, factual states/verdict, matched scope, reason codes, and limits.

Source saved bytes are checked with the existing readers. Review semantic claims are preserved as recorded; export does not independently adjudicate their correctness. A reproduced fixture result remains limited to that journey. Declared action completion stays unverified. Intended samples do not become observed participants. A planned or elapsed window does not become an outcome. Comparison establishes no causal fix. No missing stakeholder or startup dimension is assessed by absence.

The public report omits automatic internal source directories, access-grant targets, source artifact paths, network logs, images, traces, raw code snapshots, sessions, credential stores, research content, and unrelated records. Supplied text is included and can itself contain private information. There is no universal secret detector. Artifact hashes support lineage; excluded bytes cannot be independently reconstructed from the export alone. The terminal locations and private catalog are local management data.

Markdown puts supplied titles and record bodies inside JSON fences longer than every contained backtick run. Supplied HTML, Markdown images/links, and heading text remain literal. This is an evidence appendix, not a generated investor recommendation or predictive stakeholder assessment.

## Storage, bounds, and current access

Private `.redteam/report-exports/EXPORT_ID` contains immutable `report.json` and one Markdown artifact. The private SQLite catalog holds full source pins and publication hash. Public JSON contains minimal source references and projected records. JSON is limited to 2,000,000 bytes; Markdown to 2,200,000 bytes. Large valid selections can be refused; reduce the selected records. A failed write/catalog attempt preserves private orphans without automatic adoption or cleanup.

Sources are checked again around publication and synchronously inside atomic catalog/audit insertion. Later action updates preserve the exact historical revision/history prefix in an older export. Modified historical content, source revocation/expiry, changed source publications/artifacts, or altered export files deny managed retrieval. Local files and the database are not one atomic transaction. Local clocks, trusted metadata/coordinator/operator, filesystem support, and backup limitations remain. No signature, independent timestamp, or hostile-operator guarantee is established.

Delivered JSON/Markdown copies cannot be recalled after permission changes. The managed readers continue to require current source rights. No remote publishing, messaging, payment, app/model execution, intervention, recruitment, outcome collection, or source mutation occurs. Web/API export/download controls are a later slice. Actor/research export requires its own permission design. U06 independent outcomes, human calibration, country models, paid demand, production isolation, and the broader agent hierarchy remain open.
