/**
 * tests/categoryAttributeAudience.test.mjs
 *
 * نگهبانِ نرمال‌سازیِ `targetAudiences` در مسیرِ ذخیره‌ی دسته.
 *
 * دو قاعده‌ای که اینجا قفل می‌شوند:
 *   - enum مدل مقدارِ قدیمیِ «همه» را رد می‌کند، ولی کلِ سیستم آن را معادلِ
 *     «یونی سکس» می‌خواند؛ پس ورودی باید *پیش از* رسیدن به مدل canonical شود.
 *   - نبودِ فیلد (undefined) یعنی «این درخواست درباره‌ی مخاطب هدف نیست» و ویژگی
 *     باید دست‌نخورده رد شود — همان قراردادِ undefined ≠ {} در بقیه‌ی سیستم.
 *
 * اجرا: npm run test:target-audience
 */

import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./aliasHooks.mjs", import.meta.url);
const { normalizeAttributeAudiences } = await import(
  "../src/lib/categoryAttributeAudience.js"
);

test("مقدار قدیمی «همه» به یونی سکس تبدیل و تکراری‌ها حذف می‌شوند", () => {
  const result = normalizeAttributeAudiences(
    [{ name: "balance", label: "بالانس", targetAudiences: ["همه", "یونی‌سکس", "مردانه"] }],
    "عمومی",
  );

  assert.deepEqual(result.attributes[0].targetAudiences, ["یونی سکس", "مردانه"]);
  assert.equal(result.error, undefined);
});

test("مقدار ناشناخته با پیغام فارسی رد می‌شود، نه با خطای خامِ mongoose", () => {
  const result = normalizeAttributeAudiences(
    [{ name: "balance", label: "بالانس", targetAudiences: ["نوجوانان"] }],
    "عمومی",
  );

  assert.equal(result.attributes, undefined);
  assert.match(result.error, /نوجوانان/);
  assert.match(result.error, /بالانس/);
  assert.match(result.error, /عمومی/);

  // مقداری که آرایه نیست هم رد می‌شود
  assert.match(
    normalizeAttributeAudiences([{ name: "b", label: "ب", targetAudiences: "مردانه" }], "عمومی")
      .error,
    /فهرست/,
  );
});

test("نبودِ فیلد ویژگی را دست‌نخورده می‌گذارد و آرایه‌ی خالی معتبر است", () => {
  const untouched = { name: "material", label: "جنس", required: true };
  const result = normalizeAttributeAudiences(
    [untouched, { name: "b", label: "ب", targetAudiences: [] }, { name: "c", label: "ج", targetAudiences: null }],
    "عمومی",
  );

  // همان شیء، بدونِ افزودنِ پیش‌فرضِ ساختگی
  assert.equal(result.attributes[0], untouched);
  assert.ok(!("targetAudiences" in result.attributes[0]));
  assert.deepEqual(result.attributes[1].targetAudiences, []);
  assert.equal(result.attributes[2].targetAudiences, null);
});

test("ورودیِ غیرآرایه‌ای همان‌طور که آمده برمی‌گردد (undefined یعنی «دست نزن»)", () => {
  assert.equal(normalizeAttributeAudiences(undefined, "عمومی").attributes, undefined);
  assert.deepEqual(normalizeAttributeAudiences([], "عمومی").attributes, []);
});
