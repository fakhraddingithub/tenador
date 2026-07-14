/**
 * scripts/resolve-ambiguous-mapping.mjs
 *
 * برای مواردی که در mapping-issues.json به‌عنوان «مبهم» (چند فایلِ هم‌حجم در
 * یک فولدر) علامت خورده‌اند، این اسکریپت واقعاً محتوای فایل‌ها را دانلود
 * می‌کند و هشِ MD5 آن‌ها را مقایسه می‌کند — این تنها راهِ صددرصد مطمئن است
 * (نه حدس بر اساسِ ترتیب یا زمان).
 *
 * نتیجه:
 *   - اگر دقیقاً یک فایلِ ImageKit با همان هشِ فایلِ Cloudinary پیدا شود →
 *     به mapping.json اضافه می‌شود.
 *   - اگر چند فایلِ ImageKit همگی با همان هش پیدا شوند (یعنی خودِ فایل‌ها
 *     واقعاً کپیِ کاملِ هم هستند) → چون بایت‌به‌بایت یکسانند، انتخابِ هرکدام
 *     بی‌خطر است؛ اولی انتخاب و ثبت می‌شود.
 *   - اگر هیچ‌کدام مطابقت نداشت → در still-ambiguous.json باقی می‌ماند
 *     (نیاز به بررسیِ دستی).
 *
 * اجرا:
 *   node scripts/resolve-ambiguous-mapping.mjs
 *
 * پیش‌نیاز: mapping.json و mapping-issues.json باید از اجرای قبلیِ
 * build-cloudinary-imagekit-mapping.mjs موجود باشند.
 */

import fs from "fs";
import crypto from "crypto";

if (!fs.existsSync("mapping.json") || !fs.existsSync("mapping-issues.json")) {
  console.error("❌ ابتدا build-cloudinary-imagekit-mapping.mjs را اجرا کنید.");
  process.exit(1);
}

const mapping = JSON.parse(fs.readFileSync("mapping.json", "utf-8"));
const { ambiguous } = JSON.parse(fs.readFileSync("mapping-issues.json", "utf-8"));

console.log(`🔍 ${ambiguous.length} موردِ مبهم برای بررسیِ محتوایی پیدا شد.\n`);

async function md5Of(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  return crypto.createHash("md5").update(buffer).digest("hex");
}

// نکته‌ی حیاتی: ImageKit به‌طور پیش‌فرض همه‌ی تصاویر را موقعِ تحویل به‌صورتِ
// خودکار بهینه/فشرده می‌کند (حتی بدون هیچ پارامترِ ترنسفورمی در URL). یعنی
// بایت‌هایی که با fetch ساده دریافت می‌شوند، با فایلِ اصلیِ ذخیره‌شده فرق
// دارند و هشِ MD5 هیچ‌وقت مطابقت نمی‌دهد. برای گرفتنِ بایت‌های واقعی و
// دست‌نخورده، باید پارامترِ tr=orig-true اضافه شود.
function originalUrl(imagekitUrl) {
  const sep = imagekitUrl.includes("?") ? "&" : "?";
  return `${imagekitUrl}${sep}tr=orig-true`;
}

const stillAmbiguous = [];
let resolved = 0;

// برای جلوگیری از فشارِ زیاد روی شبکه، دسته‌ای (batch) پیش می‌رویم
const CONCURRENCY = 5;

async function processOne(item, index) {
  process.stdout.write(`\r[${index + 1}/${ambiguous.length}] در حالِ بررسی...`);

  const sourceHash = await md5Of(item.cloudinary.secureUrl);
  if (!sourceHash) {
    stillAmbiguous.push({ ...item, reason: "دانلودِ فایلِ مبدا (Cloudinary) ناموفق بود" });
    return;
  }

  const matches = [];
  for (const candidate of item.candidates) {
    const candidateHash = await md5Of(originalUrl(candidate.url));
    if (candidateHash === sourceHash) {
      matches.push(candidate);
    }
  }

  if (matches.length >= 1) {
    // اگر چند تطبیقِ هم‌هش پیدا شد، چون بایت‌به‌بایت با مبدا یکسانند، انتخابِ
    // اولی کاملاً امن است (تصویر دقیقاً همان چیزی است که باید باشد)
    mapping[item.cloudinary.secureUrl] = matches[0].url;
    resolved++;
  } else {
    stillAmbiguous.push({ ...item, reason: "هیچ‌کدام از کاندیدها با هشِ مبدا مطابقت نداشتند" });
  }
}

async function main() {
  for (let i = 0; i < ambiguous.length; i += CONCURRENCY) {
    const batch = ambiguous.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((item, j) => processOne(item, i + j)));
  }

  console.log("\n");

  fs.writeFileSync("mapping.json", JSON.stringify(mapping, null, 2));
  fs.writeFileSync("still-ambiguous.json", JSON.stringify(stillAmbiguous, null, 2));

  console.log("───────────────────────────────");
  console.log(`✅ حل‌شده با مقایسه‌ی محتوا: ${resolved}`);
  console.log(`❌ همچنان نامشخص:          ${stillAmbiguous.length}`);
  console.log("───────────────────────────────");
  console.log("\nmapping.json به‌روزرسانی شد.");
  if (stillAmbiguous.length > 0) {
    console.log("موارد باقی‌مانده در still-ambiguous.json ذخیره شدند — این تعداد کم را دستی بررسی کنید.");
  }
}

main().catch((err) => {
  console.error("❌ خطا:", err);
  process.exit(1);
});
