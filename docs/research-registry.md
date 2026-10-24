# Research registry implementation contract

This milestone adds local research controls before live stakeholder agents. It does not establish psychological validity.

## Records

- A source has an immutable identifier, declared origin, collection method, reference, scope, partition, participant group references, limitations, and permitted uses. Its content is encrypted locally.
- A model version has immutable goals, constraints, knowledge, decision rules, scope, and source identifiers. Its hash changes only through a new version. Status changes are audited separately.
- An evaluation registers its model hash, held-out source hashes, case identifiers, scope, baseline, and thresholds before prediction lock.
- Predictions cover each registered case exactly once and become immutable when locked. Evaluation outcomes are unavailable through grounding or training retrieval, including after lock.

Scope initially uses exact country, language, customer segment, category, and decision identifiers. Matching scope establishes a software boundary. It does not prove representative sampling or national psychology.

## Gates

Source permissions for grounding, training, and evaluation are independent. Held-out sources cannot permit grounding or training. Missing, expired, or revoked permission denies retrieval.

A model starts as draft. Research grounding requires active, permitted, matching sources and at least one declared human observation. Synthetic fixtures cannot ground a model. Source provenance is operator-declared; external authenticity checks remain future work.

Evaluation registration rejects overlap with the model's grounding participants and rejects repeated outcome sources. Each outcome names one participant unit. Outcome access requires a complete frozen prediction set. Once exposed, those participant records and source copies cannot support new blind evaluations or late prediction locks. Multiple models frozen before exposure can share a comparison set. Source-copy checks use the declared reference and content hash; authenticity still depends on the operator's provenance records.

Scoring checks exact categorical agreement and an operator-declared baseline. It reports case and participant counts, thresholds, and limitations. This is a software agreement check, without confidence intervals or automatic sampling approval.

Passing software thresholds does not produce validated status. Research review, sampling adequacy, independent outcome verification, and appropriate statistical analysis remain additional requirements. The registry must reject any request to use a model as a validated predictor.

Revocation removes active source content and restricts dependent model versions. It also blocks later evaluation reads and scoring. Retained metadata supports audit; secure erasure of database pages or backups is not implemented.

## Demonstration data

The registry demo uses synthetic fixture sources and a draft model. It tests permissions, immutable versions, prediction locks, and scoring. It must never create human research, a grounded psychology model, or a validated prediction claim.

## Local boundary

Local operator commands control the registry. Database and key files use owner-only permissions. Filesystem access by that operator is outside application-level role isolation. The future hosted edition requires authenticated research roles, managed keys, isolated retrieval services, and independent reviewer approval.
