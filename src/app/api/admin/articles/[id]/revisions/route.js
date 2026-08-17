import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import requireAdminPermission from "@/lib/requireAdminPermission";
import { articleApiError } from "@/lib/articleApi";
import { listArticleRevisions } from "base/services/article.service";

export const runtime = "nodejs";

export async function GET(req, { params }) {
  const { denied } = await requireAdminPermission("articles.view");
  if (denied) return denied;

  try {
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
    const searchParams = new URL(req.url).searchParams;
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Number.parseInt(searchParams.get("limit") || "20", 10) || 20;
    await connectToDB();
    return NextResponse.json(await listArticleRevisions(id, page, limit));
  } catch (error) {
    return articleApiError(error, "[GET /api/admin/articles/:id/revisions]");
  }
}
