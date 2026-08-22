import test from "node:test";
import assert from "node:assert/strict";
import {
  blockWidth,
  groupBlockRows,
  insertBlockAt,
  sanitizeArticleBlockLayout,
} from "../src/lib/articleBlockLayout.js";

// کمک‌کننده‌ها: b(width) یک بلوکِ ساختگی با عرضِ داده‌شده می‌سازد.
let counter = 0;
const b = (width) => ({ id: `b${++counter}`, type: "paragraph", ...(width ? { layout: { width } } : {}) });
/** هر سطر را به رشته‌ی خوانا تبدیل می‌کند: "full" یا "1/2+1/2" */
const shape = (rows) => rows.map((row) => (row.sized ? row.blocks.map((x) => x.layout.width).join("+") : "full"));

// ——— پاک‌سازی ————————————————————————————————————————————————————————

test("چیدمانِ غایب یا نامعتبر undefined می‌دهد", () => {
  for (const value of [undefined, null, "", 0, [], "1/2", { width: "full" }, { width: "3/4" }, { width: 2 }, {}]) {
    assert.equal(sanitizeArticleBlockLayout(value), undefined, JSON.stringify(value));
  }
});

test("فقط عرض‌های مجاز نگه داشته می‌شوند", () => {
  assert.deepEqual(sanitizeArticleBlockLayout({ width: "1/2" }), { width: "1/2" });
  assert.deepEqual(sanitizeArticleBlockLayout({ width: "1/3" }), { width: "1/3" });
  assert.deepEqual(sanitizeArticleBlockLayout({ width: "2/3" }), { width: "2/3" });
});

test("کلیدهای اضافه دور ریخته می‌شوند", () => {
  assert.deepEqual(sanitizeArticleBlockLayout({ width: "1/2", order: 3, float: "left", position: "absolute" }), { width: "1/2" });
});

test("blockWidth برای بلوکِ بدونِ چیدمان full می‌دهد", () => {
  assert.equal(blockWidth({}), "full");
  assert.equal(blockWidth({ layout: {} }), "full");
  assert.equal(blockWidth({ layout: { width: "full" } }), "full");
  assert.equal(blockWidth({ layout: { width: "9/9" } }), "full");
  assert.equal(blockWidth(null), "full");
  assert.equal(blockWidth({ layout: { width: "2/3" } }), "2/3");
});

// ——— گروه‌بندی: سازگاریِ عقب‌رو ——————————————————————————————————————

test("آرایه‌ی خالی هیچ سطری نمی‌سازد", () => {
  assert.deepEqual(groupBlockRows([]), []);
});

test("مقاله‌ی تک‌ستونی قدیمی: هر بلوک یک سطرِ بدونِ wrapper", () => {
  const rows = groupBlockRows([b(), b(), b()]);
  assert.deepEqual(shape(rows), ["full", "full", "full"]);
  assert.ok(rows.every((row) => row.sized === false && row.blocks.length === 1));
});

// ——— ترکیب‌های خواسته‌شده (R3) ————————————————————————————————————————

test("۱/۲ + ۱/۲ یک سطر می‌شود", () => {
  assert.deepEqual(shape(groupBlockRows([b("1/2"), b("1/2")])), ["1/2+1/2"]);
});

test("۱/۳ + ۱/۳ + ۱/۳ یک سطر می‌شود", () => {
  assert.deepEqual(shape(groupBlockRows([b("1/3"), b("1/3"), b("1/3")])), ["1/3+1/3+1/3"]);
});

test("۱/۳ + ۲/۳ یک سطر می‌شود", () => {
  assert.deepEqual(shape(groupBlockRows([b("1/3"), b("2/3")])), ["1/3+2/3"]);
});

test("۲/۳ + ۱/۳ یک سطر می‌شود و ترتیب حفظ می‌گردد", () => {
  const rows = groupBlockRows([b("2/3"), b("1/3")]);
  assert.deepEqual(shape(rows), ["2/3+1/3"]);
  assert.deepEqual(rows[0].blocks.map((x) => x.layout.width), ["2/3", "1/3"]);
});

test("۲/۳ + ۲/۳ در یک گروه می‌ماند (شبکه خودش می‌شکند)", () => {
  assert.deepEqual(shape(groupBlockRows([b("2/3"), b("2/3")])), ["2/3+2/3"]);
});

test("۱/۲ + ۱/۳ + ۱/۳ در یک گروه می‌ماند", () => {
  assert.deepEqual(shape(groupBlockRows([b("1/2"), b("1/3"), b("1/3")])), ["1/2+1/3+1/3"]);
});

test("کامل + اندازه‌دار + کامل درست تفکیک می‌شود", () => {
  assert.deepEqual(
    shape(groupBlockRows([b(), b("1/2"), b("1/2"), b()])),
    ["full", "1/2+1/2", "full"],
  );
});

test("بلوکِ کامل، دو دنباله‌ی اندازه‌دار را از هم جدا می‌کند", () => {
  assert.deepEqual(
    shape(groupBlockRows([b("1/2"), b("1/2"), b(), b("1/3"), b("1/3")])),
    ["1/2+1/2", "full", "1/3+1/3"],
  );
});

test("بلوکِ اندازه‌دارِ تنها هم یک گروه است", () => {
  assert.deepEqual(shape(groupBlockRows([b(), b("1/2"), b()])), ["full", "1/2", "full"]);
});

test("ترتیبِ کلیِ بلوک‌ها هرگز عوض نمی‌شود", () => {
  const blocks = [b(), b("1/2"), b("1/3"), b(), b("2/3"), b(), b()];
  const flat = groupBlockRows(blocks).flatMap((row) => row.blocks);
  assert.deepEqual(flat.map((x) => x.id), blocks.map((x) => x.id));
  assert.equal(flat.length, blocks.length, "هیچ بلوکی گم یا تکراری نمی‌شود");
});

test("accessor سفارشی برای آیتم‌های بسته‌بندی‌شده کار می‌کند", () => {
  const items = [{ block: b("1/2") }, { block: b("1/2") }, { block: b() }];
  const rows = groupBlockRows(items, (item) => blockWidth(item.block));
  assert.deepEqual(rows.map((r) => r.sized), [true, false]);
  assert.equal(rows[0].blocks.length, 2);
});

// ——— درجِ بلوک در موقعیتِ دلخواه ————————————————————————————————————

test("درجِ بلوک، بلوک‌های بعدی را دقیقاً یک شماره جلو می‌برد", () => {
  const list = [b(), b(), b(), b(), b()];
  const fresh = b();
  const out = insertBlockAt(list, fresh, 5);
  assert.deepEqual(out.map((x) => x.id), [list[0].id, list[1].id, list[2].id, list[3].id, fresh.id, list[4].id]);
  assert.equal(list.length, 5, "آرایه‌ی ورودی دست‌نخورده می‌ماند");
});

test("درج هیچ بلوکی را گم یا تکراری نمی‌کند", () => {
  const list = [b(), b(), b()];
  for (const position of [1, 2, 3, 4]) {
    const out = insertBlockAt(list, b(), position);
    assert.equal(out.length, list.length + 1);
    assert.equal(new Set(out.map((x) => x.id)).size, out.length);
    assert.ok(list.every((item) => out.includes(item)), "بلوک‌های قبلی همان شیء می‌مانند");
  }
});

test("موقعیتِ بیرونِ بازه یا نامعتبر بریده می‌شود", () => {
  const list = [b(), b()];
  const fresh = b();
  assert.equal(insertBlockAt(list, fresh, 1)[0].id, fresh.id);
  assert.equal(insertBlockAt(list, fresh, 0)[0].id, fresh.id, "کمتر از ۱ یعنی ابتدا");
  assert.equal(insertBlockAt(list, fresh, -7)[0].id, fresh.id);
  assert.equal(insertBlockAt(list, fresh, 99).at(-1).id, fresh.id, "بیش از طول یعنی انتها");
  for (const invalid of ["", "  ", "abc", null, undefined, NaN]) {
    assert.equal(insertBlockAt(list, fresh, invalid).at(-1).id, fresh.id, JSON.stringify(invalid));
  }
});

test("درج در فهرستِ خالی و تک‌بلوکی درست کار می‌کند", () => {
  const fresh = b();
  assert.deepEqual(insertBlockAt([], fresh, 1).map((x) => x.id), [fresh.id]);
  assert.deepEqual(insertBlockAt(undefined, fresh, 1).map((x) => x.id), [fresh.id]);
  const one = b();
  assert.deepEqual(insertBlockAt([one], fresh, 1).map((x) => x.id), [fresh.id, one.id]);
  assert.deepEqual(insertBlockAt([one], fresh, 2).map((x) => x.id), [one.id, fresh.id]);
});
