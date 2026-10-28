import {randomUUID} from "node:crypto";
import {WorkspaceStore} from "./workspace.ts";
import {ContextDataError,fields,freeze,existingContextWorkspace} from "./context-data.ts";
import {takeSelectedContextKey} from "./context-start-input.ts";
import type {selectContextStartInput} from "./context-start-input.ts";
import {runOpenAIContextAnalyst} from "./context-analyst-coordinator.ts";
import {inspectContextAnalystReport} from "./context-analyst-inspection.ts";
interface Options {signal?:AbortSignal;transport?:typeof fetch}
function options(value:unknown){const r=fields(value,Object.keys(value as object));if(Object.keys(r).some(k=>!["signal","transport"].includes(k))||r.transport!==undefined&&typeof r.transport!=="function")throw new ContextDataError();if(r.signal!==undefined){if(!(r.signal instanceof AbortSignal))throw new ContextDataError();Object.getOwnPropertyDescriptor(AbortSignal.prototype,"aborted")!.get!.call(r.signal);}return{signal:r.signal as AbortSignal|undefined,transport:r.transport as typeof fetch|undefined};}
type Selection=ReturnType<typeof selectContextStartInput>;
/** Internal explicit run bridge. Own the workspace slot once, reuse the original coordinator, then read saved data. */
export async function runContextAnalystInWorkspace(workspace:string,selection:Selection,suppliedOptions:Options={}){let timer:ReturnType<typeof setTimeout>|undefined;try{
 const o=options(suppliedOptions),controller=new AbortController(),signal=o.signal?AbortSignal.any([o.signal,controller.signal]):controller.signal;
 if(signal.aborted)throw new ContextDataError();const key=takeSelectedContextKey(selection),configuration=selection.configuration;
 const secret=(value:string)=>value.includes(key)||value.includes(JSON.stringify(key).slice(1,-1));if(typeof workspace!=="string"||workspace.length>4096||workspace.includes("\0")||secret(workspace))throw new ContextDataError();
 const started=Date.now(),cutoff=started+configuration.limits.timeoutMs+configuration.limits.finalizationMs+30000;
 if(!Number.isSafeInteger(started)||started<0||!Number.isSafeInteger(cutoff))throw new ContextDataError();
 const guard=()=>{const now=Date.now();if(signal.aborted||!Number.isSafeInteger(now)||now<started||now>=cutoff)throw new ContextDataError();};
 timer=setTimeout(()=>controller.abort(),Math.max(1,cutoff-Date.now()));timer.unref();guard();
 const root=await existingContextWorkspace(workspace);if(secret(root))throw new ContextDataError();guard();const preflight=new WorkspaceStore(root,{readOnly:true});preflight.close();guard();
 const store=new WorkspaceStore(root),owner=randomUUID();let acquired=false,result:Awaited<ReturnType<typeof runOpenAIContextAnalyst>>;
 try{store.acquireCoordinator(owner);acquired=true;guard();result=await runOpenAIContextAnalyst(store,configuration,key,{signal,...(o.transport?{transport:o.transport}:{})});guard();}
 finally{try{if(acquired)store.releaseCoordinator(owner);}finally{store.close();}}
 guard();
 if(result.status!=="published_unreviewed"){
  const output=freeze({schemaVersion:"2.0",kind:"context_workspace_run_outcome",status:"unavailable",runId:result.runId,taskId:result.taskId,reason:result.reason,report:null,retry:"not_authorized"});
  if(JSON.stringify(output).includes(key)||JSON.stringify(output).includes(JSON.stringify(key).slice(1,-1)))throw new ContextDataError();return output;
 }
 const checked=await inspectContextAnalystReport(root,result.taskId!);guard();
 if(checked.runId!==result.runId||checked.taskId!==result.taskId||checked.sha256!==result.reportSha256)throw new ContextDataError();
 const output=freeze({schemaVersion:"2.0",kind:"context_workspace_run_outcome",status:"published_unreviewed",runId:checked.runId,taskId:checked.taskId,reason:null,report:checked,retry:"not_authorized",boundaries:{semanticReview:"unreviewed",workspaceOwnership:"released_before_delivery",billing:"original_coordinator_only",recovery:"not_performed",providerCompatibility:"not_checked",appExecution:"not_performed"}});
 if(JSON.stringify(output).includes(key)||JSON.stringify(output).includes(JSON.stringify(key).slice(1,-1)))throw new ContextDataError();guard();return output;
 }catch{throw new ContextDataError();}finally{if(timer)clearTimeout(timer);}}
