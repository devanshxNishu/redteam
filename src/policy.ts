export class PolicyError extends Error {}
export class LimitError extends Error {}

export class FixturePolicy {
  readonly origin: string;
  readonly maxRequests: number;
  requests = 0;
  limitReached = false;
  denials: string[] = [];

  constructor(origin: string, maxRequests: number) {
    const url = new URL(origin);
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || url.origin !== origin) {
      throw new PolicyError("Only an exact local fixture origin is permitted.");
    }
    this.origin = origin;
    this.maxRequests = maxRequests;
  }

  checkDestination(address: string, method = "GET"): void {
    let url: URL;
    try { url = new URL(address); } catch { throw new PolicyError("Invalid destination."); }
    if (url.origin !== this.origin || url.protocol !== "http:" || url.username || url.password) {
      throw new PolicyError(`Destination denied: ${address}`);
    }
    if (!["GET", "POST"].includes(method)) throw new PolicyError(`Method denied: ${method}`);
  }

  request(address: string, method: string): boolean {
    try {
      this.checkDestination(address, method);
      if (this.requests >= this.maxRequests) throw new LimitError("Network request limit reached.");
      this.requests++;
      return true;
    } catch (error) {
      if (error instanceof LimitError) this.limitReached = true;
      this.denials.push(error instanceof Error ? error.message : "Request denied.");
      return false;
    }
  }
}

export class ExecutionBudget {
  readonly startedAt = performance.now();
  readonly maxSteps: number;
  readonly timeoutMs: number;
  steps = 0;

  constructor(maxSteps: number, timeoutMs: number) {
    this.maxSteps = maxSteps;
    this.timeoutMs = timeoutMs;
  }

  beginStep(): void {
    this.remainingMs();
    if (this.steps >= this.maxSteps) throw new LimitError("Journey step limit reached.");
    this.steps++;
  }

  remainingMs(): number {
    const remaining = Math.floor(this.timeoutMs - (performance.now() - this.startedAt));
    if (remaining <= 0) throw new LimitError("Execution deadline reached.");
    return remaining;
  }
}
