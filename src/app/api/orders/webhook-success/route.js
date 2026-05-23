/**
 * POST /api/orders/webhook-success
 *
 * بعد از تأیید پرداخت (توسط gateway یا ادمین) فراخوانی می‌شود.
 * وظایف:
 *  1. محاسبه و واریز کردیت مربی بر اساس قوانین CoachCredit
 *  2. آپدیت وضعیت سفارش به PAID
 *
 * این endpoint باید از یک secret header یا IP whitelist محافظت شود.
 * در این پیاده‌سازی از یک WEBHOOK_SECRET استفاده می‌کنیم.
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import User from "base/models/User";
import Order from "base/models/Order";
import CoachCredit from "base/models/CoachCredit";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export async function POST(req) {
  try {
    /* ── احراز هویت webhook ── */
    const secret = req.headers.get("x-webhook-secret");
    if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectToDB();

    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ message: "orderId required" }, { status: 400 });
    }

    const order = await Order.findById(orderId).populate("items.product").lean();
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    /* ── فقط برای سفارش‌های پرداخت‌شده اجرا شود ── */
    if (order.paymentStatus !== "PAID") {
      return NextResponse.json({ message: "Order not paid yet" }, { status: 400 });
    }

    const buyer = await User.findById(order.user).lean();
    if (!buyer || !buyer.coach) {
      return NextResponse.json(
        { message: "سفارش ثبت شد — خریدار مربی معرف ندارد" },
        { status: 200 }
      );
    }

    /* ── بررسی اینکه آیا این اولین خرید شاگرد است ── */
    const prevOrders = await Order.countDocuments({
      user: buyer._id,
      _id: { $ne: order._id },
      paymentStatus: "PAID",
    });
    const isNewStudent = prevOrders === 0;

    const now = new Date();

    /* ── یافتن قوانین CoachCredit مرتبط ── */
    const creditRules = await CoachCredit.find({
      active: true,
      $or: [{ startAt: null }, { startAt: { $lte: now } }],
      $and: [
        { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
        { $or: [{ scope: "all_coaches" }, { scope: "specific_coach", coach: buyer.coach }] },
      ],
    })
      .sort({ priority: -1 })
      .lean();

    let totalCreditEarned = 0;
    const appliedCredits = [];

    /* برای هر آیتم سفارش، بهترین قانون مرتبط را اعمال کن */
    for (const item of order.items) {
      const product = item.product;
      if (!product) continue;

      let bestCredit = 0;
      let bestRule = null;

      for (const rule of creditRules) {
        /* بررسی targetType */
        let matched = false;
        if (rule.targetType === "all") {
          matched = true;
        } else if (
          rule.targetType === "product" &&
          rule.targets.some((t) => t.toString() === product._id.toString())
        ) {
          matched = true;
        } else if (
          rule.targetType === "category" &&
          product.category &&
          rule.targets.some((t) => t.toString() === product.category.toString())
        ) {
          matched = true;
        } else if (
          rule.targetType === "serie" &&
          product.serie &&
          rule.targets.some((t) => t.toString() === product.serie.toString())
        ) {
          matched = true;
        }

        if (!matched) continue;

        /* بررسی شرایط */
        if (rule.conditions?.onlyNewStudents && !isNewStudent) continue;
        if (
          rule.conditions?.minPurchaseAmount &&
          item.unitPriceToman * item.quantity < rule.conditions.minPurchaseAmount
        )
          continue;

        /* محاسبه کردیت */
        const purchaseAmount = (item.unitPriceToman || 0) * item.quantity;
        let credit = 0;
        if (rule.credit.kind === "percent") {
          credit = Math.floor((purchaseAmount * rule.credit.value) / 100);
        } else {
          credit = rule.credit.value;
        }

        if (credit > bestCredit) {
          bestCredit = credit;
          bestRule = rule;
        }
      }

      if (bestCredit > 0 && bestRule) {
        totalCreditEarned += bestCredit;
        appliedCredits.push({ ruleId: bestRule._id, amount: bestCredit });

        /* آپدیت آمار قانون */
        await CoachCredit.findByIdAndUpdate(bestRule._id, {
          $inc: { totalCreditPaid: bestCredit, triggerCount: 1 },
        });
      }
    }

    /* ── واریز به کیف پول مربی ── */
    if (totalCreditEarned > 0) {
      await User.findByIdAndUpdate(buyer.coach, {
        $inc: { walletBalance: totalCreditEarned },
      });
    }

    return NextResponse.json(
      {
        message: "کردیت مربی محاسبه و واریز شد",
        coachId: buyer.coach,
        totalCreditEarned,
        appliedCredits,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[webhook-success]", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
