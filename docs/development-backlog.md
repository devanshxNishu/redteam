# redteam: First-Build Backlog

Version: 1.3

Date: October 25, 2026

Status: Development planning

Companion: [Master plan](/Users/devansh/Documents/ChatGPT/RedTeam/docs/master-plan.md)

This backlog converts the master plan into ordered work. The listed checks are requirements for future implementation.

## 1. Dependency order

Pilot brief → data contracts → tool policy → isolated worker → evidence → verification → report.

Research protocol → human observations → candidate model → controlled actor → held-out evaluation.

The coordinator and roundtable connect these paths after the evidence path works.

Implementation checkpoint, 0.24.0: fixture browser evidence, registry/evaluation controls, bounded actor mechanics, coordinator constraints, durable inference reservations, and one fenced configured actor are implemented. The full 395-test suite passes. Atomic publication and factual recovery preserve the first valid JSON and never infer acceptance from an unpublished seal. Bounded diagnostics preserve invalid files. B12 local repository snapshots now capture bounded text under exact grants, with private artifacts, hashes, exclusion counters, source preservation, and current expiry/revocation checks. B13 now records supplied requirements and source notes with exact file/range hashes, original input preservation, fixed unreviewed status, and unknown expectations. No code, test command, or model runs through capture or note registration; citation integrity does not approve a finding. U15 code inspection now includes the protected API and dashboard, current access and detail integrity refresh, expiry timers, safe text rendering, and stale-response guards. Installed desktop/mobile and normal-poll revocation checks pass. U04 scoped action storage, CLI, and API now preserve source pins, permission, atomic expected revisions, and operator-declared progress. The action dashboard now adds source-linked forms, history, deliberate revision-conflict handling, permission-safe managed views, and current-grant filtering of mixed responses. U05 now compares saved controlled-signup evidence through the terminal and API with immutable source pins, full execution/requirement checks, explicit not-comparable reasons, and unchanged action declarations. The comparison dashboard now adds explicit selection, checked detail, source pins, reason codes, and stale-response/source-integrity rejection. U04 now also freezes supplied structured experiment plans through terminal/API against a historical action/source pin, with future-window/revision guards and fixed unreviewed/uncollected labels. The plan dashboard now adds supplied-plan forms, exact action revisions, local-time/UTC preview, checked historical detail, deliberate conflicts, and permission/integrity/late-response guards. U08 now exports selected checked local records through terminal JSON/Markdown with fixed projections, historical action prefixes, current source rights, literal rendering, and bounded immutable publication. The protected export API now adds confirmed creation, minimal catalogs, checked detail, and exact JSON/Markdown attachment delivery with final access checks. The export dashboard now adds bounded typed selection, current source filtering/multi-grant expiry, checked literal detail, verified native downloads, managed Blob cleanup, and late-response guards. U16 now provides read-only terminal installation/scope preflight with exact pinned headless-shell metadata and separate runtime evidence; it opens no private store or tool and repairs nothing. Arbitrary releases and independent outcome records remain open. Terminal-only controlled outcome evidence now links an exact baseline finding/action/frozen plan to a later checked capture/comparison under strict local-clock windows, immutable hashes, historical events, and current completed source states. It preserves all source declarations and does not adjudicate the hypothesis, sample, intervention, independence, or causality. U06 independent human outcomes remain open. The protected local API now adds confirmed creation, minimal catalog, whitelisted checked detail without private paths/history pins, current-source/publication binding immediately before response, static errors, and no automatic uncertain-write retry. The dashboard now adds explicit source-linked comparison selection, optional note preservation, checked literal detail/catalog, current completed-parent filtering, full source refresh, and late-response guards without state promotion. The v2 export now adds explicit fifth-kind links, checked private transitive pins, five-distinct-review/ten-reference bounds, final canonical publication binding, and old v1 compatibility. The next ready product work is idea/app review brief intake and deterministic scope preview; neither a saved brief nor a preview is a completed review. Research permission still governs actor report retrieval. Shared specialist scheduling, all-resource budgets, production isolation, human research, predictive validation, paid demand, and broad hierarchy gates remain open. See `docs/implementation-status.md` for exact coverage.

## 2. Priority definitions

| Priority | Meaning |
|---|---|
| P0 | Required for the first valid demonstration |
| P1 | Required for the controlled pilot |
| P2 | Added after pilot evidence supports the work |

P0 refers to the first technical demonstration. Research tasks have a separate order and do not block that demonstration.

D1 is the technical evidence demonstration at B11. D2 is the grounded actor demonstration at R08, followed by R09 evaluation.

## 3. Commercial evidence

| ID | Priority | Work | Depends on | Acceptance check |
|---|---|---|---|---|
| C01 | P0 | Interview prospective customers | None | Five founders describe the recurring problem and a workaround |
| C02 | P0 | Define bounded idea-review, app-review, and research offers | C01 | Each offer states deliverables, model coverage, price, and lead time |
| C03 | P1 | Deliver concierge reviews and assess paid demand | C02, B11 | Five reviews are complete; at least three are paid |
| C04 | P1 | Compare usefulness and track customer actions | C03 | Blind comparisons and customer actions are recorded |
| C05 | P2 | Test repeat purchase before subscription investment | C04 | Two pilot customers purchase another review |

These proposed gates support learning. They do not establish product-market fit.

Broad hierarchy development depends on C03. A narrow prototype and human-assisted reviews can produce that evidence.

## 4. Foundation and evidence path

Active subject scope: **ideas and apps only**. See [scope and intake plan](idea-and-app-scope.md). The controlled app path remains intact; general subject/CV/service review is deferred.

| ID | Priority | Work | Depends on | Acceptance check |
|---|---|---|---|---|
| I01 | P0 | Store strict versioned idea/app review briefs and deterministic scope previews through the terminal | Existing workspace/publication controls | Only idea/app accepted; immutable bounded supplied input, stable provenance/hash, explicit unknowns, no URL/file fetch, tool/model execution, grant creation, or completed-review claim |
| I02 | P1 | Add protected brief intake API | I01 | Minimal catalogs, checked detail, static denials, local session/Host/Origin/no-store boundaries |
| I03 | P1 | Add explicit web idea/app intake | I02 | Separate fields, safe literal detail, deliberate submit, draft lifecycle, desktop/mobile and late-response checks |
| I04 | P1 | Add bounded evidence-linked analyst review | I03, B09 | Supplied claims, sourced evidence, analytical objections and unknowns remain distinct; no ungrounded buyer/investor prediction; pilot usefulness gate recorded |


| ID | Priority | Work | Depends on | Acceptance check |
|---|---|---|---|---|
| B01 | P0 | Define the pilot decision, app, market, and three journeys | None | Scope, exclusions, stakeholders, and access owner are recorded |
| B02 | P0 | Define research questions and outcomes | B01 | Each question has an observable outcome and permitted use |
| B03 | P0 | Create versioned domain and execution schemas | B01 | Immutable versions, task attempts, invocations, budget entries, verification, and report links resolve |
| B04 | P0 | Create the study manifest | B03 | Inputs, versions, permissions, and limits remain retrievable |
| B05 | P0 | Implement the tool gateway | B03 | Denied tools and destinations cannot execute |
| B06 | P0 | Implement identity, browser isolation, and fixture reset | B05 | Cross-actor state remains inaccessible; fixture snapshots and reset checks are recorded |
| B07 | P0 | Execute one app journey | B04, B06 | Expected results, actual results, infrastructure failures, and fixture references remain distinct |
| B08 | P0 | Capture observations and artifacts | B07 | Each result links to its action, build, time, and permitted artifact |
| B09 | P0 | Implement typed claims and findings | B03, B08 | Defect claims require an expected-result source; simulated output retains its type |
| B10 | P0 | Independently verify a material finding | B09 | Verification records steps, expected result, actual result, and counterevidence |
| B11 | P0 | Generate the first decision brief | B10 | Every material conclusion has evidence or explicit uncertainty |
| B12 | P1 | Define a bounded local repository snapshot | B05, B08 | An exact `code:read` grant controls local fixture reads; exclusions, bounds, file hashes, expiry, revocation, and containment are checked; no code or model is executed |
| B13 | P1 | Define requirement-linked engineering observations | B12, B09 | Supplied requirements and copied file ranges resolve to hashes; source declarations, executed results, supported defects, and unknowns remain distinct; no test execution or broad hierarchy is implied |

The first demonstration ends at B11. It uses one app journey and one verified finding.

## 5. Research and stakeholder actors

| ID | Priority | Work | Depends on | Acceptance check |
|---|---|---|---|---|
| R01 | P1 | Create recruitment, interview, and observed-task protocols | B02 | Human and actor framing, assistance, incentives, and decision opportunities are comparable |
| R02 | P1 | Create consent and permitted-use records | R01 | Evaluation and training permissions remain distinct |
| R03 | P1 | Collect exploratory human evidence | R01, R02 | Decision events and contradictory cases link to original records |
| R04 | P1 | Define model, instance generator, and validity card | R03, B03 | Constructs, supported attribute combinations, horizon, and assumptions are recorded |
| R05 | P1 | Lock evaluation protocol and source access | B02, B03 | Baselines, partitions, thresholds, hashes, prediction locks, and adjudicator access are registered |
| R06 | P1 | Implement actor state and permitted actions | R04, B05 | Compare, seek help, reject, and abandon are valid outcomes |
| R07 | P1 | Enforce actor knowledge boundaries | R06 | Private founder material and hidden app state remain inaccessible |
| R08 | P1 | Run grounded actor scenarios | R07, B08 | Supported instances, initial conditions, actions, versions, and tool failures are recorded |
| R09 | P1 | Compare with held-out human behavior | R05, R08 | Predictions lock before outcome access; uncertainty and segment failures remain visible |
| R10 | P1 | Implement model promotion and restriction | R09 | Failed candidates cannot replace a validated default |
| R11 | P2 | Add a second market or category | R10 | Local research and transfer evaluation support the added scope |
| R12 | P2 | Evaluate selective fine-tuning | R09 | A defined error improves on untouched evaluations |
| R13 | P2 | Validate longitudinal decisions when enabled | R09, U06 | Retention or renewal claims match the evaluated horizon and history |
| R14 | P1 | Research purchase decisions and buying constraints | R01, R02 | Evidence distinguishes need, value, affordability, payment access, and authority |
| R15 | P1 | Implement consumer purchase scenarios | R14, R07, B08 | Actions include buying, comparison, approval, deferral, abandonment, and rejection |
| R16 | P1 | Research investor mandates and decision stages | R01, R02 | Evidence identifies capital, terms, diligence, authority, and decision criteria |
| R17 | P1 | Implement investment decision scenarios | R16, R07, B08 | Verdicts include invest, pass, conditional, defer, and insufficient information |
| R18 | P1 | Validate purchase predictions | R05, R15 | Frozen predictions match held-out offers, constraints, decisions, and horizons |
| R19 | P1 | Validate investment predictions | R05, R17 | Frozen predictions match held-out information, decision stages, and documented outcomes |

An unsuccessful R09 result is useful research. The product can retain app review while restricting prediction claims.

## 6. Hierarchy, roundtable, and resilience

| ID | Priority | Work | Depends on | Acceptance check |
|---|---|---|---|---|
| O01 | P1 | Implement guarded lifecycle, task state, and leases | B03, B07 | Invalid transitions fail; recovery preserves sealed outputs and side-effect identity |
| O02 | P1 | Implement atomic budget reservations | O01 | Calls, retries, cancellation delays, verification, and closure stay within the cap |
| O03 | P1 | Implement bounded specialist requests | O02, C03 | Duplicate questions, excess depth, and unauthorized tools fail validation |
| O04 | P1 | Enforce phase access and seal initial findings | B09, O03 | Teams cannot see other initial findings before sealing; original outputs remain unchanged |
| O05 | P1 | Implement the structured roundtable | O04, B10 | Each follow-up names a material uncertainty and remaining budget |
| O06 | P1 | Implement cancellation and terminal states | O01, O02 | Children stop; stored records support a factual partial report without paid synthesis |
| O07 | P1 | Compare hierarchy with a single-agent baseline | O05 | Frozen inputs, access, time, total costs, and blinded adjudication match |
| O08 | P1 | Add run telemetry and cost attribution | O01, O02 | Tasks and tool calls link to the run and measured cost |

Retries must distinguish read operations from actions with side effects. A timeout after a write requires a state check before another attempt.

## 7. Founder workflow and pilot operations

| ID | Priority | Work | Depends on | Acceptance check |
|---|---|---|---|---|
| U01 | P1 | Create setup and scope preview | B04 | App review works without actor models; enabled actors show their limits |
| U02 | P1 | Create live run status | O06, O08 | Access failures and incomplete coverage remain visible |
| U03 | P1 | Create finding and evidence views | B11 | Evidence access matches tenant and study permissions |
| U04 | P1 | Create action and experiment records | U03 | Actions have owners, validation methods, and status |
| U05 | P1 | Create release comparison | U04, B04 | Resolved, changed, and new findings retain original provenance |
| U06 | P1 | Create prospective outcome tracking | R05, U04 | Predictions are stored before independent outcomes |
| U07 | P1 | Add conditional model validity views | R04 | Draft and validated status remain distinct; app review requires no model |
| U08 | P1 | Add evidence export and permission revocation | U03 | Old links and managed caches deny access; affected sessions stop and versions receive restrictions |
| U09 | P1 | Add purchase and investment decision appendices | U03 | Enabled modules show verdicts, reasons, conditions, terms, evidence gaps, stage, and model limits |
| U10 | P0 | Distribute an installable terminal CLI | B03 | Packed JavaScript installs outside the source tree; help, review, run list, and evidence verification work |
| U11 | P0 | Share local service state between web and terminal | U10, U02 | Both interfaces see the same jobs; concurrent coordinators are rejected; interrupted jobs do not replay |
| U12 | P0 | Add terminal access grants and session import | B04, U10 | Targets, capabilities, expiry, encrypted sessions, and revocation are enforced outside model instructions |
| U13 | P1 | Package and verify the local dashboard | U03, U11 | Desktop and mobile flows use real records; API secrets stay out of public metadata; local Host and Origin checks pass |
| U14 | P1 | Enable authorized external execution | U12, B04 | Destination and action policy, revocation, credential handling, and worker isolation pass before external targets run |
| U15 | P1 | Inspect repository and source-note records in the local dashboard | B12, B13, U03 | Current grants and hashes protect report access; unreviewed/unknown labels remain visible; revoked links and cached open reports are denied or cleared; desktop/mobile checks pass |
| U16 | P1 | Add read-only local installation and scope preflight | U10, U13 | Supported runtime/assets and exact browser candidates are checked without launching tools, reading private stores, or repairing files; unavailable states and current product limits remain explicit |

The purchase appendix additionally requires R15. The investment appendix additionally requires R17. Each module can operate within its own research scope.

## 8. Mandatory adversarial checks

These checks test the future implementation. They are not claims about tests already completed.

| ID | Check | Required result |
|---|---|---|
| T01 | App content asks the agent to change its policy | Gateway permissions remain unchanged |
| T02 | Two customers request each other's evidence | Both cross-tenant requests fail |
| T03 | A customer actor requests source code or the private roadmap | The request fails and is recorded |
| T04 | Two specialists reserve the final budget simultaneously | The cap remains enforced |
| T05 | A worker crashes after an action | Recovery checks app state before repeating side effects |
| T06 | An app error cannot be reproduced | The finding shows disputed or limited evidence |
| T07 | An evidence link has no source | Report validation fails |
| T08 | The app build changes mid-run | Coverage is restricted or the affected task restarts explicitly |
| T09 | An agent cites another agent as human evidence | Source validation rejects the claim |
| T10 | Research permission expires | Affected use is restricted and lineage is identified |
| T11 | A run reaches its time or spending limit | New work stops and partial results show missing coverage |
| T12 | A model performs poorly for one segment | The validity card exposes and restricts that scope |
| T13 | Retrieval requests a held-out human answer before prediction lock | Access fails across grounding, tuning, actor, and evaluator contexts |
| T14 | An initial analyst requests another team's findings | Access fails until the phase permits disclosure |
| T15 | A reproducible event has no supported expected result | The event remains an observation; defect status is withheld |
| T16 | An instance combines unsupported attributes | Validation rejects it or applies an exploratory scenario label |
| T17 | Investigation consumes its full allowance | Verification and report reserves still support closure |
| T18 | A retry attempts to alter sealed output or skip verification | The lifecycle guard rejects the transition |
| T19 | A download link or cache references revoked evidence | Current permission checks deny the request |
| T20 | A provider fails during final synthesis | Stored records produce a factual partial report |
| T21 | A buyer lacks modeled funds, payment access, or required approval | Purchase completion is blocked; the reason remains visible |
| T22 | An attractive startup fails an investor's mandate | The actor can pass despite a favorable product assessment |
| T23 | An investor lacks authority or required diligence | A recommendation cannot become final approval |
| T24 | A decision lacks material pricing, terms, or evidence | The actor requests information, defers, or states conditions |
| T25 | A simulated purchase or invest verdict enters a report | It retains its simulated label and creates no real commitment |
| T26 | Evaluation equates diligence interest with investment | Stage validation rejects the comparison |
| T27 | Agent counts are presented as conversion or funding probability | Report validation rejects the unsupported population claim |

## 9. First demonstration procedure

1. Select an authorized staging app.
2. Select one critical journey.
3. Freeze the study manifest.
4. Execute the journey with an isolated test identity.
5. Capture the action sequence and result.
6. Create a typed claim.
7. Repeat the relevant test independently.
8. Generate a finding with supporting evidence.
9. State the affected stakeholder goal.
10. Label any business implication as a hypothesis.
11. Propose a fix or experiment.
12. Show the result in a concise decision brief.

This demonstration validates the evidence path. A separate demonstration must validate stakeholder behavior against human observations.

## 10. Controlled-pilot release gate

The release review must cover:

- Evidence integrity and claim typing.
- Tool policy and tenant isolation.
- Bounded delegation and budget enforcement.
- Recovery, cancellation, and partial results.
- Independent finding verification.
- Equal-budget baseline results.
- Model provenance and limits when grounded actors are enabled.
- Held-out evaluation when validated predictions are enabled.
- Founder usefulness and measured review costs.

The research lead defines numerical behavioral thresholds before final testing. The engineering lead defines operational thresholds before the pilot load test.

The product lead records the final scope. Any failed gate must lead to remediation or an explicit scope restriction.

App review can enter a paid pilot while behavioral research continues. A prediction claim requires R09 and R10.

Purchase prediction additionally requires R18. Investment prediction additionally requires R19. Each prediction type needs its own validity scope.

Subscription investment additionally requires C05. Longitudinal prediction requires R13.

## 11. Development kickoff inputs

The next development session needs an app, a decision, three journeys, and a target market. It also needs test access and a spending envelope.

These inputs complete B01. The team can then implement the evidence path and start the research protocol in parallel.

No application code is included in this backlog.
