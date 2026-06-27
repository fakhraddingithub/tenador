/**
 * src/app/api/brands/grouped/route.js
 *
 * GET — یک batch از بخش‌های گروه‌بندی‌شده‌ی صفحه‌ی برند (بر اساس سری ریشه) را
 * برای بارگذاری تدریجی (infinite scroll) برمی‌گرداند.
 *
 * query params:
 *   brandId (الزامی), sportId?, categoryId?
 *   offset (پیش‌فرض 0), limit (پیش‌فرض 2)
 *   minPrice?, maxPrice?, search?
 *   withIndex=1  → فهرست کاملِ بخش‌ها (برای نویگیشن سری‌ها) را هم برگردان
 *
 * محاسبه و کش در services/brandGrouped.service.js انجام می‌شود.
 */

import { NextResponse } from "next/server";
import { getBrandGroupedSections } from "base/services/brandGrouped.service";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const brandId = searchParams.get("brandId");
    if (!brandId) {
      return NextResponse.json({ error: "brandId الزامی است" }, { status: 400 });
    }

    const toInt = (v, d) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : d;
    };

    const data = await getBrandGroupedSections({
      brandId,
      sportId: searchParams.get("sportId") || null,
      categoryId: searchParams.get("categoryId") || null,
      gender: searchParams.get("gender") || null,
      offset: toInt(searchParams.get("offset"), 0),
      limit: Math.min(Math.max(toInt(searchParams.get("limit"), 2), 1), 6),
      minPrice: toInt(searchParams.get("minPrice"), 0),
      maxPrice: toInt(searchParams.get("maxPrice"), 0),
      search: searchParams.get("search") || "",
      withIndex: searchParams.get("withIndex") === "1",
    });

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("[api/brands/grouped GET]", error);
    return NextResponse.json({ error: "خطا در دریافت بخش‌ها" }, { status: 500 });
  }
}
