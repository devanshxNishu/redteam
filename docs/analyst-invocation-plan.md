# Next analyst slice: durable phase invocation control

After 0.31.0, add an analyst-specific coordinator primitive over the generic BudgetLedger and isolated AnalystTask. Do not cast packet/generation data into actor views or actions. HTTP transport and analytical publication/recovery remain later integration.

Require a freshly prepared manifest and a matching active one-attempt analyst task, including run/task IDs, question key, exact manifest digest and deadline. Create one budget run with the manifest's derived cap and separate count/generation maxima. Never adopt or reopen an existing run. Use deterministic per-run phase invocation IDs, one count followed by at most one generation, no concurrent duplicates or replay.

Before each callback, check source/task/inference deadline, record intent, reserve the exact phase cap, check again and mark dispatch. A failure known before dispatch may release only its own still-reserved record. Once callback dispatch is possible, retain liability unless a suitable trusted receipt settles it. No cross-store transaction exists; conservative partial records remain factual.

Counting returns input token count, not a billing receipt. Always preserve its full cap as unknown liability after possible count dispatch, including a successful count. Validate counted tokens before allowing generation. Generation may settle a bounded, descriptor-safe trusted transport receipt, including when output/source is rejected. Missing/invalid receipts retain liability. An overrun remains recorded and closes dispatch through BudgetLedger. Never accept model-authored receipt data as trusted usage.

Combine task ownership, explicit inference deadline and local close signals. A stalled callback cannot keep the caller pending after abort. If a late trusted generation receipt arrives, settle factual liability without returning/promoting its stale candidate. Current source/task checks must follow response settlement. No automatic retry, report publication, semantic approval or task completion belongs here. Explicit close aborts and closes the budget conservatively; the coordinator separately closes ownership.

Test actual stores with authored callbacks: exact task/manifest/cap binding, source denial before state, duplicate/concurrent phase denial, successful count held liability, pre-send reservation failure, cancellation/expiry, missing/invalid and late receipts, overrun, closed/restarted budget, no automatic replay or task completion. Callback mechanics are not real provider verification. Follow full regression/package/installed/private-push checks before release.

Official primary sources were refreshed with the OpenAI Docs workflow. The token-count guide describes `POST /v1/responses/input_tokens` and its returned count; it is not used here as a cost receipt. Structured Outputs documents refusal/incomplete cases and possible mistakes. These guides support later transport design, not live compatibility or current pricing. The create-reference page exceeded the web retrieval size; its Markdown form was unsupported. No unverified reference content was used.

- https://developers.openai.com/api/docs/guides/token-counting
- https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses
