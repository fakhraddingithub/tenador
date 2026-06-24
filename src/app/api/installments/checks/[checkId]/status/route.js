/**
 * PATCH /api/installments/checks/[checkId]/status
 *
 * ادمین وضعیت یک چک و/یا متادیتای آن (رسید، یادداشت) را آپدیت می‌کند.
 *
 * Body:
 *   status?:          "PENDING" | "CLEARED" | "BOUNCED"   (اختیاری — اگر نباشد فقط متادیتا آپدیت می‌شود)
 *   bounceReason?:    string  (الزامی وقتی status = BOUNCED)
 *   receiptImageUrl?: string  (آپلود/تغییر تصویر چک)
 *   notes?:           string  (یادداشت ادمین)
 *
 * رفتار وضعیتِ سفارش:
 *   - اگر همه چک‌ها CLEARED شوند → installment.status=COMPLETED، پیش‌پرداخت PAID،
 *     order.paymentStatus=PAID. (وضعیت «پرداخت» خودکار همگام می‌شود.)
 *   - تحویل/پردازش سفارش (fulfillmentStatus) این‌جا تغییر نمی‌کند؛ آن مرحله نیازمند
 *     تأیید صریح ادمین از مسیر confirm-order است (دروازه‌ی بازبینی).
 *   - ایمیل به مشتری هنگام پاس‌شدن یک چک و هنگام تکمیل کاملِ اقساط ارسال می‌شود.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "base/utils/auth.js";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Installment from "base/models/Installment.js";
import Payment from "base/models/Payment.js";
import Order from "base/models/Order.js";
import User from "base/models/User.js";
import mongoose from "mongoose";
import {
  sendInstallmentCheckClearedEmail,
  sendInstallmentCompletedEmail,
} from "@/lib/emailService";

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

    const { checkId } = await params;
    const body = await req.json();
    const { status, bounceReason, receiptImageUrl, notes } = body;

    const hasStatus = status !== undefined && status !== null && status !== "";
    const hasMeta = receiptImageUrl !== undefined || notes !== undefined;

    if (!hasStatus && !hasMeta) {
      return NextResponse.json(
        { message: "هیچ تغییری ارسال نشده است" },
        { status: 400 }
      );
    }

    const VALID_STATUSES = ["PENDING", "CLEARED", "BOUNCED"];
    if (hasStatus && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { message: `وضعیت نامعتبر. مقادیر مجاز: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    if (hasStatus && status === "BOUNCED" && !bounceReason) {
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

    /* جلوگیری از تغییر وضعیتِ چکِ CLEARED قبلی (متادیتا قابل تغییر است) */
    if (hasStatus && check.status === "CLEARED" && status !== "CLEARED") {
      return NextResponse.json(
        { message: "چک تأیید شده را نمی‌توان تغییر داد" },
        { status: 400 }
      );
    }

    const wasCleared = check.status === "CLEARED";

    /* ── آپدیت متادیتا ── */
    if (receiptImageUrl !== undefined) check.receiptImageUrl = receiptImageUrl || null;
    if (notes !== undefined) check.notes = notes || "";

    /* ── آپدیت وضعیت ── */
    if (hasStatus) {
      check.status = status;
      check.reviewedBy = auth.userId;
      check.reviewedAt = new Date();
      if (status === "CLEARED") {
        check.paidAt = check.paidAt || new Date();
      }
      if (status === "BOUNCED") {
        check.bounceReason = bounceReason;
      }
    }

    /* ── بررسی وضعیت کلی اقساط ── */
    const allChecks = installment.checks;
    const allCleared = allChecks.every((c) => c.status === "CLEARED");
    const anyBounced = allChecks.some((c) => c.status === "BOUNCED");
    const anyCleared = allChecks.some((c) => c.status === "CLEARED");

    if (allCleared) {
      installment.status = "COMPLETED";
    } else if (anyBounced) {
      installment.status = "DEFAULTED";
    } else if (anyCleared) {
      installment.status = "ACTIVE";
    } else {
      installment.status = "PENDING";
    }

    const justCleared = hasStatus && status === "CLEARED" && !wasCleared;

    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();
    try {
      await installment.save({ session: dbSession });

      /* اگر همه چک‌ها CLEARED → وضعیتِ پرداختِ سفارش PAID (تحویل جداگانه تأیید می‌شود) */
      if (allCleared) {
        const order = await Order.findById(installment.order).session(dbSession);
        if (order && order.paymentStatus !== "PAID") {
          await Payment.findByIdAndUpdate(
            installment.downPayment,
            { status: "PAID" },
            { session: dbSession }
          );
          order.paymentStatus = "PAID";
          await order.save({ session: dbSession });
        }
      }

      await dbSession.commitTransaction();
      dbSession.endSession();
    } catch (err) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      throw err;
    }

    /* ── ایمیل مشتری (شکست ایمیل روند را متوقف نمی‌کند) ── */
    if (justCleared || allCleared) {
      try {
        const order = await Order.findById(installment.order)
          .select("trackingCode user totalPrice")
          .lean();
        const userDoc = order?.user
          ? await User.findById(order.user).select("email name").lean()
          : null;
        if (userDoc?.email) {
          if (allCleared) {
            await sendInstallmentCompletedEmail(order, installment, userDoc.email);
          } else {
            await sendInstallmentCheckClearedEmail(order, installment, check, userDoc.email);
          }
        }
      } catch (mailErr) {
        console.error("[installment email]", mailErr);
      }
    }

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
  } catch (error) {
    console.error("[installments/checks/status]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
