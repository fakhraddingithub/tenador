import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSearchFilter,
  matchesSearch,
  rankBySearch,
  relevanceScore,
  searchTokens,
  withSearch,
} from "../src/lib/search.js";

const BLADE = "Wilson Blade 98 16x19 V10 Tennis Racket";
const PRODUCTS = [
  { name: BLADE, sku: "WR-BL-98" },
  { name: "Wilson Pro Staff 97 V14 Tennis Racket", sku: "WR-PS-97" },
  { name: "Babolat Pure Drive (2024) Racket", sku: "BB-PD-24" },
  { name: "Wilson Blade Backpack", sku: "WR-BG-01" },
  { name: "راکت تنیس ویلسون بلید ۹۸", sku: "FA-BL-98" },
];

/** همان کاری که Mongo با فیلترِ ساخته‌شده می‌کند، تا فیلتر واقعاً تست شود */
function runFilter(filter, docs) {
  const evaluate = (condition, doc) => {
    if (condition.$and) return condition.$and.every((c) => evaluate(c, doc));
    if (condition.$or) return condition.$or.some((c) => evaluate(c, doc));
    return Object.entries(condition).every(([field, value]) =>
      value?.$regex
        ? new RegExp(value.$regex, value.$options || "").test(String(doc[field] ?? ""))
        : doc[field] === value
    );
  };
  return docs.filter((doc) => evaluate(filter, doc));
}

const find = (query, fields = ["name", "sku"]) =>
  runFilter(buildSearchFilter(query, fields), PRODUCTS).map((p) => p.name);

test("ترتیب کلمات مهم نیست", () => {
  for (const query of ["Blade racket", "racket blade", "98 Blade", "Blade 98 Wilson"]) {
    assert.ok(find(query).includes(BLADE), `«${query}» باید Blade را پیدا کند`);
  }
});

test("کلمه‌ی ناقص و ترکیبِ ناقص", () => {
  for (const query of ["Blade", "Bla", "Wilson Blade", "16x19", "98", "V10 blad"]) {
    assert.ok(find(query).includes(BLADE), `«${query}» باید Blade را پیدا کند`);
  }
});

test("نقطه‌گذاریِ کوئری مانعِ تطابق نمی‌شود", () => {
  for (const query of ["Blade (98)", "blade-98", "blade/racket", "  Blade,  98  "]) {
    assert.ok(find(query).includes(BLADE), `«${query}» باید Blade را پیدا کند`);
  }
  // پرانتزِ داخلِ نامِ محصول هم نباید لازم باشد تایپ شود
  assert.ok(find("pure drive 2024").includes("Babolat Pure Drive (2024) Racket"));
});

test("AND روی توکن‌ها: نامرتبط‌ها فیلتر می‌شوند", () => {
  const results = find("Blade racket");
  assert.ok(results.includes(BLADE));
  assert.ok(!results.includes("Wilson Blade Backpack"), "کوله‌پشتی racket نیست");
  assert.ok(!results.includes("Wilson Pro Staff 97 V14 Tennis Racket"));
});

test("ارقام و حروفِ فارسی/عربی یکسان‌سازی می‌شوند", () => {
  assert.ok(find("۹۸ بلید").includes("راکت تنیس ویلسون بلید ۹۸"));
  assert.ok(find("بليد 98").includes("راکت تنیس ویلسون بلید ۹۸"), "ي عربی");
});

test("کوئریِ خالی هیچ فیلتری اضافه نمی‌کند (سازگاری با رفتار قبلی)", () => {
  assert.equal(buildSearchFilter("", ["name"]), null);
  assert.equal(buildSearchFilter("  (())  ", ["name"]), null);
  assert.equal(buildSearchFilter("x", []), null);
  assert.ok(matchesSearch("", "anything"));
});

test("متاکاراکترهای ورودی به regex نشت نمی‌کنند (ReDoS)", () => {
  // توکن‌سازی هر چیزی جز حرف و رقم را دور می‌ریزد، پس منبعِ regex هرگز
  // متاکاراکترِ کنترلی ندارد. کوئریِ فقط-نقطه‌گذاری = کوئریِ خالی.
  for (const hostile of [".*", "[[[", "(a+)+$", "^.*$", "\\"]) {
    const filter = buildSearchFilter(hostile, ["name"]);
    if (!filter) continue;
    for (const clause of filter.$and) {
      assert.match(clause.name.$regex, /^[\p{L}\p{N}[\]]+$/u, `منبعِ ناامن: ${clause.name.$regex}`);
    }
  }
  assert.equal(buildSearchFilter(".*", ["name"]), null);
  assert.equal(buildSearchFilter("[[[", ["name"]), null);
  // `(a+)+$` به توکنِ تحت‌اللفظیِ «a» تبدیل می‌شود، نه به یک regexِ نمایی
  assert.deepEqual(buildSearchFilter("(a+)+$", ["name"]).$and, [
    { name: { $regex: "a", $options: "i" } },
  ]);
});

test("withSearch فیلترِ موجود را نمی‌شکند", () => {
  const existing = { isActive: true, $or: [{ a: 1 }, { b: 2 }] };
  const merged = withSearch(existing, "blade", ["name"]);
  assert.equal(merged.isActive, true);
  assert.deepEqual(merged.$or, existing.$or, "$orِ قبلی دست‌نخورده");
  assert.equal(merged.$and.length, 1);
  assert.equal(existing.$and, undefined, "ورودی mutate نمی‌شود");

  const chained = withSearch({ $and: [{ x: 1 }] }, "blade 98", ["name"]);
  assert.equal(chained.$and.length, 3, "شرطِ $andِ قبلی حفظ + دو توکن");

  assert.deepEqual(withSearch({ isActive: true }, "", ["name"]), { isActive: true });
});

test("رتبه‌بندی: SKUِ دقیق اول، بعد تطابقِ قوی، بعد ناقص", () => {
  const pick = (p) => [[p.sku, 3], [p.name, 1]];
  assert.equal(rankBySearch("WR-BL-98", PRODUCTS, pick)[0].sku, "WR-BL-98");
  assert.equal(rankBySearch("Blade", PRODUCTS, pick)[0].name, BLADE);
  assert.equal(rankBySearch("wilson blade racket", PRODUCTS, pick)[0].name, BLADE);
});

test("رتبه‌بندی: کلمه‌ی کامل بالاتر از تطابقِ وسطِ کلمه", () => {
  const whole = relevanceScore("blade", [["Blade Racket", 1]]);
  const inner = relevanceScore("blade", [["Sunblades Pro", 1]]);
  assert.ok(whole > inner, `${whole} باید از ${inner} بیشتر باشد`);
});

test("رتبه‌بندی پایدار است و کوئریِ خالی ترتیب را عوض نمی‌کند", () => {
  const ranked = rankBySearch("", PRODUCTS, (p) => [[p.name, 1]]);
  assert.deepEqual(ranked, PRODUCTS);
});

test("matchesSearch معادلِ سمتِ کلاینتِ همان فیلتر است", () => {
  for (const query of ["Blade racket", "racket blade", "Blade (98)", "16x19", "زیبا"]) {
    const server = find(query);
    const client = PRODUCTS.filter((p) => matchesSearch(query, p.name, p.sku)).map((p) => p.name);
    assert.deepEqual(client, server, `«${query}» باید در دو طرف یکسان باشد`);
  }
});

test("توکن‌ها محدود و یکتا هستند", () => {
  assert.deepEqual(searchTokens("blade blade 98"), ["blade", "98"]);
  assert.ok(searchTokens("a b c d e f g h i j k").length <= 8);
});
