import {lstatSync, realpathSync} from "node:fs";
import {resolve, dirname} from "node:path";
import {isDeepStrictEqual} from "node:util";
import {WorkspaceStore} from "./workspace.ts";
import {ContextDataError, uuid} from "./context-data.ts";
import {readContextAnalystManifest} from "./context-analyst-artifacts.ts";
import {readContextAnalystReport} from "./context-analyst-report-reader.ts";
const maximumReadMs=30000, maximumDatabaseBytes=32*1024*1024;
function directory(path:string){const i=lstatSync(path,{bigint:true});if(!i.isDirectory()||i.isSymbolicLink()||i.mode&0o077n||realpathSync(path)!==path)throw new ContextDataError();return[i.dev,i.ino,i.mode];}
function file(path:string,optional=false,maximum?:number){const i=lstatSync(path,{bigint:true,throwIfNoEntry:false});if(!i){if(optional)return null;throw new ContextDataError();}if(!i.isFile()||i.isSymbolicLink()||i.nlink!==1n||i.mode&0o077n||maximum!==undefined&&i.size>BigInt(maximum))throw new ContextDataError();return[i.dev,i.ino,i.mode,i.nlink,i.size,i.mtimeNs,i.ctimeNs];}
/** Checked saved data through an existing read-only workspace. Never task execution or recovery. */
export async function inspectContextAnalystReport(workspace:string,taskId:string){try{
 uuid(taskId);if(typeof workspace!=="string"||workspace.length>4096||workspace.includes("\0"))throw new ContextDataError();
 const started=Date.now(),cutoff=started+maximumReadMs;if(!Number.isSafeInteger(started)||started<0||!Number.isSafeInteger(cutoff))throw new ContextDataError();
 const guard=()=>{const now=Date.now();if(!Number.isSafeInteger(now)||now<started||now>=cutoff)throw new ContextDataError();};
 const root=realpathSync(workspace),state=resolve(root,".redteam");
 const databases=()=>{const parents=directory(state);return{parents,files:["workspace.sqlite","tasks.sqlite"].map(name=>{const path=resolve(state,name);file(path+"-shm",true,1024*1024);return[file(path,false,maximumDatabaseBytes),file(path+"-wal",true,maximumDatabaseBytes)];})};};
 guard();const pinnedDatabases=databases(),store=new WorkspaceStore(root,{readOnly:true});let output,inputs:(()=>unknown)|undefined,pinnedInputs:unknown;
 try{
  const saved=await readContextAnalystManifest(store,taskId),m=saved.manifest,run=resolve(state,"context-analyst-runs",m.runId);
  const paths=[resolve(run,"manifest.json"),resolve(run,"generation.json"),resolve(run,"report.json"),resolve(run,"candidate.json"),
   resolve(state,"review-briefs",m.source.id,"report.json"),resolve(state,"context-snapshots",m.context.snapshotId,"snapshot.json"),
   resolve(state,"context-processing",m.processing.authorizationId,"record.json"),
   ...m.sourcePins.flatMap(pin=>[resolve(state,"context-sources",pin.sourceId,"record.json"),resolve(state,"context-sources",pin.sourceId,"source.txt")])];
  inputs=()=>paths.map(path=>[directory(state),directory(dirname(dirname(path))),directory(dirname(path)),file(path,path===resolve(run,"candidate.json"))]);
  pinnedInputs=inputs();guard();if(!isDeepStrictEqual(databases(),pinnedDatabases))throw new ContextDataError();
  output=await readContextAnalystReport(store,taskId,{timeoutMs:Math.max(1,cutoff-Date.now())});
 }finally{store.close();}
 // Cover the await into this public frame AND closure of the workspace connection.
 guard();if(!inputs||!output||!isDeepStrictEqual(inputs(),pinnedInputs)||!isDeepStrictEqual(databases(),pinnedDatabases))throw new ContextDataError();guard();return output;
 }catch{throw new ContextDataError();}}
