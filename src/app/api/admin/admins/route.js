/**
 * src/app/api/admin/admins/route.js
 *
 * GET  → لیست ادمین‌ها (با نقش populate شده) + آمار
 * POST → ساخت ادمین جدید
 *
 * ⚠️ فاز فعلی فقط زیرساخت مدیریت است؛ هیچ enforcement دسترسی انجام نمی‌شود.
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Admin from "base/models/Admin";
import AdminRole from "base/models/AdminRole";
import { sanitizePermissions } from "@/lib/permissions";

export async function GET() {
  try {
    await connectToDB();

    const admins = await Admin.find({})
      .populate("role", "name description permissions isSystem")
      .sort({ createdAt: -1 })
      .lean();

    const stats = {
      total: admins.length,
      active: admins.filter((a) => a.isActive).length,
      inactive: admins.filter((a) => !a.isActive).length,
    };

    return NextResponse.json({ admins, stats }, { status: 200 });
  } catch (error) {
    console.error("[GET admins]", error);
    return NextResponse.json(
      { message: "خطا در دریافت ادمین‌ها" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await connectToDB();

    const body = await req.json();
    const { name, username, email, role, title, permissions, isActive } = body;

    if (!name?.trim() || !username?.trim()) {
      return NextResponse.json(
        { message: "نام و نام کاربری الزامی هستند" },
        { status: 422 }
      );
    }

    const normalizedUsername = username.trim().toLowerCase();

    if (!/^[a-z0-9_.-]{3,30}$/.test(normalizedUsername)) {
      return NextResponse.json(
        {
          message:
            "نام کاربری باید ۳ تا ۳۰ کاراکتر و فقط شامل حروف انگلیسی کوچک، عدد، نقطه، خط تیره و زیرخط باشد",
        },
        { status: 422 }
      );
    }

    const duplicate = await Admin.findOne({ username: normalizedUsername });
    if (duplicate) {
      return NextResponse.json(
        { message: "این نام کاربری قبلاً ثبت شده است" },
        { status: 409 }
      );
    }

    // اعتبارسنجی نقش (در صورت انتخاب)
    let roleId = null;
    if (role) {
      const roleDoc = await AdminRole.findById(role).lean();
      if (!roleDoc) {
        return NextResponse.json(
          { message: "نقش انتخاب‌شده یافت نشد" },
          { status: 404 }
        );
      }
      roleId = roleDoc._id;
    }

    const admin = await Admin.create({
      name: name.trim(),
      username: normalizedUsername,
      email: email?.trim() || "",
      role: roleId,
      title: title?.trim() || "",
      // فقط کلیدهای معتبرِ رجیستری ذخیره می‌شوند
      permissions: sanitizePermissions(permissions),
      isActive: isActive !== undefined ? !!isActive : true,
    });

    const populated = await Admin.findById(admin._id)
      .populate("role", "name description permissions isSystem")
      .lean();

    return NextResponse.json(
      { message: "ادمین با موفقیت ایجاد شد", admin: populated },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST admins]", error);

    if (error.code === 11000) {
      return NextResponse.json(
        { message: "این نام کاربری قبلاً ثبت شده است" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: "خطای داخلی سرور در ایجاد ادمین" },
      { status: 500 }
    );
  }
}
