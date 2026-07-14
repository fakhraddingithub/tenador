/**
 * scripts/repair-not-found-urls.mjs
 *
 * برای آدرس‌هایی که در اجرای migrate-cloudinary-to-imagekit-v3.mjs به‌عنوان
 * «پیدانشده در mapping» ثبت شدند (فایلِ not-found-in-mapping.json)، این
 * اسکریپت دقیقاً مثلِ repair-remaining-files.mjs عمل می‌کند: مستقیم از
 * Cloudinary دانلود و به ImageKit آپلود می‌کند و به mapping.json اضافه می‌کند.
 *
 * تفاوت با repair-remaining-files.mjs: ورودی این‌جا آرایه‌ای از خودِ آدرس‌های
 * کامل (نه publicId جدا) است، پس اول publicId و فولدر را از روی خودِ URL
 * استخراج می‌کند.
 *
 * اجرا:
 *   node scripts/repair-not-found-urls.mjs
 *
 * بعد از این اسکریپت، دوباره migrate-cloudinary-to-imagekit-v3.mjs را با
 * DRY_RUN=true اجرا کنید تا مطمئن شوید «پیدانشده» به صفر (یا نزدیکِ صفر)
 * رسیده، قبل از اجرای نهاییِ DRY_RUN=false.
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

if (!fs.existsSync("not-found-in-mapping.json")) {
  console.error("❌ فایلِ not-found-in-mapping.json پیدا نشد.");
  process.exit(1);
}
if (!fs.existsSync("mapping.json")) {
  console.error("❌ فایلِ mapping.json پیدا نشد.");
  process.exit(1);
}

const urls = JSON.parse(fs.readFileSync("not-found-in-mapping.json", "utf-8"));
const mapping = JSON.parse(fs.readFileSync("mapping.json", "utf-8"));

console.log(`🔧 ${urls.length} آدرس برای بازیابی پیدا شد.\n`);

// استخراجِ publicId (شاملِ فولدر) از روی آدرسِ کاملِ Cloudinary
function extractPublicId(url) {
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  let rest = url.slice(idx + marker.length);
  rest = decodeURIComponent(rest);
  const segments = rest.split("/").filter((seg) => !/^v\d+$/.test(seg));
  const withExt = segments.join("/");
  // حذفِ پسوند برای گرفتنِ public_id خام (Cloudinary در Admin API بدونِ پسوند می‌خواهد)
  const lastDot = withExt.lastIndexOf(".");
  const publicId = lastDot > -1 ? withExt.slice(0, lastDot) : withExt;
  const folder = publicId.includes("/") ? publicId.slice(0, publicId.lastIndexOf("/")) : "";
  return { publicId, folder };
}

async function getCloudinaryResource(publicId) {
  for (const resourceType of ["image", "raw"]) {
    try {
      return await cloudinary.api.resource(publicId, { resource_type: resourceType });
    } catch {
      /* امتحانِ نوعِ بعدی */
    }
  }
  return null;
}

const failed = [];
let repaired = 0;

async function processOne(url, index) {
  console.log(`\n[${index + 1}/${urls.length}] ${url}`);

  const parsed = extractPublicId(url);
  if (!parsed) {
    console.log("  ❌ ساختارِ آدرس قابلِ تشخیص نبود");
    failed.push({ url, reason: "ساختار قابلِ تشخیص نبود" });
    return;
  }

  const resource = await getCloudinaryResource(parsed.publicId);
  if (!resource) {
    console.log("  ❌ در Cloudinary پیدا نشد (شاید حذف شده یا اسمش خاص است)");
    failed.push({ url, reason: "در Cloudinary پیدا نشد", publicId: parsed.publicId });
    return;
  }

  try {
    const fileRes = await fetch(resource.secure_url);
    if (!fileRes.ok) {
      console.log(`  ❌ دانلود ناموفق: HTTP ${fileRes.status}`);
      failed.push({ url, reason: `دانلود ناموفق: HTTP ${fileRes.status}` });
      return;
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer());

    const fileName = parsed.publicId.split("/").pop();
    const ext = resource.format ? `.${resource.format}` : "";

    const uploadRes = await imagekit.upload({
      file: buffer,
      fileName: `${fileName}${ext}`,
      folder: `/${parsed.folder}`,
      useUniqueFileName: true,
    });

    if (!uploadRes || !uploadRes.url) {
      console.log("  ❌ آپلود به ImageKit ناموفق بود");
      failed.push({ url, reason: "آپلود به ImageKit ناموفق بود" });
      return;
    }

    // هم آدرسِ اصلی (که در دیتابیس ذخیره شده) و هم secure_url تازه‌گرفته‌شده را
    // map می‌کنیم — چون ممکن است این دو کمی متفاوت باشند (نرمال‌سازیِ یونیکد و ...)
    mapping[url] = uploadRes.url;
    mapping[resource.secure_url] = uploadRes.url;
    repaired++;
    console.log(`  ✅ بازیابی شد → ${uploadRes.url}`);
  } catch (err) {
    console.log(`  ❌ خطا: ${err.message}`);
    failed.push({ url, reason: err.message });
  }
}

async function main() {
  for (let i = 0; i < urls.length; i++) {
    await processOne(urls[i], i);
  }

  fs.writeFileSync("mapping.json", JSON.stringify(mapping, null, 2));
  if (failed.length > 0) {
    fs.writeFileSync("still-failed-not-found.json", JSON.stringify(failed, null, 2));
  }

  console.log("\n───────────────────────────────");
  console.log(`✅ بازیابی‌شده و اضافه‌شده به mapping.json: ${repaired}`);
  console.log(`❌ همچنان ناموفق: ${failed.length}`);
  console.log("───────────────────────────────");
  if (failed.length > 0) {
    console.log("جزئیات در still-failed-not-found.json — این‌ها را دستی از پنلِ ادمین بررسی/جایگزین کنید.");
  }
  console.log("\nحالا دوباره migrate-cloudinary-to-imagekit-v3.mjs را با DRY_RUN=true اجرا کنید تا مطمئن شوید همه‌چیز پوشش داده شده.");
}

main().catch((err) => {
  console.error("❌ خطا:", err);
  process.exit(1);
});
