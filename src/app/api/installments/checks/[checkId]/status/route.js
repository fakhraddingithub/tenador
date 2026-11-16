import { grantAutomaticCoachCredit, reverseAutomaticCoachCredit } from "base/services/coachWallet.service";
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
 *   amountEUR?:       number  (مبلغ یوروییِ این چک — هنگام پاس‌شدن یا روی چکِ پاس‌شده)
 *
 * یورو: یوروی چک یک ردیف در order.paymentsEUR است با installmentCheck = همین چک،
 * و در همان تراکنش «تنظیم» می‌شود (ثبت، ویرایش با editHistory، یا با ۰ حذف).
 *   - پاس‌شدن: اگر سفارش مبلغ کلِ یورو دارد و ادمین orders.setCurrency دارد، الزامی است.
 *   - چکِ پاس‌شده: فقط amountEUR بفرستید تا ویرایش شود.
 *   - فرستادنش بدون orders.setCurrency → ۴۰۳؛ روی چکِ پاس‌نشده → ۴۰۰.
 *
 * برگرداندنِ چکِ پاس‌شده (CLEARED → PENDING/BOUNCED) مجاز است و همه‌ی اثرهایش را
 * برمی‌گرداند: ردیفِ یوروی آن چک حذف، paidAt پاک، و اگر سفارش با پاس‌شدنِ همه‌ی
 * چک‌ها PAID شده بود → PARTIALLY_PAID/UNPAID و برگشتِ کردیتِ خودکارِ مربی.
 *
 * رفتار وضعیتِ سفارش:
 *   - اگر همه چک‌ها CLEARED شوند → installment.status=COMPLETED، پیش‌پرداخت PAID،
 *     order.paymentStatus=PAID. (وضعیت «پرداخت» خودکار همگام می‌شود.)
 *   - تحویل/پردازش سفارش (fulfillmentStatus) این‌جا تغییر نمی‌کند؛ آن مرحله نیازمند
 *     تأیید صریح ادمین از مسیر confirm-order است (دروازه‌ی بازبینی).
 *   - ایمیل به مشتری هنگام پاس‌شدن یک چک و هنگام تکمیل کاملِ اقساط ارسال می‌شود.
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Installment from "base/models/Installment.js";
import Payment from "base/models/Payment.js";
import Order from "base/models/Order.js";
import User from "base/models/User.js";
import mongoose from "mongoose";
import { parseCheckEurAmount, setLinkedEur } from "base/services/orderEurRecalc";
import {
  sendInstallmentCheckClearedEmail,
  sendInstallmentCompletedEmail,
} from "@/lib/emailService";
import requireAdminPermission from "@/lib/requireAdminPermission";

export async function PATCH(req, { params }) {
  /* ── احراز هویت + دسترسیِ زنده ──
     پیش‌تر فقط ادعای `role` داخلِ JWT چک می‌شد؛ یعنی ادمینی که عضویتش لغو
     شده یا کاربرش مسدود شده بود، تا انقضای ۱۵روزه‌ی توکن همچنان می‌توانست
     چک را «پاس» کند و سفارش را تسویه‌شده نشان دهد. */
  const { ctx, denied } = await requireAdminPermission("installments.edit");
  if (denied) return denied;

  try {
    await connectToDB();

    const { checkId } = await params;
    const body = await req.json();
    const { status, bounceReason, receiptImageUrl, notes, amountEUR } = body;

    const hasStatus = status !== undefined && status !== null && status !== "";
    const eurSent = amountEUR !== undefined && amountEUR !== null && amountEUR !== "";
    const hasMeta = receiptImageUrl !== undefined || notes !== undefined || eurSent;

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

    const wasCleared = check.status === "CLEARED";
    const justCleared = hasStatus && status === "CLEARED" && !wasCleared;
    // برگرداندنِ چکِ پاس‌شده (به «در انتظار» یا «برگشت‌خورده»): پولی که شمرده شده بود دیگر نیست
    const unCleared = hasStatus && wasCleared && status !== "CLEARED";
    const clearedAfter = hasStatus ? status === "CLEARED" : wasCleared;

    /* ── مبلغ یوروییِ چک ──
       هنگام پاس‌شدن (الزامی اگر سفارش یورو دارد) یا ویرایش روی چکی که پاس‌شده می‌ماند.
       eurValue = null یعنی «دست نزن»؛ عدد یعنی «یوروی این چک همین است» (۰ = ندارد). */
    let eurValue = null;
    if (eurSent || justCleared) {
      const canEur = ctx.can("orders.setCurrency");
      if (eurSent && !canEur) {
        return NextResponse.json(
          { message: "شما دسترسی لازم برای ثبت مبلغ یورو را ندارید" },
          { status: 403 }
        );
      }
      if (eurSent && !clearedAfter) {
        return NextResponse.json(
          { message: "مبلغ یورو فقط برای چکِ پاس‌شده ثبت می‌شود" },
          { status: 400 }
        );
      }
      const eurOrder = justCleared
        ? await Order.findById(installment.order).select("priceEUR").lean()
        : null;
      const parsedEur = parseCheckEurAmount(amountEUR, {
        required: justCleared ? canEur && eurOrder?.priceEUR != null : eurSent,
      });
      if (parsedEur.error) {
        return NextResponse.json({ message: parsedEur.error }, { status: 400 });
      }
      eurValue = parsedEur.value;
    }
    if (unCleared) eurValue = 0; // یوروی این چک هم با خودش برمی‌گردد

    /* ── آپدیت متادیتا ── */
    if (receiptImageUrl !== undefined) check.receiptImageUrl = receiptImageUrl || null;
    if (notes !== undefined) check.notes = notes || "";

    /* ── آپدیت وضعیت ── */
    if (hasStatus) {
      check.status = status;
      check.reviewedBy = ctx.userId;
      check.reviewedAt = new Date();
      if (status === "CLEARED") {
        check.paidAt = check.paidAt || new Date();
      } else {
        check.paidAt = undefined;
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
          order.coachCreditEligible = true;
          await grantAutomaticCoachCredit(order, dbSession);
          await order.save({ session: dbSession });
        }
      }

      /* چکِ پاس‌شده برگشت: سفارشی که با همین چک «پرداخت‌شده» شده بود دیگر نیست.
         وضعیت از روی رسیدهای تأییدشده (پیش‌پرداخت) دوباره تعیین می‌شود و کردیتِ
         خودکارِ مربی که با PAID شدن داده شده بود برگردانده می‌شود (اگر مربی آن را
         خرج کرده باشد، reverse خطای ۴۰۹ می‌دهد و کلِ تراکنش لغو می‌شود). */
      if (unCleared) {
        const order = await Order.findById(installment.order).session(dbSession);
        if (order && order.paymentStatus === "PAID") {
          const paidReceipts = await Payment.countDocuments({ order: order._id, status: "PAID" }).session(dbSession);
          await reverseAutomaticCoachCredit(order, dbSession);
          order.paymentStatus = paidReceipts > 0 ? "PARTIALLY_PAID" : "UNPAID";
          order.coachCreditProcessedAt = null; // پاس‌شدنِ دوباره کردیت را از نو می‌دهد
          await order.save({ session: dbSession });
        }
      }

      /* یوروی چک = یک ردیفِ paymentsEUR با installmentCheck = همین چک (تنظیم، نه افزودن).
         بعد از order.save تا سندِ بارگذاری‌شده‌ی بالا آن را بازنویسی نکند؛
         read-modify-write مثل PUT /eur، داخلِ همین تراکنش. */
      if (eurValue !== null) {
        const current = await Order.findById(installment.order).select("paymentsEUR").session(dbSession).lean();
        const number =
          installment.checks
            .slice()
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
            .findIndex((c) => String(c._id) === String(check._id)) + 1;
        const { rows, changed } = setLinkedEur(current?.paymentsEUR, {
          field: "installmentCheck",
          id: check._id,
          amount: eurValue,
          adminId: new mongoose.Types.ObjectId(ctx.userId),
          now: new Date(),
          newId: new mongoose.Types.ObjectId(),
          note: `پاس‌شدن قسط ${number}${check.checkNumber ? ` — چک ${check.checkNumber}` : ""}`,
        });
        if (changed) {
          await Order.updateOne(
            { _id: installment.order },
            { $set: { paymentsEUR: rows } },
            { session: dbSession, strict: false }
          );
        }
      }

      await dbSession.commitTransaction();
      dbSession.endSession();
    } catch (err) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      if (err?.code === "WALLET_CHECKOUT_ERROR") {
        return NextResponse.json({ message: err.message }, { status: err.status || 409 });
      }
      throw err;
    }

    /* ── ایمیل مشتری (شکست ایمیل روند را متوقف نمی‌کند) ──
       فقط در لحظه‌ی پاس‌شدن؛ وگرنه هر ویرایشِ یادداشت/یوروی یک اقساطِ تکمیل‌شده
       ایمیلِ «اقساط تکمیل شد» را دوباره می‌فرستاد. */
    if (justCleared) {
      try {
        const order = await Order.findById(installment.order)
          .select("trackingCode user totalPrice")
          .lean();
        const userDoc = order?.user
          ? await User.findById(order.user).select("email name lastName").lean()
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
