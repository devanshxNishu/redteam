import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, realpath, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { publishExclusive } from "./publication.ts";

export interface Artifact {
  id: string;
  path: string;
  mediaType: string;
  bytes: number;
  sha256: string;
  owner: string;
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function containedPath(root: string, name: string): string {
  if (isAbsolute(name)) throw new Error("Artifact paths must be relative.");
  const destination = resolve(root, name);
  const rel = relative(root, destination);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error("Artifact path escapes the run.");
  return destination;
}

export async function checkArtifacts(root: string, artifacts: Artifact[]): Promise<string[]> {
  const errors: string[] = [];
  const canonicalRoot = await realpath(root);
  for (const artifact of artifacts) {
    try {
      const file = containedPath(root, artifact.path);
      const canonical = await realpath(file);
      const rel = relative(canonicalRoot, canonical);
      if (rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) throw new Error("Symlink escapes the run.");
      if (!(await stat(file)).isFile()) throw new Error("Artifact is not a file.");
      const bytes = await readFile(file);
      if (bytes.length !== artifact.bytes || sha256(bytes) !== artifact.sha256) throw new Error("Artifact hash or size mismatch.");
    } catch (error) {
      errors.push(`${artifact.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return errors;
}

export class EvidenceStore {
  readonly root: string;
  readonly artifacts: Artifact[] = [];

  constructor(root: string) { this.root = root; }

  static async create(outputRoot: string, runId: string): Promise<EvidenceStore> {
    if (!/^[A-Za-z0-9-]+$/.test(runId)) throw new Error("Invalid run ID.");
    const root = resolve(outputRoot, runId);
    await mkdir(outputRoot, { recursive: true });
    await mkdir(root, { mode: 0o700 });
    await mkdir(resolve(root, "artifacts"), { mode: 0o700 });
    return new EvidenceStore(root);
  }

  async writeRecord(name: string, value: unknown): Promise<void> {
    const document = JSON.stringify(value, null, 2);
    if (document === undefined) throw new Error("A record requires a JSON-serializable value.");
    await this.publish(name, Buffer.from(document + "\n"));
  }

  private async publish(name: string, bytes: Buffer): Promise<void> {
    const destination = containedPath(this.root, name), root = await realpath(this.root), parent = await realpath(dirname(destination));
    const rel = relative(root, parent);
    if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error("Publication directory escapes the run.");
    await publishExclusive(resolve(parent, basename(destination)), bytes);
  }

  async recordEvent(value: unknown): Promise<void> {
    await appendFile(resolve(this.root, "events.jsonl"), JSON.stringify(value) + "\n", { mode: 0o600 });
  }

  newArtifactPath(extension: string): string {
    if (!/^[a-z]+$/.test(extension)) throw new Error("Invalid artifact extension.");
    return `artifacts/${randomUUID()}.${extension}`;
  }

  async addBytes(owner: string, bytes: Buffer, extension: string, mediaType: string): Promise<Artifact> {
    const path = this.newArtifactPath(extension);
    await this.publish(path, bytes);
    return this.register(owner, path, mediaType);
  }

  async register(owner: string, path: string, mediaType: string): Promise<Artifact> {
    const bytes = await readFile(containedPath(this.root, path));
    const artifact = { id: randomUUID(), path, owner, mediaType, bytes: bytes.length, sha256: sha256(bytes) };
    this.artifacts.push(artifact);
    return artifact;
  }
}
