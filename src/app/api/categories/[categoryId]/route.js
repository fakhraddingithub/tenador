import connectToDB from "base/configs/db";
import mongoose from "mongoose";
import "base/models/registerModels";
import Category from "base/models/Category";
import Order from "base/models/Order";
import Product from "base/models/Product";
import Variant from "base/models/Variant";
import { NextResponse } from "next/server";
import {
  revalidateCategoryVisibilityPaths,
  revalidateContent,
} from "@/lib/revalidate";
import { handleApiError } from "@/lib/apiError";
import {
  CategorySportValidationError,
  getCategoryVisibilitySportSlugs,
  validateCategorySportConfiguration,
} from "base/services/categorySportValidation.service";
import requireAdminPermission from "@/lib/requireAdminPermission";
import {
  VariantAttributeRenameError,
  migrateVariantAttributeData,
  planVariantAttributeRenames,
} from "@/lib/categoryVariantAttributeRename";

// ---------------------------------------------------------
// GET: دریافت جزئیات یک کتگوری
// ---------------------------------------------------------
export async function GET(req, { params }) {
  try {
    await connectToDB();
    const { categoryId } = await params;
    const category = await Category.findById(categoryId)
      .populate('parent')
      .populate('sport', 'title name slug')
      .populate('additionalSports', 'title name slug')
      .lean();

    if (!category) {
      return NextResponse.json({ error: "دسته‌بندی پیدا نشد" }, { status: 404 });
    }

    return NextResponse.json({ category });
  } catch (error) {
    return handleApiError(error, "خطا در دریافت دسته‌بندی");
  }
}

// ---------------------------------------------------------
// PUT: ویرایش کامل کتگوری (با پشتیبانی از مدل جدید)
// ---------------------------------------------------------
export async function PUT(req, { params }) {
  const { denied } = await requireAdminPermission("categories.edit");
  if (denied) return denied;

  try {
    await connectToDB();
    const { categoryId } = await params;
    const body = await req.json();
    const {
      title,
      name,
      sport,   // ورزشِ صاحبِ این دسته (الزامی)
      additionalSports,
      parent,
      attributes,
      variantAttributes, // فیلد جدید
      megaMenuFilterAttribute, // ویژگیِ فیلترِ مگامنو (نامِ ویژگی یا null)
      technicalStats,
      technicalStatsPrompt,
      customTab,
      prompts,
      image,
      icon
    } = body;

    const category = await Category.findById(categoryId);
    if (!category) {
      return NextResponse.json({ error: "دسته‌بندی پیدا نشد" }, { status: 404 });
    }

    const previousVisibility = {
      sport: category.sport,
      additionalSports: [...(category.additionalSports || [])],
      slug: category.slug,
    };

    // ۰. اعتبارسنجی یکپارچه‌ی ورزش اصلی/نمایشی و تداخل نام/اسلاگ در تمام
    // ورزش‌هایی که دسته در آن‌ها قابل مشاهده خواهد بود.
    const targetSport = sport !== undefined ? sport : category.sport;
    const targetAdditionalSports = additionalSports !== undefined
      ? additionalSports
      : category.additionalSports;
    const normalizedAdditionalSports = await validateCategorySportConfiguration({
      sport: targetSport,
      additionalSports: targetAdditionalSports,
      title: title?.trim() || category.title,
      name: name?.trim() || category.name,
      slug: category.slug,
      excludeCategoryId: category._id,
    });
    category.sport = targetSport;
    category.additionalSports = normalizedAdditionalSports;

    // ۱. به‌روزرسانی فیلدهای پایه

    if (title?.trim()) category.title = title.trim();

    if (name?.trim()) {
      if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
        return NextResponse.json({ error: "فرمت نام انگلیسی نامعتبر است" }, { status: 400 });
      }
      category.name = name.trim();
    }

    if (parent !== undefined) {
      category.parent = parent || null;
    }

    // ۲. اعتبارسنجی و به‌روزرسانی ویژگی‌ها (Global & Variant)
    const validateAttrs = (list) => {
      if (!Array.isArray(list)) return false;
      const validUiTypes = ["text-input", "number-input", "dropdown", "swatch", "button-toggle"];
      return list.every(attr => 
        attr.name && 
        attr.label && 
        (!attr.uiType || validUiTypes.includes(attr.uiType))
      );
    };

    if (attributes !== undefined) {
      if (!validateAttrs(attributes)) {
        return NextResponse.json({ error: "ویژگی‌های عمومی (Attributes) نامعتبر هستند" }, { status: 400 });
      }
      category.attributes = attributes;
    }

    let variantRenames = [];
    if (variantAttributes !== undefined) {
      if (!validateAttrs(variantAttributes)) {
        return NextResponse.json({ error: "ویژگی‌های واریانت نامعتبر هستند" }, { status: 400 });
      }
      const renamePlan = planVariantAttributeRenames(
        category.variantAttributes || [],
        variantAttributes,
      );
      category.variantAttributes = renamePlan.definitions;
      variantRenames = renamePlan.renames;
    }

    // ویژگیِ فیلترِ مگامنو — فقط نامِ معتبر (موجود در attributes/variantAttributes فعلی) پذیرفته می‌شود
    if (megaMenuFilterAttribute !== undefined || variantRenames.length > 0) {
      const allAttrNames = [
        ...(category.attributes || []),
        ...(category.variantAttributes || []),
      ].map((a) => a?.name);
      const renameMap = new Map(variantRenames.map(({ from, to }) => [from, to]));
      const requestedMegaMenuAttribute =
        megaMenuFilterAttribute !== undefined
          ? megaMenuFilterAttribute
          : category.megaMenuFilterAttribute;
      const migratedMegaMenuAttribute =
        renameMap.get(requestedMegaMenuAttribute) || requestedMegaMenuAttribute;
      category.megaMenuFilterAttribute = allAttrNames.includes(
        migratedMegaMenuAttribute,
      )
        ? migratedMegaMenuAttribute
        : null;
    }

    // ۳. به‌روزرسانی شاخص‌های فنی نمودار (Technical Stats) - با دقت کامل
    if (technicalStats !== undefined) {
      if (Array.isArray(technicalStats)) {
        for (const stat of technicalStats) {
          if (!stat.name || !stat.label) {
            return NextResponse.json({ error: "تمام شاخص‌های فنی باید نام و برچسب داشته باشند" }, { status: 400 });
          }
          if (stat.min !== undefined && stat.max !== undefined && Number(stat.min) >= Number(stat.max)) {
            return NextResponse.json({ error: `بازه عددی در '${stat.label}' نامعتبر است` }, { status: 400 });
          }
        }
        category.technicalStats = technicalStats;
      }
    }

    if (technicalStatsPrompt !== undefined) {
      category.technicalStatsPrompt = technicalStatsPrompt;
    }

    // ۴. به‌روزرسانی تب سفارشی دسته‌بندی
    if (customTab !== undefined) {
      if (customTab?.items && Array.isArray(customTab.items)) {
        for (const item of customTab.items) {
          if (!item.title?.trim()) {
            return NextResponse.json({ error: "همه‌ی آیتم‌های تب سفارشی باید عنوان داشته باشند" }, { status: 400 });
          }
        }
      }
      category.customTab = {
        enabled: !!customTab?.enabled,
        name: (customTab?.name || "").trim(),
        icon: (customTab?.icon || "").trim(),
        items: Array.isArray(customTab?.items)
          ? customTab.items.map((item) => ({
              // حیاتی: آیتم‌های موجود باید _id اصلی خود را حفظ کنند تا ارتباط محصولات قبلی قطع نشود.
              ...(item._id ? { _id: item._id } : {}),
              title: item.title.trim(),
              description: (item.description || "").trim(),
              image: (item.image || "").trim(),
              link: (item.link || "").trim(),
            }))
          : [],
      };
    }

    if (prompts !== undefined) {
      category.prompts = prompts;
    }

    if (icon !== undefined) {
      category.icon = icon;
    }
    if (image !== undefined) {
      category.image = image;
    }

    // ذخیرهٔ تعریف دسته و انتقال کلیدهای وابسته یک عملیات اتمیک است. در نتیجه
    // یا Variant.attributes، Product.variantMeta و snapshot سفارش‌ها همراه دسته
    // تغییر می‌کنند، یا در صورت هر خطا هیچ‌کدام تغییر نمی‌کنند.
    const session = await mongoose.startSession();
    let variantRenameSummary = { variants: 0, products: 0, orders: 0, orderItems: 0 };
    try {
      session.startTransaction();
      await category.save({ session });
      variantRenameSummary = await migrateVariantAttributeData({
        categoryId: category._id,
        renames: variantRenames,
        session,
        Variant,
        Product,
        Order,
      });
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }

    const affectedSportSlugs = await getCategoryVisibilitySportSlugs(
      previousVisibility,
      category,
    );
    revalidateContent(["navbar", "categories", "products"]);
    revalidateCategoryVisibilityPaths({
      sportSlugs: affectedSportSlugs,
      categorySlug: category.slug,
    });

    return NextResponse.json({
      message: "دسته‌بندی با موفقیت به‌روزرسانی شد",
      category,
      variantRenameSummary,
    });
  } catch (error) {
    if (error instanceof VariantAttributeRenameError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CategorySportValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    // خطای منطقیِ عمدی (تداخل نام ویژگی‌ها) پیام فارسیِ خودش را دارد → ۴۰۰
    if (error?.message?.includes("نمی‌توانند همزمان")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, "خطا در به‌روزرسانی دسته‌بندی");
  }
}

// ---------------------------------------------------------
// DELETE: حذف کتگوری
// ---------------------------------------------------------
export async function DELETE(req, { params }) {
  const { denied } = await requireAdminPermission("categories.delete");
  if (denied) return denied;

  try {
    await connectToDB();
    const { categoryId } = await params;

    const category = await Category.findByIdAndDelete(categoryId);
    if (!category) {
      return NextResponse.json({ error: "دسته‌بندی پیدا نشد" }, { status: 404 });
    }

    const affectedSportSlugs = await getCategoryVisibilitySportSlugs(category);
    revalidateContent(["navbar", "categories", "products"]);
    revalidateCategoryVisibilityPaths({
      sportSlugs: affectedSportSlugs,
      categorySlug: category.slug,
    });

    return NextResponse.json({ message: "دسته‌بندی با موفقیت حذف شد" });
  } catch (error) {
    return handleApiError(error, "خطا در حذف دسته‌بندی");
  }
}
