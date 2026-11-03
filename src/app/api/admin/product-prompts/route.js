import "base/models/registerModels";
import connectToDB from "base/configs/db";
import Category from "base/models/Category";
import ProductPromptConfig from "base/models/ProductPromptConfig";

import requireAdminPermission from "@/lib/requireAdminPermission";
import { validatePromptConfig } from "@/lib/productPromptConfig";
import { resolvePromptConfig } from "@/lib/productPromptResolve";

const KEY = "product";

const serializeSectionRule = (rule) => ({ text: rule.text, categories: (rule.categories || []).map(String) });

/** تنظیماتِ کامل برای پنل: سندِ ذخیره‌شده، یا اگر هنوز ذخیره نشده نقطه‌ی شروع. */
const serialize = (stored) => {
  const config = resolvePromptConfig(stored);
  return {
    document: config.document.map((s) => ({
      key: s.key,
      kind: s.kind,
      name: s.name,
      top: s.top ?? "",
      title: s.title ?? "",
      bottom: s.bottom ?? "",
      description: s.description ?? "",
      blankLines: s.blankLines ?? 1,
      rules: [...(s.rules || [])],
      ...(s.kind === "fields" ? { fieldBlankLines: s.fieldBlankLines ?? 1 } : {}),
    })),
    fieldRules: config.fieldRules,
    templates: config.templates,
    groups: config.groups.map((g) => ({
      _id: String(g._id),
      title: g.title || "",
      categories: (g.categories || []).map(String),
      rules: (g.rules || []).map((r) => ({ field: r.field, text: r.text, categories: (r.categories || []).map(String) })),
      sections: g.sections.map((s) => ({
        key: s.key,
        name: s.name,
        top: s.top ?? "",
        title: s.title ?? "",
        bottom: s.bottom ?? "",
        description: s.description ?? "",
        blankLines: s.blankLines ?? 1,
        rules: (s.rules || []).map(serializeSectionRule),
      })),
    })),
    updatedAt: stored?.updatedAt ? new Date(stored.updatedAt).toISOString() : null,
  };
};

/** دسته‌ها برای انتخابگر، به‌همراهِ فیلدهای پویای هر دسته که گروه‌ها برایشان قاعده می‌نویسند. */
async function categoryOptions() {
  const categories = await Category.find(
    {},
    { title: 1, name: 1, sport: 1, additionalSports: 1, attributes: 1, variantAttributes: 1, technicalStats: 1, customTab: 1 },
  )
    .populate("sport", "title name")
    .sort({ sport: 1, order: 1, createdAt: 1 })
    .lean();
  const named = (list) => (list || []).map(({ name, label }) => ({ name, label: label || name }));
  return categories.map((c) => ({
    _id: String(c._id),
    title: c.title,
    name: c.name,
    sport: c.sport ? { title: c.sport.title, name: c.sport.name } : null,
    additionalSports: (c.additionalSports || []).map(String),
    fields: {
      attribute: named(c.attributes),
      variant: named(c.variantAttributes),
      stat: named(c.technicalStats),
      // آیتم‌ها فقط وقتی معنا دارند که تب فعال باشد؛ همان شرطِ سازنده‌ی پرامپت
      tabItem: c.customTab?.enabled
        ? (c.customTab.items || []).filter((i) => i?.title).map((i) => ({ name: i.title, label: i.title }))
        : [],
    },
  }));
}

// GET /api/admin/product-prompts → { config: { document, fieldRules, templates, groups, updatedAt }, categories }
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

// PUT /api/admin/product-prompts  { document?, fieldRules?, templates?, groups?, updatedAt }
// هر بخشِ فرستاده‌نشده دست‌نخورده می‌ماند: صفحه‌ی پرامپت پایه گروه‌ها را نمی‌فرستد و صفحه‌ی
// گروه بقیه را. updatedAt برای همه یکی است، پس ذخیره روی نسخه‌ای که ادمین ندیده (از هر
// صفحه‌ای) با ۴۰۹ رد می‌شود.
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
    const parts = ["document", "fieldRules", "templates", "groups"];
    if (parts.every((part) => value[part] === undefined)) {
      return Response.json({ error: "چیزی برای ذخیره فرستاده نشده است" }, { status: 400 });
    }

    // از اولین ذخیره به بعد کلِ پرامپت در سند است و seed دیگر خوانده نمی‌شود
    const resolved = resolvePromptConfig(doc ? doc.toObject() : null);
    const target = doc || new ProductPromptConfig({ key: KEY });
    target.document = value.document ?? resolved.document;
    target.fieldRules = value.fieldRules ?? resolved.fieldRules;
    target.templates = Object.entries(value.templates ?? resolved.templates).map(([key, text]) => ({ key, text }));
    if (value.groups !== undefined) target.groups = value.groups;
    await target.save();
    return Response.json({ config: serialize(target.toObject()) });
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
