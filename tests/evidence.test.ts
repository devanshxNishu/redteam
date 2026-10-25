import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { EvidenceStore, checkArtifacts } from "../src/evidence.ts";

test("artifact checks detect modification, missing files, and path escape", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-evidence-"));
  try {
    const store = await EvidenceStore.create(directory, "run-one");
    const artifact = await store.addBytes("primary", Buffer.from("real captured result"), "txt", "text/plain");
    assert.deepEqual(await checkArtifacts(store.root, [artifact]), []);
    await writeFile(resolve(store.root, artifact.path), "changed result");
    assert.match((await checkArtifacts(store.root, [artifact]))[0]!, /mismatch/);
    assert.match((await checkArtifacts(store.root, [{ ...artifact, path: "../../outside.txt" }]))[0]!, /escapes/);
    assert.match((await checkArtifacts(store.root, [{ ...artifact, path: "artifacts/missing.txt" }]))[0]!, /ENOENT/);
    await assert.rejects(() => EvidenceStore.create(directory, "../escape"), /Invalid run/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("artifact checks reject symlinks that escape the run", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-symlink-"));
  try {
    const store = await EvidenceStore.create(directory, "run-one");
    const artifact = await store.addBytes("primary", Buffer.from("result"), "txt", "text/plain");
    const outside = resolve(directory, "outside.txt");
    await writeFile(outside, "result");
    await symlink(outside, resolve(store.root, "artifacts/escape.txt"));
    const errors = await checkArtifacts(store.root, [{ ...artifact, path: "artifacts/escape.txt" }]);
    assert.match(errors[0]!, /Symlink escapes/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("sealed run records cannot be overwritten", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-record-"));
  try {
    const store = await EvidenceStore.create(directory, "run-one");
    await store.writeRecord("manifest.json", { version: 1 });
    await assert.rejects(() => store.writeRecord("manifest.json", { version: 2 }), /EEXIST/);
    assert.equal(JSON.parse(await readFile(resolve(store.root, "manifest.json"), "utf8")).version, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("record serialization failure creates neither a final record nor a staging file", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-record-input-"));
  try {
    const store = await EvidenceStore.create(directory, "run-one"), circular = { self: {} }; circular.self = circular;
    await assert.rejects(store.writeRecord("report.json", circular), /circular/i);
    await assert.rejects(store.writeRecord("report.json", undefined), /JSON-serializable/);
    assert.deepEqual(await readdir(store.root), ["artifacts"]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("record publication refuses final symlinks, including a dangling target", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-record-link-"));
  try {
    const store = await EvidenceStore.create(directory, "run-one"), outside = resolve(directory, "outside.json"), final = resolve(store.root, "report.json");
    await symlink(outside, final); await assert.rejects(store.writeRecord("report.json", { fixture: true }), { code: "EEXIST" });
    await assert.rejects(readFile(outside), /ENOENT/);
    await writeFile(outside, "unchanged"); await assert.rejects(store.writeRecord("report.json", { fixture: true }), { code: "EEXIST" });
    assert.equal(await readFile(outside, "utf8"), "unchanged"); assert.deepEqual((await readdir(store.root)).sort(), ["artifacts", "report.json"]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("publication denies a parent directory symlink that escapes the run", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-record-parent-"));
  try {
    const store = await EvidenceStore.create(directory, "run-one");
    await symlink(directory, resolve(store.root, "escape")); await rm(resolve(store.root, "artifacts"), { recursive: true }); await symlink(directory, resolve(store.root, "artifacts"));
    await assert.rejects(store.writeRecord("escape/outside.json", { fixture: true }), /escapes/);
    await assert.rejects(store.addBytes("fixture", Buffer.from("fixture"), "json", "application/json"), /escapes/);
    assert.deepEqual((await readdir(directory)).sort(), ["run-one"]); assert.deepEqual(store.artifacts, []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
