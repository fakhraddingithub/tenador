// src/app/api/admin/discounts/search/route.js
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import Brand from "base/models/Brand";
import Serie from "base/models/Serie";
import Variant from "base/models/Variant";
import { NextResponse } from "next/server";

export async function GET(req) {
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
      const items = await Product.find({ name: { $regex: q, $options: "i" } })
        .select("_id name mainImage brand").populate("brand", "title").limit(10).lean();
      return NextResponse.json({ items: items.map((p) => ({ _id: p._id, label: p.name, sub: p.brand?.title || "", image: p.mainImage || null })) });
    }

    // ── برند ──────────────────────────────────────────────────────────────────
    if (type === "brand") {
      if (!q) return NextResponse.json({ items: [] });
      const items = await Brand.find({ $or: [{ title: { $regex: q, $options: "i" } }, { name: { $regex: q, $options: "i" } }] })
        .select("_id name title logo").limit(10).lean();
      return NextResponse.json({ items: items.map((b) => ({ _id: b._id, label: b.title || b.name, sub: b.name || "", image: b.logo || null })) });
    }

    // ── سری ───────────────────────────────────────────────────────────────────
    if (type === "serie") {
      if (!q) return NextResponse.json({ items: [] });
      const items = await Serie.find({ $or: [{ title: { $regex: q, $options: "i" } }, { name: { $regex: q, $options: "i" } }] })
        .select("_id name title logo brand").populate("brand", "title").limit(10).lean();
      return NextResponse.json({ items: items.map((s) => ({ _id: s._id, label: s.title || s.name, sub: s.brand?.title || "", image: s.logo || null })) });
    }

    // ── واریانت ───────────────────────────────────────────────────────────────
    if (type === "variant") {
      if (productId) {
        const variants = await Variant.find({ productId }).select("_id sku attributes price images stock").lean();
        return NextResponse.json({
          items: variants.map((v) => {
            const attrStr = Object.entries(v.attributes || {}).map(([k, val]) => `${k}: ${val}`).join(" | ");
            return { _id: v._id, label: attrStr || v.sku, sub: `SKU: ${v.sku} | قیمت: ${v.price}`, stock: v.stock, image: v.images?.[0] || null };
          }),
        });
      }
      if (!q) return NextResponse.json({ items: [] });
      const products = await Product.find({ name: { $regex: q, $options: "i" } }).select("_id name mainImage").limit(10).lean();
      return NextResponse.json({ items: products.map((p) => ({ _id: p._id, label: p.name, sub: "انتخاب برای مشاهده واریانت‌ها", image: p.mainImage || null, isProduct: true })) });
    }

    return NextResponse.json({ error: "type معتبر نیست" }, { status: 400 });
  } catch (err) {
    console.error("Discount search error:", err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
