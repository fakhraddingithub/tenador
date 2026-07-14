import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Article from "base/models/Article";
import ArticleCategory from "base/models/ArticleCategory";
import requireAdmin from "@/lib/requireAdmin";
import { articleApiError, unauthorizedResponse, validationResponse } from "@/lib/articleApi";
import { validateArticleCategoryInput } from "@/lib/articleValidation";
import { updateArticleCategory } from "base/services/article.service";
import { revalidateContent } from "@/lib/revalidate";

export const runtime = "nodejs";

export async function PATCH(req, { params }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid category id" }, { status: 400 });
    const result = validateArticleCategoryInput(await req.json(), { partial: true });
    if (!result.ok) return validationResponse(result);
    await connectToDB();
    const category = await ArticleCategory.findById(id);
    if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });
    if (result.value.parent && !(await ArticleCategory.exists({ _id: result.value.parent }))) {
      return NextResponse.json({ error: "Parent category not found" }, { status: 400 });
    }
    await updateArticleCategory(category, result.value, admin._id);
    revalidateContent(["articles"]);
    return NextResponse.json({ category });
  } catch (error) {
    return articleApiError(error, "[PATCH /api/admin/article-categories/:id]");
  }
}

export async function DELETE(_req, { params }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid category id" }, { status: 400 });
    await connectToDB();
    if (await Article.exists({ category: id, deletedAt: null })) {
      return NextResponse.json({ error: "Category is used by articles", code: "CATEGORY_IN_USE" }, { status: 409 });
    }
    const category = await ArticleCategory.findByIdAndUpdate(id, { status: "archived", updatedBy: admin._id }, { new: true });
    if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });
    revalidateContent(["articles"]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return articleApiError(error, "[DELETE /api/admin/article-categories/:id]");
  }
}
