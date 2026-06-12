/**
 * src/app/api/admin/quantity-discounts/route.js
 *
 * GET  → لیست تخفیف‌های تعدادی (با اطلاعات محصول)
 * POST → ساخت تخفیف تعدادی جدید برای یک محصول
 *
 * اعمال تخفیف هنگام خرید در priceEngine (loadQuantityDiscountMap /
 * quantityTierFor) انجام می‌شود؛ این روت‌ها فقط مدیریت ادمین هستند.
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import QuantityDiscount from "base/models/QuantityDiscount";
import Product from "base/models/Product";
import { revalidateContent } from "@/lib/revalidate";
import {
  validateQuantityDiscountPayload,
  normalizeTiers,
} from "@/lib/quantityDiscountValidation";

export async function GET() {
  try {
    await connectToDB();

    const items = await QuantityDiscount.find({})
      .populate("product", "name mainImage sku basePrice")
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

    const product = await Product.findById(body.product).select("_id name");
    if (!product) {
      return NextResponse.json(
        { message: "محصول انتخاب‌شده یافت نشد" },
        { status: 404 }
      );
    }

    const duplicate = await QuantityDiscount.findOne({ product: product._id });
    if (duplicate) {
      return NextResponse.json(
        { message: "برای این محصول قبلاً تخفیف تعدادی تعریف شده است؛ همان را ویرایش کنید" },
        { status: 409 }
      );
    }

    const created = await QuantityDiscount.create({
      product: product._id,
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
