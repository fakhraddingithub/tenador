import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import requireAdmin from "@/lib/requireAdmin";
import { articleApiError, unauthorizedResponse, validationResponse } from "@/lib/articleApi";
import { validateArticleInput } from "@/lib/articleValidation";
import { getArticleForAdmin, trashArticle, updateArticle } from "base/services/article.service";
import { revalidateContent } from "@/lib/revalidate";

export const runtime = "nodejs";

function invalidId(id) {
  return !mongoose.isValidObjectId(id);
}

export async function GET(_req, { params }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    const { id } = await params;
    if (invalidId(id)) return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
    await connectToDB();
    const article = await getArticleForAdmin(id);
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    return NextResponse.json({ article });
  } catch (error) {
    return articleApiError(error, "[GET /api/admin/articles/:id]");
  }
}

export async function PATCH(req, { params }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    const { id } = await params;
    if (invalidId(id)) return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
    const body = await req.json();
    const result = validateArticleInput(body, { partial: true });
    if (!result.ok) return validationResponse(result);
    await connectToDB();
    const article = await updateArticle(id, result.value, admin._id, body.revisionReason);
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    revalidateContent(["articles"]);
    return NextResponse.json({ article });
  } catch (error) {
    return articleApiError(error, "[PATCH /api/admin/articles/:id]");
  }
}

export async function DELETE(_req, { params }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    const { id } = await params;
    if (invalidId(id)) return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
    await connectToDB();
    const article = await trashArticle(id, admin._id);
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    revalidateContent(["articles"]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return articleApiError(error, "[DELETE /api/admin/articles/:id]");
  }
}
