/**
 * scripts/build-cloudinary-imagekit-mapping.mjs
 *
 * چون rclone هنگام انتقال به ImageKit، اسمِ فایل‌های فارسی را به یک اسمِ
 * تصادفی تغییر داد (مثلاً "رول-زه-...webp" → "file_zt5pkj.webp")، دیگر
 * نمی‌شود صرفاً از روی مسیر/اسمِ فایل، آدرسِ جدید را حدس زد.
 *
 * این اسکریپت یک نگاشتِ دقیق و مطمئن می‌سازد: برای هر فایل، «حجمِ دقیقِ بایت»
 * را به‌عنوان شناسه استفاده می‌کند (چون فایل‌ها بایت‌به‌بایت یکسان کپی شده‌اند).
 *
 * خروجی: یک فایلِ JSON (mapping.json) شاملِ:
 *   { "<آدرس کامل قدیمی Cloudinary>": "<آدرس کامل جدید ImageKit>", ... }
 * و یک فایلِ گزارش (ambiguous.json) برای مواردی که نتوانست با اطمینان تطبیق دهد
 * (باید دستی بررسی شوند).
 *
 * اجرا:
 *   node scripts/build-cloudinary-imagekit-mapping.mjs
 *
 * نیازمندِ متغیرهای محیطیِ:
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *   IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT
 */

import { v2 as cloudinary } from "cloudinary";
import ImageKit from "imagekit";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const IMAGEKIT_ENDPOINT = (process.env.IMAGEKIT_URL_ENDPOINT || "").replace(/\/$/, "");

// ── قدم ۱: گرفتنِ همه‌ی فایل‌های Cloudinary (تصویر + PDF) با صفحه‌بندی ──
async function listAllCloudinaryResources() {
  const all = [];
  for (const resourceType of ["image", "raw"]) {
    let nextCursor = undefined;
    do {
      const res = await cloudinary.api.resources({
        resource_type: resourceType,
        type: "upload",
        max_results: 500,
        next_cursor: nextCursor,
      });
      for (const r of res.resources) {
        all.push({
          publicId: r.public_id, // شامل مسیرِ فولدر، بدون پسوند
          format: r.format,
          bytes: r.bytes,
          resourceType,
          secureUrl: r.secure_url,
          folder: r.public_id.includes("/")
            ? r.public_id.slice(0, r.public_id.lastIndexOf("/"))
            : "",
        });
      }
      nextCursor = res.next_cursor;
    } while (nextCursor);
  }
  return all;
}

// ── قدم ۲: گرفتنِ همه‌ی فایل‌های ImageKit با صفحه‌بندی ──
// نکته‌ی مهم: پارامترِ path را عمداً خالی می‌گذاریم؛ اگر path="/" بدهیم،
// API فقط فایل‌های سطحِ ریشه را برمی‌گرداند (نه فایل‌های داخلِ فولدرهای
// تودرتو مثلِ product/ یا coach-docs/) — دقیقاً همان چیزی که باعث شد فقط
// ۹ فایل پیدا شود. بدونِ path، API به‌صورتِ بازگشتی همه‌ی فایل‌های کتابخانه
// را برمی‌گرداند.
async function listAllImagekitFiles() {
  const all = [];
  let skip = 0;
  const limit = 1000;
  while (true) {
    const items = await imagekit.listFiles({
      limit,
      skip,
    });
    if (!items || items.length === 0) break;

    for (const f of items) {
      if (f.type !== "file") continue; // فولدرها را رد کن
      all.push({
        fileId: f.fileId,
        filePath: f.filePath, // مثلاً /product/file_zt5pkj.webp
        size: f.size,
        url: f.url,
        folder: f.filePath.includes("/")
          ? f.filePath.slice(1, f.filePath.lastIndexOf("/"))
          : "",
      });
    }

    if (items.length < limit) break;
    skip += limit;
  }
  return all;
}

async function main() {
  console.log("در حال دریافتِ لیستِ فایل‌های Cloudinary...");
  const cloudinaryFiles = await listAllCloudinaryResources();
  console.log(`  ${cloudinaryFiles.length} فایل پیدا شد.`);

  console.log("در حال دریافتِ لیستِ فایل‌های ImageKit...");
  const imagekitFiles = await listAllImagekitFiles();
  console.log(`  ${imagekitFiles.length} فایل پیدا شد.`);

  // گروه‌بندیِ فایل‌های ImageKit بر اساسِ (فولدر + حجم) برای جست‌وجوی سریع
  const ikByFolderSize = new Map(); // key: `${folder}::${size}` → [files]
  for (const f of imagekitFiles) {
    const key = `${f.folder}::${f.size}`;
    if (!ikByFolderSize.has(key)) ikByFolderSize.set(key, []);
    ikByFolderSize.get(key).push(f);
  }

  const mapping = {};
  const ambiguous = [];
  const unmatched = [];
  const usedImagekitFileIds = new Set();

  for (const cf of cloudinaryFiles) {
    const key = `${cf.folder}::${cf.bytes}`;
    const candidates = (ikByFolderSize.get(key) || []).filter(
      (f) => !usedImagekitFileIds.has(f.fileId)
    );

    if (candidates.length === 1) {
      const match = candidates[0];
      usedImagekitFileIds.add(match.fileId);
      mapping[cf.secureUrl] = `${IMAGEKIT_ENDPOINT}${match.filePath}`;
    } else if (candidates.length === 0) {
      unmatched.push({ publicId: cf.publicId, bytes: cf.bytes, folder: cf.folder });
    } else {
      // چند فایلِ هم‌حجم در همان فولدر — نمی‌توان مطمئن تطبیق داد
      ambiguous.push({
        cloudinary: { publicId: cf.publicId, bytes: cf.bytes, secureUrl: cf.secureUrl },
        candidates: candidates.map((c) => ({ filePath: c.filePath, url: c.url })),
      });
    }
  }

  fs.writeFileSync("mapping.json", JSON.stringify(mapping, null, 2));
  fs.writeFileSync(
    "mapping-issues.json",
    JSON.stringify({ ambiguous, unmatched }, null, 2)
  );

  console.log("\n───────────────────────────────");
  console.log(`✅ تطبیقِ مطمئن:   ${Object.keys(mapping).length}`);
  console.log(`⚠️ مبهم (هم‌حجم):  ${ambiguous.length}`);
  console.log(`❌ پیدا نشد:       ${unmatched.length}`);
  console.log("───────────────────────────────");
  console.log("\nفایلِ mapping.json ساخته شد (برای اسکریپتِ آپدیتِ دیتابیس).");
  if (ambiguous.length > 0 || unmatched.length > 0) {
    console.log(
      "⚠️ فایلِ mapping-issues.json را حتماً بررسی کنید — این موارد باید دستی حل شوند قبل از اجرای مهاجرتِ دیتابیس."
    );
  }
}

main().catch((err) => {
  console.error("❌ خطا:", err);
  process.exit(1);
});
