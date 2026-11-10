import { config, noStore } from "@/lib/mcp/security";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { origin } = config();
    return Response.json({ issuer: origin, authorization_endpoint: `${origin}/api/mcp/oauth/authorize`,
      token_endpoint: `${origin}/api/mcp/oauth/token`, revocation_endpoint: `${origin}/api/mcp/oauth/revoke`,
      response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
      code_challenge_methods_supported: ["S256"], scopes_supported: ["products"],
    }, { headers: noStore });
  } catch { return Response.json({ error: "MCP is not configured" }, { status: 503 }); }
}
