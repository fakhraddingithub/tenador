/**
 * scripts/migrateUsedProductsHealthScale.js
 *
 * مهاجرت محصولات دست‌دوم موجود به تغییرات جدید:
 *   1) تولید اسلاگ یکتا برای رکوردهایی که اسلاگ ندارند.
 *   2) تبدیل امتیاز فیلدهای کارت سلامت از مقیاس ۱ تا ۵ به مقیاس ۱ تا ۱۰.
 *   3) بازمحاسبه‌ی overallScore بر اساس مقادیر جدید.
 *
 * این اسکریپت idempotent است:
 *   - اسلاگ فقط برای رکوردهای فاقد اسلاگ ساخته می‌شود.
 *   - تبدیل امتیاز فقط یک‌بار انجام می‌شود (با مارکر healthScaleVersion=2).
 *   - overallScore همیشه از روی مقادیر نهایی محاسبه می‌شود.
 *
 * اجرا:  node scripts/migrateUsedProductsHealthScale.js
 * این اسکریپت مستقل از alias های پروژه (base/ و @/) است تا با Node خام اجرا شود.
 */

import mongoose from "mongoose";

/* ---------------------------------------------------------------------------
 *  بارگذاری متغیرهای محیطی از .env (Node 20.12+/24)
 * ------------------------------------------------------------------------- */
try {
  process.loadEnvFile(".env");
} catch {
  // اگر .env نبود یا قبلاً لود شده بود، به متغیرهای محیطی موجود تکیه می‌کنیم
}

const MONGODB_URI = process.env.MONGODB_URI_TENADOR;
const COLLECTION = "usedproducts"; // نام پیش‌فرض کالکشن مدل UsedProduct
const HEALTH_SCALE_VERSION = 2; // مارکر مقیاس ۱۰تایی

/* ---------------------------------------------------------------------------
 *  createSlug — کپی دقیق از utils/slugify.js (برای اجرای مستقل از bundler)
 * ------------------------------------------------------------------------- */
function createSlug(text) {
  if (!text) return "";

  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/ی/g, "ی")
    .replace(/ک/g, "ک")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ---------------------------------------------------------------------------
 *  تبدیل یک امتیاز از مقیاس ۱-۵ به ۱-۱۰
 *  از همان نگاشت خطی استفاده می‌شود که اپ قبلاً برای overallScore به کار می‌برد:
 *    ((r - 1) / 4) * 9 + 1   →   1→1, 2→3, 3→6, 4→8, 5→10
 * ------------------------------------------------------------------------- */
function convertRating(r) {
  if (typeof r !== "number" || Number.isNaN(r)) return r;
  // اگر از قبل در مقیاس جدید بود (>۵)، فقط محدودش می‌کنیم
  if (r > 5) return Math.min(10, Math.max(1, Math.round(r)));
  const mapped = Math.round(((r - 1) / 4) * 9 + 1);
  return Math.min(10, Math.max(1, mapped));
}

function calcOverallScore(healthScores = [], customFields = []) {
  const all = [...healthScores, ...customFields];
  if (all.length === 0) return null;
  const avg = all.reduce((sum, s) => sum + (Number(s.rating) || 0), 0) / all.length;
  return Math.round(avg);
}

/* ---------------------------------------------------------------------------
 *  Main
 * ------------------------------------------------------------------------- */
async function run() {
  if (!MONGODB_URI) {
    console.error("❌ متغیر محیطی MONGODB_URI_TENADOR تنظیم نشده است.");
    process.exit(1);
  }

  console.log("🔌 در حال اتصال به MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("✅ متصل شد.\n");

  const col = mongoose.connection.db.collection(COLLECTION);

  const total = await col.countDocuments();
  console.log(`📦 تعداد کل محصولات دست‌دوم: ${total}\n`);

  const docs = await col.find({}).toArray();

  // اسلاگ‌های موجود را برای تضمین یکتایی از قبل بارگذاری می‌کنیم
  const usedSlugs = new Set(
    docs.map((d) => d.slug).filter((s) => typeof s === "string" && s.length > 0)
  );

  const ops = [];
  const stats = {
    slugGenerated: 0,
    ratingsConverted: 0,
    overallRecalculated: 0,
    skippedRatings: 0,
    unchanged: 0,
  };

  for (const doc of docs) {
    const set = {};
    let touched = false;

    /* ---- ۱) اسلاگ ---- */
    if (!doc.slug || String(doc.slug).trim() === "") {
      const base = createSlug(doc.name) || "used";
      let slug = base;
      let i = 2;
      while (usedSlugs.has(slug)) {
        slug = `${base}-${i++}`;
      }
      usedSlugs.add(slug);
      set.slug = slug;
      stats.slugGenerated++;
      touched = true;
    }

    /* ---- ۲) تبدیل امتیازها (فقط یک‌بار) ---- */
    const alreadyMigrated = doc.healthScaleVersion >= HEALTH_SCALE_VERSION;
    let healthScores = Array.isArray(doc.healthScores) ? doc.healthScores : [];
    let customFields = Array.isArray(doc.customFields) ? doc.customFields : [];

    if (!alreadyMigrated) {
      healthScores = healthScores.map((s) => ({ ...s, rating: convertRating(s.rating) }));
      customFields = customFields.map((f) => ({ ...f, rating: convertRating(f.rating) }));

      // فقط در صورت وجود امتیاز، فیلدها را آپدیت می‌کنیم
      if (doc.healthScores?.length) set.healthScores = healthScores;
      if (doc.customFields?.length) set.customFields = customFields;

      set.healthScaleVersion = HEALTH_SCALE_VERSION;
      touched = true;
      if (healthScores.length || customFields.length) stats.ratingsConverted++;
    } else {
      stats.skippedRatings++;
    }

    /* ---- ۳) بازمحاسبه‌ی overallScore از مقادیر نهایی ---- */
    const newOverall = calcOverallScore(healthScores, customFields);
    if (newOverall !== (doc.overallScore ?? null)) {
      set.overallScore = newOverall;
      stats.overallRecalculated++;
      touched = true;
    }

    if (touched) {
      ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: set } } });
    } else {
      stats.unchanged++;
    }
  }

  if (ops.length > 0) {
    console.log(`✍️  در حال اعمال ${ops.length} آپدیت...`);
    const res = await col.bulkWrite(ops, { ordered: false });
    console.log(`   modified: ${res.modifiedCount}\n`);
  } else {
    console.log("ℹ️  هیچ تغییری لازم نبود.\n");
  }

  console.log("──────── خلاصه ────────");
  console.log(`  اسلاگ ساخته‌شده:        ${stats.slugGenerated}`);
  console.log(`  امتیاز تبدیل‌شده:        ${stats.ratingsConverted}`);
  console.log(`  امتیاز قبلاً مهاجرت‌شده: ${stats.skippedRatings}`);
  console.log(`  overallScore بازمحاسبه: ${stats.overallRecalculated}`);
  console.log(`  بدون تغییر:             ${stats.unchanged}`);
  console.log("───────────────────────\n");

  await mongoose.disconnect();
  console.log("👋 اتصال بسته شد.");
  process.exit(0);
}

run().catch(async (err) => {
  console.error("❌ خطا در مهاجرت:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
