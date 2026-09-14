import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import requireAdminPermission from "@/lib/requireAdminPermission";
import { setCommentRewardAmount } from "base/services/reviewCredit.service";

export async function PATCH(req, { params }) {
  const { actor, denied } = await requireAdminPermission("comments.adjustReward");
  if (denied) return denied;
  try {
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ message: 'شناسه نظر نامعتبر است' }, { status: 400 });
    const { amount } = await req.json().catch(() => ({}));
    await connectToDB();
    const reward = await setCommentRewardAmount(id, amount, actor.userId);
    if (!reward) return NextResponse.json({ message: 'نظر یافت نشد' }, { status: 404 });
    return NextResponse.json({ message: 'مبلغ پاداش ذخیره شد', reward });
  } catch (error) {
    console.error('[admin comment reward]', error);
    const status = error.code === 'REVIEW_CREDIT_CONFLICT' ? 409 : error.code === 'REVIEW_CREDIT_TRANSACTION_REQUIRED' ? 503 : error.code === 'INVALID_REVIEW_CREDIT_AMOUNT' ? 400 : 500;
    return NextResponse.json({ message: status === 500 ? 'ویرایش پاداش انجام نشد' : error.message }, { status });
  }
}
