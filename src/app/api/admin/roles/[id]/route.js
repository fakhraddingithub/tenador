/**
 * src/app/api/admin/roles/[id]/route.js
 *
 * PUT    → ویرایش نقش
 * DELETE → حذف نقش (فقط اگر سیستمی نباشد و ادمینی به آن متصل نباشد)
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import AdminRole from "base/models/AdminRole";
import Admin from "base/models/Admin";
import { sanitizePermissions } from "@/lib/permissions";

export async function PUT(req, { params }) {
  try {
    await connectToDB();

    const { id } = await params;
    const body = await req.json();

    const role = await AdminRole.findById(id);
    if (!role) {
      return NextResponse.json({ message: "نقش یافت نشد" }, { status: 404 });
    }

    if (body.name !== undefined) {
      if (!body.name?.trim()) {
        return NextResponse.json(
          { message: "نام نقش نمی‌تواند خالی باشد" },
          { status: 422 }
        );
      }

      const duplicate = await AdminRole.findOne({
        name: { $regex: new RegExp(`^${body.name.trim()}$`, "i") },
        _id: { $ne: id },
      });
      if (duplicate) {
        return NextResponse.json(
          { message: "نقشی با این نام قبلاً ثبت شده است" },
          { status: 409 }
        );
      }

      role.name = body.name.trim();
    }

    if (body.description !== undefined) {
      role.description = body.description?.trim() || "";
    }

    if (body.permissions !== undefined) {
      role.permissions = sanitizePermissions(body.permissions);
    }

    await role.save();

    return NextResponse.json(
      { message: "نقش با موفقیت به‌روزرسانی شد", role },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PUT role]", error);
    return NextResponse.json(
      { message: "خطا در ویرایش نقش" },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectToDB();

    const { id } = await params;

    const role = await AdminRole.findById(id);
    if (!role) {
      return NextResponse.json({ message: "نقش یافت نشد" }, { status: 404 });
    }

    if (role.isSystem) {
      return NextResponse.json(
        { message: "نقش‌های سیستمی قابل حذف نیستند" },
        { status: 400 }
      );
    }

    const inUse = await Admin.countDocuments({ role: id });
    if (inUse > 0) {
      return NextResponse.json(
        {
          message: `این نقش به ${inUse} ادمین متصل است؛ ابتدا نقش آن‌ها را تغییر دهید`,
        },
        { status: 400 }
      );
    }

    await AdminRole.findByIdAndDelete(id);

    return NextResponse.json(
      { message: "نقش با موفقیت حذف شد" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DELETE role]", error);
    return NextResponse.json(
      { message: "خطا در حذف نقش" },
      { status: 500 }
    );
  }
}
