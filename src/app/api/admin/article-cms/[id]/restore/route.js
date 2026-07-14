import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Article from "base/models/Article";
import ArticleRevision from "base/models/ArticleRevision";
import ArticleRedirect from "base/models/ArticleRedirect";
import requireAdmin from "@/lib/requireAdmin";
import { articleApiError, unauthorizedResponse } from "@/lib/articleApi";
import { revalidateContent } from "@/lib/revalidate";

export const runtime = "nodejs";

export async function POST(_req, { params }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
    await connectToDB();
    const article = await Article.findOne({ _id: id, deletedAt: { $ne: null } });
    if (!article) return NextResponse.json({ error: "Trashed article not found" }, { status: 404 });
    article.deletedAt = null;
    article.status = "draft";
    article.updatedBy = admin._id;
    article.currentRevision += 1;
    await article.save();
    await Promise.all([
      ArticleRevision.create({ article: article._id, revision: article.currentRevision, snapshot: article.toObject(), reason: "Article restored from trash", createdBy: admin._id }),
      ArticleRedirect.updateMany({ article: article._id }, { $set: { active: true } }),
    ]);
    revalidateContent(["articles"]);
    return NextResponse.json({ article });
  } catch (error) {
    return articleApiError(error, "[POST /api/admin/article-cms/:id/restore]");
  }
}
