import { timingSafeEqual } from "node:crypto";
import connectToDB from "base/configs/db";
import { runProductJobStage } from "@/lib/productJobs/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(req) {
  const expected = process.env.PRODUCT_JOBS_WORKER_SECRET;
  const provided = req.headers.get("authorization") || "";
  const match = expected && Buffer.from(`Bearer ${expected}`);
  if (!match || match.length !== Buffer.byteLength(provided) || !timingSafeEqual(match, Buffer.from(provided))) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    await connectToDB();
    return Response.json(await runProductJobStage(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Product worker unavailable" }, { status: 503 });
  }
}
