/**
 * src/app/api/admin/quantity-discounts/route.js
 *
 * GET  → لیست قوانین تخفیف تعدادی
 * POST → ساخت قانون تخفیف تعدادی جدید
 *
 * قوانین تخفیف تعدادی مانند قوانین تخفیف معمولی بر اساس نوع هدف
 * (global / product / brand / serie / category) اعمال می‌شوند.
 * اعمال هنگام خرید در priceEngine (loadQuantityDiscountMap) انجام می‌شود.
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import QuantityDiscount from "base/models/QuantityDiscount";
import { revalidateContent } from "@/lib/revalidate";
import {
  validateQuantityDiscountPayload,
  normalizeTiers,
} from "@/lib/quantityDiscountValidation";

export async function GET() {
  try {
    await connectToDB();

    const items = await QuantityDiscount.find({})
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET quantity-discounts error:", error);
    return NextResponse.json(
      { message: "خطا در دریافت تخفیف‌های تعدادی" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await connectToDB();
    const body = await req.json();

    const errors = validateQuantityDiscountPayload(body);
    if (errors.length) {
      return NextResponse.json({ message: errors[0], errors }, { status: 400 });
    }

    const created = await QuantityDiscount.create({
      type: body.type,
      targets: body.type !== "global" ? (body.targets || []) : [],
      title: String(body.title || "").trim(),
      tiers: normalizeTiers(body.tiers),
      active: body.active !== false,
      startAt: body.startAt ? new Date(body.startAt) : null,
      endAt: body.endAt ? new Date(body.endAt) : null,
    });

    revalidateContent(["products"]);

    return NextResponse.json(
      { message: "تخفیف تعدادی ایجاد شد", item: created },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST quantity-discounts error:", error);
    return NextResponse.json(
      { message: "خطا در ایجاد تخفیف تعدادی" },
      { status: 500 }
    );
  }
}
