import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import { getFilterableAttributes } from "base/services/product.service";
import { buildAttributeMeta } from "@/lib/attributeFilters";

// GET /api/admin/events/attribute-options
// متادیتای ویژگی‌های «قابل فیلتر» (به همراه گزینه‌های موجود) را برای فرمِ کمپین
// برمی‌گرداند تا ادمین با همان دکمه‌های فروشگاه (شاملِ گریدِ ۱۶ رنگ) محصول انتخاب کند.
export async function GET() {
  await connectToDB();

  const [filterable, products] = await Promise.all([
    getFilterableAttributes(),
    Product.find({ isActive: true }).select("attributes").lean(),
  ]);

  const meta = buildAttributeMeta(filterable, products);
  return NextResponse.json({ meta });
}
