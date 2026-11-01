/**
 * src/app/api/product/[productId]/price/route.js
 *
 * قیمت نهایی یک محصول را به تومان برمی‌گرداند
 * مناسب برای نمایش قیمت در صفحه محصول
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import Variant from "base/models/Variant";
import { getRate } from "base/services/priceEngine";
import { getProductDisplayPrice } from "base/services/productDisplayPrice.service";
import { getProductPricingUser } from "@/lib/productPageData";
import requireAdminPermission from "@/lib/requireAdminPermission";


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
      .populate("variants")
      .lean();

    if (!product) {
      return NextResponse.json({ error: "محصول یافت نشد" }, { status: 404 });
    }

    const [user, rate] = await Promise.all([getProductPricingUser(), getRate()]);

    return NextResponse.json(await getProductDisplayPrice(product, rate, user));
  } catch (err) {
    console.error("خطا در دریافت قیمت محصول:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * ⚠️ این هندلر با وجود مسیرِ «/price»، خودِ محصول و همه‌ی واریانت‌هایش را حذف
 * می‌کند (کپیِ DELETE /api/product/[productId]). هیچ فراخوانی‌ای در کدبیس
 * ندارد و پیش‌تر فقط «کاربرِ واردشده» را می‌خواست — یعنی هر مشتریِ عادی
 * می‌توانست هر محصولی را حذف کند. کلید بر اساس کاری که *واقعاً* می‌کند
 * انتخاب شده است، نه بر اساس نامِ مسیر.
 */
export async function DELETE(request, { params }) {
  const { denied } = await requireAdminPermission("products.delete");
  if (denied) return denied;

  try {
    const param = await params
    const { productId } = param;

    if (!productId) {
      return NextResponse.json({ error: "شناسه محصول الزامی است" }, { status: 400 });
    }

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