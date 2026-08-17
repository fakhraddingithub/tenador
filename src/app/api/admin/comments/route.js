/**
 * GET /api/admin/comments
 *
 * فهرست نظرها برای پنل مدیریت با فیلتر وضعیت، صفحه‌بندی و شمارش هر وضعیت.
 *
 * query: ?status=pending|approved|rejected|all  &page=1  &limit=20
 *
 * احراز هویت ادمین از طریق lookup نقش در دیتابیس انجام می‌شود (توکن به‌تنهایی
 * نقش را قابل‌اعتماد حمل نمی‌کند).
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Comment from "base/models/Comment";
import requireAdminPermission from "@/lib/requireAdminPermission";

export async function GET(req) {
  const { denied } = await requireAdminPermission("comments.view");
  if (denied) return denied;

  try {
    await connectToDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "pending";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(5, parseInt(searchParams.get("limit") || "20", 10)));

    const filter = {};
    if (["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }

    const [items, total, counts] = await Promise.all([
      Comment.find(filter)
        .populate("user", "name lastName phone avatar")
        .populate("product", "name mainImage slug")
        .populate("usedProduct", "name images slug")
        .populate({ path: "parent", select: "text" })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Comment.countDocuments(filter),
      Comment.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    ]);

    const countsByStatus = { pending: 0, approved: 0, rejected: 0 };
    for (const c of counts) {
      if (c._id in countsByStatus) countsByStatus[c._id] = c.n;
    }

    return NextResponse.json(
      {
        comments: items,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        counts: countsByStatus,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/admin/comments]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
