/**
 * src/app/api/admin/orders/[orderId]/discount/route.js
 *
 * تخفیف مدیریت — اعمال/حذفِ یک تخفیفِ دستیِ متعلق به همین سفارش توسط ادمین.
 *
 *   POST   → اعمال یا به‌روزرسانیِ مبلغ تخفیف مدیریت
 *   DELETE → حذف تخفیف مدیریت
 *
 * برخلاف کوپن (کدِ سراسریِ قابل‌استفاده در چند سفارش)، این تخفیف هیچ سندی در
 * کالکشن Coupon نمی‌سازد و صرفاً روی همین سفارش ذخیره می‌شود؛ برای اجتناب از
 * ناسازگاری، دقیقاً از همان فیلدهای ذخیره/محاسبه‌ی کوپن (coupon, couponDiscount)
 * و همان مسیر بازمحاسبه (services/orderRecalc.js) استفاده می‌کند.
 */

import { NextResponse } from "next/server";
import mongoose from "mongoose";

import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Order from "base/models/Order";
import { recalcAndApply } from "base/services/orderRecalc";

import requireAdmin, { unauthorized } from "@/lib/requireAdmin";

const isId = (v) => v && mongoose.Types.ObjectId.isValid(v);
const MANAGEMENT_DISCOUNT_LABEL = "تخفیف مدیریت";

/* ─── POST: اعمال/به‌روزرسانیِ تخفیف مدیریت ──────────────────────────── */
export async function POST(req, { params }) {
  if (!(await requireAdmin())) return unauthorized();

  try {
    await connectToDB();

    const admin = await requireAdmin();
    if (!admin?.userId) {
      return NextResponse.json({ message: "احراز هویت ادمین لازم است" }, { status: 401 });
    }

    const { orderId } = await params;
    if (!isId(orderId)) {
      return NextResponse.json({ message: "شناسه سفارش نامعتبر است" }, { status: 400 });
    }

    const body = await req.json();
    const amount = Math.floor(Number(body?.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ message: "مبلغ تخفیف باید عددی صحیح و بزرگ‌تر از صفر باشد" }, { status: 400 });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
      }

      // اگر کدِ تخفیفِ سراسری (کوپن واقعی) روی سفارش فعال است، این مسیر آن را
      // بی‌سروصدا جایگزین نمی‌کند — ادمین باید ابتدا آن را حذف کند.
      if (order.coupon?.code && !order.coupon?.isManual) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: `این سفارش کد تخفیف «${order.coupon.code}» دارد؛ ابتدا آن را حذف کنید` },
          { status: 400 }
        );
      }

      order.coupon = { code: MANAGEMENT_DISCOUNT_LABEL, _id: null, isManual: true };
      order.couponDiscount = amount;

      order.reviewedBy = new mongoose.Types.ObjectId(admin.userId);
      order.reviewedAt = new Date();
      await recalcAndApply(order, session);
      await order.save({ session });

      await session.commitTransaction();
      session.endSession();

      return NextResponse.json(
        {
          message: "تخفیف مدیریت اعمال شد",
          couponDiscount: order.couponDiscount,
          totalPrice: order.totalPrice,
          paymentStatus: order.paymentStatus,
        },
        { status: 200 }
      );
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (error) {
    console.error("[admin/orders/:id/discount POST]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}

/* ─── DELETE: حذف تخفیف مدیریت ───────────────────────────────────────── */
export async function DELETE(req, { params }) {
  if (!(await requireAdmin())) return unauthorized();

  try {
    await connectToDB();

    const admin = await requireAdmin();
    if (!admin?.userId) {
      return NextResponse.json({ message: "احراز هویت ادمین لازم است" }, { status: 401 });
    }

    const { orderId } = await params;
    if (!isId(orderId)) {
      return NextResponse.json({ message: "شناسه سفارش نامعتبر است" }, { status: 400 });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
      }

      if (!order.coupon?.isManual) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json({ message: "تخفیف مدیریتی روی این سفارش ثبت نشده است" }, { status: 400 });
      }

      order.coupon = { code: null, _id: null, isManual: false };
      order.couponDiscount = 0;

      order.reviewedBy = new mongoose.Types.ObjectId(admin.userId);
      order.reviewedAt = new Date();
      await recalcAndApply(order, session);
      await order.save({ session });

      await session.commitTransaction();
      session.endSession();

      return NextResponse.json(
        { message: "تخفیف مدیریت حذف شد", totalPrice: order.totalPrice, paymentStatus: order.paymentStatus },
        { status: 200 }
      );
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (error) {
    console.error("[admin/orders/:id/discount DELETE]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
