import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import requireAdminPermission from "@/lib/requireAdminPermission";
import { articleApiError, validationResponse } from "@/lib/articleApi";
import { articleListQuery, validateArticleInput } from "@/lib/articleValidation";
import { createArticle, listArticles } from "base/services/article.service";
import { revalidateContent } from "@/lib/revalidate";

export const runtime = "nodejs";

export async function GET(req) {
  const { denied } = await requireAdminPermission("articles.view");
  if (denied) return denied;

  try {
    await connectToDB();
    return NextResponse.json(await listArticles(articleListQuery(new URL(req.url).searchParams)));
  } catch (error) {
    return articleApiError(error, "[GET /api/admin/articles]");
  }
}

export async function POST(req) {
  const { actor: admin, denied } = await requireAdminPermission("articles.create");
  if (denied) return denied;

  try {
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
