import { lstat, mkdir, realpath } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { boundedBytes, confirmedBytes, checkedDirectory, checkedParents } from "./local-files.ts";
import { publishExclusive } from "./publication.ts";

export class ContextDataError extends Error { constructor() { super("The context record, current source rights or bounded input is unavailable."); } }
export class ContextStateConflict extends Error { constructor() { super("The context source state changed. Read current metadata before retrying."); } }
export function fields(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new ContextDataError();
  const descriptors = Object.getOwnPropertyDescriptors(value), names = Reflect.ownKeys(descriptors);
  if (names.length !== keys.length || names.some(key => typeof key !== "string" || !keys.includes(key))) throw new ContextDataError();
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) { const field = descriptors[key]; if (!field?.enumerable || !("value" in field)) throw new ContextDataError(); result[key] = field.value; } return result;
}
export function text(value: unknown, max: number): string { if (typeof value !== "string" || !value.trim() || value.length > max || /[\x00-\x1f\x7f-\x9f]/u.test(value)) throw new ContextDataError(); return value; }
export function uuid(value: unknown): string { const id = text(value, 36); if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(id)) throw new ContextDataError(); return id; }
export function digest(value: unknown): string { const hash = text(value, 64); if (!/^[a-f0-9]{64}$/u.test(hash)) throw new ContextDataError(); return hash; }
export function timestamp(value: unknown): string { if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new ContextDataError(); return value; }
export function integer(value: unknown, max = 10000): number { if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > max) throw new ContextDataError(); return value; }
export function list<T>(value: unknown, max: number, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) throw new ContextDataError();
  const descriptors = Object.getOwnPropertyDescriptors(value), length = Object.getOwnPropertyDescriptor(value, "length")!.value as number;
  if (length > max || Reflect.ownKeys(descriptors).length !== length + 1) throw new ContextDataError();
  const result: T[] = []; for (let i = 0; i < length; i++) { const field = descriptors[String(i)]; if (!field?.enumerable || !("value" in field)) throw new ContextDataError(); result.push(parse(field.value)); } return result;
}
export function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
export function json(bytes: Buffer): unknown { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown; }
export function bytes(value: unknown, max: number): Buffer { const result = Buffer.from(JSON.stringify(value, null, 2) + "\n"); if (result.length > max) throw new ContextDataError(); return result; }
export async function inputBytes(file: string, max: number): Promise<Buffer> { const path = resolve(file), root = await realpath(dirname(path)); return boundedBytes(root, resolve(root, basename(path)), max); }
export async function privateDirectory(path: string): Promise<void> { await checkedDirectory(path); if ((await lstat(path)).mode & 0o077) throw new ContextDataError(); }
export async function privateBytes(state: string, file: string, max: number): Promise<Buffer> {
  if ((await lstat(file)).mode & 0o077) throw new ContextDataError(); const result = await confirmedBytes(state, file, max);
  if ((await lstat(file)).mode & 0o077) throw new ContextDataError(); return result;
}
export async function recordDirectory(stateDirectory: string, prefix: "context-sources" | "context-snapshots" | "context-processing" | "context-analyst-runs", id: string, create = false): Promise<{ state: string; directory: string }> {
  uuid(id); const state = await realpath(stateDirectory), parent = resolve(state, prefix); await privateDirectory(state);
  if (create) { try { await mkdir(parent, { mode: 0o700 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; } }
  await privateDirectory(parent); const directory = resolve(parent, id); if (create) await mkdir(directory, { mode: 0o700 }); await privateDirectory(directory); return { state, directory };
}
export async function publish(state: string, directory: string, name: "record.json" | "source.txt" | "snapshot.json" | "manifest.json" | "generation.json" | "candidate.json" | "report.json", value: Buffer, max: number): Promise<void> {
  if (value.length > max) throw new ContextDataError(); const file = resolve(directory, name); await checkedParents(state, file); await publishExclusive(file, value);
  if (!(await privateBytes(state, file, max)).equals(value)) throw new ContextDataError();
}

/** Requires existing private state before WorkspaceStore can run normal schema setup. */
export async function existingContextWorkspace(workspace: string): Promise<string> {
  try { const root = await realpath(workspace), state = resolve(root, ".redteam"); await privateDirectory(state); const file = resolve(state, "workspace.sqlite"); await checkedParents(state, file); const info = await lstat(file); if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || (info.mode & 0o077)) throw new ContextDataError(); return root; } catch { throw new ContextDataError(); }
}
