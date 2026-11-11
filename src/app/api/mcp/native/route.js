import { mcpGet, mcpPost } from "@/lib/mcp/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

// Local clients (Claude Code): every request needs a token; a 401 starts their OAuth flow.
export const POST = req => mcpPost(req, { native: true });
export const GET = req => mcpGet(req, { native: true });
export async function DELETE() { return new Response(null, { status: 405, headers: { Allow: "POST" } }); }
