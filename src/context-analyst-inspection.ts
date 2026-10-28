import {lstatSync, realpathSync} from "node:fs";
import {resolve, dirname} from "node:path";
import {isDeepStrictEqual} from "node:util";
import {WorkspaceStore} from "./workspace.ts";
import {ContextDataError, uuid, fields} from "./context-data.ts";
import {readContextAnalystManifest} from "./context-analyst-artifacts.ts";
import {readContextAnalystReport} from "./context-analyst-report-reader.ts";
const maximumReadMs=30000, maximumDatabaseBytes=32*1024*1024;
const nativeAborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,"aborted")!.get!;
const nativeAdd=EventTarget.prototype.addEventListener,nativeRemove=EventTarget.prototype.removeEventListener;
const deliveryGuards=new WeakMap<object,()=>void>();
/** One original saved-data delivery only. Never ownership, publication receipt or dispatch authority. */
export function consumeContextAnalystInspection(value:unknown):undefined{try{
 if(!value||typeof value!=="object")throw new ContextDataError();const guard=deliveryGuards.get(value);deliveryGuards.delete(value);if(!guard)throw new ContextDataError();guard();return undefined;
 }catch{throw new ContextDataError();}}
function options(value:unknown){const r=fields(value,Object.keys(value as object));if(Object.keys(r).some(k=>k!=="signal"))throw new ContextDataError();if(r.signal!==undefined){if(!(r.signal instanceof AbortSignal))throw new ContextDataError();nativeAborted.call(r.signal);}return{signal:r.signal as AbortSignal|undefined};}
function directory(path:string){const i=lstatSync(path,{bigint:true});if(!i.isDirectory()||i.isSymbolicLink()||i.mode&0o077n||realpathSync(path)!==path)throw new ContextDataError();return[i.dev,i.ino,i.mode];}
function file(path:string,optional=false,maximum?:number){const i=lstatSync(path,{bigint:true,throwIfNoEntry:false});if(!i){if(optional)return null;throw new ContextDataError();}if(!i.isFile()||i.isSymbolicLink()||i.nlink!==1n||i.mode&0o077n||maximum!==undefined&&i.size>BigInt(maximum))throw new ContextDataError();return[i.dev,i.ino,i.mode,i.nlink,i.size,i.mtimeNs,i.ctimeNs];}
/** Checked saved data through an existing read-only workspace. Never task execution or recovery. */
export async function inspectContextAnalystReport(workspace:string,taskId:string,suppliedOptions:unknown={}){const relay=new AbortController(),forward=()=>relay.abort();let originalSignal:AbortSignal|undefined;try{
 uuid(taskId);const o=options(suppliedOptions);if(typeof workspace!=="string"||workspace.length>4096||workspace.includes("\0"))throw new ContextDataError();
 originalSignal=o.signal;if(originalSignal){nativeAdd.call(originalSignal,"abort",forward,{once:true});if(nativeAborted.call(originalSignal))relay.abort();}
 const started=Date.now(),cutoff=started+maximumReadMs;if(!Number.isSafeInteger(started)||started<0||!Number.isSafeInteger(cutoff))throw new ContextDataError();
 let effectiveExpiry=Number.MAX_SAFE_INTEGER;
 const guard=()=>{const now=Date.now();if(!Number.isSafeInteger(now)||now<started||now>=cutoff||now>=effectiveExpiry||o.signal&&nativeAborted.call(o.signal))throw new ContextDataError();};
 const root=realpathSync(workspace),state=resolve(root,".redteam");
 // Empty private WAL coordination is equivalent to absence; every non-empty WAL stays pinned.
 const databases=()=>{const parents=directory(state);return{parents,files:["workspace.sqlite","tasks.sqlite"].map(name=>{const path=resolve(state,name);file(path+"-shm",true,1024*1024);const wal=file(path+"-wal",true,maximumDatabaseBytes);return[file(path,false,maximumDatabaseBytes),wal?.[4]===0n?null:wal];})};};
 guard();const pinnedDatabases=databases(),store=new WorkspaceStore(root,{readOnly:true});let output,inputs:(()=>unknown)|undefined,pinnedInputs:unknown;
 try{
  const saved=await readContextAnalystManifest(store,taskId),m=saved.manifest,run=resolve(state,"context-analyst-runs",m.runId);
  effectiveExpiry=Date.parse(m.processing.effectiveExpiresAt);guard();
  const paths=[resolve(run,"manifest.json"),resolve(run,"generation.json"),resolve(run,"report.json"),resolve(run,"candidate.json"),
   resolve(state,"review-briefs",m.source.id,"report.json"),resolve(state,"context-snapshots",m.context.snapshotId,"snapshot.json"),
   resolve(state,"context-processing",m.processing.authorizationId,"record.json"),
   ...m.sourcePins.flatMap(pin=>[resolve(state,"context-sources",pin.sourceId,"record.json"),resolve(state,"context-sources",pin.sourceId,"source.txt")])];
  inputs=()=>paths.map(path=>[directory(state),directory(dirname(dirname(path))),directory(dirname(path)),file(path,path===resolve(run,"candidate.json"))]);
  pinnedInputs=inputs();guard();if(!isDeepStrictEqual(databases(),pinnedDatabases))throw new ContextDataError();
  output=await readContextAnalystReport(store,taskId,{timeoutMs:Math.max(1,cutoff-Date.now()),signal:relay.signal});
 }finally{store.close();}
 // Cover the await into this public frame AND closure of the workspace connection.
 guard();if(!inputs||!output||!isDeepStrictEqual(inputs(),pinnedInputs)||!isDeepStrictEqual(databases(),pinnedDatabases))throw new ContextDataError();guard();const checked=output;deliveryGuards.set(checked,()=>{guard();if(!inputs||!isDeepStrictEqual(inputs(),pinnedInputs)||!isDeepStrictEqual(databases(),pinnedDatabases))throw new ContextDataError();guard();});return checked;
 }catch{throw new ContextDataError();}finally{if(originalSignal)nativeRemove.call(originalSignal,"abort",forward);}}
