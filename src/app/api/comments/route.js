/**
 * POST /api/comments
 *
 * ثبت نظر/دیدگاه توسط کاربرِ واردشده. هر نظر با وضعیت «pending» ساخته می‌شود و تا
 * تأیید ادمین به‌صورت عمومی نمایش داده نمی‌شود.
 *
 * بدنه:
 *   product  (الزامی)  — شناسه‌ی محصول
 *   text     (الزامی)  — متن نظر
 *   rating   (اختیاری) — ۱ تا ۵ (برای نظرهای سطح‌بالا)
 *   parent   (اختیاری) — شناسه‌ی نظر والد (پاسخ به نظر دیگر)
 *   orderId  (اختیاری) — اگر نظر از مسیر سفارشِ تحویل‌شده ثبت شود
 *
 * کاربر هرگز از بدنه خوانده نمی‌شود؛ همیشه از توکن استخراج می‌شود.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { verifyToken } from "base/utils/auth";
import Comment from "base/models/Comment";
import Product from "base/models/Product";
import Order from "base/models/Order";
import { revalidateContent } from "@/lib/revalidate";

// وضعیت‌های سفارش که اجازه‌ی ثبت نظرِ «خرید تأییدشده» را می‌دهند
const REVIEWABLE_FULFILLMENT = ["SENT", "DELIVERED"];

const MIN_TEXT = 3;
const MAX_TEXT = 1000;

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

export async function POST(req) {
  try {
    await connectToDB();

    const auth = await getAuthUser();
    if (!auth?.userId) {
      return NextResponse.json(
        { message: "برای ثبت نظر باید وارد حساب کاربری شوید" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { product, text, rating, parent, orderId } = body;

    // ── اعتبارسنجی پایه ──
    if (!product) {
      return NextResponse.json({ message: "شناسه‌ی محصول الزامی است" }, { status: 400 });
    }

    const trimmed = typeof text === "string" ? text.trim() : "";
    if (trimmed.length < MIN_TEXT) {
      return NextResponse.json(
        { message: "متن نظر بسیار کوتاه است" },
        { status: 400 }
      );
    }
    if (trimmed.length > MAX_TEXT) {
      return NextResponse.json(
        { message: "متن نظر بیش از حد طولانی است" },
        { status: 400 }
      );
    }

    let ratingValue;
    if (rating !== undefined && rating !== null && rating !== "") {
      const r = Number(rating);
      if (!Number.isInteger(r) || r < 1 || r > 5) {
        return NextResponse.json({ message: "امتیاز باید عددی بین ۱ تا ۵ باشد" }, { status: 400 });
      }
      ratingValue = r;
    }

    // محصول باید وجود داشته باشد و فعال باشد
    const productDoc = await Product.findById(product).select("_id").lean();
    if (!productDoc) {
      return NextResponse.json({ message: "محصول یافت نشد" }, { status: 404 });
    }

    const isReply = Boolean(parent);

    // ── پاسخ به یک نظر ──
    if (isReply) {
      const parentDoc = await Comment.findById(parent).select("_id product").lean();
      if (!parentDoc || String(parentDoc.product) !== String(product)) {
        return NextResponse.json({ message: "نظر والد نامعتبر است" }, { status: 400 });
      }

      const reply = await Comment.create({
        user: auth.userId,
        product,
        parent,
        text: trimmed,
        status: "pending",
      });

      return NextResponse.json(
        { message: "پاسخ شما ثبت شد و پس از تأیید نمایش داده می‌شود", comment: { id: reply._id } },
        { status: 201 }
      );
    }

    // ── نظر سطح‌بالا: جلوگیری از نظر تکراری برای یک محصول ──
    const existing = await Comment.findOne({
      user: auth.userId,
      product,
      parent: null,
    })
      .select("_id status")
      .lean();

    if (existing) {
      return NextResponse.json(
        { message: "شما قبلاً برای این محصول نظر ثبت کرده‌اید", code: "DUPLICATE" },
        { status: 409 }
      );
    }

    // ── تأیید خرید (در صورت ثبت از مسیر سفارش) ──
    let verified = false;
    let linkedOrder = null;

    if (orderId) {
      const order = await Order.findOne({ _id: orderId, user: auth.userId })
        .select("items fulfillmentStatus")
        .lean();

      const containsProduct =
        order?.items?.some(
          (it) =>
            it.itemType !== "used_product" &&
            it.product &&
            String(it.product) === String(product)
        ) || false;

      const eligibleStatus = order
        ? REVIEWABLE_FULFILLMENT.includes(order.fulfillmentStatus)
        : false;

      if (!order || !containsProduct) {
        return NextResponse.json(
          { message: "این محصول در سفارش شما یافت نشد" },
          { status: 403 }
        );
      }
      if (!eligibleStatus) {
        return NextResponse.json(
          { message: "تنها پس از ارسال/تحویل سفارش می‌توانید نظر ثبت کنید" },
          { status: 403 }
        );
      }

      verified = true;
      linkedOrder = orderId;
    }

    const comment = await Comment.create({
      user: auth.userId,
      product,
      order: linkedOrder,
      text: trimmed,
      rating: ratingValue,
      isVerifiedPurchase: verified,
      status: "pending",
    });

    // نظر در صف بازبینی است؛ تگ نظرها را تازه می‌کنیم تا پس از تأیید سریع نمایش یابد
    revalidateContent(["comments"]);

    return NextResponse.json(
      {
        message: "نظر شما ثبت شد و پس از تأیید مدیر نمایش داده می‌شود",
        comment: { id: comment._id },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/comments]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
