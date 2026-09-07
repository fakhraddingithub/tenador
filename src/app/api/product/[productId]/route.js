/**
 * src/app/api/product/[productId]/route.js
 */

import { NextResponse } from "next/server";

import connectToDB from "base/configs/db";

import Product from "base/models/Product";
import Category from "base/models/Category";
import Variant from "base/models/Variant";
import "base/models/LimitedEdition";

import { resolveAdminContext } from "@/lib/adminContext";
import { revalidateContent } from "@/lib/revalidate";
import {
  planVariantReconciliation,
  applyVariantWrites,
  removePlannedVariants,
  orderedVariantIds,
} from "@/lib/variantReconcile";
import {
  validateProductVariants,
  validateProductFields,
} from "@/lib/productVariantValidation";
import { apiError, handleApiError } from "@/lib/apiError";
import { normalizeTargetAudience } from "base/utils/targetAudience";
import { resolveProductLimitedEdition } from "@/lib/limitedEditionRelations";
import requireAdminPermission from "@/lib/requireAdminPermission";

// --------------------------------------------------
// Helpers
// --------------------------------------------------

/**
 * محصولِ غیرفعال فقط برای ادمین قابل مشاهده است.
 *
 * پیش‌تر اینجا فقط «توکنِ معتبر داری؟» بررسی می‌شد، یعنی هر مشتریِ ثبت‌نام‌کرده
 * می‌توانست محصولِ منتشرنشده را با تمامِ جزئیاتش بخواند. از `resolveAdminContext`
 * استفاده می‌شود و نه `requireAdminPermission`، چون این یک روتِ عمومی است و
 * نباید برای هر بازدیدِ عادی از یک محصولِ غیرفعال، رکوردِ «ردِ دسترسی» بنویسد.
 */
async function isAdminViewer() {
  try {
    const ctx = await resolveAdminContext();
    return Boolean(ctx?.isAdmin);
  } catch {
    return false;
  }
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

    // محصول غیرفعال فقط برای ادمین قابل مشاهده است
    if (product.isActive === false && !(await isAdminViewer())) {
      return NextResponse.json(
        { error: "این محصول غیرفعال شده است و امکان مشاهده آن وجود ندارد" },
        { status: 404 }
      );
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
      return apiError("شناسه محصول الزامی است", 400);
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

    // فیلدی که در payload نیامده یعنی «دست نخورد»، نه «خالی کن». پیش‌تر PUT یک
    // جایگزینیِ کاملِ بی‌قیدوشرط بود: هر فیلدِ نیامده (tag، gallery، color،
    // attributes، customTabItems، variantMeta ...) بی‌صدا پاک می‌شد. همان
    // قراردادِ «نیامده ≠ خالی» که variantOptions از قبل داشت، حالا برای همه.
    const sent = (key) => body[key] !== undefined;

    const product = await Product.findById(productId);

    if (!product) {
      return apiError("محصول یافت نشد", 404);
    }

    // --------------------------------------------------
    // دسته‌بندی — مرجعِ همهٔ اعتبارسنجی‌های بعدی
    // --------------------------------------------------
    // پیش‌تر وجودِ دسته هیچ‌جا بررسی نمی‌شد: یک ObjectIdِ معتبر ولی ناموجود با
    // وضعیت ۲۰۰ ذخیره می‌شد و محصول از همهٔ فهرست‌های دسته و صفحهٔ
    // /[sport]/[category] ناپدید می‌شد. تنها وقتی خطا می‌داد که اتفاقاً یک
    // واریانت هم نوشته می‌شد و هوکِ Variant سرِ راه بود — با پیامی که از
    // «واریانت» حرف می‌زد، نه از دسته‌بندیِ محصول.
    const categoryId = sent("category") ? category : product.category;
    if (!categoryId) {
      return apiError("«دسته‌بندی» الزامی است", 400, {
        fieldErrors: { category: "«دسته‌بندی» الزامی است" },
      });
    }

    const foundCategory = await Category.findById(categoryId);
    if (!foundCategory) {
      return apiError("دسته‌بندی انتخاب‌شده یافت نشد", 404, {
        fieldErrors: { category: "دسته‌بندی انتخاب‌شده یافت نشد" },
      });
    }

    const normalizedTargetAudience = normalizeTargetAudience(targetAudience);
    if (
      sent("targetAudience") &&
      targetAudience != null &&
      targetAudience !== "" &&
      !normalizedTargetAudience
    ) {
      return apiError("«مخاطب هدف» نامعتبر است", 400, {
        fieldErrors: { targetAudience: "مخاطب هدف انتخاب‌شده معتبر نیست" },
      });
    }

    // برندِ مؤثر: اگر payload برند نداده، برندِ فعلیِ محصول ملاکِ بررسیِ
    // «این لیمیتد ادیشن مالِ همین برند است؟» است.
    let resolvedLimitedEdition = null;
    if (sent("limitedEdition")) {
      resolvedLimitedEdition = await resolveProductLimitedEdition(
        limitedEdition,
        sent("brand") ? brand : product.brand,
      );
      if (resolvedLimitedEdition.error) {
        return apiError(resolvedLimitedEdition.error, resolvedLimitedEdition.status, {
          fieldErrors: { limitedEdition: resolvedLimitedEdition.error },
        });
      }
    }

    // قیمت پایه / ویژگی‌های ثابت / شاخص‌های فنی — همان اعتبارسنجی‌ای که روتِ
    // ساخت اجرا می‌کرد و ویرایش اصلاً نداشت: ویژگیِ تعریف‌نشده در دسته و شاخصِ
    // خارج از بازه (که نمودار رادار را می‌شکند) بی‌صدا ذخیره می‌شدند.
    const fieldValidation = validateProductFields(foundCategory, {
      attributes,
      technicalStats,
      basePrice,
    });
    if (fieldValidation.error) {
      return apiError(fieldValidation.error, 400, {
        fieldErrors: fieldValidation.fieldErrors,
      });
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
    //
    // variantOptions ارسال‌نشده یعنی این درخواست کاری به واریانت‌ها ندارد و
    // آرایهٔ واریانت‌های محصول باید دست‌نخورده بماند. شیءِ خالی («{}») همچنان
    // یعنی «هیچ واریانتی نمی‌خواهم» — ولی حالا اگر دسته ویژگیِ واریانتِ الزامی
    // داشته باشد رد می‌شود. تا پیش از این، ویرایش هیچ اعتبارسنجی‌ای روی
    // واریانت‌ها نداشت: یک ذخیره با variantOptions خالی همهٔ واریانت‌های یک
    // محصولِ الزاماً واریانت‌دار را با وضعیت ۲۰۰ حذف می‌کرد و ارجاع‌های سفارش و
    // انبار را می‌شکست — در حالی که همان payload در روتِ ساخت ۴۰۰ می‌گرفت.
    const touchesVariants =
      variantOptions !== undefined &&
      variantOptions !== null &&
      typeof variantOptions === "object";

    let combinations = [];
    if (touchesVariants) {
      // «هیچ واریانتی» فقط وقتی پذیرفته می‌شود که محصول از قبل هم واریانتی
      // نداشته باشد؛ آن‌وقت چیزی برای ازدست‌رفتن نیست. اگر واریانت دارد، خالی
      // کردنِ فهرست یعنی حذفِ همان‌ها — همان چیزی که ارجاع‌های سفارش و انبار را
      // می‌شکست. شمارش از روی سندهای Variant است نه product.variants، چون آن
      // آرایه می‌تواند از باگ‌های قبلی عقب مانده باشد.
      const existingVariantCount = await Variant.countDocuments({ productId: product._id });
      const variantValidation = validateProductVariants(
        foundCategory.variantAttributes,
        variantOptions,
        selectedCombos,
        { allowEmpty: existingVariantCount === 0 },
      );
      if (variantValidation.error) {
        return apiError(variantValidation.error, 400, {
          fieldErrors: variantValidation.fieldErrors,
        });
      }
      combinations = variantValidation.combinations;
    }

    // تبدیل تایتل‌های انتخاب‌شده به شناسه‌ی واقعیِ آیتم در دسته‌بندی
    let resolvedCustomTabItemIds = null;
    if (sent("customTabItems")) {
      const titles = Array.isArray(customTabItems) ? customTabItems : [];
      const categoryItems = foundCategory.customTab?.items || [];
      resolvedCustomTabItemIds = titles
        .map((title) => categoryItems.find((it) => it.title === title)?._id)
        .filter(Boolean);
      const unmatchedCount = titles.length - resolvedCustomTabItemIds.length;
      if (unmatchedCount > 0) {
        console.warn(
          `${unmatchedCount} customTabItems title(s) did not match any item in category "${foundCategory.title}" and were skipped.`,
        );
      }
    }

    // قیمتِ پایهٔ مؤثر — fallbackِ قیمتِ واریانت‌ها. پیش‌تر مقدارِ خامِ payload
    // پاس می‌شد، پس یک درخواستِ بدونِ basePrice قیمتِ همهٔ واریانت‌ها را صفر می‌کرد.
    const effectiveBasePrice = sent("basePrice")
      ? Number(basePrice) || 0
      : product.basePrice;

    // --------------------------------------------------
    // نوشتن — همه در یک تراکنش
    // --------------------------------------------------
    // ترتیبِ داخلی همان قبلی است (به‌روزرسانی و ساخت پیش از ذخیرهٔ محصول، حذف
    // پس از آن) تا محصول هیچ لحظه‌ای بدونِ واریانت نماند. تفاوت این است که حالا
    // کلِ دنباله اتمیک است: پیش‌تر شکستِ product.save() واریانت‌های تازه‌ساخته را
    // بی‌صاحب در دیتابیس جا می‌گذاشت — نه در product.variants بودند، نه حذف
    // می‌شدند — و در صفحهٔ واریانت‌های محصول به‌عنوان واریانتِ واقعی دیده می‌شدند.
    let missing = false;

    await Product.db.transaction(async (session) => {
      const doc = await Product.findById(productId).session(session);
      // در تلاشِ دوبارهٔ تراکنش هم درست می‌ماند چون هر بار از نو مقدار می‌گیرد
      missing = !doc;
      if (missing) return;

      let variantPlan = null;
      let variantIdByComboKey = new Map();

      if (touchesVariants) {
        // مرجعِ «واریانت‌های فعلی» خودِ سندهای Variant است، نه آرایهٔ
        // product.variants — این‌طور واریانتِ جامانده از باگ‌های قبلی هم دوباره
        // وصل می‌شود به‌جای این‌که برای همیشه بی‌صاحب بماند.
        const existingVariants = await Variant.find({ productId: doc._id }).session(session);

        variantPlan = planVariantReconciliation({
          existing: existingVariants,
          combinations,
          variantDetails,
          basePrice: effectiveBasePrice,
          categoryId,
          productId: String(doc._id),
        });

        variantIdByComboKey = await applyVariantWrites({
          Variant,
          productId: doc._id,
          plan: variantPlan,
          session,
        });
      }

      if (sent("name")) doc.name = name || "";
      if (sent("shortDescription")) doc.shortDescription = shortDescription || "";
      if (sent("longDescription")) doc.longDescription = longDescription || "";
      if (sent("color")) doc.color = color || "";
      if (sent("basePrice")) doc.basePrice = effectiveBasePrice;
      if (sent("category")) doc.category = categoryId;
      if (sent("tag")) doc.tag = Array.isArray(tag) ? tag : [];
      if (sent("mainImage")) doc.mainImage = mainImage || "";
      if (sent("gallery")) doc.gallery = Array.isArray(gallery) ? gallery : [];
      if (sent("brand")) doc.brand = brand || null;
      if (sent("serie")) doc.serie = serie || null;
      if (sent("limitedEdition")) doc.limitedEdition = resolvedLimitedEdition.value;
      if (sent("sport")) doc.sport = sport || null;
      if (sent("athlete")) doc.athlete = Array.isArray(athlete) ? athlete : [];

      if (sent("attributes")) {
        doc.attributes =
          attributes && typeof attributes === "object" ? attributes : {};
      }

      if (sent("technicalStats")) {
        doc.technicalStats =
          technicalStats && typeof technicalStats === "object" ? technicalStats : {};
      }

      if (resolvedCustomTabItemIds) doc.customTabItems = resolvedCustomTabItemIds;

      if (sent("variantMeta")) {
        doc.variantMeta =
          variantMeta && typeof variantMeta === "object" ? variantMeta : {};
      }

      if (sent("label")) doc.label = label || "none";

      if (sent("targetAudience")) doc.targetAudience = normalizedTargetAudience;

      // ✨ اگر isActive فرستاده شده بود مقدار را به‌روزرسانی کن، در غیر این صورت مقدار قبلی حفظ می‌شود
      if (typeof isActive === "boolean") doc.isActive = isActive;

      // ترتیبِ آرایه از ترتیبِ ترکیب‌های فرم می‌آید تا نمایشِ واریانت‌ها پایدار بماند
      if (variantPlan) {
        doc.variants = orderedVariantIds(variantPlan, variantIdByComboKey);
      }

      doc.$session(session);
      await doc.save();

      // حذف در آخر — فقط ترکیب‌هایی که ادمین واقعاً برداشته، و فقط پس از این‌که
      // وضعیت جدیدِ محصول با موفقیت ذخیره شده است.
      await removePlannedVariants({ Variant, plan: variantPlan, session });
    });

    if (missing) {
      return apiError("محصول یافت نشد", 404);
    }

    // --------------------------------------------------
    // محصول نهایی populated
    // --------------------------------------------------

    const updatedProduct = await Product.findById(productId)
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
