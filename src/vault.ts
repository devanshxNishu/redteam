import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function localKey(directory: string, create: boolean): Buffer {
  const path = resolve(directory, "session.key");
  if (create) {
    try { writeFileSync(path, randomBytes(32), { flag: "wx", mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  }
  const info = lstatSync(path);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error("The local vault key must be a regular file.");
  if (process.platform !== "win32" && (info.mode & 0o077) !== 0) throw new Error("The local vault key requires owner-only file permissions.");
  const key = readFileSync(path);
  if (key.length !== 32) throw new Error("Invalid local vault key.");
  return key;
}

export function encryptLocal(directory: string, identity: string, plaintext: string): string {
  const iv = randomBytes(12);
  const active = createCipheriv("aes-256-gcm", localKey(directory, true), iv);
  active.setAAD(Buffer.from(identity));
  const body = Buffer.concat([active.update(plaintext, "utf8"), active.final()]);
  return JSON.stringify({ iv: iv.toString("base64"), tag: active.getAuthTag().toString("base64"), body: body.toString("base64") });
}

export function decryptLocal(directory: string, identity: string, encrypted: string): string {
  const value = JSON.parse(encrypted) as { iv: string; tag: string; body: string };
  const decipher = createDecipheriv("aes-256-gcm", localKey(directory, false), Buffer.from(value.iv, "base64"));
  decipher.setAAD(Buffer.from(identity));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(value.body, "base64")), decipher.final()]).toString("utf8");
}
