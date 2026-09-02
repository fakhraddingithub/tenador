/**
 * src/app/api/admin/sender-addresses/route.js
 *
 * آدرس‌های فرستنده — فهرست و ایجاد.
 *
 * دسترسی:
 *   GET  → orders.view          (هر ادمینی که سفارش می‌بیند باید بتواند چاپ کند؛
 *                               با کلیدِ جدید، ادمین‌های فعلی قابلیتِ چاپ را از
 *                               دست می‌دادند)
 *   POST → orders.manageSenders (قابلیتِ تازه — عمداً کلیدِ مستقل)
 *
 * ⚠️ هیچ روتِ عمومی‌ای (سایت / داشبورد کاربر) به این کالکشن دسترسی ندارد.
 * ⚠️ این مسیر هیچ‌وقت هیچ سفارشی را نمی‌خواند و نمی‌نویسد.
 */

import { NextResponse } from "next/server";

import connectToDB from "base/configs/db";
import "base/models/registerModels";
import SenderAddress from "base/models/SenderAddress";

import requireAdminPermission from "@/lib/requireAdminPermission";
import {
  firstSenderAddressError,
  normalizeSenderAddress,
  validateSenderAddress,
} from "@/lib/senderAddressForm.mjs";

/** فیلدهایی که به کلاینت برمی‌گردند — `createdBy` بیرون نمی‌رود. */
const PUBLIC_FIELDS = "title fullName phone province city addressLine postalCode updatedAt";

export async function GET() {
  const { denied } = await requireAdminPermission("orders.view");
  if (denied) return denied;

  try {
    await connectToDB();
    const addresses = await SenderAddress.find({})
      .select(PUBLIC_FIELDS)
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({ addresses }, { status: 200 });
  } catch (error) {
    console.error("[admin/sender-addresses GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}

export async function POST(req) {
  const { actor: admin, denied } = await requireAdminPermission("orders.manageSenders");
  if (denied) return denied;

  try {
    await connectToDB();

    const body = await req.json().catch(() => ({}));
    const errors = validateSenderAddress(body);
    if (Object.keys(errors).length) {
      return NextResponse.json(
        { message: firstSenderAddressError(errors), errors },
        { status: 400 }
      );
    }

    const created = await SenderAddress.create({
      ...normalizeSenderAddress(body),
      createdBy: admin.userId,
    });

    const address = await SenderAddress.findById(created._id)
      .select(PUBLIC_FIELDS)
      .lean();

    return NextResponse.json(
      { message: "آدرس فرستنده ذخیره شد", address },
      { status: 201 }
    );
  } catch (error) {
    console.error("[admin/sender-addresses POST]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
