# Live inference integration: next milestone

Status: researched design; not implemented or configured.

The current runtime has a provider-neutral adapter and usage receipt contract. Its packaged adapter is a software script. No API key was loaded and no live inference request was made during this milestone.

Before enabling an external provider:

1. Add an explicit external-processing permission to research sources and scenarios. Default existing records to local-only processing. Check derived model content as well as raw excerpts before any provider request.
2. Configure model identity and credentials outside reports. Verify current availability and rates. Do not invent a default model or reuse desktop authentication tokens.
3. Add exact input-token preflight and a bounded output allowance. Compare the requested token and cost liability with the remaining run reservation before dispatch.
4. Use structured action output. Handle refusal, incomplete output, malformed actions, and unknown usage without accepting a complete decision.
5. Keep configured-rate estimates distinct from provider billing receipts. Reconcile late receipts; failed calls must not silently count as free.
6. Verify request building, permission denial, refusal, accounting, timeouts, and redaction with a fake transport before a live smoke test.
7. Add an explicit terminal command for configured live runs and keep the existing fixture command unchanged.

Official OpenAI documentation checked during planning:

- [Counting tokens](https://developers.openai.com/api/docs/guides/token-counting): the input-count endpoint accepts Responses input and accounts for request structure. Use that count instead of a character estimate.
- [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs): use a supported strict schema and handle refusal and incomplete responses separately.

These API features do not establish psychological validity or authorize external processing of participant data. Research permissions and independent evaluation remain separate requirements.
