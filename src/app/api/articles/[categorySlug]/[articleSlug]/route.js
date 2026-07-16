import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { articleApiError } from "@/lib/articleApi";
import { resolvePublishedArticle } from "base/services/article.service";
import { decodeSlugParam } from "base/utils/articleSlug";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  try {
    const { categorySlug, articleSlug } = await params;
    await connectToDB();
    const result = await resolvePublishedArticle(decodeSlugParam(categorySlug), decodeSlugParam(articleSlug));
    if (!result) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    if (result.kind === "redirect") {
      return NextResponse.json(
        { redirect: result.location },
        { status: result.statusCode, headers: { Location: result.location } },
      );
    }
    return NextResponse.json({ article: result.article });
  } catch (error) {
    return articleApiError(error, "[GET /api/articles/:category/:article]");
  }
}
