/**
 * src/lib/productRegenerationService.js  (server — DB, no HTTP, no AI)
 *
 * پیش‌نمایش و اعمالِ بازتولید؛ مشترک بین هر دو حالت:
 *   - دستی: POST /api/product/[id]/regenerate (JSONِ چسبانده‌شده)
 *   - خودکار: POST /api/product/[id]/regenerate/generate (JSONِ مدل) → همان اعمال
 * قواعدِ فیلدبه‌فیلد در productRegeneration.js (pure) است. اینجا فقط ارجاع‌ها
 * خوانده و نوشتن اتمیک و محافظت‌شده انجام می‌شود.
 *
 * تصاویر و واریانت‌ها: مدلِ Variant اینجا ایمپورت نمی‌شود، و اگر هر مسیرِ
 * محافظت‌شده (PROTECTED_PRODUCT_PATHS) پیش از ذخیره تغییر کرده باشد تراکنش لغو می‌شود.
 *
 * caller باید اتصالِ دیتابیس را برقرار کرده باشد.
 */
import mongoose from "mongoose";
import Product from "base/models/Product";
import Category from "base/models/Category";
import Brand from "base/models/Brand";
import Serie from "base/models/Serie";
import Athlete from "base/models/Athlete";
import LimitedEdition from "base/models/LimitedEdition";
import { createSlug } from "base/utils/slugify";
import {
  collectRegenerationRefIds,
  planProductRegeneration,
  PROTECTED_PRODUCT_PATHS,
} from "./productRegeneration.js";

const fail = (message, status, extra) => ({ error: { message, status, extra } });

async function loadRefs(ids) {
  const [brands, series, limitedEditions, athletes] = await Promise.all([
    Brand.find({ _id: { $in: ids.brands } }, { name: 1, title: 1 }).lean(),
    Serie.find({ _id: { $in: ids.series } }, { name: 1, title: 1, brand: 1 }).lean(),
    LimitedEdition.find({ _id: { $in: ids.limitedEditions } }, { name: 1, title: 1, brand: 1 }).lean(),
    Athlete.find({ _id: { $in: ids.athletes } }, { name: 1, title: 1 }).lean(),
  ]);
  const toMap = (docs) => new Map(docs.map((d) => [
    String(d._id),
    { name: d.title || d.name || String(d._id), brand: d.brand ? String(d.brand) : undefined },
  ]));
  return {
    brands: toMap(brands),
    series: toMap(series),
    limitedEditions: toMap(limitedEditions),
    athletes: toMap(athletes),
  };
}

/** @returns {Promise<{ error } | { product, category }>} */
export async function loadRegenerationTarget(productId) {
  if (!mongoose.isValidObjectId(productId)) return fail("شناسه محصول معتبر نیست", 400);
  const product = await Product.findById(productId).lean();
  if (!product) return fail("محصول یافت نشد", 404);
  const category = await Category.findById(product.category).lean();
  if (!category) {
    return fail("دسته‌بندیِ این محصول یافت نشد؛ ابتدا دسته‌بندیِ معتبری برای محصول انتخاب کنید", 409);
  }
  return { product, category };
}

/**
 * @returns {Promise<{ error } | { plan, preview }>}
 *   preview = { changes, slug, missing, ignored, preserved, updatedAt }
 */
export async function previewRegeneration({ product, category, draft, requireComplete = false }) {
  const refs = await loadRefs(collectRegenerationRefIds(draft, product));
  const plan = planProductRegeneration({ draft, product, category, refs, requireComplete });
  const summary = { missing: plan.missing, ignored: plan.ignored, preserved: plan.preserved };

  if (plan.error) return fail(plan.error, 400, { fieldErrors: plan.fieldErrors, ...summary });

  // نام → اسلاگ (هوکِ pre-save). تکراری بودنش را همین‌جا می‌گوییم، نه با E11000 هنگام اعمال.
  let slug = null;
  if (plan.changes.some((c) => c.field === "name")) {
    const next = createSlug(plan.update.name);
    if (next !== product.slug) {
      if (await Product.exists({ slug: next, _id: { $ne: product._id } })) {
        return fail("محصولِ دیگری با همین نام (نامک) وجود دارد؛ نام را تغییر دهید", 409, {
          fieldErrors: { name: "نامکِ این نام تکراری است" }, ...summary,
        });
      }
      slug = { before: product.slug, after: next };
    }
  }

  return {
    plan,
    preview: { changes: plan.changes, slug, ...summary, updatedAt: product.updatedAt?.toISOString() ?? null },
  };
}

/**
 * اعمالِ اتمیک. `expectedUpdatedAt` نسخه‌ای است که ادمین پیش‌نمایشش را دید؛ اگر
 * محصول در این فاصله ویرایش شده باشد ۴۰۹ — آنچه تأیید شده همان چیزی است که نوشته می‌شود.
 * @returns {Promise<{ error } | { ok: true }>}
 */
export async function applyRegeneration({ productId, plan, preview, expectedUpdatedAt }) {
  if (!plan.changes.length) {
    return fail("این JSON هیچ تغییری نسبت به محصولِ فعلی ندارد", 400, {
      missing: plan.missing, ignored: plan.ignored, preserved: plan.preserved,
    });
  }
  if (typeof expectedUpdatedAt !== "string") return fail("ابتدا پیش‌نمایشِ تغییرات را بگیرید", 400);

  let outcome = "ok";
  await Product.db.transaction(async (session) => {
    outcome = "ok"; // تراکنش ممکن است دوباره اجرا شود
    const doc = await Product.findById(productId).session(session);
    if (!doc) { outcome = "missing"; return; }
    // هم نسخه‌ای که ادمین دید و هم نسخه‌ای که plan رویش ساخته شد باید همین سند باشند
    const current = doc.updatedAt?.toISOString();
    if (current !== expectedUpdatedAt || current !== preview.updatedAt) { outcome = "stale"; return; }

    for (const { field } of plan.changes) doc.set(field, plan.update[field]);

    const touched = PROTECTED_PRODUCT_PATHS.filter((path) => doc.isModified(path));
    if (touched.length) throw new Error(`regeneration must never modify ${touched.join(", ")}`);

    doc.$session(session);
    await doc.save();
  });

  if (outcome === "missing") return fail("محصول یافت نشد", 404);
  if (outcome === "stale") return fail("محصول از زمانِ پیش‌نمایش ویرایش شده است؛ دوباره پیش‌نمایش بگیرید", 409);
  return { ok: true };
}
