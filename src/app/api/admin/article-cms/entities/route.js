import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Article from "base/models/Article";
import Brand from "base/models/Brand";
import Category from "base/models/Category";
import Product from "base/models/Product";
import Serie from "base/models/Serie";
import Sport from "base/models/Sport";
import UsedProduct from "base/models/UsedProduct";
import requireAdmin from "@/lib/requireAdmin";
import { articleApiError, unauthorizedResponse } from "@/lib/articleApi";

export const runtime = "nodejs";

function regex(value) {
  return new RegExp(String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

export async function GET(req) {
  try {
    const admin = await requireAdmin();
    if (!admin) return unauthorizedResponse();
    await connectToDB();
    const params = new URL(req.url).searchParams;
    const type = params.get("type");
    const ids = (params.get("ids") || "").split(",").filter((id) => mongooseId(id));
    const q = params.get("q")?.trim() || "";
    const idFilter = ids.length ? { _id: { $in: ids } } : null;
    const term = regex(q);
    let items = [];

    if (type === "product") {
      const docs = await Product.find(idFilter || { name: term }).select("name mainImage brand").populate("brand", "title").limit(20).lean();
      items = docs.map((x) => ({ _id: x._id, label: x.name, sub: x.brand?.title || "", image: x.mainImage || null }));
    } else if (type === "brand") {
      const docs = await Brand.find(idFilter || { $or: [{ title: term }, { name: term }] }).select("title name logo").limit(20).lean();
      items = docs.map((x) => ({ _id: x._id, label: x.title || x.name, image: x.logo || null }));
    } else if (type === "collection") {
      const docs = await Serie.find(idFilter || { $or: [{ title: term }, { name: term }] }).select("title name logo brand").populate("brand", "title").limit(20).lean();
      items = docs.map((x) => ({ _id: x._id, label: x.title || x.name, sub: x.brand?.title || "", image: x.logo || null }));
    } else if (type === "sport") {
      const docs = await Sport.find(idFilter || { $or: [{ title: term }, { name: term }] }).select("title name image icon").limit(20).lean();
      items = docs.map((x) => ({ _id: x._id, label: x.title || x.name, image: x.image || x.icon || null }));
    } else if (type === "category") {
      const docs = await Category.find(idFilter || { $or: [{ title: term }, { name: term }] }).select("title name image icon").limit(20).lean();
      items = docs.map((x) => ({ _id: x._id, label: x.title || x.name, image: x.image || x.icon || null }));
    } else if (type === "article") {
      const docs = await Article.find({ ...(idFilter || { title: term }), deletedAt: null }).select("title slug cover status").limit(20).lean();
      items = docs.map((x) => ({ _id: x._id, label: x.title, sub: x.status, image: x.cover?.url || null }));
    } else if (type === "usedProduct") {
      const docs = await UsedProduct.find(idFilter || { name: term }).select("name images status").limit(20).lean();
      items = docs.map((x) => ({ _id: x._id, label: x.name, sub: x.status || "", image: x.images?.[0] || null }));
    } else {
      return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
    }
    return NextResponse.json({ items });
  } catch (error) {
    return articleApiError(error, "[GET /api/admin/article-cms/entities]");
  }
}

function mongooseId(value) {
  return /^[a-f\d]{24}$/i.test(String(value));
}
