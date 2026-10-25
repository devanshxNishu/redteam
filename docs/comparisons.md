# Saved controlled-review comparison

Version 0.13.0 adds comparison through the terminal and local API. It compares saved evidence from the two controlled signup fixtures. It does not run a review, app code, model, or follow-up action.

## Terminal

Use the workspace review/job IDs from `redteam runs list`. A job ID can differ from its evidence run ID.

```sh
redteam comparisons create --baseline BASELINE_REVIEW_ID --candidate CANDIDATE_REVIEW_ID
redteam comparisons list
redteam comparisons show COMPARISON_ID
```

Create accepts exactly two different review UUIDs. A structurally supported comparison is saved even when its evidence is not comparable. Create exits with status 1 for `not_comparable`; its JSON still identifies the saved record and verdict. Unavailable, unsafe, or changed artifact bytes cause an error without a catalog entry. List returns at most the latest 100 catalog records whose parent job pins remain available. `cataloged_unverified` is not a fresh artifact check. Show verifies the publication, source-pin artifact, both source reports, and their saved artifacts.

## Scope and result

Policy `controlled-signup-comparison-v1` requires the same parsed study and captured requirement bytes. It checks recorded Node, Playwright, browser version, and browser source. The candidate report time cannot precede the baseline report time. Each report needs a complete primary/verifier pair, different execution and dataset IDs, the full ordered step sequence, internally consistent assertions, no recorded capture or policy error, and findings consistent with both assertions. All four execution/dataset identities must be distinct across the pair.

The bounded source reader checks report identity, workspace containment, regular files, unique artifact references, size limits, and hashes. The coverage check also verifies execution-record JSON against the report, required screenshot/trace links, and PNG/ZIP headers. It does not independently interpret screenshot pixels or replay a trace. Hashes authenticate no external party; capture metadata assumes a trusted local coordinator and operator.

| Verdict | Meaning within the saved signup requirement |
|---|---|
| `mismatch_not_observed_in_candidate` | Baseline mismatch reproduced; both candidate assertions passed |
| `mismatch_observed_in_candidate` | Both baseline assertions passed; candidate mismatch reproduced |
| `requirement_passed_in_both` | Both execution pairs passed |
| `mismatch_reproduced_in_both` | Both execution pairs reproduced the mismatch |
| `changed_observation_same_build` | The states differ while the recorded build hash is the same; cause is unknown |
| `not_comparable` | Scope, identity, coverage, chronology, or recorded consistency checks failed; reason codes are included |

An empty finding list alone cannot establish a passing requirement. A candidate pass does not establish a causal fix, full app correctness, deployment outcome, or sustained result. A changed build hash does not identify which change caused an observation. Source and compiled fixture build hashes can differ. Unrecorded environment differences remain unknown. Clocks and local records are trusted declarations.

## API and storage

All routes require the current local bearer session and use the existing Host, Origin, and `no-store` protections.

- GET `/api/comparisons`: recent catalog summaries.
- POST `/api/comparisons`: exact JSON fields `baselineReviewId` and `candidateReviewId`; returns 201 for a saved result, including `not_comparable`. One comparison request can be active per service; a competing request receives 409.
- GET `/api/comparisons/COMPARISON_ID`: current checked detail. Unavailable source/publication checks return a static 404 without source contents or paths.

The private `.redteam/comparisons/COMPARISON_ID` directory holds immutable JSON and one source-pin artifact. The SQLite catalog pins their publication hash and both source hashes. Sources are checked again around publication and inside catalog insertion. A later source change makes the old comparison unavailable; it is not silently recalculated. A failed insertion can leave private orphan files. They are preserved and never adopted or automatically removed. Checks do not provide a transaction across external files or protect against a hostile local operator.

Comparison does not change action status or revision history. Action completion remains an operator declaration. This feature adds no customer, participant, buying, investment, psychology, funding, or commercial outcome evidence. Arbitrary releases, semantic finding matching, external apps, structured experiments, and the dashboard comparison workflow remain unfinished.
