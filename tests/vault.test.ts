import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, unlink, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { encryptLocal, decryptLocal } from "../src/vault.ts";

test("vault binds ciphertext to its record and authenticates modified data", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-vault-"));
  try {
    const encrypted = encryptLocal(directory, "record-a", "private payload");
    assert.equal(decryptLocal(directory, "record-a", encrypted), "private payload");
    assert.throws(() => decryptLocal(directory, "record-b", encrypted));
    const modified = JSON.parse(encrypted) as { body: string };
    modified.body = Buffer.from("tampered").toString("base64");
    assert.throws(() => decryptLocal(directory, "record-a", JSON.stringify(modified)));
    await unlink(resolve(directory, "session.key"));
    assert.throws(() => decryptLocal(directory, "record-a", encrypted));
    await assert.rejects(access(resolve(directory, "session.key")));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
