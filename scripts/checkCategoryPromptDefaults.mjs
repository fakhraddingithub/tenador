/**
 * scripts/checkCategoryPromptDefaults.mjs
 *
 * فقط گزارش — هیچ نوشتنی ندارد.
 *
 * تا پیش از «تنظیمات پرامپت»، صفحه‌ی افزودنِ دسته هر دسته‌ی تازه را با چند
 * پرامپتِ پیش‌فرض (name، label، …) پر می‌کرد. آن متن‌ها حالا قواعدِ «پرامپت
 * پایه»اند. این اسکریپت دسته‌هایی را نشان می‌دهد که هنوز کپیِ عینیِ آن
 * پیش‌فرض‌ها را دارند تا ادمین در صورتِ تمایل خالی‌شان کند. در پرامپتِ نهایی
 * این کپی‌ها تکراری تشخیص داده و حذف می‌شوند، پس نگه‌داشتنشان ضرری ندارد —
 * تا وقتی پرامپت پایه همان قواعد را دارد.
 *
 *   npm run check:category-prompt-defaults
 */

import mongoose from "mongoose";
import {
  LEGACY_CATEGORY_PROMPT_DEFAULTS,
  normalizeRule,
} from "../src/lib/productPromptConfig.js";

try {
  process.loadEnvFile(".env");
} catch {
  // متغیرهای محیطی از خودِ runtime می‌آیند
}

const same = (a, b) => normalizeRule(a) === normalizeRule(b);

async function main() {
  const uri = process.env.MONGODB_URI_TENADOR;
  if (!uri) throw new Error("MONGODB_URI_TENADOR تعریف نشده است.");
  const conn = await mongoose.createConnection(uri, { bufferCommands: false }).asPromise();

  try {
    const categories = await conn
      .collection("categories")
      .find({ "prompts.0": { $exists: true } }, { projection: { title: 1, name: 1, prompts: 1 } })
      .toArray();

    let total = 0;
    for (const category of categories) {
      const copies = (category.prompts || [])
        .filter((p) => LEGACY_CATEGORY_PROMPT_DEFAULTS[p?.field] && same(p.context, LEGACY_CATEGORY_PROMPT_DEFAULTS[p.field]))
        .map((p) => p.field);
      if (!copies.length) continue;
      total += 1;
      console.log(`${category.title} (${category.name}) [${category._id}] → ${copies.join(", ")}`);
    }
    console.log(`\n${total} از ${categories.length} دسته‌ی دارای پرامپت، کپیِ عینیِ پیش‌فرض‌های قدیمی را دارند.`);
  } finally {
    await conn.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
