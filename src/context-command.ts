import {EventEmitter} from "node:events";
import {ContextDataError, fields, freeze} from "./context-data.ts";
import {parseContextStartArguments, selectContextStartInput} from "./context-start-input.ts";
import {readContextAnalystConfigurationInput} from "./context-analyst-config.ts";
import {runContextAnalystInWorkspace} from "./context-analyst-workspace.ts";

interface Services {
  signals?: EventEmitter;
  readConfiguration?: (file: string) => Promise<unknown>;
  readSelectedValue?: (name: string) => unknown;
  transport?: typeof fetch;
}
function services(value: unknown): Services {
  const r = fields(value, Object.keys(value as object));
  if (Object.keys(r).some(k => !["signals", "readConfiguration", "readSelectedValue", "transport"].includes(k))) throw new ContextDataError();
  if (r.signals !== undefined && !(r.signals instanceof EventEmitter)) throw new ContextDataError();
  for (const k of ["readConfiguration", "readSelectedValue", "transport"]) {
    if (r[k] !== undefined && typeof r[k] !== "function") throw new ContextDataError();
  }
  return r as Services;
}
function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((accept, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(new ContextDataError()); };
    signal.addEventListener("abort", abort, {once: true});
    // Observe work even after cancellation; a late rejection must not reach terminal output.
    work.then(v => { signal.removeEventListener("abort", abort); accept(v); }, e => { signal.removeEventListener("abort", abort); reject(e); });
    if (signal.aborted) abort();
  });
}
const unavailable = (reason: string | null) => freeze({
  exitCode: reason === "SIGINT" ? 130 : reason === "SIGTERM" ? 143 : 1,
  body: null, error: "context_start_unavailable"
});

/** Deliberate terminal boundary. Named environment access follows valid arguments and configuration. */
export async function runContextStartCommand(workspace: string, suppliedArguments: unknown, suppliedServices: Services = {}) {
  const controller = new AbortController();
  let received: "SIGINT" | "SIGTERM" | "input_timeout" | null = null;
  let signals: EventEmitter | undefined, intAttempted = false, termAttempted = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = (name: typeof received) => { if (received === null) { received = name; controller.abort(); } };
  const interrupt = () => stop("SIGINT"), terminate = () => stop("SIGTERM");
  try {
    const parsed = parseContextStartArguments(suppliedArguments);
    const args = [parsed.configurationFile, "--key-env", parsed.keyEnvironmentName], s = services(suppliedServices);
    signals = s.signals ?? process;
    // Track attempted registration too: a trusted emitter can add a handler and then throw.
    intAttempted = true; signals.on("SIGINT", interrupt);
    termAttempted = true; signals.on("SIGTERM", terminate);
    timer = setTimeout(() => stop("input_timeout"), 30000); timer.unref();
    const configuration = await abortable((s.readConfiguration ?? readContextAnalystConfigurationInput)(parsed.configurationFile), controller.signal);
    if (controller.signal.aborted) throw new ContextDataError();
    clearTimeout(timer); timer = undefined;
    const selected = selectContextStartInput(args, configuration, s.readSelectedValue ?? ((name: string) => process.env[name]));
    if (controller.signal.aborted) throw new ContextDataError();
    const result = await abortable(runContextAnalystInWorkspace(workspace, selected, {
      signal: controller.signal, ...(s.transport ? {transport: s.transport} : {})
    }), controller.signal);
    if (controller.signal.aborted) throw new ContextDataError();
    if (result.status === "unavailable" && result.report === null) return freeze({exitCode: 1, body: result, error: null});
    if (result.status !== "published_unreviewed" || !result.report || !["checked_unreviewed", "limited_coverage"].includes(result.report.report.outcome as string)) throw new ContextDataError();
    return freeze({exitCode: result.report.report.outcome === "checked_unreviewed" ? 0 : 2, body: result, error: null});
  } catch {
    return unavailable(received);
  } finally {
    if (timer) clearTimeout(timer);
    let failed = false;
    try { if (intAttempted) signals?.off("SIGINT", interrupt); } catch { failed = true; }
    try { if (termAttempted) signals?.off("SIGTERM", terminate); } catch { failed = true; }
    if (failed) return unavailable(null);
  }
}
