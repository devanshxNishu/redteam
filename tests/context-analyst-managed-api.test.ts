import test,{mock} from "node:test";
import assert from "node:assert/strict";
import {resolve} from "node:path";
import {readFileSync,writeFileSync} from "node:fs";
import {prepareManagedContextAnalystReportResponse as prepare,prepareContextAnalystReportResponse as legacy,encodeContextAnalystReportResponse as encode} from "../src/context-analyst-api.ts";
import {inspectContextAnalystReport,contextAnalystInspectionAccess,consumeContextAnalystInspection} from "../src/context-analyst-inspection.ts";
import {runFixture} from "./helpers/context-analyst-fixture.ts";
import {revokeContextProcessingAuthorization} from "../src/context-processing.ts";

test("managed v2 publishes separately checked permission/display expiry while v1 and saved report bytes stay unchanged",async()=>runFixture(async(store,c,r)=>{
 const root=resolve(store.directory,".."),file=resolve(store.directory,"context-analyst-runs",r.runId!,"report.json"),bytes=readFileSync(file);
 const v1=await legacy(root,r.taskId!),old=JSON.parse(encode(root,r.taskId!,v1));assert.equal(old.schemaVersion,"1.0");assert(!("access" in old));
 const v=await prepare(root,r.taskId!),body=JSON.parse(encode(root,r.taskId!,v));assert.equal(body.schemaVersion,"2.0");assert.equal(body.policyVersion,"context-report-api-v2");assert.equal(body.reportSha256,r.reportSha256);assert.equal(body.access.effectiveExpiresAt,c.grant.expiresAt);assert.equal(Date.parse(body.access.displayUntil),Date.parse(body.access.checkedAt)+30000);assert.equal(body.access.revalidation,"explicit_request");assert.equal(body.access.deliveredCopies,"not_recallable");
 const {access,schemaVersion,policyVersion,...rest}=body,{schemaVersion:oldSchema,policyVersion:oldPolicy,...previous}=old;assert.deepEqual(rest,previous);assert(readFileSync(file).equals(bytes));assert.throws(()=>encode(root,r.taskId!,v));
}));
test("earlier effective permission expiry bounds display and is checked after serialization",async()=>{for(const change of["expiry","display"])await runFixture(async(store,c,r)=>{
 const root=resolve(store.directory,"..");if(change==="expiry")mock.timers.setTime(Date.parse(c.grant.expiresAt)-5000);
 const v=await prepare(root,r.taskId!),until=Date.parse(v.access!.displayUntil);assert.equal(until,Math.min(Date.parse(c.grant.expiresAt),Date.now()+30000));
 const stringify=JSON.stringify;JSON.stringify=function(value:any,...args:any[]){const text=Reflect.apply(stringify,JSON,[value,...args]);if(value===v)mock.timers.setTime(until);return text;}as typeof JSON.stringify;
 try{assert.throws(()=>encode(root,r.taskId!,v));assert.throws(()=>encode(root,r.taskId!,v));}finally{JSON.stringify=stringify;}
 });});
test("managed original guards deny source revocation file changes cancellation and copy/cross-binding without exposing content",async()=>{for(const change of["revoke","file","abort","copy","binding"])await runFixture(async(store,c,r)=>{
 const root=resolve(store.directory,".."),controller=new AbortController(),v=await prepare(root,r.taskId!,{signal:controller.signal}),p=resolve(store.directory,"context-analyst-runs",r.runId!,"report.json"),bytes=readFileSync(p);
 try{if(change==="revoke")revokeContextProcessingAuthorization(store,c.grant.id,1,"Authored managed-view revocation.");if(change==="file")writeFileSync(p,"PRIVATE_MANAGED_MUTATION");if(change==="abort")controller.abort();assert.throws(()=>encode(change==="binding"?root+"/other":root,r.taskId!,change==="copy"?structuredClone(v):v));if(change==="copy")assert.equal(JSON.parse(encode(root,r.taskId!,v)).schemaVersion,"2.0");}
 finally{if(change==="file")writeFileSync(p,bytes);}
 });});
test("inspection expiry accessor requires an original current handle and grants no second delivery",async()=>runFixture(async(store,c,r)=>{
 const root=resolve(store.directory,".."),v=await inspectContextAnalystReport(root,r.taskId!);let touched=false;const copy=Object.defineProperty({},"effectiveExpiresAt",{get(){touched=true;return c.grant.expiresAt;}});assert.throws(()=>contextAnalystInspectionAccess(copy));assert.throws(()=>contextAnalystInspectionAccess(structuredClone(v)));assert.equal(touched,false);assert.deepEqual(contextAnalystInspectionAccess(v),{effectiveExpiresAt:c.grant.expiresAt});consumeContextAnalystInspection(v);assert.throws(()=>contextAnalystInspectionAccess(v));assert.throws(()=>consumeContextAnalystInspection(v));
}));
