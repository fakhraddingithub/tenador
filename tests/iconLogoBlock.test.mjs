/**
 * tests/iconLogoBlock.test.mjs
 *
 * بلوکِ «آیکن و لوگو»: تصاویرِ واقعیِ ورزش/برند/سری/دسته، اندازه، زمینه (همان لایه‌ی
 * رنگِ بلوکِ تصویر)، گردی، فاصله‌ی داخلی، متنِ غنی و پیوند.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

register("./aliasHooks.mjs", import.meta.url);
register("./listingFiltersHooks.mjs", import.meta.url);
// گیتِ مجوز در این تست موضوع نیست؛ همان route ـِ واقعی با پایگاه‌داده‌ی واقعی اجرا می‌شود.
register(`data:text/javascript,export async function resolve(specifier, context, next) {
  return next(specifier === "next/server" ? "next/server.js" : specifier, context);
}
export async function load(url, context, next) {
  if (url.endsWith("/src/lib/requireAdminPermission.js")) return { format: "module", shortCircuit: true, source: "export default async function requireAdminPermission() { return { denied: null }; }" };
  return next(url, context);
}`);
process.env.MONGODB_URI_TENADOR = "mongodb://127.0.0.1:1/unused-test-placeholder";

const { entityImageOptions, parseImageSource, ENTITY_IMAGE_SOURCES, ICON_LOGO_BACKGROUND } = await import("../src/lib/entityImages.js");
const { sanitizeArticleBlockData } = await import("../src/lib/articleBlockValidation.js");
const { ARTICLE_BLOCK_TYPES } = await import("../src/lib/articleBlockTypes.js");

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const has = (source, text, message) => assert.ok(source.includes(text), message || `missing: ${text}`);
const img = (name) => `https://ik.imagekit.io/x/${name}.png`;
const oid = () => new mongoose.Types.ObjectId();

test("every image field of each entity type is offered — and nothing else", () => {
  assert.deepEqual(entityImageOptions("sport", { icon: img("s-icon"), image: img("s-image") }).map((o) => o.label), ["آیکن", "تصویر"]);
  // empty fields drop out; the same file twice is offered once
  const brand = entityImageOptions("brand", { logo: img("logo"), icon: img("logo"), monochromeLogo: " ", image: img("b-image") });
  assert.deepEqual(brand.map((o) => [o.key, o.url]), [["logo", img("logo")], ["image", img("b-image")]]);
  // a serie's per-sport images, labelled with the sport
  const serie = entityImageOptions("serie", { logo: img("se-logo"), headImage: "", image: img("se-image"), sportImages: [{ sport: { title: "تنیس" }, image: img("se-tennis"), headImage: img("se-tennis-head") }, { sport: null, image: "", headImage: "" }] });
  assert.deepEqual(serie.map((o) => o.label), ["لوگو", "تصویر", "تصویر — تنیس", "تصویرِ سربرگ — تنیس"]);
  // a category's custom-tab icon and item images
  const category = entityImageOptions("category", { icon: img("c-icon"), image: "", customTab: { icon: img("tab"), items: [{ title: "راهنما", image: img("tab-item") }] } });
  assert.deepEqual(category.map((o) => o.key), ["icon", "customTab.icon", "customTab.items.0.image"]);
  assert.equal(category[2].label, "تبِ سفارشی — راهنما");
  assert.deepEqual(entityImageOptions("brand", {}), []);
  assert.deepEqual(entityImageOptions("athlete", { image: img("x") }), [], "only the four supported types");
  assert.deepEqual(Object.keys(ENTITY_IMAGE_SOURCES), ["sport", "brand", "serie", "category"]);

  const id = String(oid());
  assert.deepEqual(parseImageSource(`brand:${id}`), { type: "brand", id });
  assert.equal(parseImageSource(`user:${id}`), null);
  assert.equal(parseImageSource("brand:nope"), null);
});

test("validator: sensible defaults, clamped sizes, the image block's background keys", () => {
  assert.ok(ARTICLE_BLOCK_TYPES.includes("iconLogo"));
  const source = `brand:${oid()}`;
  const errors = {};
  const clean = sanitizeArticleBlockData("iconLogo", { source, url: img("logo"), alt: "ویلسون", imageLabel: "لوگو" }, errors, "b");
  assert.deepEqual(errors, {});
  assert.deepEqual(clean, { source, url: img("logo"), alt: "ویلسون", imageLabel: "لوگو", width: 120, height: null, radius: 6, padding: 24, text: "", href: "", ...ICON_LOGO_BACKGROUND });
  // out of range → clamped; nonsense → default; height null keeps the ratio
  const sized = sanitizeArticleBlockData("iconLogo", { width: 5000, height: 3, radius: -4, padding: "abc" }, errors, "b");
  assert.deepEqual([sized.width, sized.height, sized.radius, sized.padding], [800, 16, 0, 24]);
  // gradient, explicit «no background», rich text, link
  const styled = sanitizeArticleBlockData("iconLogo", { shade: 0, shadeMode: "gradient", shadeColor: "#ABC", shadeColor2: "112233", shadeDirection: "to-right", text: "ویلسون", html: "<strong>ویلسون</strong><script>x</script>", href: "/wilson" }, errors, "b");
  assert.equal(styled.shade, 0, "an explicit 0 means no background");
  assert.deepEqual([styled.shadeMode, styled.shadeColor, styled.shadeColor2, styled.shadeDirection], ["gradient", "#aabbcc", "#112233", "to-right"]);
  assert.ok(styled.html.includes("<strong>") && !styled.html.includes("script"));
  assert.equal(styled.href, "/wilson");
  assert.deepEqual(errors, {});
  const bad = {};
  const rejected = sanitizeArticleBlockData("iconLogo", { source: "user:1", url: "javascript:alert(1)", href: "javascript:alert(1)" }, bad, "b");
  assert.equal(rejected.source, null);
  assert.ok(bad["b.url"] && bad["b.href"], "image and link are validated like everywhere else");
});

test("editor: one workflow, in order; the renderer keeps image and text in one frame", async () => {
  const { ARTICLE_BLOCKS } = await import("../src/components/admin/articles/blockRegistry.js");
  const def = ARTICLE_BLOCKS.iconLogo;
  assert.deepEqual(def.fields.map((field) => [field.key, field.kind]), [["source", "entity"], ["url", "entityImages"], ["size", "iconSize"], ["background", "iconBackground"], ["radius", "number"], ["padding", "number"], ["text", "rich"], ["href", "url"]]);
  assert.deepEqual(def.fields.filter((field) => field.section).map((field) => field.section), ["۱. منبع و تصویر", "۲. اندازه", "۳. زمینه و قاب", "۴. متن", "۵. پیوند"]);
  assert.equal(def.fields[0].entityType, "imageSource");
  assert.deepEqual(def.fields[0].clears, ["url", "alt", "imageLabel"], "a new source empties the old image");
  assert.equal(def.defaults.radius, 6);

  const editor = await read("../src/components/admin/articles/BlockEditor.jsx");
  has(editor, 'if (field.kind === "iconBackground") return <ImageShadeField block={block} onUpdate={onUpdate} background />;', "the image block's own background control");
  has(editor, "type=entityImages&source=");
  const renderer = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  has(renderer, "background: imageShadeLayer(data)?.background,", "the image block's own background renderer");
  has(renderer, '{hasText ? <RichParagraph', "no empty space without text");
  has(renderer, 'className="absolute inset-0 rounded-[inherit]', "a stretched link, never <a> around rich text");
  has(renderer, 'style={{ width: `${width}px`, height: height ? `${height}px` : "auto" }}');
  has(renderer, 'className="block max-w-full object-contain"', "never wider than its slot, never distorted");
});

// ——— route ـِ واقعی ———————————————————————————————————————————————————————
let server;
before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri("icon-logo"));
  global._mongooseCache = { conn: mongoose, promise: null };
});
after(async () => {
  await mongoose.disconnect();
  await server?.stop();
});

test("route: one search across sports, brands, series and categories, then the chosen one's images", async () => {
  const db = mongoose.connection;
  const sport = oid();
  const brand = oid();
  const serie = oid();
  const category = oid();
  await db.collection("sports").insertOne({ _id: sport, name: "tennis", title: "تنیس", icon: img("tennis-icon"), image: img("tennis") });
  await db.collection("brands").insertOne({ _id: brand, name: "Tennis Pro", title: "تنیس پرو", logo: img("tp-logo"), icon: "", image: img("tp") });
  await db.collection("series").insertOne({ _id: serie, name: "Tennis Clash", title: "کلش تنیس", brand, logo: img("clash"), sportImages: [{ sport, image: img("clash-tennis") }] });
  await db.collection("categories").insertOne({ _id: category, name: "tennis-racket", title: "راکت تنیس", sport, icon: "", image: "" });
  const { GET } = await import("../src/app/api/admin/article-cms/entities/route.js");
  const call = async (query) => (await (await GET(new Request(`http://local/api/admin/article-cms/entities?${query}`))).json()).items;

  const found = await call("type=imageSource&q=" + encodeURIComponent("تنیس"));
  assert.deepEqual(found.map((item) => item._id).sort(), [`brand:${brand}`, `category:${category}`, `serie:${serie}`, `sport:${sport}`].sort(), "all four types, one search");
  const bySource = Object.fromEntries(found.map((item) => [item._id.split(":")[0], item]));
  assert.ok(bySource.category.sub.includes("بدونِ تصویر"), "an entity without images says so");
  assert.ok(bySource.brand.sub.includes("۲"), "the image count is shown");
  assert.equal(bySource.serie.label, "تنیس پرو کلش تنیس", "a serie is named with its brand");
  assert.deepEqual(await call("type=imageSource&q=zzzz-none"), []);

  const serieImages = await call(`type=entityImages&source=serie:${serie}`);
  assert.deepEqual(serieImages.map((item) => [item.label, item.url]), [["لوگو", img("clash")], ["تصویر — تنیس", img("clash-tennis")]], "per-sport images with the sport's name");
  assert.equal(serieImages[0].entity, "تنیس پرو کلش تنیس", "used as the image's alt text");
  assert.deepEqual(await call(`type=entityImages&source=category:${category}`), []);
  assert.deepEqual(await call("type=entityImages&source=brand:nope"), []);
  // the saved source resolves back to its chip label
  const [chip] = await call(`type=imageSource&ids=sport:${sport}`);
  assert.equal(chip.label, "تنیس");
});
