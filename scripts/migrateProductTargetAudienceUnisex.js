/**
 * مقدار قدیمی targetAudience="همه" را به مقدار canonical «یونی سکس» تبدیل می‌کند.
 *
 * این migration اتمیک و idempotent است: فقط اسنادِ دارای مقدار قدیمی را تغییر
 * می‌دهد و اجرای دوبارهٔ آن هیچ تغییری ایجاد نمی‌کند.
 *
 * اجرا: npm run migrate:product-audience-unisex
 */
import mongoose from "mongoose";

try {
  process.loadEnvFile(".env");
} catch {
  // در CI/production می‌توان متغیر محیطی را مستقیماً تزریق کرد.
}

const uri = process.env.MONGODB_URI_TENADOR;

async function run() {
  if (!uri) {
    throw new Error("MONGODB_URI_TENADOR تعریف نشده است");
  }

  await mongoose.connect(uri, {
    maxPoolSize: 2,
    autoIndex: false,
    serverSelectionTimeoutMS: 10000,
  });

  const products = mongoose.connection.db.collection("products");
  const before = await products.countDocuments({ targetAudience: "همه" });
  const result = await products.updateMany(
    { targetAudience: "همه" },
    { $set: { targetAudience: "یونی سکس" } },
  );
  const after = await products.countDocuments({ targetAudience: "همه" });

  console.log(`محصولات دارای مقدار قدیمی پیش از migration: ${before}`);
  console.log(`محصولات به‌روزشده: ${result.modifiedCount}`);
  console.log(`محصولات دارای مقدار قدیمی پس از migration: ${after}`);

  if (after !== 0) {
    throw new Error("تعدادی محصول با مقدار قدیمی باقی مانده‌اند");
  }
}

run()
  .then(async () => {
    await mongoose.disconnect();
    console.log("✅ migration مخاطب هدف با موفقیت انجام شد.");
  })
  .catch(async (error) => {
    console.error("❌ migration مخاطب هدف ناموفق بود:", error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
