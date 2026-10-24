import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { WorkspaceStore } from "../src/workspace.ts";
import { grantAccess, authorizeGrant, readGrantedSession, isGrantActive } from "../src/access.ts";

async function temporary(work: (store: WorkspaceStore, directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-access-"));
  const store = new WorkspaceStore(directory);
  try { await work(store, directory); } finally { store.close(); await rm(directory, { recursive: true, force: true }); }
}
const web = { name: "Pilot", target: "https://app.example.test", kind: "web" as const, capabilities: ["browser:read"] };
const session = { cookies: [{ name: "session", value: "private-session-value", domain: "app.example.test", path: "/", expires: -1, httpOnly: true, secure: true, sameSite: "Lax" }], origins: [{ origin: "https://app.example.test", localStorage: [{ name: "account", value: "private-account-value" }] }] };

test("session imports are encrypted, private on disk, and absent from public grant metadata", async () => temporary(async (store, directory) => {
  const grant = grantAccess(store, { ...web, storageState: session });
  assert.equal(grant.hasSession, true);
  assert.deepEqual(readGrantedSession(store, grant.id), session);
  assert(!store.encryptedSession(grant.id)?.includes("private-session-value"));
  assert(!JSON.stringify(store.grants()).includes("private-account-value"));
  const db = await readFile(resolve(directory, ".redteam/workspace.sqlite-wal"));
  assert(!db.includes(Buffer.from("private-session-value")));
  if (process.platform !== "win32") {
    assert.equal((await stat(resolve(directory, ".redteam/session.key"))).mode & 0o077, 0);
    assert.equal((await stat(resolve(directory, ".redteam/workspace.sqlite"))).mode & 0o077, 0);
  }
}));

test("revocation removes stored sessions, denies access, and records an audit event", async () => temporary(async store => {
  const grant = grantAccess(store, { ...web, storageState: session });
  store.revokeGrant(grant.id);
  assert.equal(store.encryptedSession(grant.id), null);
  assert.equal(store.grant(grant.id)?.hasSession, false);
  assert.throws(() => authorizeGrant(store, grant.id, "browser:read", web.target), /revoked/);
  assert.throws(() => readGrantedSession(store, grant.id), /revoked/);
  assert.deepEqual(store.auditLog().map(event => event.action), ["grant_revoked", "grant_created"]);
}));

test("grants enforce exact origins, capabilities, and expiry", async () => temporary(async store => {
  const grant = grantAccess(store, web);
  assert.equal(authorizeGrant(store, grant.id, "browser:read", `${web.target}/pricing`).id, grant.id);
  assert.throws(() => authorizeGrant(store, grant.id, "browser:interact", web.target), /outside/);
  assert.throws(() => authorizeGrant(store, grant.id, "browser:read", "https://elsewhere.example.test"), /outside/);
  assert.throws(() => authorizeGrant(store, grant.id, "browser:read", "https://user:password@app.example.test"), /Credentials/);
  assert.equal(isGrantActive({ ...grant, expiresAt: new Date(0).toISOString() }), false);
  const expired = { ...grant, id: "expired-test-grant", expiresAt: new Date(0).toISOString() };
  store.addGrant(expired, null);
  assert.throws(() => authorizeGrant(store, expired.id, "browser:read", web.target), /expired/);
}));

test("grant input rejects ambiguous origins, excess duration, and capability mismatch", async () => temporary(async store => {
  for (const target of ["https://user:secret@app.example.test", "https://app.example.test/path", "https://app.example.test?key=secret", "file:///tmp"]) {
    assert.throws(() => grantAccess(store, { ...web, target }));
  }
  for (const expiresInHours of [0, -1, 721, NaN]) assert.throws(() => grantAccess(store, { ...web, expiresInHours }));
  assert.throws(() => grantAccess(store, { ...web, capabilities: ["code:test"] }), /directory/);
  assert.throws(() => grantAccess(store, { ...web, capabilities: ["shell:execute"] }), /supported/);
}));

test("import rejects sessions outside the granted target before persistence", async () => temporary(async store => {
  assert.throws(() => grantAccess(store, { ...web, storageState: { ...session, cookies: [{ ...session.cookies[0], domain: "unrelated.test" }] } }), /outside/);
  assert.throws(() => grantAccess(store, { ...web, storageState: { ...session, origins: [{ origin: "https://elsewhere.test" }] } }), /outside/);
  assert.throws(() => grantAccess(store, { ...web, storageState: { cookies: null, origins: [] } }), /storage state/);
  assert.equal(store.grants().length, 0);
}));

test("directory grants resolve actual directories and reject browser sessions", async () => temporary(async (store, directory) => {
  const grant = grantAccess(store, { ...web, target: directory, kind: "directory", capabilities: ["code:read", "code:test"] });
  assert.equal(authorizeGrant(store, grant.id, "code:test", directory).id, grant.id);
  assert.throws(() => grantAccess(store, { ...web, target: directory, kind: "directory", capabilities: ["code:read"], storageState: session }), /web grant/);
  assert.throws(() => grantAccess(store, { ...web, target: directory, kind: "directory" }), /web grant/);
}));
