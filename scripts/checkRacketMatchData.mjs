/**
 * scripts/checkRacketMatchData.mjs
 *
 * گزارشِ فقط-خواندنی از کیفیتِ دادهٔ راکت‌های تنیس برای ابزارِ تطبیق.
 *
 * موتور تطبیق هیچ مقداری را حدس نمی‌زند؛ هر مشخصه‌ای که در پنل ادمین خالی مانده
 * باشد، همان‌جا از امتیازدهی کنار می‌رود. این اسکریپت نشان می‌دهد کدام مشخصه‌ها
 * کم‌پوشش‌اند تا ادمین بداند پر کردنِ کدام فیلد بیشترین اثر را دارد.
 *
 *   npm run check:racket-match-data
 *
 * هیچ چیزی نمی‌نویسد و هیچ داده‌ای را تغییر نمی‌دهد.
 */

import mongoose from "mongoose";
import { normalizeRacketSpecs } from "../src/lib/racketMatch/normalize.js";
import { buildTargetProfile, rankProducts } from "../src/lib/racketMatch/engine.js";

const SCORED_FIELDS = [
  ["unstrungWeight", "وزن بدون زه"],
  ["swingweight", "وزن سویینگ"],
  ["headSize", "اندازه صفحه"],
  ["balance", "بالانس"],
  ["length", "طول راکت"],
  ["stringPattern", "الگوی زهکشی"],
  ["frameStiffnessRA", "میزان سختی"],
  ["recommendedLevel", "سطح بازی"],
  ["gripSizes", "سایزهای گریپ"],
  ["powerLevel", "شاخص قدرت"],
  ["controlLevel", "شاخص کنترل"],
  ["spinPotential", "شاخص اسپین"],
  ["maneuverability", "شاخص مانورپذیری"],
  ["stability", "شاخص پایداری"],
  ["comfort", "شاخص راحتی"],
  ["forgiveness", "شاخص بخشندگی"],
];

const uri = process.env.MONGODB_URI_TENADOR;
if (!uri) {
  console.error("MONGODB_URI_TENADOR تعریف نشده است. اسکریپت را با --env-file=.env اجرا کنید.");
  process.exit(1);
}

await mongoose.connect(uri);
const db = mongoose.connection.db;

const sport = await db.collection("sports").findOne({ slug: "tennis" });
if (!sport) {
  console.error("ورزش تنیس پیدا نشد.");
  await mongoose.disconnect();
  process.exit(1);
}

const category = await db.collection("categories").findOne({ sport: sport._id, slug: "racket" });
if (!category) {
  console.error("دستهٔ راکت تنیس پیدا نشد.");
  await mongoose.disconnect();
  process.exit(1);
}

const products = await db
  .collection("products")
  .find({ category: category._id, isActive: true })
  .project({ name: 1, attributes: 1, technicalStats: 1 })
  .toArray();

const variants = await db
  .collection("variants")
  .find({ categoryId: category._id })
  .project({ productId: 1, attributes: 1 })
  .toArray();

const variantsByProduct = new Map();
for (const variant of variants) {
  const key = String(variant.productId);
  if (!variantsByProduct.has(key)) variantsByProduct.set(key, []);
  variantsByProduct.get(key).push(variant);
}

const total = products.length;
const counts = new Map(SCORED_FIELDS.map(([key]) => [key, 0]));
const gaps = [];

for (const product of products) {
  const specs = normalizeRacketSpecs({
    ...product,
    variants: variantsByProduct.get(String(product._id)) || [],
  });
  const missing = [];
  for (const [key, label] of SCORED_FIELDS) {
    const value = specs[key];
    const present = Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined;
    if (present) counts.set(key, counts.get(key) + 1);
    else missing.push(label);
  }
  if (missing.length) gaps.push({ name: product.name, missing });
}

console.log("دستهٔ راکت تنیس — " + total + " محصول فعال\n");
console.log("پوشش هر مشخصه:");
for (const [key, label] of SCORED_FIELDS) {
  const n = counts.get(key);
  const percent = total ? Math.round((n / total) * 100) : 0;
  const bar = "█".repeat(Math.round(percent / 5)).padEnd(20, "·");
  console.log("  " + bar + " " + String(percent).padStart(3) + "%  " + n + "/" + total + "  " + label);
}

if (gaps.length) {
  console.log("\n" + gaps.length + " محصول حداقل یک مشخصهٔ خالی دارد. ۱۰ مورد اول:");
  for (const gap of gaps.slice(0, 10)) {
    console.log("  • " + gap.name + " → " + gap.missing.join("، "));
  }
} else {
  console.log("\nهمهٔ مشخصه‌های امتیازدهی برای همهٔ محصولات پر شده است.");
}

// یک اجرای نمونه تا مطمئن شویم موتور روی دادهٔ واقعی نتیجه می‌دهد
const pool = products.map((product) => ({
  _id: String(product._id),
  name: product.name,
  finalPriceToman: 10_000_000,
  specs: normalizeRacketSpecs({
    ...product,
    variants: variantsByProduct.get(String(product._id)) || [],
  }),
}));

const sample = rankProducts({
  products: pool,
  targetProfile: buildTargetProfile({
    level: "consistent",
    style: "spin",
    strength: "athletic",
    swingSpeed: "fast",
    priorities: ["spin", "control"],
    grip: "L2",
  }),
  answers: { level: "consistent", style: "spin", strength: "athletic", swingSpeed: "fast", grip: "L2" },
});

console.log("\nاجرای نمونه (بازیکن متوسط، اسپین‌محور، ضربهٔ سریع، گریپ L2):");
for (const item of [sample.best, ...sample.alternatives].filter(Boolean)) {
  console.log(
    "  " +
      (item.rank === 0 ? "بهترین  " : "جایگزین ") +
      String(Math.round(item.match.score)).padStart(3) +
      "٪  " +
      item.name,
  );
  for (const line of item.explanation.why) console.log("           - " + line);
  if (item.tradeoff?.text) console.log("           ↔ " + item.tradeoff.text);
}

await mongoose.disconnect();
