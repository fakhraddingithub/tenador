/**
 * PATCH  /api/admin/comments/:id   → تغییر وضعیت (approved | rejected | pending)
 * DELETE /api/admin/comments/:id   → حذف نظر
 *
 * احراز هویت ادمین با lookup نقش در دیتابیس.
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Comment from "base/models/Comment";
import { revalidateContent } from "@/lib/revalidate";
import requireAdmin, { unauthorized } from "@/lib/requireAdmin";
import { grantReviewCreditIfEligible } from "@/lib/reviewCreditGranting";

export async function PATCH(req, { params }) {
  if (!(await requireAdmin())) return unauthorized();

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

    const wasApproved = comment.status === "approved";
    comment.status = status;
    await comment.save(); // hook فلگ approved را همگام می‌کند

    // فقط در گذارِ واقعی به approved اعتبار کیف پول اعطا شود، نه هر ذخیره‌ی دوباره
    if (!wasApproved && status === "approved") {
      await grantReviewCreditIfEligible(comment);
    }

    // نمایش عمومی نظرها وابسته به وضعیت است → کش نظرها باید باطل شود
    revalidateContent(["comments"]);

    return NextResponse.json({ message: "وضعیت نظر به‌روزرسانی شد", comment }, { status: 200 });
  } catch (error) {
    console.error("[PATCH /api/admin/comments/:id]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  if (!(await requireAdmin())) return unauthorized();

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
