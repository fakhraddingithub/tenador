import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Article from "base/models/Article";
import requireAdmin from "@/lib/requireAdmin";
import { articleApiError, unauthorizedResponse } from "@/lib/articleApi";
import { createArticle } from "base/services/article.service";
import { normalizeArticleSlug } from "base/utils/articleSlug";

export const runtime = "nodejs";

export async function POST(_req, { params }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
    await connectToDB();
    const source = await Article.findOne({ _id: id, deletedAt: null }).lean();
    if (!source) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    const baseSlug = normalizeArticleSlug(`${source.slug}-copy`);
    let slug = baseSlug;
    let suffix = 2;
    while (await Article.exists({ category: source.category, slug })) slug = `${baseSlug}-${suffix++}`;
    const article = await createArticle({
      title: `${source.title} (کپی)`, slug, category: source.category, excerpt: source.excerpt,
      cover: source.cover, blocks: source.blocks, seo: { ...source.seo, canonicalUrl: "" },
      author: admin._id, status: "draft", publishedAt: null, tags: source.tags,
      featured: false, pinned: false,
    }, admin._id, "Article duplicated");
    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    return articleApiError(error, "[POST /api/admin/article-cms/:id/duplicate]");
  }
}
