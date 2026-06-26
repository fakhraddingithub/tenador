/**
 * scripts/migrateCategorySportScope.js
 *
 * مهاجرتِ ساختار دسته‌بندی‌ها به حالتِ «اسکوپ‌شده زیرِ ورزش».
 *
 * چه می‌کند:
 *   1. ایندکسِ سراسریِ یکتای `slug_1` را از کالکشن categories حذف می‌کند
 *      (تا دو ورزش بتوانند اسلاگ یکسان مثل "racket" داشته باشند).
 *   2. ایندکسِ ترکیبیِ یکتای { sport: 1, slug: 1 } را روی categories می‌سازد.
 *   3. ایندکسِ سراسریِ یکتای `slug_1` را از کالکشن slugregistries حذف می‌کند.
 *   4. ایندکسِ ترکیبیِ یکتای { type: 1, slug: 1, filterValue: 1 } را می‌سازد.
 *   5. (گزارش) دسته‌های بدونِ ورزش را فهرست می‌کند تا ادمین آن‌ها را اصلاح کند.
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
