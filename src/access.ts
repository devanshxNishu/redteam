import { randomUUID } from "node:crypto";
import { lstatSync, realpathSync } from "node:fs";
import { encryptLocal, decryptLocal } from "./vault.ts";
import type { AccessGrant, GrantCapability } from "./workspace.ts";
import { WorkspaceStore } from "./workspace.ts";

const capabilities = ["browser:read", "browser:interact", "code:read", "code:test"] as const;

export interface GrantInput {
  name: string;
  target: string;
  kind: "web" | "directory";
  capabilities: string[];
  expiresInHours?: number;
  storageState?: unknown;
}

export function grantAccess(store: WorkspaceStore, input: GrantInput): AccessGrant {
  if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 120) throw new Error("An access grant requires a short name.");
  if (typeof input.target !== "string" || !input.target.trim()) throw new Error("An access grant requires a target.");
  if (!["web", "directory"].includes(input.kind)) throw new Error("Unknown access target kind.");
  if (!Array.isArray(input.capabilities) || !input.capabilities.length || input.capabilities.some(value => !capabilities.includes(value as GrantCapability))) {
    throw new Error("Choose supported capabilities: browser:read, browser:interact, code:read, code:test.");
  }
  const hours = input.expiresInHours ?? 24;
  if (!Number.isFinite(hours) || hours <= 0 || hours > 720) throw new Error("Access duration must be above zero and at most 720 hours.");
  let target: string;
  if (input.kind === "web") {
    const url = new URL(input.target);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) {
      throw new Error("Web access requires an HTTP or HTTPS origin, without credentials, path, query, or fragment.");
    }
    if (input.capabilities.some(value => value.startsWith("code:"))) throw new Error("Code capabilities require a directory grant.");
    target = url.origin;
  } else {
    target = realpathSync(input.target);
    if (!lstatSync(target).isDirectory()) throw new Error("Directory access requires an existing directory.");
    if (input.capabilities.some(value => value.startsWith("browser:"))) throw new Error("Browser capabilities require a web grant.");
    if (input.storageState !== undefined) throw new Error("Browser sessions require a web grant.");
  }
  const id = randomUUID();
  let session: string | null = null;
  if (input.storageState !== undefined) {
    const value = input.storageState as { cookies?: unknown; origins?: unknown } | null;
    if (!value || typeof value !== "object" || !Array.isArray(value.cookies) || !Array.isArray(value.origins)) throw new Error("Expected Playwright storage state with cookies and origins arrays.");
    const hostname = new URL(target).hostname;
    for (const item of value.cookies) {
      const cookie = item as { domain?: unknown; name?: unknown; value?: unknown } | null;
      if (!cookie || typeof cookie.domain !== "string" || typeof cookie.name !== "string" || typeof cookie.value !== "string") throw new Error("Invalid session cookie.");
      const domain = cookie.domain.replace(/^\./, "");
      if (!domain || (hostname !== domain && !hostname.endsWith(`.${domain}`))) throw new Error("The session contains cookies outside the granted target.");
    }
    for (const item of value.origins) {
      const origin = item as { origin?: unknown } | null;
      if (!origin || origin.origin !== target) throw new Error("The session contains storage outside the granted origin.");
    }
    const serialized = JSON.stringify(value);
    if (Buffer.byteLength(serialized) > 2_000_000) throw new Error("Session exceeds the 2 MB limit.");
    session = encryptLocal(store.directory, id, serialized);
  }
  const now = Date.now();
  const grant: AccessGrant = {
    id, name: input.name.trim(), target, kind: input.kind,
    capabilities: [...new Set(input.capabilities)] as GrantCapability[],
    createdAt: new Date(now).toISOString(), expiresAt: new Date(now + hours * 3600000).toISOString(), revokedAt: null, hasSession: session !== null,
  };
  store.addGrant(grant, session);
  return grant;
}

export function authorizeGrant(store: WorkspaceStore, id: string, capability: GrantCapability, target: string): AccessGrant {
  const grant = store.grant(id);
  if (!grant || !isGrantActive(grant)) throw new Error("Access grant is missing, expired, or revoked.");
  let normalized: string;
  if (grant.kind === "web") {
    const url = new URL(target);
    if (url.username || url.password) throw new Error("Credentials in target URLs are not permitted.");
    normalized = url.origin;
  } else normalized = realpathSync(target);
  if (grant.target !== normalized || !grant.capabilities.includes(capability)) throw new Error("The requested capability or target is outside the access grant.");
  return grant;
}

export function isGrantActive(grant: AccessGrant): boolean {
  return grant.revokedAt === null && Date.parse(grant.expiresAt) > Date.now();
}

export function readGrantedSession(store: WorkspaceStore, id: string): unknown {
  const grant = store.grant(id);
  if (!grant || !isGrantActive(grant) || grant.kind !== "web") throw new Error("Access grant is missing, expired, or revoked.");
  const stored = store.encryptedSession(id);
  if (!stored) throw new Error("No browser session was supplied for this grant.");
  return JSON.parse(decryptLocal(store.directory, id, stored)) as unknown;
}
