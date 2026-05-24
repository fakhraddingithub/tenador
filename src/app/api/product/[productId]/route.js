/**
 * src/app/api/product/[productId]/price/route.js
 *
 * قیمت نهایی یک محصول را به تومان برمی‌گرداند
 * مناسب برای نمایش قیمت در صفحه محصول
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import Product from "base/models/Product";
import Variant from "base/models/Variant";
import { getRate, computeProductPrice } from "base/services/priceEngine";
import { eurToToman } from "@/lib/Exchangerate";

async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

export async function GET(request, { params }) {
  try {
    const { productId } = params;

    if (!productId) {
      return NextResponse.json({ error: "شناسه محصول الزامی است" }, { status: 400 });
    }

    await connectToDB();

    const product = await Product.findById(productId)
      .populate("brand", "_id")
      .populate("category", "_id")
      .populate("serie", "_id")
      .lean();

    if (!product) {
      return NextResponse.json({ error: "محصول یافت نشد" }, { status: 404 });
    }

    const user = await getUserFromToken();
    const rate = await getRate();

    // قیمت پایه محصول
    const priceResult = await computeProductPrice(product, rate, user);

    // قیمت واریانت‌ها
    let variants = [];
    if (product.variants?.length) {
      const rawVariants = await Variant.find({ _id: { $in: product.variants } }).lean();
      variants = rawVariants.map((v) => {
        const variantBaseToman = eurToToman(v.price, rate);
        const unitDiscount = Math.min(
          Math.floor(variantBaseToman * (priceResult.discountPercent / 100)),
          variantBaseToman
        );
        return {
          _id:            v._id,
          sku:            v.sku,
          attributes:     Object.fromEntries(v.attributes || []),
          stock:          v.stock,
          basePriceToman: variantBaseToman,
          finalPriceToman: variantBaseToman - unitDiscount,
          discountAmount:  unitDiscount,
          discountPercent: priceResult.discountPercent,
        };
      });
    }

    return NextResponse.json({
      productId:      product._id,
      basePriceToman: priceResult.basePriceToman,
      finalPriceToman: priceResult.finalPriceToman,
      discountAmount:  priceResult.discountAmount,
      discountPercent: priceResult.discountPercent,
      appliedRules:    priceResult.appliedRules,
      variants,
      rate,
    });
  } catch (err) {
    console.error("خطا در دریافت قیمت محصول:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
