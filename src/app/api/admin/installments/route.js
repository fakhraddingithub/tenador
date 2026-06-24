/**
 * GET /api/admin/installments
 *
 * فهرست همه‌ی طرح‌های اقساطی برای پنل مدیریت — همراه با اطلاعات مشتری، خلاصه‌ی
 * مبالغ، وضعیت مشتق‌شده و آمار سریع. فقط خواندنی.
 *
 * Query params:
 *   status   = PENDING | ACTIVE | OVERDUE | COMPLETED | DEFAULTED   (وضعیت مشتق‌شده)
 *   from,to  = ISO date — بازه‌ی تاریخ ثبت
 *   q        = جستجوی نام/تلفن مشتری یا کد رهگیری
 *   sort     = dueDate | amount | status | newest                  (پیش‌فرض newest)
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import requireAdmin from "@/lib/requireAdmin";
import Installment from "base/models/Installment";
import { summarizeInstallment } from "base/services/installmentService";

export async function GET(req) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ message: "احراز هویت ادمین لازم است" }, { status: 401 });
    }

    await connectToDB();

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") || "";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const sort = searchParams.get("sort") || "newest";

    // بازه‌ی تاریخ ثبت طرح
    const dateQuery = {};
    if (from) dateQuery.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      dateQuery.$lte = end;
    }
    const baseQuery = Object.keys(dateQuery).length ? { createdAt: dateQuery } : {};

    const all = await Installment.find(baseQuery)
      .populate({
        path: "order",
        select: "trackingCode totalPrice paymentStatus fulfillmentStatus user",
        populate: { path: "user", select: "name phone email" },
      })
      .populate({ path: "downPayment", select: "amount status" })
      .sort({ createdAt: -1 })
      .lean();

    const now = new Date();

    // غنی‌سازی + خلاصه
    let rows = all
      .filter((inst) => inst.order) // سفارش حذف‌شده را نادیده بگیر
      .map((inst) => {
        const summary = summarizeInstallment(inst, now);
        const u = inst.order.user || {};
        return {
          _id: inst._id,
          createdAt: inst.createdAt,
          status: inst.status,
          derivedStatus: summary.derivedStatus,
          numberOfChecks: inst.numberOfChecks,
          totalAmount: inst.totalAmount,
          orderConfirmedAt: inst.orderConfirmedAt || null,
          order: {
            _id: inst.order._id,
            trackingCode: inst.order.trackingCode,
            totalPrice: inst.order.totalPrice,
            paymentStatus: inst.order.paymentStatus,
            fulfillmentStatus: inst.order.fulfillmentStatus,
          },
          customer: {
            name: u.name || "—",
            phone: u.phone || "",
          },
          downPayment: { amount: summary.downPaymentAmount, paid: summary.downPaymentPaid },
          paidAmount: summary.paidAmount,
          remainingAmount: summary.remainingAmount,
          paidChecksCount: summary.paidChecksCount,
          remainingChecksCount: summary.remainingChecksCount,
          nextDueDate: summary.nextDueDate,
          overdueCount: summary.overdueCount,
          checksTotal: summary.checksTotal,
        };
      });

    // آمار سریع — روی کلِ مجموعه‌ی فیلترشده‌ی تاریخ (قبل از فیلتر وضعیت/جستجو)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    let expectedThisMonth = 0;
    let totalActive = 0;
    let totalOverdue = 0;
    for (const inst of all) {
      if (!inst.order) continue;
      const s = summarizeInstallment(inst, now);
      if (["PENDING", "ACTIVE", "OVERDUE"].includes(s.derivedStatus)) totalActive++;
      if (s.derivedStatus === "OVERDUE") totalOverdue++;
      for (const c of inst.checks || []) {
        if (c.status === "PENDING" && c.dueDate) {
          const d = new Date(c.dueDate);
          if (d >= monthStart && d <= monthEnd) expectedThisMonth += Number(c.amount) || 0;
        }
      }
    }

    // فیلتر وضعیت
    if (statusFilter) {
      rows = rows.filter((r) => r.derivedStatus === statusFilter);
    }

    // جستجو
    if (q) {
      rows = rows.filter((r) => {
        return (
          r.customer.name.toLowerCase().includes(q) ||
          r.customer.phone.includes(q) ||
          (r.order.trackingCode || "").toLowerCase().includes(q)
        );
      });
    }

    // مرتب‌سازی
    const STATUS_ORDER = { OVERDUE: 0, DEFAULTED: 1, PENDING: 2, ACTIVE: 3, COMPLETED: 4 };
    rows.sort((a, b) => {
      switch (sort) {
        case "dueDate":
          return new Date(a.nextDueDate || "9999-12-31") - new Date(b.nextDueDate || "9999-12-31");
        case "amount":
          return b.totalAmount - a.totalAmount;
        case "status":
          return (STATUS_ORDER[a.derivedStatus] ?? 9) - (STATUS_ORDER[b.derivedStatus] ?? 9);
        case "newest":
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

    return NextResponse.json(
      {
        installments: rows,
        stats: {
          totalActive,
          totalOverdue,
          expectedThisMonth,
          total: rows.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/installments GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
