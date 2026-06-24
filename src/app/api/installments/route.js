/**
 * GET /api/installments
 *
 * فهرست طرح‌های اقساطیِ کاربرِ لاگین‌شده — همراه با چک‌ها، خلاصه‌ی مبالغ و
 * وضعیت مشتق‌شده (شامل سررسیدگذشته). فقط خواندنی است.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { verifyToken } from "base/utils/auth";
import Installment from "base/models/Installment";
import Order from "base/models/Order";
import { deriveCheckStatus, summarizeInstallment } from "base/services/installmentService";

async function getUserFromToken() {
  const token = (await cookies()).get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

export async function GET() {
  try {
    await connectToDB();

    const user = await getUserFromToken();
    if (!user?.userId) {
      return NextResponse.json({ message: "احراز هویت لازم است" }, { status: 401 });
    }

    // ابتدا سفارش‌های اقساطیِ این کاربر — سپس فقط اقساط همان‌ها واکشی می‌شود
    const userOrders = await Order.find({ user: user.userId, paymentMethod: "INSTALLMENT" })
      .select("_id")
      .lean();
    const orderIds = userOrders.map((o) => o._id);

    const installments = await Installment.find({ order: { $in: orderIds } })
      .populate({
        path: "order",
        select: "trackingCode totalPrice paymentMethod paymentStatus fulfillmentStatus user",
      })
      .populate({ path: "downPayment", select: "amount status" })
      .sort({ createdAt: -1 })
      .lean();

    const now = new Date();

    const result = installments
      .filter((inst) => inst.order)
      .map((inst) => {
        const summary = summarizeInstallment(inst, now);
        return {
          _id: inst._id,
          status: inst.status,
          derivedStatus: summary.derivedStatus,
          numberOfChecks: inst.numberOfChecks,
          totalAmount: inst.totalAmount,
          createdAt: inst.createdAt,
          orderConfirmedAt: inst.orderConfirmedAt || null,
          order: {
            _id: inst.order._id,
            trackingCode: inst.order.trackingCode,
            totalPrice: inst.order.totalPrice,
            paymentStatus: inst.order.paymentStatus,
            fulfillmentStatus: inst.order.fulfillmentStatus,
          },
          downPayment: {
            amount: summary.downPaymentAmount,
            paid: summary.downPaymentPaid,
          },
          paidAmount: summary.paidAmount,
          remainingAmount: summary.remainingAmount,
          paidChecksCount: summary.paidChecksCount,
          remainingChecksCount: summary.remainingChecksCount,
          nextDueDate: summary.nextDueDate,
          overdueCount: summary.overdueCount,
          checks: (inst.checks || [])
            .slice()
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
            .map((c, idx) => ({
              _id: c._id,
              number: idx + 1,
              checkNumber: c.checkNumber || null,
              amount: c.amount,
              dueDate: c.dueDate,
              status: c.status,
              displayStatus: deriveCheckStatus(c, now),
              paidAt: c.paidAt || null,
              receiptImageUrl: c.receiptImageUrl || null,
            })),
        };
      });

    return NextResponse.json({ installments: result }, { status: 200 });
  } catch (error) {
    console.error("[api/installments GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
