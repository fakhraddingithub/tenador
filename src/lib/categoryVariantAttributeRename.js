/**
 * برنامه‌ریزی و اجرای rename نامِ سیستمیِ ویژگی‌های واریانتِ یک دسته.
 *
 * نامِ ویژگی، کلیدِ Variant.attributes و Product.variantMeta است و در snapshot
 * نمایشی سفارش هم نگهداری می‌شود. بنابراین تغییرِ آن باید به‌صورتِ جابه‌جاییِ
 * کلید انجام شود، نه حذف/ساختِ واریانت؛ _id، SKU و ارجاع‌های سفارش/انبار ثابت‌اند.
 */

export class VariantAttributeRenameError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "VariantAttributeRenameError";
    this.status = status;
  }
}

const cleanName = (value) => (typeof value === "string" ? value.trim() : "");

/**
 * originalName فقط متادیتای فرم است و در Category ذخیره نمی‌شود. این مقدار
 * هویتِ ویژگی در لحظهٔ بازشدن فرم را نگه می‌دارد تا چند rename پیاپی پیش از
 * Submit هم همیشه از نامِ واقعاً موجود در دیتابیس محاسبه شوند.
 */
export function planVariantAttributeRenames(currentDefinitions = [], incomingDefinitions = []) {
  const currentByName = new Map(
    currentDefinitions
      .map((item) => [cleanName(item?.name), item])
      .filter(([name]) => Boolean(name)),
  );
  const currentNames = new Set(currentByName.keys());
  const claimedOriginalNames = new Set();
  const finalNames = new Set();
  const renames = [];

  const definitions = incomingDefinitions.map((item) => {
    const name = cleanName(item?.name);
    const label = cleanName(item?.label);
    const originalName = cleanName(item?.originalName);

    if (!name || !label) {
      throw new VariantAttributeRenameError("نام سیستمی و نام نمایشی ویژگی واریانت الزامی است");
    }
    if (finalNames.has(name)) {
      throw new VariantAttributeRenameError(`نام سیستمی «${name}» در ویژگی‌های واریانت تکراری است`);
    }
    finalNames.add(name);

    if (originalName) {
      if (!currentNames.has(originalName)) {
        throw new VariantAttributeRenameError(
          `ویژگی «${originalName}» دیگر در دسته‌بندی وجود ندارد؛ صفحه را تازه کنید و دوباره تلاش کنید`,
          409,
        );
      }
      if (claimedOriginalNames.has(originalName)) {
        throw new VariantAttributeRenameError(`ویژگی «${originalName}» بیش از یک‌بار ارسال شده است`);
      }
      claimedOriginalNames.add(originalName);
      const currentLabel = cleanName(currentByName.get(originalName)?.label);
      if (originalName !== name || currentLabel !== label) {
        renames.push({ from: originalName, to: name, label });
      }
    }

    // فیلدهای صرفاً کلاینتی نباید وارد سند Category شوند.
    const definition = { ...item };
    delete definition.id;
    delete definition.originalName;
    return { ...definition, name, label };
  });

  return { definitions, renames };
}

/**
 * چند rename را هم‌زمان اعمال می‌کند؛ swap و زنجیره‌هایی مثل A→B و B→C نیز
 * بدون overwrite پشتیبانی می‌شوند. اگر مقصد واقعاً با کلیدی خارج از نقشه پر
 * باشد، عملیات رد می‌شود تا هیچ داده‌ای بی‌صدا از بین نرود.
 */
export function renameObjectKeys(source, renames = [], context = "داده") {
  if (!source || typeof source !== "object" || renames.length === 0) {
    return { value: source || {}, changed: false };
  }

  const entries = source instanceof Map ? Array.from(source.entries()) : Object.entries(source);
  const renameMap = new Map(renames.map(({ from, to }) => [from, to]));
  const sourceKeys = new Set(entries.map(([key]) => key));
  const renamedSourceKeys = new Set(renameMap.keys());

  for (const { from, to } of renames) {
    if (!sourceKeys.has(from)) continue;
    if (sourceKeys.has(to) && !renamedSourceKeys.has(to)) {
      throw new VariantAttributeRenameError(
        `${context} هم‌زمان هر دو کلید «${from}» و «${to}» را دارد؛ ادغام خودکار امن نیست`,
        409,
      );
    }
  }

  const next = {};
  let changed = false;
  for (const [key, value] of entries) {
    const nextKey = renameMap.get(key) || key;
    if (nextKey !== key) changed = true;
    if (Object.prototype.hasOwnProperty.call(next, nextKey)) {
      throw new VariantAttributeRenameError(
        `${context} پس از تغییر نام، کلید تکراری «${nextKey}» خواهد داشت`,
        409,
      );
    }
    next[nextKey] = value;
  }

  return { value: next, changed };
}

/**
 * کلیدها را روی اسناد وابسته و نام/برچسب را در snapshot سفارش‌ها در همان session
 * جابه‌جا می‌کند. bulkWrite عمداً کل attributes/variantMeta را جایگزین می‌کند تا
 * نام‌هایی شامل فاصله هم بدون ساختنِ مسیرهای نقطه‌ای MongoDB درست کار کنند.
 */
export async function migrateVariantAttributeData({
  categoryId,
  renames,
  session,
  Variant,
  Product,
  Order,
}) {
  if (!renames.length) return { variants: 0, products: 0, orders: 0, orderItems: 0 };

  // عملیات‌های یک transaction روی یک session نباید موازی اجرا شوند.
  const variants = await Variant.find({ categoryId })
    .select("_id attributes")
    .session(session)
    .lean();
  const products = await Product.find({ category: categoryId })
    .select("_id variantMeta")
    .session(session)
    .lean();
  const productIds = products.map((product) => product._id);
  const oldNames = [...new Set(renames.map(({ from }) => from))];
  const orders = productIds.length
    ? await Order.find({
      "items.product": { $in: productIds },
      "items.variantSnapshot.name": { $in: oldNames },
    })
      .select("_id items.product items.variantSnapshot")
      .session(session)
      .lean()
    : [];

  const now = new Date();
  const variantWrites = [];
  for (const variant of variants) {
    const result = renameObjectKeys(
      variant.attributes || {},
      renames,
      `واریانت ${variant._id}`,
    );
    if (!result.changed) continue;
    variantWrites.push({
      updateOne: {
        filter: { _id: variant._id },
        update: { $set: { attributes: result.value, updatedAt: now } },
      },
    });
  }

  const productWrites = [];
  for (const product of products) {
    const result = renameObjectKeys(
      product.variantMeta || {},
      renames,
      `متادیتای واریانت محصول ${product._id}`,
    );
    if (!result.changed) continue;
    productWrites.push({
      updateOne: {
        filter: { _id: product._id },
        update: { $set: { variantMeta: result.value, updatedAt: now } },
      },
    });
  }

  const productIdSet = new Set(productIds.map(String));
  const renameBySource = new Map(renames.map((rename) => [rename.from, rename]));
  const orderWrites = [];
  let changedOrderItems = 0;
  for (const order of orders) {
    const itemSnapshotSets = {};

    for (const [index, item] of (order.items || []).entries()) {
      if (!productIdSet.has(String(item.product || ""))) continue;
      if (!Array.isArray(item.variantSnapshot) || !item.variantSnapshot.length) continue;

      let snapshotChanged = false;
      const nextSnapshot = item.variantSnapshot.map((entry) => {
        const rename = renameBySource.get(entry?.name);
        if (!rename) return entry;

        const nextLabel = rename.label || entry.label || rename.to;
        if (entry.name === rename.to && entry.label === nextLabel) return entry;
        snapshotChanged = true;
        return { ...entry, name: rename.to, label: nextLabel };
      });

      if (!snapshotChanged) continue;
      const snapshotNames = nextSnapshot.map((entry) => entry?.name).filter(Boolean);
      if (new Set(snapshotNames).size !== snapshotNames.length) {
        throw new VariantAttributeRenameError(
          `اسنپ‌شات آیتم ${item._id || index} سفارش ${order._id} پس از تغییر نام، ویژگی تکراری خواهد داشت`,
          409,
        );
      }
      itemSnapshotSets[`items.${index}.variantSnapshot`] = nextSnapshot;
      changedOrderItems += 1;
    }

    if (Object.keys(itemSnapshotSets).length) {
      orderWrites.push({
        updateOne: {
          filter: { _id: order._id },
          update: { $set: { ...itemSnapshotSets, updatedAt: now } },
        },
      });
    }
  }

  if (variantWrites.length) {
    await Variant.bulkWrite(variantWrites, { session, ordered: true });
  }
  if (productWrites.length) {
    await Product.bulkWrite(productWrites, { session, ordered: true });
  }
  if (orderWrites.length) {
    await Order.bulkWrite(orderWrites, { session, ordered: true });
  }

  return {
    variants: variantWrites.length,
    products: productWrites.length,
    orders: orderWrites.length,
    orderItems: changedOrderItems,
  };
}
