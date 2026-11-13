/**
 * src/app/api/admin/orders/customers/route.js
 *
 * انتخابگرِ مشتری و آدرس برای «ایجاد سفارش» در پنل ادمین.
 *
 *   GET  ?q=…        → جستجوی کاربر (نام، تلفن، ایمیل)
 *   GET  ?userId=…   → آدرس‌های همان کاربر
 *   POST             → ساختِ آدرسِ جدید برای کاربر (در آدرس‌های خودِ او ذخیره می‌شود)
 *
 * کلید: orders.create — نه users.view، وگرنه ساختِ سفارش به دیدنِ کلِ پایگاهِ
 * کاربران گره می‌خورد (همان منطقِ admins/candidates).
 */

import "base/models/registerModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import User from "base/models/User";
import Address from "base/models/Address";
import requireAdminPermission from "@/lib/requireAdminPermission";
import { withSearch } from "@/lib/search";
import { firstAddressError, normalizePhoneInput, validateAddressPayload } from "@/lib/addressForm.mjs";

export async function GET(req) {
  const { denied } = await requireAdminPermission("orders.create");
  if (denied) return denied;
  try {
    await connectToDB();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (userId) {
      if (!mongoose.isValidObjectId(userId)) {
        return NextResponse.json({ message: "شناسه کاربر نامعتبر است" }, { status: 400 });
      }
      const addresses = await Address.find({ user: userId })
        .sort({ isDefault: -1, createdAt: -1 }).select("-__v").lean();
      return NextResponse.json({ addresses });
    }
    const q = (searchParams.get("q") || "").trim();
    if (!q) return NextResponse.json({ users: [] });
    const users = await User.find(withSearch({}, q, ["name", "lastName", "phone", "email"]))
      .select("name lastName phone email role isBanned").sort({ createdAt: -1 }).limit(10).lean();
    return NextResponse.json({ users });
  } catch (error) {
    console.error("[admin/orders/customers GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}

export async function POST(req) {
  const { denied } = await requireAdminPermission("orders.create");
  if (denied) return denied;
  try {
    await connectToDB();
    const body = await req.json();
    if (!mongoose.isValidObjectId(body.userId) || !(await User.exists({ _id: body.userId }))) {
      return NextResponse.json({ message: "کاربر یافت نشد" }, { status: 404 });
    }
    const data = {
      fullName: String(body.fullName || "").trim(),
      phone: normalizePhoneInput(body.phone),
      city: String(body.city || "").trim(),
      addressLine: String(body.addressLine || "").trim(),
    };
    const fieldErrors = validateAddressPayload(data);
    if (Object.keys(fieldErrors).length) {
      return NextResponse.json({ message: firstAddressError(fieldErrors), fieldErrors }, { status: 400 });
    }
    const address = await Address.create({
      ...data,
      user: body.userId,
      title: String(body.title || "").trim(),
      postalCode: String(body.postalCode || "").trim(),
    });
    return NextResponse.json({ address }, { status: 201 });
  } catch (error) {
    console.error("[admin/orders/customers POST]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
