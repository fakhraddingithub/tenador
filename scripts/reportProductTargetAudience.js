/**
 * scripts/reportProductTargetAudience.js
 *
 * گزارشِ محصولاتِ بدونِ targetAudience (Stage 1 — فقط گزارش، بدونِ تغییرِ داده).
 * هیچ سیگنالِ قابلِ‌اتکایی برای استنتاجِ خودکارِ این فیلد وجود ندارد، پس این
 * اسکریپت فقط فهرست/شمارش می‌کند تا تخصیصِ دستی (از طریقِ فرمِ ادمین در Stage 2)
 * اولویت‌بندی شود.
 *
 * اجرا:  node scripts/reportProductTargetAudience.js
 */

import mongoose from "mongoose";

try {
  process.loadEnvFile(".env");
} catch {
  // اگر .env نبود یا قبلاً لود شده بود، به متغیرهای محیطی موجود تکیه می‌کنیم
}

const MONGODB_URI = process.env.MONGODB_URI_TENADOR;

async function run() {
  if (!MONGODB_URI) {
    console.error("❌ متغیر محیطی MONGODB_URI_TENADOR تنظیم نشده است.");
    process.exit(1);
  }

  console.log("🔌 در حال اتصال به MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("✅ متصل شد.\n");

  const products = mongoose.connection.db.collection("products");

  const total = await products.countDocuments({});
  const missing = await products.countDocuments({
    $or: [{ targetAudience: { $exists: false } }, { targetAudience: null }],
  });

  console.log(`📦 مجموعِ محصولات: ${total}`);
  console.log(`⚠️ بدونِ targetAudience: ${missing} (${total ? ((missing / total) * 100).toFixed(1) : 0}%)\n`);

  if (missing > 0) {
    console.log("📂 تفکیک بر اساسِ دسته‌بندی (بیشترین اول):");
    const byCategory = await products
      .aggregate([
        { $match: { $or: [{ targetAudience: { $exists: false } }, { targetAudience: null }] } },
        { $group: { _id: "$category", n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 20 },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "cat",
          },
        },
      ])
      .toArray();
    for (const row of byCategory) {
      const cat = row.cat[0];
      console.log(`  • ${cat ? cat.title || cat.slug : row._id} — ${row.n}`);
    }

    console.log("\n🏅 تفکیک بر اساسِ ورزش (بیشترین اول):");
    const bySport = await products
      .aggregate([
        { $match: { $or: [{ targetAudience: { $exists: false } }, { targetAudience: null }] } },
        { $group: { _id: "$sport", n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 20 },
        {
          $lookup: {
            from: "sports",
            localField: "_id",
            foreignField: "_id",
            as: "sp",
          },
        },
      ])
      .toArray();
    for (const row of bySport) {
      const sp = row.sp[0];
      console.log(`  • ${sp ? sp.title || sp.slug : row._id} — ${row.n}`);
    }
  } else {
    console.log("✅ همه‌ی محصولات مقدارِ targetAudience دارند.");
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ خطا در اجرای گزارش:", err);
  process.exit(1);
});
