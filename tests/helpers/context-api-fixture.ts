import assert from "node:assert/strict";
import {resolve} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {fixture,configured,routed,fake} from "./context-analyst-fixture.ts";
import {runOpenAIContextAnalyst} from "../../src/context-analyst-coordinator.ts";
import {pathToFileURL} from "node:url";
import {createLocalServer as sourceCreateLocalServer} from "../../src/server.ts";
const project=resolve(import.meta.dirname,"../..");
export const createTestContextServer:typeof sourceCreateLocalServer=process.env.REDTEAM_TEST_API_PACKAGE?(await import(pathToFileURL(resolve(process.env.REDTEAM_TEST_API_PACKAGE,"dist/server.js")).href)).createLocalServer:sourceCreateLocalServer;
const createLocalServer=createTestContextServer;
export function logicalContextState(state:string){return["workspace.sqlite","tasks.sqlite","budgets.sqlite"].map(name=>{const db=new DatabaseSync(resolve(state,name),{readOnly:true});try{return db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(t=>({table:t.name,rows:db.prepare('SELECT * FROM "'+String(t.name).replaceAll('"','""')+'"').all()}));}finally{db.close();}});}
type Setup=Awaited<ReturnType<typeof configured>>;type Server=Awaited<ReturnType<typeof createLocalServer>>;type Result=Awaited<ReturnType<typeof runOpenAIContextAnalyst>>;
export async function apiFixture(work:(c:{store:Parameters<typeof configured>[0];root:string;c:Setup;r:Result;server:Server;base:string;headers:Record<string,string>;providerCalls:()=>number})=>Promise<void>,subject="idea",mode="normal"){
 await fixture(async(store,root)=>{const c=await configured(store,1,subject),route=mode==="http"?fake(async()=>new Response("AUTHORED_UNUSED_PROVIDER_ERROR",{status:429})):routed(c,mode==="unknown"?b=>{b.usage=null;}:undefined);let calls=0;const r=await runOpenAIContextAnalyst(store,c.configuration,"AUTHORED_API_FIXTURE_VALUE_NOT_REAL",{transport:fake(async(u,i)=>{calls++;return route(u,i);})});assert.equal(r.status,"published_unreviewed");const server=await createLocalServer({workspace:root,assetsRoot:project,port:0});try{await work({store,root,c,r,server,base:server.origin+"/api/context-runs",headers:{Authorization:`Bearer ${server.token}`},providerCalls:()=>calls});}finally{await server.close();}},false);
}
