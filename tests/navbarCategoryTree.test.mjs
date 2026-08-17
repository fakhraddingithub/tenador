import test from "node:test";
import assert from "node:assert/strict";
import {
  fillStructuralAudiences,
  insertStructuralParents,
  missingParentIds,
} from "../utils/navbarCategoryTree.js";

// درختِ نمونه: پوشاک (بدونِ محصولِ مستقیم) → تی‌شرت/شلوارک، و تنیس (محصول‌دار) → راکت
const CLOTHING = "c1";
const TENNIS = "c2";

const makeSports = () => [
  {
    _id: "s1",
    categories: [
      { _id: "t1", title: "تی‌شرت", parent: CLOTHING, brands: [{ _id: "b1" }], audiences: ["مردانه"] },
      { _id: "t2", title: "شلوارک", parent: CLOTHING, brands: [{ _id: "b2" }], audiences: ["زنانه"] },
      { _id: TENNIS, title: "تنیس", parent: null, brands: [{ _id: "b3" }], audiences: ["مردانه"] },
      { _id: "r1", title: "راکت", parent: TENNIS, brands: [{ _id: "b4" }], audiences: ["مردانه"] },
    ],
  },
];

const docs = new Map([
  [CLOTHING, { _id: CLOTHING, title: "پوشاک", slug: "clothing", icon: "", order: 1, parent: null }],
]);

test("only genuinely absent parents are fetched", () => {
  const sports = makeSports();
  // تنیس خودش در لیست هست، پس نباید دوباره واکشی شود
  assert.deepEqual(missingParentIds(sports), [CLOTHING]);
  // بدونِ والدِ گم‌شده، هیچ واکشی‌ای لازم نیست
  assert.deepEqual(missingParentIds([{ _id: "s2", categories: [{ _id: "x", parent: null }] }]), []);
});

test("structural parent is added once, non-clickable, and keeps its admin order", () => {
  const sports = makeSports();
  insertStructuralParents(sports, docs);

  const added = sports[0].categories.filter((c) => c._id === CLOTHING);
  assert.equal(added.length, 1, "هیچ دسته‌ای نباید تکراری شود");
  assert.equal(added[0].hasProducts, false, "والدِ ساختاری نباید کلیک‌پذیر باشد");
  assert.deepEqual(added[0].brands, []);
  assert.equal(added[0].order, 1);

  // دسته‌های محصول‌دار دست‌نخورده می‌مانند (hasProducts روی آن‌ها ست نمی‌شود)
  const tennis = sports[0].categories.find((c) => c._id === TENNIS);
  assert.equal(tennis.hasProducts, undefined);

  // تی‌شرت/شلوارک دیگر یتیم نیستند → در UI ریشه حساب نمی‌شوند
  const ids = new Set(sports[0].categories.map((c) => c._id));
  const roots = sports[0].categories.filter((c) => !c.parent || !ids.has(c.parent));
  assert.deepEqual(roots.map((c) => c._id).sort(), [CLOTHING, TENNIS]);
});

test("multi-level ancestors are walked to the root", () => {
  const sports = [
    { _id: "s1", categories: [{ _id: "leaf", parent: "mid", brands: [{ _id: "b" }] }] },
  ];
  const deep = new Map([
    ["mid", { _id: "mid", title: "میانی", parent: "top" }],
    ["top", { _id: "top", title: "بالا", parent: null }],
  ]);
  insertStructuralParents(sports, deep);
  assert.deepEqual(
    sports[0].categories.map((c) => c._id).sort(),
    ["leaf", "mid", "top"],
  );
});

test("a parent cycle does not hang the walk", () => {
  const sports = [{ _id: "s1", categories: [{ _id: "a", parent: "b" }] }];
  const cyclic = new Map([
    ["b", { _id: "b", parent: "c" }],
    ["c", { _id: "c", parent: "b" }],
  ]);
  insertStructuralParents(sports, cyclic);
  assert.deepEqual(sports[0].categories.map((c) => c._id).sort(), ["a", "b", "c"]);
});

test("structural parent inherits its subtree's audiences, product categories are untouched", () => {
  const sports = makeSports();
  insertStructuralParents(sports, docs);
  fillStructuralAudiences(sports[0].categories);

  const clothing = sports[0].categories.find((c) => c._id === CLOTHING);
  assert.deepEqual(clothing.audiences.sort(), ["زنانه", "مردانه"]);

  // تنیس محصول دارد، پس مخاطبش نباید از فرزندانش تغییر کند
  const tennis = sports[0].categories.find((c) => c._id === TENNIS);
  assert.deepEqual(tennis.audiences, ["مردانه"]);
});
