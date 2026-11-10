import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const secret = () => randomBytes(32).toString("base64url");
export const digest = (value) => createHash("sha256").update(value).digest("base64url");
export const equal = (a, b) => {
  const x = Buffer.from(String(a ?? "")), y = Buffer.from(String(b ?? ""));
  return x.length === y.length && timingSafeEqual(x, y);
};
export function config() {
  const origin = new URL(process.env.MCP_PUBLIC_ORIGIN || "https://invalid.local").origin;
  const clientId = process.env.MCP_CLIENT_ID;
  const clientSecret = process.env.MCP_CLIENT_SECRET;
  const redirects = (process.env.MCP_REDIRECT_URIS || "").split(",").map(s => s.trim()).filter(Boolean);
  // Discovery must work before ChatGPT assigns the connection's callback URI.
  // Authorization still fails closed below until an exact redirect is allowlisted.
  if (origin === "https://invalid.local" || !origin.startsWith("https://") || !clientId || !clientSecret || clientSecret.length < 32) {
    throw new Error("MCP is not configured");
  }
  for (const redirect of redirects) {
    const url = new URL(redirect);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("Invalid OAuth redirect configuration");
  }
  return { origin, clientId, clientSecret, redirects, resource: `${origin}/api/mcp` };
}
export function validateAuthorization(params, c) {
  if (params.get("client_id") !== c.clientId || !c.redirects.includes(params.get("redirect_uri"))) throw new Error("Invalid client or redirect URI");
  if (params.get("response_type") !== "code" || params.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(params.get("code_challenge") || "")) throw new Error("PKCE S256 is required");
  if (params.get("resource") && params.get("resource") !== c.resource) throw new Error("Invalid resource");
  if (params.get("scope") && params.get("scope") !== "products") throw new Error("Invalid scope");
  if ((params.get("state") || "").length > 2048) throw new Error("Invalid state");
  return Object.fromEntries(params);
}
export const noStore = { "Cache-Control": "no-store", Pragma: "no-cache" };
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
