import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import ArticleCategory from "base/models/ArticleCategory";
import requireAdminPermission from "@/lib/requireAdminPermission";
import { articleApiError, validationResponse } from "@/lib/articleApi";
import { validateArticleCategoryInput } from "@/lib/articleValidation";
import { assertArticleCategoryRouteAvailable } from "base/services/article.service";
import { revalidateContent } from "@/lib/revalidate";

export const runtime = "nodejs";

export async function GET() {
  const { denied } = await requireAdminPermission("articleTaxonomy.view");
  if (denied) return denied;

  try {
    await connectToDB();
    const categories = await ArticleCategory.find({}).populate("parent", "name slug").sort({ order: 1, name: 1 }).lean();
    return NextResponse.json({ categories });
  } catch (error) {
    return articleApiError(error, "[GET /api/admin/article-categories]");
  }
}

export async function POST(req) {
  const { actor: admin, denied } = await requireAdminPermission("articleTaxonomy.manage");
  if (denied) return denied;

  try {
    const result = validateArticleCategoryInput(await req.json());
    if (!result.ok) return validationResponse(result);
    await connectToDB();
    await assertArticleCategoryRouteAvailable(result.value.slug);
    if (result.value.parent && !(await ArticleCategory.exists({ _id: result.value.parent }))) {
      return NextResponse.json({ error: "Parent category not found" }, { status: 400 });
    }
    const category = await ArticleCategory.create({ ...result.value, createdBy: admin._id, updatedBy: admin._id });
    revalidateContent(["articles"]);
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return articleApiError(error, "[POST /api/admin/article-categories]");
  }
}
