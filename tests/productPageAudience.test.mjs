/**
 * tests/productPageAudience.test.mjs
 *
 * قفلِ سیم‌کشیِ «مخاطب هدف» در صفحه‌ی محصول.
 *
 * قاعده‌ی واقعی در utils/targetAudience.js است و تستِ خودش را دارد
 * (tests/targetAudience.test.mjs). چیزی که *اینجا* محافظت می‌شود، مسیرِ رسیدنِ
 * آن قاعده به صفحه است — یعنی همان چیزی که با یک propِ جاافتاده بی‌صدا
 * می‌شکند و هیچ تستِ منطقی‌ای آن را نمی‌گیرد:
 *
 *   ۱. ویژگی‌های ثابت *سمتِ سرور* فیلتر می‌شوند، نه در کامپوننت — پس مقدارِ
 *      ذخیره‌شده‌ی یک ویژگیِ خارج از دامنه اصلاً به مرورگر نمی‌رسد.
 *   ۲. نمودار رادار فقط با isKidsAudience تصمیم گرفته می‌شود (نه با رشته‌ی
 *      جادوییِ «بچگانه») و ستونش برای بقیه‌ی مخاطب‌ها دست‌نخورده می‌ماند.
 *   ۳. همه‌ی مسیرهایی که ProductAttributesTable را رندر می‌کنند targetAudience
 *      را پاس می‌دهند (محصولِ نو و دستِ‌دوم).
 *
 * چرا تستِ رندر نیست؟ services/product.service.js داخلِ unstable_cache است و
 * زنجیره‌ی importش (models/Athlete.js) CommonJS و ESM را قاطی می‌کند، پس بیرون
 * از بیلدِ Next اجرا نمی‌شود. خواندنِ سورس، همان قراردادها را بدونِ هارنسِ DOM
 * می‌بندد — دقیقاً مثل tests/senderAddressForm.test.mjs.
 *
 * اجرا: npm run test:product-page-audience
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  attributeAppliesToAudience,
  filterAttributesByAudience,
  isKidsAudience,
} from "../utils/targetAudience.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const ATTRIBUTES_TABLE = "src/components/templates/product/ProductAttributesTable.jsx";
const RENDER_PATHS = [
  ["محصولِ نو", "src/components/templates/product/ProductTemplate.jsx",
    "src/components/templates/product/ProductTabs.jsx"],
  ["محصولِ دستِ‌دوم", "src/components/templates/secondHand/UsedProductTemplate.jsx",
    "src/components/templates/secondHand/UsedProductTabs.jsx"],
];

/* ── ۱. فیلترِ ویژگی‌ها سمتِ سرور انجام می‌شود ─────────────────────────────── */

test("هر دو صفحه‌ی محصول ویژگی‌های ثابت را با مخاطب هدف فیلتر می‌کنند", () => {
  for (const path of [
    "services/product.service.js",
    "src/app/(Site)/second-hand/[sportSlug]/page.jsx",
  ]) {
    const source = read(path);
    assert.ok(
      source.includes("filterAttributesByAudience"),
      `${path} از منبعِ واحدِ فیلتر استفاده نمی‌کند`,
    );
    assert.ok(
      /filterAttributesByAudience\([\s\S]{0,200}?targetAudience/.test(source),
      `${path} مخاطب هدفِ محصول را به فیلتر نمی‌دهد`,
    );
  }
});

test("مقدارِ ذخیره‌شده پس از فیلتر خوانده می‌شود، نه پیش از آن", () => {
  // اگر merge روی category.attributes خام انجام شود، ویژگیِ خارج از دامنه با
  // مقدارِ ذخیره‌شده‌اش دوباره ظاهر می‌شود. ترتیب مهم است، نه فقط وجودِ فیلتر.
  for (const path of [
    "services/product.service.js",
    "src/app/(Site)/second-hand/[sportSlug]/page.jsx",
  ]) {
    const source = read(path);
    const filterAt = source.indexOf("filterAttributesByAudience");
    const mapAt = source.indexOf(".map((attr) => ({", filterAt);
    assert.ok(filterAt !== -1 && mapAt > filterAt, `${path}: merge پیش از فیلتر است`);
  }
});

/* ── ۲. نمودار رادار ──────────────────────────────────────────────────────── */

test("نمودار رادار فقط با isKidsAudience تصمیم گرفته می‌شود", () => {
  const source = read(ATTRIBUTES_TABLE);

  assert.ok(
    source.includes('import { isKidsAudience } from "base/utils/targetAudience"'),
    "کامپوننت از منبعِ واحد استفاده نمی‌کند",
  );
  assert.ok(
    source.includes("const showComparisonGraph = !isKidsAudience(targetAudience)"),
    "شرطِ نمایشِ نمودار عوض شده است",
  );
  assert.ok(
    source.includes("{showComparisonGraph && (") &&
      /showComparisonGraph && \(\s*<ProductComparisonGraph/.test(source),
    "نمودار پشتِ شرط نیست",
  );
  // مقدارِ مخاطب هدف نباید به‌صورتِ رشته‌ی جادویی در کامپوننت مقایسه شود
  // (توضیحِ فارسی مجاز است؛ چیزی که ممنوع است، literal مقایسه‌شدنی است)
  assert.ok(
    !/["'`]بچگانه["'`]/.test(source),
    "مقدارِ مخاطب هدف در کامپوننت hardcode شده است",
  );
});

test("ستونِ نمودار برای بچگانه خالی می‌ماند، نه حذف‌شده", () => {
  const source = read(ATTRIBUTES_TABLE);
  // چیدمانِ دو ستونه ثابت می‌ماند تا عرضِ فهرستِ مشخصات برای هیچ مخاطبی تغییر نکند
  assert.ok(source.includes('className="grid grid-cols-1 md:grid-cols-2'));
  assert.ok(
    /<div dir="rtl">\s*\{showComparisonGraph/.test(source),
    "ستونِ نمودار خودش شرطی شده است؛ باید فقط محتوایش شرطی باشد",
  );
});

/* ── ۳. propها واقعاً پاس داده می‌شوند ────────────────────────────────────── */

test("همه‌ی مسیرهای رندر، مخاطب هدف را تا جدولِ مشخصات پاس می‌دهند", () => {
  for (const [label, templatePath, tabsPath] of RENDER_PATHS) {
    const template = read(templatePath);
    const tabs = read(tabsPath);

    assert.ok(
      /targetAudience=\{[^}]*targetAudience\}/.test(template),
      `${label}: تمپلیت مخاطب هدف را به تب‌ها نمی‌دهد`,
    );
    assert.ok(
      /^\s*targetAudience,\s*$/m.test(tabs),
      `${label}: کامپوننتِ تب‌ها propِ targetAudience را نمی‌گیرد`,
    );
    assert.ok(
      /<ProductAttributesTable[\s\S]{0,200}?targetAudience=\{targetAudience\}/.test(tabs),
      `${label}: مخاطب هدف به ProductAttributesTable نمی‌رسد`,
    );
  }
});

test("صفحه‌ی دستِ‌دوم مخاطب هدفِ محصولِ پایه را واقعاً سریالایز می‌کند", () => {
  // بدونِ این، propِ بالا همیشه undefined است و تستِ سیم‌کشی سبز ولی بی‌اثر می‌شود
  const source = read("src/app/(Site)/second-hand/[sportSlug]/page.jsx");
  assert.ok(/targetAudience:\s*raw\.baseProduct\.targetAudience/.test(source));
});

/* ── قاعده‌ای که این سیم‌کشی به صفحه می‌رساند ─────────────────────────────── */

test("رفتارِ نهایی برای هر مخاطب هدف همان چیزی است که صفحه نشان می‌دهد", () => {
  const attributes = [
    { name: "Head Size", label: "اندازه سر" },
    { name: "Balance", label: "بالانس", targetAudiences: ["یونی سکس"] },
    { name: "Junior Length", label: "طول جوانان", targetAudiences: ["بچگانه"] },
  ];
  const shown = (audience) =>
    filterAttributesByAudience(attributes, audience).map((a) => a.name);

  assert.deepEqual(shown("بچگانه"), ["Head Size", "Junior Length"]);
  assert.equal(isKidsAudience("بچگانه"), true); // نمودار پنهان

  for (const audience of ["مردانه", "زنانه", "یونی سکس"]) {
    assert.deepEqual(shown(audience), ["Head Size", "Balance"], audience);
    assert.equal(isKidsAudience(audience), false, audience); // نمودار نمایش داده می‌شود
  }

  // بدونِ مخاطب هدف: هیچ ویژگیِ محدودشده‌ای نمایش داده نمی‌شود — نه «همه»
  assert.deepEqual(shown(null), ["Head Size"]);
  assert.deepEqual(shown(""), ["Head Size"]);
  assert.equal(isKidsAudience(null), false); // نمودار مثل قبل نمایش داده می‌شود

  // و مقدارِ ذخیره‌شده هرگز قاعده را نقض نمی‌کند
  assert.equal(attributeAppliesToAudience(["بچگانه"], "مردانه"), false);
});
