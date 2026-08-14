import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import Category from "base/models/Category";
import { registerSlug } from "base/actions/registerSlug";
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

export async function POST(req) {
  try {
    await connectToDB();

    const body = await req.json();
    const {
      title,
      name,
      sport,   // ورزشِ صاحبِ این دسته (الزامی)
      additionalSports,
      parent,
      prompts,
      image,
      icon,
      attributes,
      variantAttributes, // فیلد جدید اضافه شد
      megaMenuFilterAttribute, // ویژگیِ انتخاب‌شده برای فیلترِ مگامنو (نامِ ویژگی یا null)
      technicalStats,
      technicalStatsPrompt,
      customTab
    } = body;

    // ۱. اعتبارسنجی فیلدهای اجباری پایه
    if (!title?.trim()) {
      return Response.json({ error: "عنوان فارسی کتگوری الزامی است" }, { status: 400 });
    }

    if (!name?.trim()) {
      return Response.json({ error: "نام انگلیسی کتگوری الزامی است" }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
      return Response.json(
        { error: "نام انگلیسی باید فقط شامل حروف انگلیسی، اعداد و علائم مجاز باشد" },
        { status: 400 }
      );
    }

    // ورزش الزامی است؛ یکتایی اسلاگ/نام در محدوده‌ی همین ورزش بررسی می‌شود
    if (!sport || !mongoose.isValidObjectId(sport)) {
      return Response.json({ error: "انتخاب ورزش برای دسته‌بندی الزامی است" }, { status: 400 });
    }

    const normalizedAdditionalSports = await validateCategorySportConfiguration({
      sport,
      additionalSports,
      title,
      name,
    });

    // ۳. تابع کمکی برای اعتبارسنجی ویژگی‌ها (Attributes & VariantAttributes)
    const validateAttrList = (list, label) => {
      if (list && Array.isArray(list)) {
        for (const attr of list) {
          if (!attr.name || !attr.label) {
            return `تمام ویژگی‌های ${label} باید name و label داشته باشند`;
          }
          // اعتبارسنجی بر اساس enum تعریف شده در مدل جدید
          const validUiTypes = ["text-input", "number-input", "dropdown", "swatch", "button-toggle"];
          if (attr.uiType && !validUiTypes.includes(attr.uiType)) {
            return `نوع نمایش '${attr.uiType}' در بخش ${label} غیرمجاز است`;
          }
        }
      }
      return null;
    };

    // اجرای اعتبارسنجی برای هر دو لیست ویژگی‌ها
    const attrError = validateAttrList(attributes, "عمومی (Global)");
    if (attrError) return Response.json({ error: attrError }, { status: 400 });

    const variantError = validateAttrList(variantAttributes, "متغیر (Variant)");
    if (variantError) return Response.json({ error: variantError }, { status: 400 });


    // ۴. اعتبارسنجی شاخص‌های فنی نمودار (Technical Stats) - با دقت کامل
    if (technicalStats && Array.isArray(technicalStats)) {
      for (const stat of technicalStats) {
        if (!stat.name || !stat.label) {
          return Response.json({ error: "تمام شاخص‌های نمودار باید name و label داشته باشند" }, { status: 400 });
        }
        // بررسی منطقی بازه اعداد
        if (stat.min !== undefined && stat.max !== undefined && Number(stat.min) >= Number(stat.max)) {
          return Response.json({ error: `بازه عددی در شاخص فنی '${stat.label}' نامعتبر است (Min باید کمتر از Max باشد)` }, { status: 400 });
        }
      }
    }

    // ۵. اعتبارسنجی تب سفارشی دسته‌بندی
    if (customTab?.items && Array.isArray(customTab.items)) {
      for (const item of customTab.items) {
        if (!item.title?.trim()) {
          return Response.json({ error: "همه‌ی آیتم‌های تب سفارشی باید عنوان داشته باشند" }, { status: 400 });
        }
      }
    }

    // ۵. ایجاد کتگوری در دیتابیس (مطابق مدل جدید)
    // ترتیب نمایش در محدوده‌ی همین ورزش محاسبه می‌شود
    const lastCategory = await Category.findOne({ sport })
      .sort({ order: -1 })
      .select("order")
      .lean();

    // فقط نامِ ویژگیِ معتبر (موجود در attributes یا variantAttributes) پذیرفته می‌شود
    const allAttrNames = [
      ...(attributes || []),
      ...(variantAttributes || []),
    ].map((a) => a?.name);
    const normalizedMegaFilter = allAttrNames.includes(megaMenuFilterAttribute)
      ? megaMenuFilterAttribute
      : null;

    const created = await Category.create({
      order: (lastCategory?.order ?? -1) + 1,
      title: title.trim(),
      name: name.trim(),
      sport,
      additionalSports: normalizedAdditionalSports,
      parent: parent || null,
      prompts: prompts || [],
      icon: icon.trim(),
      image: image.trim(),
      attributes: attributes || [],           // ویژگی‌های ثابت (Global)
      variantAttributes: variantAttributes || [], // ویژگی‌های متغیر
      megaMenuFilterAttribute: normalizedMegaFilter,
      technicalStats: technicalStats || [],
      technicalStatsPrompt: technicalStatsPrompt || "",
      customTab: {
        enabled: !!customTab?.enabled,
        name: (customTab?.name || "").trim(),
        icon: (customTab?.icon || "").trim(),
        items: Array.isArray(customTab?.items)
          ? customTab.items.map((item) => ({
              title: item.title.trim(),
              description: (item.description || "").trim(),
              image: (item.image || "").trim(),
              link: (item.link || "").trim(),
            }))
          : [],
      },
    });

    // ۶. ثبت در سیستم اسلاگ‌های مرکزی
    await registerSlug({
      slug: created.slug,
      type: "category",
      model: "Category",
      refId: created._id,
      filterField: "category",
      filterValue: created._id,
      label: created.title,
      parentSlug: parent || null, 
    });

    const affectedSportSlugs = await getCategoryVisibilitySportSlugs(created);
    revalidateContent(["navbar", "categories", "products"]);
    revalidateCategoryVisibilityPaths({
      sportSlugs: affectedSportSlugs,
      categorySlug: created.slug,
    });

    return Response.json(
      { message: "کتگوری با موفقیت ایجاد شد", category: created },
      { status: 201 }
    );

  } catch (err) {
    if (err instanceof CategorySportValidationError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleApiError(err, "خطا در ایجاد دسته‌بندی");
  }
}
