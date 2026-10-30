// Operator-supplied review input only. A preview is never a saved review or publication receipt.
import {ContextDataError,fields,text,uuid,digest,list,freeze,inputBytes,json} from "./context-data.ts";
import {inspectContextAnalystReport,contextAnalystInspectionAccess,consumeContextAnalystInspection} from "./context-analyst-inspection.ts";
import {sha256} from "./evidence.ts";
const maximumInputBytes=24000,maximumPreviewBytes=48000;
const previews=new WeakMap<object,{workspace:string;checked:Awaited<ReturnType<typeof inspectContextAnalystReport>>}>();
const dispositions=["operator_declared_supported","operator_declared_unsupported","needs_more_evidence"] as const;
type Disposition=typeof dispositions[number];
export function parseContextOperatorReviewInput(value:unknown){try{
 const r=fields(value,["schemaVersion","kind","taskId","reportSha256","reviewerLabel","coverage","reportNote","items"]);
 if(r.schemaVersion!=="1.0"||r.kind!=="context_operator_review_input"||!["selected_concerns","report_limits"].includes(r.coverage as string))throw new ContextDataError();
 const seen=new Set<string>(),items=list(r.items,12,value=>{const i=fields(value,["concernId","disposition","reason","basisInspected"]),concernId=text(i.concernId,3);if(!/^C[0-9]{2}$/.test(concernId)||seen.has(concernId)||!dispositions.includes(i.disposition as Disposition))throw new ContextDataError();seen.add(concernId);return{concernId,disposition:i.disposition as Disposition,reason:text(i.reason,500),basisInspected:text(i.basisInspected,1000)};});
 if(r.coverage==="selected_concerns"?!items.length:items.length!==0)throw new ContextDataError();
 const result=freeze({schemaVersion:"1.0",kind:"context_operator_review_input",taskId:uuid(r.taskId),reportSha256:digest(r.reportSha256),reviewerLabel:text(r.reviewerLabel,120),coverage:r.coverage as "selected_concerns"|"report_limits",reportNote:text(r.reportNote,1000),items});
 if(Buffer.byteLength(JSON.stringify(result))>maximumInputBytes)throw new ContextDataError();return result;
 }catch{throw new ContextDataError();}}
/** Explicit local file; normalized parsed values, not raw-file identity or a stored declaration. */
export async function readContextOperatorReviewInput(file:string){try{
 if(typeof file!=="string"||!file||file.length>4096||file.startsWith("-")||/[\x00-\x1f\x7f]/u.test(file))throw new ContextDataError();
 return parseContextOperatorReviewInput(json(await inputBytes(file,maximumInputBytes)));
 }catch{throw new ContextDataError();}}
/** Fresh full source/report checking before an input preview. No publication or store mutation. */
export async function prepareContextOperatorReviewPreview(workspace:string,value:unknown,options:unknown={}){try{
 const input=parseContextOperatorReviewInput(value),checked=await inspectContextAnalystReport(workspace,input.taskId,options);
 if(checked.sha256!==input.reportSha256)throw new ContextDataError();
 const report=checked.report,check=report.candidate?.candidate.result.check,concerns=check?.response.concerns??[];
 if(input.coverage==="report_limits"?concerns.length!==0:!check||concerns.length===0)throw new ContextDataError();
 const items=input.items.map(item=>{const original=concerns.find(c=>c.id===item.concernId);if(!original)throw new ContextDataError();return{...item,original:{id:original.id,track:original.track,type:original.type,statement:original.statement,concernSha256:sha256(Buffer.from(JSON.stringify(original))),basis:original.basis.map(b=>({...b})),status:"unreviewed"}};});
 const access=contextAnalystInspectionAccess(checked),preview=freeze({schemaVersion:"1.0",kind:"context_operator_review_preview",policyVersion:"operator-review-preview-v1",status:"input_checked_not_saved",normalizedInputSha256:sha256(Buffer.from(JSON.stringify(input))),
  source:{taskId:checked.taskId,runId:checked.runId,reportSha256:checked.sha256,briefId:report.brief.id,outcome:report.outcome,analysisStatus:check?"unreviewed":"unavailable",abstention:check?.response.abstention??null},
  review:{reviewerLabel:input.reviewerLabel,identity:"operator_declared_not_authenticated",coverage:input.coverage,reportNote:input.reportNote,items,availableConcerns:concerns.length,selectedConcerns:items.length,concernsNotSelected:concerns.filter(c=>!items.some(i=>i.concernId===c.id)).map(c=>c.id)},
  access:{checkedAt:new Date().toISOString(),effectiveExpiresAt:access.effectiveExpiresAt,scope:"checked_at_delivery_not_recallable"},
  boundaries:{savedReview:"not_created",sourceReport:"unchanged",basis:"operator_declared_not_independently_verified",semanticApproval:"not_granted",researchValidity:"not_established",appExecution:"not_performed",stakeholderDecisions:"not_performed",providerInference:"not_performed",executionAuthority:"not_granted",publicationAuthority:"not_granted",actionsAndExperiments:"not_created"}});
 previews.set(preview,{workspace,checked});return preview;
 }catch{throw new ContextDataError();}}
/** One original data delivery after serialization. Not reusable by any later write operation. */
export function encodeContextOperatorReviewPreview(workspace:string,value:unknown):string{try{
 if(!value||typeof value!=="object")throw new ContextDataError();const saved=previews.get(value);previews.delete(value);
 if(!saved||saved.workspace!==workspace)throw new ContextDataError();const encoded=JSON.stringify(value);
 if(Buffer.byteLength(encoded)>maximumPreviewBytes)throw new ContextDataError();consumeContextAnalystInspection(saved.checked);return encoded;
 }catch{throw new ContextDataError();}}
