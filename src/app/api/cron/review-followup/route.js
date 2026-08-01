import { NextResponse } from "next/server";
import { runReviewFollowUps } from "base/workers/reviewFollowUpWorker";

// nodemailer/web-push به crypto نیتیو نیاز دارند → حتماً روی Node اجرا شود (نه Edge)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/review-followup
 * فقط توسط Vercel Cron فراخوانی می‌شود (هدر Authorization با CRON_SECRET).
 */
export async function GET(req) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runReviewFollowUps();
  return NextResponse.json({ ok: true, ...result });
}
