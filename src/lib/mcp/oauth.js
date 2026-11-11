import "base/models/registerModels";
import connectToDB from "base/configs/db";
import McpGrant from "base/models/McpGrant";
import { resolveAdminContextForUser } from "@/lib/adminContext";
import { config, digest, equal, secret, noStore, clientOf, knownResource } from "./security.js";

// Returns the authenticated client's id, or null.
export function clientAuthenticated(req, form, c) {
  let id = form.get("client_id"), password = form.get("client_secret");
  const basic = /^Basic (.+)$/i.exec(req.headers.get("authorization") || "");
  if (basic) {
    const text = Buffer.from(basic[1], "base64").toString();
    const colon = text.indexOf(":");
    id = decodeURIComponent(text.slice(0, colon)); password = decodeURIComponent(text.slice(colon + 1));
  }
  const client = clientOf(c, String(id ?? ""));
  return client && equal(password, client.secret) ? String(id) : null;
}
// Tokens issued before the native client existed carry no client_id; they belong to the hosted client.
const ownedBy = (client, c) => client === c.clientId
  ? { $or: [{ "data.client_id": client }, { "data.client_id": { $exists: false } }] }
  : { "data.client_id": client };
export async function tokenRequest(req, revoke = false) {
  try {
    const c = config(), form = await req.formData();
    const client = clientAuthenticated(req, form, c);
    if (!client) return Response.json({ error: "invalid_client" }, { status: 401, headers: noStore });
    await connectToDB();
    if (revoke) {
      const token = await McpGrant.findOne({ key: digest(String(form.get("token") || "")), kind: { $in: ["access", "refresh"] }, ...ownedBy(client, c) }).lean();
      if (token) await McpGrant.deleteMany({ userId: token.userId, "data.family": token.data.family, kind: { $in: ["access", "refresh"] } });
      return new Response(null, { status: 200, headers: noStore });
    }
    const requested = form.get("resource");
    if (requested && !knownResource(c, requested)) throw new Error("resource");
    const refresh = form.get("grant_type") === "refresh_token";
    if (!refresh && form.get("grant_type") !== "authorization_code") throw new Error("grant");
    const query = { key: digest(String(form.get(refresh ? "refresh_token" : "code") || "")), kind: refresh ? "refresh" : "code", expiresAt: { $gt: new Date() } };
    if (!refresh) {
      const verifier = String(form.get("code_verifier") || "");
      if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) throw new Error("verifier");
      query["data.code_challenge"] = digest(verifier);
      query["data.redirect_uri"] = form.get("redirect_uri");
      query["data.client_id"] = client;
    } else Object.assign(query, ownedBy(client, c));
    const grant = await McpGrant.findOneAndDelete(query);
    if (!grant) throw new Error("grant");
    // The token is bound to one resource: the one approved at authorization, else the one asked
    // for now, else the hosted endpoint (the only one that existed before /api/mcp/native).
    const resource = grant.data.resource || requested || c.resource;
    if (requested && requested !== resource) throw new Error("resource");
    const ctx = await resolveAdminContextForUser(grant.userId);
    if (!ctx?.isAdmin) throw new Error("admin");
    const access = secret(), nextRefresh = secret();
    const data = { resource, family: grant.data.family || secret(), client_id: client };
    await McpGrant.create([
      { key: digest(access), kind: "access", userId: grant.userId, data, expiresAt: new Date(Date.now() + 3600000) },
      { key: digest(nextRefresh), kind: "refresh", userId: grant.userId, data, expiresAt: new Date(Date.now() + 30 * 86400000) },
    ]);
    return Response.json({ access_token: access, refresh_token: nextRefresh, token_type: "Bearer", expires_in: 3600, scope: "products" }, { headers: noStore });
  } catch { return Response.json({ error: "invalid_grant" }, { status: 400, headers: noStore }); }
}
