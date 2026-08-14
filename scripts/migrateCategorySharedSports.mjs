/**
 * Audits and prepares the category-level shared-sport feature.
 *
 * Safe default (read-only):
 *   npm run check:category-shared-sports
 *
 * Apply mode creates only non-unique lookup/listing indexes. It never updates
 * a category or product document:
 *   npm run migrate:category-shared-sports
 */

import mongoose from "mongoose";

try {
  process.loadEnvFile(".env");
} catch {
  // Fall back to environment variables already provided by the runtime.
}

const uri = process.env.MONGODB_URI_TENADOR;
const apply = process.argv.includes("--apply");

const id = (value) => (value == null ? "" : String(value));
const normalizedText = (value) => String(value || "").trim().toLocaleLowerCase("en");

function categorySportIds(category) {
  const additional = Array.isArray(category.additionalSports)
    ? category.additionalSports.map(id).filter(Boolean)
    : [];
  return [...new Set([id(category.sport), ...additional].filter(Boolean))];
}

function auditCategories(categories, sportsById) {
  const errors = [];
  const identityOwners = new Map();

  for (const category of categories) {
    const label = `${category.title || category.name || category.slug || "بدون نام"} (${category._id})`;
    const ownerId = id(category.sport);

    if (!ownerId || !sportsById.has(ownerId)) {
      errors.push(`${label}: ورزش اصلی وجود ندارد یا نامعتبر است.`);
    }

    if (
      category.additionalSports !== undefined &&
      category.additionalSports !== null &&
      !Array.isArray(category.additionalSports)
    ) {
      errors.push(`${label}: additionalSports باید آرایه باشد.`);
      continue;
    }

    const additional = Array.isArray(category.additionalSports)
      ? category.additionalSports.map(id).filter(Boolean)
      : [];
    if (new Set(additional).size !== additional.length) {
      errors.push(`${label}: ورزش تکراری در additionalSports دارد.`);
    }
    if (additional.includes(ownerId)) {
      errors.push(`${label}: ورزش اصلی داخل additionalSports نیز تکرار شده است.`);
    }
    for (const sportId of additional) {
      if (!sportsById.has(sportId)) {
        errors.push(`${label}: ورزش نمایشی ${sportId} وجود ندارد.`);
      }
    }

    const identities = [
      ["slug", normalizedText(category.slug)],
      ["title", normalizedText(category.title)],
      ["name", normalizedText(category.name)],
    ].filter(([, value]) => value);

    for (const sportId of categorySportIds(category)) {
      for (const [field, value] of identities) {
        const key = `${sportId}\u0000${field}\u0000${value}`;
        const previous = identityOwners.get(key);
        if (previous && previous.categoryId !== id(category._id)) {
          const sport = sportsById.get(sportId);
          errors.push(
            `${label}: ${field} با دسته «${previous.label}» در ورزش ` +
              `«${sport?.title || sport?.slug || sportId}» تداخل دارد.`,
          );
        } else {
          identityOwners.set(key, {
            categoryId: id(category._id),
            label: category.title || category.slug || id(category._id),
          });
        }
      }
    }
  }

  return errors;
}

async function productSportUsage(db, categoriesById, sportsById) {
  const rows = await db.collection("products").aggregate([
    {
      $match: {
        category: { $type: "objectId" },
        sport: { $type: "objectId" },
      },
    },
    {
      $group: {
        _id: { category: "$category", sport: "$sport" },
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
      },
    },
    { $sort: { "_id.category": 1, total: -1 } },
  ]).toArray();

  const outsideConfiguration = [];
  const sportCountByCategory = new Map();

  for (const row of rows) {
    const categoryId = id(row._id.category);
    const sportId = id(row._id.sport);
    const category = categoriesById.get(categoryId);
    if (!category) continue;

    if (!sportCountByCategory.has(categoryId)) {
      sportCountByCategory.set(categoryId, new Set());
    }
    sportCountByCategory.get(categoryId).add(sportId);

    if (!categorySportIds(category).includes(sportId)) {
      outsideConfiguration.push({
        category: category.title || category.slug || categoryId,
        sport: sportsById.get(sportId)?.title || sportsById.get(sportId)?.slug || sportId,
        total: row.total,
        active: row.active,
      });
    }
  }

  const multiSportCategoryCount = [...sportCountByCategory.values()].filter(
    (sports) => sports.size > 1,
  ).length;

  return { outsideConfiguration, multiSportCategoryCount };
}

async function main() {
  if (!uri) throw new Error("MONGODB_URI_TENADOR تعریف نشده است.");

  console.log(apply ? "حالت APPLY: فقط ایندکس‌ها ساخته می‌شوند." : "حالت CHECK: کاملاً read-only.");
  await mongoose.connect(uri, { autoIndex: false, maxPoolSize: 2 });

  const db = mongoose.connection.db;
  const [categories, sports] = await Promise.all([
    db.collection("categories").find({}).project({
      title: 1,
      name: 1,
      slug: 1,
      sport: 1,
      additionalSports: 1,
    }).toArray(),
    db.collection("sports").find({}).project({ title: 1, name: 1, slug: 1 }).toArray(),
  ]);

  const categoriesById = new Map(categories.map((category) => [id(category._id), category]));
  const sportsById = new Map(sports.map((sport) => [id(sport._id), sport]));
  const errors = auditCategories(categories, sportsById);
  const usage = await productSportUsage(db, categoriesById, sportsById);

  console.log(`دسته‌ها: ${categories.length} | ورزش‌ها: ${sports.length}`);
  console.log(`دسته‌های استفاده‌شده توسط محصولات چند ورزش: ${usage.multiSportCategoryCount}`);

  if (usage.outsideConfiguration.length > 0) {
    console.log("\nموارد اطلاعاتی: محصول در ورزشی خارج از تنظیم فعلی دسته وجود دارد:");
    for (const row of usage.outsideConfiguration) {
      console.log(`  • ${row.category} / ${row.sport}: ${row.total} محصول (${row.active} فعال)`);
    }
    console.log("این گزارش فقط برای تصمیم ادمین است و هیچ محصولی تغییر نمی‌کند.");
  }

  if (errors.length > 0) {
    console.error(`\n${errors.length} خطای داده پیدا شد:`);
    for (const error of errors) console.error(`  ❌ ${error}`);
    throw new Error("تا رفع خطاهای بالا، ساخت ایندکس متوقف شد.");
  }

  console.log("\n✅ ساختار دسته‌ها و تداخل ورزش/اسلاگ معتبر است.");

  const requiredIndexes = [
    {
      collection: "categories",
      keys: { additionalSports: 1, slug: 1 },
      name: "additionalSports_1_slug_1",
    },
    {
      collection: "categories",
      keys: { sport: 1, order: 1, createdAt: 1 },
      name: "sport_1_order_1_createdAt_1",
    },
    {
      collection: "categories",
      keys: { additionalSports: 1, order: 1, createdAt: 1 },
      name: "additionalSports_1_order_1_createdAt_1",
    },
    {
      collection: "products",
      keys: { category: 1, isActive: 1, order: 1, createdAt: -1 },
      name: "category_1_isActive_1_order_1_createdAt_-1",
    },
  ];

  for (const index of requiredIndexes) {
    const collection = db.collection(index.collection);
    const existingIndexes = await collection.indexes();
    const exists = existingIndexes.some(
      (candidate) => JSON.stringify(candidate.key) === JSON.stringify(index.keys),
    );
    if (exists) {
      console.log(`✅ ایندکس ${index.collection}.${index.name} از قبل موجود است.`);
      continue;
    }
    if (!apply) {
      console.log(`ℹ️ ایندکس ${index.collection}.${index.name} باید در زمان استقرار ساخته شود.`);
      continue;
    }
    await collection.createIndex(index.keys, {
      name: index.name,
      background: true,
    });
    console.log(`✅ ایندکس ${index.collection}.${index.name} ساخته شد.`);
  }

  if (!apply) {
    console.log("\nبررسی read-only تمام شد؛ هیچ سند یا ایندکسی تغییر نکرد.");
  } else {
    console.log("\nمهاجرت تمام شد؛ فقط ایندکس‌ها تغییر کردند و تمام اسناد دست‌نخورده‌اند.");
  }
}

try {
  await main();
} catch (error) {
  console.error("\n❌", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
