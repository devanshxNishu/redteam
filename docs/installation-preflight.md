# Read-only installation preflight

Version 0.20.0 adds `redteam doctor`. Run it from the existing directory in which you intend to keep review data. Source checkout: `npm run redteam -- doctor`. Installed archive: `redteam doctor`.

The command prints a JSON `installation_preflight` record. Exit 0 means the declared Node range, selected package assets, pinned driver metadata, a browser candidate file, and the workspace directory boundary passed the listed checks. Exit 1 means at least one check needs attention. Unknown arguments are rejected. No automatic install, repair, service connection, review, or model request occurs.

## Checked inputs

- A stable Node version within the package's declared `>=24.12.0` range. This compares version numbers; it does not test every matching Node release. The CLI already needs a runtime that can load its modules, including native SQLite. This is not a bootstrap checker for an unsupported runtime.
- Trusted local Redteam and Playwright package metadata, bounded to 64 KiB per JSON file, with regular-file, link, UTF-8, containment, and read-consistency checks. Driver discovery supports the pinned Playwright 1.64.1 shell metadata. Changed versions, unsupported platforms/host overrides, duplicate shell descriptions, and revision overrides are not guessed.
- Nonempty readable CLI, three dashboard assets, the signup study, and its requirement file. Source and compiled layouts are distinct. Asset leaf and parent symlinks are refused. This is not a full module import, dependency, signature, or package-integrity scan.
- The exact Chromium **headless shell** selected by a headless launch, rather than the full Chromium executable. Only file metadata and executable access are checked; the binary is never executed or read. A missing, empty, nonexecutable, linked, or nonregular file is explicit.
- The existing workspace directory and the `.redteam` entry type/mode, if present. A fresh workspace stays fresh. Existing state must be a nonsymlink directory with owner-only mode bits. No store is opened or created, and no state content is inspected. These checks do not establish ownership, ACL safety, write access, isolation, or protection from a hostile local operator.

Absolute workspace, package, home, and browser-cache locations are omitted. Package-relative asset names and the shell-relative candidate name remain visible. Errors use static issue codes and advice. The command reads no `.env`, key, session, vault, research, SQLite, or target-source contents, and does not dump the environment.

## Browser cache and fallback

The runner supplies its package-local `.cache/ms-playwright` default when `PLAYWRIGHT_BROWSERS_PATH` is undefined. An explicit value is respected: `0` uses the pinned driver's hermetic cache; other nonempty values name the cache; relative values resolve against the driver's `INIT_CWD` selection or current directory. An explicit empty string selects the driver's OS default. The preflight mirrors this policy without changing the environment or importing Playwright. Only relevant cache/initial-directory/host settings and local OS metadata are inspected.

On macOS, the runner can try the fixed installed Google Chrome path **after an actual pinned executable-missing launch error**. An executable file there yields `mac_chrome_fallback_hint` when the pinned shell file is missing. This is advice, not a tested fallback or successful launch. It does not replace a present but nonexecutable/unsafe shell. The preflight tests neither browser version, signing, quarantine, system libraries, Windows executable semantics, nor actual launch. Platform layout fixtures are not cross-platform runtime verification.

For the default cache, `redteam examples` locates the package's examples directory. From its parent package directory, `npm run browser:install` uses the existing local installer script to install the pinned shell. That script currently uses POSIX environment assignment. For an explicit cache or another shell, use the package's local Playwright CLI with the same settings; do not assume that the default installer fills a custom cache. Installation is a separate deliberate operation. The preflight performs no download or repair.

After setup, run `redteam review --demo fixed` separately. Only that review can provide actual browser evidence for the controlled local signup fixture. A preflight JSON record is not a saved review, immutable certificate, permission grant, or guarantee about a later operation; filesystem and permission races remain possible.

## Capability scope

The record states the release's current scope: one controlled local signup journey; no arbitrary app or source test execution; scripted or explicitly configured actor mechanics; fake-transport provider verification; no validated behavioral models or broad hierarchy. It does not inspect provider configuration or secret availability.

The command validates no participant research, psychology, population model, prospective protocol, commercial demand, purchase, investment decision, funding probability, or customer value. Those gates remain separate from installation and local software verification.

## Verification

Authored filesystem tests cover source/compiled assets, fresh/private workspace preservation, missing/nonexecutable/unsafe candidates, unsafe state boundaries, bounded/unsupported metadata, static output, version and platform layouts, strict CLI arguments and attention exits. An isolated process compares the mirrored candidate against the actual pinned local driver for five cache modes on the test host; it also confirms that the full Chromium path differs from the shell path. No browser launches in these preflight tests. A separate installed-archive fixed review verifies actual host browser behavior.
