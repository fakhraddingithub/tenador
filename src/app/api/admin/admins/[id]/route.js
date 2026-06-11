/**
 * src/app/api/admin/admins/[id]/route.js
 *
 * GET    → دریافت یک ادمین
 * PUT    → ویرایش ادمین (شامل فعال/غیرفعال‌سازی و دسترسی‌ها)
 * DELETE → حذف ادمین
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Admin from "base/models/Admin";
import AdminRole from "base/models/AdminRole";
import { sanitizePermissions } from "@/lib/permissions";

export async function GET(req, { params }) {
  try {
    await connectToDB();

    const { id } = await params;

    const admin = await Admin.findById(id)
      .populate("role", "name description permissions isSystem")
      .lean();

    if (!admin) {
      return NextResponse.json({ message: "ادمین یافت نشد" }, { status: 404 });
    }

    return NextResponse.json({ admin }, { status: 200 });
  } catch (error) {
    console.error("[GET admin]", error);
    return NextResponse.json(
      { message: "خطا در دریافت اطلاعات ادمین" },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  try {
    await connectToDB();

    const { id } = await params;
    const body = await req.json();

    const admin = await Admin.findById(id);
    if (!admin) {
      return NextResponse.json({ message: "ادمین یافت نشد" }, { status: 404 });
    }

    // ─── فیلدهای ساده ───
    if (body.name !== undefined) {
      if (!body.name?.trim()) {
        return NextResponse.json(
          { message: "نام نمی‌تواند خالی باشد" },
          { status: 422 }
        );
      }
      admin.name = body.name.trim();
    }

    if (body.title !== undefined) admin.title = body.title?.trim() || "";
    if (body.email !== undefined) admin.email = body.email?.trim() || "";
    if (body.isActive !== undefined) admin.isActive = !!body.isActive;

    // ─── نام کاربری (یکتا) ───
    if (body.username !== undefined) {
      const normalizedUsername = String(body.username).trim().toLowerCase();

      if (!/^[a-z0-9_.-]{3,30}$/.test(normalizedUsername)) {
        return NextResponse.json(
          {
            message:
              "نام کاربری باید ۳ تا ۳۰ کاراکتر و فقط شامل حروف انگلیسی کوچک، عدد، نقطه، خط تیره و زیرخط باشد",
          },
          { status: 422 }
        );
      }

      const duplicate = await Admin.findOne({
        username: normalizedUsername,
        _id: { $ne: id },
      });
      if (duplicate) {
        return NextResponse.json(
          { message: "این نام کاربری قبلاً ثبت شده است" },
          { status: 409 }
        );
      }

      admin.username = normalizedUsername;
    }

    // ─── نقش ───
    if (body.role !== undefined) {
      if (body.role) {
        const roleDoc = await AdminRole.findById(body.role).lean();
        if (!roleDoc) {
          return NextResponse.json(
            { message: "نقش انتخاب‌شده یافت نشد" },
            { status: 404 }
          );
        }
        admin.role = roleDoc._id;
      } else {
        admin.role = null;
      }
    }

    // ─── دسترسی‌ها (فقط کلیدهای معتبر رجیستری) ───
    if (body.permissions !== undefined) {
      admin.permissions = sanitizePermissions(body.permissions);
    }

    await admin.save();

    const populated = await Admin.findById(admin._id)
      .populate("role", "name description permissions isSystem")
      .lean();

    return NextResponse.json(
      { message: "ادمین با موفقیت به‌روزرسانی شد", admin: populated },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PUT admin]", error);

    if (error.code === 11000) {
      return NextResponse.json(
        { message: "این نام کاربری قبلاً ثبت شده است" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: "خطا در ویرایش ادمین" },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectToDB();

    const { id } = await params;

    const admin = await Admin.findById(id);
    if (!admin) {
      return NextResponse.json({ message: "ادمین یافت نشد" }, { status: 404 });
    }

    await Admin.findByIdAndDelete(id);

    return NextResponse.json(
      { message: "ادمین با موفقیت حذف شد" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DELETE admin]", error);
    return NextResponse.json(
      { message: "خطا در حذف ادمین" },
      { status: 500 }
    );
  }
}
