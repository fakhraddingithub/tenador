import "base/models/registerModels";
import connectToDB from "base/configs/db";
import McpGrant from "base/models/McpGrant";
import { resolveAdminContextForUser } from "@/lib/adminContext";
import { config, digest, noStore } from "./security.js";

export async function authenticateMcp(req) {
  const c = config();
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.get("authorization") || "");
  if (!match) return null;
  await connectToDB();
  const grant = await McpGrant.findOne({ key: digest(match[1]), kind: "access", expiresAt: { $gt: new Date() }, "data.resource": c.resource }).lean();
  if (!grant) return null;
  const ctx = await resolveAdminContextForUser(grant.userId);
  return ctx?.isAdmin ? ctx : null;
}
export function authRequired() {
  return Response.json({ error: "unauthorized" }, { status: 401, headers: { ...noStore,
    "WWW-Authenticate": `Bearer resource_metadata="${config().origin}/.well-known/oauth-protected-resource/api/mcp"`,
  } });
}
