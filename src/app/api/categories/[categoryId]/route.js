import connectToDB from "base/configs/db";
import Category from "base/models/Category";
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

    if (variantAttributes !== undefined) {
      if (!validateAttrs(variantAttributes)) {
        return NextResponse.json({ error: "ویژگی‌های واریانت نامعتبر هستند" }, { status: 400 });
      }
      category.variantAttributes = variantAttributes;
    }

    // ویژگیِ فیلترِ مگامنو — فقط نامِ معتبر (موجود در attributes/variantAttributes فعلی) پذیرفته می‌شود
    if (megaMenuFilterAttribute !== undefined) {
      const allAttrNames = [
        ...(category.attributes || []),
        ...(category.variantAttributes || []),
      ].map((a) => a?.name);
      category.megaMenuFilterAttribute = allAttrNames.includes(
        megaMenuFilterAttribute,
      )
        ? megaMenuFilterAttribute
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

    // ذخیره تغییرات (Trigger pre-save hooks)
    await category.save();

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
    });
  } catch (error) {
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
