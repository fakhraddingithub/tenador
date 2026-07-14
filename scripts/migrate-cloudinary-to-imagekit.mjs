/**
 * scripts/migrate-cloudinary-to-imagekit.mjs
 *
 * این اسکریپت تمامِ کالکشن‌های MongoDB را به‌صورت عمومی (بدون نیاز به دونستنِ
 * دقیقِ نامِ هر فیلد در هر مدل) پیمایش می‌کند و هر رشته‌ای که آدرسِ Cloudinary
 * شما باشد را به آدرسِ معادلِ ImageKit تبدیل می‌کند — با این فرض که مسیرِ
 * فولدر/فایل با rclone دقیقاً یکسان روی ImageKit کپی شده است.
 *
 * ⚠️ پیش‌نیاز (حتماً قبل از اجرا انجام دهید):
 *   ۱. یک بک‌آپِ کامل از دیتابیس بگیرید:
 *        mongodump --uri="$MONGODB_URI" --out=./backup-before-migration
 *   ۲. عکس‌ها را با rclone از Cloudinary به ImageKit منتقل کرده باشید، با حفظِ
 *      دقیقِ ساختارِ فولدر (همان چیزی که در پیام‌های قبلی توضیح داده شد).
 *   ۳. این اسکریپت را ابتدا با DRY_RUN=true (پیش‌فرض) اجرا کنید و خروجی را
 *      بررسی کنید؛ فقط وقتی مطمئن شدید، با DRY_RUN=false روی دیتابیسِ واقعی اجرا کنید.
 *
 * نحوه‌ی اجرا:
 *   node scripts/migrate-cloudinary-to-imagekit.mjs                → فقط گزارش (dry-run)
 *   DRY_RUN=false node scripts/migrate-cloudinary-to-imagekit.mjs  → اجرای واقعی و ذخیره‌ی تغییرات
 *
 * متغیرهای محیطی موردنیاز (در .env یا مستقیم پاس بدهید):
 *   MONGODB_URI                          آدرسِ اتصال به دیتابیس
 *   CLOUDINARY_CLOUD_NAME                برای تشخیصِ ایمن‌ترِ آدرس‌های خودتان
 *   IMAGEKIT_URL_ENDPOINT                مثلاً https://ik.imagekit.io/your_id
 */

import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const IMAGEKIT_ENDPOINT = (process.env.IMAGEKIT_URL_ENDPOINT || "").replace(/\/$/, "");
const DRY_RUN = process.env.DRY_RUN !== "false"; // پیش‌فرض: dry-run (امن)

if (!MONGODB_URI || !CLOUD_NAME || !IMAGEKIT_ENDPOINT) {
  console.error(
    "❌ لطفاً MONGODB_URI و CLOUDINARY_CLOUD_NAME و IMAGEKIT_URL_ENDPOINT را در محیط تنظیم کنید."
  );
  process.exit(1);
}

// کالکشن‌های سیستمی/بدون‌ربط که پیمایش نمی‌شوند (برای سرعت و امنیتِ بیشتر)
const SKIP_COLLECTIONS = new Set([
  "sessions",
  "otps",
  "notifications",
]);

/**
 * تبدیلِ یک آدرسِ Cloudinary به معادلِ ImageKit.
 * الگوی Cloudinary: https://res.cloudinary.com/<cloud>/image/upload/[transforms/][vNNN/]<path>
 * الگوی ImageKit:   https://ik.imagekit.io/<your_id>/<path>
 */
function cloudinaryToImagekit(url) {
  if (typeof url !== "string") return null;
  if (!url.includes("res.cloudinary.com")) return null;
  if (!url.includes(`/${CLOUD_NAME}/`)) return null; // فقط اکانتِ خودمان

  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;

  let rest = url.slice(idx + marker.length);

  // حذفِ سگمنت‌های ترنسفورم (شامل , یا =) که ممکن است قبل از نسخه بیایند
  const segments = rest.split("/");
  const cleaned = segments.filter(
    (seg) => !/^v\d+$/.test(seg) && !/[,=]/.test(seg)
  );
  rest = cleaned.join("/");

  if (!rest) return null;

  return `${IMAGEKIT_ENDPOINT}/${rest}`;
}

let scannedDocs = 0;
let changedDocs = 0;
let changedStrings = 0;

/**
 * پیمایشِ بازگشتیِ یک مقدار (شیء/آرایه/رشته) و جایگزینیِ هر آدرسِ Cloudinary.
 * برمی‌گرداند: [مقدارِ جدید, آیا_تغییر_کرد]
 */
function walkAndReplace(value) {
  if (typeof value === "string") {
    const replaced = cloudinaryToImagekit(value);
    if (replaced) {
      changedStrings++;
      return [replaced, true];
    }
    return [value, false];
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
    // مواظبِ ObjectId/Date/Buffer باشیم — این‌ها را دست‌نخورده برگردان
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
  console.log(`\n🔧 حالتِ اجرا: ${DRY_RUN ? "DRY-RUN (فقط گزارش، بدون ذخیره)" : "⚠️ واقعی (تغییرات ذخیره می‌شوند)"}\n`);

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
  console.log("───────────────────────────────\n");

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
