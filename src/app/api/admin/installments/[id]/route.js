/**
 * GET /api/admin/installments/[id]
 *
 * جزئیات کامل یک طرح اقساط برای پنل مدیریت — اطلاعات مشتری، سفارش، پیش‌پرداخت،
 * همه‌ی چک‌ها با وضعیت مشتق‌شده و خلاصه‌ی مبالغ.
 */

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import { getUserFullName } from "base/utils/userName";
import "base/models/registerModels";
import Installment from "base/models/Installment";
import { deriveCheckStatus, summarizeInstallment } from "base/services/installmentService";

export async function GET(req, { params }) {
  try {
    await connectToDB();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "شناسه نامعتبر است" }, { status: 400 });
    }

    const inst = await Installment.findById(id)
      .populate({
        path: "order",
        select: "trackingCode totalPrice subtotalPrice discountAmount couponDiscount coupon priceEUR paymentMethod paymentStatus fulfillmentStatus orderDate user",
        populate: { path: "user", select: "name lastName phone email" },
      })
      .populate({ path: "downPayment", select: "amount status bankReceipt createdAt" })
      .lean();

    if (!inst || !inst.order) {
      return NextResponse.json({ message: "طرح اقساط یافت نشد" }, { status: 404 });
    }

    const now = new Date();
    const summary = summarizeInstallment(inst, now);
    const u = inst.order.user || {};

    const checks = (inst.checks || [])
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
        notes: c.notes || "",
        bounceReason: c.bounceReason || "",
        reviewedAt: c.reviewedAt || null,
      }));

    return NextResponse.json(
      {
        installment: {
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
            subtotalPrice: inst.order.subtotalPrice,
            discountAmount: inst.order.discountAmount,
            couponDiscount: inst.order.couponDiscount,
            coupon: inst.order.coupon || null,
            priceEUR: inst.order.priceEUR ?? null,
            paymentStatus: inst.order.paymentStatus,
            fulfillmentStatus: inst.order.fulfillmentStatus,
            orderDate: inst.order.orderDate,
          },
          customer: { name: getUserFullName(u, "\u2014"), phone: u.phone || "", email: u.email || "" },
          downPayment: {
            _id: inst.downPayment?._id || null,
            amount: summary.downPaymentAmount,
            paid: summary.downPaymentPaid,
            status: inst.downPayment?.status || "PENDING",
            imageUrls: inst.downPayment?.bankReceipt?.imageUrls || [],
            reviewStatus: inst.downPayment?.bankReceipt?.reviewStatus || "PENDING",
          },
          paidAmount: summary.paidAmount,
          remainingAmount: summary.remainingAmount,
          paidChecksCount: summary.paidChecksCount,
          remainingChecksCount: summary.remainingChecksCount,
          nextDueDate: summary.nextDueDate,
          overdueCount: summary.overdueCount,
          checks,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/installments/:id GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
