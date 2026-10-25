import { access, lstat, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { cpus, homedir, release } from "node:os";
import { boundedBytes, checkedDirectory, checkedParents, FileBoundaryError } from "./local-files.ts";

const driverVersion = "1.64.1", policyVersion = "local-installation-preflight-v1";
type FileState = "readable_file" | "executable_file" | "missing" | "unsafe_type" | "empty_file" | "access_denied" | "unavailable";
interface Context { platform: string; arch: string; osRelease: string; appleCpu: boolean; home: string; cwd: string; browserPath: string | undefined; initCwd: string | undefined; xdgCache: string | undefined; localAppData: string | undefined; hostOverride: string | undefined }
interface BrowserLocation { path: string; relativePath: string; cacheSource: "package_default" | "environment" | "hermetic" | "driver_default"; shortPlatform: string }
export interface InstallationReport {
  schemaVersion: "1.0"; kind: "installation_preflight"; policyVersion: typeof policyVersion; checkedAt: string;
  outcome: "checks_passed" | "needs_attention";
  runtime: { node: string | null; minimum: "24.12.0"; declaredRangeMet: boolean; compatibilityExecuted: false };
  package: { status: "checked" | "unavailable"; version: string | null; mode: "source" | "compiled"; assets: { path: string; status: FileState }[] };
  driver: { status: "checked" | "unavailable" | "unsupported_metadata"; version: string | null; headlessRevision: string | null; shortPlatform: string | null; cacheSource: BrowserLocation["cacheSource"] | null };
  browser: { headlessShell: { status: FileState | "not_checked"; relativePath: string | null }; macChrome: { status: FileState | "not_applicable" }; candidate: "pinned_headless_shell" | "mac_chrome_fallback_hint" | "none"; launchTested: false; hostDependenciesTested: false };
  workspace: { root: "directory_checked" | "unavailable"; stateBoundary: "not_created" | "private_directory" | "unsafe" | "unavailable" | "not_checked"; writeTested: false };
  scope: { browserReview: "controlled_local_signup_only"; sourceCodeExecution: "unavailable"; externalAppExecution: "unavailable"; stakeholderRuntime: "scripted_or_optional_configured"; releaseProviderVerification: "fake_transport_only"; validatedBehavioralModels: "not_implemented"; broaderHierarchy: "not_enabled" };
  effects: { filesWritten: false; databasesOpened: false; credentialsRead: false; browserLaunches: 0; modelCalls: 0; networkRequests: 0; repairsPerformed: false };
  issues: string[]; nextActions: string[]; limitations: string[];
}
export function meetsNodeMinimum(value: string): boolean {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  return !!match && match.slice(1).every(part => Number.isSafeInteger(Number(part))) && (Number(match[1]) > 24 || Number(match[1]) === 24 && Number(match[2]) >= 12);
}
/** Mirrors the pinned driver's cache/short-platform rules without importing or launching it. */
export function headlessLocation(projectRoot: string, coreRoot: string, revision: string, context: Context): BrowserLocation | null {
  if (context.hostOverride || !/^\d{1,10}$/.test(revision)) return null;
  let shortPlatform: string;
  if (context.platform === "darwin") shortPlatform = Number(context.osRelease.split(".")[0]) >= 20 && context.appleCpu ? "mac-arm64" : "mac-x64";
  else if (context.platform === "linux" && ["x64", "arm64"].includes(context.arch)) shortPlatform = `linux-${context.arch}`;
  else if (context.platform === "win32") shortPlatform = "win-x64";
  else return null;
  const suffixes: Record<string, string[]> = { "mac-x64": ["chrome-headless-shell-mac-x64", "chrome-headless-shell"], "mac-arm64": ["chrome-headless-shell-mac-arm64", "chrome-headless-shell"], "linux-x64": ["chrome-headless-shell-linux64", "chrome-headless-shell"], "linux-arm64": ["chrome-headless-shell-linux-arm64", "chrome-headless-shell"], "win-x64": ["chrome-headless-shell-win64", "chrome-headless-shell.exe"] };
  let cache: string, cacheSource: BrowserLocation["cacheSource"];
  if (context.browserPath === undefined) { cache = resolve(projectRoot, ".cache/ms-playwright"); cacheSource = "package_default"; }
  else if (context.browserPath === "0") { cache = resolve(coreRoot, ".local-browsers"); cacheSource = "hermetic"; }
  else if (context.browserPath) { cache = resolve(context.initCwd || context.cwd, context.browserPath); cacheSource = "environment"; }
  else {
    cacheSource = "driver_default";
    const base = context.platform === "darwin" ? resolve(context.home, "Library/Caches") : context.platform === "linux" ? context.xdgCache || resolve(context.home, ".cache") : context.localAppData || resolve(context.home, "AppData/Local");
    cache = resolve(context.initCwd || context.cwd, base, "ms-playwright");
  }
  const relativePath = [`chromium_headless_shell-${revision}`, ...suffixes[shortPlatform]!].join("/");
  return { path: resolve(cache, ...relativePath.split("/")), relativePath, cacheSource, shortPlatform };
}
async function fileState(path: string, executable = false, root?: string): Promise<FileState> {
  try {
    if (root) await checkedParents(root, path);
    const info = await lstat(path); if (!info.isFile() || info.isSymbolicLink()) return "unsafe_type"; if (!info.size) return "empty_file";
    await access(path, executable ? constants.X_OK : constants.R_OK); return executable ? "executable_file" : "readable_file";
  } catch (error) { if (error instanceof FileBoundaryError) return "unsafe_type"; const code = (error as NodeJS.ErrnoException).code; return code === "ENOENT" || code === "ENOTDIR" ? "missing" : code === "EACCES" || code === "EPERM" ? "access_denied" : "unavailable"; }
}
async function metadata(root: string, file: string): Promise<Record<string, unknown>> { const bytes = await boundedBytes(root, resolve(root, file), 65_536); const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value as Record<string, unknown>; }
export async function inspectInstallation(options: { projectRoot: string; workspace: string; mode?: "source" | "compiled"; nodeVersion?: string; driverRoot?: string; context?: Context }): Promise<InstallationReport> {
  const initCwd = process.env.INIT_CWD ?? process.env.npm_config_init_cwd ?? process.env.npm_package_config_init_cwd;
  const context = options.context ?? { platform: process.platform, arch: process.arch, osRelease: release(), appleCpu: cpus().some(cpu => cpu.model.includes("Apple")), home: homedir(), cwd: process.cwd(), browserPath: process.env.PLAYWRIGHT_BROWSERS_PATH, initCwd, xdgCache: process.env.XDG_CACHE_HOME, localAppData: process.env.LOCALAPPDATA, hostOverride: process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE };
  const node = options.nodeVersion ?? process.version, mode = options.mode ?? (import.meta.url.endsWith(".js") ? "compiled" : "source");
  const report: InstallationReport = { schemaVersion: "1.0", kind: "installation_preflight", policyVersion, checkedAt: new Date().toISOString(), outcome: "needs_attention", runtime: { node: /^v?\d+\.\d+\.\d+$/.test(node) ? node : null, minimum: "24.12.0", declaredRangeMet: meetsNodeMinimum(node), compatibilityExecuted: false },
    package: { status: "unavailable", version: null, mode, assets: [] }, driver: { status: "unavailable", version: null, headlessRevision: null, shortPlatform: null, cacheSource: null }, browser: { headlessShell: { status: "not_checked", relativePath: null }, macChrome: { status: "not_applicable" }, candidate: "none", launchTested: false, hostDependenciesTested: false }, workspace: { root: "unavailable", stateBoundary: "not_checked", writeTested: false },
    scope: { browserReview: "controlled_local_signup_only", sourceCodeExecution: "unavailable", externalAppExecution: "unavailable", stakeholderRuntime: "scripted_or_optional_configured", releaseProviderVerification: "fake_transport_only", validatedBehavioralModels: "not_implemented", broaderHierarchy: "not_enabled" }, effects: { filesWritten: false, databasesOpened: false, credentialsRead: false, browserLaunches: 0, modelCalls: 0, networkRequests: 0, repairsPerformed: false }, issues: [], nextActions: [], limitations: ["This preflight checks bounded trusted package metadata, asset/file presence and access, browser candidate metadata, and directory boundaries. It does not launch a browser, validate host libraries/signing/quarantine, or prove runtime success.", "The Node check covers the declared engine range, not tested compatibility with every matching version. The CLI itself needs a runtime capable of loading its native modules.", "Pinned browser discovery is version-specific. Candidate presence and executable access are hints. The macOS fallback runs only after the actual pinned executable-missing error; it is not exercised here.", "No .env, key/session/vault/research/SQLite content or raw target source is read. Unrelated environment values and absolute runtime locations are not included. Driver roots and package layouts remain trusted local inputs.", "Checks do not create stores, write/repair/install files, contact a service/provider, or run app/model tools. Existing local filesystem and permission races can change a later launch.", "Installation preflight establishes no production isolation, external execution permission, researched psychology, population validity, human outcome, customer demand, purchase/investment decision, funding probability, or commercial validation."] };
  const issue = (code: string, action: string) => { if (!report.issues.includes(code)) report.issues.push(code); if (!report.nextActions.includes(action)) report.nextActions.push(action); };
  if (!report.runtime.declaredRangeMet) issue("node_range_not_met", "Use a stable Node release that meets the declared >=24.12.0 engine range, then rerun this preflight.");
  try {
    const root = await realpath(options.projectRoot); if ((await lstat(options.projectRoot)).isSymbolicLink()) throw new Error(); await checkedDirectory(root);
    const pkg = await metadata(root, "package.json"); if (pkg.name !== "redteam" || typeof pkg.version !== "string" || !/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error(); report.package.version = pkg.version; report.package.status = "checked";
    for (const path of [mode === "compiled" ? "dist/cli.js" : "src/cli.ts", "web/index.html", "web/app.js", "web/styles.css", "examples/pilot-signup.study.json", "fixtures/pilot-signup.requirement.md"]) { const status = await fileState(resolve(root, path), false, root); report.package.assets.push({ path, status }); if (status !== "readable_file") issue("package_assets_unavailable", "Restore a complete trusted Redteam package/source checkout. This preflight does not repair assets."); }
    const coreRoot = await realpath(options.driverRoot ?? dirname(createRequire(import.meta.url).resolve("playwright-core/package.json"))); await checkedDirectory(coreRoot);
    const core = await metadata(coreRoot, "package.json"); if (typeof core.version === "string" && /^\d+\.\d+\.\d+$/.test(core.version)) report.driver.version = core.version;
    if (core.name !== "playwright-core" || core.version !== driverVersion) { report.driver.status = "unsupported_metadata"; throw new Error(); }
    const browserMeta = await metadata(coreRoot, "browsers.json"), descriptors = browserMeta.browsers;
    if (!Array.isArray(descriptors) || descriptors.length > 30) { report.driver.status = "unsupported_metadata"; throw new Error(); }
    const shells = descriptors.filter(item => item && typeof item === "object" && item.name === "chromium-headless-shell");
    const shell = shells[0]; if (shells.length !== 1 || !shell || typeof shell.revision !== "string" || !/^\d{1,10}$/.test(shell.revision) || shell.revisionOverrides !== undefined && (!shell.revisionOverrides || typeof shell.revisionOverrides !== "object" || Array.isArray(shell.revisionOverrides) || Object.keys(shell.revisionOverrides).length)) { report.driver.status = "unsupported_metadata"; throw new Error(); }
    const location = headlessLocation(root, coreRoot, shell.revision, context); report.driver.headlessRevision = shell.revision;
    if (!location) { report.driver.status = "unsupported_metadata"; throw new Error(); }
    report.driver.status = "checked"; report.driver.shortPlatform = location.shortPlatform; report.driver.cacheSource = location.cacheSource;
    report.browser.headlessShell = { status: await fileState(location.path, true), relativePath: location.relativePath };
    if (context.platform === "darwin") report.browser.macChrome.status = await fileState("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", true);
    if (report.browser.headlessShell.status === "executable_file") report.browser.candidate = "pinned_headless_shell";
    else if (report.browser.headlessShell.status === "missing" && report.browser.macChrome.status === "executable_file") report.browser.candidate = "mac_chrome_fallback_hint";
    else issue("browser_candidate_unavailable", location.cacheSource === "package_default" ? "Use redteam examples to locate the package, run its npm run browser:install script from that package directory, then run redteam review --demo fixed separately." : "Install the pinned Chromium headless shell with this package's Playwright CLI under the same browser-cache settings, then run redteam review --demo fixed separately.");
  } catch { issue(report.package.status === "unavailable" ? "package_metadata_unavailable" : "driver_metadata_unavailable", "Inspect the trusted package installation and pinned Playwright metadata/configuration. Unsupported layouts/host overrides are not guessed or repaired."); }
  try {
    if ((await lstat(options.workspace)).isSymbolicLink()) throw new Error(); const workspace = await realpath(options.workspace); await checkedDirectory(workspace); report.workspace.root = "directory_checked";
    try { const state = await lstat(resolve(workspace, ".redteam")); report.workspace.stateBoundary = state.isDirectory() && !state.isSymbolicLink() && !(state.mode & 0o077) ? "private_directory" : "unsafe"; }
    catch (error) { report.workspace.stateBoundary = (error as NodeJS.ErrnoException).code === "ENOENT" ? "not_created" : "unavailable"; }
    if (!["private_directory", "not_created"].includes(report.workspace.stateBoundary)) issue("workspace_state_boundary_unavailable", "Review the .redteam directory type and owner-only permissions before creating or opening local stores. No file is changed here.");
  } catch { issue("workspace_directory_unavailable", "Run from an existing trusted directory. The preflight does not follow a workspace leaf symlink or create a directory."); }
  report.outcome = report.issues.length ? "needs_attention" : "checks_passed";
  if (!report.issues.length) report.nextActions.push("Run redteam review --demo fixed separately for actual browser evidence. File preflight alone does not establish a successful launch or broader product validity.");
  return report;
}
