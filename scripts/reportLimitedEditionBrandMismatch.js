/**
 * Products whose limitedEdition belongs to a different brand.
 *
 * These are leftovers from models/Collaboration.js, which was global ("سراسری:
 * به برند یا سری خاصی وابسته نیست") — any brand's product could carry any
 * collaboration tag. The concept became brand-scoped in b28544a, but the rows
 * were never migrated, so a Tecnifibre bag can still carry Wilson's Roland
 * Garros edition.
 *
 * Report only (safe to run anytime):
 *   npm run report:limited-edition-brand-mismatch
 *
 * Clear the mismatched tags (sets limitedEdition = null, nothing else):
 *   npm run report:limited-edition-brand-mismatch -- --apply
 */

import mongoose from "mongoose";

try {
  process.loadEnvFile(".env");
} catch {
  // Use already-defined environment variables when .env is unavailable.
}

const uri = process.env.MONGODB_URI_TENADOR;
const shouldApply = process.argv.includes("--apply");

async function run() {
  if (!uri) throw new Error("MONGODB_URI_TENADOR is not configured");
  await mongoose.connect(uri, { autoIndex: false });

  const products = mongoose.connection.db.collection("products");

  const mismatched = await products
    .aggregate([
      { $match: { limitedEdition: { $ne: null, $exists: true } } },
      {
        $lookup: {
          from: "limitededitions",
          localField: "limitedEdition",
          foreignField: "_id",
          as: "edition",
        },
      },
      { $set: { edition: { $first: "$edition" } } },
      // ادیشنِ حذف‌شده (dangling) هم مثلِ ادیشنِ برندِ دیگر ناسازگار است
      { $match: { $expr: { $ne: ["$brand", "$edition.brand"] } } },
      {
        $lookup: {
          from: "brands",
          localField: "brand",
          foreignField: "_id",
          as: "productBrand",
        },
      },
      {
        $lookup: {
          from: "brands",
          localField: "edition.brand",
          foreignField: "_id",
          as: "ownerBrand",
        },
      },
      {
        $project: {
          name: 1,
          productBrand: { $first: "$productBrand.name" },
          editionTitle: "$edition.title",
          ownerBrand: { $first: "$ownerBrand.name" },
        },
      },
      { $sort: { productBrand: 1, name: 1 } },
    ])
    .toArray();

  if (mismatched.length === 0) {
    console.log("✅ No product carries a limited edition from another brand.");
    await mongoose.disconnect();
    return;
  }

  console.log(
    `⚠️  ${mismatched.length} product(s) carry a limited edition owned by another brand:\n`,
  );
  for (const row of mismatched) {
    console.log(`  • ${row.name}`);
    console.log(
      `      product brand: ${row.productBrand || "—"}   ` +
        `edition: ${row.editionTitle || "(deleted)"} (owner: ${row.ownerBrand || "—"})`,
    );
  }

  if (!shouldApply) {
    console.log(
      "\nRe-run with --apply to clear limitedEdition on these products.",
    );
    await mongoose.disconnect();
    return;
  }

  const result = await products.updateMany(
    { _id: { $in: mismatched.map((row) => row._id) } },
    { $set: { limitedEdition: null } },
  );
  console.log(`\n✅ Cleared limitedEdition on ${result.modifiedCount} product(s).`);
  console.log(
    "Remember to revalidate the products/limited-editions cache tags afterwards.",
  );

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
