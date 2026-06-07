import connectToDB from "base/configs/db";
import Category from "base/models/Category";
import { registerSlug } from "base/actions/registerSlug";
import { revalidateContent } from "@/lib/revalidate";

export async function POST(req) {
  try {
    await connectToDB();

    const body = await req.json();
    const { 
      title, 
      name, 
      parent, 
      prompts,
      image,
      icon,
      attributes, 
      variantAttributes, // فیلد جدید اضافه شد
      technicalStats, 
      technicalStatsPrompt 
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

    // ۲. بررسی تکراری نبودن
    const exists = await Category.findOne({
      $or: [{ title: title.trim() }, { name: name.trim() }]
    });

    if (exists) {
      return Response.json({ error: "کتگوری با این عنوان یا نام قبلاً ثبت شده است" }, { status: 409 });
    }

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

    // ۵. ایجاد کتگوری در دیتابیس (مطابق مدل جدید)
    const created = await Category.create({
      title: title.trim(),
      name: name.trim(),
      parent: parent || null,
      prompts: prompts || [],
      icon: icon.trim(),
      image: image.trim(),
      attributes: attributes || [],           // ویژگی‌های ثابت (Global)
      variantAttributes: variantAttributes || [], // ویژگی‌های متغیر
      technicalStats: technicalStats || [],
      technicalStatsPrompt: technicalStatsPrompt || "",
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

    revalidateContent(["navbar", "categories"]);

    return Response.json(
      { message: "کتگوری با موفقیت ایجاد شد", category: created },
      { status: 201 }
    );

  } catch (err) {
    console.error("CATEGORY POST ERROR:", err);
    return Response.json(
      { error: "مشکلی در سرور رخ داد", detail: err.message },
      { status: 500 }
    );
  }
}