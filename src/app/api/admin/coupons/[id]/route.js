/**
 * src/app/api/admin/coupons/[id]/route.js
 *
 * PATCH  → ویرایش کد تخفیف (شامل فعال/غیرفعال‌سازی)
 * DELETE → حذف کد تخفیف
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Coupon from "base/models/Coupon";
import { parseIranDateTimeLocal } from "@/lib/iranDateTime";

const CODE_REGEX = /^[A-Z0-9_-]{3,30}$/;

export async function PATCH(req, { params }) {
  try {
    await connectToDB();

    const { id } = await params;
    const body = await req.json();

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return NextResponse.json(
        { error: "کد تخفیف یافت نشد" },
        { status: 404 }
      );
    }

    // ─── کد (یکتا و با فرمت معتبر) ───
    if (body.code !== undefined) {
      const code = String(body.code).trim().toUpperCase();

      if (!CODE_REGEX.test(code)) {
        return NextResponse.json(
          {
            error:
              "کد تخفیف باید ۳ تا ۳۰ کاراکتر و فقط شامل حروف انگلیسی بزرگ، عدد، خط تیره و زیرخط باشد",
          },
          { status: 422 }
        );
      }

      const duplicate = await Coupon.findOne({ code, _id: { $ne: id } });
      if (duplicate) {
        return NextResponse.json(
          { error: "کدی با این عنوان قبلاً ثبت شده است" },
          { status: 409 }
        );
      }

      coupon.code = code;
    }

    // ─── مقدار تخفیف ───
    if (body.discount !== undefined) {
      const kind = body.discount?.kind;
      const value = Number(body.discount?.value);

      if (!["percent", "amount"].includes(kind)) {
        return NextResponse.json(
          { error: "نوع تخفیف معتبر نیست" },
          { status: 422 }
        );
      }
      if (!value || value <= 0) {
        return NextResponse.json(
          { error: "مقدار تخفیف باید بزرگ‌تر از صفر باشد" },
          { status: 422 }
        );
      }
      if (kind === "percent" && value > 100) {
        return NextResponse.json(
          { error: "درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد" },
          { status: 422 }
        );
      }

      coupon.discount = { kind, value };
    }

    // ─── بازه زمانی ───
    if (body.startAt !== undefined) {
      const startAt = parseIranDateTimeLocal(body.startAt);
      if (!startAt) {
        return NextResponse.json(
          { error: "تاریخ شروع معتبر نیست" },
          { status: 422 }
        );
      }
      coupon.startAt = startAt;
    }

    if (body.endAt !== undefined) {
      const endAt = parseIranDateTimeLocal(body.endAt);
      if (!endAt) {
        return NextResponse.json(
          { error: "تاریخ پایان معتبر نیست" },
          { status: 422 }
        );
      }
      coupon.endAt = endAt;
    }

    if (coupon.endAt <= coupon.startAt) {
      return NextResponse.json(
        { error: "تاریخ پایان باید بعد از تاریخ شروع باشد" },
        { status: 422 }
      );
    }

    // ─── محدودیت‌ها ───
    if (body.usageLimit !== undefined) {
      coupon.usageLimit = body.usageLimit ? Number(body.usageLimit) : null;
    }

    if (body.perUserLimit !== undefined) {
      coupon.perUserLimit =
        body.perUserLimit === null || body.perUserLimit === ""
          ? null
          : Number(body.perUserLimit);
    }

    if (body.minCartValue !== undefined) {
      coupon.minCartValue = Number(body.minCartValue) || 0;
    }

    if (body.active !== undefined) {
      coupon.active = !!body.active;
    }

    // ─── محدوده اعمال ───
    if (body.applicableTo !== undefined) {
      if (!["all", "category", "brand", "product"].includes(body.applicableTo)) {
        return NextResponse.json(
          { error: "محدوده اعمال کد معتبر نیست" },
          { status: 422 }
        );
      }

      if (
        body.applicableTo !== "all" &&
        (!Array.isArray(body.targets) || body.targets.length === 0)
      ) {
        return NextResponse.json(
          { error: "برای محدوده انتخاب‌شده حداقل یک هدف انتخاب کنید" },
          { status: 422 }
        );
      }

      coupon.applicableTo = body.applicableTo;
      coupon.targets = body.applicableTo === "all" ? [] : body.targets || [];
    } else if (body.targets !== undefined && coupon.applicableTo !== "all") {
      coupon.targets = body.targets || [];
    }

    await coupon.save();

    return NextResponse.json(
      { message: "کد تخفیف به‌روزرسانی شد", coupon },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PATCH coupon]", error);

    if (error.code === 11000) {
      return NextResponse.json(
        { error: "کدی با این عنوان قبلاً ثبت شده است" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "خطا در ویرایش کد تخفیف" },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectToDB();

    const { id } = await params;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return NextResponse.json(
        { error: "کد تخفیف یافت نشد" },
        { status: 404 }
      );
    }

    await Coupon.findByIdAndDelete(id);

    return NextResponse.json(
      { message: "کد تخفیف حذف شد" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DELETE coupon]", error);
    return NextResponse.json(
      { error: "خطا در حذف کد تخفیف" },
      { status: 500 }
    );
  }
}
