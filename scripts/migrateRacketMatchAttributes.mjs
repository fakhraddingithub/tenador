/**
 * scripts/migrateRacketMatchAttributes.mjs
 *
 * افزودنِ دو مشخصهٔ *اختیاریِ* تازه به دستهٔ راکتِ تنیس:
 *
 *   Strung Weight  «وزن با زه (گرم)»
 *   Playing Style  «سبک بازی پیشنهادی»
 *
 * بقیهٔ مشخصه‌هایی که موتور تطبیق لازم دارد (وزن، اندازه صفحه، بالانس، وزن
 * سویینگ، الگوی زهکشی، سختی، سطح بازی و هفت شاخص فنی) از قبل در همین دسته
 * تعریف شده‌اند و ۱۰۰٪ پر هستند — بنابراین هیچ فیلدِ تکراری ساخته نمی‌شود.
 *
 * فرم ساخت/ویرایش محصول در پنل ادمین، ورودی‌های خود را از روی همین فهرست
 * می‌سازد؛ پس با اجرای این اسکریپت، دو فیلد جدید بدونِ هیچ تغییری در کدِ فرم
 * قابل ویرایش می‌شوند.
 *
 *   npm run check:racket-match-attributes    # فقط گزارش، بدون تغییر
 *   npm run migrate:racket-match-attributes  # اعمال تغییر
 *
 * ایمن و تکرارپذیر: هر دو مشخصه required:false هستند (محصولاتِ موجود همچنان
 * معتبرند) و اگر از قبل وجود داشته باشند، دست‌نخورده رها می‌شوند.
 */

import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

const NEW_ATTRIBUTES = [
  {
    name: "Strung Weight",
    label: "وزن با زه (گرم)",
    description: "اختیاری. اگر ثبت شود، در کنار وزن بدون زه نمایش داده می‌شود.",
    uiType: "number-input",
    required: false,
    filterable: false,
    options: [],
    multiUnit: false,
    units: [],
  },
  {
    name: "Playing Style",
    label: "سبک بازی پیشنهادی",
    description:
      "اختیاری. یک یا چند مورد از: قدرتی، اسپین، کنترلی، همه‌کاره. اگر خالی بماند، ابزار تطبیق سبک را از روی شاخص‌های فنی همین محصول می‌سنجد.",
    uiType: "text-input",
    required: false,
    filterable: false,
    options: [],
    multiUnit: false,
    units: [],
  },
];

const uri = process.env.MONGODB_URI_TENADOR;
if (!uri) {
  console.error("MONGODB_URI_TENADOR تعریف نشده است. اسکریپت را با --env-file=.env اجرا کنید.");
  process.exit(1);
}

await mongoose.connect(uri);
const db = mongoose.connection.db;

const sport = await db.collection("sports").findOne({ slug: "tennis" });
const category = sport
  ? await db.collection("categories").findOne({ sport: sport._id, slug: "racket" })
  : null;

if (!category) {
  console.error("دستهٔ راکت تنیس پیدا نشد؛ هیچ تغییری اعمال نشد.");
  await mongoose.disconnect();
  process.exit(1);
}

const existing = category.attributes || [];
const existingNames = new Set(existing.map((attribute) => attribute.name));
const toAdd = NEW_ATTRIBUTES.filter((attribute) => !existingNames.has(attribute.name));

console.log("دسته: " + category.title + " (" + category.slug + ") — " + existing.length + " مشخصه");

if (!toAdd.length) {
  console.log("هر دو مشخصه از قبل وجود دارند؛ کاری لازم نیست.");
  await mongoose.disconnect();
  process.exit(0);
}

for (const attribute of toAdd) {
  console.log("  + " + attribute.label + " (" + attribute.name + ") — اختیاری");
}

if (!APPLY) {
  console.log("\nحالت گزارش. برای اعمال، دوباره با --apply اجرا کنید.");
  await mongoose.disconnect();
  process.exit(0);
}

// فقط $push — هیچ مشخصهٔ موجودی بازنویسی یا حذف نمی‌شود
const result = await db
  .collection("categories")
  .updateOne({ _id: category._id }, { $push: { attributes: { $each: toAdd } } });

console.log("\n" + toAdd.length + " مشخصه اضافه شد (modified: " + result.modifiedCount + ").");
console.log("کش دسته‌بندی‌ها را با تگ «categories» تازه‌سازی کنید تا فرم ادمین آن‌ها را ببیند.");

await mongoose.disconnect();
