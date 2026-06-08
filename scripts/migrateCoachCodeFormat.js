/**
 * scripts/migrateCoachCodeFormat.js
 *
 * مهاجرت فرمت کد مربیگری از حالت قدیمی «TR-0000» به حالت جدید «TR0000»
 * (حذف خط تیره از کد همه‌ی کاربرانی که کد مربیگری دارند).
 *
 * این اسکریپت idempotent است: کدهایی که خط تیره ندارند بدون تغییر می‌مانند.
 *
 * اجرا:  node scripts/migrateCoachCodeFormat.js
 * مستقل از alias های پروژه (base/ و @/) تا با Node خام اجرا شود.
 */

import mongoose from "mongoose";

try {
  process.loadEnvFile(".env");
} catch {
  // اگر .env نبود یا قبلاً لود شده بود، به متغیرهای محیطی موجود تکیه می‌کنیم
}

const MONGODB_URI = process.env.MONGODB_URI_TENADOR;
const COLLECTION = "users";

async function run() {
  if (!MONGODB_URI) {
    console.error("❌ متغیر محیطی MONGODB_URI_TENADOR تنظیم نشده است.");
    process.exit(1);
  }

  console.log("🔌 در حال اتصال به MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("✅ متصل شد.\n");

  const col = mongoose.connection.db.collection(COLLECTION);

  const docs = await col
    .find({ coachCode: { $regex: "-" } })
    .project({ coachCode: 1 })
    .toArray();

  console.log(`📦 تعداد کدهای دارای خط تیره: ${docs.length}\n`);

  let updated = 0;
  for (const doc of docs) {
    const newCode = String(doc.coachCode).replace(/-/g, "").toUpperCase();
    await col.updateOne({ _id: doc._id }, { $set: { coachCode: newCode } });
    console.log(`  ${doc.coachCode} → ${newCode}`);
    updated++;
  }

  console.log(`\n✅ پایان. ${updated} کد بروزرسانی شد.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ خطا در اجرای مهاجرت:", err);
  process.exit(1);
});
