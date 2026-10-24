import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { StudyPlan } from "./domain/study.ts";

export type FixtureVariant = "broken" | "fixed";

const loadedSource = await readFile(new URL(import.meta.url));
const loadedHash = createHash("sha256").update(loadedSource).digest("hex");

export async function assertFixtureSourceUnchanged(): Promise<void> {
  const current = createHash("sha256").update(await readFile(new URL(import.meta.url))).digest("hex");
  if (current !== loadedHash) throw new Error("Fixture source changed after module load. Start a new process.");
}

export async function fixtureBuildHash(variant: FixtureVariant): Promise<string> {
  return createHash("sha256").update(loadedHash).update(variant).digest("hex");
}

export function assertSignupContract(study: StudyPlan): void {
  const [navigate, name, email, submit, assertion] = study.steps;
  if (study.steps.length !== 5 || navigate?.operation !== "navigate" || navigate.path !== "/"
    || name?.operation !== "fill" || name.selector !== "#name" || !name.value.trim()
    || email?.operation !== "fill" || email.selector !== "#email" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)
    || submit?.operation !== "click" || submit.selector !== "button[type=submit]"
    || assertion?.operation !== "assert_text" || assertion.selector !== "h1" || assertion.expected !== "Your pilot is ready") {
    throw new Error("D1 requires the approved signup journey: open signup, fill valid details, submit, and check confirmation.");
  }
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title>
  <style>body{font:18px system-ui;max-width:660px;margin:80px auto;padding:24px;color:#17212b;background:#f7f9fc}main{padding:36px;background:white;border:1px solid #dce3ed;border-radius:16px}label,input{display:block}input{padding:12px;margin:8px 0 20px;font:inherit;width:90%}button{font:inherit;padding:12px 22px;background:#17212b;color:white;border:0;border-radius:8px}.label{font-size:12px;letter-spacing:2px;color:#626d80}</style></head><body><main><p class="label">REDTEAM · SYNTHETIC TEST FIXTURE</p><h1>${title}</h1>${body}</main></body></html>`;
}

export async function createFixture(variant: FixtureVariant) {
  await assertFixtureSourceUnchanged();
  const snapshotId = randomUUID();
  const accounts = new Set<string>();
  const buildHash = await fixtureBuildHash(variant);
  const server = createServer((request, response) => {
    void (async () => {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    if (request.method === "GET" && request.url === "/") {
      response.end(page("Start your pilot", `<p>Try the local demonstration app.</p><form method="post" action="/signup"><label for="name">Name</label><input id="name" name="name" required><label for="email">Email</label><input id="email" name="email" type="email" required><button type="submit">Start pilot</button></form>`));
      return;
    }
    if (request.method === "POST" && request.url === "/signup") {
      let body = "";
      for await (const chunk of request) {
        body += String(chunk);
        if (Buffer.byteLength(body) > 8192) { response.writeHead(413).end("Request too large"); return; }
      }
      const data = new URLSearchParams(body);
      const email = data.get("email") ?? "";
      if (!data.get("name") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        response.writeHead(400).end(page("Check your details", "<p>A name and valid email are required.</p>"));
      } else if (variant === "broken") {
        response.writeHead(500).end(page("We could not start your pilot", "<p>The demo signup service failed. This is a deliberately introduced fixture defect.</p>"));
      } else {
        accounts.add(email);
        response.end(page("Your pilot is ready", "<p>Your demo account was created.</p>"));
      }
      return;
    }
    response.writeHead(404).end(page("Page unavailable", "<p>This path is outside the fixture.</p>"));
    })().catch(() => {
      if (response.destroyed) return;
      if (!response.headersSent) response.writeHead(500);
      response.end(page("Request could not complete", "<p>The fixture request was interrupted.</p>"));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture did not receive a local port.");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    snapshotId,
    buildHash,
    baselineReady: accounts.size === 0,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}
