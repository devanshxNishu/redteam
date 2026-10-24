import { createOpenAIAdapter } from "./adapters/openai.ts";

export interface PublicOpenAIConfiguration {
  provider: "openai";
  model: string;
  inputUsdPerMillion: string;
  outputUsdPerMillion: string;
  maximumOutputTokens: number;
}
function rate(input: unknown, label: string): { text: string; microusd: number } {
  if (typeof input !== "string" || !/^\d+(\.\d{1,6})?$/.test(input)) throw new Error(`${label} requires an explicit USD decimal string, with at most six decimal places.`);
  const [whole, fraction = ""] = input.split(".");
  const value = BigInt(whole!) * 1000000n + BigInt(fraction.padEnd(6, "0"));
  if (value < 1n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${label} is outside supported pricing bounds.`);
  return { text: input, microusd: Number(value) };
}
export function configureInference(input: unknown, apiKey: string | undefined, transport?: typeof fetch) {
  if (!input || typeof input !== "object" || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new Error("Inference configuration requires a plain JSON object.");
  const keys = ["provider", "model", "inputUsdPerMillion", "outputUsdPerMillion", "maximumOutputTokens"];
  if (Reflect.ownKeys(input).some(key => typeof key !== "string" || !keys.includes(key)) || Object.values(Object.getOwnPropertyDescriptors(input)).some(item => !("value" in item))) throw new Error("Unsupported inference configuration field. Keep credentials in OPENAI_API_KEY.");
  const value = input as Record<string, unknown>;
  if (value.provider !== "openai") throw new Error("The configured provider must be openai.");
  const inputRate = rate(value.inputUsdPerMillion, "Input rate"); const outputRate = rate(value.outputUsdPerMillion, "Output rate");
  const adapter = createOpenAIAdapter({ apiKey: apiKey ?? "", model: value.model as string, inputMicrousdPerMillionTokens: inputRate.microusd, outputMicrousdPerMillionTokens: outputRate.microusd,
    maximumOutputTokens: value.maximumOutputTokens as number, ...(transport ? { transport } : {}) });
  const configuration: PublicOpenAIConfiguration = { provider: "openai", model: value.model as string, inputUsdPerMillion: inputRate.text, outputUsdPerMillion: outputRate.text, maximumOutputTokens: value.maximumOutputTokens as number };
  return { adapter, configuration };
}
