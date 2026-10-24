import test from "node:test";
import assert from "node:assert/strict";
import { createOpenAIAdapter, estimateCostMicrousd, actorActionSchema } from "../src/adapters/openai.ts";
import { InferenceBudgetError } from "../src/actor.ts";
import type { AdapterView, AdapterRequest } from "../src/actor.ts";

// Every HTTP response in this file is an authored fixture. No API key is loaded
// and no request reaches OpenAI or another external service.
const secret = "fixture-private-key";
const scope = { country: "synthetic", language: "en", segment: "fixture", category: "software", decision: "fixture" };
const view: AdapterView = { model: { id: "fixture", version: "1", domain: "consumer", scope, sourceIds: ["source"], goals: ["Test adapter mechanics"], constraints: ["Use fixture data"], knownInformation: [], decisionRules: ["Inspect before deciding"], limitations: ["Synthetic fixture"], hash: "fixture-hash", createdAt: "2026-01-01T00:00:00.000Z", status: "draft" }, scenario: { id: "scenario", actorRef: "actor", scope, decisionBody: null }, availableReads: [{ ref: "budget", label: "Fixture budget", kind: "scenario_fact" }], observations: [], constraints: [] };
const request = (): AdapterRequest => ({ signal: new AbortController().signal, maximumOutputChars: 5000, remainingTokens: 1000, maximumCostMicrousd: 10000 });
const providerResponse = (overrides: Record<string, unknown> = {}) => ({ id: "resp_fixture", model: "fixture-model-snapshot", status: "completed", usage: { input_tokens: 100, output_tokens: 30 }, output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ type: "inspect", ref: "budget", decision: null }) }] }], ...overrides });
function fixtureTransport(generation: unknown = providerResponse(), count: unknown = { input_tokens: 100 }) {
  const calls: { url: string; options: RequestInit; body: Record<string, unknown> }[] = [];
  const transport: typeof fetch = async (url, options) => {
    assert(options); const body = JSON.parse(String(options.body)) as Record<string, unknown>;
    calls.push({ url: String(url), options, body });
    return new Response(JSON.stringify(String(url).endsWith("/input_tokens") ? count : generation), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const adapter = createOpenAIAdapter({ apiKey: secret, model: "fixture-model", inputMicrousdPerMillionTokens: 2000000, outputMicrousdPerMillionTokens: 8000000, maximumOutputTokens: 300, transport });
  return { calls, adapter };
}

test("adapter counts exact request input before generation, bounds output, and excludes credentials from metadata", async () => {
  const { adapter, calls } = fixtureTransport();
  const result = await adapter.next(view, request()) as { action: unknown; usage: unknown };
  assert.deepEqual(result.action, { type: "inspect", ref: "budget" });
  assert.deepEqual(result.usage, { inputTokens: 100, outputTokens: 30, costMicrousd: 440 });
  assert.equal(calls.length, 2); assert.equal(calls[0]?.url, "https://api.openai.com/v1/responses/input_tokens");
  assert.equal(calls[1]?.url, "https://api.openai.com/v1/responses");
  assert.equal(calls[1]?.body.max_output_tokens, 300); assert.equal(calls[1]?.body.store, false);
  const { max_output_tokens, store, ...generatedInput } = calls[1]!.body;
  assert.deepEqual(calls[0]?.body, generatedInput);
  assert.equal(calls[0]?.options.redirect, "error"); assert.equal(calls[1]?.options.signal?.aborted, false);
  assert(!JSON.stringify(adapter).includes(secret)); assert(!JSON.stringify(calls.map(call => call.body)).includes(secret));
  assert.equal(adapter.costBasis, "configured_rate_estimate");
});

test("preflight prevents generation when input or estimated cost cannot fit", async () => {
  for (const budget of [{ remainingTokens: 100, maximumCostMicrousd: 10000 }, { remainingTokens: 1000, maximumCostMicrousd: 201 }]) {
    const { adapter, calls } = fixtureTransport();
    await assert.rejects(adapter.next(view, { ...request(), ...budget }), InferenceBudgetError);
    assert.equal(calls.length, 1);
  }
});

test("empty reservations cause no provider request, including token counting", async () => {
  const { adapter, calls } = fixtureTransport();
  await assert.rejects(adapter.next(view, { ...request(), maximumCostMicrousd: 0 }), InferenceBudgetError);
  assert.equal(calls.length, 0);
});

test("preflight drift preserves actual usage and blocks action acceptance", async () => {
  const { adapter } = fixtureTransport(providerResponse({ usage: { input_tokens: 101, output_tokens: 30 } }));
  const result = await adapter.next(view, request()) as { error: { code: string }; usage: { inputTokens: number }; action: unknown };
  assert.equal(result.error.code, "preflight_mismatch"); assert.equal(result.usage.inputTokens, 101); assert.equal(result.action, null);
});

test("preflight reduces output allowance to remaining token and cost reservations", async () => {
  const tokenLimited = fixtureTransport();
  await tokenLimited.adapter.next(view, { ...request(), remainingTokens: 125 });
  assert.equal(tokenLimited.calls[1]?.body.max_output_tokens, 25);
  const costLimited = fixtureTransport();
  await costLimited.adapter.next(view, { ...request(), maximumCostMicrousd: 360 });
  assert.equal(costLimited.calls[1]?.body.max_output_tokens, 20);
});

test("refusal and incomplete output preserve known usage without accepting actions", async () => {
  for (const [response, code] of [[providerResponse({ status: "incomplete" }), "incomplete"], [providerResponse({ output: [{ type: "message", content: [{ type: "refusal", refusal: "Fixture refusal" }] }] }), "refused"]] as const) {
    const { adapter } = fixtureTransport(response);
    const result = await adapter.next(view, request()) as { action: unknown; usage: { costMicrousd: number }; error: { code: string } };
    assert.equal(result.action, null); assert.equal(result.error.code, code); assert.equal(result.usage.costMicrousd, 440);
  }
});

test("malformed JSON and unsupported action envelopes return invalid-output receipts", async () => {
  for (const text of ["not json", JSON.stringify({ type: "inspect", ref: "budget", decision: null, tools: ["shell"] }), JSON.stringify({ type: "decide", ref: "budget", decision: {} })]) {
    const { adapter } = fixtureTransport(providerResponse({ output: [{ type: "message", content: [{ type: "output_text", text }] }] }));
    const result = await adapter.next(view, request()) as { action: unknown; error: { code: string }; usage: { inputTokens: number } };
    assert.equal(result.action, null); assert.equal(result.error.code, "invalid_output"); assert.equal(result.usage.inputTokens, 100);
  }
});

test("HTTP failures are redacted and do not retry inference requests", async () => {
  let calls = 0;
  const transport: typeof fetch = async () => { calls++; return new Response(JSON.stringify({ error: { message: secret } }), { status: 429 }); };
  const adapter = createOpenAIAdapter({ apiKey: secret, model: "fixture-model", inputMicrousdPerMillionTokens: 1, outputMicrousdPerMillionTokens: 1, maximumOutputTokens: 100, transport });
  await assert.rejects(adapter.next(view, request()), error => error instanceof Error && error.message.includes("429") && !error.message.includes(secret));
  assert.equal(calls, 1);
});

test("missing usage is not treated as zero-cost output", async () => {
  const { adapter } = fixtureTransport(providerResponse({ usage: null }));
  await assert.rejects(adapter.next(view, request()), /usage receipt is missing/);
});

test("cost estimates use integer ceiling arithmetic without floating-point undercount", () => {
  assert.equal(estimateCostMicrousd(1, 0, 1, 1), 1);
  assert.equal(estimateCostMicrousd(100, 30, 2000000, 8000000), 440);
  assert.equal(estimateCostMicrousd(1000000, 1000000, 1234567, 7654321), 8888888);
  assert.throws(() => estimateCostMicrousd(-1, 0, 1, 1));
});

test("strict action schema keeps coordinator identities outside generated decision bodies", () => {
  const schema = actorActionSchema("investor");
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, ["type", "ref", "decision"]);
  const decision = (schema.properties.decision as { anyOf: { properties?: Record<string, unknown>; required?: string[] }[] }).anyOf[0]!;
  assert(decision.required?.includes("conditions")); assert(!decision.required?.includes("model")); assert(!decision.required?.includes("decisionBody"));
});
