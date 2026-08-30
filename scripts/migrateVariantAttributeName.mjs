/**
 * ترمیمِ یک rename قدیمی که پیش از پشتیبانی اتمیک انجام شده است.
 * پیش‌فرض فقط گزارش می‌دهد؛ --apply تغییر را در یک transaction اعمال می‌کند.
 *
 * مثال:
 * node --env-file=.env scripts/migrateVariantAttributeName.mjs \
 *   --category=698dee06873f747e9472d786 --from="String gauge" --to=Gauge
 */

import mongoose from "mongoose";
import { renameObjectKeys } from "../src/lib/categoryVariantAttributeRename.js";

const apply = process.argv.includes("--apply");
const arg = (name) => {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length).trim() || "";
};

const categoryIdText = arg("category");
const from = arg("from");
const to = arg("to");

if (!mongoose.isValidObjectId(categoryIdText) || !from || !to || from === to) {
  throw new Error("پارامترهای --category، --from و --to معتبر و متفاوت الزامی هستند");
}

const uri = process.env.MONGODB_URI_TENADOR;
if (!uri) throw new Error("MONGODB_URI_TENADOR تعریف نشده است");

const conn = await mongoose.createConnection(uri, { bufferCommands: false, maxPoolSize: 1 }).asPromise();
const categoryId = new mongoose.Types.ObjectId(categoryIdText);

try {
  const category = await conn.collection("categories").findOne(
    { _id: categoryId },
    { projection: { title: 1, variantAttributes: 1, megaMenuFilterAttribute: 1 } },
  );
  if (!category) throw new Error("دسته‌بندی پیدا نشد");

  const currentNames = (category.variantAttributes || []).map((item) => item.name);
  if (!currentNames.includes(to)) {
    throw new Error(`کلید مقصد «${to}» در تعریف فعلی دسته وجود ندارد`);
  }
  const targetLabel = category.variantAttributes.find((item) => item.name === to)?.label || to;

  const variants = await conn.collection("variants")
    .find({ categoryId })
    .project({ _id: 1, attributes: 1 })
    .toArray()
    .then((items) => items.filter((item) =>
      Object.prototype.hasOwnProperty.call(item.attributes || {}, from)
    ));
  const categoryProducts = await conn.collection("products")
    .find({ category: categoryId })
    .project({ _id: 1, variantMeta: 1 })
    .toArray();
  const products = categoryProducts.filter((item) =>
    Object.prototype.hasOwnProperty.call(item.variantMeta || {}, from)
  );
  const productIds = categoryProducts.map((product) => product._id);
  const productIdSet = new Set(productIds.map(String));
  const orders = productIds.length
    ? await conn.collection("orders")
      .find({
        "items.product": { $in: productIds },
        "items.variantSnapshot.name": from,
      })
      .project({ _id: 1, items: 1 })
      .toArray()
    : [];

  // تمام برخوردها پیش از شروع نوشتن بررسی می‌شوند.
  const variantUpdates = variants.map((variant) => ({
    _id: variant._id,
    attributes: renameObjectKeys(
      variant.attributes || {},
      [{ from, to }],
      `واریانت ${variant._id}`,
    ).value,
  }));
  const productUpdates = products.map((product) => ({
    _id: product._id,
    variantMeta: renameObjectKeys(
      product.variantMeta || {},
      [{ from, to }],
      `متادیتای محصول ${product._id}`,
    ).value,
  }));
  let changedOrderItems = 0;
  const orderUpdates = orders.flatMap((order) => {
    const set = {};
    for (const [index, item] of (order.items || []).entries()) {
      if (!productIdSet.has(String(item.product || ""))) continue;
      if (!Array.isArray(item.variantSnapshot)) continue;

      let changed = false;
      const snapshot = item.variantSnapshot.map((entry) => {
        if (entry?.name !== from) return entry;
        changed = true;
        return { ...entry, name: to, label: targetLabel };
      });
      if (!changed) continue;
      const snapshotNames = snapshot.map((entry) => entry?.name).filter(Boolean);
      if (new Set(snapshotNames).size !== snapshotNames.length) {
        throw new Error(`snapshot آیتم ${item._id || index} سفارش ${order._id} به کلید تکراری می‌رسد`);
      }
      set[`items.${index}.variantSnapshot`] = snapshot;
      changedOrderItems += 1;
    }
    return Object.keys(set).length ? [{ _id: order._id, set }] : [];
  });

  console.log(JSON.stringify({
    mode: apply ? "apply" : "check",
    category: category.title,
    from,
    to,
    variants: variantUpdates.length,
    productsWithVariantMeta: productUpdates.length,
    orders: orderUpdates.length,
    orderItems: changedOrderItems,
  }, null, 2));

  if (!apply) {
    console.log("فقط گزارش تهیه شد؛ برای اعمال، همان فرمان را با --apply اجرا کنید.");
  } else {
    const session = await conn.startSession();
    try {
      await session.withTransaction(async () => {
        const now = new Date();
        if (variantUpdates.length) {
          await conn.collection("variants").bulkWrite(
            variantUpdates.map((item) => ({
              updateOne: {
                filter: { _id: item._id },
                update: { $set: { attributes: item.attributes, updatedAt: now } },
              },
            })),
            { session, ordered: true },
          );
        }
        if (productUpdates.length) {
          await conn.collection("products").bulkWrite(
            productUpdates.map((item) => ({
              updateOne: {
                filter: { _id: item._id },
                update: { $set: { variantMeta: item.variantMeta, updatedAt: now } },
              },
            })),
            { session, ordered: true },
          );
        }
        if (orderUpdates.length) {
          await conn.collection("orders").bulkWrite(
            orderUpdates.map((item) => ({
              updateOne: {
                filter: { _id: item._id },
                update: { $set: { ...item.set, updatedAt: now } },
              },
            })),
            { session, ordered: true },
          );
        }

        const migratedVariants = variantUpdates.length
          ? await conn.collection("variants")
            .find(
              { _id: { $in: variantUpdates.map((item) => item._id) } },
              { session, projection: { _id: 1, attributes: 1 } },
            )
            .toArray()
          : [];
        if (
          migratedVariants.length !== variantUpdates.length
          || migratedVariants.some((variant) =>
            Object.prototype.hasOwnProperty.call(variant.attributes || {}, from)
            || !Object.prototype.hasOwnProperty.call(variant.attributes || {}, to)
          )
        ) {
          throw new Error("اعتبارسنجی واریانت‌های مهاجرت‌یافته ناموفق بود؛ transaction لغو شد");
        }

        const migratedProducts = productUpdates.length
          ? await conn.collection("products")
            .find(
              { _id: { $in: productUpdates.map((item) => item._id) } },
              { session, projection: { _id: 1, variantMeta: 1 } },
            )
            .toArray()
          : [];
        if (
          migratedProducts.length !== productUpdates.length
          || migratedProducts.some((product) =>
            Object.prototype.hasOwnProperty.call(product.variantMeta || {}, from)
            || !Object.prototype.hasOwnProperty.call(product.variantMeta || {}, to)
          )
        ) {
          throw new Error("اعتبارسنجی متادیتای محصولات ناموفق بود؛ transaction لغو شد");
        }

        const migratedOrders = orderUpdates.length
          ? await conn.collection("orders")
            .find(
              { _id: { $in: orderUpdates.map((item) => item._id) } },
              { session, projection: { _id: 1, items: 1 } },
            )
            .toArray()
          : [];
        if (
          migratedOrders.length !== orderUpdates.length
          || migratedOrders.some((order) => (order.items || []).some((item) =>
            productIdSet.has(String(item.product || ""))
            && (item.variantSnapshot || []).some((entry) => entry?.name === from)
          ))
        ) {
          throw new Error("اعتبارسنجی snapshot سفارش‌ها ناموفق بود؛ transaction لغو شد");
        }

        if (category.megaMenuFilterAttribute === from) {
          await conn.collection("categories").updateOne(
            { _id: categoryId },
            { $set: { megaMenuFilterAttribute: to, updatedAt: now } },
            { session },
          );
        }
      });
    } finally {
      await session.endSession();
    }
    console.log("مهاجرت با موفقیت و با حفظ شناسهٔ واریانت‌ها انجام شد.");
  }
} finally {
  await conn.close();
}
