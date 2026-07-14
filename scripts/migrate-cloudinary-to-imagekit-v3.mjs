/**
 * scripts/migrate-cloudinary-to-imagekit.mjs  (نسخه‌ی اصلاح‌شده)
 *
 * ⚠️ این نسخه به‌جای حدس‌زدنِ آدرسِ جدید از روی مسیر، از فایلِ mapping.json
 * (ساخته‌شده توسط build-cloudinary-imagekit-mapping.mjs) استفاده می‌کند —
 * چون اسم‌های فایل در ImageKit تصادفی شده‌اند و دیگر قابلِ حدس‌زدن نیستند.
 *
 * پیش‌نیاز: قبل از این اسکریپت، حتماً build-cloudinary-imagekit-mapping.mjs
 * را اجرا کرده و mapping.json را ساخته و mapping-issues.json را بررسی
 * و صفر (یا قابل‌قبول) کرده باشید.
 *
 * نحوه‌ی اجرا:
 *   node scripts/migrate-cloudinary-to-imagekit.mjs                → فقط گزارش (dry-run)
 *   DRY_RUN=false node scripts/migrate-cloudinary-to-imagekit.mjs  → اجرای واقعی
 */

import { MongoClient } from "mongodb";
import fs from "fs";

const MONGODB_URI = process.env.MONGODB_URI;
const DRY_RUN = process.env.DRY_RUN !== "false";

if (!MONGODB_URI) {
  console.error("❌ لطفاً MONGODB_URI را در محیط تنظیم کنید.");
  process.exit(1);
}

if (!fs.existsSync("mapping.json")) {
  console.error(
    "❌ فایلِ mapping.json پیدا نشد. اول scripts/build-cloudinary-imagekit-mapping.mjs را اجرا کنید."
  );
  process.exit(1);
}

const MAPPING = JSON.parse(fs.readFileSync("mapping.json", "utf-8"));
const MAPPING_KEYS = Object.keys(MAPPING);
console.log(`📖 ${MAPPING_KEYS.length} آدرس در mapping.json بارگذاری شد.\n`);

const SKIP_COLLECTIONS = new Set(["sessions", "otps", "notifications"]);

let scannedDocs = 0;
let changedDocs = 0;
let changedStrings = 0;
const notFoundInMapping = new Set(); // آدرس‌های Cloudinary که توی دیتابیس هستن ولی توی mapping نیستن
const sampleChanges = []; // چند نمونه‌ی واقعیِ قبل→بعد برای بررسیِ چشمی (حداکثر ۱۰ تا)
const MAX_SAMPLES = 10;

/**
 * جایگزینیِ دقیق: اگر رشته دقیقاً یکی از کلیدهای mapping باشد، یا شاملِ یکی از
 * آن‌ها باشد (مثلاً اگر جایی توی HTML/متن قرار گرفته باشد)، آن بخش را عوض کن.
 */
function replaceKnownUrls(str) {
  if (typeof str !== "string" || !str.includes("res.cloudinary.com")) {
    return [str, false];
  }

  // حالتِ ساده و رایج: کل رشته دقیقاً همان آدرس است
  if (MAPPING[str]) {
    changedStrings++;
    if (sampleChanges.length < MAX_SAMPLES) {
      sampleChanges.push({ before: str, after: MAPPING[str] });
    }
    return [MAPPING[str], true];
  }

  // حالتِ نادر: آدرس داخلِ یک رشته‌ی بزرگ‌تر (مثلاً HTML) قرار گرفته
  let changed = false;
  let result = str;
  for (const oldUrl of MAPPING_KEYS) {
    if (result.includes(oldUrl)) {
      result = result.split(oldUrl).join(MAPPING[oldUrl]);
      changed = true;
      changedStrings++;
    }
  }

  if (!changed) {
    // آدرسِ Cloudinary هست ولی توی نقشه پیدا نشد — ثبت برای گزارشِ نهایی
    notFoundInMapping.add(str);
  }

  return [changed ? result : str, changed];
}

function walkAndReplace(value) {
  if (typeof value === "string") {
    return replaceKnownUrls(value);
  }

  if (Array.isArray(value)) {
    let changed = false;
    const newArr = value.map((item) => {
      const [newItem, itemChanged] = walkAndReplace(item);
      if (itemChanged) changed = true;
      return newItem;
    });
    return [changed ? newArr : value, changed];
  }

  if (value && typeof value === "object") {
    if (value._bsontype || value instanceof Date) {
      return [value, false];
    }
    let changed = false;
    const newObj = { ...value };
    for (const key of Object.keys(value)) {
      const [newVal, valChanged] = walkAndReplace(value[key]);
      if (valChanged) {
        newObj[key] = newVal;
        changed = true;
      }
    }
    return [changed ? newObj : value, changed];
  }

  return [value, false];
}

async function main() {
  console.log(`🔧 حالتِ اجرا: ${DRY_RUN ? "DRY-RUN (فقط گزارش)" : "⚠️ واقعی (ذخیره می‌شود)"}\n`);

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  const collections = await db.listCollections().toArray();

  for (const { name: collectionName } of collections) {
    if (SKIP_COLLECTIONS.has(collectionName)) continue;

    const collection = db.collection(collectionName);
    const cursor = collection.find({});
    let collectionChanged = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      scannedDocs++;

      const [newDoc, changed] = walkAndReplace(doc);

      if (changed) {
        changedDocs++;
        collectionChanged++;

        if (DRY_RUN) {
          console.log(`  [dry-run] ${collectionName} / ${doc._id} → تغییر خواهد کرد`);
        } else {
          const { _id, ...updateFields } = newDoc;
          await collection.updateOne({ _id: doc._id }, { $set: updateFields });
        }
      }
    }

    if (collectionChanged > 0) {
      console.log(`📁 ${collectionName}: ${collectionChanged} سند تغییر ${DRY_RUN ? "خواهد کرد" : "کرد"}`);
    }
  }

  await client.close();

  console.log("\n───────────────────────────────");
  console.log(`اسناد بررسی‌شده:  ${scannedDocs}`);
  console.log(`اسناد تغییریافته: ${changedDocs}`);
  console.log(`رشته‌های جایگزین‌شده: ${changedStrings}`);
  console.log(`آدرس‌های پیدانشده در mapping: ${notFoundInMapping.size}`);
  console.log("───────────────────────────────\n");

  if (sampleChanges.length > 0) {
    console.log(`🔎 نمونه‌ی واقعیِ قبل → بعد (${sampleChanges.length} مورد، برای بررسیِ چشمی):\n`);
    for (const s of sampleChanges) {
      console.log(`  قبل: ${s.before}`);
      console.log(`  بعد: ${s.after}\n`);
    }
  }

  if (notFoundInMapping.size > 0) {
    fs.writeFileSync(
      "not-found-in-mapping.json",
      JSON.stringify([...notFoundInMapping], null, 2)
    );
    console.log(
      "⚠️ برخی آدرس‌های Cloudinary در دیتابیس پیدا شدند که در mapping.json نبودند."
    );
    console.log("   لیستشان در not-found-in-mapping.json ذخیره شد — این‌ها هنوز به Cloudinary اشاره می‌کنند.");
    console.log("   (احتمالاً باید build-cloudinary-imagekit-mapping.mjs مشکلاتِ mapping-issues.json را هم پوشش دهد)\n");
  }

  if (DRY_RUN) {
    console.log("این فقط یک اجرای آزمایشی بود. برای اعمالِ واقعیِ تغییرات:");
    console.log("  DRY_RUN=false node scripts/migrate-cloudinary-to-imagekit.mjs\n");
  } else {
    console.log("✅ تغییرات با موفقیت روی دیتابیس ذخیره شد.\n");
  }
}

main().catch((err) => {
  console.error("❌ خطا در اجرای اسکریپت مهاجرت:", err);
  process.exit(1);
});
