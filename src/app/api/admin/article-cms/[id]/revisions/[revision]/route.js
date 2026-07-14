import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import ArticleRevision from "base/models/ArticleRevision";
import requireAdmin from "@/lib/requireAdmin";
import { articleApiError, unauthorizedResponse } from "@/lib/articleApi";
import { updateArticle } from "base/services/article.service";
import { revalidateContent } from "@/lib/revalidate";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    const { id, revision } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
    await connectToDB();
    const item = await ArticleRevision.findOne({ article: id, revision: Number(revision) }).populate("createdBy", "name lastName avatar").lean();
    if (!item) return NextResponse.json({ error: "Revision not found" }, { status: 404 });
    return NextResponse.json({ revision: item });
  } catch (error) {
    return articleApiError(error, "[GET /api/admin/article-cms/:id/revisions/:revision]");
  }
}

export async function POST(_req, { params }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    const { id, revision } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
    await connectToDB();
    const item = await ArticleRevision.findOne({ article: id, revision: Number(revision) }).lean();
    if (!item) return NextResponse.json({ error: "Revision not found" }, { status: 404 });
    const snapshot = { ...item.snapshot };
    for (const field of ["_id", "createdAt", "updatedAt", "currentRevision", "deletedAt", "__v"]) delete snapshot[field];
    const article = await updateArticle(id, snapshot, admin._id, `Restored revision ${revision}`);
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    revalidateContent(["articles"]);
    return NextResponse.json({ article });
  } catch (error) {
    return articleApiError(error, "[POST /api/admin/article-cms/:id/revisions/:revision]");
  }
}
