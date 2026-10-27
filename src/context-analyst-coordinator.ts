import { lstatSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { ContextDataError, fields, freeze, publish, recordDirectory, privateBytes } from "./context-data.ts";
import { sha256 } from "./evidence.ts";
import { parseContextAnalystConfiguration, prepareContextAnalystRun, checkContextAnalystFinalizationAccess } from "./context-analyst-config.ts";
import { saveContextAnalystManifest, verifyContextAnalystFinalizationFiles, readContextAnalystManifest } from "./context-analyst-artifacts.ts";
import { ContextAnalystTask } from "./context-analyst-task.ts";
import { ContextAnalystInvocations } from "./context-analyst-invocation.ts";
import { createOpenAIContextAnalystTransport } from "./context-analyst-transport.ts";
import { saveContextAnalystCandidate, verifyContextAnalystCandidate } from "./context-analyst-candidate.ts";
import { readContextAnalystCandidate } from "./context-analyst-candidate-reader.ts";
import type { WorkspaceStore } from "./workspace.ts";

interface Options { signal?: AbortSignal; transport?: typeof fetch }
function options(value: Options) {
  try { const raw = fields(value, Object.keys(value)); if (Object.keys(raw).some(k => !["signal", "transport"].includes(k)) || raw.transport !== undefined && typeof raw.transport !== "function") throw new ContextDataError();
  if (raw.signal !== undefined) { if (!(raw.signal instanceof AbortSignal)) throw new ContextDataError(); Object.getOwnPropertyDescriptor(AbortSignal.prototype, "aborted")!.get!.call(raw.signal); }
  return { signal: raw.signal as AbortSignal | undefined, transport: raw.transport as typeof fetch | undefined }; } catch { throw new ContextDataError(); }
}
function abortable<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((accept,reject) => { const abort = () => { signal.removeEventListener("abort",abort); reject(new ContextDataError()); }; signal.addEventListener("abort",abort,{once:true}); pending.then(value => { signal.removeEventListener("abort",abort); accept(value); },error => { signal.removeEventListener("abort",abort); reject(error); }); if(signal.aborted) abort(); });
}
/** One original context run. No key lookup, automatic retry, recovery, catalog, final-report reader or app execution. */
export async function runOpenAIContextAnalyst(store: WorkspaceStore, input: unknown, apiKey: string, suppliedOptions: Options = {}) {
  const config = parseContextAnalystConfiguration(input), selected = options(suppliedOptions);
  if (typeof apiKey !== "string" || apiKey.length < 8 || apiKey.length > 2048 || /[^\x21-\x7e]/u.test(apiKey)) throw new ContextDataError();
  const started = Date.now(), cutoff = started + config.limits.timeoutMs + config.limits.finalizationMs, controller = new AbortController(), signal = selected.signal ? AbortSignal.any([controller.signal,selected.signal]) : controller.signal;
  let active = true, stage = "preparing", runId: string | null = null, taskId: string | null = null, checkDelivery: (() => Promise<void>) | undefined, assertDelivery: (() => void) | undefined;
  const guard = () => { if (!active || signal.aborted || Date.now() < started || Date.now() >= cutoff) throw new ContextDataError(); return undefined; };
  guard(); const timer = setTimeout(() => controller.abort(),Math.max(1,cutoff-Date.now())); timer.unref();
  const unavailable = () => freeze({ schemaVersion: "2.0", kind: "context_analyst_coordinator_outcome", status: "unavailable", runId, taskId, stage, reason: signal.aborted ? "interrupted" : "records_or_authority_unavailable", report: null, reportSha256: null, retry: "not_authorized" });
  const work = async () => {
    let task: ContextAnalystTask | undefined, phases: ContextAnalystInvocations | undefined;
    const stop = () => { try { task?.stop("cancelled"); } catch { /* Preserve uncertain/stale task facts. */ } try { phases?.close(); } catch { /* No unknown spend is released. */ } };
    signal.addEventListener("abort",stop,{once:true});
    try {
      const p = await prepareContextAnalystRun(store,config); guard(); runId = p.manifest.runId; taskId = p.manifest.taskId;
      const secret = (text: string) => text.includes(apiKey) || text.includes(JSON.stringify(apiKey).slice(1,-1));
      if (secret(p.generation.input) || secret(JSON.stringify(p.generation))) throw new ContextDataError();
      stage = "publishing_manifest"; await saveContextAnalystManifest(store,p); guard();
      stage = "preparing_transport"; const transport = await createOpenAIContextAnalystTransport(store,p,apiKey,selected.transport); guard();
      stage = "creating_task"; task = await ContextAnalystTask.create(store,p,"LOCAL_CONTEXT_COORDINATOR",guard); guard();
      stage = "creating_budget"; phases = await ContextAnalystInvocations.create(store,p,task); guard();
      stage = "count_and_generation"; const result = await transport.run(phases); guard(); phases.close(); guard();
      let candidate: Awaited<ReturnType<typeof readContextAnalystCandidate>> | null = null;
      if (result.status !== "failed") {
        stage = "publishing_candidate"; const saved = await saveContextAnalystCandidate(store,p,task,result); guard();
        await verifyContextAnalystCandidate(store,p,task,saved); guard();
        stage = "sealing"; await task.seal({ artifactRef:saved.artifactRef,sha256:saved.sha256 }); guard(); await task.complete(saved.sha256); guard();
        candidate = await readContextAnalystCandidate(store,p.manifest.taskId); guard(); if(candidate.sha256!==saved.sha256) throw new ContextDataError();
      } else { task.stop(result.reason === "budget_overrun" ? "limit_reached" : "adapter_failed"); }
      stage = "publishing_report"; await verifyContextAnalystFinalizationFiles(store,p); guard(); checkContextAnalystFinalizationAccess(store,p);
      const checkedManifest = await readContextAnalystManifest(store,p.manifest.taskId); guard(); if(checkedManifest.manifestSha256!==p.manifestSha256) throw new ContextDataError();
      const taskSnapshot = task.snapshot(), state = taskSnapshot.record;
      if (!isDeepStrictEqual(state.spec,{id:taskId,runId,kind:"analyst",questionKey:p.manifest.questionKey,manifestHash:p.manifestSha256,maximumAttempts:1,deadlineAt:p.manifest.coordinatorDeadlineAt}) || state.attempt !== 1 || state.fence !== 1 || (candidate ? state.state !== "completed" : !["failed","cancelled","interrupted"].includes(state.state))) throw new ContextDataError();
      const report = freeze({ schemaVersion:"2.0",kind:"unreviewed_context_analyst_run",policyVersion:"brief-context-analyst-report-v1",runId,taskId,recordedAt:new Date().toISOString(),manifestSha256:p.manifestSha256,brief:p.manifest.source,context:p.manifest.context,processingRecordSha256:p.manifest.processing.recordSha256,
        outcome:result.status === "checked_unreviewed" ? "checked_unreviewed" : "limited_coverage",candidate,candidateSha256:candidate?.sha256 ?? null, failure:result.status === "failed" ? {phase:result.phase,reason:result.reason,requestsStarted:result.requestsStarted} : null,task:taskSnapshot,budget:{asOf:new Date().toISOString(),basis:"configured_rate_estimate_not_provider_invoice",currentLedgerMayChange:true,snapshot:phases.snapshot()},
        boundaries:{semanticReview:"unreviewed",researchValidity:"not_established",stakeholderDecisions:"not_performed",appExecution:"not_performed",globalAwareness:"not_established",providerAuthentication:"not_independently_established",historicalFinalReportReading:"not_implemented",recovery:"not_performed",atomicClockFileDatabaseTransaction:"not_claimed",cleanup:"record_created_before_resource_closure"} });
      const bytes = Buffer.from(JSON.stringify(report)); if(bytes.length>128000) throw new ContextDataError();
      const {state:root,directory} = await recordDirectory(store.directory,"context-analyst-runs",p.manifest.runId); guard(); checkContextAnalystFinalizationAccess(store,p);
      await publish(root,directory,"report.json",bytes,128000);
      await verifyContextAnalystFinalizationFiles(store,p); guard(); checkContextAnalystFinalizationAccess(store,p);
      const finalManifest = await readContextAnalystManifest(store,p.manifest.taskId); guard(); if(finalManifest.manifestSha256!==p.manifestSha256) throw new ContextDataError();
      if(candidate && (await readContextAnalystCandidate(store,p.manifest.taskId)).sha256!==candidate.sha256) throw new ContextDataError();
      if(!(await privateBytes(root,resolve(directory,"report.json"),128000)).equals(bytes) || !isDeepStrictEqual(task.snapshot(),taskSnapshot)) throw new ContextDataError();
      phases.snapshot(); guard(); checkContextAnalystFinalizationAccess(store,p);
      const book = phases, reportPath=resolve(directory,"report.json");
      const witness = () => {
        for(const path of [root,resolve(root,"context-analyst-runs"),directory]) { const info=lstatSync(path); if(!info.isDirectory() || info.isSymbolicLink() || info.mode & 0o077 || realpathSync(path)!==path) throw new ContextDataError(); }
        const info=lstatSync(reportPath,{bigint:true}); if(!info.isFile() || info.isSymbolicLink() || info.nlink!==1n || info.mode & 0o077n || info.size>128000n) throw new ContextDataError();
        return [info.dev,info.ino,info.nlink,info.mode,info.size,info.mtimeNs,info.ctimeNs];
      };
      let expectedWitness: ReturnType<typeof witness> | undefined;
      assertDelivery = () => { guard(); if(!expectedWitness || !isDeepStrictEqual(witness(),expectedWitness)) throw new ContextDataError(); checkContextAnalystFinalizationAccess(store,p); guard(); };
      checkDelivery = async () => {
        guard(); await verifyContextAnalystFinalizationFiles(store,p); guard();
        const saved = await readContextAnalystManifest(store,p.manifest.taskId); guard(); if(saved.manifestSha256!==p.manifestSha256) throw new ContextDataError();
        if(candidate && (await readContextAnalystCandidate(store,p.manifest.taskId)).sha256!==candidate.sha256) throw new ContextDataError();
        expectedWitness=witness();
        if(!(await privateBytes(root,reportPath,128000)).equals(bytes)) throw new ContextDataError();
        guard(); book.snapshot(); guard(); checkContextAnalystFinalizationAccess(store,p);
      };
      return freeze({schemaVersion:"2.0",kind:"context_analyst_coordinator_outcome",status:"published_unreviewed",runId,taskId,stage:"published",reason:null,report,reportSha256:sha256(bytes),retry:"not_authorized"});
    } catch { try { task?.stop(signal.aborted ? "cancelled" : "policy_denied"); } catch { /* Keep factual task records. */ } return unavailable(); }
    finally { let cleanupFailed=false; signal.removeEventListener("abort",stop); try { phases?.close(); } catch { cleanupFailed=true; } try { task?.close(); } catch { cleanupFailed=true; } if(cleanupFailed) { stage="cleanup"; return unavailable(); } }
  };
  try {
    const result = await abortable(work(),signal);
    if(result.status === "published_unreviewed") { guard(); if(!checkDelivery) throw new ContextDataError(); stage="checking_delivery"; await abortable(checkDelivery(),signal); guard(); if(!assertDelivery) throw new ContextDataError(); assertDelivery(); }
    return result;
  } catch { return unavailable(); }
  finally { active = false; clearTimeout(timer); }
}
