/**
 * src/app/api/admin/quantity-discounts/[id]/route.js
 *
 * PATCH  → ویرایش جزئی (پله‌ها، نوع هدف، وضعیت، بازه زمانی)
 * DELETE → حذف قانون تخفیف تعدادی
 */

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import QuantityDiscount from "base/models/QuantityDiscount";
import { revalidateContent } from "@/lib/revalidate";
import {
  validateQuantityDiscountPayload,
  normalizeTiers,
} from "@/lib/quantityDiscountValidation";

export async function PATCH(req, { params }) {
  try {
    await connectToDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "شناسه معتبر نیست" }, { status: 400 });
    }

    const item = await QuantityDiscount.findById(id);
    if (!item) {
      return NextResponse.json(
        { message: "تخفیف تعدادی یافت نشد" },
        { status: 404 }
      );
    }

    const body = await req.json();

    const errors = validateQuantityDiscountPayload(body, { partial: true });
    if (errors.length) {
      return NextResponse.json({ message: errors[0], errors }, { status: 400 });
    }

    if (body.type !== undefined) item.type = body.type;
    if (body.targets !== undefined)
      item.targets = item.type !== "global" ? (body.targets || []) : [];
    if (body.title !== undefined) item.title = String(body.title || "").trim();
    if (body.tiers !== undefined) item.tiers = normalizeTiers(body.tiers);
    if (body.active !== undefined) item.active = Boolean(body.active);
    if (body.startAt !== undefined)
      item.startAt = body.startAt ? new Date(body.startAt) : null;
    if (body.endAt !== undefined)
      item.endAt = body.endAt ? new Date(body.endAt) : null;

    await item.save();

    revalidateContent(["products"]);

    return NextResponse.json({ message: "به‌روزرسانی شد", item });
  } catch (error) {
    console.error("PATCH quantity-discount error:", error);
    return NextResponse.json(
      { message: "خطا در به‌روزرسانی تخفیف تعدادی" },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectToDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "شناسه معتبر نیست" }, { status: 400 });
    }

    const deleted = await QuantityDiscount.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json(
        { message: "تخفیف تعدادی یافت نشد" },
        { status: 404 }
      );
    }

    revalidateContent(["products"]);

    return NextResponse.json({ message: "حذف شد" });
  } catch (error) {
    console.error("DELETE quantity-discount error:", error);
    return NextResponse.json(
      { message: "خطا در حذف تخفیف تعدادی" },
      { status: 500 }
    );
  }
}
