import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Article from "base/models/Article";
import requireAdmin from "@/lib/requireAdmin";
import { articleApiError, unauthorizedResponse, validationResponse } from "@/lib/articleApi";
import { validateArticleInput } from "@/lib/articleValidation";
import { revalidateContent } from "@/lib/revalidate";

export const runtime = "nodejs";
const AUTOSAVE_FIELDS = ["title", "excerpt", "cover", "blocks", "seo", "tags", "featured", "pinned"];

export async function PATCH(req, { params }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
    const body = await req.json();
    const allowed = Object.fromEntries(AUTOSAVE_FIELDS.filter((key) => key in body).map((key) => [key, body[key]]));
    const result = validateArticleInput(allowed, { partial: true });
    if (!result.ok) return validationResponse(result);
    await connectToDB();
    const article = await Article.findOne({ _id: id, deletedAt: null });
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    Object.assign(article, result.value, { updatedBy: admin._id });
    await article.save();
    if (["published", "scheduled"].includes(article.status)) revalidateContent(["articles"]);
    return NextResponse.json({ ok: true, savedAt: article.updatedAt, readingTime: article.readingTime });
  } catch (error) {
    return articleApiError(error, "[PATCH /api/admin/article-cms/:id/autosave]");
  }
}
