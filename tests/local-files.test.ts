import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, realpath, writeFile, readFile, rm, chmod, link, symlink, rename, copyFile, open, stat } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { boundedBytes, confirmedBytes, FileBoundaryError } from "../src/local-files.ts";
import { privateBytes } from "../src/context-data.ts";

const body = Buffer.from("AUTHORED bounded stable read fixture.\n");
async function fixture(t: TestContext, work: (c: { root: string; file: string; counts: { reads: number; closes: number }; hook: (read?: (result: { bytesRead: number; buffer: Buffer }, call: number) => Promise<void>, close?: (call: number) => Promise<void>) => void }) => Promise<void>) {
  const root = await realpath(await mkdtemp(resolve(tmpdir(), "redteam-confirmed-bytes-"))), file = resolve(root, "fixture.txt");
  await writeFile(file, body, { mode: 0o600 });
  const sample = await open(file, "r"), prototype = Object.getPrototypeOf(sample), nativeRead = prototype.read; await sample.close();
  const counts = { reads: 0, closes: 0 };
  const hook = (read?: (result: { bytesRead: number; buffer: Buffer }, call: number) => Promise<void>, close?: (call: number) => Promise<void>) => {
    const observed = new WeakSet<FileHandle>();
    t.mock.method(prototype, "read", async function(this: FileHandle, ...args: any[]) {
      if (!observed.has(this)) { observed.add(this); const nativeClose = this.close.bind(this); t.mock.method(this, "close", async () => { await nativeClose(); counts.closes++; await close?.(counts.closes); }); }
      const result = await Reflect.apply(nativeRead, this, args) as { bytesRead: number; buffer: Buffer }; counts.reads++; await read?.(result, counts.reads); return result;
    });
  };
  try { await work({ root, file, counts, hook }); } finally { t.mock.restoreAll(); await rm(root, { recursive: true, force: true }); }
}
async function touchMetadata(file: string) {
  const before = await stat(file, { bigint: true }); await chmod(file, 0o600); const after = await stat(file, { bigint: true });
  for (const key of ["dev", "ino", "mode", "size", "mtimeNs", "nlink"] as const) assert.equal(after[key], before[key]);
  assert.notEqual(after.ctimeNs, before.ctimeNs, "Authored fixture must actually disturb ctime only.");
}

test("strict and confirmed stable reads preserve exact bytes, zero bytes and size bounds", async t => fixture(t, async ({ root, file, counts, hook }) => {
  hook(); assert((await boundedBytes(root, file, body.length)).equals(body)); assert((await confirmedBytes(root, file, body.length)).equals(body)); assert.equal(counts.closes, 2);
  await assert.rejects(confirmedBytes(root, file, body.length - 1), FileBoundaryError); assert.equal(counts.closes, 2);
  await writeFile(file, ""); assert.equal((await confirmedBytes(root, file, 0)).length, 0); assert.equal(counts.closes, 3);
}));

test("strict one-read callers still reject ctime-only changes without confirmation", async t => fixture(t, async ({ root, file, counts, hook }) => {
  hook(async (_result, call) => { if (call === 1) await touchMetadata(file); });
  await assert.rejects(boundedBytes(root, file, body.length), FileBoundaryError); assert.equal(counts.reads, 2); assert.equal(counts.closes, 1);
}));

test("managed context reads confirm one ctime-only disturbance with two identical complete reads", async t => fixture(t, async ({ root, file, counts, hook }) => {
  hook(async (_result, call) => { if (call === 1) await touchMetadata(file); });
  assert((await privateBytes(root, file, body.length)).equals(body)); assert.equal(counts.reads, 4); assert.equal(counts.closes, 2);
  t.mock.restoreAll(); assert((await readFile(file)).equals(body)); assert.equal((await stat(file)).mode & 0o777, 0o600);
}));

test("size, modification time, identity, permissions, link and symlink changes never get a confirmation", async t => {
  for (const variant of ["size", "content", "inode", "mode", "hardlink", "symlink"]) await fixture(t, async ({ root, file, counts, hook }) => {
    hook(async (_result, call) => { if (call !== 1) return; if (variant === "size") await writeFile(file, "changed"); if (variant === "content") await writeFile(file, Buffer.alloc(body.length, 120)); if (variant === "mode") await chmod(file, 0o644); if (variant === "hardlink") await link(file, file + ".alias"); if (variant === "inode" || variant === "symlink") { await rename(file, file + ".saved"); if (variant === "inode") await copyFile(file + ".saved", file); else await symlink(file + ".saved", file); } });
    await assert.rejects(confirmedBytes(root, file, body.length), FileBoundaryError); assert(counts.reads <= 2); assert.equal(counts.closes, 1);
  });
});

test("confirmation refuses different complete bytes even with matching observed data metadata", async t => fixture(t, async ({ root, file, counts, hook }) => {
  // Authored I/O fault: corrupt only the first returned buffer, then cause the ctime-only branch.
  hook(async (result, call) => { if (call === 1) { result.buffer[0] = result.buffer[0]! ^ 1; await touchMetadata(file); } });
  await assert.rejects(confirmedBytes(root, file, body.length), FileBoundaryError); assert.equal(counts.reads, 4); assert.equal(counts.closes, 2);
  t.mock.restoreAll(); assert((await readFile(file)).equals(body));
}));

test("a second ctime disturbance fails after exactly two reads and never loops or repairs", async t => fixture(t, async ({ root, file, counts, hook }) => {
  hook(async (_result, call) => { if (call === 1 || call === 3) await touchMetadata(file); });
  await assert.rejects(confirmedBytes(root, file, body.length), FileBoundaryError); assert.equal(counts.reads, 4); assert.equal(counts.closes, 2);
}));

test("metadata changes between the first close and confirmation are denied before a second open", async t => fixture(t, async ({ root, file, counts, hook }) => {
  hook(async (_result, call) => { if (call === 1) await touchMetadata(file); }, async call => { if (call === 1) await touchMetadata(file); });
  await assert.rejects(confirmedBytes(root, file, body.length), FileBoundaryError); assert.equal(counts.reads, 2); assert.equal(counts.closes, 1);
}));

test("changed canonical parent or preexisting links cannot authorize confirmation", async t => fixture(t, async ({ root, file, counts, hook }) => {
  await link(file, file + ".alias"); await assert.rejects(confirmedBytes(root, file, body.length)); assert.equal(counts.reads, 0); await rm(file + ".alias");
  hook(async (_result, call) => { if (call === 1) await touchMetadata(file); }, async call => { if (call === 1) { await rename(root, root + ".saved"); await symlink(root + ".saved", root); } });
  try { await assert.rejects(confirmedBytes(root, file, body.length), FileBoundaryError); assert.equal(counts.reads, 2); assert.equal(counts.closes, 1); }
  finally { await rm(root); await rename(root + ".saved", root); }
}));
