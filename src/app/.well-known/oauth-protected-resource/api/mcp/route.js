import { config, noStore } from "@/lib/mcp/security";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const c = config();
    return Response.json({ resource: c.resource, authorization_servers: [c.origin], scopes_supported: ["products"], bearer_methods_supported: ["header"] }, { headers: noStore });
  } catch { return Response.json({ error: "MCP is not configured" }, { status: 503 }); }
}
