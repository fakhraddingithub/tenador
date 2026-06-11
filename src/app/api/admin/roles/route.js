/**
 * src/app/api/admin/roles/route.js
 *
 * GET  → لیست نقش‌های ادمین (همراه تعداد ادمین‌های هر نقش)
 * POST → ساخت نقش جدید (مجموعه دسترسی نام‌دار)
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import AdminRole from "base/models/AdminRole";
import Admin from "base/models/Admin";
import { sanitizePermissions } from "@/lib/permissions";

export async function GET() {
  try {
    await connectToDB();

    const roles = await AdminRole.find({}).sort({ createdAt: 1 }).lean();

    // تعداد ادمین‌های متصل به هر نقش — برای نمایش و جلوگیری از حذف نقش درحال‌استفاده
    const counts = await Admin.aggregate([
      { $match: { role: { $ne: null } } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

    const rolesWithCounts = roles.map((role) => ({
      ...role,
      adminCount: countMap.get(role._id.toString()) || 0,
    }));

    return NextResponse.json({ roles: rolesWithCounts }, { status: 200 });
  } catch (error) {
    console.error("[GET roles]", error);
    return NextResponse.json(
      { message: "خطا در دریافت نقش‌ها" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await connectToDB();

    const body = await req.json();
    const { name, description, permissions } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { message: "نام نقش الزامی است" },
        { status: 422 }
      );
    }

    const duplicate = await AdminRole.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    if (duplicate) {
      return NextResponse.json(
        { message: "نقشی با این نام قبلاً ثبت شده است" },
        { status: 409 }
      );
    }

    const role = await AdminRole.create({
      name: name.trim(),
      description: description?.trim() || "",
      permissions: sanitizePermissions(permissions),
    });

    return NextResponse.json(
      { message: "نقش با موفقیت ایجاد شد", role },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST roles]", error);

    if (error.code === 11000) {
      return NextResponse.json(
        { message: "نقشی با این نام قبلاً ثبت شده است" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: "خطای داخلی سرور در ایجاد نقش" },
      { status: 500 }
    );
  }
}
