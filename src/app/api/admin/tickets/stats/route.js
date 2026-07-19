/**
 * src/app/api/admin/tickets/stats/route.js
 *
 * GET → شمارش تیکت‌ها به تفکیک وضعیت — برای بَجِ سایدبار ادمین و تبِ پشتیبانی.
 * (جایگزین شمارنده‌ی قبلیِ دایرکت‌های خوانده‌نشده‌ی اینستاگرام)
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Ticket from "base/models/Ticket";
import requireAdmin from "@/lib/requireAdmin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 403 });
    }

    await connectToDB();

    const counts = await Ticket.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const countMap = { open: 0, answered: 0, pending_user: 0, closed: 0 };
    counts.forEach((c) => {
      if (c._id in countMap) countMap[c._id] = c.count;
    });

    return NextResponse.json({ counts: countMap }, { status: 200 });
  } catch (error) {
    console.error("[GET Ticket Stats Error]:", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
