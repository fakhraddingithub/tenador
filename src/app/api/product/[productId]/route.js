/**
 * src/app/api/product/[productId]/route.js
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import connectToDB from "base/configs/db";

import Product from "base/models/Product";
import Category from "base/models/Category";
import Variant from "base/models/Variant";
import "base/models/LimitedEdition";

import { verifyToken } from "base/utils/auth";
import { revalidateContent } from "@/lib/revalidate";
import { makeComboKey } from "@/lib/variantKey";

// --------------------------------------------------
// Helpers
// --------------------------------------------------

async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;

  if (!token) return null;

  return verifyToken(token) || null;
}

// --------------------------------------------------
// GET - دریافت کامل محصول
// --------------------------------------------------

export async function GET(request, { params }) {
  try {
    const { productId } = await params;

    if (!productId) {
      return NextResponse.json(
        { error: "شناسه محصول الزامی است" },
        { status: 400 }
      );
    }

    await connectToDB();

    const product = await Product.findById(productId)
      .populate("brand")
      .populate("category")
      .populate("serie")
      .populate("limitedEdition")
      .populate("sport")
      .populate("athlete")
      .populate({
        path: "variants",
        model: Variant,
      })
      .lean();

    if (!product) {
      return NextResponse.json(
        { error: "محصول یافت نشد" },
        { status: 404 }
      );
    }

    // ✨ اضافه شد: اگر محصول غیرفعال بود، فقط به ادمین (کاربر لاگین شده) اجازه مشاهده بده
    if (product.isActive === false) {
      const user = await getUserFromToken();
      if (!user) {
        return NextResponse.json(
          { error: "این محصول غیرفعال شده است و امکان مشاهده آن وجود ندارد" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { product },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET PRODUCT ERROR:", err);

    return NextResponse.json(
      { error: err.message || "خطا در دریافت محصول" },
      { status: 500 }
    );
  }
}

// --------------------------------------------------
// PUT - ویرایش کامل محصول
// --------------------------------------------------

export async function PUT(request, { params }) {
  try {
    const { productId } = await params;

    if (!productId) {
      return NextResponse.json(
        { error: "شناسه محصول الزامی است" },
        { status: 400 }
      );
    }

    // احراز هویت
    const user = await getUserFromToken();

    if (!user) {
      return NextResponse.json(
        { error: "ابتدا وارد حساب کاربری شوید" },
        { status: 401 }
      );
    }

    await connectToDB();

    const body = await request.json();

    const {
      name,
      shortDescription,
      longDescription,
      color,
      basePrice,
      category,
      tag,
      mainImage,
      gallery,
      brand,
      serie,
      limitedEdition,
      sport,
      athlete,
      attributes,
      technicalStats,
      customTabItems,
      label,
      isActive, // ✨ اضافه شد: دریافت وضعیت فعال/غیرفعال از فرانت‌اند
      variantOptions,
      variantDetails,
      selectedCombos, // آرایه‌ی کلیدِ ترکیب‌های انتخاب‌شده برای ساخت (اختیاری)
      variantMeta, // متادیتای سطحِ مقدار (تصاویرِ مشترک هر مقدار و ...)
    } = body;

    const product = await Product.findById(productId);

    if (!product) {
      return NextResponse.json(
        { error: "محصول یافت نشد" },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // ساخت واریانت‌ها
    // --------------------------------------------------

    const generatedVariants = [];

    if (
      variantOptions &&
      typeof variantOptions === "object" &&
      Object.keys(variantOptions).length > 0
    ) {
      const optionKeys = Object.keys(variantOptions);

      function generateCombinations(options) {
        const keys = Object.keys(options).filter(
          (k) =>
            Array.isArray(options[k]) &&
            options[k].length > 0
        );

        if (!keys.length) return [];

        const result = [];

        function helper(index, current) {
          if (index === keys.length) {
            result.push({ ...current });
            return;
          }

          const key = keys[index];

          for (const val of options[key]) {
            helper(index + 1, {
              ...current,
              [key]: val,
            });
          }
        }

        helper(0, {});

        return result;
      }

      const allCombinations = generateCombinations(variantOptions);
      // اگر لیست انتخاب‌شده ارسال شده باشد فقط همان ترکیب‌ها ساخته می‌شوند؛
      // در غیر این صورت همه‌ی ترکیب‌ها (سازگاری با کلاینت‌های قدیمی)
      const selectedSet = Array.isArray(selectedCombos) ? new Set(selectedCombos) : null;
      const combinations = selectedSet
        ? allCombinations.filter((c) => selectedSet.has(makeComboKey(c)))
        : allCombinations;

      // حذف واریانت‌های قبلی
      if (product.variants?.length > 0) {
        await Variant.deleteMany({
          _id: { $in: product.variants },
        });
      }

      let variantIndex = 0;

      for (const combo of combinations) {
        const comboKey = makeComboKey(combo);

        const detail = variantDetails?.[comboKey] || {};

        const variant = await Variant.create({
          productId: product._id,
          categoryId: category,
          attributes: combo,
          // قیمت ۰ یا خالی → قیمت پایه محصول ذخیره می‌شود
          price: Number(detail.price) || Number(basePrice) || 0,
          images: Array.isArray(detail.images) ? detail.images : [],
          // SKU یکتا و پایدار بر اساس ایندکس (مقادیر ممکن است فارسی/تکراری باشند)
          sku: `${product._id}-V${++variantIndex}`.toUpperCase(),
        });

        generatedVariants.push(variant._id);
      }
    }

    let resolvedCustomTabItemIds = [];
    if (Array.isArray(customTabItems) && customTabItems.length > 0 && category) {
      const targetCategory = await Category.findById(category).select("customTab").lean();
      const categoryItems = targetCategory?.customTab?.items || [];
      resolvedCustomTabItemIds = customTabItems
        .map((title) => categoryItems.find((it) => it.title === title)?._id)
        .filter(Boolean);
    }

    // --------------------------------------------------
    // آپدیت محصول
    // --------------------------------------------------

    product.name = name || "";
    product.shortDescription = shortDescription || "";
    product.longDescription = longDescription || "";
    product.color = color || "";
    product.basePrice = Number(basePrice) || 0;
    product.category = category || null;
    product.tag = Array.isArray(tag) ? tag : [];
    product.mainImage = mainImage || "";
    product.gallery = Array.isArray(gallery) ? gallery : [];
    product.brand = brand || null;
    product.serie = serie || null;
    product.limitedEdition = limitedEdition || null;
    product.sport = sport || null;
    product.athlete = Array.isArray(athlete) ? athlete : [];
    
    product.attributes =
      attributes && typeof attributes === "object" ? attributes : {};

    product.technicalStats =
      technicalStats && typeof technicalStats === "object" ? technicalStats : {};

    product.customTabItems = resolvedCustomTabItemIds;

    product.variantMeta =
      variantMeta && typeof variantMeta === "object" ? variantMeta : {};

    product.label = label || "none";

    // ✨ اضافه شد: اگر isActive فرستاده شده بود مقدار را به‌روزرسانی کن، در غیر این صورت مقدار قبلی را حفظ کن
    product.isActive = typeof isActive === "boolean" ? isActive : product.isActive;

    product.variants = generatedVariants;

    await product.save();

    // --------------------------------------------------
    // محصول نهایی populated
    // --------------------------------------------------

    const updatedProduct = await Product.findById(product._id)
      .populate("brand")
      .populate("category")
      .populate("serie")
      .populate("limitedEdition")
      .populate("sport")
      .populate("athlete")
      .populate("variants")
      .lean();

    revalidateContent(["products"]);

    return NextResponse.json(
      {
        message: "محصول با موفقیت ویرایش شد",
        product: updatedProduct,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("UPDATE PRODUCT ERROR:", err);

    return NextResponse.json(
      { error: err.message || "خطا در ویرایش محصول" },
      { status: 500 }
    );
  }
}

// --------------------------------------------------
// DELETE - حذف محصول
// --------------------------------------------------

export async function DELETE(request, { params }) {
  try {
    const { productId } = await params;

    if (!productId) {
      return NextResponse.json(
        { error: "شناسه محصول الزامی است" },
        { status: 400 }
      );
    }

    const user = await getUserFromToken();

    if (!user) {
      return NextResponse.json(
        { error: "ابتدا وارد حساب کاربری شوید" },
        { status: 401 }
      );
    }

    await connectToDB();

    const product = await Product.findById(productId);

    if (!product) {
      return NextResponse.json(
        { error: "محصول یافت نشد" },
        { status: 404 }
      );
    }

    // حذف واریانت‌ها
    if (product.variants?.length > 0) {
      await Variant.deleteMany({
        _id: { $in: product.variants },
      });
    }

    // حذف محصول
    await Product.findByIdAndDelete(productId);

    revalidateContent(["products"]);

    return NextResponse.json(
      {
        message: "محصول و تمامی واریانت‌های مربوطه حذف شدند",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("DELETE PRODUCT ERROR:", err);

    return NextResponse.json(
      { error: err.message || "خطا در حذف محصول" },
      { status: 500 }
    );
  }
}
