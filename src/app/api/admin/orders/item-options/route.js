import "base/models/registerModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import Variant from "base/models/Variant";
import OrderFlow from "base/models/OrderFlow";
import requireAdminPermission from "@/lib/requireAdminPermission";
import { rankProducts, withProductSearch } from "@/lib/productSearch";

// The order editor must not require unrelated discounts/products permissions.
export async function GET(req) {
  const { denied } = await requireAdminPermission("orders.editItems");
  if (denied) return denied;
  try {
    await connectToDB();
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    if (productId) {
      if (!mongoose.isValidObjectId(productId)) return NextResponse.json({ message: "شناسه محصول نامعتبر است" }, { status: 400 });
      const product = await Product.findById(productId).select("_id name category mainImage").lean();
      if (!product) return NextResponse.json({ message: "محصول یافت نشد" }, { status: 404 });
      const [variants, flow] = await Promise.all([
        Variant.find({ productId }).select("_id sku attributes images").lean(),
        product.category ? OrderFlow.findOne({ rootCategory: product.category, isActive: true })
          .populate("nodes.categoryId", "title name slug").lean() : null,
      ]);
      return NextResponse.json({ product, flow, items: variants.map((variant) => ({
        _id: variant._id,
        label: Object.entries(variant.attributes || {}).map(([key, value]) => `${key}: ${value}`).join(" | ") || variant.sku,
        sub: variant.sku ? `SKU: ${variant.sku}` : "", image: variant.images?.[0] || null,
      })) });
    }
    const query = (searchParams.get("q") || "").trim();
    if (!query) return NextResponse.json({ items: [] });
    const found = await Product.find(await withProductSearch({}, query))
      .select("_id name sku tag color serie mainImage brand").populate("brand", "title name").limit(80).lean();
    return NextResponse.json({ items: rankProducts(query, found).slice(0, 10).map((product) => ({
      _id: product._id, label: product.name, sub: product.brand?.title || "", image: product.mainImage || null,
    })) });
  } catch (error) {
    console.error("[admin/orders/item-options]", error);
    return NextResponse.json({ message: "خطا در دریافت اطلاعات محصول و فرایند سفارش" }, { status: 500 });
  }
}
