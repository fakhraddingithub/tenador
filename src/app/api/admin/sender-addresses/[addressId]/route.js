/**
 * src/app/api/admin/sender-addresses/[addressId]/route.js
 *
 * ویرایش و حذفِ یک آدرسِ فرستنده. هر دو `orders.manageSenders` می‌خواهند.
 *
 * حذف واقعاً حذف می‌کند: این آدرس هیچ‌جا ارجاع نشده (روی سفارش ذخیره نمی‌شود)،
 * پس چیزی dangling نمی‌ماند. برگه‌ی چاپی که قبلاً گرفته شده هم کاغذ است.
 */

import { NextResponse } from "next/server";
import mongoose from "mongoose";

import connectToDB from "base/configs/db";
import "base/models/registerModels";
import SenderAddress from "base/models/SenderAddress";

import requireAdminPermission from "@/lib/requireAdminPermission";
import {
  firstSenderAddressError,
  normalizeSenderAddress,
  validateSenderAddress,
} from "@/lib/senderAddressForm.mjs";

const PUBLIC_FIELDS = "title fullName phone province city addressLine postalCode updatedAt";

export async function PATCH(req, { params }) {
  const { denied } = await requireAdminPermission("orders.manageSenders");
  if (denied) return denied;

  try {
    await connectToDB();

    const { addressId } = await params;
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return NextResponse.json({ message: "شناسه آدرس نامعتبر است" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const errors = validateSenderAddress(body);
    if (Object.keys(errors).length) {
      return NextResponse.json(
        { message: firstSenderAddressError(errors), errors },
        { status: 400 }
      );
    }

    // ⚠️ `save()` و نه `updateOne` — تا هوک‌های اسکیما و پلاگینِ ممیزی (که
    // مقدارِ قبل/بعد را از init می‌گیرد) واقعاً اجرا شوند.
    const doc = await SenderAddress.findById(addressId);
    if (!doc) {
      return NextResponse.json({ message: "آدرس فرستنده یافت نشد" }, { status: 404 });
    }

    Object.assign(doc, normalizeSenderAddress(body));
    await doc.save();

    const address = await SenderAddress.findById(addressId).select(PUBLIC_FIELDS).lean();
    return NextResponse.json({ message: "آدرس فرستنده ویرایش شد", address }, { status: 200 });
  } catch (error) {
    console.error("[admin/sender-addresses/:id PATCH]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const { denied } = await requireAdminPermission("orders.manageSenders");
  if (denied) return denied;

  try {
    await connectToDB();

    const { addressId } = await params;
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return NextResponse.json({ message: "شناسه آدرس نامعتبر است" }, { status: 400 });
    }

    const doc = await SenderAddress.findById(addressId);
    if (!doc) {
      return NextResponse.json({ message: "آدرس فرستنده یافت نشد" }, { status: 404 });
    }
    await doc.deleteOne();

    return NextResponse.json({ message: "آدرس فرستنده حذف شد" }, { status: 200 });
  } catch (error) {
    console.error("[admin/sender-addresses/:id DELETE]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
