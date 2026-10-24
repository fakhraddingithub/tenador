/**
 * scripts/migrateLegacyBlocks.mjs
 *
 * بلوک‌های حذف‌شده‌ی مقاله/بروشور/مینی‌مقاله را به جانشینشان تبدیل می‌کند — قاعده در
 * src/lib/legacyArticleBlocks.js و src/lib/legacyBlockMigration.js:
 *
 *   گالری → تصویر · محصولاتِ دست‌دوم → اسلایدرِ محصولات · اسلایدرِ برند → نوارِ برندها
 *   جدیدترین/پرفروش‌ترین/شگفت‌انگیز → اسلایدرِ محصولات با محصولاتی که *امروز* نشان می‌دهند
 *   اسلایدرِ کالکشن/دسته/ورزش → حذف (جانشینی ندارند) — فهرستشان چاپ می‌شود
 *
 *   npm run check:legacy-blocks     # فقط گزارش (هیچ نوشتنی)
 *   npm run migrate:legacy-blocks   # اعمال
 *
 * **بلافاصله پس از استقرار و پیش از ویرایشِ دوباره‌ی محتوا اجرا شود:** ذخیره‌ی یک
 * سند بلوک‌های پویا را بدونِ ثبتِ محصولاتشان حذف می‌کند (همان قاعده‌ی overlayText).
 * تا پیش از اجرا، سایت گالری/دست‌دوم/برند را با جانشینشان نشان می‌دهد و بقیه را نه.
 *
 * idempotent است: پس از اعمال بلوکِ قدیمی‌ای نمی‌ماند و اجرای دوباره صفر می‌دهد.
 */
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

import { register } from "node:module";
// همان کوئریِ رندرِ قبلیِ بلوک‌های پویا (دیدپذیریِ ورزش/دسته) از سرویس‌های خودِ سایت
// خوانده می‌شود، نه یک کپیِ تقریبی — پس همان هوک‌های بارگذاریِ تست‌ها: نامک‌های base/ و
// @/، unstable_cache به‌شکلِ عبورِ ساده، و registerModels/Athlete قابلِ بارگذاری زیرِ ESM.
register("../tests/aliasHooks.mjs", import.meta.url);
register("../tests/listingFiltersHooks.mjs", import.meta.url);

const APPLY = process.argv.includes("--apply");

async function main() {
  const uri = process.env.MONGODB_URI_TENADOR;
  if (!uri) throw new Error("MONGODB_URI_TENADOR تعریف نشده است");
  const { default: mongoose } = await import("mongoose");
  await mongoose.connect(uri);
  global._mongooseCache = { conn: mongoose, promise: null };

  const { BLOCK_DOCUMENT_TARGETS, blockArraysOf, updateOf } = await import("../src/lib/blockDocumentTargets.js");
  const { migrateLegacyBlocks } = await import("../src/lib/legacyBlockMigration.js");
  const { default: Product } = await import("base/models/Product");
  const { getProductsVisibleInAnySportMatch } = await import("base/services/categorySportVisibility.service");
  const { andMongoFilters } = await import("base/utils/categorySportVisibility");

  const ids = (value) => (Array.isArray(value) ? value : []).map(String).filter((id) => mongoose.isValidObjectId(id));
  // عیناً کوئریِ resolveArticleEntities پیش از حذفِ این بلوک‌ها.
  const snapshot = async (block) => {
    const data = block.data || {};
    const limit = Math.min(16, Math.max(1, Number(data.limit) || 8));
    let query = { isActive: true };
    const sportIds = ids(data.sports);
    if (sportIds.length) query = andMongoFilters(query, await getProductsVisibleInAnySportMatch(sportIds));
    if (ids(data.categories).length) query.category = { $in: ids(data.categories) };
    if (block.type === "bestSellers") query.label = "best_seller";
    if (block.type === "amazingOffers") query.label = "discount";
    const docs = await Product.find(query).sort({ order: 1, createdAt: -1 }).limit(limit).select("_id").lean();
    return docs.map((doc) => doc._id);
  };

  const db = mongoose.connection.db;
  console.log(APPLY ? "▸ اعمالِ مهاجرت\n" : "▸ اجرای آزمایشی (بدونِ نوشتن)\n");
  let totalDocs = 0;
  let totalConverted = 0;
  const removed = [];

  for (const target of BLOCK_DOCUMENT_TARGETS) {
    const collection = db.collection(target.collection);
    const docs = await collection.find({}).toArray();
    let docsChanged = 0;
    let converted = 0;
    for (const doc of docs) {
      let changed = false;
      for (const blocks of blockArraysOf(doc, target)) {
        const report = await migrateLegacyBlocks(blocks, snapshot);
        if (!report.converted.length && !report.removed.length) continue;
        changed = true;
        converted += report.converted.length;
        for (const item of report.converted) console.log(`    ${target.collection} ${doc._id}: ${item.from} → ${item.to}${item.title ? ` «${item.title}»` : ""}${item.products != null ? ` (${item.products} محصول)` : ""}`);
        for (const item of report.removed) removed.push(`${target.collection} ${doc._id}: ${item.type}${item.title ? ` «${item.title}»` : ""}`);
      }
      if (!changed) continue;
      docsChanged += 1;
      if (APPLY) await collection.updateOne({ _id: doc._id }, { $set: updateOf(doc, target) });
    }
    console.log(`  ${target.collection}: ${docsChanged} سند / ${converted} بلوکِ تبدیل‌شده`);
    totalDocs += docsChanged;
    totalConverted += converted;
  }

  if (removed.length) {
    console.log(`\nبی‌جانشین — ${APPLY ? "حذف شدند" : "حذف می‌شوند"} (در صورتِ نیاز با بلوک‌های دیگر بازسازی کنید):`);
    for (const line of removed) console.log(`    ${line}`);
  }
  console.log(`\n${APPLY ? "✓ اعمال شد" : "برای اعمال: npm run migrate:legacy-blocks"} — ${totalDocs} سند، ${totalConverted} تبدیل، ${removed.length} حذف`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("✗", error?.stack || error);
  const { default: mongoose } = await import("mongoose");
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
