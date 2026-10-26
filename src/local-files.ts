import { constants } from "node:fs";
import type { BigIntStats } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

export class FileBoundaryError extends Error {}
const inside = (root: string, path: string) => { const rel = relative(root, path); return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel); };

export async function checkedDirectory(path: string): Promise<void> {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink() || await realpath(path) !== path) throw new FileBoundaryError("A directory is unsafe or has changed.");
}

export async function checkedParents(root: string, path: string): Promise<void> {
  if (!inside(root, path)) throw new FileBoundaryError("The file is outside its permitted root.");
  await checkedDirectory(root);
  const parts = relative(root, path).split(sep).slice(0, -1);
  let current = root;
  for (const part of parts) { current = resolve(current, part); await checkedDirectory(current); }
}

const dataFields = ["dev", "ino", "nlink", "mode", "size", "mtimeNs"] as const;
const sameData = (a: BigIntStats, b: BigIntStats) => dataFields.every(key => a[key] === b[key]);

async function readAttempt(root: string, path: string, limit: number, expected?: BigIntStats) {
  await checkedParents(root, path);
  let file: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const before = await lstat(path, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || before.size > BigInt(limit)) throw new FileBoundaryError("The file type, link count, or size is outside policy.");
    if (expected && (!sameData(before, expected) || before.ctimeNs !== expected.ctimeNs)) throw new FileBoundaryError("The file changed before confirmation.");
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const opened = await file.stat({ bigint: true });
    if (!opened.isFile() || !sameData(opened, before) || opened.nlink !== 1n || opened.size > BigInt(limit)) throw new FileBoundaryError("The file changed before reading.");
    const bytes = Buffer.alloc(Number(opened.size) + 1);
    let length = 0;
    while (length < bytes.length) {
      const next = await file.read(bytes, length, bytes.length - length, length);
      if (!next.bytesRead) break;
      length += next.bytesRead;
    }
    const after = await file.stat({ bigint: true }), current = await lstat(path, { bigint: true });
    await checkedParents(root, path);
    if (!after.isFile() || !current.isFile() || !sameData(after, opened) || !sameData(current, opened) || current.isSymbolicLink() || BigInt(length) !== opened.size) throw new FileBoundaryError("The file changed during reading.");
    return { bytes: bytes.subarray(0, length), current, ctimeChanged: before.ctimeNs !== opened.ctimeNs || after.ctimeNs !== opened.ctimeNs || current.ctimeNs !== opened.ctimeNs };
  } finally { await file?.close(); }
}

/** Strict one-read policy. No target code, command, parser plugin, or model is loaded. */
export async function boundedBytes(root: string, path: string, limit: number): Promise<Buffer> {
  const read = await readAttempt(root, path, limit);
  if (read.ctimeChanged) throw new FileBoundaryError("The file changed during reading.");
  return read.bytes;
}

/** Managed immutable data only: one ctime-only disturbance permits one anchored, byte-identical confirmation. */
export async function confirmedBytes(root: string, path: string, limit: number): Promise<Buffer> {
  const first = await readAttempt(root, path, limit);
  if (!first.ctimeChanged) return first.bytes;
  const second = await readAttempt(root, path, limit, first.current);
  if (second.ctimeChanged || !first.bytes.equals(second.bytes)) throw new FileBoundaryError("The file changed during confirmation.");
  return second.bytes;
}

