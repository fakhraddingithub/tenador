import test from "node:test";
import assert from "node:assert/strict";

import {
  VariantAttributeRenameError,
  migrateVariantAttributeData,
  planVariantAttributeRenames,
  renameObjectKeys,
} from "../src/lib/categoryVariantAttributeRename.js";

test("نام قدیم و جدید را از originalName تشخیص می‌دهد و متادیتای فرم را ذخیره نمی‌کند", () => {
  const result = planVariantAttributeRenames(
    [{ name: "String gauge", label: "قطر زه" }],
    [{
      id: "client-only",
      originalName: "String gauge",
      name: "Gauge",
      label: "قطر",
      required: true,
    }],
  );

  assert.deepEqual(result.renames, [
    { from: "String gauge", to: "Gauge", label: "قطر" },
  ]);
  assert.deepEqual(result.definitions, [{ name: "Gauge", label: "قطر", required: true }]);
});

test("کلید attributes را بدون تغییر مقدار جابه‌جا می‌کند", () => {
  const result = renameObjectKeys(
    { "String gauge": "1.25", color: "black" },
    [{ from: "String gauge", to: "Gauge" }],
  );

  assert.equal(result.changed, true);
  assert.deepEqual(result.value, { Gauge: "1.25", color: "black" });
});

test("rename هم‌زمان زنجیره‌ای داده‌ها را overwrite نمی‌کند", () => {
  const result = renameObjectKeys(
    { A: "first", B: "second" },
    [{ from: "A", to: "B" }, { from: "B", to: "C" }],
  );

  assert.deepEqual(result.value, { B: "first", C: "second" });
});

test("برخورد مقصد با یک کلید مستقل را رد می‌کند", () => {
  assert.throws(
    () => renameObjectKeys(
      { old: "x", current: "y" },
      [{ from: "old", to: "current" }],
      "واریانت تست",
    ),
    VariantAttributeRenameError,
  );
});

test("نام نهایی تکراری یا originalName کهنه را رد می‌کند", () => {
  assert.throws(
    () => planVariantAttributeRenames(
      [{ name: "A", label: "الف" }],
      [
        { originalName: "A", name: "B", label: "ب" },
        { name: "B", label: "ب دوم" },
      ],
    ),
    /تکراری/,
  );

  assert.throws(
    () => planVariantAttributeRenames(
      [{ name: "A", label: "الف" }],
      [{ originalName: "old-page", name: "B", label: "ب" }],
    ),
    /تازه کنید/,
  );
});

test("مهاجرت دیتابیس فقط محتوای کلیدها را update می‌کند و شناسه‌ها را هدف می‌گیرد", async () => {
  const calls = { variantWrites: null, productWrites: null, orderWrites: null };
  const query = (rows) => ({
    select() { return this; },
    session() { return this; },
    async lean() { return rows; },
  });
  const Variant = {
    find: () => query([
      { _id: "variant-old", attributes: { "String gauge": "1.25" } },
      { _id: "variant-current", attributes: { Gauge: "1.30" } },
    ]),
    async bulkWrite(writes) { calls.variantWrites = writes; },
  };
  const Product = {
    find: () => query([
      {
        _id: "product-1",
        variantMeta: { "String gauge": { "1.25": { images: ["x.webp"] } } },
      },
    ]),
    async bulkWrite(writes) { calls.productWrites = writes; },
  };
  const Order = {
    find: () => query([{
      _id: "order-1",
      items: [{
        product: "product-1",
        variant: "variant-deleted-but-snapshot-remains",
        variantSnapshot: [
          { name: "String gauge", label: "String gauge", value: "1.25" },
        ],
      }],
    }]),
    async bulkWrite(writes) { calls.orderWrites = writes; },
  };

  const result = await migrateVariantAttributeData({
    categoryId: "category-1",
    renames: [{ from: "String gauge", to: "Gauge", label: "قطر" }],
    session: {},
    Variant,
    Product,
    Order,
  });

  assert.deepEqual(result, { variants: 1, products: 1, orders: 1, orderItems: 1 });
  assert.equal(calls.variantWrites.length, 1);
  assert.deepEqual(calls.variantWrites[0].updateOne.filter, { _id: "variant-old" });
  assert.deepEqual(
    calls.variantWrites[0].updateOne.update.$set.attributes,
    { Gauge: "1.25" },
  );
  assert.deepEqual(calls.productWrites[0].updateOne.filter, { _id: "product-1" });
  assert.deepEqual(
    calls.productWrites[0].updateOne.update.$set.variantMeta,
    { Gauge: { "1.25": { images: ["x.webp"] } } },
  );
  assert.deepEqual(
    calls.orderWrites[0].updateOne.update.$set["items.0.variantSnapshot"],
    [{ name: "Gauge", label: "قطر", value: "1.25" }],
  );
});

test("ویرایش فقط label نیز snapshot سفارش را بدون تغییر کلید واریانت همگام می‌کند", () => {
  const result = planVariantAttributeRenames(
    [{ name: "Gauge", label: "قطر زه" }],
    [{ originalName: "Gauge", name: "Gauge", label: "قطر" }],
  );

  assert.deepEqual(result.renames, [{ from: "Gauge", to: "Gauge", label: "قطر" }]);
});
