import { randomUUID } from "node:crypto";
import { BudgetDeniedError, BudgetLedger } from "./budget.ts";
import type { BudgetAmount } from "./budget.ts";
import { InferenceBudgetError } from "./actor.ts";
import type { InferenceAdapter } from "./actor.ts";

/** Short-lived connections let a late receipt settle after the actor has stopped. */
function useLedger<T>(workspace: string, work: (ledger: BudgetLedger) => T): T {
  const ledger = new BudgetLedger(workspace);
  try { return work(ledger); } finally { ledger.close(); }
}
function usageReceipt(raw: unknown): BudgetAmount | null {
  if (!raw || typeof raw !== "object") return null;
  const usage: unknown = Object.getOwnPropertyDescriptor(raw, "usage")?.value;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return null;
  const fields = Object.getOwnPropertyDescriptors(usage);
  const input: unknown = fields.inputTokens?.value, output: unknown = fields.outputTokens?.value, cost: unknown = fields.costMicrousd?.value;
  if (typeof input !== "number" || typeof output !== "number" || typeof cost !== "number"
    || ![input, output, cost, input + output].every(value => Number.isSafeInteger(value) && value >= 0)) return null;
  return { tokens: input + output, costMicrousd: cost };
}

/** Reserves the entire request allowance. Concurrent callers cannot reuse it. */
export function withDurableBudget(workspace: string, runId: string, taskRef: string, adapter: InferenceAdapter, guard?: { beforeDispatch(id: string): void; assertActive(): void }): InferenceAdapter {
  return { ...adapter, next: async (view, request) => {
    const id = randomUUID();
    try {
      guard?.beforeDispatch(id);
      useLedger(workspace, ledger => {
        ledger.reserve({ id, runId, taskRef, pool: "investigation", pricingRef: adapter.configurationHash ?? adapter.id,
          maximum: { tokens: request.remainingTokens, costMicrousd: request.maximumCostMicrousd } });
        try { guard?.assertActive(); ledger.dispatch(id); }
        catch (error) {
          // Release only if the record still proves dispatch never started.
          try { ledger.release(id); } catch { /* A possible dispatch retains its liability. */ }
          throw error;
        }
      });
    } catch (error) {
      if (error instanceof BudgetDeniedError) throw new InferenceBudgetError("Durable budget denied dispatch.");
      throw error;
    }
    const uncertain = () => {
      // If a database write fails, the durable in-flight reservation still holds
      // its full liability. Abort handlers must never throw into the event loop.
      try { useLedger(workspace, ledger => ledger.uncertain(id)); } catch { /* Retain the in-flight liability. */ }
    };
    request.signal.addEventListener("abort", uncertain, { once: true });
    try {
      if (request.signal.aborted) {
        useLedger(workspace, ledger => ledger.settle(id, { tokens: 0, costMicrousd: 0 }));
        throw new Error("The actor stopped before adapter dispatch.");
      }
      // A guard failure here is known to precede the actual adapter call.
      try { guard?.assertActive(); }
      catch (error) { useLedger(workspace, ledger => ledger.settle(id, { tokens: 0, costMicrousd: 0 })); throw error; }
      const raw = await adapter.next(view, request);
      const usage = usageReceipt(raw);
      if (usage) useLedger(workspace, ledger => ledger.settle(id, usage)); else uncertain();
      return raw;
    } catch (error) { uncertain(); throw error; }
    finally { request.signal.removeEventListener("abort", uncertain); }
  } };
}
