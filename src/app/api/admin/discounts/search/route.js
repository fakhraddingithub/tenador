// src/app/api/admin/discounts/search/route.js
import { rankBySearch, withSearch } from "@/lib/search";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import Brand from "base/models/Brand";
import Serie from "base/models/Serie";
import Category from "base/models/Category";
import Sport from "base/models/Sport";
import Variant from "base/models/Variant";
import { NextResponse } from "next/server";

import requireAdminPermission from "@/lib/requireAdminPermission";
import { rankProducts, withProductSearch } from "@/lib/productSearch";

// چند برابرِ سقفِ نمایش واکشی می‌شود تا رتبه‌بندی روی استخرِ معنادار انجام شود
const RESULT_LIMIT = 10;
const CANDIDATE_LIMIT = 80;

/** جستجوی «عنوان یا نام» — الگوی مشترکِ برند/سری/دسته/ورزش */
const byTitle = (q) => withSearch({}, q, ["title", "name"]);
const rankByTitle = (q, docs) =>
  rankBySearch(q, docs, (d) => [[d.title, 2], [d.name, 1]]).slice(0, RESULT_LIMIT);

export async function GET(req) {
  const { denied } = await requireAdminPermission("discounts.view");
  if (denied) return denied;

  await connectToDB();

  const { searchParams } = new URL(req.url);
  const type      = searchParams.get("type");
  const q         = (searchParams.get("q") || "").trim();
  const productId = searchParams.get("productId");
  const idsParam  = searchParams.get("ids");

  if (!type) return NextResponse.json({ error: "type الزامی است" }, { status: 400 });

  try {
    // ── batch resolve با آی‌دی (هنگام باز کردن فرم ویرایش) ──────────────────
    if (idsParam) {
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);

      if (type === "product") {
        const items = await Product.find({ _id: { $in: ids } }).select("_id name mainImage brand").populate("brand", "title").lean();
        return NextResponse.json({ items: items.map((p) => ({ _id: p._id, label: p.name, sub: p.brand?.title || "", image: p.mainImage || null })) });
      }
      if (type === "brand") {
        const items = await Brand.find({ _id: { $in: ids } }).select("_id name title logo").lean();
        return NextResponse.json({ items: items.map((b) => ({ _id: b._id, label: b.title || b.name, image: b.logo || null })) });
      }
      if (type === "serie") {
        const items = await Serie.find({ _id: { $in: ids } }).select("_id name title logo brand").populate("brand", "title").lean();
        return NextResponse.json({ items: items.map((s) => ({ _id: s._id, label: s.title || s.name, sub: s.brand?.title || "", image: s.logo || null })) });
      }
      if (type === "category") {
        const items = await Category.find({ _id: { $in: ids } }).select("_id name title icon image").lean();
        return NextResponse.json({ items: items.map((c) => ({ _id: c._id, label: c.title || c.name, image: c.icon || c.image || null })) });
      }
      if (type === "sport") {
        const items = await Sport.find({ _id: { $in: ids } }).select("_id name title icon image").lean();
        return NextResponse.json({ items: items.map((s) => ({ _id: s._id, label: s.title || s.name, sub: s.name || "", image: s.icon || s.image || null })) });
      }
      if (type === "variant") {
        const variants = await Variant.find({ _id: { $in: ids } }).select("_id sku attributes price images productId").lean();
        const productIds = [...new Set(variants.map((v) => String(v.productId)).filter(Boolean))];
        const products   = await Product.find({ _id: { $in: productIds } }).select("_id name").lean();
        const productMap = Object.fromEntries(products.map((p) => [String(p._id), p.name]));
        return NextResponse.json({
          items: variants.map((v) => {
            const attrStr  = Object.entries(v.attributes || {}).map(([k, val]) => `${k}: ${val}`).join(" | ");
            const prodName = productMap[String(v.productId)] || "";
            return { _id: v._id, label: prodName ? `${prodName} | ${attrStr || v.sku}` : (attrStr || v.sku), image: v.images?.[0] || null };
          }),
        });
      }
    }

    // ── محصول ────────────────────────────────────────────────────────────────
    if (type === "product") {
      if (!q) return NextResponse.json({ items: [] });
      const found = await Product.find(await withProductSearch({}, q))
        .select("_id name sku tag color serie mainImage brand").populate("brand", "title name").limit(CANDIDATE_LIMIT).lean();
      const items = rankProducts(q, found).slice(0, RESULT_LIMIT);
      return NextResponse.json({ items: items.map((p) => ({ _id: p._id, label: p.name, sub: p.brand?.title || "", image: p.mainImage || null })) });
    }

    // ── برند ──────────────────────────────────────────────────────────────────
    if (type === "brand") {
      if (!q) return NextResponse.json({ items: [] });
      const items = rankByTitle(q, await Brand.find(byTitle(q))
        .select("_id name title logo").limit(CANDIDATE_LIMIT).lean());
      return NextResponse.json({ items: items.map((b) => ({ _id: b._id, label: b.title || b.name, sub: b.name || "", image: b.logo || null })) });
    }

    // ── سری ───────────────────────────────────────────────────────────────────
    if (type === "serie") {
      if (!q) return NextResponse.json({ items: [] });
      const items = rankByTitle(q, await Serie.find(byTitle(q))
        .select("_id name title logo brand").populate("brand", "title").limit(CANDIDATE_LIMIT).lean());
      return NextResponse.json({ items: items.map((s) => ({ _id: s._id, label: s.title || s.name, sub: s.brand?.title || "", image: s.logo || null })) });
    }

    // ── دسته‌بندی ─────────────────────────────────────────────────────────────
    if (type === "category") {
      if (!q) return NextResponse.json({ items: [] });
      const items = rankByTitle(q, await Category.find(byTitle(q))
        .select("_id name title icon image")
        .limit(CANDIDATE_LIMIT)
        .lean());
      return NextResponse.json({ items: items.map((c) => ({ _id: c._id, label: c.title || c.name, image: c.icon || c.image || null })) });
    }

    // ── ورزش ──────────────────────────────────────────────────────────────────
    if (type === "sport") {
      if (!q) return NextResponse.json({ items: [] });
      const items = rankByTitle(q, await Sport.find(byTitle(q))
        .select("_id name title icon image").limit(CANDIDATE_LIMIT).lean());
      return NextResponse.json({ items: items.map((s) => ({ _id: s._id, label: s.title || s.name, sub: s.name || "", image: s.icon || s.image || null })) });
    }

    // ── واریانت ───────────────────────────────────────────────────────────────
    if (type === "variant") {
      if (productId) {
        const variants = await Variant.find({ productId }).select("_id sku attributes price images").lean();
        return NextResponse.json({
          items: variants.map((v) => {
            const attrStr = Object.entries(v.attributes || {}).map(([k, val]) => `${k}: ${val}`).join(" | ");
            return { _id: v._id, label: attrStr || v.sku, sub: `SKU: ${v.sku} | قیمت: ${v.price}`, image: v.images?.[0] || null };
          }),
        });
      }
      if (!q) return NextResponse.json({ items: [] });
      const products = rankProducts(q, await Product.find(await withProductSearch({}, q)).select("_id name sku tag color serie mainImage brand").populate("brand", "title name").limit(CANDIDATE_LIMIT).lean()).slice(0, RESULT_LIMIT);
      return NextResponse.json({ items: products.map((p) => ({ _id: p._id, label: p.name, sub: "انتخاب برای مشاهده واریانت‌ها", image: p.mainImage || null, isProduct: true })) });
    }

    return NextResponse.json({ error: "type معتبر نیست" }, { status: 400 });
  } catch (err) {
    console.error("Discount search error:", err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
