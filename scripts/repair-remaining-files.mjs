/**
 * scripts/repair-remaining-files.mjs
 *
 * برای فایل‌هایی که با هیچ‌کدام از روش‌های قبلی (حجم، هش) قطعی تطبیق داده
 * نشدند، این اسکریپت به‌جای حدس‌زدن، خودش مستقیم:
 *   ۱. فایل را از Cloudinary دانلود می‌کند (با آدرسِ اصلی، تازه از Admin API).
 *   ۲. آن را مستقیم به همان فولدر در ImageKit آپلود می‌کند.
 *   ۳. چون خودمان آپلود کرده‌ایم، آدرسِ جدید را با قطعیتِ ۱۰۰٪ می‌دانیم و
 *      مستقیم به mapping.json اضافه می‌کنیم — دیگر نیازی به حدس نیست.
 *
 * ورودی: هر دو فایلِ still-unresolved-close.json و truly-missing.json را
 * می‌خواند (اگر یکی موجود نبود، نادیده گرفته می‌شود).
 *
 * اجرا:
 *   node scripts/repair-remaining-files.mjs
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

function loadItemsFrom(filename, extractor) {
  if (!fs.existsSync(filename)) return [];
  const data = JSON.parse(fs.readFileSync(filename, "utf-8"));
  return extractor(data);
}

// از هر دو منبعِ ممکن، لیستِ آیتم‌ها را جمع کن (هرکدام { publicId, folder, bytes })
const fromClose = loadItemsFrom("still-unresolved-close.json", (data) =>
  data.map((entry) => entry.item)
);
const fromMissing = loadItemsFrom("truly-missing.json", (data) => data);

// حذفِ تکراری‌ها (بر اساسِ publicId)
const seen = new Set();
const items = [...fromClose, ...fromMissing].filter((it) => {
  if (seen.has(it.publicId)) return false;
  seen.add(it.publicId);
  return true;
});

console.log(`🔧 ${items.length} فایل برای بازیابیِ مستقیم پیدا شد.\n`);

if (!fs.existsSync("mapping.json")) {
  console.error("❌ mapping.json پیدا نشد.");
  process.exit(1);
}
const mapping = JSON.parse(fs.readFileSync("mapping.json", "utf-8"));

async function getCloudinaryResource(publicId) {
  for (const resourceType of ["image", "raw"]) {
    try {
      const res = await cloudinary.api.resource(publicId, { resource_type: resourceType });
      return res;
    } catch {
      /* امتحانِ نوعِ بعدی */
    }
  }
  return null;
}

const failed = [];
let repaired = 0;

async function processOne(item, index) {
  console.log(`\n[${index + 1}/${items.length}] ${item.publicId}`);

  const resource = await getCloudinaryResource(item.publicId);
  if (!resource) {
    console.log("  ❌ در Cloudinary پیدا نشد (شاید قبلاً حذف شده)");
    failed.push({ ...item, reason: "در Cloudinary پیدا نشد" });
    return;
  }

  try {
    const fileRes = await fetch(resource.secure_url);
    if (!fileRes.ok) {
      console.log(`  ❌ دانلود ناموفق: HTTP ${fileRes.status}`);
      failed.push({ ...item, reason: `دانلود ناموفق: HTTP ${fileRes.status}` });
      return;
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer());

    const folder = item.folder || "";
    const fileName = item.publicId.split("/").pop();
    const ext = resource.format ? `.${resource.format}` : "";

    const uploadRes = await imagekit.upload({
      file: buffer,
      fileName: `${fileName}${ext}`,
      folder: `/${folder}`,
      useUniqueFileName: true,
    });

    if (!uploadRes || !uploadRes.url) {
      console.log("  ❌ آپلود به ImageKit ناموفق بود");
      failed.push({ ...item, reason: "آپلود به ImageKit ناموفق بود" });
      return;
    }

    mapping[resource.secure_url] = uploadRes.url;
    repaired++;
    console.log(`  ✅ بازیابی شد → ${uploadRes.url}`);
  } catch (err) {
    console.log(`  ❌ خطا: ${err.message}`);
    failed.push({ ...item, reason: err.message });
  }
}

async function main() {
  for (let i = 0; i < items.length; i++) {
    await processOne(items[i], i);
  }

  fs.writeFileSync("mapping.json", JSON.stringify(mapping, null, 2));
  if (failed.length > 0) {
    fs.writeFileSync("still-failed-after-repair.json", JSON.stringify(failed, null, 2));
  }

  console.log("\n───────────────────────────────");
  console.log(`✅ بازیابی‌شده و اضافه‌شده به mapping.json: ${repaired}`);
  console.log(`❌ همچنان ناموفق: ${failed.length}`);
  console.log("───────────────────────────────");
  if (failed.length > 0) {
    console.log("جزئیات در still-failed-after-repair.json — این تعدادِ کم را دستی از پنلِ ادمین دوباره آپلود کنید.");
  }
}

main().catch((err) => {
  console.error("❌ خطا:", err);
  process.exit(1);
});
