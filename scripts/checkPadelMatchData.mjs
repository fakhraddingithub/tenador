/**
 * scripts/checkPadelMatchData.mjs
 *
 * گزارشِ فقط-خواندنی از کیفیتِ دادهٔ راکت‌های پدل برای ابزارِ تطبیق — هم‌ارزِ
 * checkRacketMatchData.mjs تنیس.
 *
 * موتور تطبیق هیچ مقداری را حدس نمی‌زند؛ هر مشخصه‌ای که در پنل ادمین خالی یا
 * غیرقابل‌تفسیر باشد، همان‌جا از امتیازدهی کنار می‌رود. این اسکریپت نشان می‌دهد
 * کدام مشخصه‌ها کم‌پوشش‌اند تا ادمین بداند پر کردنِ کدام فیلد بیشترین اثر را
 * دارد، و چند پروفایلِ نمونه را روی دادهٔ واقعی اجرا می‌کند تا معلوم شود موتور
 * برای بازیکن‌های متفاوت واقعاً نتیجهٔ متفاوت می‌دهد.
 *
 *   npm run check:padel-match-data
 *
 * هیچ چیزی نمی‌نویسد و هیچ داده‌ای را تغییر نمی‌دهد.
 */

import mongoose from "mongoose";
import { normalizePadelSpecs } from "../src/lib/racketMatch/padel/normalize.js";
import { buildTargetProfile, rankProducts } from "../src/lib/racketMatch/padel/engine.js";

const SCORED_FIELDS = [
  ["levelScore", "سطح بازی"],
  ["shape", "شکل فریم"],
  ["balanceBias", "بالانس"],
  ["weightClass", "ردهٔ وزن (از «پیشنهاد برای»)"],
  ["surface", "جنس رویه"],
  ["coreFirmness", "سفتی هسته"],
  ["sweetSpotSize", "نقطهٔ شیرین"],
  ["powerLevel", "شاخص قدرت"],
  ["controlLevel", "شاخص کنترل"],
  ["spinPotential", "شاخص اسپین"],
  ["maneuverability", "شاخص مانورپذیری"],
  ["comfort", "شاخص راحتی"],
  ["forgiveness", "شاخص بخشندگی"],
  ["ballOutput", "شاخص خروج توپ"],
];

/** پروفایل‌های نمونه — عمداً خیلی متفاوت، تا حساسیتِ موتور دیده شود */
const SAMPLES = [
  {
    title: "تازه‌کار، ضربهٔ آرام، دنبال کنترل و راحتی",
    answers: {
      age: "adult",
      level: "new",
      strength: "below",
      swingSpeed: "slow",
      style: "control",
      priorities: ["control", "comfort", "forgiveness"],
    },
  },
  {
    title: "متوسط، همه‌کاره، ورزشکار",
    answers: {
      age: "adult",
      level: "consistent",
      strength: "athletic",
      swingSpeed: "moderate",
      style: "all-round",
      priorities: ["control", "maneuverability"],
    },
  },
  {
    title: "پیشرفته، تهاجمی، قوی، ضربهٔ بسیار سریع",
    answers: {
      age: "adult",
      level: "expert",
      strength: "verystrong",
      swingSpeed: "veryfast",
      style: "aggressive",
      priorities: ["power", "stability", "spin"],
    },
  },
];

const uri = process.env.MONGODB_URI_TENADOR;
if (!uri) {
  console.error("MONGODB_URI_TENADOR تعریف نشده است. اسکریپت را با --env-file=.env اجرا کنید.");
  process.exit(1);
}

await mongoose.connect(uri);
const db = mongoose.connection.db;

const sport = await db.collection("sports").findOne({ slug: "padel" });
if (!sport) {
  console.error("ورزش پدل پیدا نشد.");
  await mongoose.disconnect();
  process.exit(1);
}

const category = await db.collection("categories").findOne({ sport: sport._id, slug: "racket" });
if (!category) {
  console.error("دستهٔ راکت پدل پیدا نشد.");
  await mongoose.disconnect();
  process.exit(1);
}

const products = await db
  .collection("products")
  .find({ category: category._id, isActive: true })
  .project({ name: 1, attributes: 1, technicalStats: 1, basePrice: 1 })
  .toArray();

const total = products.length;
const counts = new Map(SCORED_FIELDS.map(([key]) => [key, 0]));
const gaps = [];

for (const product of products) {
  const specs = normalizePadelSpecs(product);
  const missing = [];
  for (const [key, label] of SCORED_FIELDS) {
    const value = specs[key];
    const present = Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined;
    if (present) counts.set(key, counts.get(key) + 1);
    else missing.push(label);
  }
  if (missing.length) gaps.push({ name: product.name, missing, composition: product.attributes?.Composition });
}

console.log("دستهٔ راکت پدل — " + total + " محصول فعال\n");
console.log("پوشش هر مشخصه:");
for (const [key, label] of SCORED_FIELDS) {
  const n = counts.get(key);
  const percent = total ? Math.round((n / total) * 100) : 0;
  const bar = "█".repeat(Math.round(percent / 5)).padEnd(20, "·");
  console.log("  " + bar + " " + String(percent).padStart(3) + "%  " + n + "/" + total + "  " + label);
}

if (gaps.length) {
  console.log(
    "\n" +
      gaps.length +
      " محصول حداقل یک مشخصه دارد که موتور نمی‌تواند تفسیرش کند (و بنابراین در امتیاز کنار گذاشته می‌شود):",
  );
  for (const gap of gaps.slice(0, 12)) {
    console.log("  • " + gap.name + " → " + gap.missing.join("، "));
    if (gap.composition) console.log("      ترکیب ساخت: " + gap.composition);
  }
  console.log(
    "\nراهنما: «سفتی هسته» فقط وقتی خوانده می‌شود که در «ترکیب ساخت» صفتی مثل نرم/متوسط/سخت\n" +
      "(یا Soft/Medium/Hard) کنارِ نامِ هسته آمده باشد. نامِ تجاریِ فوم به‌تنهایی — مثل\n" +
      "Power Foam — عمداً تفسیر نمی‌شود، چون سفتیِ آن یک ادعای تبلیغاتی است نه مشخصهٔ ثبت‌شده.",
  );
} else {
  console.log("\nهمهٔ مشخصه‌های امتیازدهی برای همهٔ محصولات قابلِ تفسیر است.");
}

// اجرای نمونه روی دادهٔ واقعی
const pool = products.map((product) => ({
  _id: String(product._id),
  name: product.name,
  finalPriceToman: null,
  basePriceToman: null,
  specs: normalizePadelSpecs(product),
}));

const winners = [];
for (const sample of SAMPLES) {
  const result = rankProducts({
    products: pool,
    targetProfile: buildTargetProfile(sample.answers),
    answers: sample.answers,
  });

  console.log("\n" + "─".repeat(70));
  console.log("پروفایل: " + sample.title);
  const profile = buildTargetProfile(sample.answers);
  console.log(
    "  هدف → شکل " +
      profile.shapeTarget.toFixed(2) +
      " | وزن " +
      JSON.stringify(profile.massRange) +
      " | بالانس " +
      JSON.stringify(profile.balanceRange) +
      " | هسته " +
      profile.coreTarget.toFixed(2) +
      " | رویه " +
      profile.surfaceTarget.toFixed(2),
  );
  for (const item of [result.best, ...result.alternatives].filter(Boolean)) {
    console.log(
      "  " +
        (item.rank === 0 ? "بهترین  " : "جایگزین ") +
        String(Math.round(item.match.score)).padStart(3) +
        "٪  [" +
        (item.specs.shape || "?") +
        "] " +
        item.name,
    );
    for (const line of item.explanation.why) console.log("           - " + line);
    if (item.tradeoff?.text) console.log("           ↔ " + item.tradeoff.text);
  }
  winners.push(result.best?._id);
}

// حساسیت: سه پروفایلِ کاملاً متفاوت نباید به یک راکت برسند
const distinct = new Set(winners.filter(Boolean));
console.log("\n" + "─".repeat(70));
if (distinct.size === winners.filter(Boolean).length) {
  console.log("حساسیت: هر سه پروفایل به راکتِ متفاوتی رسیدند.");
} else {
  console.log("هشدار: دو پروفایلِ متفاوت به یک راکت رسیدند — جدولِ وزن‌ها را بازبینی کنید.");
}

await mongoose.disconnect();
