import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { WorkspaceStore } from "./workspace.ts";
import { grantAccess, isGrantActive } from "./access.ts";
import { ReviewService } from "./review-service.ts";
import { checkArtifacts } from "./evidence.ts";
import { ResearchRegistry } from "./research.ts";
import { runActorDemo } from "./actor-demo.ts";
import { readActorReport, authorizedActorRuns } from "./actor-reports.ts";
import { authorizedRepositoryRuns, readRepositorySnapshot } from "./repository.ts";
import { authorizedEngineeringRuns, readEngineeringReport } from "./engineering.ts";
import { ActionConflictError } from "./domain/actions.ts";
import { authorizedActionSummaries, createTrackedAction, readTrackedAction, updateTrackedAction } from "./actions.ts";

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (request.headers["content-type"]?.split(";")[0] !== "application/json") throw new Error("Use application/json.");
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > 65536) throw new Error("Request exceeds 64 KB.");
    chunks.push(Buffer.from(chunk));
  }
  let result: unknown;
  try { result = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new Error("Invalid JSON request."); }
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Expected a JSON object.");
  return result as Record<string, unknown>;
}

function send(response: ServerResponse, status: number, data: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

export async function createLocalServer(options: { workspace: string; assetsRoot: string; port?: number }) {
  const store = new WorkspaceStore(options.workspace);
  let research: ResearchRegistry;
  let reviews: ReviewService;
  try { research = new ResearchRegistry(options.workspace); }
  catch (error) { store.close(); throw error; }
  try {
    reviews = new ReviewService(store, options.workspace, options.assetsRoot);
  } catch (error) { research.close(); store.close(); throw error; }
  try { await reviews.importLegacyRuns(); }
  catch (error) { await reviews.stop(); research.close(); store.close(); throw error; }
  const token = randomBytes(32).toString("hex");
  let origin = "";
  let actorDemoActive: Promise<unknown> | null = null;
  let closing = false;
  const server = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    void (async () => {
      if (request.headers.host !== new URL(origin).host) { send(response, 421, { error: "Host is not the local service origin." }); return; }
      if (request.headers.origin && request.headers.origin !== origin) { send(response, 403, { error: "Cross-origin requests are not allowed." }); return; }
      const url = new URL(request.url ?? "/", origin);
      if (closing) { send(response, 503, { error: "The local service is shutting down." }); return; }
      if (request.method === "GET" && ["/", "/app.js", "/styles.css"].includes(url.pathname)) {
        const name = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
        let content = await readFile(resolve(options.assetsRoot, "web", name));
        if (name === "index.html") content = Buffer.from(content.toString("utf8").replace("__REDTEAM_TOKEN__", token));
        response.writeHead(200, { "Content-Type": name.endsWith("html") ? "text/html; charset=utf-8" : name.endsWith("css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8" });
        response.end(content);
        return;
      }
      const authorization = request.headers.authorization ?? "";
      const supplied = Buffer.from(authorization.startsWith("Bearer ") ? authorization.slice(7) : "");
      const expected = Buffer.from(token);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) { send(response, 401, { error: "A local Redteam session is required." }); return; }
      if (request.method === "GET" && url.pathname === "/api/actions") { send(response, 200, { recentWindow: 100, actions: authorizedActionSummaries(store) }); return; }
      if (request.method === "POST" && url.pathname === "/api/actions") { send(response, 201, await createTrackedAction(store, await body(request))); return; }
      const actionDetail = /^\/api\/actions\/([a-f0-9-]{36})$/.exec(url.pathname);
      if (request.method === "GET" && actionDetail) {
        try { send(response, 200, await readTrackedAction(store, actionDetail[1]!)); }
        catch (error) { if (error instanceof ActionConflictError) send(response, 409, { code: "action_revision_changed", error: "The action changed during inspection. Read it again." }); else send(response, 404, { code: "action_unavailable", error: "Action unavailable. Current source access or integrity checks failed." }); }
        return;
      }
      if (request.method === "PATCH" && actionDetail) { send(response, 200, await updateTrackedAction(store, actionDetail[1]!, await body(request))); return; }
      if (request.method === "GET" && url.pathname === "/api/code-runs") {
        const repositoryRuns = authorizedRepositoryRuns(store).map(({ runId, grantId, target, createdAt, fileCount, totalBytes }) => ({ runId, grantId, target, createdAt, fileCount, totalBytes, recordStatus: "cataloged_unverified" }));
        const engineeringRuns = authorizedEngineeringRuns(store).map(({ runId, snapshotRunId, grantId, target, createdAt, observationCount }) => ({ runId, snapshotRunId, grantId, target, createdAt, observationCount, recordStatus: "cataloged_unverified" }));
        send(response, 200, { repositoryRuns, engineeringRuns }); return;
      }
      const codeDetail = /^\/api\/code-runs\/(repositories|observations)\/([a-f0-9-]{36})$/.exec(url.pathname);
      if (request.method === "GET" && codeDetail) {
        try {
          const report = codeDetail[1] === "repositories" ? await readRepositorySnapshot(store, codeDetail[2]!) : await readEngineeringReport(store, codeDetail[2]!);
          send(response, 200, report);
        } catch {
          send(response, 404, { error: "Code record unavailable. Access or integrity checks failed.", code: "code_record_unavailable" });
        }
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/workspace") {
        const jobs = store.jobs();
        const grants = store.grants().map(grant => ({ ...grant, active: isGrantActive(grant) }));
        send(response, 200, { name: "redteam", mode: "local", workspace: options.workspace, jobs, grants,
          metrics: { reviews: jobs.length, findings: jobs.reduce((sum, job) => sum + job.findingCount, 0), artifacts: jobs.reduce((sum, job) => sum + job.artifactCount, 0), accessGrants: grants.filter(grant => grant.active).length },
          research: research.summary(), actorRuns: await authorizedActorRuns(store, research, options.workspace),
          audit: store.auditLog() });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/reviews") {
        const data = await body(request);
        if (Object.keys(data).some(key => key !== "variant") || !["broken", "fixed"].includes(String(data.variant))) throw new Error("Choose a supported local fixture variant.");
        send(response, 202, reviews.submit(data.variant as "broken" | "fixed"));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/actors/demo") {
        if (actorDemoActive) { send(response, 409, { error: "A scripted actor demonstration is already running." }); return; }
        const pending = runActorDemo(options.workspace, research);
        actorDemoActive = pending;
        try { send(response, 201, await pending); }
        finally { actorDemoActive = null; }
        return;
      }
      const actorDetail = /^\/api\/actors\/([a-f0-9-]{36})$/.exec(url.pathname);
      if (request.method === "GET" && actorDetail) { send(response, 200, await readActorReport(store, options.workspace, actorDetail[1]!, research)); return; }
      const actorVerify = /^\/api\/actors\/([a-f0-9-]{36})\/verify$/.exec(url.pathname);
      if (request.method === "POST" && actorVerify) {
        const report = await readActorReport(store, options.workspace, actorVerify[1]!, research);
        const errors = await checkArtifacts(store.actorRun(actorVerify[1]!)!.directory, report.artifacts);
        send(response, 200, { valid: errors.length === 0, artifacts: report.artifacts.length, errors }); return;
      }
      if (request.method === "POST" && url.pathname === "/api/access") {
        const data = await body(request);
        if (Object.keys(data).some(key => !["name", "target", "kind", "capabilities", "expiresInHours"].includes(key))) throw new Error("Unsupported access field. Import sessions through the CLI.");
        if (!Array.isArray(data.capabilities) || !data.capabilities.every(item => typeof item === "string")) throw new Error("Capabilities must be strings.");
        if (data.expiresInHours !== undefined && typeof data.expiresInHours !== "number") throw new Error("Access duration must be numeric.");
        const grant = grantAccess(store, { name: data.name as string, target: data.target as string, kind: data.kind as "web" | "directory", capabilities: data.capabilities,
          ...(data.expiresInHours !== undefined ? { expiresInHours: data.expiresInHours } : {}) });
        send(response, 201, grant);
        return;
      }
      const revoke = /^\/api\/access\/([a-f0-9-]{36})\/revoke$/.exec(url.pathname);
      if (request.method === "POST" && revoke) { send(response, 200, store.revokeGrant(revoke[1]!)); return; }
      const detail = /^\/api\/reviews\/([a-f0-9-]{36})$/.exec(url.pathname);
      if (request.method === "GET" && detail) { send(response, 200, await reviews.report(detail[1]!)); return; }
      const verify = /^\/api\/reviews\/([a-f0-9-]{36})\/verify$/.exec(url.pathname);
      if (request.method === "POST" && verify) {
        const report = await reviews.report(verify[1]!);
        const errors = await checkArtifacts(store.job(verify[1]!)!.reportDirectory!, report.artifacts);
        send(response, 200, { valid: errors.length === 0, artifacts: report.artifacts.length, errors });
        return;
      }
      const artifactRoute = /^\/api\/reviews\/([a-f0-9-]{36})\/artifacts\/([a-f0-9-]{36})$/.exec(url.pathname);
      if (request.method === "GET" && artifactRoute) {
        const report = await reviews.report(artifactRoute[1]!);
        const artifact = report.artifacts.find(item => item.id === artifactRoute[2]);
        if (!artifact) { send(response, 404, { error: "Artifact not found." }); return; }
        const directory = store.job(artifactRoute[1]!)!.reportDirectory!;
        if ((await checkArtifacts(directory, [artifact])).length) throw new Error("Artifact failed its integrity check.");
        response.writeHead(200, { "Content-Type": artifact.mediaType, "Content-Disposition": `inline; filename="${artifact.id}"` });
        response.end(await readFile(resolve(directory, artifact.path)));
        return;
      }
      send(response, 404, { error: "Route not found." });
    })().catch(error => {
      if (!response.headersSent) send(response, error instanceof ActionConflictError ? 409 : 400, { error: error instanceof Error ? error.message : "Request failed." });
      else response.destroy();
    });
  });
  try {
    await new Promise<void>((accept, reject) => {
      server.once("error", reject);
      server.listen(options.port ?? 4317, "127.0.0.1", () => { server.off("error", reject); accept(); });
    });
  } catch (error) { await reviews.stop(); research.close(); store.close(); throw error; }
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The local server did not receive a port.");
  origin = `http://127.0.0.1:${address.port}`;
  return {
    origin, token, store, reviews,
    close: async () => {
      closing = true;
      await reviews.stop();
      if (actorDemoActive) await actorDemoActive.catch(() => {});
      server.closeAllConnections();
      await new Promise<void>((accept, reject) => server.close(error => error ? reject(error) : accept()));
      store.close();
      research.close();
    },
  };
}
