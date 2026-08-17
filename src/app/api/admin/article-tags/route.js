import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import ArticleTag from "base/models/ArticleTag";
import requireAdminPermission from "@/lib/requireAdminPermission";
import { articleApiError, validationResponse } from "@/lib/articleApi";
import { validateArticleTagInput } from "@/lib/articleValidation";
import { revalidateContent } from "@/lib/revalidate";

export const runtime = "nodejs";

export async function GET() {
  const { denied } = await requireAdminPermission("articleTaxonomy.view");
  if (denied) return denied;

  try {
    await connectToDB();
    const tags = await ArticleTag.find({}).sort({ name: 1 }).lean();
    return NextResponse.json({ tags });
  } catch (error) {
    return articleApiError(error, "[GET /api/admin/article-tags]");
  }
}

export async function POST(req) {
  const { actor: admin, denied } = await requireAdminPermission("articleTaxonomy.manage");
  if (denied) return denied;

  try {
    const result = validateArticleTagInput(await req.json());
    if (!result.ok) return validationResponse(result);
    await connectToDB();
    const tag = await ArticleTag.create({ ...result.value, createdBy: admin._id, updatedBy: admin._id });
    revalidateContent(["articles"]);
    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    return articleApiError(error, "[POST /api/admin/article-tags]");
  }
}
