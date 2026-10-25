# Local repository snapshots

Version 0.8.0 adds bounded source evidence capture for a trusted local operator. It does not run an engineering agent, inspect app behavior, execute tests, or establish a defect.

## Commands

Run these commands from the workspace that holds the grants and review data:

```sh
redteam access grant --path ./my-app --allow code:read --name 'Local source'
redteam code snapshot --grant GRANT_ID --path ./my-app
redteam code list
redteam code show RUN_ID
redteam access revoke GRANT_ID
```

Use the grant UUID returned by the first command. The snapshot target must resolve to that exact granted directory. A grant for a parent does not authorize a separate child target. The traversal can read permitted descendants of its selected root.

Creating a grant does not start capture. `code:test` alone does not authorize a snapshot. A directory grant does not authorize external model processing, shell access, package installation, test execution, or browser actions.

Capture prints a summary with the run ID, local directory, grant ID, target, time, file count, byte count, and report hash. List and show use the current grant. Missing, expired, revoked, or changed target access is denied. Show verifies the saved metadata hash and each copied artifact. Source content is not returned by these commands.

A capture is successful when its accepted catalog entry is saved. Every report states `limited_coverage`. This is an evidence intake result, not a test verdict. Command errors return a nonzero exit code.

## Collection policy

The initial policy is fixed and versioned as `local-text-v1`:

| Bound | Maximum |
|---|---:|
| Captured files | 50 |
| Bytes per source file | 65,536 |
| Total copied source bytes | 262,144 |
| Examined directory entries | 500 |
| Descendant directory depth | 6 |
| Capture duration | 10 seconds, checked between filesystem operations |

Directory names are sorted within the bounded inventory before processing. When an inventory exceeds the entry bound, the first observed subset can depend on filesystem enumeration order. The snapshot does not claim deterministic selection beyond that bound. Limits cannot be raised through the CLI.

Allowed text extensions are `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.py`, `.go`, `.rs`, `.java`, `.kt`, `.swift`, `.rb`, `.php`, `.cs`, `.c`, `.h`, `.cpp`, `.hpp`, `.html`, `.css`, `.scss`, `.sql`, and `.md`. `package.json` and `tsconfig` JSON files are also eligible. Their contents are copied, not evaluated.

Hidden names, names with control characters or backslashes, and names longer than 240 characters are excluded. Names that suggest secrets, credentials, passwords, tokens, or keys are excluded. Common dependency, generated, storage, upload, log, and credential directories are excluded. All other extensions, including arbitrary JSON and lock files, are excluded. Invalid UTF-8 and NUL-containing files are excluded.

Symbolic links, files with multiple hard links, and nonregular files are not captured. Canonical containment, directory type, root device/inode, file identity, size, modification/change time, and link count are checked around reads. Fixed allocations bound reads if a file grows. No-follow and nonblocking opens prevent ordinary leaf symlink and special-file substitutions from becoming intentional reads. Source files are not written. Normal reads can update operating-system access times.

The policy does not interpret Git ignore rules or scan source contents for secrets. A permitted source file can contain private data. Use a deliberately scoped, sanitized checkout. Exclusions do not prove that the captured files contain no secrets.

## Evidence and access

Snapshots use `.redteam/repository-runs/RUN_ID/`. Owner-only directories contain source byte artifacts and an exclusively published `report.json`. Each source path maps to its artifact ID, byte size, and SHA-256 hash. The report records its policy, collection interval, coverage counters, skip reasons, and explicit execution boundaries. It contains no source text.

The SQLite catalog pins the original grant, canonical target, report directory, and report hash. Grant checks occur during traversal, before source reads and publication, before catalog acceptance, and during later inspection. The catalog is immutable through the supported API. A later change to the source does not change a saved snapshot. Changing saved metadata or evidence denies inspection.

A failed or killed capture can leave private, uncataloged artifacts or a final file. These are not accepted snapshots. The CLI does not adopt, retry, promote, overwrite, or delete them. Revocation blocks supported retrieval; it does not erase copied bytes, revoke operating-system access, or remove backups. No recovery or automatic cleanup command exists for this path.

Source artifacts are private local plaintext, not encrypted research records. File permissions and application checks assume a trusted local account. They are not production isolation or protection against a hostile process with the same account. Permission checks and filesystem writes are not one cross-process transaction. An unresponsive filesystem can exceed the duration bound.

## Interpretation

A snapshot is a sequence of file observations. It does not establish an atomic Git revision, commit identity, build, dependency installation, working app, executed script, passing test, or supported defect. The traversal flag describes the bounded walk only. Excluded directories have uncounted descendants.

Source content remains untrusted data. Instructions inside code or documentation cannot grant tools, change policy, or authorize model processing. No source content is sent to a model by this feature. Actor and research tools do not receive these snapshots automatically.

A future engineering observation must cite copied evidence and a captured requirement or supported rule. It must keep declared scripts, executed tests, observed behavior, and unknown coverage distinct. The specialist scheduler, stakeholder models, and roundtable have separate release gates.
