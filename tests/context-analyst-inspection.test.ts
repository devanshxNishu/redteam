import test, {mock} from "node:test";
import assert from "node:assert/strict";
import {readFile,writeFile,chmod,mkdtemp,realpath,rm,mkdir,link,rename} from "node:fs/promises";
import {existsSync,readFileSync,writeFileSync,chmodSync,lstatSync} from "node:fs";
import {tmpdir} from "node:os";
import {resolve} from "node:path";
import {randomUUID} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {WorkspaceStore} from "../src/workspace.ts";
import {ContextDataError} from "../src/context-data.ts";
import {inspectContextAnalystReport} from "../src/context-analyst-inspection.ts";
import {runOpenAIContextAnalyst} from "../src/context-analyst-coordinator.ts";
import {revokeContextProcessingAuthorization} from "../src/context-processing.ts";
import {fixture,configured,runFixture,fake} from "./helpers/context-analyst-fixture.ts";
const privateError=(e:unknown)=>e instanceof ContextDataError&&e.message==="The context record, current source rights or bounded input is unavailable.";
const report=(s:WorkspaceStore,id:string)=>resolve(s.directory,"context-analyst-runs",id,"report.json");
const logical=(s:WorkspaceStore)=>["workspace.sqlite","tasks.sqlite","budgets.sqlite"].map(name=>{const path=resolve(s.directory,name);if(!existsSync(path))return null;const db=new DatabaseSync(path,{readOnly:true});try{const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();return tables.map(t=>({table:t.name,rows:db.prepare(`SELECT * FROM "${String(t.name).replaceAll('"','""')}"`).all()}));}finally{db.close();}});

test("existing read-only workspace creates no missing state or database and does not normalize permissions",async()=>{
 const root=await realpath(await mkdtemp(resolve(tmpdir(),"redteam-readonly-workspace-")));
 try{assert.throws(()=>new WorkspaceStore(root,{readOnly:true}));assert(!existsSync(resolve(root,".redteam")));await mkdir(resolve(root,".redteam"),{mode:0o700});assert.throws(()=>new WorkspaceStore(root,{readOnly:true}));assert(!existsSync(resolve(root,".redteam/workspace.sqlite")));const writer=new WorkspaceStore(root);writer.close();const file=resolve(root,".redteam/workspace.sqlite");await chmod(file,0o644);assert.throws(()=>new WorkspaceStore(root,{readOnly:true}));assert.equal(lstatSync(file).mode&0o077,0o044);await chmod(file,0o600);await chmod(resolve(root,".redteam"),0o755);assert.throws(()=>new WorkspaceStore(root,{readOnly:true}));assert.equal(lstatSync(resolve(root,".redteam")).mode&0o077,0o055);
 }finally{await rm(root,{recursive:true,force:true});}
});
test("read-only workspace keeps old schema, rows and bytes and denies mutations without coordinator ownership",async()=>fixture(async store=>{
 const root=resolve(store.directory,".."),path=resolve(store.directory,"workspace.sqlite"),db=new DatabaseSync(path);db.exec("DROP TABLE coordinator; PRAGMA wal_checkpoint(TRUNCATE)");db.close();const before=await readFile(path),prior=logical(store),view=new WorkspaceStore(root,{readOnly:true});try{assert.equal(view.reviewBrief(randomUUID()),null);assert.throws(()=>view.createJob("broken"));assert.throws(()=>view.acquireCoordinator("NO_OWNER_ALLOWED"));}finally{view.close();}assert.deepEqual(logical(store),prior);assert((await readFile(path)).equals(before));assert(!existsSync(resolve(store.directory,"tasks.sqlite")));assert(!existsSync(resolve(store.directory,"budgets.sqlite")));
}));
test("read-only workspace denies linked databases, unsafe sidecars and accessor options without repair",async()=>fixture(async store=>{
 const root=resolve(store.directory,".."),file=resolve(store.directory,"workspace.sqlite"),alias=file+".alias";await link(file,alias);try{assert.throws(()=>new WorkspaceStore(root,{readOnly:true}));}finally{await rm(alias);}const side=file+"-wal";await chmod(side,0o644);try{assert.throws(()=>new WorkspaceStore(root,{readOnly:true}));assert.equal(lstatSync(side).mode&0o077,0o044);}finally{await chmod(side,0o600);}let called=false;assert.throws(()=>new WorkspaceStore(root,Object.defineProperty({},"readOnly",{enumerable:true,get(){called=true;return true;}}) as any));assert.equal(called,false);
}));
test("workspace inspection reads checked idea/app report data and preserves all catalog/task/budget rows and immutable files",async()=>{
 for(const subject of ["idea","app"])await runFixture(async(store,c,result)=>{const before=logical(store),path=report(store,result.runId!),bytes=await readFile(path),value=await inspectContextAnalystReport(resolve(store.directory,".."),result.taskId!);assert.equal(value.kind,"checked_historical_context_report_data");assert.deepEqual(value.report,result.report);assert.equal(value.sha256,result.reportSha256);assert.equal(value.boundaries.executionAuthority,"not_granted");assert.equal(value.boundaries.currentLedger,"not_read");assert.deepEqual(logical(store),before);assert((await readFile(path)).equals(bytes));},subject);
});
test("inspection preserves factual failure and held count liability with an absent current billing database",async()=>fixture(async store=>{
 const c=await configured(store),result=await runOpenAIContextAnalyst(store,c.configuration,"AUTHORED_KEY_NOT_REAL",{transport:fake(async()=>new Response("AUTHORED error",{status:429}))});assert.equal(result.status,"published_unreviewed");const path=resolve(store.directory,"budgets.sqlite");await rename(path,path+".saved");try{const v=await inspectContextAnalystReport(resolve(store.directory,".."),result.taskId!);assert.equal(v.report.candidate,null);assert.equal(v.report.budget.snapshot.pools[0]!.held.costMicrousd,"2000");assert(!existsSync(path));}finally{await rename(path+".saved",path);}
}));
test("inspection denies malformed IDs and missing private state without opening or creating records",async()=>{
 const root=await realpath(await mkdtemp(resolve(tmpdir(),"redteam-inspection-absent-")));try{for(const id of ["SECRET_SUPPLIED_INVALID_ID",randomUUID()])await assert.rejects(inspectContextAnalystReport(root,id),privateError);assert(!existsSync(resolve(root,".redteam")));}finally{await rm(root,{recursive:true,force:true});}
});
test("inspection does not promote a missing report or repair altered report/source bytes or public permissions",async()=>runFixture(async(store,c,result)=>{
 const root=resolve(store.directory,".."),path=report(store,result.runId!),original=await readFile(path);await rename(path,path+".saved");try{await assert.rejects(inspectContextAnalystReport(root,result.taskId!),privateError);assert(!existsSync(path));}finally{await rename(path+".saved",path);}await writeFile(path,'{"PRIVATE_UNSUPPORTED_BODY":true}');await assert.rejects(inspectContextAnalystReport(root,result.taskId!),privateError);assert.equal((await readFile(path)).toString(),'{"PRIVATE_UNSUPPORTED_BODY":true}');await writeFile(path,original);const source=resolve(store.directory,"context-sources",c.catalogs[0]!.id,"source.txt"),sourceBytes=await readFile(source);await writeFile(source,"ALTERED_AUTHORED_TEXT");await assert.rejects(inspectContextAnalystReport(root,result.taskId!),privateError);assert.equal((await readFile(source)).toString(),"ALTERED_AUTHORED_TEXT");await writeFile(source,sourceBytes);await chmod(source,0o644);try{await assert.rejects(inspectContextAnalystReport(root,result.taskId!),privateError);assert.equal(lstatSync(source).mode&0o077,0o044);}finally{await chmod(source,0o600);}assert.equal((await inspectContextAnalystReport(root,result.taskId!)).sha256,result.reportSha256);
}));
test("inspection withholds buffered content when current processing is revoked at workspace closure",async()=>runFixture(async(store,c,result)=>{
 const close=WorkspaceStore.prototype.close;let changed=false;const replacement=mock.method(WorkspaceStore.prototype,"close",function(this:WorkspaceStore){close.call(this);if(this!==store&&!changed){changed=true;revokeContextProcessingAuthorization(store,c.grant.id,1,"Authored closure revocation test.");}});try{await assert.rejects(inspectContextAnalystReport(resolve(store.directory,".."),result.taskId!),privateError);assert(changed);}finally{replacement.mock.restore();}assert.equal(store.contextProcessingAuthorization(c.grant.id)!.state.status,"revoked");
}));
test("inspection rechecks report bytes and database modes after closure of the outer read-only connection",async()=>{
 for(const mutation of ["report_bytes","workspace_mode"] as const)await runFixture(async(store,c,result)=>{const close=WorkspaceStore.prototype.close,path=mutation==="report_bytes"?report(store,result.runId!):resolve(store.directory,"workspace.sqlite"),bytes=readFileSync(path);let changed=false;const replacement=mock.method(WorkspaceStore.prototype,"close",function(this:WorkspaceStore){close.call(this);if(this!==store&&!changed){changed=true;if(mutation==="report_bytes")writeFileSync(path,"AUTHORED_FINAL_CLOSURE_CHANGE");else chmodSync(path,0o644);}});try{await assert.rejects(inspectContextAnalystReport(resolve(store.directory,".."),result.taskId!),privateError);assert(changed);}finally{replacement.mock.restore();if(mutation==="report_bytes")writeFileSync(path,bytes);else chmodSync(path,0o600);}});
});
test("inspection enforces its entire local delivery window and a backward clock through final workspace closure",async()=>{
 for(const delta of [30000,-1])await runFixture(async(store,c,result)=>{const close=WorkspaceStore.prototype.close;let changed=false;const replacement=mock.method(WorkspaceStore.prototype,"close",function(this:WorkspaceStore){close.call(this);if(this!==store&&!changed){changed=true;mock.timers.setTime(Date.now()+delta);}});try{await assert.rejects(inspectContextAnalystReport(resolve(store.directory,".."),result.taskId!),privateError);assert(changed);}finally{replacement.mock.restore();}});
});
