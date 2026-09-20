/**
 * scripts/pinBlockSpacing.mjs
 *
 * فاصله‌ی پیش‌فرضِ بلوک صفر شد؛ این اسکریپت فاصله‌ی *فعلیِ* محتوای موجود را صریح
 * می‌کند تا هیچ صفحه‌ای جابه‌جا نشود. جزئیاتِ قاعده در src/lib/blockSpacingMigration.js.
 *
 *   npm run check:block-spacing     # فقط گزارش (هیچ نوشتنی)
 *   npm run migrate:block-spacing   # اعمال
 *
 * idempotent است: اجرای دوباره صفر تغییر گزارش می‌کند.
 */
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

import mongoose from "mongoose";
import { pinBlockSpacing } from "../src/lib/blockSpacingMigration.js";

const APPLY = process.argv.includes("--apply");

// هر جایی که بلوکِ مقاله‌ای ذخیره می‌شود؛ مسیرِ آرایه در همان داکیومنت.
const TARGETS = [
  { collection: "articles", paths: ["blocks"] },
  { collection: "articlerevisions", paths: ["blocks"] },
  { collection: "brands", paths: ["articleBlocks", "brochure.blocks"], arrayOfObjects: ["categoryArticles"] },
  { collection: "series", paths: ["articleBlocks"] },
];

const getPath = (doc, path) => path.split(".").reduce((value, key) => (value ? value[key] : undefined), doc);

async function main() {
  const uri = process.env.MONGODB_URI_TENADOR;
  if (!uri) throw new Error("MONGODB_URI_TENADOR تعریف نشده است");
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log(APPLY ? "▸ اعمالِ مهاجرت\n" : "▸ اجرای آزمایشی (بدونِ نوشتن)\n");

  let totalBlocks = 0;
  let totalDocs = 0;
  for (const target of TARGETS) {
    const collection = db.collection(target.collection);
    const docs = await collection.find({}).toArray();
    let docsChanged = 0;
    let blocksChanged = 0;

    for (const doc of docs) {
      let changed = 0;
      for (const path of target.paths) changed += pinBlockSpacing(getPath(doc, path));
      for (const path of target.arrayOfObjects || []) {
        for (const entry of getPath(doc, path) || []) changed += pinBlockSpacing(entry?.blocks);
      }
      if (!changed) continue;
      docsChanged += 1;
      blocksChanged += changed;
      if (APPLY) {
        const update = {};
        for (const path of target.paths) {
          const value = getPath(doc, path);
          if (value !== undefined) update[path] = value;
        }
        for (const path of target.arrayOfObjects || []) {
          const value = getPath(doc, path);
          if (value !== undefined) update[path] = value;
        }
        await collection.updateOne({ _id: doc._id }, { $set: update });
      }
    }

    console.log(`  ${target.collection}: ${docsChanged} سند / ${blocksChanged} بلوک`);
    totalDocs += docsChanged;
    totalBlocks += blocksChanged;
  }

  console.log(`\n${APPLY ? "✓ اعمال شد" : "برای اعمال: npm run migrate:block-spacing"} — ${totalDocs} سند، ${totalBlocks} بلوک`);
  if (!APPLY && totalBlocks > 0) console.log("تا پیش از اعمال، این بلوک‌ها با فاصله‌ی صفر رندر می‌شوند.");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("✗", error?.message || error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
