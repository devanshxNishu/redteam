import test from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { withinDeadline } from "../src/deadline.ts";
import { LimitError } from "../src/policy.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

test("successful work returns its value without late cleanup", async () => {
  const resource = { id: "ready" };
  let disposed = false;
  const actual = await withinDeadline(Promise.resolve(resource), 1000, "Launch", () => { disposed = true; });
  assert.equal(actual, resource);
  assert.equal(disposed, false);
});

test("work rejection preserves the original error", async () => {
  const failure = new Error("Launch failed");
  await assert.rejects(withinDeadline(Promise.reject(failure), 1000, "Launch"), error => error === failure);
});

test("stalled work rejects with a labeled LimitError", { timeout: 1000 }, async () => {
  await assert.rejects(
    withinDeadline(new Promise<never>(() => undefined), 10, "Browser launch"),
    error => error instanceof LimitError && /Browser launch.*deadline/.test(error.message),
  );
});

test("a resource resolved after timeout is disposed exactly once", { timeout: 1000 }, async () => {
  const work = deferred<{ id: string }>();
  const disposed: { id: string }[] = [];
  await assert.rejects(withinDeadline(work.promise, 10, "Launch", value => { disposed.push(value); }), LimitError);
  const resource = { id: "late" };
  work.resolve(resource);
  await setImmediate();
  assert.deepEqual(disposed, [resource]);
});

test("late work rejection is consumed", { timeout: 1000 }, async () => {
  const work = deferred<never>();
  await assert.rejects(withinDeadline(work.promise, 10, "Launch"), LimitError);
  work.reject(new Error("Late launch failure"));
  await setImmediate();
});

test("rejected late cleanup does not leak an unhandled rejection", { timeout: 1000 }, async () => {
  const work = deferred<string>();
  let invoked = false;
  await assert.rejects(withinDeadline(work.promise, 10, "Launch", () => {
    invoked = true;
    return Promise.reject(new Error("Cleanup failed"));
  }), LimitError);
  work.resolve("late resource");
  await setImmediate();
  assert.equal(invoked, true);
});

test("a synchronous late cleanup failure is consumed", { timeout: 1000 }, async () => {
  const work = deferred<string>();
  let invoked = false;
  await assert.rejects(withinDeadline(work.promise, 10, "Launch", () => {
    invoked = true;
    throw new Error("Cleanup threw");
  }), LimitError);
  work.resolve("late resource");
  await setImmediate();
  assert.equal(invoked, true);
});

test("hung late cleanup never delays the timed-out caller", { timeout: 1000 }, async () => {
  const work = deferred<string>();
  let invoked = false;
  await assert.rejects(withinDeadline(work.promise, 10, "Launch", () => {
    invoked = true;
    return new Promise<void>(() => undefined);
  }), LimitError);
  work.resolve("late resource");
  await setImmediate();
  assert.equal(invoked, true);
});
