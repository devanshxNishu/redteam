import test from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import { createFixture, fixtureBuildHash } from "../src/fixture.ts";

test("fixture build IDs are stable for loaded code and distinct between variants", async () => {
  assert.equal(await fixtureBuildHash("broken"), await fixtureBuildHash("broken"));
  assert.notEqual(await fixtureBuildHash("broken"), await fixtureBuildHash("fixed"));
});

test("an interrupted POST does not terminate the fixture server", { timeout: 5000 }, async () => {
  const fixture = await createFixture("fixed");
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Fixture abort did not complete")), 2000);
      const req = request(`${fixture.origin}/signup`, { method: "POST", headers: { "Content-Length": "1000", "Content-Type": "application/x-www-form-urlencoded" } });
      req.on("error", () => { clearTimeout(timer); resolve(); });
      req.on("socket", socket => socket.once("connect", () => {
        req.write("name=Demo&email=demo%40example.test");
        setTimeout(() => req.destroy(new Error("Intentional request interruption")), 10);
      }));
    });
    const response = await fetch(fixture.origin);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Start your pilot/);
  } finally { await fixture.close(); }
});
