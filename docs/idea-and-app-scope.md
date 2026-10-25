# Ideas and apps: active product scope

The active scope is **ideas and apps**. The user confirmed this scope on October 25, 2026. CVs, general services, and other review subjects are outside current development. A website can be the interface of an app; this does not add a separate general website review mode.

This document is a development plan. It does not claim that idea review, open app execution, a live roundtable, or validated stakeholder predictions already work. The current runner executes only the controlled local signup fixture.

## Two subject types, one evidence system

| Subject | Supplied input | Review purpose | Evidence limit |
|---|---|---|---|
| Idea | Problem, proposed solution, audience, alternatives, business model, assumptions, and a decision | Find weak assumptions, missing proof, objections, and useful next tests | An idea description is an operator claim; it does not prove demand, feasibility, or investment interest |
| App | Product context, available access, critical journey, requirements, and a decision | Check actual behavior within granted scope, then connect results to product and business questions | Each result applies to the tested build, environment, journey, and evidence |

An idea does not need an app URL or repository. A future app review can also examine its underlying idea. The system must preserve which conclusions came from supplied context, actual observation, a source, an assumption, or an analytical objection.

## First implementation: review brief and scope preview

Version 0.25.0 implements the [terminal intake contract](review-briefs.md). Version 0.26.0 adds the protected local creation/catalog/detail API. Version 0.27.0 adds explicit web intake and literal checked detail. Bounded evidence-linked analyst review is next. It uses a strict versioned input with `subjectType` equal to `idea` or `app`. Use separate subject fields so an idea cannot acquire fictional app evidence. The common brief states a title, the decision to support, target users and buyers, market/language when known, and supplied evidence or explicit unknowns. Use bounded plain text and bounded arrays. Reject unknown fields and unsupported subjects.

Idea fields state the problem, solution, current alternatives, value proposition, business model, distribution, differentiation, and assumptions. App fields state product purpose, a critical journey, expected behavior, and an optional URL as a supplied reference. Store the exact normalized brief with fixed provenance labels and a version/hash. A future revision creates another immutable brief.

The first scope preview is deterministic. It shows the declared subject, requested decision, supplied coverage, missing inputs, relevant review tracks, and unavailable execution. It performs no market research or tool/model call. It must not label a saved brief as a completed review.

Terminal preview/add/list/show is implemented first, followed by protected local API and explicit web intake. The intake must not fetch the URL, open a supplied file, import credentials, grant access, run target code, or start a review automatically. Existing access grants and their separate execution gates remain in force. Supplied text can contain private information; there is no universal detector.

## Review tracks after intake

| Track | Idea questions | App questions |
|---|---|---|
| Product | Who has this problem? What useful result changes? | Can the target user reach that result? |
| Engineering | What must be possible? Which assumptions need a prototype? | Which observed failures or scoped source evidence support a finding? |
| Customer and buyer | What alternatives, price constraints, trust needs, and approval steps matter? | Where do users understand, compare, try, stop, or ask for help? |
| Commercial | How might acquisition, delivery, retention, costs, and pricing work? | What evidence supports the proposed route to revenue? |
| Investor preparation | What stage, mandate, risks, and proof would a defined investor lens inspect? | Which product results and business records answer diligence questions? |
| Verification | Which claims are supported, contradicted, conditional, or unknown? | Can the material app result be reproduced within scope? |

These tracks define questions, not implemented agents. An analyst lens can produce labeled objections before stakeholder research is complete. It must not impersonate a real consumer or investor, claim psychological validity, or report an actual purchase or funding decision.

## Consumer and investor behavior

The later consumer module studies need, alternatives, urgency, affordability, willingness and authority to pay, trust requirements, switching effort, payment access, and rejection or delay. A country is context for language, access, institutions, and researched variation; it is not a complete personality. Unsupported segment attributes remain assumptions. Country population proportions require suitable sampling and evaluation.

The later investor module uses a stated stage, sector, mandate, portfolio constraints, risk criteria, diligence needs, and available business proof. Its outputs can be a simulated decline, further diligence, conditional interest, or insufficient information. A simulation is not a commitment, likelihood of funding, or a named investor's decision. Consumer and investor prediction each need their own held-out human evaluation.

Specialists and subagents may later separate evidence collection, objections, and verification. Task count must follow useful work and bounded authority. Broad hierarchy stays behind C03 paid concierge demand, operating budgets, isolation, and the research/evaluation gates already in the master plan.

## Global context requirement

As requested on October 26, 2026, idea/app reviews must use relevant dated global news and trends with inspected sources, region/language applicability, explicit freshness and coverage limits, and conflicts. A headline is not demand, psychology or investor intent. The [global context plan](global-context-plan.md) defines source collection, immutable snapshots, packet integration and evaluation gates. This is planned; the current packet still contains only the checked supplied brief. No current-awareness or perfect-review claim is enabled.

## Report and next actions

The eventual report starts with the requested decision and the evidence available. It records material findings, objections, contradictions, unknowns, and the next useful experiment. Each material conclusion needs a source or an explicit assumption label. It states which tracks did not run.

An idea report should propose a small falsifiable test before development expense. An app report should prioritize reproduced problems and missing evidence. Neither subject receives an invented universal startup score, purchase demand, funding probability, or automatic approval. Existing checked record exports remain evidence appendices; they do not become a full idea or startup review merely because a brief exists.

Ready order: strict brief contract and terminal preview → protected API → explicit web intake → bounded evidence-linked analyst review → pilot evaluation of usefulness. Continue external app isolation and real research as separate dependencies. Missing external research, pilot accounts, live provider credentials, and paid demand must remain visible.
