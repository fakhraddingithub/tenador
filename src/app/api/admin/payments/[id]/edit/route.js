/**
 * src/app/api/admin/payments/[id]/edit/route.js
 *
 * ویرایش مبلغِ یک پرداختِ تومانی توسط ادمین (افزایش یا کاهش).
 *
 * PATCH body: { amount: number }
 *
 * پس از تغییر مبلغ:
 *  - وضعیت پرداختِ سفارش (paymentStatus) بر اساس مجموعِ پرداخت‌های PAID و مبلغ کل
 *    دوباره تعیین می‌شود (دقیقاً همان منطقِ مسیر تأیید پرداخت).
 *  - ردپای ممیزی روی همان سند پرداخت ذخیره می‌شود: meta.editHistory + meta.editedBy/At.
 *
 * استقلال ارز: این مسیر فقط پرداخت‌های تومانی (سند Payment) را تغییر می‌دهد و هیچ
 * فیلد یورویی (priceEUR / paymentsEUR) را لمس نمی‌کند.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";

import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import "base/models/registerModels";
import Payment from "base/models/Payment";
import Order from "base/models/Order";
import { derivePaymentStatus } from "base/services/orderRecalc";

async function getAdminUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

export async function PATCH(req, { params }) {
  try {
    await connectToDB();

    const admin = await getAdminUser();
    if (!admin?.userId) {
      return NextResponse.json({ message: "احراز هویت ادمین لازم است" }, { status: 401 });
    }

    const { id: paymentId } = await params;
    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      return NextResponse.json({ message: "شناسه پرداخت نامعتبر است" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = Number(body?.amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return NextResponse.json(
        { message: "مبلغ پرداخت باید عددی مثبت باشد" },
        { status: 400 }
      );
    }
    const newAmount = Math.round(parsed);

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const payment = await Payment.findById(paymentId).session(session);
      if (!payment) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json({ message: "پرداخت یافت نشد" }, { status: 404 });
      }

      const order = await Order.findById(payment.order).session(session);
      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json({ message: "سفارش مرتبط یافت نشد" }, { status: 404 });
      }

      const oldAmount = payment.amount || 0;

      // ─── ردپای ممیزی (meta از نوع Mixed است) ───
      const meta = payment.meta && typeof payment.meta === "object" ? { ...payment.meta } : {};
      const history = Array.isArray(meta.editHistory) ? [...meta.editHistory] : [];
      history.push({
        oldAmount,
        newAmount,
        at: new Date(),
        by: String(admin.userId),
      });
      meta.editHistory = history;
      meta.editedBy = String(admin.userId);
      meta.editedAt = new Date();
      payment.meta = meta;
      payment.markModified("meta");

      payment.amount = newAmount;
      await payment.save({ session });

      // ─── بازمحاسبه‌ی وضعیت پرداختِ سفارش از روی مجموعِ پرداخت‌های PAID ───
      const paidPayments = await Payment.find({
        _id: { $in: order.payments || [] },
        status: "PAID",
      })
        .session(session)
        .lean();
      const totalPaid = paidPayments.reduce((s, p) => s + (p.amount || 0), 0);

      order.paymentStatus = derivePaymentStatus(totalPaid, order.totalPrice);
      order.reviewedBy = new mongoose.Types.ObjectId(admin.userId);
      order.reviewedAt = new Date();
      await order.save({ session });

      await session.commitTransaction();
      session.endSession();

      return NextResponse.json(
        {
          message: "مبلغ پرداخت ویرایش شد",
          oldAmount,
          newAmount,
          paymentStatus: order.paymentStatus,
          totalPaid,
          orderTotal: order.totalPrice,
        },
        { status: 200 }
      );
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (error) {
    console.error("[admin/payments/:id/edit PATCH]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
