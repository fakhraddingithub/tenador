import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Article from "base/models/Article";
import ArticleTag from "base/models/ArticleTag";
import requireAdmin from "@/lib/requireAdmin";
import { articleApiError, unauthorizedResponse, validationResponse } from "@/lib/articleApi";
import { validateArticleTagInput } from "@/lib/articleValidation";
import { revalidateContent } from "@/lib/revalidate";

export const runtime = "nodejs";

export async function PATCH(req, { params }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid tag id" }, { status: 400 });
    const result = validateArticleTagInput(await req.json(), { partial: true });
    if (!result.ok) return validationResponse(result);
    await connectToDB();
    const tag = await ArticleTag.findById(id);
    if (!tag) return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    Object.assign(tag, result.value, { updatedBy: admin._id });
    await tag.save();
    revalidateContent(["articles"]);
    return NextResponse.json({ tag });
  } catch (error) {
    return articleApiError(error, "[PATCH /api/admin/article-tags/:id]");
  }
}

export async function DELETE(_req, { params }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid tag id" }, { status: 400 });
    await connectToDB();
    const inUse = await Article.exists({ tags: id, deletedAt: null });
    const tag = await ArticleTag.findByIdAndUpdate(id, { status: "archived", updatedBy: admin._id }, { new: true });
    if (!tag) return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    revalidateContent(["articles"]);
    return NextResponse.json({ ok: true, inUse: Boolean(inUse) });
  } catch (error) {
    return articleApiError(error, "[DELETE /api/admin/article-tags/:id]");
  }
}
