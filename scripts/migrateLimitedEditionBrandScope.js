/**
 * Scoped Limited Edition slug/index migration.
 *
 * Default mode is read-only:
 *   npm run migrate:limited-edition-brand-scope
 *
 * Apply only after reviewing the report:
 *   npm run migrate:limited-edition-brand-scope -- --apply
 *
 * Apply mode removes the old global unique slug index and creates:
 *   { brand: 1, slug: 1 } unique
 *   { relatedBrands: 1 }
 */

import mongoose from "mongoose";

try {
  process.loadEnvFile(".env");
} catch {
  // Use already-defined environment variables when .env is unavailable.
}

const uri = process.env.MONGODB_URI_TENADOR;
const shouldApply = process.argv.includes("--apply");

function sameKeys(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function run() {
  if (!uri) throw new Error("MONGODB_URI_TENADOR is not configured");
  await mongoose.connect(uri, { autoIndex: false });

  const collection = mongoose.connection.db.collection("limitededitions");
  const [documents, indexes] = await Promise.all([
    collection
      .find({}, { projection: { brand: 1, slug: 1, name: 1, title: 1 } })
      .toArray(),
    collection.indexes(),
  ]);

  const invalid = documents.filter((doc) => !doc.brand || !doc.slug);
  const seen = new Map();
  const duplicates = [];
  for (const doc of documents) {
    if (!doc.brand || !doc.slug) continue;
    const key = `${doc.brand}:${doc.slug}`;
    if (seen.has(key)) duplicates.push([seen.get(key), doc]);
    else seen.set(key, doc);
  }

  console.log(`Mode: ${shouldApply ? "APPLY" : "DRY RUN"}`);
  console.log(`Limited editions: ${documents.length}`);
  console.log(`Missing brand/slug: ${invalid.length}`);
  console.log(`Duplicate brand+slug pairs: ${duplicates.length}`);
  console.log(
    "Indexes:",
    indexes.map((index) => ({ name: index.name, key: index.key, unique: Boolean(index.unique) })),
  );

  if (invalid.length || duplicates.length) {
    console.error("Migration cannot continue until invalid/duplicate records are resolved.");
    process.exitCode = 1;
    return;
  }

  if (!shouldApply) {
    console.log("Read-only check complete. Re-run with --apply after approval.");
    return;
  }

  // ابتدا ایندکس‌های جدید ساخته می‌شوند تا حتی در صورت شکست مرحله‌ی بعد، مسیرهای
  // فعلی بدون ایندکس نمانند. حذف ایندکس قدیمی آخرین تغییر است.
  await collection.createIndex(
    { brand: 1, slug: 1 },
    { unique: true, name: "brand_1_slug_1", background: true },
  );
  await collection.createIndex(
    { relatedBrands: 1 },
    { name: "relatedBrands_1", background: true },
  );

  const globalSlugIndex = indexes.find(
    (index) => index.unique && sameKeys(index.key, { slug: 1 }),
  );
  if (globalSlugIndex) {
    await collection.dropIndex(globalSlugIndex.name);
    console.log(`Dropped ${globalSlugIndex.name}`);
  }
  console.log("Scoped indexes are ready.");
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
