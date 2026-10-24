# Configured inference

Status: implemented and verified with an injected fake transport. A live API smoke test has not been performed. No real API credentials have been loaded.

## Configure an explicit run

Use the synthetic examples first. Register their source and model once:

For an installed package, `redteam examples` prints its bundled example directory. Use that path in place of `examples/` below. Copy the profile into your own workspace before editing it.

```sh
redteam research source add examples/inference-source.synthetic.json
redteam research model add examples/inference-model.synthetic.json
```

Copy `examples/openai-profile.example.json` to a local profile. Fill in a model you can access and its current input and output USD rates per million tokens. Rates must be positive decimal strings. No model or paid rate is selected automatically. Store the API key in `OPENAI_API_KEY`, outside the profile.

```sh
redteam actors run \
  --scenario examples/inference-scenario.synthetic.json \
  --limits examples/inference-limits.json \
  --config ./inference-profile.json
```

This command can make billable provider requests when configured. The example limits allow at most 12,000 reported tokens and US$0.05 at the configured rates. The cost limit is an estimate; it is not a provider billing cap. Verify account pricing and account controls before a paid run. Model availability and feature support require a live check.

The dashboard can inspect configured runs created through the terminal. Its run button continues to use the scripted fixture.

## Processing permission

Sources default to `local_only`, including legacy records. External inference requires `processing: external_model_allowed` on every model source, the scenario, and every fact. Derived model content is subject to its source permissions. These flags are distinct from training permission.

Source records remain immutable. A changed processing permission requires a new source record and an appropriate model version. Permission flags are operator declarations; they do not authenticate participant consent or establish a provider data-handling agreement.

## Request and response controls

The OpenAI adapter counts the same input and schema before generation. It then bounds output tokens against the remaining token and configured-rate reservation. Empty reservations cause no provider request. Redirects are denied and failed requests are not retried automatically.

Strict action output remains subject to the runtime's knowledge, identity, evidence, coordinator-constraint, and decision checks. Add trusted constraint declarations to the scenario before requesting a positive purchase or investment action; the bundled scenario demonstrates an affordability barrier. Refusal, incomplete output, malformed actions, and token-count drift cannot produce an accepted decision. Known usage is retained on these failures. Missing receipts retain an unknown-cost marker.

Reports record the requested configuration hash, provider response identifier, returned model identifier, preflight count, output allowance, and usage where available. Cost uses integer ceiling arithmetic and operator-configured rates. Keys and HTTP authorization headers are excluded from reports.

Configured runs reserve their remaining token and estimated-cost allowance in a durable local ledger before each adapter call. Unknown usage stays reserved after failure, timeout, cancellation, and restart. Known refusal usage still settles. Reports contain a budget snapshot; `redteam budgets show RUN_ID` reads later reconciliation. This ledger does not impose a provider billing cap. See `docs/budget-ledger.md` for details.

Current research permissions also apply when reading earlier reports. Withdrawal restricts dependent report access and redacts model content from summaries. Local raw files and previously exported copies are outside this managed retrieval boundary; secure erasure is not implemented.

## Limits of interpretation

An accepted response is a simulated decision. Reference checks and coordinator constraints establish traceability and consistency, rather than semantic truth or psychological realism. Constraint declarations still require independent evidence review. Human evaluation, live provider verification, authenticated billing reconciliation, complete task coordination, and production isolation remain additional work.

Official documentation used for implementation: [Counting tokens](https://developers.openai.com/api/docs/guides/token-counting) and [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
