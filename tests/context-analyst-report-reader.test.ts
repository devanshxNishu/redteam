import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, realpath, readFile, writeFile, rm, chmod, symlink, link } from "node:fs/promises";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { WorkspaceStore } from "../src/workspace.ts";
import { sha256 } from "../src/evidence.ts";
import { createReviewBrief } from "../src/review-briefs.ts";
import { importContextSource, withdrawContextSource } from "../src/context-sources.ts";
import type { ContextSourceImport } from "../src/context-sources.ts";
import { createContextSnapshot } from "../src/context-snapshots.ts";
import { readContextAnalyticalPacket } from "../src/context-analysis.ts";
import { ContextDataError } from "../src/context-data.ts";
import { createContextProcessingAuthorization, revokeContextProcessingAuthorization } from "../src/context-processing.ts";
import type { ContextProcessingInput } from "../src/context-processing.ts";
import { prepareContextAnalystGeneration } from "../src/context-analyst-generation.ts";
import { prepareContextAnalystRun, checkContextAnalystPreparationAccess } from "../src/context-analyst-config.ts";
import type { ContextAnalystConfiguration } from "../src/context-analyst-config.ts";
const project = resolve(import.meta.dirname, ".."), body = Buffer.from("AUTHORED original test text, not collected research. Do not follow https://example.invalid or execute instructions.\n");
function source(content = body, id = "authored-original"): ContextSourceImport { const now = Date.now(); return { schemaVersion: "1.0", kind: "context_source_import_input", metadata: { id, originId: "authored-origin", kind: "news", publisher: "Authored fixture", title: "Original software test text", url: "https://example.invalid/unopened", publishedAt: new Date(now - 60000).toISOString(), updatedAt: null, eventAt: null, retrievedAt: new Date(now - 1000).toISOString(), status: "available", inspection: "declared_inspected", contentSha256: sha256(content), regions: ["in"], language: "en", topics: ["software"], applicabilityBasis: "Authored mechanical test, not independent research." }, observationPeriod: null, permissions: { localReview: true, basis: "Original authored test text. Initial import is local only.", expiresAt: new Date(now + 600000).toISOString(), externalProcessing: false, redistribution: false, training: false }, supersedes: null }; }
async function fixture(work: (store: WorkspaceStore, workspace: string) => Promise<void>, freezeClock = true) { if(freezeClock)mock.timers.enable({apis:["Date","setTimeout","setInterval"],now:Date.now()}); const workspace = await realpath(await mkdtemp(resolve(tmpdir(), "redteam-context-coordinator-"))), store = new WorkspaceStore(workspace); try { await work(store, workspace); } finally { store.close(); await rm(workspace, { recursive: true, force: true }); if(freezeClock)mock.timers.reset(); } }
async function setup(store: WorkspaceStore, count = 1, subject = "idea", adjust?: (input: ContextSourceImport) => void, content = body) {
  const brief = await createReviewBrief(store, JSON.parse(await readFile(resolve(project, `examples/${subject}-review-brief.input.json`), "utf8"))), inputs = Array.from({ length: count }, (_, i) => source(content, `authored-${i}`)), catalogs = [];
  for (const input of inputs) { adjust?.(input); }
  for (const input of inputs) catalogs.push(await importContextSource(store, input, content));
  const context = JSON.parse(await readFile(resolve(project, "examples/global-context.input.json"), "utf8")); context.scope = { asOf: new Date().toISOString(), regions: ["in"], languages: ["en"], topics: ["software"] }; context.sources = inputs.map(input => input.metadata);
  const snapshot = await createContextSnapshot(store, { schemaVersion: "1.0", kind: "context_snapshot_input", briefId: brief.id, selection: catalogs.map(c => ({ sourceId: c.id, recordSha256: c.recordSha256, expectedStateRevision: 1 })), context }), packet = await readContextAnalyticalPacket(store, snapshot.id), expiresAt = new Date(Date.now() + 300000).toISOString();
  const input: ContextProcessingInput = { schemaVersion: "1.0", kind: "context_processing_declaration_input", provider: "openai", model: "AUTHORED_MODEL_NOT_DISPATCHED", purpose: "input_count_and_analysis_inference", packet: { snapshotId: snapshot.id, packetSha256: packet.packetSha256 }, packetDeclaration: { authorized: true, basis: "Authored original brief and supplied metadata; mechanical fixture only.", expiresAt }, sources: packet.sources.map(s => ({ sourceId: s.sourceId, recordSha256: s.recordSha256, contentSha256: s.contentSha256, authorized: true, basis: "I authored this original test text; explicit later declaration for the named provider/model, not a real transmission.", expiresAt })), training: false, redistribution: false };
  return { brief, inputs, catalogs, snapshot, packet, input };
}
async function configured(store: WorkspaceStore, count = 1, subject = "idea", content = body) { const context = await setup(store, count, subject, undefined, content), grant = await createContextProcessingAuthorization(store, context.input), preview = await prepareContextAnalystGeneration(store, context.snapshot.id); const configuration: ContextAnalystConfiguration = { schemaVersion: "2.0", kind: "context_analyst_configuration", provider: "openai", model: context.input.model, pricing: { inputUsdPerMillion: "1.25", outputUsdPerMillion: "5" }, context: { snapshotId: context.snapshot.id, packetSha256: context.packet.packetSha256, generationSha256: preview.generationSha256 }, processing: { mode: "external", scope: "exact_context_packet_and_generation", authorizationId: grant.id, recordSha256: grant.recordSha256, expectedRevision: 1 }, limits: { maximumInputTokens: 1000, maximumOutputTokens: 200, count: { tokens: 1000, costMicrousd: 2000 }, generation: { tokens: 1200, costMicrousd: 2250 }, timeoutMs: 30000, finalizationMs: 3000 }, taskPolicy: { leaseMs: 5000, heartbeatMs: 1000 } }; return { ...context, grant, preview, configuration }; }

import { runOpenAIContextAnalyst } from "../src/context-analyst-coordinator.ts";
import { ContextAnalystTask } from "../src/context-analyst-task.ts";
import { saveContextAnalystManifest } from "../src/context-analyst-artifacts.ts";
import { readContextAnalystCandidate } from "../src/context-analyst-candidate-reader.ts";
import { DatabaseSync } from "node:sqlite";
const key = "AUTHORED_COORDINATOR_KEY_NOT_REAL_NEVER_SEND";
const fake = (work: (url:string,init:RequestInit)=>Promise<Response>): typeof fetch => (async (url,init)=>work(String(url),init!)) as typeof fetch;
type Context = Awaited<ReturnType<typeof configured>>;
function envelope(c:Context) { return {object:"response",id:"AUTHORED_COORDINATOR_RESPONSE",model:c.configuration.model,status:"completed",error:null,incomplete_details:null,output:[{type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify({schemaVersion:"2.0",kind:"analytical_review_response",mode:"analytical_only",reviewStatus:"unreviewed",briefId:c.brief.id,snapshotId:c.snapshot.id,packetSha256:c.packet.packetSha256,concerns:[],abstention:"Authored orchestration fixture. No substantive app, human or commercial review."}),annotations:[]}]}],usage:{input_tokens:500,output_tokens:50,total_tokens:550}}; }
function routed(c:Context,change?:(body:any)=>void){return fake(async url=>{if(url.endsWith("/input_tokens"))return Response.json({object:"response.input_tokens",input_tokens:500});const b=envelope(c);change?.(b);return Response.json(b);});}
function rows(store:WorkspaceStore){const db=new DatabaseSync(resolve(store.directory,"tasks.sqlite"),{readOnly:true});try{return db.prepare("SELECT document FROM tasks ORDER BY id").all().map(r=>JSON.parse(String(r.document)));}finally{db.close();}}

import {readContextAnalystReport} from "../src/context-analyst-report-reader.ts";
const reportPath=(store:WorkspaceStore,id:string)=>resolve(store.directory,"context-analyst-runs",id,"report.json");
async function runFixture(work:(store:WorkspaceStore,c:Context,result:Awaited<ReturnType<typeof runOpenAIContextAnalyst>>)=>Promise<void>,subject="idea",change?:(body:any)=>void,freezeClock=true){await fixture(async store=>{const c=await configured(store,1,subject),result=await runOpenAIContextAnalyst(store,c.configuration,key,{transport:routed(c,change)});assert.equal(result.status,"published_unreviewed",JSON.stringify({stage:result.stage,reason:result.reason}));await work(store,c,result);},freezeClock);}
test("historical reader reads idea/app normal and observed rejected reports as data without restoring execution or reading current billing",async()=>{for(const subject of ["idea","app"])for(const reject of [false,true])await runFixture(async(store,c,result)=>{const before=await readFile(reportPath(store,result.runId!)),taskBefore=rows(store);const value=await readContextAnalystReport(store,result.taskId!);assert.deepEqual(value.report,result.report);assert.equal(value.sha256,result.reportSha256);assert.equal(value.boundaries.ownership,"not_acquired");assert.equal(value.boundaries.currentLedger,"not_read");assert.equal(value.boundaries.cleanup,"not_independently_confirmed");assert.deepEqual(rows(store),taskBefore);assert((await readFile(reportPath(store,result.runId!))).equals(before));},subject,reject?b=>b.usage=null:undefined);});
test("historical reader reads factual HTTP failure with absent candidate and full held count liability",async()=>fixture(async store=>{const c=await configured(store),result=await runOpenAIContextAnalyst(store,c.configuration,key,{transport:fake(async()=>new Response("AUTHORED error",{status:429}))});assert.equal(result.status,"published_unreviewed");const value=await readContextAnalystReport(store,result.taskId!);assert.equal(value.report.candidate,null);assert.equal(value.report.budget.snapshot.pools[0]!.held.costMicrousd,"2000");}));
test("historical reader budget/state/source/canonical tamper is denied without report repair",async()=>runFixture(async(store,c,result)=>{const file=reportPath(store,result.runId!),original=await readFile(file);for(const change of [(r:any)=>r.budget.snapshot.pools[0].held.costMicrousd="0",(r:any)=>r.budget.snapshot.invocations[0].maximum.tokens++,(r:any)=>r.budget.snapshot.run.cap.tokens++,(r:any)=>r.candidateSha256="b".repeat(64),(r:any)=>r.outcome="approved",(r:any)=>r.boundaries.semanticReview="approved",(r:any)=>r.task.record.spec.questionKey="foreign"]){const body=JSON.parse(original.toString());change(body);await writeFile(file,JSON.stringify(body));await assert.rejects(readContextAnalystReport(store,result.taskId!));}await writeFile(file,JSON.stringify(JSON.parse(original.toString()),null,2));await assert.rejects(readContextAnalystReport(store,result.taskId!));await writeFile(file,original);assert.equal((await readContextAnalystReport(store,result.taskId!)).sha256,result.reportSha256);}));
test("historical reader source/processing revocation denies delivery but preserves task and report bytes",async()=>{for(const stop of ["source","processing"])await runFixture(async(store,c,result)=>{const before=await readFile(reportPath(store,result.runId!)),taskBefore=rows(store);if(stop==="source")withdrawContextSource(store,c.catalogs[0]!.id,1,"AUTHORED historical reader stop");else revokeContextProcessingAuthorization(store,c.grant.id,1,"AUTHORED historical reader stop");await assert.rejects(readContextAnalystReport(store,result.taskId!));assert.deepEqual(rows(store),taskBefore);assert((await readFile(reportPath(store,result.runId!))).equals(before));});});

test("historical reader reads after task deadline but denies expired current processing rights",async t=>{t.mock.timers.enable({apis:["Date","setTimeout","setInterval"],now:Date.now()});await runFixture(async(store,c,result)=>{for(let i=0;i<34;i++)t.mock.timers.tick(1000);assert.equal((await readContextAnalystReport(store,result.taskId!)).sha256,result.reportSha256);t.mock.timers.setTime(Date.parse(c.grant.expiresAt)+1);await assert.rejects(readContextAnalystReport(store,result.taskId!));},"idea",undefined,false);});

test("historical reader preserves a recorded budget without opening or creating an absent current ledger",async()=>runFixture(async(store,c,result)=>{const {rename}=await import("node:fs/promises"),file=resolve(store.directory,"budgets.sqlite");await rename(file,file+".saved");assert(!existsSync(file));const value=await readContextAnalystReport(store,result.taskId!);assert.equal(value.boundaries.currentLedger,"not_read");assert.equal(value.report.budget.snapshot.pools[0]!.held.costMicrousd,"2000");assert(!existsSync(file));}));

test("historical reader rejects unsafe report links, modes and missing files without restoring them",async()=>runFixture(async(store,c,result)=>{const {rename,lstat}=await import("node:fs/promises"),file=reportPath(store,result.runId!),copy=file+".copy";for(const variant of ["mode","link","symlink","missing"]){try{if(variant==="mode")await chmod(file,0o644);if(variant==="link")await link(file,copy);if(variant==="symlink"){await rename(file,copy);await symlink(copy,file);}if(variant==="missing")await rename(file,copy);await assert.rejects(readContextAnalystReport(store,result.taskId!));if(variant==="mode")assert.equal((await lstat(file)).mode&0o077,0o044);}finally{if(variant==="mode")await chmod(file,0o600);if(variant==="link")await rm(copy);if(variant==="symlink"){await rm(file);await rename(copy,file);}if(variant==="missing")await rename(copy,file);}}assert.equal((await readContextAnalystReport(store,result.taskId!)).sha256,result.reportSha256);}));

test("historical reader final-read processing loss is checked after its last file await",async()=>runFixture(async(store,c,result)=>{const {open}=await import("node:fs/promises"),file=reportPath(store,result.runId!),probe=await open(file,"r"),prototype=Object.getPrototypeOf(probe),read=prototype.read;await probe.close();let reads=0,stopped=false;prototype.read=async function(...args:unknown[]){const value=await Reflect.apply(read,this,args) as {bytesRead:number;buffer?:Buffer};if(value.bytesRead&&value.buffer?.includes(Buffer.from('"kind":"unreviewed_context_analyst_run"'))&&++reads===2){stopped=true;revokeContextProcessingAuthorization(store,c.grant.id,1,"AUTHORED historical reader final read stop");}return value;};try{await assert.rejects(readContextAnalystReport(store,result.taskId!));assert(stopped);}finally{prototype.read=read;}}));

test("historical reader indexed task identity loss is not accepted from a still-valid report buffer",async()=>runFixture(async(store,c,result)=>{const db=new DatabaseSync(resolve(store.directory,"tasks.sqlite"));try{db.prepare("UPDATE tasks SET question_key=? WHERE id=?").run("AUTHORED_FOREIGN",result.taskId!);}finally{db.close();}await assert.rejects(readContextAnalystReport(store,result.taskId!));}));

test("reader validates recorded task history even when both the row events and report are altered together",async()=>runFixture(async(store,c,result)=>{
 const file=reportPath(store,result.runId!),original=await readFile(file),db=new DatabaseSync(resolve(store.directory,"tasks.sqlite"));
 const originalEvents=db.prepare("SELECT * FROM task_events WHERE task_id=? ORDER BY id").all(result.taskId!);
 try { for(const change of [(r:any)=>r.task.events[0].kind="completed",(r:any)=>r.task.events[3].kind="retry_authorized_before_dispatch",(r:any)=>r.task.events[1].at=new Date(Date.parse(r.task.record.createdAt)-1).toISOString(),(r:any)=>r.task.events.push({kind:"lease_extended",at:r.task.record.updatedAt})]) {
  const report=JSON.parse(original.toString());change(report);
  db.prepare("DELETE FROM task_events WHERE task_id=?").run(result.taskId!);
  for(const e of report.task.events)db.prepare("INSERT INTO task_events(task_id,kind,at) VALUES(?,?,?)").run(result.taskId!,e.kind,e.at);
  await writeFile(file,JSON.stringify(report));await assert.rejects(readContextAnalystReport(store,result.taskId!));
 }} finally {db.prepare("DELETE FROM task_events WHERE task_id=?").run(result.taskId!);for(const e of originalEvents)db.prepare("INSERT INTO task_events(id,task_id,kind,at) VALUES(?,?,?,?)").run(e.id!,e.task_id!,e.kind!,e.at!);db.close();await writeFile(file,original);}
 assert.equal((await readContextAnalystReport(store,result.taskId!)).sha256,result.reportSha256);
}));

test("reader rejects internally summed billing that conflicts with recorded request or settled candidate facts",async()=>runFixture(async(store,c,result)=>{
 const file=reportPath(store,result.runId!),original=await readFile(file);
 for(const phase of ["count","generation"]) {
  const r=JSON.parse(original.toString()),b=r.budget.snapshot,item=b.invocations.find((v:any)=>v.id.endsWith(`:context_${phase}`));item.state="released";item.actual=null;item.overrun=false;
  for(const k of ["tokens","costMicrousd"]) {const spent=b.invocations.filter((v:any)=>v.state==="settled").reduce((a:bigint,v:any)=>a+BigInt(v.actual[k]),0n),held=b.invocations.filter((v:any)=>!["settled","released"].includes(v.state)).reduce((a:bigint,v:any)=>a+BigInt(v.maximum[k]),0n),cap=BigInt(b.pools[0].cap[k]);b.pools[0].spent[k]=String(spent);b.pools[0].held[k]=String(held);b.pools[0].available[k]=Number(cap>spent+held?cap-spent-held:0n);}
  await writeFile(file,JSON.stringify(r));await assert.rejects(readContextAnalystReport(store,result.taskId!));
 }
 await writeFile(file,original);
}));

test("reader keeps a historical uncertain generation snapshot after a separately recorded late settlement",async()=>runFixture(async(store,c,result)=>{
 const {BudgetLedger}=await import("../src/budget.ts"),before=await readFile(reportPath(store,result.runId!)),book=new BudgetLedger(resolve(store.directory,".."));
 try {book.settle(`${result.runId}:context_generation`,{tokens:550,costMicrousd:875});}finally{book.close();}
 const value=await readContextAnalystReport(store,result.taskId!);assert.equal(value.report.budget.snapshot.invocations.find(v=>v.id.endsWith(":context_generation"))!.state,"uncertain");assert((await readFile(reportPath(store,result.runId!))).equals(before));
},"idea",b=>b.usage=null));

test("reader returns a factual budget overrun without converting it into analysis or free billing",async()=>fixture(async store=>{
 const c=await configured(store),result=await runOpenAIContextAnalyst(store,c.configuration,key,{transport:routed(c,b=>b.usage={input_tokens:500,output_tokens:1000,total_tokens:1500})});assert.equal(result.status,"published_unreviewed");
 const value=await readContextAnalystReport(store,result.taskId!);assert.equal((value.report.failure as {reason:string}).reason,"budget_overrun");assert.equal(value.report.candidate,null);assert(value.report.budget.snapshot.invocations.some(v=>v.overrun));
}));

test("reader validates options before reads and bounds cancellation and clock changes without record changes",async t=>{t.mock.timers.enable({apis:["Date","setTimeout","setInterval"],now:Date.now()});return runFixture(async(store,c,result)=>{
 const before=await readFile(reportPath(store,result.runId!)),tasks=rows(store);let accessed=false;
 for(const options of [null,{timeoutMs:0},{timeoutMs:60001},{signal:{}},{signal:Object.create(AbortSignal.prototype)},{unknown:true},Object.defineProperty({},"timeoutMs",{enumerable:true,get(){accessed=true;return 30000;}})])await assert.rejects(readContextAnalystReport(store,result.taskId!,options as any));assert.equal(accessed,false);
 const controller=new AbortController();controller.abort();await assert.rejects(readContextAnalystReport(store,result.taskId!,{signal:controller.signal}));
 const pending=readContextAnalystReport(store,result.taskId!,{timeoutMs:1});t.mock.timers.tick(2);await assert.rejects(pending);
 // Pending read work has no writes or ownership; its later settlement is consumed.
 assert.deepEqual(rows(store),tasks);assert((await readFile(reportPath(store,result.runId!))).equals(before));
},"idea",undefined,false);});

test("reader rejects source, manifest and candidate changes during the final report read",async()=>runFixture(async(store,c,result)=>{
 const {open}=await import("node:fs/promises"),probe=await open(reportPath(store,result.runId!),"r"),prototype=Object.getPrototypeOf(probe),read=prototype.read;await probe.close();
 for(const file of [resolve(c.catalogs[0]!.directory,"source.txt"),resolve(store.directory,"context-analyst-runs",result.runId!,"manifest.json"),resolve(store.directory,"context-analyst-runs",result.runId!,"candidate.json")]) {
  const original=await readFile(file);let reads=0,changed=false;
  prototype.read=async function(...args:unknown[]){const value=await Reflect.apply(read,this,args) as {bytesRead:number;buffer?:Buffer};if(value.bytesRead&&value.buffer?.includes(Buffer.from('"kind":"unreviewed_context_analyst_run"'))&&++reads===2){changed=true;writeFileSync(file,Buffer.concat([original,Buffer.from(" ")]));}return value;};
  try{await assert.rejects(readContextAnalystReport(store,result.taskId!));assert(changed);}finally{prototype.read=read;await writeFile(file,original);}
 }
}));

test("reader checks byte and permission changes queued after its final asynchronous checker",async()=>{
 for(const mode of ["report","source","processing","task"])await runFixture(async(store,c,result)=>{
  const {open}=await import("node:fs/promises"),file=reportPath(store,result.runId!),original=await readFile(file),probe=await open(file,"r"),prototype=Object.getPrototypeOf(probe),read=prototype.read,close=DatabaseSync.prototype.close;await probe.close();let reads=0,finalRead=false,queued=false;
  prototype.read=async function(...args:unknown[]){const value=await Reflect.apply(read,this,args) as {bytesRead:number;buffer?:Buffer};if(value.bytesRead&&value.buffer?.includes(Buffer.from('"kind":"unreviewed_context_analyst_run"'))&&++reads===2)finalRead=true;return value;};
  DatabaseSync.prototype.close=function(){const value=Reflect.apply(close,this,[]);if(finalRead&&!queued){queued=true;queueMicrotask(()=>{if(mode==="processing")revokeContextProcessingAuthorization(store,c.grant.id,1,"AUTHORED outer read stop");else if(mode==="task"){const db=new DatabaseSync(resolve(store.directory,"tasks.sqlite"));try{db.prepare("UPDATE tasks SET question_key=? WHERE id=?").run("AUTHORED_FOREIGN",result.taskId!);}finally{db.close();}}else writeFileSync(mode==="source"?resolve(c.catalogs[0]!.directory,"source.txt"):file,mode==="source"?Buffer.from("AUTHORED changed source"):Buffer.concat([original,Buffer.from(" ")]));});}return value;};
  try{await assert.rejects(readContextAnalystReport(store,result.taskId!));assert(queued);}finally{prototype.read=read;DatabaseSync.prototype.close=close;}
 });
});

test("reader preserves unsupported, duplicate-field, invalid UTF-8 and oversized reports as unavailable diagnostics",async()=>runFixture(async(store,c,result)=>{
 const file=reportPath(store,result.runId!),original=await readFile(file),tasks=rows(store);
 for(const bad of [Buffer.from('{"schemaVersion":"2.0",'+original.toString().slice(1)),Buffer.from(original.toString().replace('"schemaVersion":"2.0"','"schemaVersion":"9.0"')),Buffer.from([0xff]),Buffer.alloc(128001,32)]) {
  await writeFile(file,bad);await assert.rejects(readContextAnalystReport(store,result.taskId!));assert((await readFile(file)).equals(bad));assert.deepEqual(rows(store),tasks);
 }
 await writeFile(file,original);assert.equal((await readContextAnalystReport(store,result.taskId!)).sha256,result.reportSha256);
}));

test("reader rejects a task row changed synchronously while its final read-only database closes",async()=>runFixture(async(store,c,result)=>{
 const {open}=await import("node:fs/promises"),file=reportPath(store,result.runId!),probe=await open(file,"r"),prototype=Object.getPrototypeOf(probe),read=prototype.read,close=DatabaseSync.prototype.close;await probe.close();let reads=0,finalRead=false,closes=0,changed=false;
 prototype.read=async function(...args:unknown[]){const value=await Reflect.apply(read,this,args) as {bytesRead:number;buffer?:Buffer};if(value.bytesRead&&value.buffer?.includes(Buffer.from('"kind":"unreviewed_context_analyst_run"'))&&++reads===2)finalRead=true;return value;};
 DatabaseSync.prototype.close=function(){const value=Reflect.apply(close,this,[]);if(finalRead&&++closes===2){changed=true;const db=new DatabaseSync(resolve(store.directory,"tasks.sqlite"));try{db.prepare("UPDATE tasks SET question_key=? WHERE id=?").run("AUTHORED_CHANGED_DURING_CLOSE",result.taskId!);}finally{db.close();}}return value;};
 try{await assert.rejects(readContextAnalystReport(store,result.taskId!));assert(changed);}finally{prototype.read=read;DatabaseSync.prototype.close=close;}
}));
