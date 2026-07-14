/**
 * scripts/verify-close-matches.mjs
 *
 * فایل‌هایی که در diagnose-unmatched.mjs به‌عنوان «نزدیک» (حجمِ تقریباً یکسان،
 * نه دقیقاً برابر) علامت خورده‌اند را با مقایسه‌ی هشِ محتوای واقعی تأیید می‌کند.
 *
 * برای اطمینان، آدرسِ اصلیِ Cloudinary را دوباره و مستقیم از Admin API (بر
 * اساسِ publicId) می‌گیرد — به فیلدهای احتمالاً ناقصِ فایل‌های قبلی وابسته نیست.
 *
 * اجرا:
 *   node scripts/verify-close-matches.mjs
 */

import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import crypto from "crypto";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const IMAGEKIT_ENDPOINT = (process.env.IMAGEKIT_URL_ENDPOINT || "").replace(/\/$/, "");

if (!fs.existsSync("close-matches.json") || !fs.existsSync("mapping.json")) {
  console.error("❌ ابتدا diagnose-unmatched.mjs را اجرا کنید.");
  process.exit(1);
}

const closeMatches = JSON.parse(fs.readFileSync("close-matches.json", "utf-8"));
const mapping = JSON.parse(fs.readFileSync("mapping.json", "utf-8"));

console.log(`🔍 ${closeMatches.length} موردِ نزدیک برای تأییدِ محتوایی\n`);

async function md5Of(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  return crypto.createHash("md5").update(buffer).digest("hex");
}

// حیاتی: بدونِ tr=orig-true، ImageKit نسخه‌ی بهینه‌شده تحویل می‌دهد و هش
// هیچ‌وقت مطابقت نمی‌کند.
function originalUrl(imagekitUrl) {
  const sep = imagekitUrl.includes("?") ? "&" : "?";
  return `${imagekitUrl}${sep}tr=orig-true`;
}

async function getCloudinarySecureUrl(item) {
  // اگر از قبل موجود بود، همان را استفاده کن؛ وگرنه مستقیم از Admin API بگیر
  if (item.secureUrl) return item.secureUrl;
  try {
    const res = await cloudinary.api.resource(item.publicId, {
      resource_type: "image",
    });
    return res.secure_url;
  } catch {
    try {
      const res = await cloudinary.api.resource(item.publicId, {
        resource_type: "raw",
      });
      return res.secure_url;
    } catch {
      return null;
    }
  }
}

const stillUnresolved = [];
let resolved = 0;

async function processOne(entry, index) {
  process.stdout.write(`\r[${index + 1}/${closeMatches.length}] در حالِ بررسی...`);

  const { item, candidates } = entry;

  const secureUrl = await getCloudinarySecureUrl(item);
  if (!secureUrl) {
    stillUnresolved.push({ ...entry, reason: "آدرسِ اصلیِ Cloudinary پیدا نشد" });
    return;
  }

  const sourceHash = await md5Of(secureUrl);
  if (!sourceHash) {
    stillUnresolved.push({ ...entry, reason: "دانلودِ فایلِ مبدا ناموفق بود" });
    return;
  }

  let foundUrl = null;
  for (const candidate of candidates) {
    const fullUrl = `${IMAGEKIT_ENDPOINT}${candidate.filePath}`;
    const candidateHash = await md5Of(originalUrl(fullUrl));
    if (candidateHash === sourceHash) {
      foundUrl = fullUrl;
      break;
    }
  }

  if (foundUrl) {
    mapping[secureUrl] = foundUrl;
    resolved++;
  } else {
    stillUnresolved.push({ ...entry, reason: "هیچ کاندیدی با هشِ مبدا مطابقت نداشت" });
  }
}

async function main() {
  const CONCURRENCY = 5;
  for (let i = 0; i < closeMatches.length; i += CONCURRENCY) {
    const batch = closeMatches.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((entry, j) => processOne(entry, i + j)));
  }

  console.log("\n");
  fs.writeFileSync("mapping.json", JSON.stringify(mapping, null, 2));
  fs.writeFileSync("still-unresolved-close.json", JSON.stringify(stillUnresolved, null, 2));

  console.log("───────────────────────────────");
  console.log(`✅ تأییدشده و اضافه‌شده به mapping.json: ${resolved}`);
  console.log(`❌ همچنان نامشخص (نیاز به بررسیِ دستی): ${stillUnresolved.length}`);
  console.log("───────────────────────────────");
  if (stillUnresolved.length > 0) {
    console.log("جزئیات در still-unresolved-close.json");
  }
}

main().catch((err) => {
  console.error("❌ خطا:", err);
  process.exit(1);
});
