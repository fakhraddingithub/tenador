/**
 * scripts/splitPadelSharedCategories.js
 *
 * جداسازیِ دسته‌های مشترکِ چنددِ-ورزشی به دسته‌های مخصوصِ هر ورزش.
 *
 * دو دسته‌ی «backpack» و «overgrip» تاریخاً بینِ Tennis و Padel مشترک بودند و در
 * مهاجرتِ per-sport به ورزشِ غالب (tennis) اختصاص یافتند؛ در نتیجه /padel/backpack
 * و /padel/overgrip به ۴۰۴ می‌خوردند.
 *
 * این اسکریپت برای هر دسته:
 *   1. یک دسته‌ی جدید برای Padel می‌سازد که از نسخه‌ی Tennis کلون شده — همان title و
 *      «دقیقاً همان slug» (بدونِ پسوندِ خودکار)، اما sport = padel._id.
 *   2. محصولاتِ Padel که هنوز به دسته‌ی Tennis اشاره می‌کنند را به دسته‌ی جدید منتقل می‌کند.
 *   3. یک رکوردِ SlugRegistry برای دسته‌ی جدید ثبت می‌کند (یکتاییِ ترکیبیِ
 *      { type, slug, filterValue } اجازه‌ی هم‌نامیِ slug را می‌دهد).
 *
 * idempotent: اگر دسته‌ی Padel با همان slug موجود باشد دوباره ساخته نمی‌شود؛
 * انتقالِ محصولات و ثبتِ رجیستری هم با شرطِ وجود تکرارپذیرند.
 *
 * اجرا:  node scripts/splitPadelSharedCategories.js
 */

import mongoose from "mongoose";

try {
  process.loadEnvFile(".env");
} catch {
  // به متغیرهای محیطی موجود تکیه می‌کنیم
}

const MONGODB_URI = process.env.MONGODB_URI_TENADOR;
const SLUGS_TO_SPLIT = ["backpack", "overgrip"];

async function run() {
  if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI_TENADOR تنظیم نشده است.");
    process.exit(1);
  }

  console.log("🔌 در حال اتصال به MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("✅ متصل شد.\n");

  const db = mongoose.connection.db;
  const categories = db.collection("categories");
  const products = db.collection("products");
  const slugRegistries = db.collection("slugregistries");

  const tennis = await db.collection("sports").findOne({ slug: "tennis" }, { projection: { _id: 1 } });
  const padel = await db.collection("sports").findOne({ slug: "padel" }, { projection: { _id: 1 } });
  if (!tennis || !padel) {
    console.error("❌ ورزشِ tennis یا padel یافت نشد.");
    process.exit(1);
  }

  for (const slug of SLUGS_TO_SPLIT) {
    console.log(`\n📦 دسته‌ی «${slug}»:`);

    const source = await categories.findOne({ slug, sport: tennis._id });
    if (!source) {
      console.log(`  ⚠️ نسخه‌ی Tennis یافت نشد — رد شد.`);
      continue;
    }

    // ۱) دسته‌ی Padel (idempotent)
    let padelCat = await categories.findOne({ slug, sport: padel._id });
    if (padelCat) {
      console.log(`  • دسته‌ی Padel از قبل موجود است (${padelCat._id}) — کلون رد شد.`);
    } else {
      // ترتیبِ نمایش در انتهای دسته‌های Padel
      const last = await categories
        .find({ sport: padel._id })
        .sort({ order: -1 })
        .limit(1)
        .project({ order: 1 })
        .toArray();

      const now = new Date();
      const doc = {
        title: source.title,
        name: source.name,
        slug: source.slug, // ⬅️ دقیقاً همان slug، بدونِ پسوند
        sport: padel._id,
        parent: null, // کلونِ سطح-بالا؛ از لینکِ والدِ متعلق به ورزشِ دیگر پرهیز می‌کنیم
        prompts: source.prompts || [],
        icon: source.icon || "",
        image: source.image || "",
        attributes: source.attributes || [],
        variantAttributes: source.variantAttributes || [],
        technicalStats: source.technicalStats || [],
        technicalStatsPrompt: source.technicalStatsPrompt || "",
        order: (last[0]?.order ?? -1) + 1,
        createdAt: now,
        updatedAt: now,
      };

      const res = await categories.insertOne(doc);
      padelCat = { _id: res.insertedId, ...doc };
      console.log(`  ✅ دسته‌ی Padel ساخته شد: ${padelCat._id}  (slug=${padelCat.slug})`);
    }

    // ۲) انتقالِ محصولاتِ Padel که هنوز به دسته‌ی Tennis اشاره می‌کنند
    const moved = await products.updateMany(
      { category: source._id, sport: padel._id },
      { $set: { category: padelCat._id } },
    );
    console.log(`  ↪️ ${moved.modifiedCount} محصولِ Padel به دسته‌ی جدید منتقل شد.`);

    // ۳) ثبتِ SlugRegistry برای دسته‌ی Padel (dedup مثلِ registerSlug)
    const exists = await slugRegistries.findOne({
      slug,
      type: "category",
      filterValue: padelCat._id,
    });
    if (exists) {
      console.log(`  • رکوردِ SlugRegistry از قبل موجود است — رد شد.`);
    } else {
      const now = new Date();
      await slugRegistries.insertOne({
        slug,
        type: "category",
        model: "Category",
        refId: padelCat._id,
        filterField: "category",
        filterValue: padelCat._id,
        parentSlug: null,
        label: source.title,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`  ✅ رکوردِ SlugRegistry ثبت شد (type=category, slug=${slug}).`);
    }
  }

  // ── راستی‌آزمایی نهایی: تعداد محصولِ فعالِ هر (sport, slug) ──
  console.log("\n🔎 راستی‌آزمایی (محصولاتِ فعالِ هر دسته):");
  for (const slug of SLUGS_TO_SPLIT) {
    for (const [label, sportId] of [["tennis", tennis._id], ["padel", padel._id]]) {
      const cat = await categories.findOne({ slug, sport: sportId }, { projection: { _id: 1 } });
      if (!cat) {
        console.log(`  /${label}/${slug} → دسته یافت نشد`);
        continue;
      }
      const count = await products.countDocuments({ sport: sportId, category: cat._id, isActive: true });
      console.log(`  /${label}/${slug} → cat ${cat._id}  | محصولِ فعال: ${count}`);
    }
  }

  console.log("\n✅ پایان.");
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ خطا:", err);
  process.exit(1);
});
