/**
 * scripts/removeCustomTabItemPrompts.mjs
 *
 * حذفِ «راهنمای انتخاب»ِ تک‌تکِ آیتم‌های تب سفارشی (categories.customTab.items[].prompt).
 *
 * آن فیلد از models/Category.js برداشته شده: انتخابِ آیتم‌ها حالا فقط یک قاعده‌ی کلی دارد
 * (customTab.prompt) و AI برای هر محصول عنوان و توضیحاتِ خودش را می‌نویسد. مقدارهای ذخیره‌شده
 * دیگر جایی خوانده نمی‌شوند و تا این اسکریپت اجرا نشود فقط در دیتابیس می‌مانند (خواندنِ عمومی
 * آن‌ها را با WITHOUT_AI_PROMPTS کنار می‌گذارد). ذخیره‌ی دوباره‌ی دسته هم پاکشان می‌کند.
 *
 *   npm run check:remove-tab-item-prompts     # فقط گزارش (هیچ نوشتنی)
 *   npm run migrate:remove-tab-item-prompts   # حذف
 *
 * idempotent است. با درایورِ خام کار می‌کند، چون مدل دیگر این مسیر را نمی‌شناسد.
 */

import mongoose from "mongoose";

try {
  process.loadEnvFile(".env");
} catch {
  // متغیرهای محیطی از خودِ runtime می‌آیند
}

const apply = process.argv.includes("--apply");
const FILTER = { "customTab.items.prompt": { $exists: true } };

async function main() {
  const uri = process.env.MONGODB_URI_TENADOR;
  if (!uri) throw new Error("MONGODB_URI_TENADOR تعریف نشده است.");
  await mongoose.connect(uri);
  const categories = mongoose.connection.collection("categories");

  const docs = await categories.find(FILTER, { projection: { title: 1, "customTab.items.title": 1, "customTab.items.prompt": 1 } }).toArray();
  console.log(`دسته‌هایی که آیتمِ تبشان هنوز «راهنمای انتخاب» دارد: ${docs.length}`);
  for (const doc of docs) {
    const written = (doc.customTab?.items || []).filter((item) => String(item.prompt ?? "").trim());
    console.log(`   • ${doc.title || doc._id}: ${written.length} راهنمای غیرِ خالی`);
    for (const item of written) console.log(`       - ${item.title}: ${String(item.prompt).slice(0, 120)}`);
  }

  if (!docs.length) {
    console.log("\n✅ چیزی برای حذف نمانده است.");
  } else if (!apply) {
    console.log("\nاجرای آزمایشی بود؛ برای حذف: npm run migrate:remove-tab-item-prompts");
  } else {
    const res = await categories.updateMany(FILTER, { $unset: { "customTab.items.$[].prompt": "" } });
    console.log(`\nدسته‌های به‌روزشده: ${res.modifiedCount}`);
  }
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
