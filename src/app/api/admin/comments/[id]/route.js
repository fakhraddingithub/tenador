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
import Notification from "base/models/Notification";
import { revalidateContent } from "@/lib/revalidate";
import requireAdminPermission from "@/lib/requireAdminPermission";
import { notifyReviewCreditGranted } from "@/lib/reviewCreditGranting";
import { moderateCommentWithReviewCredit } from "base/services/reviewCredit.service";

export async function PATCH(req, { params }) {
  const { denied } = await requireAdminPermission("comments.moderate");
  if (denied) return denied;

  try {
    await connectToDB();

    const { id } = await params;
    const { status } = await req.json().catch(() => ({}));

    if (!["approved", "rejected", "pending"].includes(status)) {
      return NextResponse.json({ message: "وضعیت نامعتبر است" }, { status: 400 });
    }

    const result = await moderateCommentWithReviewCredit(id, status);
    if (!result) {
      return NextResponse.json({ message: "نظر یافت نشد" }, { status: 404 });
    }

    const { comment, credit } = result;

    // نمایش عمومی نظرها وابسته به وضعیت است → کش نظرها باید باطل شود
    revalidateContent(["comments"]);

    await notifyReviewCreditGranted(credit);
    const message = credit.status === "granted"
      ? `نظر تأیید شد و ${credit.amount.toLocaleString("fa-IR")} تومان پاداش واریز شد`
      : credit.status === "already_granted"
        ? "نظر تأیید شد؛ پاداش این محصول یا سفارش قبلاً ثبت شده است"
        : status === "approved"
          ? "نظر تأیید شد؛ پاداشی طبق شرایط فعلی تعلق نگرفت"
          : "وضعیت نظر به‌روزرسانی شد";
    return NextResponse.json({ message, comment, credit: { status: credit.status, amount: credit.amount ?? 0 } }, { status: 200 });
  } catch (error) {
    console.error("[PATCH /api/admin/comments/:id]", error);
    const known = ["INVALID_REVIEW_CREDIT_CONFIG", "INVALID_REVIEW_CREDIT_AMOUNT", "REVIEW_CREDIT_TRANSACTION_REQUIRED"].includes(error.code);
    return NextResponse.json({
      message: known ? error.message : "ثبت وضعیت نظر و پاداش با خطا روبه‌رو شد؛ دوباره تلاش کنید",
      code: known ? error.code : "COMMENT_MODERATION_FAILED",
    }, { status: error.code === "REVIEW_CREDIT_TRANSACTION_REQUIRED" ? 503 : 500 });
  }
}

export async function DELETE(req, { params }) {
  const { denied } = await requireAdminPermission("comments.delete");
  if (denied) return denied;

  try {
    await connectToDB();

    const { id } = await params;
    const deleted = await Comment.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ message: "نظر یافت نشد" }, { status: 404 });
    }

    // اعلانِ این نظر همان _id را دارد؛ بدون حذفش یک شمارنده‌ی خوانده‌نشده‌ی
    // بدونِ مقصد باقی می‌ماند. خطای اعلان نباید حذفِ انجام‌شده را بشکند.
    await Notification.deleteOne({ _id: deleted._id }).catch(() => {});

    // اگر نظرِ حذف‌شده تأییدشده بود، از نمایش عمومی هم باید برود
    revalidateContent(["comments"]);

    return NextResponse.json({ message: "نظر حذف شد" }, { status: 200 });
  } catch (error) {
    console.error("[DELETE /api/admin/comments/:id]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
