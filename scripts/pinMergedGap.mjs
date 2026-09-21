/**
 * scripts/pinMergedGap.mjs
 *
 * فاصله‌ی بینِ فرزندانِ بلوکِ ادغام‌شده تنظیم‌شدنی شد و پیش‌فرضش صفر است؛ این
 * اسکریپت فاصله‌ی *فعلیِ* محتوای موجود (۱rem موبایل / ۱.۵rem دسکتاپ) را صریح
 * می‌کند تا هیچ صفحه‌ای جابه‌جا نشود. قاعده در src/lib/mergedGapMigration.js.
 *
 *   npm run check:merged-gap     # فقط گزارش (هیچ نوشتنی)
 *   npm run migrate:merged-gap   # اعمال
 *
 * idempotent است: اجرای دوباره صفر تغییر گزارش می‌کند.
 */
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

import mongoose from "mongoose";
import { BLOCK_DOCUMENT_TARGETS, blockArraysOf, updateOf } from "../src/lib/blockDocumentTargets.js";
import { pinMergedGap } from "../src/lib/mergedGapMigration.js";

const APPLY = process.argv.includes("--apply");

async function main() {
  const uri = process.env.MONGODB_URI_TENADOR;
  if (!uri) throw new Error("MONGODB_URI_TENADOR تعریف نشده است");
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log(APPLY ? "▸ اعمالِ مهاجرت\n" : "▸ اجرای آزمایشی (بدونِ نوشتن)\n");

  let totalBlocks = 0;
  let totalDocs = 0;
  for (const target of BLOCK_DOCUMENT_TARGETS) {
    const collection = db.collection(target.collection);
    let docsChanged = 0;
    let blocksChanged = 0;

    for (const doc of await collection.find({}).toArray()) {
      let changed = 0;
      for (const blocks of blockArraysOf(doc, target)) changed += pinMergedGap(blocks);
      if (!changed) continue;
      docsChanged += 1;
      blocksChanged += changed;
      if (APPLY) await collection.updateOne({ _id: doc._id }, { $set: updateOf(doc, target) });
    }

    console.log(`  ${target.collection}: ${docsChanged} سند / ${blocksChanged} بلوکِ ادغام‌شده`);
    totalDocs += docsChanged;
    totalBlocks += blocksChanged;
  }

  console.log(`\n${APPLY ? "✓ اعمال شد" : "برای اعمال: npm run migrate:merged-gap"} — ${totalDocs} سند، ${totalBlocks} بلوک`);
  if (!APPLY && totalBlocks > 0) console.log("تا پیش از اعمال، فرزندانِ این بلوک‌ها بدونِ فاصله (چسبیده) رندر می‌شوند.");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("✗", error?.message || error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
