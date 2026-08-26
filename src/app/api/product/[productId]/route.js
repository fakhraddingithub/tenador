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
import {
  planVariantReconciliation,
  applyVariantWrites,
  removePlannedVariants,
  orderedVariantIds,
} from "@/lib/variantReconcile";
import { handleApiError } from "@/lib/apiError";
import { normalizeTargetAudience } from "base/utils/targetAudience";
import { resolveProductLimitedEdition } from "@/lib/limitedEditionRelations";
import requireAdminPermission from "@/lib/requireAdminPermission";

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
    return handleApiError(err, "خطا در دریافت محصول");
  }
}

// --------------------------------------------------
// PUT - ویرایش کامل محصول
// --------------------------------------------------

export async function PUT(request, { params }) {
  // پیش‌تر فقط «کاربرِ واردشده» بررسی می‌شد — یعنی هر مشتریِ عادی می‌توانست
  // هر محصولی را ویرایش کند.
  const { denied } = await requireAdminPermission("products.edit");
  if (denied) return denied;

  try {
    const { productId } = await params;

    if (!productId) {
      return NextResponse.json(
        { error: "شناسه محصول الزامی است" },
        { status: 400 }
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
      targetAudience,
      isActive, // ✨ اضافه شد: دریافت وضعیت فعال/غیرفعال از فرانت‌اند
      variantOptions,
      variantDetails,
      selectedCombos, // آرایه‌ی کلیدِ ترکیب‌های انتخاب‌شده برای ساخت (اختیاری)
      variantMeta, // متادیتای سطحِ مقدار (تصاویرِ مشترک هر مقدار و ...)
    } = body;

    const normalizedTargetAudience = normalizeTargetAudience(targetAudience);
    if (targetAudience != null && targetAudience !== "" && !normalizedTargetAudience) {
      return NextResponse.json(
        {
          error: "«مخاطب هدف» نامعتبر است",
          fieldErrors: { targetAudience: "مخاطب هدف انتخاب‌شده معتبر نیست" },
        },
        { status: 400 },
      );
    }

    const resolvedLimitedEdition = await resolveProductLimitedEdition(
      limitedEdition,
      brand,
    );
    if (resolvedLimitedEdition.error) {
      return NextResponse.json(
        {
          error: resolvedLimitedEdition.error,
          fieldErrors: { limitedEdition: resolvedLimitedEdition.error },
        },
        { status: resolvedLimitedEdition.status },
      );
    }

    const product = await Product.findById(productId);

    if (!product) {
      return NextResponse.json(
        { error: "محصول یافت نشد" },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // تطبیق واریانت‌ها
    // --------------------------------------------------
    // پیش‌تر اینجا همهٔ واریانت‌ها deleteMany می‌شدند و از نو ساخته می‌شدند —
    // یعنی هر ذخیرهٔ محصول (حتی عوض‌کردنِ توضیحات) به واریانت‌ها _id تازه می‌داد
    // و هر ارجاعِ بیرونی به آن‌ها می‌شکست: واریانتِ آیتم‌های سفارش «نامشخص»
    // می‌شد و اسکنِ بارکد روی سفارش با «این بارکد متعلق به واریانت دیگری از این
    // محصول است» رد می‌شد. حالا ترکیبِ ویژگی‌ها هویتِ واریانت است و فقط
    // تفاوت‌های واقعی نوشته می‌شوند. جزئیات در src/lib/variantReconcile.js.

    function generateCombinations(options) {
      const keys = Object.keys(options).filter(
        (k) => Array.isArray(options[k]) && options[k].length > 0
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

    // variantOptions ارسال‌نشده یعنی این درخواست کاری به واریانت‌ها ندارد و
    // آرایهٔ واریانت‌های محصول باید دست‌نخورده بماند. پیش‌تر در این حالت آرایه
    // خالی می‌شد ولی سندهای Variant حذف نمی‌شدند — یعنی واریانت‌ها بی‌صاحب
    // رها می‌شدند. شیءِ خالی («{}») همچنان یعنی «هیچ واریانتی نمی‌خواهم».
    const touchesVariants =
      variantOptions !== undefined &&
      variantOptions !== null &&
      typeof variantOptions === "object";

    let variantPlan = null;

    if (touchesVariants) {
      const allCombinations = generateCombinations(variantOptions);
      // اگر لیست انتخاب‌شده ارسال شده باشد فقط همان ترکیب‌ها ساخته می‌شوند؛
      // در غیر این صورت همه‌ی ترکیب‌ها (سازگاری با کلاینت‌های قدیمی)
      const selectedSet = Array.isArray(selectedCombos) ? new Set(selectedCombos) : null;
      const combinations = selectedSet
        ? allCombinations.filter((c) => selectedSet.has(makeComboKey(c)))
        : allCombinations;

      // مرجعِ «واریانت‌های فعلی» خودِ سندهای Variant است، نه آرایهٔ
      // product.variants — این‌طور واریانتِ جامانده از باگ‌های قبلی هم دوباره
      // وصل می‌شود به‌جای این‌که برای همیشه بی‌صاحب بماند.
      const existingVariants = await Variant.find({ productId: product._id });

      variantPlan = planVariantReconciliation({
        existing: existingVariants,
        combinations,
        variantDetails,
        basePrice,
        categoryId: category,
        productId: String(product._id),
      });
    }

    // ─── اجرای نقشه ───────────────────────────────────────────────
    // ترتیب عمدی است: به‌روزرسانی و ساخت پیش از ذخیرهٔ محصول، و حذف پس از آن.
    // تا وقتی وضعیت جدید ذخیره نشده هیچ واریانتی حذف نمی‌شود، پس یک خطای
    // میانی هرگز محصول را بدونِ واریانت رها نمی‌کند.
    const variantIdByComboKey = await applyVariantWrites({
      Variant,
      productId: product._id,
      plan: variantPlan,
    });

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
    product.limitedEdition = resolvedLimitedEdition.value;
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

    product.targetAudience = normalizedTargetAudience;

    // ✨ اضافه شد: اگر isActive فرستاده شده بود مقدار را به‌روزرسانی کن، در غیر این صورت مقدار قبلی را حفظ کن
    product.isActive = typeof isActive === "boolean" ? isActive : product.isActive;

    // ترتیبِ آرایه از ترتیبِ ترکیب‌های فرم می‌آید تا نمایشِ واریانت‌ها پایدار بماند
    if (variantPlan) {
      product.variants = orderedVariantIds(variantPlan, variantIdByComboKey);
    }

    await product.save();

    // حذف در آخر — فقط ترکیب‌هایی که ادمین واقعاً برداشته، و فقط پس از این‌که
    // وضعیت جدیدِ محصول با موفقیت ذخیره شده است.
    await removePlannedVariants({ Variant, plan: variantPlan });

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

    revalidateContent(["products", "navbar"]);

    return NextResponse.json(
      {
        message: "محصول با موفقیت ویرایش شد",
        product: updatedProduct,
      },
      { status: 200 }
    );
  } catch (err) {
    return handleApiError(err, "خطا در ویرایش محصول");
  }
}

// --------------------------------------------------
// DELETE - حذف محصول
// --------------------------------------------------

export async function DELETE(request, { params }) {
  const { denied } = await requireAdminPermission("products.delete");
  if (denied) return denied;

  try {
    const { productId } = await params;

    if (!productId) {
      return NextResponse.json(
        { error: "شناسه محصول الزامی است" },
        { status: 400 }
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

    revalidateContent(["products", "navbar"]);

    return NextResponse.json(
      {
        message: "محصول و تمامی واریانت‌های مربوطه حذف شدند",
      },
      { status: 200 }
    );
  } catch (err) {
    return handleApiError(err, "خطا در حذف محصول");
  }
}
