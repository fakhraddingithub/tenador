/**
 * GET /api/admin/stats
 *
 * شمارشِ موجودیت‌های اصلی برای کارت‌های داشبوردِ پنل مدیریت.
 *
 * پیش‌تر داشبورد پنج اندپوینتِ لیست (/api/sports، /api/brands، /api/athletes،
 * /api/product، /api/categories) را صدا می‌زد و فقط `.length` آن‌ها را می‌خواند —
 * یعنی کلِ کالکشن‌ها (با populate) از دیتابیس خوانده و سریالایز می‌شد تا پنج عدد
 * نمایش داده شود. ضمناً چون /api/product برای غیرِ ادمین صفحه‌بندی نمی‌شود،
 * عددِ محصولات هم نادرست بود.
 *
 * این اندپوینت همان پنج عدد را با countDocuments (کوئریِ index-only) برمی‌گرداند.
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Sport from "base/models/Sport";
import Brand from "base/models/Brand";
import Athlete from "base/models/Athlete";
import Product from "base/models/Product";
import Category from "base/models/Category";
import requireAdminPermission from "@/lib/requireAdminPermission";

export async function GET() {
  const { denied } = await requireAdminPermission("dashboard.view");
  if (denied) return denied;

  try {
    await connectToDB();

    const [sports, brands, athletes, products, categories] = await Promise.all([
      Sport.countDocuments({}),
      Brand.countDocuments({}),
      Athlete.countDocuments({}),
      Product.countDocuments({}),
      Category.countDocuments({}),
    ]);

    return NextResponse.json(
      { sports, brands, athletes, products, categories },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/stats GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
