import "base/models/registerModels";
import connectToDB from "base/configs/db";
import Category from "base/models/Category";
import ProductPromptConfig from "base/models/ProductPromptConfig";

import requireAdminPermission from "@/lib/requireAdminPermission";
import { validatePromptConfig } from "@/lib/productPromptConfig";

const KEY = "product";

const serialize = (doc) => ({
  base: (doc?.base || []).map(({ section, rules }) => ({ section, rules: [...rules] })),
  groups: (doc?.groups || []).map((g) => ({
    title: g.title || "",
    categories: (g.categories || []).map(String),
    rules: (g.rules || []).map((r) => ({ field: r.field, text: r.text, categories: (r.categories || []).map(String) })),
  })),
  updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
});

/** دسته‌ها برای انتخابگر — فقط همان چیزی که برچسب لازم دارد. */
async function categoryOptions() {
  const categories = await Category.find({}, { title: 1, name: 1, sport: 1, additionalSports: 1 })
    .populate("sport", "title name")
    .sort({ sport: 1, order: 1, createdAt: 1 })
    .lean();
  return categories.map((c) => ({
    _id: String(c._id),
    title: c.title,
    name: c.name,
    sport: c.sport ? { title: c.sport.title, name: c.sport.name } : null,
    additionalSports: (c.additionalSports || []).map(String),
  }));
}

// GET /api/admin/product-prompts → { config: { base, groups, updatedAt }, categories }
export async function GET() {
  const { denied } = await requireAdminPermission("productPrompts.view");
  if (denied) return denied;

  try {
    await connectToDB();
    const [doc, categories] = await Promise.all([
      ProductPromptConfig.findOne({ key: KEY }).sort({ createdAt: 1 }).lean(),
      categoryOptions(),
    ]);
    return Response.json({ config: serialize(doc), categories });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// PUT /api/admin/product-prompts  { base, groups, updatedAt } → کلِ تنظیمات، یک‌جا
export async function PUT(req) {
  const { denied } = await requireAdminPermission("productPrompts.edit");
  if (denied) return denied;

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "بدنه‌ی درخواست نامعتبر است" }, { status: 400 });
  }

  try {
    await connectToDB();
    const doc = await ProductPromptConfig.findOne({ key: KEY }).sort({ createdAt: 1 });

    // ذخیره روی نسخه‌ای که ادمین ندیده، تغییراتِ ادمینِ دیگر را بی‌صدا پاک می‌کرد
    const current = doc?.updatedAt ? doc.updatedAt.toISOString() : null;
    if ((body?.updatedAt ?? null) !== current) {
      return Response.json(
        { error: "تنظیمات پرامپت در این فاصله تغییر کرده است؛ صفحه را دوباره بارگذاری کنید" },
        { status: 409 },
      );
    }

    // دسته‌ی موجود، یا دسته‌ای که قبلاً ذخیره شده و بعد حذف شده (قاعده‌اش فقط
    // غیرفعال می‌شود و ذخیره‌های بی‌ربط را قفل نمی‌کند). دسته‌ی ناموجودِ تازه رد می‌شود.
    const stored = (doc?.groups || []).flatMap((g) => (g.categories || []).map(String));
    const requested = (Array.isArray(body?.groups) ? body.groups : []).flatMap((g) =>
      Array.isArray(g?.categories) ? g.categories.map(String) : [],
    );
    const validIds = [...new Set(requested)].filter((id) => /^[a-f\d]{24}$/i.test(id));
    const existing = await Category.find({ _id: { $in: validIds } }, { _id: 1 }).lean();
    const knownCategoryIds = new Set([...stored, ...existing.map((c) => String(c._id))]);

    const { value, errors } = validatePromptConfig(body, { knownCategoryIds });
    if (!value) {
      const fieldErrors = {};
      for (const { path, message } of errors) fieldErrors[path] ??= message;
      return Response.json({ error: errors[0].message, fieldErrors }, { status: 400 });
    }

    const target = doc || new ProductPromptConfig({ key: KEY });
    target.base = value.base;
    target.groups = value.groups;
    await target.save();
    return Response.json({ config: serialize(target) });
  } catch (err) {
    if (err?.name === "VersionError" || err?.code === 11000) {
      return Response.json(
        { error: "تنظیمات پرامپت در این فاصله تغییر کرده است؛ صفحه را دوباره بارگذاری کنید" },
        { status: 409 },
      );
    }
    console.error(err);
    return Response.json({ error: "خطای سرور" }, { status: 500 });
  }
}
