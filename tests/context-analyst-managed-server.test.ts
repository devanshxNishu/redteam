import test,{mock} from "node:test";
import assert from "node:assert/strict";
import {resolve} from "node:path";
import {readFileSync,writeFileSync} from "node:fs";
import {apiFixture,logicalContextState} from "./helpers/context-api-fixture.ts";
import {revokeContextProcessingAuthorization} from "../src/context-processing.ts";

test("managed native idea/app API binds expiry to the checked original while legacy v1 and existing rows remain unchanged",async()=>{for(const subject of["idea","app"])await apiFixture(async c=>{
 const before=logicalContextState(c.store.directory),p=resolve(c.store.directory,"context-analyst-runs",c.r.runId!,"report.json"),bytes=readFileSync(p),calls=c.providerCalls();
 const response=await fetch(c.base+"/"+c.r.taskId+"/managed",{headers:c.headers});assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");assert(response.headers.get("content-security-policy")?.includes("script-src 'self'"));const v=await response.json()as any;assert.equal(v.schemaVersion,"2.0");assert.equal(v.reportSha256,c.r.reportSha256);assert.equal(v.access.effectiveExpiresAt,c.c.grant.expiresAt);assert(Date.parse(v.access.displayUntil)<=Date.parse(v.access.checkedAt)+30000);assert.equal(v.boundaries.semanticReview,"unreviewed");
 const old=await fetch(c.base+"/"+c.r.taskId,{headers:c.headers}),v1=await old.json()as any;assert.equal(v1.schemaVersion,"1.0");assert(!("access" in v1));assert.deepEqual(logicalContextState(c.store.directory),before);assert(readFileSync(p).equals(bytes));assert.equal(c.providerCalls(),calls);
 for(const suffix of["/managed?extra=x","/managed/execute","/managed/"]){const denied=await fetch(c.base+"/"+c.r.taskId+suffix,{headers:c.headers});assert.equal(denied.status,404);assert(!(await denied.text()).includes('"analysis":'));}
 assert.equal((await fetch(c.base+"/"+c.r.taskId+"/managed")).status,401);
},subject);});
test("managed API withholds final-frame revoked expired or changed source data",async()=>{for(const mode of["file","revoke","expiry"])await apiFixture(async c=>{
 if(mode==="expiry")mock.timers.enable({apis:["Date"],now:Date.parse(c.c.grant.expiresAt)-10000});const p=resolve(c.store.directory,"context-analyst-runs",c.r.runId!,"report.json"),bytes=readFileSync(p),stringify=JSON.stringify;let changed=false;
 JSON.stringify=function(value:any,...args:any[]){const text=Reflect.apply(stringify,JSON,[value,...args]);if(value?.kind==="context_analyst_report_view"&&value.schemaVersion==="2.0"&&!changed){changed=true;if(mode==="file")writeFileSync(p,"PRIVATE_MANAGED_FINAL_FRAME");if(mode==="revoke")revokeContextProcessingAuthorization(c.store,c.c.grant.id,1,"Authored managed response-frame revocation.");if(mode==="expiry")mock.timers.setTime(Date.now()+10001);}return text;}as typeof JSON.stringify;
 try{const response=await fetch(c.base+"/"+c.r.taskId+"/managed",{headers:c.headers});assert.equal(response.status,404);assert(!(await response.text()).includes('"analysis":'));assert(changed);}finally{JSON.stringify=stringify;if(mode==="expiry")mock.timers.reset();if(mode==="file")writeFileSync(p,bytes);}
});});
test("managed report script is a fixed local asset and unsupported methods do not execute or recover",async()=>apiFixture(async c=>{
 const before=logicalContextState(c.store.directory);const asset=await fetch(c.server.origin+"/context-reports.js");assert.equal(asset.status,200);assert(asset.headers.get("content-type")?.startsWith("text/javascript"));assert((await asset.text()).includes('context-report-api-v2'));for(const method of["POST","DELETE"]){const response=await fetch(c.base+"/"+c.r.taskId+"/managed",{headers:c.headers,method});assert.equal(response.status,404);}assert.deepEqual(logicalContextState(c.store.directory),before);
}));
