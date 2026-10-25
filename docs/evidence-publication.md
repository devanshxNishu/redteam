# Evidence publication

Status: implemented for JSON records and `EvidenceStore.addBytes` artifacts. Local filesystem verification uses Node 24.16.0 on macOS. This is a file publication contract, not a research or behavioral validation gate.

## Publication order

`src/publication.ts` writes bytes to a unique `.redteam-publish-UUID.pending` file in the final file's directory. It creates the file with exclusive access and owner-only permissions, writes all bytes, requests a file flush, and closes the handle. It then creates the final name with an exclusive hard link, removes its staging name, and requests a directory flush.

An existing final entry causes `EEXIST`. This includes a dangling symbolic link. The publisher never replaces that entry and has no copy or rename fallback. The evidence store resolves the parent directory before writing and rejects a destination that escapes its run through a parent symlink. JSON serialization must finish before staging begins.

POSIX specifies atomic creation of the new hard link and failure when the destination already exists. This supplies the publication operation's exclusivity. [POSIX link specification](https://pubs.opengroup.org/onlinepubs/9699919799/functions/link.html).

## Interruption boundaries

| Interruption | Final JSON name | Recovery behavior |
|---|---|---|
| During staging or file flush | Absent | Staging bytes are not a report |
| After file flush, before the link | Absent | No accepted publication is inferred |
| After the link | Complete record | Verify the saved report before catalog repair |
| After successful directory flush | Complete record | Ordinary report retrieval and verification |

A process killed after publication can leave both the final name and a staging name for the same complete file. Recovery ignores staging names. It does not promote or automatically remove them because another writer might still be active. Handled failures attempt to remove only the staging name created by that invocation.

An error after the link, including a directory flush or staging cleanup error, can leave a complete final file even when the operation reports failure. The final file is never removed to compensate. Inspect the recorded publication before deciding what to do next. A repeat write still fails with `EEXIST`.

## Acceptance and scope

File publication does not accept an actor decision. The coordinator must still check its task fence, model, research permission, worker bytes, and result. A completed task with no saved JSON report remains unavailable. Catalog recovery never promotes an unfinished seal or staging file and makes no provider request.

The evidence store uses this path for JSON records and bytes it writes itself. Browser screenshots and traces captured by external tools retain their existing capture and registration path. Append-only event streams and Markdown presentations are outside this atomic publication change. Artifact hashes and the current research access checks remain required.

File and directory flush behavior depends on the operating system and storage device. Node documents that dependency for `FileHandle.sync`. This implementation requires a local filesystem that supports hard links and directory synchronization; unsupported operations return errors. There is no claim of tested power-loss recovery, network filesystem behavior, Windows support, distributed transactions, or protection against a trusted operator changing the stores. [Node 24 filesystem documentation](https://nodejs.org/download/release/v24.16.0/docs/api/fs.html#filehandlesync).

## Verification

`tests/publication.test.ts` covers actual private-file flush and close order, write and file-flush failures, a directory-flush failure after publication, unsupported hard links, six competing processes, and real writers killed during staging, after file flush, and after publication.

`tests/evidence.test.ts` covers serialization failure, immutable final records, final symlinks, and parent-directory escape. `tests/configured-actor.test.ts` kills actual configured coordinators before and after JSON publication. It checks that the original sealed action is restored only after publication, staging bytes remain excluded, and inference identities and budget records stay unchanged. These tests use authored software fixtures, not participant research or live provider observations.
