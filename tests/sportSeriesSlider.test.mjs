/**
 * tests/sportSeriesSlider.test.mjs
 *
 * بلوکِ «اسلایدر سری‌های ورزش» و رفعِ بریده‌شدنِ فهرست‌های جستجو.
 *
 * داده (mongo واقعی): فقط سری‌هایی که در ورزشِ انتخاب‌شده محصولِ فعال و قابلِ
 * نمایش دارند — بدونِ قیدِ «جدید/لیمیتد» ـِ صفحه‌ی ورزش — به ترتیبِ انتخابِ ادمین؛
 * و اسلایدرِ خودِ صفحه‌ی ورزش همان رفتارِ قبلی را دارد.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

register("./aliasHooks.mjs", import.meta.url);
register("./listingFiltersHooks.mjs", import.meta.url);
process.env.MONGODB_URI_TENADOR = "mongodb://127.0.0.1:1/unused-test-placeholder";

const { getSeriesBySport, getSportSeriesOptions, getSportSeriesBlock } = await import("base/services/series.service");
const { default: Sport } = await import("base/models/Sport");
const { default: Product } = await import("base/models/Product");
const { sanitizeArticleBlockData } = await import("../src/lib/articleBlockValidation.js");

let server;
before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri("sport-series"));
  global._mongooseCache.conn = mongoose;
});
after(async () => {
  await mongoose.disconnect();
  await server?.stop();
});

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const oid = () => new mongoose.Types.ObjectId();

async function seed() {
  const tennis = await Sport.create({ name: "tennis", title: "تنیس" });
  const padel = await Sport.create({ name: "padel", title: "پدل" });
  const brand = oid();
  await mongoose.connection.collection("brands").insertOne({ _id: brand, name: "Wilson", title: "ویلسون", slug: "wilson" });
  const serie = (name, extra = {}) => ({ _id: oid(), name, title: name, slug: name.toLowerCase(), brand, colors: { primary: "#111111", secondary: "#222222" }, ...extra });
  const s = {
    plain: serie("Clash"),                              // بدونِ پرچم — صفحه‌ی ورزش نشانش نمی‌دهد، بلوک می‌دهد
    flagged: serie("Blade", { isNewSerie: true }),      // صفحه‌ی ورزش و بلوک
    otherSport: serie("Bela"),                          // فقط محصولِ پدل
    inactive: serie("Pro Staff"),                       // فقط محصولِ غیرفعال
    kids: serie("Junior"),                              // فقط محصولِ بچگانه (ویترینِ پیش‌فرض نشانش نمی‌دهد)
  };
  await mongoose.connection.collection("series").insertMany(Object.values(s));
  const product = (serieDoc, sport, extra = {}) => ({ _id: oid(), name: "p", sku: `sku-${oid()}`, serie: serieDoc._id, sport: sport._id, isActive: true, targetAudience: "مردانه", ...extra });
  await Product.collection.insertMany([
    product(s.plain, tennis), product(s.plain, tennis), product(s.plain, tennis),
    product(s.flagged, tennis),
    product(s.otherSport, padel),
    product(s.inactive, tennis, { isActive: false }),
    product(s.kids, tennis, { targetAudience: "بچگانه" }),
  ]);
  return { tennis, padel, s };
}

test("data: the block offers every series with active products in the sport — and only those", async () => {
  const { tennis, padel, s } = await seed();

  const options = await getSportSeriesOptions(tennis._id);
  assert.deepEqual(options.map((x) => x.name), ["Clash", "Blade"], "most products first; unflagged included; other sport, inactive and kids-only excluded");
  assert.equal(options[0].productCount, 3);
  assert.equal(options[0].brand.slug, "wilson", "same shape as the sport page's slider (card links need the brand)");
  assert.deepEqual((await getSportSeriesOptions(padel._id)).map((x) => x.name), ["Bela"]);
  assert.deepEqual(await getSportSeriesOptions("nonsense"), []);

  // the sport page's own slider is unchanged: flagged series only
  assert.deepEqual((await getSeriesBySport("tennis")).map((x) => x.name), ["Blade"]);

  // render: in the admin's order, dropping anything that no longer qualifies
  const block = await getSportSeriesBlock(String(tennis._id), [String(s.flagged._id), String(s.plain._id), String(s.otherSport._id), String(s.inactive._id), "bad"]);
  assert.deepEqual(block.sport, { _id: String(tennis._id), slug: "tennis", title: "تنیس" });
  assert.deepEqual(block.series.map((x) => x.name), ["Blade", "Clash"]);
  assert.equal(await getSportSeriesBlock(String(tennis._id), [String(s.otherSport._id)]), null, "nothing left → the block renders nothing");
  assert.equal(await getSportSeriesBlock(null, [String(s.plain._id)]), null);
  assert.equal(await getSportSeriesBlock(String(tennis._id), []), null);
});

test("block: validator, registry and renderer reuse the existing pieces", async () => {
  const errors = {};
  const sport = String(oid());
  const series = [String(oid()), String(oid())];
  const clean = sanitizeArticleBlockData("sportSeriesSlider", { sport, series: [...series, series[0]], highlight: " سری‌های ", title: "تنیس", subtitle: "زیر", extra: 1 }, errors, "blocks.0.data");
  assert.deepEqual(errors, {});
  assert.deepEqual(clean, { sport, series, highlight: "سری‌های", title: "تنیس", subtitle: "زیر" });
  const bad = {};
  sanitizeArticleBlockData("sportSeriesSlider", { sport: "x", series: ["y"] }, bad, "blocks.0.data");
  assert.ok(bad["blocks.0.data.sport"] && bad["blocks.0.data.series"]);

  const { ARTICLE_BLOCKS } = await import("../src/components/admin/articles/blockRegistry.js");
  const def = ARTICLE_BLOCKS.sportSeriesSlider;
  assert.deepEqual(def.fields.map((f) => f.key), ["sport", "series", "highlight", "title", "subtitle"]);
  assert.deepEqual(def.fields[0].clears, ["series"], "changing the sport empties the series");
  assert.equal(def.fields[1].entityType, "sportSerie");
  assert.equal(def.fields[1].scope, "sport");
  assert.equal(def.fields[1].browse, true);
  assert.deepEqual(def.styleKeys, ["spacing"]);

  // the same SeriesSlider the sport page renders; only the heading comes from the block
  const renderer = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  assert.match(renderer, /import SeriesSlider from "@\/components\/templates\/sports\/SeriesSlider";/);
  assert.match(renderer, /heading=\{\{ highlight: data\.highlight \|\| "", title: data\.title \|\| "", subtitle: data\.subtitle \|\| "" \}\}/);
  assert.match(renderer, /fitContainer=\{inMerged\}/);
  // full width at the top level, inside its cell when merged / on an image
  assert.match(renderer, /\{inMerged \? slider : <FullBleed>\{slider\}<\/FullBleed>\}/);
  // the preview canvas bounds the bleed, otherwise it would cover the admin menu
  assert.match(await read("../src/components/admin/articles/PreviewCanvas.jsx"), /data-bleed-root/);
  const bleed = await read("../src/components/features/articles/FullBleed.jsx");
  assert.match(bleed, /closest\("\[data-bleed-root\]"\)/);
  assert.match(bleed, /document\.documentElement\.clientWidth/, "clientWidth, not 100vw — the scrollbar would cause a horizontal scroll");
  const resolver = await read("../services/publicArticle.service.js");
  assert.match(resolver, /getSportSeriesBlock\(block\.data\?\.sport, block\.data\?\.series\)/);
});

test("SeriesSlider: buttons belong to their own slider; the sport page heading is unchanged", async () => {
  const src = await read("../src/components/templates/sports/SeriesSlider.jsx");
  // Swiper looks string selectors up in the whole document; a shared class made two
  // sliders on one page move together.
  assert.match(src, /nextEl: `\.series-next-\$\{navKey\}`/);
  assert.match(src, /prevEl: `\.series-prev-\$\{navKey\}`/);
  assert.doesNotMatch(src, /nextEl: "\.series-next-btn"/);
  // no heading prop → the old two headings, verbatim
  assert.match(src, /<span className="text-\[#aa4725\]">سری‌های <\/span> \{sportTitle\}/);
  assert.match(src, /<span className="text-\[#aa4725\]">سری های<\/span>لیمیتد ادیشن/);
  assert.match(src, /breakpointsBase=\{fitContainer \? "container" : "window"\}/);
});

test("search dropdowns: rendered in a fixed portal, so no overflow container can clip them", async () => {
  const ui = await read("../src/components/admin/articles/blockUi.jsx");
  assert.match(ui, /export function FloatingPanel\(/);
  assert.match(ui, /<AdminPortal>/);
  assert.match(ui, /position: "fixed"/);
  assert.match(ui, /window\.addEventListener\("scroll", place, true\)/, "follows scrolling ancestors (capture)");

  const picker = await read("../src/components/admin/articles/ArticleEntityPicker.jsx");
  assert.match(picker, /<FloatingPanel anchorRef=\{anchor\} open=\{open\}/);
  assert.doesNotMatch(picker, /absolute z-\[60\] top-full/, "the old in-flow absolute list is gone");
  assert.match(picker, /onMouseDown=\{\(event\) => event\.preventDefault\(\)\}/, "picking does not blur the input first");

  const rich = await read("../src/components/admin/articles/RichTextField.jsx");
  assert.match(rich, /<FloatingPanel anchorRef=\{box\} open=\{open\} panelRef=\{list\}/);
  assert.match(rich, /!list\.current\?\.contains\(event\.target\)/, "a click on the portalled list is not 'outside'");
});
