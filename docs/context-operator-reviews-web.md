# Saved review notes in the browser

Version0.64 adds a separate managed display for operator declarations saved through `redteam context review save FILE`. Open Reviews and choose **Load note metadata**, then **Inspect note**. A note contains operator statements. Reviewer identity, inspected basis and dispositions remain unverified; original reasoning stays unreviewed.

Metadata contains bounded recorded identities and hashes. It reads no note body or current source rights. Load each next window deliberately; a window is not a complete catalog. The browser does not fetch notes automatically or retry a busy or uncertain request.

Opening a note checks the saved record and current original sources again. Detail must match the selected note, record/input/report hashes and task/run identities. Free text and original concerns render literally. References are not followed, and proposed checks do not create actions or experiments. No model, test or stakeholder decision runs.

**Recheck note and sources** clears the previous text before another complete read. The managed display clears after at most30seconds or earlier known permission expiry. It also clears on close, navigation, page hiding, local clock reversal, failed recheck or opening another managed detail. Aborted and late replies cannot reopen an older view. Metadata and note content are not saved to browser storage.

The separate GET `/api/context-operator-reviews/REVIEW_ID/managed` uses schema2.0 and policy `operator-declaration-api-v2`. Existing v1 catalog/detail and terminal/store contracts are unchanged. The managed access contract contains `checkedAt`, `effectiveExpiresAt`, `displayUntil=min(effectiveExpiresAt,checkedAt+30000)`, `maximumDisplayMs:30000`, explicit revalidation and revocation/delivered-copy limits. It does not turn a public v1 view into authority. One private original read and exact route/workspace/ID binding are consumed only after complete managed serialization. Final original source checks, native cancellation/time/expiry and managed deadline must pass before delivery. The same120000-byte/30-second read limits and shared context-data read slot apply.

Revocation is detected by a new check or local display expiry. A copy already delivered cannot be recalled. A successful data check does not approve note content or the original analytical reasoning. This local service keeps its existing bearer, Host/Origin, no-store and content security policy; service startup retains normal ownership/recovery before read-only request baselines.

Verification uses authored software fixtures, native local HTTP/browser checks, actual prior compiled records, complete regression and archive/installed-byte gates. Current results are in the [implementation status](implementation-status.md). Independent human adjudication, researched psychology, real app pilot usefulness and commercial demand remain separate evidence gaps.
