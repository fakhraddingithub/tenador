import test from "node:test";
import assert from "node:assert/strict";
import { getCategoryLabel } from "../utils/categoryLabel.js";
import { insertStructuralParents } from "../utils/navbarCategoryTree.js";

const tennis = { _id: "tennis", title: "تنیس", name: "Tennis" };
const padel = { _id: "padel", title: "پدل", name: "Padel" };

test("admin labels distinguish same-title categories using the owner's Persian title", () => {
  assert.equal(getCategoryLabel({ title: "راکت", sport: tennis }), "راکت تنیس");
  assert.equal(getCategoryLabel({ title: "راکت", sport: padel }), "راکت پدل");
  assert.equal(getCategoryLabel({ title: "  راکت  ", sport: tennis }), "راکت تنیس");
});

test("shared categories keep the owner in admin and omit it everywhere in the navbar", () => {
  for (const additionalSports of [["padel"], [padel]]) {
    const category = Object.freeze({ title: "کفش", slug: "shoes", sport: tennis, additionalSports });
    assert.equal(getCategoryLabel(category), "کفش تنیس");
    assert.equal(getCategoryLabel(category, { navbar: true }), "کفش");
    assert.equal(category.title, "کفش");
    assert.equal(category.slug, "shoes");
    assert.equal(category.sport, tennis);
  }
});

test("legacy non-shared categories show their owner in the navbar", () => {
  for (const additionalSports of [undefined, null, []]) {
    assert.equal(getCategoryLabel({ title: "راکت", sport: tennis, additionalSports }, { navbar: true }), "راکت تنیس");
  }
});

test("missing and unpopulated references never render IDs or undefined", () => {
  for (const category of [null, undefined, "category-id", { sport: tennis }]) {
    assert.equal(getCategoryLabel(category), "");
  }
  for (const sport of [null, undefined, "tennis-id", { _id: "tennis-id" }]) {
    assert.equal(getCategoryLabel({ title: "راکت", sport }), "راکت");
  }
  assert.equal(getCategoryLabel({ name: "Racket", sport: { name: "Tennis" } }), "Racket Tennis");
});

test("structural parents retain the owner and sharing metadata used by navbar labels", () => {
  for (const additionalSports of [[], [padel]]) {
    const parent = { _id: "parent", title: "پوشاک", sport: tennis, additionalSports };
    const sports = [{ _id: "tennis", categories: [{ _id: "child", parent: "parent" }] }];
    insertStructuralParents(sports, new Map([["parent", parent]]));
    const inserted = sports[0].categories[1];
    assert.equal(getCategoryLabel(inserted, { navbar: true }), additionalSports.length ? "پوشاک" : "پوشاک تنیس");
    assert.equal(inserted.hasProducts, false);
    assert.deepEqual(inserted.brands, []);
  }
});
