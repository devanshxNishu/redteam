// Saved operator declarations only. No semantic approval or execution authority.
import {randomUUID} from "node:crypto";
import {closeSync, fsyncSync, lstatSync, mkdirSync, openSync, realpathSync} from "node:fs";
import {resolve} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {isDeepStrictEqual} from "node:util";
import {ContextDataError, digest, existingContextWorkspace, fields, freeze, json, privateBytes, timestamp, uuid} from "./context-data.ts";
import {parseContextOperatorReviewInput} from "./context-operator-review.ts";
import {contextAnalystInspectionAccess, consumeContextAnalystInspection, inspectContextAnalystReport} from "./context-analyst-inspection.ts";
import {publishExclusive} from "./publication.ts";
import {sha256} from "./evidence.ts";

const maximumDatabaseBytes=8*1024*1024, maximumRecordBytes=100000, maximumDeliveryBytes=120000;
const applicationId=0x52544f52, policyVersion="operator-declaration-store-v1";
const table="CREATE TABLE operator_reviews (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, task_id TEXT NOT NULL, run_id TEXT NOT NULL, report_sha256 TEXT NOT NULL, record_sha256 TEXT NOT NULL, input_sha256 TEXT NOT NULL) STRICT";
const nativeAborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,"aborted")!.get!;
type Checked=Awaited<ReturnType<typeof inspectContextAnalystReport>>;
type Input=ReturnType<typeof parseContextOperatorReviewInput>;
type Locations={root:string;state:string;parent:string;records:string;database:string};
type Row={id:string;createdAt:string;taskId:string;runId:string;reportSha256:string;recordSha256:string;inputSha256:string};
type WriteState="not_created"|"not_confirmed"|"committed_unavailable";
const deliveries=new WeakMap<object,{workspace:string;guard:()=>void;committed:boolean}>();
const publications=new WeakMap<object,{locations:Locations;row:Row;guard:()=>void}>();
const boundaries=Object.freeze({reviewerIdentity:"operator_declared_not_authenticated",basis:"operator_declared_not_independently_verified",sourceReport:"unchanged_unreviewed",semanticApproval:"not_granted",researchValidity:"not_established",appExecution:"not_performed",stakeholderDecisions:"not_performed",providerInference:"not_performed",executionAuthority:"not_granted",actionsAndExperiments:"not_created"});

export class ContextOperatorReviewWriteError extends Error {
  readonly state:WriteState;
  constructor(state:WriteState){super(state==="not_created"?"The operator declaration was not created. Catalog setup files may exist.":state==="not_confirmed"?"The operator declaration write is not confirmed. Inspect the catalog before a deliberate new save; do not retry automatically.":"The operator declaration was committed but its current content is unavailable. Inspect the catalog; do not retry automatically.");this.state=state;}
}
function equal(a:unknown,b:unknown){if(!isDeepStrictEqual(a,b))throw new ContextDataError();}
function directory(path:string){const s=lstatSync(path,{bigint:true});if(!s.isDirectory()||s.isSymbolicLink()||s.mode&0o077n||realpathSync(path)!==path)throw new ContextDataError();return[s.dev,s.ino,s.mode];}
function file(path:string,maximum:number,optional=false){const s=lstatSync(path,{bigint:true,throwIfNoEntry:false});if(!s){if(optional)return null;throw new ContextDataError();}if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1n||s.mode&0o077n||s.size>BigInt(maximum))throw new ContextDataError();return[s.dev,s.ino,s.mode,s.nlink,s.size,s.mtimeNs,s.ctimeNs];}
function parents(l:Locations){return[directory(l.state),directory(l.parent),directory(l.records)];}
function witness(l:Locations){const p=parents(l);file(l.database+"-shm",1024*1024,true);if(lstatSync(l.database+"-journal",{throwIfNoEntry:false}))throw new ContextDataError();const wal=file(l.database+"-wal",maximumDatabaseBytes,true);return{parents:p,main:file(l.database,maximumDatabaseBytes),wal:wal?.[4]===0n?null:wal};}
function identity(l:Locations){const w=witness(l);return{parents:w.parents,main:w.main!.slice(0,4)};}
async function locations(workspace:string):Promise<Locations>{const root=await existingContextWorkspace(workspace),state=resolve(root,".redteam"),parent=resolve(state,"context-operator-reviews");return{root,state,parent,records:resolve(parent,"records"),database:resolve(parent,"catalog.sqlite")};}
function connect(l:Locations,write=false){const db=new DatabaseSync(l.database,{readOnly:!write,allowExtension:false,defensive:true,timeout:1});try{db.exec("PRAGMA trusted_schema=OFF");return db;}catch(error){db.close();throw error;}}
function schema(db:DatabaseSync){
  if(db.prepare("PRAGMA journal_mode").get()?.journal_mode!=="wal"||db.prepare("PRAGMA application_id").get()?.application_id!==applicationId||db.prepare("PRAGMA user_version").get()?.user_version!==1)throw new ContextDataError();
  const objects=db.prepare("SELECT type,name,tbl_name,CASE WHEN length(CAST(sql AS BLOB))<=4096 THEN sql ELSE NULL END AS sql FROM sqlite_master ORDER BY name LIMIT 3").all();
  equal(objects.map(v=>[v.type,v.name,v.tbl_name,v.sql]),[["table","operator_reviews","operator_reviews",table],["index","sqlite_autoindex_operator_reviews_1","operator_reviews",null]]);
}
function ensureCatalog(l:Locations){
  directory(l.state);
  if(!lstatSync(l.parent,{throwIfNoEntry:false})){
    mkdirSync(l.parent,{mode:0o700});directory(l.parent);mkdirSync(l.records,{mode:0o700});
    const fd=openSync(l.database,"wx",0o600);closeSync(fd);const pinned=identity(l),db=connect(l,true);
    try{equal(identity(l),pinned);db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA application_id=${applicationId}; PRAGMA user_version=1; ${table}`);schema(db);}finally{db.close();}
    const parent=openSync(l.parent,"r");try{fsyncSync(parent);}finally{closeSync(parent);}
  }
  const pinned=witness(l),db=connect(l);try{schema(db);}finally{db.close();}equal(witness(l),pinned);
}
function readOptions(value:unknown,listing=false){
  const r=fields(value,Object.keys(value as object));if(Object.keys(r).some(k=>!(listing?["signal","afterRowId","rowLimit","maximumReadMs"]:["signal"]).includes(k)))throw new ContextDataError();
  if(r.signal!==undefined){if(!(r.signal instanceof AbortSignal))throw new ContextDataError();nativeAborted.call(r.signal);}
  const after=r.afterRowId===undefined?"0":r.afterRowId,limit=r.rowLimit===undefined?50:r.rowLimit,ms=r.maximumReadMs===undefined?2000:r.maximumReadMs;
  if(typeof after!=="string"||!/^(0|[1-9][0-9]{0,18})$/.test(after)||BigInt(after)>9223372036854775807n||!Number.isSafeInteger(limit)||(limit as number)<1||(limit as number)>100||!Number.isSafeInteger(ms)||(ms as number)<1||(ms as number)>5000)throw new ContextDataError();
  return{signal:r.signal as AbortSignal|undefined,after,limit:limit as number,ms:ms as number};
}
function timer(signal:AbortSignal|undefined,ms:number){const start=Date.now(),end=start+ms;if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end))throw new ContextDataError();return()=>{const now=Date.now();if(!Number.isSafeInteger(now)||now<start||now>=end||signal&&nativeAborted.call(signal))throw new ContextDataError();};}
const columns=["id","created_at","task_id","run_id","report_sha256","record_sha256","input_sha256"];
const selection=columns.map(c=>`CASE WHEN length(CAST(${c} AS BLOB)) BETWEEN 1 AND 64 THEN CAST(${c} AS BLOB) ELSE NULL END AS ${c}`).join(",");
function decode(value:unknown){if(!(value instanceof Uint8Array))throw new ContextDataError();return new TextDecoder("utf-8",{fatal:true}).decode(value);}
function row(value:Record<string,unknown>):Row{return{id:uuid(decode(value.id)),createdAt:timestamp(decode(value.created_at)),taskId:uuid(decode(value.task_id)),runId:uuid(decode(value.run_id)),reportSha256:digest(decode(value.report_sha256)),recordSha256:digest(decode(value.record_sha256)),inputSha256:digest(decode(value.input_sha256))};}
function readRow(l:Locations,id:string){
  const time=timer(undefined,2000),pinned=witness(l),db=connect(l);let value:Row;
  try{time();db.exec("BEGIN");schema(db);const found=db.prepare(`SELECT ${selection} FROM operator_reviews WHERE id=?`).get(id);if(!found)throw new ContextDataError();value=row(found);db.exec("COMMIT");}finally{db.close();}
  time();const guard=()=>equal(witness(l),pinned);guard();return{row:value!,guard};
}
function record(input:Input,checked:Checked,id:string,createdAt:string){
  uuid(id);timestamp(createdAt);if(Date.parse(createdAt)>Date.now()||Date.parse(createdAt)<Date.parse(checked.report.recordedAt)||checked.sha256!==input.reportSha256)throw new ContextDataError();
  const check=checked.report.candidate?.candidate.result.check,concerns=check?.response.concerns??[];
  if(input.coverage==="report_limits"?concerns.length!==0:!check||!concerns.length)throw new ContextDataError();
  const selectedOriginalConcerns=input.items.map(i=>{const original=concerns.find(c=>c.id===i.concernId);if(!original)throw new ContextDataError();return{concernId:i.concernId,concernSha256:sha256(Buffer.from(JSON.stringify(original))),original};});
  return freeze({schemaVersion:"1.0",kind:"context_operator_declaration",policyVersion,id,createdAt,status:"operator_declaration_saved_unverified",input,normalizedInputSha256:sha256(Buffer.from(JSON.stringify(input))),source:{taskId:checked.taskId,runId:checked.runId,briefId:checked.report.brief.id,reportSha256:checked.sha256,outcome:checked.report.outcome,analysisStatus:check?"unreviewed":"unavailable",abstention:check?.response.abstention??null},selectedOriginalConcerns,boundaries});
}
type RecordValue=ReturnType<typeof record>;
const recordBytes=(value:RecordValue)=>{const b=Buffer.from(JSON.stringify(value)+"\n");if(b.length>maximumRecordBytes)throw new ContextDataError();return b;};
async function readBytes(l:Locations,id:string,hash:string){const path=resolve(l.records,uuid(id)+".json"),pinned={parents:parents(l),file:file(path,maximumRecordBytes)},bytes=await privateBytes(l.state,path,maximumRecordBytes);if(sha256(bytes)!==hash)throw new ContextDataError();const guard=()=>equal({parents:parents(l),file:file(path,maximumRecordBytes)},pinned);guard();return{bytes,guard};}
function data(workspace:string,l:Locations,r:Row,value:RecordValue,checked:Checked,recordGuard:()=>void,catalogGuard:()=>void,committed:boolean,finalTime:()=>void){
  const access=contextAnalystInspectionAccess(checked),view=freeze({schemaVersion:"1.0",kind:"context_operator_declaration_detail",id:r.id,recordSha256:r.recordSha256,record:value,access:{checkedAt:new Date().toISOString(),effectiveExpiresAt:access.effectiveExpiresAt,scope:"checked_at_delivery_not_recallable"}});
  const guard=()=>{catalogGuard();recordGuard();contextAnalystInspectionAccess(checked);catalogGuard();recordGuard();consumeContextAnalystInspection(checked);finalTime();if(Date.now()>=Date.parse(access.effectiveExpiresAt))throw new ContextDataError();finalTime();};deliveries.set(view,{workspace,guard,committed});return view;
}
async function publish(l:Locations,value:RecordValue){const bytes=recordBytes(value),hash=sha256(bytes);await publishExclusive(resolve(l.records,value.id+".json"),bytes);const checked=await readBytes(l,value.id,hash);equal(checked.bytes,bytes);const receipt=Object.freeze({});publications.set(receipt,{locations:l,row:{id:value.id,createdAt:value.createdAt,taskId:value.source.taskId,runId:value.source.runId,reportSha256:value.source.reportSha256,recordSha256:hash,inputSha256:value.normalizedInputSha256},guard:checked.guard});return receipt;}
function insert(l:Locations,receipt:object,pinned:ReturnType<typeof witness>,checked:Checked,committed:()=>void){
  const saved=publications.get(receipt);publications.delete(receipt);if(!saved||saved.locations!==l)throw new ContextDataError();equal(witness(l),pinned);saved.guard();contextAnalystInspectionAccess(checked);const physical=identity(l),db=connect(l,true);let transaction=false;
  try{schema(db);equal(witness(l),pinned);db.exec("PRAGMA synchronous=FULL; BEGIN IMMEDIATE");transaction=true;equal(witness(l),pinned);saved.guard();contextAnalystInspectionAccess(checked);const r=saved.row;
    const inserted=db.prepare("INSERT INTO operator_reviews(id,created_at,task_id,run_id,report_sha256,record_sha256,input_sha256) VALUES(?,?,?,?,?,?,?)").run(r.id,r.createdAt,r.taskId,r.runId,r.reportSha256,r.recordSha256,r.inputSha256);if(inserted.changes!==1)throw new ContextDataError();
    equal(identity(l),physical);saved.guard();contextAnalystInspectionAccess(checked);db.exec("COMMIT");transaction=false;committed();
  }finally{if(transaction)try{db.exec("ROLLBACK");}catch{}db.close();}
  return saved;
}

/** Fresh explicit input only. Neither a public preview nor a saved file can authorize insertion. */
export async function createContextOperatorReview(workspace:string,value:unknown,options:unknown={}){
  let state:WriteState="not_created";
  try{const input=parseContextOperatorReviewInput(value),o=readOptions(options),l=await locations(workspace);if(o.signal&&nativeAborted.call(o.signal))throw new ContextDataError();ensureCatalog(l);const pinned=witness(l),time=timer(o.signal,30000),checked=await inspectContextAnalystReport(workspace,input.taskId,options),saved=record(input,checked,randomUUID(),new Date().toISOString());recordBytes(saved);contextAnalystInspectionAccess(checked);equal(witness(l),pinned);
    state="not_confirmed";const receipt=await publish(l,saved);const publication=insert(l,receipt,pinned,checked,()=>{state="committed_unavailable";}),catalog=readRow(l,saved.id);equal(catalog.row,publication.row);publication.guard();contextAnalystInspectionAccess(checked);return data(workspace,l,catalog.row,saved,checked,publication.guard,catalog.guard,true,time);
  }catch{throw new ContextOperatorReviewWriteError(state);}
}
/** Catalog-bound canonical data with a new original current-source inspection. Never receipt recovery. */
export async function readContextOperatorReview(workspace:string,id:string,options:unknown={}){try{
  uuid(id);const o=readOptions(options),time=timer(o.signal,30000),l=await locations(workspace);time();const catalog=readRow(l,id),stored=await readBytes(l,id,catalog.row.recordSha256),raw=fields(json(stored.bytes),["schemaVersion","kind","policyVersion","id","createdAt","status","input","normalizedInputSha256","source","selectedOriginalConcerns","boundaries"]),input=parseContextOperatorReviewInput(raw.input),checked=await inspectContextAnalystReport(workspace,input.taskId,options),expected=record(input,checked,id,timestamp(raw.createdAt));
  equal(stored.bytes,recordBytes(expected));equal(catalog.row,{id,createdAt:expected.createdAt,taskId:expected.source.taskId,runId:expected.source.runId,reportSha256:expected.source.reportSha256,recordSha256:sha256(stored.bytes),inputSha256:expected.normalizedInputSha256});const guard=()=>{time();catalog.guard();time();};guard();stored.guard();return data(workspace,l,catalog.row,expected,checked,stored.guard,guard,false,time);
}catch{throw new ContextDataError();}}
/** Indexed bounded metadata. No free-text declarations, source rights or report validation. */
export async function listContextOperatorReviews(workspace:string,options:unknown={}){try{
  const o=readOptions(options,true),time=timer(o.signal,o.ms),l=await locations(workspace);time();let entries:Row[]=[],inspectedRows=0,skipped=0,nextAfterRowId:string|null=null,hasMoreRows=false,guard:()=>void;
  if(!lstatSync(l.parent,{throwIfNoEntry:false})){const state=directory(l.state);guard=()=>{time();equal(directory(l.state),state);if(lstatSync(l.parent,{throwIfNoEntry:false}))throw new ContextDataError();};}
  else{const pinned=witness(l),db=connect(l);try{db.exec("BEGIN");schema(db);const rows=db.prepare(`SELECT CAST(rowid AS TEXT) AS cursor,${selection} FROM operator_reviews WHERE rowid>? ORDER BY rowid LIMIT ?`).all(BigInt(o.after),o.limit+1),selected=rows.slice(0,o.limit);inspectedRows=selected.length;hasMoreRows=rows.length>o.limit;
    for(const value of selected){time();try{entries.push(row(value));}catch{skipped++;}}if(hasMoreRows){nextAfterRowId=String(selected.at(-1)!.cursor);if(!/^[1-9][0-9]{0,18}$/.test(nextAfterRowId)||BigInt(nextAfterRowId)<=BigInt(o.after))throw new ContextDataError();}db.exec("COMMIT");}finally{db.close();}guard=()=>{time();equal(witness(l),pinned);time();};}
  guard();const result=freeze({schemaVersion:"1.0",kind:"context_operator_declaration_metadata_window",policyVersion,entries:entries.map(r=>({...r,status:"recorded_metadata_unverified"})),inspectedRows,skipped,hasMoreRows,nextAfterRowId,bounds:{mainBytes:maximumDatabaseBytes,walBytes:maximumDatabaseBytes,shmBytes:1024*1024,rowLimit:o.limit,lookaheadRows:1,maximumReadMs:o.ms},boundaries:{coverage:"bounded_rowid_window_not_complete_catalog",declarationContent:"not_read",sourceRights:"not_checked",sourceReport:"not_checked",semanticApproval:"not_granted",executionAuthority:"not_granted",catalog:"not_written",sqliteCoordination:"read_only_connection_not_a_no_filesystem_activity_claim"}});deliveries.set(result,{workspace,guard,committed:false});return result;
}catch{throw new ContextDataError();}}
/** Exactly one original response after serialization and final file/catalog/current-source checks. */
export function encodeContextOperatorReview(workspace:string,value:unknown){
  if(!value||typeof value!=="object")throw new ContextDataError();const saved=deliveries.get(value);deliveries.delete(value);
  try{if(!saved||saved.workspace!==workspace)throw new ContextDataError();const body=JSON.stringify(value);if(Buffer.byteLength(body)>maximumDeliveryBytes)throw new ContextDataError();saved.guard();return body;}
  catch{if(saved?.committed)throw new ContextOperatorReviewWriteError("committed_unavailable");throw new ContextDataError();}
}
