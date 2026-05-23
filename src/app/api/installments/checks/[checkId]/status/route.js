/**
 * PATCH /api/installments/checks/[checkId]/status
 *
 * ادمین وضعیت یک چک را آپدیت می‌کند.
 * اگر همه چک‌ها CLEARED شوند → سفارش PAID می‌شود + webhook کردیت مربی
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "base/utils/auth.js";
import connectToDB from "base/configs/db";
import Installment from "base/models/Installment.js";
import Payment from "base/models/Payment.js";
import Order from "base/models/Order.js";
import mongoose from "mongoose";

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;
  return decoded;
}

export async function PATCH(req, { params }) {
  try {
    await connectToDB();

    /* ── احراز هویت ادمین ── */
    const auth = await getAuthUser();
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { checkId } = params;
    const body = await req.json();
    const { status, bounceReason } = body;

    const VALID_STATUSES = ["PENDING", "CLEARED", "BOUNCED"];
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { message: `وضعیت نامعتبر. مقادیر مجاز: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    if (status === "BOUNCED" && !bounceReason) {
      return NextResponse.json(
        { message: "دلیل برگشت چک الزامی است" },
        { status: 400 }
      );
    }

    /* ── یافتن Installment حاوی این چک ── */
    const installment = await Installment.findOne({ "checks._id": checkId });
    if (!installment) {
      return NextResponse.json({ message: "چک یافت نشد" }, { status: 404 });
    }

    const check = installment.checks.id(checkId);
    if (!check) {
      return NextResponse.json({ message: "چک یافت نشد" }, { status: 404 });
    }

    /* جلوگیری از تغییر چک CLEARED قبلی */
    if (check.status === "CLEARED" && status !== "CLEARED") {
      return NextResponse.json(
        { message: "چک تأیید شده را نمی‌توان تغییر داد" },
        { status: 400 }
      );
    }

    /* ── آپدیت چک ── */
    check.status = status;
    check.reviewedBy = auth.userId;
    check.reviewedAt = new Date();
    if (status === "CLEARED") {
      check.paidAt = new Date();
    }
    if (status === "BOUNCED") {
      check.bounceReason = bounceReason;
    }

    /* ── بررسی وضعیت کلی اقساط ── */
    const allChecks = installment.checks;
    const allCleared = allChecks.every((c) => c.status === "CLEARED");
    const anyBounced = allChecks.some((c) => c.status === "BOUNCED");

    if (allCleared) {
      installment.status = "COMPLETED";
    } else if (anyBounced) {
      installment.status = "DEFAULTED";
    } else {
      installment.status = "ACTIVE";
    }

    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();
    try {
      await installment.save({ session: dbSession });

      /* اگر همه چک‌ها CLEARED → سفارش PAID */
      if (allCleared) {
        const order = await Order.findById(installment.order);
        if (order && order.paymentStatus !== "PAID") {
          /* down payment را هم PAID کن */
          await Payment.findByIdAndUpdate(
            installment.downPayment,
            { status: "PAID" },
            { session: dbSession }
          );

          order.paymentStatus = "PAID";
          order.fulfillmentStatus = "PROCESSING";
          await order.save({ session: dbSession });
        }
      }

      await dbSession.commitTransaction();
      dbSession.endSession();

      /* webhook کردیت مربی (فقط اگر همه پرداخت شد) */
      if (allCleared) {
        fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/orders/webhook-success`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-webhook-secret": process.env.WEBHOOK_SECRET || "",
          },
          body: JSON.stringify({ orderId: installment.order }),
        }).catch((e) => console.error("[installment webhook]", e));
      }

      return NextResponse.json(
        {
          message: "وضعیت چک با موفقیت بروز شد",
          installmentStatus: installment.status,
        },
        { status: 200 }
      );
    } catch (err) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      throw err;
    }
  } catch (error) {
    console.error("[installments/checks/status]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
