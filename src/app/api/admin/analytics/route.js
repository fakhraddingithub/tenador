/**
 * GET /api/admin/analytics
 *
 * داشبورد تحلیل مالی و هوش فروش — همه‌ی معیارها برای بازه‌ی [from, to].
 *
 * Query params:
 *   from = ISO date (اختیاری — پیش‌فرض ۳۰ روز گذشته)
 *   to   = ISO date (اختیاری — پیش‌فرض اکنون)
 *
 * مقایسه با «بازه‌ی قبلیِ هم‌طول» به‌صورت خودکار محاسبه می‌شود.
 */

import { NextResponse } from "next/server";
import requireAdmin from "@/lib/requireAdmin";
import { computeAnalytics } from "base/services/analyticsService";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value, fallback) {
  if (!value) return fallback;
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : d;
}

export async function GET(req) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ message: "احراز هویت ادمین لازم است" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const now = new Date();

    const to = parseDate(searchParams.get("to"), now);
    const from = parseDate(searchParams.get("from"), new Date(now.getTime() - 30 * DAY_MS));

    if (from.getTime() > to.getTime()) {
      return NextResponse.json({ message: "بازه‌ی تاریخ نامعتبر است" }, { status: 400 });
    }

    const data = await computeAnalytics({ from, to });
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("[admin/analytics GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
