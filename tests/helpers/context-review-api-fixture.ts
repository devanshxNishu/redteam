// Authored software declarations and fake provider callbacks; no participant research.
import {resolve} from "node:path";
import {mock} from "node:test";
import {createContextOperatorReview,encodeContextOperatorReview} from "../../src/context-operator-review-store.ts";
import {withConcerns,reviewInput,runFixture} from "./context-operator-review-fixture.ts";
import {createTestContextServer} from "./context-api-fixture.ts";
type Work=Parameters<typeof withConcerns>[0];
type Store=Parameters<Work>[0];type Context=Parameters<Work>[1];type Run=Parameters<Work>[2];
type Server=Awaited<ReturnType<typeof createTestContextServer>>;
type Note=Awaited<ReturnType<typeof createContextOperatorReview>>;
const project=resolve(import.meta.dirname,"../..");
export async function reviewApiFixture(work:(value:{store:Store;root:string;c:Context;r:Run;note:Note;server:Server;base:string;headers:Record<string,string>})=>Promise<void>,subject="idea",mode:"concerns"|"limits"|"unknown"="concerns"){
  // Only the authored fake producer uses a controlled setup clock. Note creation,
  // service startup, HTTP delivery and cancellation all use the native clock.
  let setupClock=true;mock.timers.enable({apis:["Date","setTimeout","setInterval"],now:Date.now()});
  const run:Work=async(store,c,r)=>{mock.timers.reset();setupClock=false;const root=resolve(store.directory,".."),prepared=await createContextOperatorReview(root,reviewInput(r.taskId!,r.reportSha256!,mode==="concerns"?"selected_concerns":"report_limits")),note=JSON.parse(encodeContextOperatorReview(root,prepared))as Note;
    const server=await createTestContextServer({workspace:root,assetsRoot:process.env.REDTEAM_TEST_API_PACKAGE??project,port:0});
    try{await work({store,root,c,r,note,server,base:server.origin+"/api/context-operator-reviews",headers:{Authorization:`Bearer ${server.token}`}});}finally{await server.close();}
  };
  try{if(mode==="concerns")await withConcerns(run,subject,undefined,false);
    else await runFixture(run,subject,mode==="unknown"?body=>{body.usage=null;}:undefined,false);
  }finally{if(setupClock)mock.timers.reset();}
}
