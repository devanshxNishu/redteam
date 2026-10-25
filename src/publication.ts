import { randomUUID } from "node:crypto";
import { link, open, unlink } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type PublicationIO = Pick<typeof import("node:fs/promises"), "open" | "link" | "unlink">;
const localIO: PublicationIO = { open, link, unlink };

/** The caller supplies a contained destination. An existing entry is never replaced. */
export async function publishExclusive(destination: string, bytes: Buffer, filesystem: PublicationIO = localIO): Promise<void> {
  const parent = dirname(destination), pending = resolve(parent, `.redteam-publish-${randomUUID()}.pending`);
  let file: FileHandle | undefined, created = false, failed = false, failure: unknown;
  try {
    file = await filesystem.open(pending, "wx", 0o600); created = true;
    await file.writeFile(bytes); await file.sync();
    await file.close(); file = undefined;
    // link creates the final directory entry atomically and fails with EEXIST.
    // rename would be atomic but could replace a prior sealed record.
    await filesystem.link(pending, destination);
  } catch (error) { failed = true; failure = error; }
  if (file) {
    try { await file.close(); } catch (error) { if (!failed) { failed = true; failure = error; } }
  }
  if (created) {
    try { await filesystem.unlink(pending); } catch (error) { if (!failed) { failed = true; failure = error; } }
  }
  if (failed) throw failure;
  // A failure here can leave a complete published file. Never remove it or retry
  // with replacement semantics. Recovery must inspect the recorded publication.
  const directory = await filesystem.open(parent, "r");
  try { await directory.sync(); } finally { await directory.close(); }
}
