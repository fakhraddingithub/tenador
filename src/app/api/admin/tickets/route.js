/**
 * src/app/api/admin/tickets/route.js
 *
 * GET → لیست همه‌ی تیکت‌ها برای پنل ادمین + شمارش وضعیت‌ها.
 * فیلترها: status, department, priority, assignedAdmin (id | "none"), q (جستجوی موضوع)
 * مرتب‌سازی: sort=lastMessageAt (پیش‌فرض) | createdAt | priority
 *
 * محافظت: requireAdmin — نقش از دیتابیس بررسی می‌شود، نه صرفاً توکن.
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Ticket from "base/models/Ticket";
import requireAdmin from "@/lib/requireAdmin";
import {
  TICKET_DEPARTMENTS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from "base/utils/ticketMeta";

export const runtime = "nodejs";

// برای مرتب‌سازی بر اساس اولویت (فوری بالاتر)
const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };

export async function GET(req) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 403 });
    }

    await connectToDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";
    const department = searchParams.get("department") || "";
    const priority = searchParams.get("priority") || "";
    const assignedAdmin = searchParams.get("assignedAdmin") || "";
    const q = (searchParams.get("q") || "").trim();
    const sort = searchParams.get("sort") || "lastMessageAt";

    const filter = {};
    if (TICKET_STATUSES.includes(status)) filter.status = status;
    if (TICKET_DEPARTMENTS.includes(department)) filter.department = department;
    if (TICKET_PRIORITIES.includes(priority)) filter.priority = priority;
    if (assignedAdmin === "none") filter.assignedAdmin = null;
    else if (assignedAdmin) filter.assignedAdmin = assignedAdmin;
    if (q) filter.subject = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

    const [tickets, counts] = await Promise.all([
      Ticket.find(filter)
        .sort(sort === "createdAt" ? { createdAt: -1 } : { lastMessageAt: -1 })
        .limit(200)
        .populate("user", "name lastName phone email")
        .populate("assignedAdmin", "name lastName")
        .populate("relatedOrder", "trackingCode")
        .populate("relatedPayment", "amount status")
        .lean(),
      Ticket.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);

    if (sort === "priority") {
      tickets.sort(
        (a, b) =>
          (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9) ||
          new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
      );
    }

    const countMap = { open: 0, answered: 0, pending_user: 0, closed: 0 };
    counts.forEach((c) => {
      if (c._id in countMap) countMap[c._id] = c.count;
    });

    return NextResponse.json({ tickets, counts: countMap }, { status: 200 });
  } catch (error) {
    console.error("[GET Admin Tickets Error]:", error);
    return NextResponse.json(
      { message: "خطای داخلی سرور در دریافت تیکت‌ها" },
      { status: 500 },
    );
  }
}
