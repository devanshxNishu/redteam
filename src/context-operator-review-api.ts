import {encodeContextOperatorReview, listContextOperatorReviews, readContextOperatorReview} from "./context-operator-review-store.ts";
import {ContextDataError, fields, freeze, uuid} from "./context-data.ts";

const policyVersion="operator-declaration-api-v1",maximumResponseBytes=120000;
const nativeAborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,"aborted")!.get!;
type Original=Awaited<ReturnType<typeof listContextOperatorReviews>>|Awaited<ReturnType<typeof readContextOperatorReview>>;
const views=new WeakMap<object,{workspace:string;route:"catalog"|"detail";id:string|null;original:Original;started:number;maximumReadMs:number;expiry:number|null;signal:AbortSignal|undefined}>();
const boundaries=Object.freeze({reviewerIdentity:"operator_declared_not_authenticated",basis:"operator_declared_not_independently_verified",sourceReport:"unchanged_unreviewed",semanticApproval:"not_granted",researchValidity:"not_established",appExecution:"not_performed",stakeholderDecisions:"not_performed",providerInference:"not_performed",executionAuthority:"not_granted",actionsAndExperiments:"not_created",managedDisplay:"not_provided",deliveredCopies:"not_recallable"});
function options(value:unknown,catalog:boolean){const r=fields(value,Object.keys(value as object));if(Object.keys(r).some(k=>!(catalog?["signal","afterRowId","rowLimit"]:["signal"]).includes(k)))throw new ContextDataError();if(r.signal!==undefined){if(!(r.signal instanceof AbortSignal))throw new ContextDataError();nativeAborted.call(r.signal);}return{signal:r.signal as AbortSignal|undefined};}
function workspaceInput(workspace:string){if(typeof workspace!=="string"||workspace.length>4096||workspace.includes("\0"))throw new ContextDataError();}
function started(){const now=Date.now();if(!Number.isSafeInteger(now)||now<0)throw new ContextDataError();return now;}

/** Bounded scalar data only. Retain the original private catalog delivery for final encoding. */
export async function prepareContextOperatorReviewCatalogResponse(workspace:string,suppliedOptions:unknown={}){try{
  workspaceInput(workspace);const o=options(suppliedOptions,true),begin=started(),original=await listContextOperatorReviews(workspace,suppliedOptions);
  const value=freeze({schemaVersion:"1.0",kind:"context_operator_declaration_catalog_view",policyVersion,
    entries:original.entries.map(r=>({id:r.id,createdAt:r.createdAt,taskId:r.taskId,runId:r.runId,reportSha256:r.reportSha256,recordSha256:r.recordSha256,normalizedInputSha256:r.inputSha256,status:"recorded_metadata_unverified"})),
    inspectedRows:original.inspectedRows,skipped:original.skipped,hasMoreRows:original.hasMoreRows,nextAfterRowId:original.nextAfterRowId,
    bounds:{mainBytes:original.bounds.mainBytes,walBytes:original.bounds.walBytes,shmBytes:original.bounds.shmBytes,rowLimit:original.bounds.rowLimit,lookaheadRows:1,maximumReadMs:2000},
    boundaries:{coverage:"bounded_rowid_window_not_complete_catalog",declarationContent:"not_read",sourceRights:"not_checked",sourceReport:"not_checked",semanticApproval:"not_granted",executionAuthority:"not_granted",catalog:"not_written",sqliteCoordination:"read_only_connection_not_a_no_filesystem_activity_claim"}});
  views.set(value,{workspace,route:"catalog",id:null,original,started:begin,maximumReadMs:2000,expiry:null,signal:o.signal});return value;
}catch{throw new ContextDataError();}}

/** Fixed whitelisted note projection; no inferred human approval or future write authority. */
export async function prepareContextOperatorReviewDetailResponse(workspace:string,id:string,suppliedOptions:unknown={}){try{
  workspaceInput(workspace);uuid(id);const o=options(suppliedOptions,false),begin=started(),original=await readContextOperatorReview(workspace,id,suppliedOptions),record=original.record;
  const items=record.input.items.map(item=>{const selected=record.selectedOriginalConcerns.find(c=>c.concernId===item.concernId);if(!selected)throw new ContextDataError();const c=selected.original;return{concernId:item.concernId,disposition:item.disposition,reason:item.reason,basisInspected:item.basisInspected,original:{id:c.id,concernSha256:selected.concernSha256,track:c.track,type:c.type,statement:c.statement,
    basis:c.basis.map(b=>b.kind==="brief_field"?{kind:b.kind,fieldId:b.fieldId,fieldSha256:b.fieldSha256}:{kind:b.kind,sourceId:b.sourceId,recordSha256:b.recordSha256,contentSha256:b.contentSha256,use:b.use}),
    whyItMatters:c.whyItMatters,priority:c.priority,priorityReason:c.priorityReason,nextCheck:{question:c.nextCheck.question,method:c.nextCheck.method,successRule:c.nextCheck.successRule,protocolStatus:"unreviewed"}}};});
  const value=freeze({schemaVersion:"1.0",kind:"context_operator_declaration_view",policyVersion,id:original.id,recordSha256:original.recordSha256,createdAt:record.createdAt,status:"operator_declaration_saved_unverified",normalizedInputSha256:record.normalizedInputSha256,
    source:{taskId:record.source.taskId,runId:record.source.runId,briefId:record.source.briefId,reportSha256:record.source.reportSha256,outcome:record.source.outcome,analysisStatus:record.source.analysisStatus,abstention:record.source.abstention},
    review:{reviewerLabel:record.input.reviewerLabel,identity:"operator_declared_not_authenticated",coverage:record.input.coverage,reportNote:record.input.reportNote,items},
    access:{checkedAt:original.access.checkedAt,effectiveExpiresAt:original.access.effectiveExpiresAt,scope:"checked_at_delivery_not_recallable"},boundaries});
  const expiry=Date.parse(original.access.effectiveExpiresAt);if(!Number.isSafeInteger(expiry))throw new ContextDataError();
  views.set(value,{workspace,route:"detail",id,original,started:begin,maximumReadMs:30000,expiry,signal:o.signal});return value;
}catch{throw new ContextDataError();}}

function encode(workspace:string,id:string|null,value:unknown,route:"catalog"|"detail"){try{
  if(!value||typeof value!=="object")throw new ContextDataError();const saved=views.get(value);views.delete(value);
  const selectedId=route==="detail"?uuid(id):null;if(!saved||saved.workspace!==workspace||saved.route!==route||saved.id!==selectedId)throw new ContextDataError();
  const body=JSON.stringify(value);if(Buffer.byteLength(body)>maximumResponseBytes)throw new ContextDataError();
  // The inner body is discarded. Its original guard runs after the complete outer serialization.
  encodeContextOperatorReview(workspace,saved.original);
  const now=Date.now();if(!Number.isSafeInteger(now)||now<saved.started||now>=saved.started+saved.maximumReadMs||saved.expiry!==null&&now>=saved.expiry||saved.signal&&nativeAborted.call(saved.signal))throw new ContextDataError();return body;
}catch{throw new ContextDataError();}}
export function encodeContextOperatorReviewCatalogResponse(workspace:string,value:unknown){return encode(workspace,null,value,"catalog");}
export function encodeContextOperatorReviewDetailResponse(workspace:string,id:string,value:unknown){return encode(workspace,id,value,"detail");}
