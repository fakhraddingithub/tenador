/**
 * scripts/ensureIndexes.js
 *
 * ساختِ ایندکس‌های اعلام‌شده در اسکیماها روی دیتابیس.
 *
 * چرا لازم است: از این پس `autoIndex: false` در configs/db.js تنظیم شده تا در
 * محیط سرورلس هر cold start برای هر مدل یک createIndexes نفرستد. در نتیجه
 * ایندکس‌های تازه‌اضافه‌شده به اسکیماها دیگر خودکار ساخته نمی‌شوند و ساختِ آن‌ها
 * باید صریح (با همین اسکریپت) انجام شود.
 *
 * همه‌ی ایندکس‌ها با `background: true` ساخته می‌شوند تا روی دیتابیسِ زنده
 * کوئری‌ها را بلاک نکنند.
 *
 * این اسکریپت idempotent است: ایندکسِ موجود دوباره ساخته نمی‌شود.
 *
 * اجرا:  npm run ensure:indexes
 */

import mongoose from "mongoose";

try {
  process.loadEnvFile(".env");
} catch {
  // اگر .env نبود یا قبلاً لود شده بود، به متغیرهای محیطی موجود تکیه می‌کنیم
}

const MONGODB_URI = process.env.MONGODB_URI_TENADOR;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI_TENADOR تعریف نشده است.");
  process.exit(1);
}

async function main() {
  console.log("⏳ اتصال به دیتابیس…");
  await mongoose.connect(MONGODB_URI, { autoIndex: false });
  console.log("✅ متصل شد.\n");

  // ثبتِ همه‌ی اسکیماها (side-effect)
  await import("../models/registerModels.js");

  const modelNames = mongoose.modelNames().sort();
  let created = 0;
  let failed = 0;

  for (const name of modelNames) {
    const Model = mongoose.model(name);
    const declared = Model.schema.indexes();
    if (declared.length === 0) continue;

    const col = Model.collection;
    let existing = [];
    try {
      existing = await col.indexes();
    } catch {
      // کالکشن هنوز وجود ندارد — createIndex خودش می‌سازدش
    }
    const existingKeys = new Set(
      existing.map((i) => JSON.stringify(i.key))
    );

    for (const [keys, options] of declared) {
      const signature = JSON.stringify(keys);
      if (existingKeys.has(signature)) continue;

      const label = `${name}.${signature}`;
      try {
        await col.createIndex(keys, { ...options, background: true });
        console.log(`  ✅ ساخته شد: ${label}`);
        created++;
      } catch (err) {
        console.error(`  ❌ ناموفق: ${label} — ${err.message}`);
        failed++;
      }
    }
  }

  console.log(
    `\n${created} ایندکس ساخته شد، ${failed} ناموفق، ${modelNames.length} مدل بررسی شد.`
  );

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("❌ خطا:", err);
  process.exit(1);
});
