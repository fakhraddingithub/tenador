import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const secret = () => randomBytes(32).toString("base64url");
export const digest = (value) => createHash("sha256").update(value).digest("base64url");
export const equal = (a, b) => {
  const x = Buffer.from(String(a ?? "")), y = Buffer.from(String(b ?? ""));
  return x.length === y.length && timingSafeEqual(x, y);
};
const list = value => (value || "").split(",").map(s => s.trim()).filter(Boolean);
// Native apps on the admin's own machine (Claude Code) receive the OAuth code on a loopback
// listener (RFC 8252). Only exact, port-pinned loopback URLs are accepted, and only for the
// native client; the hosted client (ChatGPT/Codex) stays HTTPS-only.
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const loopback = value => {
  const url = new URL(value);
  return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname) && !!url.port && !url.username && !url.password && !url.hash;
};
let nativeWarned = false;
// The native client is optional and isolated: a missing or broken MCP_NATIVE_* setting disables
// only Claude Code access and never takes the hosted connection down with it.
function nativeClient(primaryId) {
  const id = process.env.MCP_NATIVE_CLIENT_ID, secret = process.env.MCP_NATIVE_CLIENT_SECRET;
  if (!id) return null;
  let problem = id === primaryId ? "MCP_NATIVE_CLIENT_ID must differ from MCP_CLIENT_ID"
    : !secret || secret.length < 32 ? "MCP_NATIVE_CLIENT_SECRET must be at least 32 characters" : null;
  const redirects = list(process.env.MCP_NATIVE_REDIRECT_URIS);
  try { if (!problem && !redirects.every(loopback)) problem = "MCP_NATIVE_REDIRECT_URIS must be http://localhost:PORT/... loopback URLs"; }
  catch { problem = "MCP_NATIVE_REDIRECT_URIS contains an invalid URL"; }
  if (problem) {
    if (!nativeWarned) { nativeWarned = true; console.warn(`[mcp] native client disabled: ${problem}`); }
    return null;
  }
  return { id, secret, redirects };
}
export function config() {
  const origin = new URL(process.env.MCP_PUBLIC_ORIGIN || "https://invalid.local").origin;
  const clientId = process.env.MCP_CLIENT_ID;
  const clientSecret = process.env.MCP_CLIENT_SECRET;
  const redirects = list(process.env.MCP_REDIRECT_URIS);
  // Discovery must work before ChatGPT assigns the connection's callback URI.
  // Authorization still fails closed below until an exact redirect is allowlisted.
  if (origin === "https://invalid.local" || !origin.startsWith("https://") || !clientId || !clientSecret || clientSecret.length < 32) {
    throw new Error("MCP is not configured");
  }
  for (const redirect of redirects) {
    const url = new URL(redirect);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("Invalid OAuth redirect configuration");
  }
  const native = nativeClient(clientId);
  const clients = new Map([[clientId, { secret: clientSecret, redirects }]]);
  if (native) clients.set(native.id, { secret: native.secret, redirects: native.redirects });
  const resource = `${origin}/api/mcp`, nativeResource = `${origin}/api/mcp/native`;
  return { origin, clientId, clientSecret, redirects, resource, nativeResource, resources: [resource, nativeResource], clients };
}
// Callers may pass a hand-built config with only clientId/redirects/resource (the original shape).
export const clientOf = (c, id) => c.clients ? c.clients.get(id) : id === c.clientId ? { secret: c.clientSecret, redirects: c.redirects } : undefined;
export const knownResource = (c, value) => (c.resources || [c.resource]).includes(value);
export function validateAuthorization(params, c) {
  const client = clientOf(c, params.get("client_id"));
  if (!client || !client.redirects.includes(params.get("redirect_uri"))) throw new Error("Invalid client or redirect URI");
  if (params.get("response_type") !== "code" || params.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(params.get("code_challenge") || "")) throw new Error("PKCE S256 is required");
  if (params.get("resource") && !knownResource(c, params.get("resource"))) throw new Error("Invalid resource");
  if (params.get("scope") && params.get("scope") !== "products") throw new Error("Invalid scope");
  if ((params.get("state") || "").length > 2048) throw new Error("Invalid state");
  return Object.fromEntries(params);
}
export const noStore = { "Cache-Control": "no-store", Pragma: "no-cache" };
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
