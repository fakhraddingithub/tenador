import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import ArticleTag from "base/models/ArticleTag";
import requireAdmin from "@/lib/requireAdmin";
import { articleApiError, unauthorizedResponse, validationResponse } from "@/lib/articleApi";
import { validateArticleTagInput } from "@/lib/articleValidation";
import { revalidateContent } from "@/lib/revalidate";

export const runtime = "nodejs";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    await connectToDB();
    const tags = await ArticleTag.find({}).sort({ name: 1 }).lean();
    return NextResponse.json({ tags });
  } catch (error) {
    return articleApiError(error, "[GET /api/admin/article-tags]");
  }
}

export async function POST(req) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
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
