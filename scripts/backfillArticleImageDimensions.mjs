/**
 * بلوک‌های تصویرِ قدیمی (در مقالات و مینی‌مقاله‌ی برندها) عرض/ارتفاع ذخیره‌شده
 * ندارند، چون ویرایشگر تا پیش از این آن‌ها را ثبت نمی‌کرد. رندرِ عمومی بدون این
 * دو مقدار مجبور است پیش از بارگذاری یک نسبتِ فرضیِ ۱۶:۹ را رزرو کند و سپس به
 * نسبتِ واقعی بپرد (CLS). این اسکریپت ابعادِ واقعی را از خودِ فایل می‌خواند و
 * فقط همان‌جا که غایب است می‌نویسد.
 *
 * اجرای پیش‌فرض فقط گزارش می‌دهد؛ برای نوشتن --apply بدهید.
 *
 *   node --env-file=.env scripts/backfillArticleImageDimensions.mjs
 *   node --env-file=.env scripts/backfillArticleImageDimensions.mjs --apply
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const MAX_BYTES = 8 * 1024 * 1024;

/** ابعاد را از هدرِ خودِ فایل می‌خواند؛ برای فرمت‌های ناشناخته null برمی‌گرداند. */
function readDimensions(buf) {
  if (buf.length < 24) return null;

  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }

  // WebP (VP8 / VP8L / VP8X)
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") {
      return {
        width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
        height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
      };
    }
    return null;
  }

  // JPEG — باید میان مارکرها تا SOF جلو رفت
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const length = buf.readUInt16BE(i + 2);
      if (length < 2) return null;
      i += 2 + length;
    }
  }

  return null;
}

async function fetchDimensions(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error("file too large");
  const dims = readDimensions(buf);
  if (!dims || !dims.width || !dims.height) throw new Error("unrecognised image format");
  return dims;
}

const needsBackfill = (block) =>
  block?.type === "image"
  && typeof block?.data?.url === "string"
  && block.data.url.trim() !== ""
  && !/\.svg(\?|$)/i.test(block.data.url)
  && !(Number.isInteger(block.data.width) && block.data.width > 0
       && Number.isInteger(block.data.height) && block.data.height > 0);

async function backfillCollection(db, collectionName, blocksField) {
  const collection = db.collection(collectionName);
  const docs = await collection
    .find({ [`${blocksField}.type`]: "image" })
    .project({ [blocksField]: 1, title: 1, slug: 1, name: 1 })
    .toArray();

  const stats = { scanned: 0, filled: 0, skipped: 0, failed: 0, docsUpdated: 0 };

  for (const doc of docs) {
    const blocks = doc[blocksField] || [];
    let changed = false;

    for (const block of blocks) {
      if (block?.type !== "image") continue;
      stats.scanned += 1;
      if (!needsBackfill(block)) { stats.skipped += 1; continue; }

      try {
        const { width, height } = await fetchDimensions(block.data.url);
        // فقط همین دو کلید اضافه می‌شوند؛ به بقیه‌ی دادهٔ بلوک دست نمی‌خورد.
        block.data.width = width;
        block.data.height = height;
        changed = true;
        stats.filled += 1;
        console.log(`  ✓ ${collectionName}/${doc.slug || doc.name || doc._id} → ${width}x${height}  ${block.data.url.split("/").pop()}`);
      } catch (error) {
        stats.failed += 1;
        console.log(`  ✗ ${collectionName}/${doc.slug || doc.name || doc._id} → ${error.message}  ${block.data.url}`);
      }
    }

    if (changed && APPLY) {
      await collection.updateOne({ _id: doc._id }, { $set: { [blocksField]: blocks } });
      stats.docsUpdated += 1;
    }
  }

  return stats;
}

async function main() {
  const uri = process.env.MONGODB_URI_TENADOR || process.env.MONGODB_URI_LOCAL;
  if (!uri) throw new Error("MONGODB_URI_TENADOR (یا MONGODB_URI_LOCAL) تنظیم نشده است");

  await mongoose.connect(uri);
  console.log(APPLY ? "حالت: نوشتن (--apply)\n" : "حالت: فقط گزارش (برای نوشتن --apply بدهید)\n");

  const db = mongoose.connection.db;
  const articles = await backfillCollection(db, "articles", "blocks");
  const brands = await backfillCollection(db, "brands", "articleBlocks");

  const total = (key) => articles[key] + brands[key];
  console.log(`\nبلوکِ تصویرِ بررسی‌شده: ${total("scanned")}`);
  console.log(`ابعاد افزوده‌شده:      ${total("filled")}`);
  console.log(`از قبل داشت/SVG:      ${total("skipped")}`);
  console.log(`ناموفق:               ${total("failed")}`);
  console.log(`سندِ به‌روزشده:        ${total("docsUpdated")}`);
  if (!APPLY && total("filled")) console.log("\nهیچ چیزی نوشته نشد. برای اعمال، دوباره با --apply اجرا کنید.");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
