/**
 * /api/admin/instagram/debug
 *
 * ابزارِ تشخیصیِ موقت: آخرین فراخوانی‌های وبهوک را نشان می‌دهد تا بدون دیدنِ
 * لاگ‌های سرور، از مرورگر بفهمیم آیا متا endpoint را صدا زده، امضا درست بوده،
 * و چه ساختاری فرستاده است. پس از حلِ مشکل می‌توان این مسیر و مدلِ
 * InstagramWebhookLog را حذف کرد.
 *
 * GET → { count, hits: [...] }  (جدیدترین اول)
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import InstagramWebhookLog from "base/models/InstagramWebhookLog";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await connectToDB();

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 25, 100);

    const hits = await InstagramWebhookLog.find({})
      .sort({ receivedAt: -1 })
      .limit(limit)
      .lean();

    const total = await InstagramWebhookLog.estimatedDocumentCount();

    return NextResponse.json(
      {
        totalWebhookHitsEver: total,
        showing: hits.length,
        note:
          hits.length === 0
            ? "هیچ فراخوانیِ وبهوکی ثبت نشده — یعنی متا هنوز این endpoint را صدا نزده است."
            : "هر سند یک فراخوانیِ POST از سمت متاست (جدیدترین اول).",
        hits,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/instagram/debug GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
