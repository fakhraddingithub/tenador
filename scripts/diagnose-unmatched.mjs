/**
 * scripts/diagnose-unmatched.mjs
 *
 * برای هر موردِ unmatched (که در build-cloudinary-imagekit-mapping.mjs هیچ
 * کاندیدی برایش پیدا نشد)، تمامِ فایل‌های همان فولدر را از ImageKit می‌گیرد
 * و کنارِ حجمِ موردِ انتظار نشان می‌دهد — تا مشخص شود فایل واقعاً منتقل نشده،
 * یا فقط حجمش کمی فرق دارد (که در این صورت با فاصله‌ی مجاز دوباره تطبیق
 * می‌دهیم).
 *
 * اجرا:
 *   node scripts/diagnose-unmatched.mjs
 */

import ImageKit from "imagekit";
import fs from "fs";

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

if (!fs.existsSync("mapping-issues.json")) {
  console.error("❌ فایل mapping-issues.json پیدا نشد.");
  process.exit(1);
}

const { unmatched } = JSON.parse(fs.readFileSync("mapping-issues.json", "utf-8"));
console.log(`🔍 ${unmatched.length} موردِ unmatched برای بررسی\n`);

async function listFolder(folder) {
  const path = folder ? `/${folder}` : "/";
  const items = await imagekit.listFiles({ path, limit: 1000 });
  return items.filter((f) => f.type === "file");
}

const folderCache = new Map();

async function main() {
  const closeMatches = [];
  const trulyMissing = [];

  for (const item of unmatched) {
    const folder = item.folder || "";
    if (!folderCache.has(folder)) {
      folderCache.set(folder, await listFolder(folder));
    }
    const files = folderCache.get(folder);

    // نزدیک‌ترین حجم‌ها را پیدا کن (فاصله تا ۵۰۰ بایت، برای احتمالِ اختلافِ
    // جزئیِ متادیتا بینِ دو سرویس)
    const near = files
      .map((f) => ({ ...f, diff: Math.abs(f.size - item.bytes) }))
      .filter((f) => f.diff <= 500)
      .sort((a, b) => a.diff - b.diff);

    console.log(`\n📄 ${item.publicId}  (حجمِ موردِ انتظار: ${item.bytes} بایت، فولدر: "${folder}")`);
    console.log(`   تعدادِ فایل‌های همین فولدر در ImageKit: ${files.length}`);

    if (near.length > 0) {
      console.log(`   نزدیک‌ترین‌ها:`);
      for (const n of near.slice(0, 3)) {
        console.log(`     - ${n.filePath}  (حجم: ${n.size}، اختلاف: ${n.diff} بایت)`);
      }
      closeMatches.push({ item, candidates: near.slice(0, 3) });
    } else {
      console.log(`   ❌ هیچ فایلِ نزدیکی در این فولدر پیدا نشد — احتمالاً واقعاً منتقل نشده.`);
      trulyMissing.push(item);
    }
  }

  fs.writeFileSync("close-matches.json", JSON.stringify(closeMatches, null, 2));
  fs.writeFileSync("truly-missing.json", JSON.stringify(trulyMissing, null, 2));

  console.log("\n───────────────────────────────");
  console.log(`نزدیک (احتمالِ تطبیقِ دستی): ${closeMatches.length}`);
  console.log(`واقعاً گم‌شده (نیاز به آپلودِ مجدد): ${trulyMissing.length}`);
  console.log("───────────────────────────────");
}

main().catch((err) => {
  console.error("❌ خطا:", err);
  process.exit(1);
});
