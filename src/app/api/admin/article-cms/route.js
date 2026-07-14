import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Article from "base/models/Article";
import requireAdmin from "@/lib/requireAdmin";
import { articleApiError, unauthorizedResponse } from "@/lib/articleApi";

export const runtime = "nodejs";

const STATUSES = ["draft", "review", "scheduled", "published", "archived"];

function safeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    await connectToDB();

    const searchParams = new URL(req.url).searchParams;
    const view = searchParams.get("view") || "all";
    const q = searchParams.get("q")?.trim() || "";
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "20", 10) || 20));
    const filter = view === "trash" ? { deletedAt: { $ne: null } } : { deletedAt: null };
    if (STATUSES.includes(view)) filter.status = view;
    if (q) filter.$or = [{ title: { $regex: safeRegex(q), $options: "i" } }, { slug: { $regex: safeRegex(q), $options: "i" } }];

    const [articles, total, statusCounts, trash] = await Promise.all([
      Article.find(filter)
        .select("title slug category author status publishedAt readingTime featured pinned currentRevision deletedAt createdAt updatedAt cover")
        .populate("category", "name slug")
        .populate("author", "name lastName avatar")
        .sort({ pinned: -1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Article.countDocuments(filter),
      Article.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Article.countDocuments({ deletedAt: { $ne: null } }),
    ]);
    const counts = { all: 0, draft: 0, review: 0, scheduled: 0, published: 0, archived: 0, trash };
    for (const item of statusCounts) {
      if (item._id in counts) counts[item._id] = item.count;
      counts.all += item.count;
    }
    return NextResponse.json({ articles, counts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    return articleApiError(error, "[GET /api/admin/article-cms]");
  }
}
