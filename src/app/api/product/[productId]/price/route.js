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
    const param = await params
    const { productId } = param;

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
        // قیمت ۰ یا خالی واریانت → قیمت پایه محصول (پشتیبانی از داده‌های قدیمی)
        const variantBaseToman = eurToToman(v.price || product.basePrice || 0, rate);
        const unitDiscount = Math.min(
          Math.floor(variantBaseToman * (priceResult.discountPercent / 100)),
          variantBaseToman
        );
        return {
          _id:            v._id,
          sku:            v.sku,
          attributes:     v.attributes || [],
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

export async function DELETE(request, { params }) {
  try {
    const param = await params
    const { productId } = param;

    if (!productId) {
      return NextResponse.json({ error: "شناسه محصول الزامی است" }, { status: 400 });
    }

    // ۱. بررسی احراز هویت کاربر برای سطح دسترسی حذف
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "لطفاً ابتدا وارد حساب کاربری خود شوید" }, { status: 401 });
    }

    // نکته اختیاری: اگر فیلد role دارید، می‌توانید دسترسی ادمین را اینجا چک کنید:
    // if (user.role !== "ADMIN") return NextResponse.json({ error: "شما دسترسی لازم را ندارید" }, { status: 403 });

    await connectToDB();

    // ۲. پیدا کردن محصول برای دسترسی به لیست واریانت‌ها قبل از حذف نهایی
    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json({ error: "محصولی با این شناسه یافت نشد" }, { status: 404 });
    }

    // ۳. حذف تمام واریانت‌های متصل به این محصول (برای جلوگیری از باقی ماندن دیتای یتیم در دیتابیس)
    if (product.variants && product.variants.length > 0) {
      await Variant.deleteMany({ _id: { $in: product.variants } });
    }

    // ۴. حذف خود محصول
    await Product.findByIdAndDelete(productId);

    return NextResponse.json(
      { message: "محصول و تمامی واریانت‌های مربوط به آن با موفقیت حذف شدند" },
      { status: 200 }
    );
  } catch (err) {
    console.error("خطا در حذف محصول:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}