/**
 * GET /api/series/grouped
 *
 * یک batch از بخش‌های گروه‌بندی‌شده‌ی صفحه‌ی سری ریشه (level 0) را
 * بر اساس زیرسری‌های مستقیم برمی‌گرداند (برای infinite scroll).
 *
 * query params:
 *   serieId (الزامی), sportId?, categoryId?
 *   offset (پیش‌فرض 0), limit (پیش‌فرض 2)
 *   minPrice?, maxPrice?, search?
 *   withIndex=1  → فهرست کاملِ بخش‌ها را هم برگردان
 */

import { NextResponse } from "next/server";
import { getSerieGroupedSections } from "base/services/serieGrouped.service";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const serieId = searchParams.get("serieId");

    if (!serieId) {
      return NextResponse.json({ error: "serieId الزامی است" }, { status: 400 });
    }

    const toInt = (v, d) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : d;
    };

    const data = await getSerieGroupedSections({
      serieId,
      sportId: searchParams.get("sportId") || null,
      categoryId: searchParams.get("categoryId") || null,
      offset: toInt(searchParams.get("offset"), 0),
      limit: Math.min(Math.max(toInt(searchParams.get("limit"), 2), 1), 6),
      minPrice: toInt(searchParams.get("minPrice"), 0),
      maxPrice: toInt(searchParams.get("maxPrice"), 0),
      search: searchParams.get("search") || "",
      withIndex: searchParams.get("withIndex") === "1",
    });

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("[api/series/grouped GET]", error);
    return NextResponse.json({ error: "خطا در دریافت بخش‌ها" }, { status: 500 });
  }
}
