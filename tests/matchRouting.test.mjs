import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  GUIDED_QUIZ_TOOLS,
  LEGACY_MATCH_REDIRECTS,
  findMatchCategory,
  hasGuidedQuiz,
  matchCategoryPath,
  matchableCategories,
} from "../src/lib/matchTools.js";

/**
 * شکلِ همان چیزی که getCompareCategories برمی‌گرداند — دو دستهٔ «راکت» با اسلاگِ
 * یکسان در دو ورزشِ متفاوت، که باگِ اصلی همین بود.
 */
const CATEGORIES = [
  {
    _id: "cat-tennis-racket",
    title: "راکت",
    slug: "racket",
    sportSlug: "tennis",
    sportTitle: "تنیس",
    technicalStats: [{ name: "power" }, { name: "control" }, { name: "spin" }],
  },
  {
    _id: "cat-padel-racket",
    title: "راکت",
    slug: "racket",
    sportSlug: "padel",
    sportTitle: "پدل",
    technicalStats: [{ name: "power" }, { name: "control" }, { name: "Ball Output" }],
  },
  {
    _id: "cat-tennis-string",
    title: "زه",
    slug: "string",
    sportSlug: "tennis",
    sportTitle: "تنیس",
    technicalStats: [{ name: "Power" }, { name: "Control" }],
  },
  {
    _id: "cat-no-sport",
    title: "بدون ورزش",
    slug: "orphan",
    sportSlug: null,
    technicalStats: [{ name: "a" }, { name: "b" }],
  },
  {
    _id: "cat-too-few-stats",
    title: "کم‌شاخص",
    slug: "thin",
    sportSlug: "tennis",
    technicalStats: [{ name: "only-one" }],
  },
];

/* ─────────────── تفکیکِ راکتِ تنیس و پدل ─────────────── */

test("راکت تنیس و راکت پدل دو صفحهٔ جدا با آدرس‌های جدا هستند", () => {
  const tennis = findMatchCategory(CATEGORIES, "tennis", "racket");
  const padel = findMatchCategory(CATEGORIES, "padel", "racket");

  assert.ok(tennis, "راکت تنیس باید پیدا شود");
  assert.ok(padel, "راکت پدل باید پیدا شود");
  assert.notEqual(tennis._id, padel._id, "این دو نباید به یک دسته حل شوند");

  assert.equal(matchCategoryPath(tennis), "/match/tennis/racket");
  assert.equal(matchCategoryPath(padel), "/match/padel/racket");

  // دادهٔ هر صفحه هم واقعاً متفاوت است (راهنمای شاخص‌ها از همین می‌آید)
  assert.notDeepEqual(tennis.technicalStats, padel.technicalStats);
});

test("پرسشنامهٔ گام‌به‌گام برای راکتِ تنیس و راکتِ پدل فعال است — و نه بقیه", () => {
  assert.equal(hasGuidedQuiz(findMatchCategory(CATEGORIES, "tennis", "racket")), true);
  assert.equal(hasGuidedQuiz(findMatchCategory(CATEGORIES, "padel", "racket")), true);
  assert.equal(hasGuidedQuiz(findMatchCategory(CATEGORIES, "tennis", "string")), false);
});

test("هر دستهٔ دارای پرسشنامه، در quizRegistry هم تعریف دارد", async () => {
  // quizRegistry با alias «@/» ساخته شده و مستقیم import نمی‌شود؛ اما همین
  // هم‌خوانی همان چیزی است که اگر بشکند، صفحه با پرسشنامهٔ خالی رندر می‌شود.
  const source = await readFile(
    new URL("../src/lib/racketMatch/quizRegistry.js", import.meta.url),
    "utf8",
  );
  for (const key of GUIDED_QUIZ_TOOLS) {
    assert.ok(
      source.includes('"' + key + '": {'),
      key + " در GUIDED_QUIZ_TOOLS هست ولی در MATCH_QUIZZES نیست",
    );
  }
  // و برعکس: هر پرسشنامهٔ ثبت‌شده باید در فهرستِ فعال هم باشد، وگرنه کدِ مرده است
  const registered = source
    .split("\n")
    .map((line) => line.match(/^ {2}"([^"]+)": \{$/)?.[1])
    .filter(Boolean);
  assert.ok(registered.length >= GUIDED_QUIZ_TOOLS.size, "هیچ پرسشنامه‌ای پیدا نشد");
  for (const key of registered) {
    assert.ok(GUIDED_QUIZ_TOOLS.has(key), key + " در MATCH_QUIZZES هست ولی فعال نیست");
  }
});

test("ترکیبِ ورزش و دستهٔ نامعتبر هیچ صفحه‌ای برنمی‌گرداند", () => {
  assert.equal(findMatchCategory(CATEGORIES, "padel", "string"), undefined);
  assert.equal(findMatchCategory(CATEGORIES, "badminton", "racket"), undefined);
  // دستهٔ بدون ورزش نمی‌تواند آدرسِ ورزش‌دار داشته باشد
  assert.equal(findMatchCategory(CATEGORIES, "null", "orphan"), undefined);
});

test("دسته‌های بدون ورزش یا با شاخصِ ناکافی وارد شبکهٔ /match نمی‌شوند", () => {
  const ids = matchableCategories(CATEGORIES).map((category) => category._id);
  assert.ok(!ids.includes("cat-no-sport"));
  assert.ok(!ids.includes("cat-too-few-stats"));
  assert.equal(ids.length, 3);
});

/* ─────────────── ریدایرکتِ آدرس‌های قدیمی ─────────────── */

test("آدرس‌های تک‌بخشیِ قدیمی به آدرسِ ورزش‌دارشان ریدایرکت می‌شوند", async () => {
  const { default: config } = await import("../next.config.mjs");
  const redirects = await config.redirects();

  for (const { from, to } of LEGACY_MATCH_REDIRECTS) {
    const rule = redirects.find((entry) => entry.source === from);
    assert.ok(rule, `ریدایرکتِ ${from} تعریف نشده است`);
    assert.equal(rule.destination, to);
    assert.equal(rule.permanent, true, "باید دائمی (۳۰۸) باشد تا ارزش سئو منتقل شود");
  }
});

test("ریدایرکتِ حدسی برای آدرس‌هایی که هرگز زنده نبودند اضافه نشده", async () => {
  const { default: config } = await import("../next.config.mjs");
  const redirects = await config.redirects();
  const matchRules = redirects.filter((entry) => entry.source.startsWith("/match"));

  assert.equal(matchRules.length, LEGACY_MATCH_REDIRECTS.length);
  // الگوی عمومیِ /match/:slug خطرناک است: /match/tennis را به /match/tennis/tennis می‌برد
  assert.ok(!matchRules.some((entry) => entry.source.includes(":")));
});

/* ─────────────── ساختارِ مسیرِ Next ─────────────── */

test("مسیر Next دو بخشی است و مسیرِ تک‌بخشیِ قدیمی دیگر وجود ندارد", async () => {
  const nested = await readFile(
    new URL("../src/app/(Site)/match/[sportSlug]/[categorySlug]/page.jsx", import.meta.url),
    "utf8",
  );
  assert.ok(nested.includes("sportSlug"), "صفحه باید بخشِ ورزش را از params بخواند");

  await assert.rejects(
    readFile(new URL("../src/app/(Site)/match/[categorySlug]/page.jsx", import.meta.url), "utf8"),
    "مسیرِ تک‌بخشیِ قدیمی باید حذف شده باشد",
  );
});

test("لینک‌های شبکهٔ دسته‌بندی از سازندهٔ مسیرِ ورزش‌دار استفاده می‌کنند", async () => {
  const grid = await readFile(
    new URL("../src/components/templates/productMatch/CategoryGrid.jsx", import.meta.url),
    "utf8",
  );
  assert.ok(grid.includes("matchCategoryPath(cat)"));
  assert.ok(!grid.includes("`/match/${cat.slug}`"), "لینکِ مبهمِ قدیمی نباید باقی مانده باشد");
});
