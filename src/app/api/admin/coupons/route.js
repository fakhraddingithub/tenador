/**
 * src/app/api/admin/coupons/route.js
 *
 * GET  → لیست کدهای تخفیف + تعداد استفاده هر کد (از روی سفارش‌ها)
 * POST → ساخت کد تخفیف جدید
 *
 * اعتبارسنجی و اعمال کد در زمان خرید از قبل در priceEngine (validateCoupon /
 * computeCartPrice) انجام می‌شود؛ این روت‌ها فقط مدیریت ادمین هستند.
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Coupon from "base/models/Coupon";
import Order from "base/models/Order";
import { parseIranDateTimeLocal } from "@/lib/iranDateTime";

// کد معتبر: حروف انگلیسی، عدد، خط تیره و زیرخط — ۳ تا ۳۰ کاراکتر
const CODE_REGEX = /^[A-Z0-9_-]{3,30}$/;

function validateCouponPayload(body, { partial = false } = {}) {
  const errors = [];
  let parsedStartAt = null;
  let parsedEndAt = null;

  if (!partial || body.code !== undefined) {
    const code = String(body.code || "").trim().toUpperCase();
    if (!CODE_REGEX.test(code)) {
      errors.push(
        "کد تخفیف باید ۳ تا ۳۰ کاراکتر و فقط شامل حروف انگلیسی بزرگ، عدد، خط تیره و زیرخط باشد"
      );
    }
  }

  if (!partial || body.discount !== undefined) {
    const kind = body.discount?.kind;
    const value = Number(body.discount?.value);
    if (!["percent", "amount"].includes(kind)) {
      errors.push("نوع تخفیف معتبر نیست");
    } else if (!value || value <= 0) {
      errors.push("مقدار تخفیف باید بزرگ‌تر از صفر باشد");
    } else if (kind === "percent" && value > 100) {
      errors.push("درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد");
    }
  }

  if (!partial || body.startAt !== undefined || body.endAt !== undefined) {
    parsedStartAt = parseIranDateTimeLocal(body.startAt);
    parsedEndAt = parseIranDateTimeLocal(body.endAt);
    if (!parsedStartAt || !parsedEndAt) {
      errors.push("تاریخ شروع و پایان الزامی و معتبر هستند");
    } else if (parsedEndAt <= parsedStartAt) {
      errors.push("تاریخ پایان باید بعد از تاریخ شروع باشد");
    }
  }

  if (body.applicableTo !== undefined) {
    if (!["all", "category", "brand", "product"].includes(body.applicableTo)) {
      errors.push("محدوده اعمال کد معتبر نیست");
    } else if (
      body.applicableTo !== "all" &&
      (!Array.isArray(body.targets) || body.targets.length === 0)
    ) {
      errors.push("برای محدوده انتخاب‌شده حداقل یک هدف انتخاب کنید");
    }
  }

  return { errors, parsedStartAt, parsedEndAt };
}

export async function GET() {
  try {
    await connectToDB();

    const coupons = await Coupon.find({}).sort({ createdAt: -1 }).lean();

    // تعداد استفاده هر کد از روی سفارش‌های ثبت‌شده
    const usage = await Order.aggregate([
      { $match: { "coupon.code": { $nin: [null, ""] } } },
      { $group: { _id: "$coupon.code", count: { $sum: 1 } } },
    ]);
    const usageMap = new Map(usage.map((u) => [u._id, u.count]));

    const couponsWithUsage = coupons.map((c) => ({
      ...c,
      usedCount: usageMap.get(c.code) || 0,
    }));

    return NextResponse.json({ coupons: couponsWithUsage }, { status: 200 });
  } catch (error) {
    console.error("[GET coupons]", error);
    return NextResponse.json(
      { error: "خطا در دریافت کدهای تخفیف" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await connectToDB();

    const body = await req.json();

    const { errors, parsedStartAt, parsedEndAt } = validateCouponPayload(body);
    if (errors.length) {
      return NextResponse.json({ error: errors[0] }, { status: 422 });
    }

    const code = String(body.code).trim().toUpperCase();

    const duplicate = await Coupon.findOne({ code });
    if (duplicate) {
      return NextResponse.json(
        { error: "کدی با این عنوان قبلاً ثبت شده است" },
        { status: 409 }
      );
    }

    const coupon = await Coupon.create({
      code,
      discount: {
        kind: body.discount.kind,
        value: Number(body.discount.value),
      },
      startAt: parsedStartAt,
      endAt: parsedEndAt,
      usageLimit: body.usageLimit ? Number(body.usageLimit) : null,
      perUserLimit:
        body.perUserLimit === null || body.perUserLimit === ""
          ? null
          : Number(body.perUserLimit ?? 1),
      minCartValue: Number(body.minCartValue) || 0,
      active: body.active !== undefined ? !!body.active : true,
      applicableTo: body.applicableTo || "all",
      targets:
        body.applicableTo && body.applicableTo !== "all"
          ? body.targets || []
          : [],
    });

    return NextResponse.json(
      { message: "کد تخفیف با موفقیت ایجاد شد", coupon },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST coupons]", error);

    if (error.code === 11000) {
      return NextResponse.json(
        { error: "کدی با این عنوان قبلاً ثبت شده است" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "خطای داخلی سرور در ایجاد کد تخفیف" },
      { status: 500 }
    );
  }
}
