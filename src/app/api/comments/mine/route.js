/**
 * GET /api/comments/mine
 *
 * شناسه‌ی محصولاتی که کاربرِ واردشده برایشان نظر سطح‌بالا ثبت کرده است
 * (با هر وضعیتی — pending/approved/rejected). برای پنهان‌کردن دکمه‌ی «ثبت نظر»
 * در صفحه‌ی سفارش‌ها استفاده می‌شود تا نظر تکراری ثبت نشود.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { verifyToken } from "base/utils/auth";
import Comment from "base/models/Comment";

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

export async function GET() {
  try {
    await connectToDB();

    const auth = await getAuthUser();
    if (!auth?.userId) {
      return NextResponse.json({ message: "احراز هویت لازم است" }, { status: 401 });
    }

    const docs = await Comment.find({ user: auth.userId, parent: null })
      .select("product")
      .lean();

    const reviewedProductIds = [...new Set(docs.map((d) => String(d.product)))];

    return NextResponse.json({ reviewedProductIds }, { status: 200 });
  } catch (error) {
    console.error("[GET /api/comments/mine]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
