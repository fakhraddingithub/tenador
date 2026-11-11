import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateMcp, authRequired } from "./auth.js";
import { productServer } from "./products.js";
import { config, noStore } from "./security.js";

// One handler, two endpoints:
//  - /api/mcp (hosted clients: ChatGPT/Codex). Protocol discovery works without a token, and tool
//    handlers ask for OAuth linking through mcp/www_authenticate — how ChatGPT starts linking.
//  - /api/mcp/native (Claude Code and other local clients). Every request without a valid token is
//    a 401 with WWW-Authenticate, the standard MCP signal that starts their OAuth flow.
export async function mcpPost(req, { native = false } = {}) {
  let server;
  try {
    let c;
    try { c = config(); } catch { return Response.json({ error: "MCP is not configured" }, { status: 503 }); }
    const origin = req.headers.get("origin");
    if (origin && ![c.origin, "https://chatgpt.com"].includes(origin)) return new Response("Forbidden", { status: 403 });
    const ctx = await authenticateMcp(req, native);
    // Public protocol discovery contains only tool schemas, never catalog data.
    // Tool handlers signal OAuth linking before any database or upload operation.
    if (!ctx && (native || req.headers.has("authorization"))) return authRequired(native);
    // Bounded streaming read; Content-Length alone is not trustworthy.
    let size = 0; const chunks = [];
    if (!req.body) return new Response("Missing body", { status: 400 });
    for await (const chunk of req.body) {
      size += chunk.length;
      if (size > 800000) return new Response("Payload too large", { status: 413 });
      chunks.push(chunk);
    }
    let parsedBody;
    try { parsedBody = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 }); }
    // One call per HTTP request also keeps audit scopes isolated.
    if (Array.isArray(parsedBody)) return new Response("Batch requests are unsupported", { status: 400 });
    server = productServer(ctx);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    const response = await transport.handleRequest(req, { parsedBody });
    for (const [key, value] of Object.entries(noStore)) response.headers.set(key, value);
    return response;
  } catch {
    return Response.json({ error: "MCP request failed" }, { status: 500, headers: noStore });
  } finally { await server?.close(); }
}
// Stateless request/response transport: no long-lived SSE stream or session to delete.
export async function mcpGet(req, { native = false } = {}) {
  try {
    config();
    if (!(await authenticateMcp(req, native))) return authRequired(native);
    return new Response(null, { status: 405, headers: { ...noStore, Allow: "POST" } });
  } catch { return Response.json({ error: "MCP is not configured" }, { status: 503, headers: noStore }); }
}
