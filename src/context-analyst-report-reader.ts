import { lstatSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";
import { ContextDataError, fields, json, text, timestamp, digest, uuid, privateBytes, recordDirectory, freeze } from "./context-data.ts";
import { sha256 } from "./evidence.ts";
import { readContextAnalystManifest } from "./context-analyst-artifacts.ts";
import { readContextAnalystCandidate } from "./context-analyst-candidate-reader.ts";
import { readContextProcessingAuthorization, checkContextProcessingAuthorizationAccess } from "./context-processing.ts";
import type { WorkspaceStore } from "./workspace.ts";
type Saved = Awaited<ReturnType<typeof readContextAnalystManifest>>;
const equal=(a:unknown,b:unknown)=>{if(!isDeepStrictEqual(a,b))throw new ContextDataError();};
function amount(v:unknown){const r=fields(v,["tokens","costMicrousd"]);for(const k of ["tokens","costMicrousd"])if(!Number.isSafeInteger(r[k])||(r[k] as number)<0)throw new ContextDataError();return{tokens:r.tokens as number,costMicrousd:r.costMicrousd as number};}
function budget(v:unknown,s:Saved){const b=fields(v,["asOf","basis","currentLedgerMayChange","snapshot"]),marker=timestamp(b.asOf);if(b.basis!=="configured_rate_estimate_not_provider_invoice"||b.currentLedgerMayChange!==true||Date.parse(marker)>Date.now()||Date.parse(marker)>=Date.parse(s.manifest.coordinatorDeadlineAt))throw new ContextDataError();const q=fields(b.snapshot,["run","invocations","pools"]),r=fields(q.run,["runId","cap","verificationReserve","reportReserve","deadlineAt","state","closeReason","createdAt"]),m=s.manifest;
 if(r.runId!==m.runId||r.deadlineAt!==m.inferenceDeadlineAt||r.state!=="closed")throw new ContextDataError();equal(amount(r.cap),m.budget.cap);equal(amount(r.verificationReserve),{tokens:0,costMicrousd:0});equal(amount(r.reportReserve),{tokens:0,costMicrousd:0});text(r.closeReason,200);const created=timestamp(r.createdAt);if(Date.parse(created)<Date.parse(m.preparedAt)||Date.parse(created)>=Date.parse(m.inferenceDeadlineAt)||Date.parse(marker)<Date.parse(created))throw new ContextDataError();
 if(!Array.isArray(q.invocations)||q.invocations.length>2)throw new ContextDataError();const seen=new Set<string>();const invocations=q.invocations.map(v=>{const a=fields(v,["id","runId","taskRef","pool","pricingRef","maximum","state","actual","overrun","createdAt","updatedAt"]),phase=a.id===`${m.runId}:context_count`?"count":a.id===`${m.runId}:context_generation`?"generation":null;if(!phase||seen.has(String(a.id))||a.runId!==m.runId||a.taskRef!==m.taskId||a.pool!=="investigation"||a.pricingRef!==m.configurationSha256||!["reserved","uncertain","settled","released"].includes(a.state as string))throw new ContextDataError();seen.add(String(a.id));equal(amount(a.maximum),m.budget[phase]);const actual=a.actual===null?null:amount(a.actual);if(a.state==="settled"?!actual||a.overrun!==(["tokens","costMicrousd"] as const).some(k=>actual[k]>m.budget[phase][k]):actual!==null||a.overrun!==false)throw new ContextDataError();const at=timestamp(a.createdAt),updated=timestamp(a.updatedAt);if(Date.parse(at)<Date.parse(created)||Date.parse(at)>=Date.parse(m.inferenceDeadlineAt)||Date.parse(updated)<Date.parse(at)||Date.parse(updated)>Date.now())throw new ContextDataError();return{id:String(a.id),runId:m.runId,taskRef:m.taskId,pool:"investigation",pricingRef:m.configurationSha256,maximum:{...m.budget[phase]},state:a.state as string,actual,overrun:a.overrun,createdAt:at,updatedAt:updated};});
 if(invocations.length===2&&Date.parse(invocations[1]!.createdAt)<Date.parse(invocations[0]!.createdAt))throw new ContextDataError();
 if(invocations.some((v,i)=>i&&v.id<invocations[i-1]!.id))throw new ContextDataError();const pools=["investigation","verification","report"].map(pool=>{const cap=pool==="investigation"?{...m.budget.cap}:{tokens:0,costMicrousd:0},spent={tokens:0n,costMicrousd:0n},held={tokens:0n,costMicrousd:0n};for(const item of invocations)if(item.pool===pool)for(const k of ["tokens","costMicrousd"] as const){if(item.state==="settled")spent[k]+=BigInt(item.actual![k]);else if(item.state!=="released")held[k]+=BigInt(item.maximum[k]);}const available=(k:"tokens"|"costMicrousd")=>Number(BigInt(cap[k])>spent[k]+held[k]?BigInt(cap[k])-spent[k]-held[k]:0n);return{pool,cap,spent:{tokens:String(spent.tokens),costMicrousd:String(spent.costMicrousd)},held:{tokens:String(held.tokens),costMicrousd:String(held.costMicrousd)},available:{tokens:available("tokens"),costMicrousd:available("costMicrousd")}};});equal(q.pools,pools);
 return{asOf:marker,basis:b.basis,currentLedgerMayChange:true,snapshot:{run:{runId:m.runId,cap:{...m.budget.cap},verificationReserve:{tokens:0,costMicrousd:0},reportReserve:{tokens:0,costMicrousd:0},deadlineAt:m.inferenceDeadlineAt,state:"closed",closeReason:r.closeReason,createdAt:created},invocations,pools}};
}
function readOptions(value: unknown) {
  const r = fields(value, Object.keys(value as object));
  if (Object.keys(r).some(k => !["signal", "timeoutMs"].includes(k))) throw new ContextDataError();
  const timeoutMs = r.timeoutMs === undefined ? 30000 : r.timeoutMs;
  if (!Number.isSafeInteger(timeoutMs) || (timeoutMs as number) < 1 || (timeoutMs as number) > 60000) throw new ContextDataError();
  if (r.signal !== undefined) {
    if (!(r.signal instanceof AbortSignal)) throw new ContextDataError();
    Object.getOwnPropertyDescriptor(AbortSignal.prototype, "aborted")!.get!.call(r.signal);
  }
  return { timeoutMs: timeoutMs as number, signal: r.signal as AbortSignal | undefined };
}
function abortable<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((accept, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(new ContextDataError()); };
    signal.addEventListener("abort", abort, { once: true });
    pending.then(v => { signal.removeEventListener("abort", abort); accept(v); }, e => { signal.removeEventListener("abort", abort); reject(e); });
    if (signal.aborted) abort();
  });
}
/** Local task history consistency. It is not independent execution attestation. */
function history(r: Record<string, unknown>, events: {kind: string; at: string}[]) {
  if (events.length < 4 || events[0]!.kind !== "created" || events[1]!.kind !== "claimed" || events[2]!.kind !== "started") throw new ContextDataError();
  let last = Date.parse(r.createdAt as string), dispatches = 0, sealed = false, finished = false;
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!, at = Date.parse(e.at);
    if (at < last || at > Date.parse(r.updatedAt as string) || finished) throw new ContextDataError();
    last = at;
    if (i < 3) continue;
    if (e.kind === "lease_extended" && !sealed) continue;
    if (e.kind === "dispatch_intent" && !sealed && ++dispatches <= 2) continue;
    if (e.kind === "output_sealed" && !sealed && dispatches === 2 && r.state === "completed") { sealed = true; continue; }
    if (e.kind === r.state && (r.state === "completed" ? sealed : !sealed)) { finished = true; continue; }
    throw new ContextDataError();
  }
  if (!finished || dispatches !== (r.dispatchIntents as unknown[]).length || last !== Date.parse(r.updatedAt as string)) throw new ContextDataError();
  if (r.state === "failed" && !["adapter_failed", "policy_denied", "invalid_output", "limit_reached"].includes(r.stopReason as string)
    || r.state === "cancelled" && r.stopReason !== "cancelled"
    || r.state === "interrupted" && !["lease_expired", "deadline_expired"].includes(r.stopReason as string)) throw new ContextDataError();
}
function budgetLinks(b: ReturnType<typeof budget>, r: Record<string, unknown>, requests: {count: boolean; generation: boolean}, settledGeneration: boolean) {
  const intents = r.dispatchIntents as {invocationRef: string}[];
  for (const phase of ["count", "generation"] as const) {
    const item = b.snapshot.invocations.find(v => v.id.endsWith(`:context_${phase}`));
    const intended = intents.some(v => v.invocationRef.endsWith(`:context_${phase}`));
    if (intended && !item || requests[phase] && (!intended || !item || !["uncertain", "settled"].includes(item.state))) throw new ContextDataError();
    if (phase === "generation" && settledGeneration && item?.state !== "settled") throw new ContextDataError();
  }
  if (b.snapshot.invocations.some(v => v.id.endsWith(":context_generation")) && !b.snapshot.invocations.some(v => v.id.endsWith(":context_count"))) throw new ContextDataError();
}
function safeFile(path:string,optional=false){const i=lstatSync(path,{bigint:true,throwIfNoEntry:false});if(!i){if(optional)return null;throw new ContextDataError();}if(!i.isFile()||i.isSymbolicLink()||i.nlink!==1n||i.mode&0o077n)throw new ContextDataError();return i;}
function directory(path:string){const i=lstatSync(path);if(!i.isDirectory()||i.isSymbolicLink()||i.mode&0o077||realpathSync(path)!==path)throw new ContextDataError();}
function taskSnapshot(state:string,s:Saved,pinned:NonNullable<ReturnType<typeof safeFile>>){directory(state);const file=resolve(state,"tasks.sqlite"),check=()=>{const now=safeFile(file)!;if(now.dev!==pinned.dev||now.ino!==pinned.ino)throw new ContextDataError();safeFile(file+"-wal",true);safeFile(file+"-shm",true);};check();
 // A read-only connection can be surrounded by a concurrent local task write.
 // Pin main/WAL metadata across the transaction AND resource closure. SHM read marks
 // are not content authority; its private mode/link checks still apply.
 const contentWitness=()=>[file,file+"-wal"].map(path=>{const i=safeFile(path,true);return i?[i.dev,i.ino,i.nlink,i.mode,i.size,i.mtimeNs,i.ctimeNs]:null;});
 const stable=contentWitness(),db=new DatabaseSync(file,{readOnly:true,allowExtension:false,defensive:true,timeout:1000});try{db.exec("BEGIN");if(db.prepare("PRAGMA journal_mode").get()?.journal_mode!=="wal")throw new ContextDataError();for(const[name,columns]of[["tasks",[["id","TEXT",1,0],["run_id","TEXT",0,1],["question_key","TEXT",0,1],["document","TEXT",0,1]]],["task_events",[["id","INTEGER",1,0],["task_id","TEXT",0,1],["kind","TEXT",0,1],["at","TEXT",0,1]]]] as const){if(db.prepare("SELECT type FROM sqlite_master WHERE name=?").get(name)?.type!=="table")throw new ContextDataError();equal(db.prepare(`PRAGMA table_info(${name})`).all().map(c=>[c.name,c.type,c.pk,c.notnull]),columns);}
 const row=db.prepare("SELECT id,run_id,question_key,CASE WHEN length(CAST(document AS BLOB)) BETWEEN 1 AND 1000000 THEN CAST(document AS BLOB) ELSE NULL END AS document FROM tasks WHERE id=?").get(s.taskId);if(!row||row.id!==s.taskId||row.run_id!==s.runId||row.question_key!==s.manifest.questionKey||!(row.document instanceof Uint8Array))throw new ContextDataError();const record=json(Buffer.from(row.document)),r=fields(record,["spec","state","attempt","fence","lease","dispatchIntents","output","stopReason","createdAt","updatedAt"]),m=s.manifest;equal(r.spec,{id:m.taskId,runId:m.runId,kind:"analyst",questionKey:m.questionKey,manifestHash:s.manifestSha256,maximumAttempts:1,deadlineAt:m.coordinatorDeadlineAt});if(!["completed","failed","cancelled","interrupted"].includes(r.state as string)||r.attempt!==1||r.fence!==1||r.lease!==null)throw new ContextDataError();if(r.state==="completed"){if(r.stopReason!==null)throw new ContextDataError();const out=fields(r.output,["artifactRef","sha256"]);if(out.artifactRef!==`${m.runId}:context_candidate`)throw new ContextDataError();digest(out.sha256);}else{if(r.output!==null)throw new ContextDataError();text(r.stopReason,200);}const created=timestamp(r.createdAt),updated=timestamp(r.updatedAt);if(Date.parse(created)<Date.parse(m.preparedAt)||Date.parse(created)>=Date.parse(m.inferenceDeadlineAt)||Date.parse(updated)<Date.parse(created)||Date.parse(updated)>=Date.parse(m.coordinatorDeadlineAt))throw new ContextDataError();
 if(!Array.isArray(r.dispatchIntents)||r.dispatchIntents.length>2)throw new ContextDataError();equal(r.dispatchIntents,["count","generation"].slice(0,r.dispatchIntents.length).map(phase=>({invocationRef:`${m.runId}:context_${phase}`,attempt:1})));const rows=db.prepare("SELECT CASE WHEN length(CAST(kind AS BLOB)) BETWEEN 1 AND 200 THEN CAST(kind AS BLOB) ELSE NULL END AS kind,CASE WHEN length(CAST(at AS BLOB)) BETWEEN 1 AND 32 THEN CAST(at AS BLOB) ELSE NULL END AS at FROM task_events WHERE task_id=? ORDER BY id LIMIT 4097").all(s.taskId);if(rows.length>4096)throw new ContextDataError();const events=rows.map(v=>{if(!(v.kind instanceof Uint8Array)||!(v.at instanceof Uint8Array))throw new ContextDataError();return{kind:text(new TextDecoder("utf-8",{fatal:true}).decode(v.kind),200),at:timestamp(new TextDecoder("utf-8",{fatal:true}).decode(v.at))};});history(r,events);db.exec("COMMIT");check();return{record,events};
 }finally{db.close();check();equal(contentWitness(),stable);}}
/** Existing normal report data only. Never execution, recovery, a new billing receipt or semantic approval. */
export async function readContextAnalystReport(store:WorkspaceStore,taskId:string,options: {signal?: AbortSignal; timeoutMs?: number} = {}) {
 let active = true, timer: ReturnType<typeof setTimeout> | undefined;
 try {
  uuid(taskId); const selected = readOptions(options), started = Date.now(), cutoff = started + selected.timeoutMs, controller = new AbortController();
  const signal = selected.signal ? AbortSignal.any([controller.signal, selected.signal]) : controller.signal;
  const guard = () => { if (!active || signal.aborted || Date.now() < started || Date.now() >= cutoff) throw new ContextDataError(); };
  guard(); timer = setTimeout(() => controller.abort(), selected.timeoutMs); timer.unref();
  let assertDelivery: (() => void) | undefined;
  const work = async () => { guard();const saved=await readContextAnalystManifest(store,taskId),m=saved.manifest,state=realpathSync(store.directory);directory(state);const pinned=safeFile(resolve(state,"tasks.sqlite"))!,task=taskSnapshot(state,saved,pinned),rawTask=fields(task.record,["spec","state","attempt","fence","lease","dispatchIntents","output","stopReason","createdAt","updatedAt"]),processing=await readContextProcessingAuthorization(store,m.processing.authorizationId);if(processing.recordSha256!==m.processing.recordSha256)throw new ContextDataError();const{directory:runDir}=await recordDirectory(state,"context-analyst-runs",m.runId),path=resolve(runDir,"report.json"),bytes=await privateBytes(state,path,128000),decoded=json(bytes),r=fields(decoded,["schemaVersion","kind","policyVersion","runId","taskId","recordedAt","manifestSha256","brief","context","processingRecordSha256","outcome","candidate","candidateSha256","failure","task","budget","boundaries"]),recorded=timestamp(r.recordedAt);if(Date.parse(recorded)<Date.parse(rawTask.updatedAt as string)||Date.parse(recorded)>=Date.parse(m.coordinatorDeadlineAt)||Date.parse(recorded)>Date.now())throw new ContextDataError();
 let candidate:Awaited<ReturnType<typeof readContextAnalystCandidate>>|null=null,failure:unknown=null;if(r.candidate!==null){candidate=await readContextAnalystCandidate(store,taskId);equal(r.candidate,candidate);equal(r.candidateSha256,candidate.sha256);if(rawTask.state!=="completed")throw new ContextDataError();equal(r.failure,null);equal(r.outcome,candidate.candidate.result.status==="checked_unreviewed"?"checked_unreviewed":"limited_coverage");}else{if(rawTask.state==="completed"||r.candidateSha256!==null||r.outcome!=="limited_coverage")throw new ContextDataError();const f=fields(r.failure,["phase","reason","requestsStarted"]);if(!["count","generation"].includes(f.phase as string)||!["phase_denied","interrupted","request_failed","redirect_denied","http_error","response_too_large","invalid_utf8","invalid_json","invalid_envelope","invalid_count","budget_overrun"].includes(f.reason as string))throw new ContextDataError();const requests=fields(f.requestsStarted,["count","generation"]);if(typeof requests.count!=="boolean"||typeof requests.generation!=="boolean"||requests.generation&&!requests.count||f.phase==="count"&&requests.generation)throw new ContextDataError();failure={phase:f.phase,reason:f.reason,requestsStarted:{count:requests.count,generation:requests.generation}};}
 const checkedBudget=budget(r.budget,saved);
 if(Date.parse(checkedBudget.asOf)<Date.parse(recorded))throw new ContextDataError();
 budgetLinks(checkedBudget, rawTask, candidate ? {count:true,generation:true} : (failure as {requestsStarted:{count:boolean;generation:boolean}}).requestsStarted, candidate?.candidate.result.generationLiability === "settled");
 if(failure){const f=failure as {phase:string;reason:string;requestsStarted:{count:boolean;generation:boolean}};
   if(f.phase==="generation"&&!f.requestsStarted.count||f.phase==="count"&&(rawTask.dispatchIntents as unknown[]).length>1
     ||f.phase==="count"&&checkedBudget.snapshot.invocations.some(v=>v.id.endsWith(":context_generation"))
     ||rawTask.state==="failed"&&rawTask.stopReason!==(f.reason==="budget_overrun"?"limit_reached":"adapter_failed"))throw new ContextDataError();
 }
 const expected={schemaVersion:"2.0",kind:"unreviewed_context_analyst_run",policyVersion:"brief-context-analyst-report-v1",runId:m.runId,taskId,recordedAt:recorded,manifestSha256:saved.manifestSha256,brief:m.source,context:m.context,processingRecordSha256:m.processing.recordSha256,outcome:r.outcome,candidate,candidateSha256:candidate?.sha256??null,failure,task,budget:checkedBudget,boundaries:{semanticReview:"unreviewed",researchValidity:"not_established",stakeholderDecisions:"not_performed",appExecution:"not_performed",globalAwareness:"not_established",providerAuthentication:"not_independently_established",historicalFinalReportReading:"not_implemented",recovery:"not_performed",atomicClockFileDatabaseTransaction:"not_claimed",cleanup:"record_created_before_resource_closure"}};equal(decoded,expected);if(!bytes.equals(Buffer.from(JSON.stringify(expected))))throw new ContextDataError();
 const output=freeze({schemaVersion:"2.0",kind:"checked_historical_context_report_data",runId:m.runId,taskId,sha256:sha256(bytes),report:expected,boundaries:{executionAuthority:"not_granted",ownership:"not_acquired",publicationReceipt:"not_recreated",runtimeObservation:"not_recreated",semanticReview:"unreviewed",billing:"recorded_snapshot_not_new_receipt",currentLedger:"not_read",cleanup:"not_independently_confirmed"}});
 // Pin all immutable inputs BEFORE the final full source reads. A file altered during any
 // later await must fail the public-frame witness, even if a buffered parse remains valid.
 const paths = [resolve(runDir,"manifest.json"),resolve(runDir,"generation.json"),path,
   resolve(state,"review-briefs",m.source.id,"report.json"),
   resolve(state,"context-snapshots",m.context.snapshotId,"snapshot.json"),
   resolve(state,"context-processing",m.processing.authorizationId,"record.json"),
   ...m.sourcePins.flatMap(pin => [resolve(state,"context-sources",pin.sourceId,"record.json"),resolve(state,"context-sources",pin.sourceId,"source.txt")]),
   ...(candidate ? [resolve(runDir,"candidate.json")] : [])];
 const witness = () => paths.map(file => {
   directory(state); directory(resolve(file,"..","..")); directory(resolve(file,".."));
   const i=safeFile(file)!;
   return [i.dev,i.ino,i.nlink,i.mode,i.size,i.mtimeNs,i.ctimeNs];
 });
 const pinnedInputs=witness(); guard();
 const current=await readContextAnalystManifest(store,taskId);equal(current,saved);if(candidate)equal(await readContextAnalystCandidate(store,taskId),candidate);equal(taskSnapshot(state,saved,pinned),task);directory(runDir);const reportWitness=safeFile(path)!;if(!(await privateBytes(state,path,128000)).equals(bytes))throw new ContextDataError();equal(taskSnapshot(state,saved,pinned),task);const now=safeFile(path)!;for(const k of ["dev","ino","nlink","mode","size","mtimeNs","ctimeNs"] as const)if(now[k]!==reportWitness[k])throw new ContextDataError();checkContextProcessingAuthorizationAccess(store,processing); guard();
 assertDelivery = () => {
   guard(); equal(witness(),pinnedInputs);
   // This synchronous read closes its DB before the final file/permission checks.
   equal(taskSnapshot(state,saved,pinned),task);
   equal(witness(),pinnedInputs); checkContextProcessingAuthorizationAccess(store,processing); guard();
 };
 return output;
 };
 const output=await abortable(work(),signal); guard();
 if(!assertDelivery)throw new ContextDataError(); assertDelivery(); return output;
 }catch{throw new ContextDataError();}finally{active=false;if(timer)clearTimeout(timer);}
}
