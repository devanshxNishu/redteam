import test from "node:test";
import assert from "node:assert/strict";
import { access, chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { cpus, homedir, release, tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { sha256 } from "../src/evidence.ts";
import { headlessLocation, inspectInstallation, meetsNodeMinimum } from "../src/installation.ts";
const execute = promisify(execFile), project = resolve(import.meta.dirname, ".."), require = createRequire(import.meta.url);
type Context = NonNullable<Parameters<typeof inspectInstallation>[0]["context"]>;
const context = (root: string, extra: Partial<Context> = {}): Context => ({ platform: "linux", arch: "x64", osRelease: "6.0.0", appleCpu: false, home: resolve(root, "PRIVATE_HOME"), cwd: root, browserPath: undefined, initCwd: undefined, xdgCache: undefined, localAppData: undefined, hostOverride: undefined, ...extra });
async function temporary(work: (root: string) => Promise<void>): Promise<void> { const root = await mkdtemp(resolve(tmpdir(), "redteam-installation-")); try { await work(await realpath(root)); } finally { await rm(root, { recursive: true, force: true }); } }
async function fixture(root: string) {
  const packageRoot = resolve(root, "package"), driverRoot = resolve(root, "driver"), workspace = resolve(root, "workspace");
  for (const path of [packageRoot, driverRoot, workspace]) await mkdir(path, { mode: 0o700 });
  await writeFile(resolve(packageRoot, "package.json"), JSON.stringify({ name: "redteam", version: "0.20.0" }));
  for (const path of ["src/cli.ts", "dist/cli.js", "web/index.html", "web/app.js", "web/styles.css", "examples/pilot-signup.study.json", "fixtures/pilot-signup.requirement.md"]) { await mkdir(dirname(resolve(packageRoot, path)), { recursive: true }); await writeFile(resolve(packageRoot, path), "owned nonempty asset"); }
  await writeFile(resolve(driverRoot, "package.json"), JSON.stringify({ name: "playwright-core", version: "1.64.1" }));
  await writeFile(resolve(driverRoot, "browsers.json"), JSON.stringify({ browsers: [{ name: "chromium-headless-shell", revision: "1248" }] }));
  const ctx = context(root), location = headlessLocation(packageRoot, driverRoot, "1248", ctx)!;
  await mkdir(dirname(location.path), { recursive: true }); await writeFile(location.path, "Authored candidate, never executed.", { mode: 0o700 });
  const options = { projectRoot: packageRoot, driverRoot, workspace, context: ctx, nodeVersion: "v24.16.0", mode: "source" as const };
  return { packageRoot, driverRoot, workspace, location, options };
}
async function tree(root: string): Promise<unknown[]> { const result: unknown[] = []; for (const name of (await readdir(root)).sort()) { const path = resolve(root, name), info = await lstat(path); result.push([name, info.mode, info.isSymbolicLink() ? "link" : info.isDirectory() ? await tree(path) : [info.size, info.mtimeMs, sha256(await readFile(path))]]); } return result; }

test("Node range check uses stable canonical versions and states no runtime compatibility proof", () => {
  for (const version of ["v24.12.0", "24.12.1", "v24.16.0", "25.0.0", "100.0.0"]) assert.equal(meetsNodeMinimum(version), true, version);
  for (const version of ["v24.11.99", "23.99.0", "24.12", "24.12.0-rc.1", "024.12.0", "24.12.0junk", "99999999999999999999.0.0", ""]) assert.equal(meetsNodeMinimum(version), false, version);
});
test("headless discovery respects package, explicit, relative INIT_CWD, hermetic, and empty default cache settings", () => {
  const root = "/owned", pkg = "/owned/package", core = "/owned/core";
  assert.equal(headlessLocation(pkg, core, "1248", context(root))!.path, "/owned/package/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell");
  assert.equal(headlessLocation(pkg, core, "1248", context(root, { browserPath: "0" }))!.cacheSource, "hermetic");
  assert(headlessLocation(pkg, core, "1248", context(root, { browserPath: "0" }))!.path.startsWith("/owned/core/.local-browsers/"));
  assert(headlessLocation(pkg, core, "1248", context(root, { browserPath: "custom", initCwd: "/initial" }))!.path.startsWith("/initial/custom/"));
  assert(headlessLocation(pkg, core, "1248", context(root, { browserPath: "/custom", initCwd: "/ignored" }))!.path.startsWith("/custom/"));
  assert(headlessLocation(pkg, core, "1248", context(root, { browserPath: "", xdgCache: "relative-cache", initCwd: "/initial" }))!.path.startsWith("/initial/relative-cache/ms-playwright/"));
  assert.equal(headlessLocation(pkg, core, "1248", context(root, { browserPath: "" }))!.cacheSource, "driver_default");
});
test("platform layout fixtures follow the pinned shell selection including Apple CPU under Rosetta", () => {
  const location = (extra: Partial<Context>) => headlessLocation("/p", "/c", "1248", context("/w", extra));
  assert.equal(location({ platform: "darwin", arch: "x64", appleCpu: true, osRelease: "25.0.0" })!.shortPlatform, "mac-arm64");
  assert.equal(location({ platform: "darwin", arch: "arm64", appleCpu: false, osRelease: "25.0.0" })!.shortPlatform, "mac-x64");
  assert.equal(location({ platform: "darwin", appleCpu: true, osRelease: "19.0.0" })!.shortPlatform, "mac-x64");
  assert(location({ arch: "arm64" })!.relativePath.includes("linux-arm64"));
  assert(location({ platform: "win32", arch: "arm64" })!.relativePath.endsWith("chrome-headless-shell-win64/chrome-headless-shell.exe"));
  for (const extra of [{ platform: "freebsd" }, { arch: "riscv64" }, { hostOverride: "unreviewed" }]) assert.equal(location(extra), null);
  assert.equal(headlessLocation("/p", "/c", "../escape", context("/w")), null);
});
test("pinned local driver independently agrees with the actual host shell path for each supported cache mode", async () => temporary(async root => {
  const core = dirname(require.resolve("playwright-core/package.json"));
  const meta = JSON.parse(await readFile(resolve(core, "browsers.json"), "utf8")) as { browsers: { name: string; revision: string }[] }, revision = meta.browsers.find(item => item.name === "chromium-headless-shell")!.revision;
  for (const browserPath of [undefined, "", "0", "relative-browser", resolve(root, "absolute-browser")]) {
    const env: NodeJS.ProcessEnv = { INIT_CWD: root }; if (browserPath !== undefined) env.PLAYWRIGHT_BROWSERS_PATH = browserPath;
    const script = `process.env.PLAYWRIGHT_BROWSERS_PATH ??= ${JSON.stringify(resolve(project, ".cache/ms-playwright"))}; const {createRequire}=await import('node:module');const r=createRequire(${JSON.stringify(resolve(project, "package.json"))})('playwright-core/lib/coreBundle').registry.registry;console.log(JSON.stringify({shell:r.findExecutable('chromium-headless-shell').executablePath(),full:r.findExecutable('chromium').executablePath()}));`;
    const actual = JSON.parse((await execute(process.execPath, ["--input-type=module", "--eval", script], { env, cwd: root })).stdout) as { shell: string; full: string };
    const location = headlessLocation(project, core, revision, context(root, { platform: process.platform, arch: process.arch, osRelease: release(), appleCpu: cpus().some(cpu => cpu.model.includes("Apple")), home: homedir(), browserPath, initCwd: root }));
    assert.equal(location!.path, actual.shell); assert.notEqual(location!.path, actual.full);
  }
}));
test("fresh source and compiled fixture preflight preserves the complete tree and discloses metadata-only scope", async () => temporary(async root => {
  const { options } = await fixture(root), before = await tree(root);
  for (const mode of ["source", "compiled"] as const) {
    const result = await inspectInstallation({ ...options, mode });
    assert.equal(result.outcome, "checks_passed"); assert.equal(result.package.mode, mode); assert.equal(result.browser.candidate, "pinned_headless_shell");
    assert.equal(result.browser.launchTested, false); assert.equal(result.runtime.compatibilityExecuted, false); assert.equal(result.workspace.stateBoundary, "not_created");
    assert.deepEqual(result.effects, { filesWritten: false, databasesOpened: false, credentialsRead: false, browserLaunches: 0, modelCalls: 0, networkRequests: 0, repairsPerformed: false });
    assert.equal(result.scope.externalAppExecution, "unavailable"); assert.equal(result.scope.validatedBehavioralModels, "not_implemented"); assert.equal(result.scope.broaderHierarchy, "not_enabled");
    assert(!JSON.stringify(result).includes(root)); assert(!JSON.stringify(result).includes("PRIVATE_HOME"));
  }
  assert.deepEqual(await tree(root), before);
}));
test("private workspace markers and invalid SQLite/vault/session content remain untouched and absent from output", async () => temporary(async root => {
  const { options, workspace } = await fixture(root); await mkdir(resolve(workspace, ".redteam"), { mode: 0o700 });
  for (const file of [".env", ".redteam/workspace.sqlite", ".redteam/vault.key", ".redteam/session.json"]) await writeFile(resolve(workspace, file), "PRIVATE_CREDENTIAL_DATABASE_RESEARCH_CONTENT", { mode: 0o600 });
  const before = await tree(root), result = await inspectInstallation(options);
  assert.equal(result.workspace.stateBoundary, "private_directory"); assert.equal(result.outcome, "checks_passed"); assert(!JSON.stringify(result).includes("PRIVATE_CREDENTIAL_DATABASE_RESEARCH_CONTENT"));
  assert.deepEqual(await tree(root), before);
}));
test("missing, empty, nonexecutable, directory, and symlink shell candidates need attention without repair", async () => temporary(async root => {
  const { options, location } = await fixture(root);
  for (const expected of ["missing", "empty_file", "access_denied", "unsafe_type", "unsafe_type"]) {
    await rm(location.path, { force: true, recursive: true });
    if (expected === "empty_file") await writeFile(location.path, "", { mode: 0o700 });
    if (expected === "access_denied") await writeFile(location.path, "not executable", { mode: 0o600 });
    if (expected === "unsafe_type" && !(await access(resolve(root, "link-target")).then(() => true, () => false))) { await mkdir(location.path); await writeFile(resolve(root, "link-target"), "target"); }
    else if (expected === "unsafe_type") await symlink(resolve(root, "link-target"), location.path);
    const before = await tree(root), result = await inspectInstallation(options);
    assert.equal(result.browser.headlessShell.status, expected); assert.equal(result.browser.candidate, "none"); assert(result.issues.includes("browser_candidate_unavailable")); assert.equal(result.outcome, "needs_attention"); assert.deepEqual(await tree(root), before);
  }
}));
test("absent assets and unsafe package parent/leaf links are explicit and never inspected as usable", async () => temporary(async root => {
  const { options, packageRoot } = await fixture(root), asset = resolve(packageRoot, "web/app.js");
  await rm(asset); assert.equal((await inspectInstallation(options)).package.assets.find(item => item.path === "web/app.js")!.status, "missing");
  await writeFile(asset, ""); assert.equal((await inspectInstallation(options)).package.assets.find(item => item.path === "web/app.js")!.status, "empty_file");
  await rm(asset); await symlink(resolve(packageRoot, "src/cli.ts"), asset); assert.equal((await inspectInstallation(options)).package.assets.find(item => item.path === "web/app.js")!.status, "unsafe_type");
  await rm(resolve(packageRoot, "web"), { recursive: true }); await symlink(resolve(packageRoot, "src"), resolve(packageRoot, "web"));
  assert.equal((await inspectInstallation(options)).package.assets.find(item => item.path === "web/app.js")!.status, "unsafe_type");
  const alias = resolve(root, "package-alias"); await symlink(packageRoot, alias); assert((await inspectInstallation({ ...options, projectRoot: alias })).issues.includes("package_metadata_unavailable"));
}));
test("untrusted or oversized driver metadata is rejected with static messages and no reflected content", async () => temporary(async root => {
  const { options, driverRoot } = await fixture(root), path = resolve(driverRoot, "browsers.json");
  for (const value of [null, { browsers: [] }, { browsers: [{ name: "chromium-headless-shell", revision: "../../PRIVATE_MARKER" }] }, { browsers: Array(31).fill({}) }, { browsers: [{ name: "chromium-headless-shell", revision: "1248", revisionOverrides: 1 }] }, { browsers: [{ name: "chromium-headless-shell", revision: "1248", revisionOverrides: { "mac-arm64": "1" } }] }]) {
    await writeFile(path, JSON.stringify(value)); const result = await inspectInstallation(options); assert(result.issues.includes("driver_metadata_unavailable")); assert(!JSON.stringify(result).includes("PRIVATE_MARKER")); assert.equal(result.browser.candidate, "none");
  }
  await writeFile(path, "PRIVATE_MARKER".repeat(6000)); assert((await inspectInstallation(options)).issues.includes("driver_metadata_unavailable"));
  await writeFile(resolve(driverRoot, "package.json"), JSON.stringify({ name: "playwright-core", version: "1.65.0" })); const result = await inspectInstallation(options); assert.equal(result.driver.status, "unsupported_metadata");
}));
test("workspace missing, symlink, file, and broad-permission state boundaries fail without creation or chmod", async () => temporary(async root => {
  const { options, workspace } = await fixture(root), state = resolve(workspace, ".redteam");
  assert((await inspectInstallation({ ...options, workspace: resolve(root, "absent") })).issues.includes("workspace_directory_unavailable"));
  await symlink(workspace, resolve(root, "alias")); assert((await inspectInstallation({ ...options, workspace: resolve(root, "alias") })).issues.includes("workspace_directory_unavailable"));
  await writeFile(state, "PRIVATE_MARKER"); assert.equal((await inspectInstallation(options)).workspace.stateBoundary, "unsafe");
  await rm(state); await symlink(root, state); assert.equal((await inspectInstallation(options)).workspace.stateBoundary, "unsafe");
  await rm(state); await mkdir(state, { mode: 0o755 }); await chmod(state, 0o755); const before = await tree(root), result = await inspectInstallation(options);
  assert.equal(result.workspace.stateBoundary, "unsafe"); assert(result.issues.includes("workspace_state_boundary_unavailable")); assert.deepEqual(await tree(root), before);
}));
test("unsupported runtime and host override retain independent checks but never claim browser readiness", async () => temporary(async root => {
  const { options } = await fixture(root), result = await inspectInstallation({ ...options, nodeVersion: "v24.11.9", context: { ...options.context, hostOverride: "PRIVATE_HOST_OVERRIDE" } });
  assert(result.issues.includes("node_range_not_met")); assert(result.issues.includes("driver_metadata_unavailable")); assert.equal(result.driver.status, "unsupported_metadata"); assert.equal(result.browser.headlessShell.status, "not_checked"); assert.equal(result.browser.candidate, "none"); assert(!JSON.stringify(result).includes("PRIVATE_HOST_OVERRIDE"));
}));
test("source CLI doctor validates arguments and exit status without creating a workspace store", async () => temporary(async root => {
  const before = await tree(root), env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: resolve(root, "missing-browser"), PLAYWRIGHT_HOST_PLATFORM_OVERRIDE: "unsupported-test-host" };
  await assert.rejects(execute(process.execPath, [resolve(project, "src/cli.ts"), "doctor"], { cwd: root, env }), error => { const value = error as Error & { code: number; stdout: string }; assert.equal(value.code, 1); const report = JSON.parse(value.stdout); assert.equal(report.kind, "installation_preflight"); assert.equal(report.workspace.stateBoundary, "not_created"); assert.equal(report.browser.launchTested, false); assert(!value.stdout.includes(root)); return true; });
  await assert.rejects(execute(process.execPath, [resolve(project, "src/cli.ts"), "doctor", "--repair"], { cwd: root, env }), /Usage: redteam doctor/);
  assert.deepEqual(await tree(root), before);
}));
