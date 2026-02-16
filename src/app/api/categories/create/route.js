import connectToDB from "base/configs/db";
import Category from "base/models/Category";
import { registerSlug } from "base/actions/registerSlug";

export async function POST(req) {
  try {
    await connectToDB();

    const body = await req.json();
    const { title, name, parent, prompts, attributes, technicalStats, technicalStatsPrompt } = body;

    // 1. اعتبارسنجی فیلدهای اجباری پایه
    if (!title?.trim()) {
      return Response.json({ error: "عنوان فارسی کتگوری الزامی است" }, { status: 400 });
    }

    if (!name?.trim()) {
      return Response.json({ error: "نام انگلیسی کتگوری الزامی است" }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
      return Response.json(
        { error: "نام باید فقط شامل حروف انگلیسی، اعداد و علائم مجاز باشد" },
        { status: 400 }
      );
    }

    // 2. بررسی تکراری نبودن (Case-insensitive برای اطمینان بیشتر)
    const exists = await Category.findOne({
      $or: [{ title: title.trim() }, { name: name.trim() }]
    });

    if (exists) {
      return Response.json({ error: "کتگوری با این عنوان یا نام قبلاً ثبت شده است" }, { status: 409 });
    }

    // 3. اعتبارسنجی ویژگی‌های عمومی (Attributes)
    if (attributes && Array.isArray(attributes)) {
      for (const attr of attributes) {
        if (!attr.name || !attr.label) {
          return Response.json({ error: "تمام ویژگی‌های جدول باید name و label داشته باشند" }, { status: 400 });
        }
        if (attr.type && !["string", "number", "select"].includes(attr.type)) {
          return Response.json({ error: `نوع '${attr.type}' برای ویژگی '${attr.label}' غیرمجاز است` }, { status: 400 });
        }
      }
    }

    // 4. اعتبارسنجی شاخص‌های فنی نمودار (Technical Stats) - جدید
    if (technicalStats && Array.isArray(technicalStats)) {
      for (const stat of technicalStats) {
        if (!stat.name || !stat.label) {
          return Response.json({ error: "تمام شاخص‌های نمودار باید name و label داشته باشند" }, { status: 400 });
        }
        // بررسی بازه اعداد اگر ارسال شده باشند
        if (stat.min !== undefined && stat.max !== undefined && stat.min >= stat.max) {
          return Response.json({ error: `بازه عددی در '${stat.label}' نامعتبر است` }, { status: 400 });
        }
      }
    }

    // 5. ایجاد کتگوری در دیتابیس
    const created = await Category.create({
      title: title.trim(),
      name: name.trim(),
      parent: parent || null,
      prompts: prompts || [],
      attributes: attributes || [],
      technicalStats: technicalStats || [],
      technicalStatsPrompt: technicalStatsPrompt || "",
    });

    // 6. ثبت در سیستم اسلاگ‌های مرکزی
    await registerSlug({
      slug: created.slug,
      type: "category",
      model: "Category",
      refId: created._id,
      filterField: "category",
      filterValue: created._id,
      label: created.title,
      parentSlug: parent || null, // توجه: اگر parent آی‌دی است، مطمئن شوید registerSlug اسلاگ را پیدا می‌کند
    });

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