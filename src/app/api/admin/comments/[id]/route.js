/**
 * PATCH  /api/admin/comments/:id   → تغییر وضعیت (approved | rejected | pending)
 * DELETE /api/admin/comments/:id   → حذف نظر
 *
 * احراز هویت ادمین با lookup نقش در دیتابیس.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { verifyToken } from "base/utils/auth";
import Comment from "base/models/Comment";
import User from "base/models/User";
import { revalidateContent } from "@/lib/revalidate";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;
  const user = await User.findById(decoded.userId).select("role").lean();
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function PATCH(req, { params }) {
  try {
    await connectToDB();

   

    const { id } = await params;
    const { status } = await req.json().catch(() => ({}));

    if (!["approved", "rejected", "pending"].includes(status)) {
      return NextResponse.json({ message: "وضعیت نامعتبر است" }, { status: 400 });
    }

    const comment = await Comment.findById(id);
    if (!comment) {
      return NextResponse.json({ message: "نظر یافت نشد" }, { status: 404 });
    }

    comment.status = status;
    await comment.save(); // hook فلگ approved را همگام می‌کند

    // نمایش عمومی نظرها وابسته به وضعیت است → کش نظرها باید باطل شود
    revalidateContent(["comments"]);

    return NextResponse.json({ message: "وضعیت نظر به‌روزرسانی شد", comment }, { status: 200 });
  } catch (error) {
    console.error("[PATCH /api/admin/comments/:id]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectToDB();


    const { id } = await params;
    const deleted = await Comment.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ message: "نظر یافت نشد" }, { status: 404 });
    }

    // اگر نظرِ حذف‌شده تأییدشده بود، از نمایش عمومی هم باید برود
    revalidateContent(["comments"]);

    return NextResponse.json({ message: "نظر حذف شد" }, { status: 200 });
  } catch (error) {
    console.error("[DELETE /api/admin/comments/:id]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
