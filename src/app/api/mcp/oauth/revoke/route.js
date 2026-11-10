import { tokenRequest } from "@/lib/mcp/oauth";
export const runtime = "nodejs";
export async function POST(req) { return tokenRequest(req, true); }
