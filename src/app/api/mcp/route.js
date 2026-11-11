import { mcpGet, mcpPost } from "@/lib/mcp/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

// Hosted clients (ChatGPT/Codex): anonymous discovery, OAuth linking from tool results.
export const POST = req => mcpPost(req);
export const GET = req => mcpGet(req);
export async function DELETE() { return new Response(null, { status: 405, headers: { Allow: "POST" } }); }
