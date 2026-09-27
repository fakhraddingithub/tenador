/**
 * scripts/migrateImageOverlayText.mjs
 *
 * «متنِ روی تصویر» حذف شد و جایش بلوک‌های واقعیِ روی تصویر آمدند. این اسکریپت
 * متن‌های موجود را به بلوکِ پاراگرافِ تودرتو تبدیل می‌کند تا هیچ محتوایی گم نشود.
 * جزئیاتِ قاعده در src/lib/imageOverlayTextMigration.js.
 *
 *   npm run check:image-overlay-text     # فقط گزارش (هیچ نوشتنی)
 *   npm run migrate:image-overlay-text   # اعمال
 *
 * **پیش از اینکه ادمین این بلوک‌ها را دوباره ذخیره کند اجرا شود:** ذخیره‌ی تازه
 * overlayText را دور می‌ریزد (دیگر در اعتبارسنجی نیست) و آن متن برنمی‌گردد.
 *
 * idempotent است: پس از اعمال، overlayText ای نمی‌ماند و اجرای دوباره صفر می‌دهد.
 */
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

import mongoose from "mongoose";
import { BLOCK_DOCUMENT_TARGETS, blockArraysOf, updateOf } from "../src/lib/blockDocumentTargets.js";
import { migrateImageOverlayText } from "../src/lib/imageOverlayTextMigration.js";

const APPLY = process.argv.includes("--apply");

async function main() {
  const uri = process.env.MONGODB_URI_TENADOR;
  if (!uri) throw new Error("MONGODB_URI_TENADOR تعریف نشده است");
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log(APPLY ? "▸ اعمالِ مهاجرت\n" : "▸ اجرای آزمایشی (بدونِ نوشتن)\n");

  let totalTexts = 0;
  let totalDocs = 0;
  for (const target of BLOCK_DOCUMENT_TARGETS) {
    const collection = db.collection(target.collection);
    const docs = await collection.find({}).toArray();
    let docsChanged = 0;
    let textsMoved = 0;

    for (const doc of docs) {
      let moved = 0;
      for (const blocks of blockArraysOf(doc, target)) moved += migrateImageOverlayText(blocks);
      if (!moved) continue;
      docsChanged += 1;
      textsMoved += moved;
      if (APPLY) await collection.updateOne({ _id: doc._id }, { $set: updateOf(doc, target) });
    }

    console.log(`  ${target.collection}: ${docsChanged} سند / ${textsMoved} متن`);
    totalDocs += docsChanged;
    totalTexts += textsMoved;
  }

  console.log(`\n${APPLY ? "✓ اعمال شد" : "برای اعمال: npm run migrate:image-overlay-text"} — ${totalDocs} سند، ${totalTexts} متن`);
  if (!APPLY && totalTexts > 0) console.log("تا پیش از اعمال، این متن‌ها روی سایت دیده نمی‌شوند.");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("✗", error?.message || error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
