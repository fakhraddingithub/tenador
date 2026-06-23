import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import ContactMessage from "base/models/ContactMessage";

export const runtime = "nodejs";

/**
 * GET /api/admin/contact-messages?status=new|read|archived|all&page=1&limit=20
 * فهرستِ پیام‌های فرم تماس + شمارشِ هر وضعیت.
 */
export async function GET(req) {
  await connectToDB();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "all";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    50,
    Math.max(5, parseInt(searchParams.get("limit") || "20", 10))
  );

  const filter = {};
  if (["new", "read", "archived"].includes(status)) filter.status = status;

  const [messages, total, counts] = await Promise.all([
    ContactMessage.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ContactMessage.countDocuments(filter),
    ContactMessage.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  const countMap = { new: 0, read: 0, archived: 0 };
  counts.forEach((c) => {
    if (c._id in countMap) countMap[c._id] = c.count;
  });

  return NextResponse.json({
    messages: JSON.parse(JSON.stringify(messages)),
    total,
    page,
    limit,
    counts: countMap,
  });
}
