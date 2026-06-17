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
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { verifyToken } from "base/utils/auth";
import Comment from "base/models/Comment";
import User from "base/models/User";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;
  const user = await User.findById(decoded.userId).select("role").lean();
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function GET(req) {
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
        .populate("user", "name phone avatar")
        .populate("product", "name mainImage slug")
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
