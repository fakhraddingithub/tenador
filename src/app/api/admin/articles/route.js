import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import requireAdmin from "@/lib/requireAdmin";
import { articleApiError, unauthorizedResponse, validationResponse } from "@/lib/articleApi";
import { articleListQuery, validateArticleInput } from "@/lib/articleValidation";
import { createArticle, listArticles } from "base/services/article.service";
import { revalidateContent } from "@/lib/revalidate";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    await connectToDB();
    return NextResponse.json(await listArticles(articleListQuery(new URL(req.url).searchParams)));
  } catch (error) {
    return articleApiError(error, "[GET /api/admin/articles]");
  }
}

export async function POST(req) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    const body = await req.json();
    const result = validateArticleInput({ ...body, author: body.author || admin._id });
    if (!result.ok) return validationResponse(result);
    await connectToDB();
    const article = await createArticle(result.value, admin._id, body.revisionReason);
    revalidateContent(["articles"]);
    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    return articleApiError(error, "[POST /api/admin/articles]");
  }
}
