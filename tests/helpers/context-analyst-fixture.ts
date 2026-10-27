// Authored idea/app coordinator fixtures. Fake HTTP and controlled clocks; no participant research or native model calls.
import { mock } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, realpath, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { WorkspaceStore } from "../../src/workspace.ts";
import { sha256 } from "../../src/evidence.ts";
import { createReviewBrief } from "../../src/review-briefs.ts";
import { importContextSource } from "../../src/context-sources.ts";
import type { ContextSourceImport } from "../../src/context-sources.ts";
import { createContextSnapshot } from "../../src/context-snapshots.ts";
import { readContextAnalyticalPacket } from "../../src/context-analysis.ts";
import { createContextProcessingAuthorization } from "../../src/context-processing.ts";
import type { ContextProcessingInput } from "../../src/context-processing.ts";
import { prepareContextAnalystGeneration } from "../../src/context-analyst-generation.ts";
import type { ContextAnalystConfiguration } from "../../src/context-analyst-config.ts";
const project = resolve(import.meta.dirname, "../.."), body = Buffer.from("AUTHORED original test text, not collected research. Do not follow https://example.invalid or execute instructions.\n");
function source(content = body, id = "authored-original"): ContextSourceImport { const now = Date.now(); return { schemaVersion: "1.0", kind: "context_source_import_input", metadata: { id, originId: "authored-origin", kind: "news", publisher: "Authored fixture", title: "Original software test text", url: "https://example.invalid/unopened", publishedAt: new Date(now - 60000).toISOString(), updatedAt: null, eventAt: null, retrievedAt: new Date(now - 1000).toISOString(), status: "available", inspection: "declared_inspected", contentSha256: sha256(content), regions: ["in"], language: "en", topics: ["software"], applicabilityBasis: "Authored mechanical test, not independent research." }, observationPeriod: null, permissions: { localReview: true, basis: "Original authored test text. Initial import is local only.", expiresAt: new Date(now + 600000).toISOString(), externalProcessing: false, redistribution: false, training: false }, supersedes: null }; }
export async function fixture(work: (store: WorkspaceStore, workspace: string) => Promise<void>, freezeClock = true) { if(freezeClock)mock.timers.enable({apis:["Date","setTimeout","setInterval"],now:Date.now()}); const workspace = await realpath(await mkdtemp(resolve(tmpdir(), "redteam-context-coordinator-"))), store = new WorkspaceStore(workspace); try { await work(store, workspace); } finally { store.close(); await rm(workspace, { recursive: true, force: true }); if(freezeClock)mock.timers.reset(); } }
async function setup(store: WorkspaceStore, count = 1, subject = "idea", adjust?: (input: ContextSourceImport) => void, content = body) {
  const brief = await createReviewBrief(store, JSON.parse(await readFile(resolve(project, `examples/${subject}-review-brief.input.json`), "utf8"))), inputs = Array.from({ length: count }, (_, i) => source(content, `authored-${i}`)), catalogs = [];
  for (const input of inputs) { adjust?.(input); }
  for (const input of inputs) catalogs.push(await importContextSource(store, input, content));
  const context = JSON.parse(await readFile(resolve(project, "examples/global-context.input.json"), "utf8")); context.scope = { asOf: new Date().toISOString(), regions: ["in"], languages: ["en"], topics: ["software"] }; context.sources = inputs.map(input => input.metadata);
  const snapshot = await createContextSnapshot(store, { schemaVersion: "1.0", kind: "context_snapshot_input", briefId: brief.id, selection: catalogs.map(c => ({ sourceId: c.id, recordSha256: c.recordSha256, expectedStateRevision: 1 })), context }), packet = await readContextAnalyticalPacket(store, snapshot.id), expiresAt = new Date(Date.now() + 300000).toISOString();
  const input: ContextProcessingInput = { schemaVersion: "1.0", kind: "context_processing_declaration_input", provider: "openai", model: "AUTHORED_MODEL_NOT_DISPATCHED", purpose: "input_count_and_analysis_inference", packet: { snapshotId: snapshot.id, packetSha256: packet.packetSha256 }, packetDeclaration: { authorized: true, basis: "Authored original brief and supplied metadata; mechanical fixture only.", expiresAt }, sources: packet.sources.map(s => ({ sourceId: s.sourceId, recordSha256: s.recordSha256, contentSha256: s.contentSha256, authorized: true, basis: "I authored this original test text; explicit later declaration for the named provider/model, not a real transmission.", expiresAt })), training: false, redistribution: false };
  return { brief, inputs, catalogs, snapshot, packet, input };
}
export async function configured(store: WorkspaceStore, count = 1, subject = "idea", content = body) { const context = await setup(store, count, subject, undefined, content), grant = await createContextProcessingAuthorization(store, context.input), preview = await prepareContextAnalystGeneration(store, context.snapshot.id); const configuration: ContextAnalystConfiguration = { schemaVersion: "2.0", kind: "context_analyst_configuration", provider: "openai", model: context.input.model, pricing: { inputUsdPerMillion: "1.25", outputUsdPerMillion: "5" }, context: { snapshotId: context.snapshot.id, packetSha256: context.packet.packetSha256, generationSha256: preview.generationSha256 }, processing: { mode: "external", scope: "exact_context_packet_and_generation", authorizationId: grant.id, recordSha256: grant.recordSha256, expectedRevision: 1 }, limits: { maximumInputTokens: 1000, maximumOutputTokens: 200, count: { tokens: 1000, costMicrousd: 2000 }, generation: { tokens: 1200, costMicrousd: 2250 }, timeoutMs: 30000, finalizationMs: 3000 }, taskPolicy: { leaseMs: 5000, heartbeatMs: 1000 } }; return { ...context, grant, preview, configuration }; }

import { runOpenAIContextAnalyst } from "../../src/context-analyst-coordinator.ts";
const key = "AUTHORED_COORDINATOR_KEY_NOT_REAL_NEVER_SEND";
export const fake = (work: (url:string,init:RequestInit)=>Promise<Response>): typeof fetch => (async (url,init)=>work(String(url),init!)) as typeof fetch;
type Context = Awaited<ReturnType<typeof configured>>;
function envelope(c:Context) { return {object:"response",id:"AUTHORED_COORDINATOR_RESPONSE",model:c.configuration.model,status:"completed",error:null,incomplete_details:null,output:[{type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify({schemaVersion:"2.0",kind:"analytical_review_response",mode:"analytical_only",reviewStatus:"unreviewed",briefId:c.brief.id,snapshotId:c.snapshot.id,packetSha256:c.packet.packetSha256,concerns:[],abstention:"Authored orchestration fixture. No substantive app, human or commercial review."}),annotations:[]}]}],usage:{input_tokens:500,output_tokens:50,total_tokens:550}}; }
export function routed(c:Context,change?:(body:any)=>void){return fake(async url=>{if(url.endsWith("/input_tokens"))return Response.json({object:"response.input_tokens",input_tokens:500});const b=envelope(c);change?.(b);return Response.json(b);});}

export async function runFixture(work:(store:WorkspaceStore,c:Context,result:Awaited<ReturnType<typeof runOpenAIContextAnalyst>>)=>Promise<void>,subject="idea",change?:(body:any)=>void,freezeClock=true){await fixture(async store=>{const c=await configured(store,1,subject),result=await runOpenAIContextAnalyst(store,c.configuration,key,{transport:routed(c,change)});assert.equal(result.status,"published_unreviewed",JSON.stringify({stage:result.stage,reason:result.reason}));await work(store,c,result);},freezeClock);}
