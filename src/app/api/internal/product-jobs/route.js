export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Retired: stale daemons must never invoke a model.
export async function POST() {
  return Response.json({ disabled: true, executionMode: "codex_agents", message: "Use Tenador in Codex. Stop the product worker." }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
