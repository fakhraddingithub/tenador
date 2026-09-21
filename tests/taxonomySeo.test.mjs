import test from "node:test";
import assert from "node:assert/strict";
import { buildTaxonomyMetadata, buildTaxonomyBreadcrumbs } from "../src/lib/seo/taxonomySeo.js";
import { buildSerieNames } from "../src/lib/seo/taxonomyNames.js";

const sport = { title: "تنیس", slug: "tennis" };
const brand = { title: "ویلسون", name: "wilson", slug: "wilson" };
const serie = { title: "بلید", name: "Blade", slug: "blade" };

test("category-brand title matches the requested format without duplicating the layout suffix", () => {
  assert.equal(buildTaxonomyMetadata({ sport, brand, category: { title: "راکت" } }).title,
    "راکت تنیس ویلسون | خرید و قیمت انواع Wilson");
});

test("series metadata and heading use bilingual brand-specific names", () => {
  assert.equal(buildTaxonomyMetadata({ sport, brand, serie }).title,
    "محصولات ویلسون بلید | خرید و قیمت انواع Wilson Blade");
  assert.equal(buildSerieNames(brand, serie).heading, "ویلسون بلید (Blade)");
  const head = { title: "هد", name: "Head" };
  const speed = { title: "اسپید", name: "Speed" };
  assert.equal(buildSerieNames(head, speed).heading, "هد اسپید (Speed)");
  assert.equal(buildTaxonomyMetadata({ sport, brand: head, serie: speed }).title,
    "محصولات هد اسپید | خرید و قیمت انواع Head Speed");
});

test("non-racket products are not assigned a racket label", () => {
  const names = buildSerieNames({ title: "آدیداس", name: "Adidas" },
    { title: "گیم‌کورت ۳", name: "GameCourt 3", level: 1 });
  assert.equal(names.heading, "آدیداس گیم‌کورت ۳ (GameCourt 3)");
  assert.equal(names.english, "Adidas GameCourt 3");
});

test("subseries with identical Persian names remain distinguishable", () => {
  const parent = { title: "برن", name: "Burn", level: 0 };
  const child = { title: "برن", name: "Burn V6", level: 1 };
  assert.notEqual(buildSerieNames(brand, parent).heading, buildSerieNames(brand, child).heading);
  assert.notEqual(buildTaxonomyMetadata({ sport, brand, serie: parent }).title,
    buildTaxonomyMetadata({ sport, brand, serie: child }).title);
});

test("acronyms and mixed-case names survive, and whitespace is normalized", () => {
  for (const name of ["RF", "VCORE", "TF-X1", "WhiteOut"]) {
    assert.equal(buildSerieNames(brand, { title: "نام", name }).english, `Wilson ${name}`);
  }
  assert.equal(buildSerieNames(brand, { title: " اولترا  ", name: " Ultra  V5 " }).heading,
    "ویلسون اولترا (Ultra V5)");
});

test("missing names and already-prefixed names do not produce duplicate brands or empty parentheses", () => {
  assert.equal(buildSerieNames(brand, { title: "ویلسون بلید", name: "Wilson Blade" }).localized, "ویلسون بلید");
  assert.equal(buildSerieNames(brand, { title: "ویلسون بلید", name: "Wilson Blade" }).english, "Wilson Blade");
  assert.equal(buildSerieNames({ name: "wilson" }, { name: "Blade" }).heading, "Wilson Blade");
  assert.equal(buildSerieNames(brand, { title: "بلید" }).heading, "ویلسون بلید");
  assert.equal(buildSerieNames(null, null).heading, "");
});

test("unrelated taxonomy titles and authored descriptions retain their behavior", () => {
  assert.equal(buildTaxonomyMetadata({ sport }).title, "خرید تجهیزات و لوازم تنیس");
  assert.equal(buildTaxonomyMetadata({ sport, category: { title: "راکت" } }).title, "خرید راکت تنیس");
  assert.equal(buildTaxonomyMetadata({ sport, brand }).title, "خرید محصولات ویلسون برای تنیس");
  assert.equal(buildTaxonomyMetadata({ brand, limitedEdition: { title: "کالکشن" } }).title,
    "خرید محصولات ویلسون کالکشن");
  assert.equal(buildTaxonomyMetadata({ sport, brand, serie: { ...serie, description: "متن اختصاصی" } }).description,
    "متن اختصاصی");
});

test("series breadcrumb paths retain their original route", () => {
  assert.equal(buildTaxonomyBreadcrumbs({ sport, brand, serie }).at(-1).href, "/tennis/wilson/blade");
});
