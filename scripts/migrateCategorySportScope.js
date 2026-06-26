/**
 * scripts/migrateCategorySportScope.js
 *
 * مهاجرتِ ساختار دسته‌بندی‌ها به حالتِ «اسکوپ‌شده زیرِ ورزش».
 *
 * چه می‌کند:
 *   1. ایندکسِ سراسریِ یکتای `slug_1` را از کالکشن categories حذف می‌کند
 *      (تا دو ورزش بتوانند اسلاگ یکسان مثل "racket" داشته باشند).
 *   2. Backfill: به هر دسته‌ی بدونِ ورزش، یک ورزش اختصاص می‌دهد — ورزشِ غالب از
 *      روی محصولاتِ همان دسته (بیشترین تعداد)، و اگر محصولی نبود از روی عنوان.
 *      بدونِ این مرحله، تمامِ URLهای دسته (/[sport]/[category]) با ۴۰۴ مواجه می‌شوند،
 *      چون resolver دسته را با شرطِ { slug, sport } پیدا می‌کند.
 *   3. ایندکسِ ترکیبیِ یکتای { sport: 1, slug: 1 } را روی categories می‌سازد.
 *   4. ایندکسِ سراسریِ یکتای `slug_1` را از کالکشن slugregistries حذف می‌کند.
 *   5. ایندکسِ ترکیبیِ یکتای { type: 1, slug: 1, filterValue: 1 } را می‌سازد.
 *   6. (گزارش) دسته‌های هنوز-بدونِ-ورزش و دسته‌های چنددِ-ورزشی را فهرست می‌کند.
 *
 * این اسکریپت idempotent است: اگر ایندکسِ قدیمی نباشد یا ایندکسِ جدید موجود
 * باشد، بدون خطا رد می‌شود.
 *
 * نکته: Mongoose هنگامِ حذفِ `unique: true` از اسکیمـا، ایندکسِ قدیمیِ دیتابیس را
 * خودکار drop نمی‌کند؛ پس اجرای این اسکریپت برای production الزامی است.
 *
 * اجرا:  node scripts/migrateCategorySportScope.js
 */

import mongoose from "mongoose";

try {
  process.loadEnvFile(".env");
} catch {
  // اگر .env نبود یا قبلاً لود شده بود، به متغیرهای محیطی موجود تکیه می‌کنیم
}

const MONGODB_URI = process.env.MONGODB_URI_TENADOR;

async function dropIndexIfExists(col, indexName) {
  const indexes = await col.indexes();
  const found = indexes.find((idx) => idx.name === indexName);
  if (!found) {
    console.log(`  • ایندکس «${indexName}» وجود ندارد — رد شد.`);
    return;
  }
  await col.dropIndex(indexName);
  console.log(`  ✅ ایندکس «${indexName}» حذف شد.`);
}

async function createIndexSafe(col, keys, options, label) {
  try {
    await col.createIndex(keys, options);
    console.log(`  ✅ ایندکس «${label}» ساخته/تأیید شد.`);
  } catch (err) {
    console.error(`  ❌ خطا در ساختِ ایندکس «${label}»:`, err.message);
    throw err;
  }
}

// تشخیصِ ورزش از روی عنوان/اسلاگِ دسته (فقط برای دسته‌های بدونِ محصول استفاده می‌شود).
function inferSportByTitle(cat, sports) {
  const hay = `${cat.title || ""} ${cat.slug || ""} ${cat.name || ""}`.toLowerCase();
  for (const s of sports) {
    const needles = [s.slug, s.title, s.name]
      .filter(Boolean)
      .map((x) => String(x).toLowerCase());
    if (needles.some((n) => n && hay.includes(n))) return s;
  }
  return null;
}

/**
 * هر دسته‌ی بدونِ ورزش را به یک ورزش اختصاص می‌دهد:
 *   - ورزشِ غالب از روی محصولاتِ همان دسته (بیشترین تعداد محصولِ { category, sport })،
 *   - در نبودِ محصول، تطبیقِ نامِ ورزش با عنوان/اسلاگِ دسته،
 *   - در غیرِ این صورت بدونِ تغییر می‌ماند و در گزارش می‌آید (تخصیصِ دستی لازم است).
 * idempotent: فقط دسته‌هایی که sport ندارند پردازش می‌شوند.
 */
async function backfillCategorySport(db, categories) {
  console.log("\n🩹 Backfill ورزشِ دسته‌ها (از روی محصولات/عنوان):");

  const sports = await db
    .collection("sports")
    .find({})
    .project({ slug: 1, title: 1, name: 1 })
    .toArray();
  const sportById = new Map(sports.map((s) => [String(s._id), s]));

  // تعداد محصولِ فعالِ هر ترکیبِ { category, sport }
  const agg = await db
    .collection("products")
    .aggregate([
      { $match: { category: { $ne: null }, sport: { $ne: null } } },
      { $group: { _id: { category: "$category", sport: "$sport" }, n: { $sum: 1 } } },
    ])
    .toArray();

  const byCat = new Map(); // catId -> [{ sport, n }]
  for (const r of agg) {
    const c = String(r._id.category);
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c).push({ sport: String(r._id.sport), n: r.n });
  }

  const nullCats = await categories
    .find({ $or: [{ sport: { $exists: false } }, { sport: null }] })
    .project({ slug: 1, title: 1, name: 1 })
    .toArray();

  let assigned = 0;
  const multiSport = [];
  const unresolved = [];

  for (const cat of nullCats) {
    const usage = (byCat.get(String(cat._id)) || []).sort((a, b) => b.n - a.n);
    let chosen = null;
    let reason = "";

    if (usage.length > 0) {
      chosen = usage[0].sport;
      reason = usage.length > 1 ? "چنددِ ورزشی؛ ورزشِ غالب" : "از روی محصولات";
      if (usage.length > 1) multiSport.push({ cat, usage });
    } else {
      const inferred = inferSportByTitle(cat, sports);
      if (inferred) {
        chosen = String(inferred._id);
        reason = "از روی عنوان (بدونِ محصول)";
      }
    }

    if (chosen) {
      await categories.updateOne(
        { _id: cat._id },
        { $set: { sport: new mongoose.Types.ObjectId(chosen) } },
      );
      assigned++;
      const sp = sportById.get(chosen);
      console.log(`  ✅ [${cat.slug}] "${cat.title}" → ${sp ? sp.slug : chosen}  (${reason})`);
    } else {
      unresolved.push(cat);
      console.log(`  ⚠️ [${cat.slug}] "${cat.title}" → نامشخص (بدونِ محصول و بدونِ تطبیقِ عنوان)`);
    }
  }

  console.log(`\n  جمعاً ${assigned} دسته اختصاص یافت.`);

  if (multiSport.length > 0) {
    console.log(
      `\n  ⚠️ دسته‌های چنددِ ورزشی (به ورزشِ غالب اختصاص یافتند). در مدلِ per-sport،\n` +
        `     URLِ ورزش‌های اقلیت برای این دسته‌ها ۴۰۴ می‌شود؛ در صورت نیاز یک دسته‌ی\n` +
        `     مخصوصِ همان ورزش بسازید:`,
    );
    for (const { cat, usage } of multiSport) {
      const parts = usage
        .map((u) => `${sportById.get(u.sport)?.slug || u.sport}:${u.n}`)
        .join(", ");
      console.log(`     • [${cat.slug}] "${cat.title}" → ${parts}`);
    }
  }

  if (unresolved.length > 0) {
    console.log(
      `\n  ⚠️ ${unresolved.length} دسته بدونِ ورزش باقی ماند (دستی تخصیص دهید): ` +
        unresolved.map((c) => c.slug).join(", "),
    );
  }
}

async function run() {
  if (!MONGODB_URI) {
    console.error("❌ متغیر محیطی MONGODB_URI_TENADOR تنظیم نشده است.");
    process.exit(1);
  }

  console.log("🔌 در حال اتصال به MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("✅ متصل شد.\n");

  const db = mongoose.connection.db;
  const categories = db.collection("categories");
  const slugRegistries = db.collection("slugregistries");

  console.log("📂 کالکشن categories:");
  await dropIndexIfExists(categories, "slug_1");

  // Backfill ورزش قبل از ساختِ ایندکسِ ترکیبی انجام می‌شود تا داده تمیز شود
  await backfillCategorySport(db, categories);

  await createIndexSafe(
    categories,
    { sport: 1, slug: 1 },
    { unique: true },
    "sport_1_slug_1",
  );

  console.log("\n📂 کالکشن slugregistries:");
  await dropIndexIfExists(slugRegistries, "slug_1");
  await createIndexSafe(
    slugRegistries,
    { type: 1, slug: 1, filterValue: 1 },
    { unique: true },
    "type_1_slug_1_filterValue_1",
  );

  // گزارشِ دسته‌های بدونِ ورزش (داده‌ی قدیمی) — باید دستی به یک ورزش اختصاص یابند
  const orphanCount = await categories.countDocuments({
    $or: [{ sport: { $exists: false } }, { sport: null }],
  });
  if (orphanCount > 0) {
    console.log(
      `\n⚠️ ${orphanCount} دسته بدونِ ورزش یافت شد. این دسته‌ها تا زمانِ ` +
        `اختصاص به یک ورزش (از طریقِ فرم ویرایش) در صفحاتِ فروشگاه و sitemap ظاهر نمی‌شوند.`,
    );
  } else {
    console.log("\n✅ همه‌ی دسته‌ها به یک ورزش اختصاص دارند.");
  }

  console.log("\n✅ مهاجرت با موفقیت پایان یافت.");
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ خطا در اجرای مهاجرت:", err);
  process.exit(1);
});
