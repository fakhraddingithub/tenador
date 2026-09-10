/**
 * tests/categoryFormCopy.test.mjs
 *
 * نگهبانِ دو کشوییِ فرمِ ساختِ دسته:
 *   - «بارگذاری از دسته دیگر» باید *همه‌ی* داده‌ی دسته را بیاورد (باگِ اصلی:
 *     فقط attributes و prompts کپی می‌شد و بقیه‌ی فرم خالی می‌ماند)،
 *   - «دسته والد» فقط دسته‌های همان ورزش، و برچسبِ کشوییِ بارگذاری باید نام
 *     ورزش را بعد از نام دسته داشته باشد (دو دسته‌ی هم‌نام «راکت»).
 *
 * اجرا: npm run test:category-form-copy
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildCategoryCopy,
  categorySportTitle,
  loadFromCategoryOptions,
  parentCategoryChoices,
} from "../src/lib/categoryFormCopy.mjs";

const TENNIS = "aaaaaaaaaaaaaaaaaaaaaaa1";
const PADEL = "aaaaaaaaaaaaaaaaaaaaaaa2";
const BADMINTON = "aaaaaaaaaaaaaaaaaaaaaaa3";

const PROMPT_FIELDS = [
  "name",
  "label",
  "shortDescription",
  "longDescription",
  "color",
  "basePrice",
  "tag",
];

let counter = 0;
const newId = (prefix) => `${prefix}-${++counter}`;

/** دسته‌ی مبدأ با هر فیلدی که مدل می‌شناسد پر شده است. */
const tennisRacket = () => ({
  _id: "cat-tennis-racket",
  title: "راکت",
  name: "racket",
  slug: "racket",
  sport: { _id: TENNIS, title: "تنیس", name: "tennis", slug: "tennis" },
  additionalSports: [{ _id: BADMINTON, title: "بدمینتون" }],
  parent: { _id: "cat-tennis-gear", title: "لوازم جانبی" },
  order: 4,
  icon: "https://cdn/icon.svg",
  image: "https://cdn/image.jpg",
  megaMenuFilterAttribute: "Suitable for",
  technicalStatsPrompt: "امتیازها را ۰ تا ۱۰۰ بده",
  prompts: [
    { field: "name", context: "الگوی نام" },
    { field: "basePrice", context: "فقط عدد" },
  ],
  attributes: [
    {
      name: "Head Size",
      label: "اندازه سر",
      description: "سطح رویه",
      uiType: "number-input",
      required: true,
      filterable: true,
      options: ["95", "100"],
      prompt: "از محتوا استخراج کن",
      multiUnit: true,
      units: ["in²", "cm²"],
    },
    { name: "Suitable for", label: "مناسب برای", options: ["آقایان"] },
  ],
  variantAttributes: [
    {
      name: "grip",
      label: "گریپ",
      uiType: "dropdown",
      required: false,
      filterable: true,
      options: ["L1", "L2"],
      prompt: "سایز گریپ",
      description: "دور دسته",
      multiUnit: false,
      units: [],
    },
  ],
  technicalStats: [
    { name: "power", label: "قدرت", description: "نیروی ضربه", min: 5, max: 95 },
  ],
  customTab: {
    enabled: true,
    name: "تکنولوژی‌ها",
    icon: "https://cdn/tab.svg",
    items: [
      {
        _id: "item-1",
        title: "FORTYFIVE",
        description: "توضیح",
        image: "https://cdn/i.jpg",
        link: "https://x",
      },
    ],
  },
});

const copyInPadel = (source = tennisRacket(), selectableParentIds = []) =>
  buildCategoryCopy(source, {
    currentSportId: PADEL,
    selectableParentIds,
    promptFields: PROMPT_FIELDS,
    newId,
  });

test("هر فیلدی که مدل Category دارد یا کپی می‌شود یا عمداً کنار گذاشته شده", () => {
  // اگر فیلدِ تازه‌ای به مدل اضافه شود و در کپی جا بیفتد، همین‌جا می‌شکند.
  const model = readFileSync(
    new URL("../models/Category.js", import.meta.url),
    "utf8",
  );
  const schemaBody = model.slice(model.indexOf("const CategorySchema"));
  const modelFields = [
    ...schemaBody.matchAll(/^    ([a-zA-Z][a-zA-Z0-9]*): \{$/gm),
  ].map((m) => m[1]);

  assert.ok(modelFields.length >= 15, `فیلدهای مدل خوانده نشد: ${modelFields}`);

  // sport/order/slug عمداً کپی نمی‌شوند (ورزشِ مقصد، ترتیبِ سرور، اسلاگِ ساخته‌شده)
  const intentionallySkipped = new Set(["sport", "order", "slug"]);
  const copy = copyInPadel();
  const copied = new Set([
    ...Object.keys(copy.formData),
    "variantAttributes",
    "technicalStats",
    "technicalStatsPrompt",
    "customTab",
    "prompts",
  ]);

  for (const field of modelFields) {
    if (intentionallySkipped.has(field)) continue;
    assert.ok(copied.has(field), `فیلد «${field}» در کپی جا افتاده است`);
  }
});

test("همه‌ی مقادیر متنی و آرایه‌ای دقیقاً از مبدأ می‌آیند", () => {
  const source = tennisRacket();
  const copy = copyInPadel(source);

  assert.equal(copy.formData.title, "راکت");
  assert.equal(copy.formData.name, "racket");
  assert.equal(copy.formData.icon, source.icon);
  assert.equal(copy.formData.image, source.image);
  assert.equal(copy.formData.megaMenuFilterAttribute, "Suitable for");
  assert.equal(copy.technicalStatsPrompt, source.technicalStatsPrompt);

  assert.deepEqual(copy.customTab, {
    enabled: true,
    name: "تکنولوژی‌ها",
    icon: "https://cdn/tab.svg",
    items: [
      {
        title: "FORTYFIVE",
        description: "توضیح",
        image: "https://cdn/i.jpg",
        link: "https://x",
      },
    ],
  });
  // _id ساب‌داکیومنتِ دسته‌ی مبدأ نباید به دسته‌ی تازه سرایت کند
  assert.ok(!("_id" in copy.customTab.items[0]));

  assert.deepEqual(copy.technicalStats[0], {
    name: "power",
    label: "قدرت",
    description: "نیروی ضربه",
    min: 5,
    max: 95,
    id: copy.technicalStats[0].id,
  });
  assert.match(copy.technicalStats[0].id, /^stat-/);
});

test("تمام زیرفیلدهای ویژگی‌های ثابت و متغیر حفظ می‌شوند", () => {
  const source = tennisRacket();
  const copy = copyInPadel(source);

  const head = copy.formData.attributes[0];
  for (const key of Object.keys(source.attributes[0])) {
    assert.deepEqual(head[key], source.attributes[0][key], `زیرفیلد ${key}`);
  }
  assert.equal(copy.formData.attributes.length, 2);
  assert.deepEqual(
    copy.formData.attributes.map((a) => a.order),
    [1, 2],
  );

  const grip = copy.variantAttributes[0];
  for (const key of Object.keys(source.variantAttributes[0])) {
    assert.deepEqual(grip[key], source.variantAttributes[0][key], `زیرفیلد ${key}`);
  }
  assert.equal(grip.uiType, "dropdown");
  assert.equal(grip.required, false);

  // شناسه‌های محلی تازه‌اند و آرایه‌ها به مبدأ وصل نمی‌مانند
  assert.match(head.id, /^attr-/);
  assert.match(grip.id, /^vattr-/);
  head.options.push("110");
  assert.deepEqual(source.attributes[0].options, ["95", "100"]);
});

test("پرامپت‌ها وفادار کپی می‌شوند: نبودِ پرامپت یعنی خالی، نه پیش‌فرض", () => {
  const copy = copyInPadel();

  assert.deepEqual(
    copy.prompts.map((p) => p.field),
    PROMPT_FIELDS,
  );
  assert.equal(copy.prompts.find((p) => p.field === "name").context, "الگوی نام");
  assert.equal(copy.prompts.find((p) => p.field === "basePrice").context, "فقط عدد");
  assert.equal(copy.prompts.find((p) => p.field === "tag").context, "");
});

test("ورزشِ اصلیِ فعلی از ورزش‌های نمایشیِ کپی‌شده حذف می‌شود", () => {
  const copy = copyInPadel();
  assert.deepEqual(copy.formData.additionalSports, [BADMINTON]);

  const shared = tennisRacket();
  shared.additionalSports = [{ _id: PADEL }, { _id: BADMINTON }];
  // مدل، ورزشِ اصلی را در additionalSports رد می‌کند
  assert.deepEqual(copyInPadel(shared).formData.additionalSports, [BADMINTON]);
});

test("والد فقط وقتی کپی می‌شود که در ورزشِ مقصد انتخاب‌شدنی باشد", () => {
  assert.equal(copyInPadel().formData.parent, "");
  assert.equal(
    copyInPadel(tennisRacket(), ["cat-tennis-gear"]).formData.parent,
    "cat-tennis-gear",
  );

  const orphan = tennisRacket();
  orphan.parent = null;
  assert.equal(copyInPadel(orphan, ["cat-tennis-gear"]).formData.parent, "");
});

test("دسته‌ی تهی/ناموجود کپی نمی‌شود و کپیِ خالی نمی‌سازد", () => {
  assert.equal(buildCategoryCopy(null, { promptFields: PROMPT_FIELDS }), null);

  const bare = { _id: "x", title: "خالی", name: "empty" };
  const copy = copyInPadel(bare);
  assert.deepEqual(copy.formData.attributes, []);
  assert.deepEqual(copy.variantAttributes, []);
  assert.deepEqual(copy.technicalStats, []);
  assert.deepEqual(copy.customTab.items, []);
  assert.equal(copy.customTab.enabled, false);
  assert.equal(copy.formData.megaMenuFilterAttribute, "");
});

// ---------- کشویی‌ها ----------

const catalog = [
  {
    _id: "t-racket",
    title: "راکت",
    sport: { _id: TENNIS, title: "تنیس" },
    additionalSports: [],
  },
  {
    _id: "p-racket",
    title: "راکت",
    sport: { _id: PADEL, title: "پدل" },
    additionalSports: [],
  },
  {
    _id: "t-guard",
    title: "گارد سر راکت",
    sport: { _id: TENNIS, title: "تنیس" },
    additionalSports: [{ _id: PADEL, title: "پدل" }],
  },
  { _id: "b-shuttle", title: "توپ", sport: { _id: BADMINTON, title: "بدمینتون" } },
];

test("والد فقط از ورزشِ جاری — شاملِ دسته‌های اشتراکیِ همان ورزش", () => {
  assert.deepEqual(
    parentCategoryChoices(catalog, PADEL).map((c) => c._id),
    ["p-racket", "t-guard"],
  );
  assert.deepEqual(
    parentCategoryChoices(catalog, TENNIS).map((c) => c._id),
    ["t-racket", "t-guard"],
  );
  // بدون ورزش، والد بی‌معناست
  assert.deepEqual(parentCategoryChoices(catalog, ""), []);
  assert.deepEqual(parentCategoryChoices(catalog, null), []);
});

test("«بارگذاری از دسته دیگر» همه‌ی ورزش‌ها را با نام ورزش نشان می‌دهد", () => {
  const options = loadFromCategoryOptions(catalog);

  assert.equal(options.length, catalog.length);
  const racketLabels = options
    .filter((o) => o.value === "t-racket" || o.value === "p-racket")
    .map((o) => o.label);
  assert.deepEqual(racketLabels.sort(), ["راکت — پدل", "راکت — تنیس"].sort());
  // دو دسته‌ی هم‌نام دیگر یکسان دیده نمی‌شوند
  assert.equal(new Set(options.map((o) => o.label)).size, options.length);

  assert.equal(categorySportTitle({ sport: null }), "بدون ورزش");
  assert.equal(loadFromCategoryOptions([]).length, 0);
});
