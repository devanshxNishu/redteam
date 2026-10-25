# Checked local report export

Version 0.17.0 adds a bounded terminal export of selected saved records. It bundles their checked evidence references and declarations into JSON and Markdown. It makes no new engineering, stakeholder, causal, or commercial judgment.

## Terminal

Copy `examples/report-export.input.json` from the directory printed by `redteam examples`. Replace the example ID with a permitted current record ID.

```sh
redteam reports export ./report-export.input.json
redteam reports list
redteam reports show EXPORT_ID
```

Input has exactly `schemaVersion: "1.0"`, `kind: "report_export_input"`, `title`, and `items`. Title is nonblank, at most 200 characters, without control characters. Each item has exactly `kind` and a UUID `id`. Supported kinds are `review` (workspace review/job ID), `action`, `experiment` (frozen plan ID), `comparison`, and `outcome_evidence` (controlled evidence-link ID). Choose one to ten unique items, with at most five reviews. Unknown fields, getters, duplicate references, unsupported types, and excess selections are rejected. No referenced parent is added to the report automatically.

Create returns the export ID and private JSON/Markdown locations. List returns at most the latest 100 catalog entries with currently available source pins, labeled `cataloged_unverified`. Show checks source permission, lineage, artifact bytes, publication hash, and the Markdown again. It does not read arbitrary user-supplied paths or replay any review.

## Included content and meaning

Version 0.24.0 creates policy `local-record-export-v2` with a fixed field projection. Previously saved `local-record-export-v1` four-kind exports remain readable without rewriting their JSON or Markdown; the new dependency limits are not retroactively imposed on them.

- Reviews: recorded scope hashes, requirement identity, runtime, execution/assertion states, findings, capture/integrity limits, and artifact hashes. A review ID can differ from its evidence run ID.
- Actions: a pinned historical revision, supplied plan/owner/progress, fixed declaration labels, minimal source IDs/hashes, and revision-history metadata through that revision.
- Experiments: the exact supplied frozen plan, historical action/source references, and fixed unreviewed, unassessed, not-started, and not-collected labels.
- Comparisons: pinned review references, factual states/verdict, matched scope, reason codes, and limits.
- Controlled evidence links: the existing public projection, supplied note, exact plan/action/comparison/review IDs and report hashes, local chronology, factual comparison, fixed unadjudicated assessments, and limitations. Full private history/catalog pins and artifact paths are excluded. The plan stays uncollected, and the action is not promoted.

Source saved bytes are checked with the existing readers. Review semantic claims are preserved as recorded; export does not independently adjudicate their correctness. A reproduced fixture result remains limited to that journey. Declared action completion stays unverified. Intended samples do not become observed participants. A planned or elapsed window does not become an outcome. Comparison establishes no causal fix. No missing stakeholder or startup dimension is assessed by absence.

The public report omits automatic internal source directories, access-grant targets, source artifact paths, network logs, images, traces, raw code snapshots, sessions, credential stores, research content, and unrelated records. Supplied text is included and can itself contain private information. There is no universal secret detector. Artifact hashes support lineage; excluded bytes cannot be independently reconstructed from the export alone. The terminal locations and private catalog are local management data.

Markdown puts supplied titles and record bodies inside JSON fences longer than every contained backtick run. Supplied HTML, Markdown images/links, and heading text remain literal. This is an evidence appendix, not a generated investor recommendation or predictive stakeholder assessment.

## Storage, bounds, and current access

New v2 exports permit at most five distinct underlying review/job IDs and ten review references across the selection, counting repeated dependencies. A selected review uses one reference; a browser-linked action or plan uses one; a comparison or controlled evidence link uses two. Engineering-source actions/plans use zero browser-review references. The metadata check rejects excess selection before full source readers run. Private pins bind these dependencies; public `sourceReadBudget` exposes only counts and limits. These are logical source-reference bounds, not measurements of disk reads, bytes, cost, or time. Each source reader and serialized export retains its separate file/byte limits.

Private `.redteam/report-exports/EXPORT_ID` contains immutable `report.json` and one Markdown artifact. The private SQLite catalog holds full source pins and publication hash. Public JSON contains minimal source references and projected records. JSON is limited to 2,000,000 bytes; Markdown to 2,200,000 bytes. Large valid selections can be refused; reduce the selected records. A failed write/catalog attempt preserves private orphans without automatic adoption or cleanup.

Sources are checked again around publication and synchronously inside atomic catalog/audit insertion. Later action updates preserve the exact historical revision/history prefix in an older export. Modified historical content, source revocation/expiry, changed source publications/artifacts, or altered export files deny managed retrieval. Local files and the database are not one atomic transaction. Local clocks, trusted metadata/coordinator/operator, filesystem support, and backup limitations remain. No signature, independent timestamp, or hostile-operator guarantee is established.

Delivered JSON/Markdown copies cannot be recalled after permission changes. The managed readers continue to require current source rights. No remote publishing, messaging, payment, app/model execution, intervention, recruitment, outcome collection, or source mutation occurs. Version 0.18.0 added the API below; version 0.19.0 adds the dashboard workflow. Actor/research export requires its own permission design. U06 independent outcomes, human calibration, country models, paid demand, production isolation, and the broader agent hierarchy remain open.

## Protected API in version 0.18

All routes require the current local bearer session and existing Host/Origin controls. Responses use `Cache-Control: no-store`.

- GET `/api/report-exports`: recent permitted catalog summaries with minimal public source IDs/hashes. Full private source pins/directories are excluded. Rows remain `cataloged_unverified` until opened.
- POST `/api/report-exports`: exact export-selection input. A confirmed export returns 201 with its ID, title, local creation time, and record count. One export creation can be active per service; a competing request receives 409. Invalid/unavailable selections receive static 400. A commit can precede an unconfirmed response; inspect recent records before retrying.
- GET `/api/report-exports/EXPORT_ID`: fully checked public report detail. The checked canonical publication hash and public source references are bound to the current catalog, and current source rights are checked again immediately before response delivery.
- GET `/api/report-exports/EXPORT_ID/download.json` or `/download.md`: fully checked attachment. Source rights are checked again after source/artifact verification and rendering, immediately before response headers and bytes are written. The file name uses the validated UUID. `Content-Length` counts delivered bytes, and `X-Content-SHA256` contains their SHA-256. These hashes provide no signature or independent attestation.

Unavailable, changed, expired, or revoked sources/publications return static 404 for both detail and download, without private text or filesystem errors. Unsupported formats, source artifact downloads, mutation, and remote publishing remain unavailable. The endpoint renders from the checked in-memory public report; it does not reopen an arbitrary file after the permission check. Historical action exports remain exact after later declared revisions, but changed historical content denies delivery.

A permission check is a local delivery boundary, not an atomic transaction with remote receipt or external files. Delivered copies cannot be recalled, including after withdrawal. Downloaded JSON/Markdown is private user data; the service performs no automatic upload, external message, stakeholder assessment, outcome collection, or credential/research export.

## Dashboard in version 0.19

Reviews offers **Select records for export**, recent export catalogs, checked detail, and JSON/Markdown downloads. Supply a title and choose one to ten records, including at most five directly selected reviews. The v2 underlying-review/reference bounds also apply. Version 0.24.0 adds an explicit **Linked controlled evidence · unadjudicated** group. Links are never selected automatically, and excess transitive selection is refused in both the form and backend. Options show up to 25 recent permitted records of each kind, plus selected records still known in the current catalogs. Catalogs are unverified metadata; source bytes and permissions are checked before creation. The backend reads the current action revision at export time, which can differ from a previously displayed option label. Checked detail exposes the actual pinned revision. No referenced parent is added automatically.

Routine refresh preserves the title and selected typed IDs. It rebuilds option labels from current permitted metadata, so an unselected withdrawn source does not leave private text in the form. Loss of a selected source closes and clears the whole form; the client does not silently submit a reduced bundle. The earliest expiry across selected source grants controls local clearing. Catalog rows also require all source references to resolve through current known permissions. Older valid sources outside those current catalog windows can be hidden; the terminal/API remain available for deliberate inspection.

Checked detail renders public references and literal record bodies with DOM text/value properties. It does not render exported Markdown as HTML. Record JSON is collapsed and wraps on mobile. Source permission and saved integrity are checked again during refresh, at most ten seconds between idle polls plus request time. Failed metadata refresh, known expiry, or source/integrity rejection clears managed detail and controls. Existing private views retain shared dialog ownership.

Downloads fetch with the local bearer session and no-store. The client bounds the response to 2,200,000 bytes, checks exact length and SHA-256 headers, and checks current dialog ownership and known source access before requesting a native download. Closed or restricted views cannot dispatch a late download. A bad length/hash fails closed. Blob URLs stay in managed memory, are revoked on close/replacement, and are released after dispatch. The client stores no export or draft in local/session storage. A native download request is not proof that a filesystem save completed. Already delivered/saved copies, browser history, screenshots, OS caches, and backups cannot be recalled.

A create can commit before its response is lost or aborted. The client does not undo, automatically retry, or duplicate an uncertain export; inspect recent exports before deliberately retrying. Selecting/exporting/downloading records adds no app/model execution, outcome collection, semantic approval, research, customer demand, purchase, investment, funding, or causal evidence.
