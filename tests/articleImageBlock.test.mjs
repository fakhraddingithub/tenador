/**
 * tests/articleImageBlock.test.mjs
 *
 * بلوکِ تصویر: چند تصویر، ارتفاعِ نمایش، متنِ روی تصویر و پیوند.
 * قاعده‌ی اصلی سازگاریِ عقب‌رو است: بلوکِ قدیمی بدونِ کلیدهای جدید باید دقیقاً
 * همان خروجیِ قبلی را بدهد و از همان مسیرِ رندرِ قبلی عبور کند.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sanitizeArticleBlockData } from "../src/lib/articleBlockValidation.js";
import { imageBlockItems, mirrorFirstImage } from "../src/lib/articleImageBlock.js";

const URL1 = "https://ik.imagekit.io/tenador/a.jpg";
const URL2 = "https://ik.imagekit.io/tenador/b.jpg";
const sanitize = (data) => {
  const errors = {};
  const out = sanitizeArticleBlockData("image", data, errors, "blocks.0.data");
  return { out, errors };
};

test("legacy single-image block sanitizes to exactly the old shape", () => {
  const { out, errors } = sanitize({ url: URL1, alt: "a", caption: "c", width: 1200, height: 600 });
  assert.deepEqual(errors, {});
  assert.deepEqual(out, { url: URL1, alt: "a", caption: "c", width: 1200, height: 600 });
  assert.deepEqual(Object.keys(out), ["url", "alt", "caption", "width", "height"], "no new keys added");
});

test("multiple images are kept, capped, and the first is mirrored into the legacy fields", () => {
  const { out, errors } = sanitize({
    url: "", caption: "",
    images: [
      { url: URL1, alt: "one", width: 800, height: 400, href: "/tennis/racket", overlayText: "  راکت‌ها  " },
      { url: "", alt: "empty slot is dropped" },
      { url: URL2, alt: "two", href: "https://tenador.com/x" },
    ],
  });
  assert.deepEqual(errors, {});
  assert.equal(out.images.length, 2);
  assert.deepEqual(out.images[0], { url: URL1, alt: "one", width: 800, height: 400, href: "/tennis/racket", overlayText: "راکت‌ها" });
  assert.deepEqual(out.images[1], { url: URL2, alt: "two", href: "https://tenador.com/x" });
  assert.equal(out.url, URL1);
  assert.equal(out.alt, "one");
  assert.equal(out.width, 800);

  const tooMany = sanitize({ images: Array.from({ length: 20 }, () => ({ url: URL1 })) });
  assert.equal(tooMany.out.images.length, 12);
  assert.ok(tooMany.errors["blocks.0.data.images"]);
});

test("unsafe links and image urls are rejected, never stored", () => {
  const { out, errors } = sanitize({ images: [{ url: URL1, href: "javascript:alert(1)" }, { url: "data:image/png;base64,xx" }] });
  assert.ok(errors["blocks.0.data.images.0.href"]);
  assert.ok(errors["blocks.0.data.images.1.url"]);
  assert.equal(out.images.length, 1);
  assert.equal("href" in out.images[0], false);
});

test("image links: what admins type is normalized; only unsafe links are rejected (never blocks the save)", async () => {
  const { normalizeImageHref } = await import("../src/lib/articleImageBlock.js");
  const cases = {
    "": "",
    "   ": "",
    "/tennis/racket": "/tennis/racket",
    "tennis/racket": "/tennis/racket",
    "tenador.com/tennis": "https://tenador.com/tennis",
    "www.tenador.com": "https://www.tenador.com/",
    "https://tenador.com/x?y=1": "https://tenador.com/x?y=1",
    "/تنیس/راکت": "/تنیس/راکت",
    "tel:02100000000": "tel:02100000000",
  };
  for (const [input, expected] of Object.entries(cases)) assert.equal(normalizeImageHref(input), expected, input);
  for (const bad of ["javascript:alert(1)", "//evil.com", "data:text/html,x", "/a b"]) assert.equal(normalizeImageHref(bad), null, bad);

  // The reported "stuck" scenario: a protocol-less link used to 400 the whole brand save.
  const { out, errors } = sanitize({ images: [{ url: URL1, href: "tenador.com/tennis" }] });
  assert.deepEqual(errors, {});
  assert.equal(out.images[0].href, "https://tenador.com/tennis");
});

test("displayHeight is clamped; blank means no key", () => {
  assert.equal(sanitize({ url: URL1, displayHeight: 320 }).out.displayHeight, 320);
  assert.equal(sanitize({ url: URL1, displayHeight: "5" }).out.displayHeight, 80);
  assert.equal(sanitize({ url: URL1, displayHeight: 99999 }).out.displayHeight, 1200);
  for (const blank of [undefined, null, "", "abc"]) {
    assert.equal("displayHeight" in sanitize({ url: URL1, displayHeight: blank }).out, false, String(blank));
  }
});

test("overlay keeps only valid non-default values", () => {
  assert.equal("overlay" in sanitize({ url: URL1, overlay: { size: "md", align: "center", dir: "rtl", position: "center" } }).out, false);
  assert.deepEqual(
    sanitize({ url: URL1, overlay: { color: "#FFAA00", size: "xl", align: "right", dir: "ltr", position: "bottom", shade: false, junk: 1 } }).out.overlay,
    { color: "#ffaa00", size: "xl", align: "right", dir: "ltr", position: "bottom", shade: false },
  );
  assert.equal("overlay" in sanitize({ url: URL1, overlay: { color: "red", size: "huge", position: 3 } }).out, false);
});

test("imageBlockItems reads both shapes and ignores empty slots", () => {
  assert.deepEqual(imageBlockItems({ url: URL1, alt: "a", width: 1, height: 2 }), [{ url: URL1, alt: "a", width: 1, height: 2 }]);
  assert.deepEqual(imageBlockItems({ url: "" }), []);
  assert.deepEqual(imageBlockItems({ url: URL1, images: [{ url: "" }, { url: URL2 }] }).map((i) => i.url), [URL2]);
  assert.deepEqual(imageBlockItems({ url: URL1, images: [] }).map((i) => i.url), [URL1], "empty images falls back to legacy");
  assert.deepEqual(mirrorFirstImage([]), { url: "", alt: "", width: undefined, height: undefined });
});

// رندرکننده JSX و next/image دارد و زیرِ node خام اجرا نمی‌شود؛ پس سیم‌کشی
// از روی سورس قفل می‌شود.
test("renderer: plain blocks keep the legacy markup path; links open in the same tab", async () => {
  const src = await readFile(new URL("../src/components/features/articles/ArticleBlockRenderer.jsx", import.meta.url), "utf8");
  assert.match(src, /block\.type === "image" && !isPlainImageBlock\(data\)\) return <ImageBlock/);
  assert.match(src, /block\.type === "image" && data\.url\) return <figure key=\{block\.id\} className=\{blockSection\} style=\{v\.spacing \|\| undefined\}><Image src=\{data\.url\} alt=\{data\.alt \|\| "تصویر مقاله"\} width=\{data\.width \|\| 1600\} height=\{data\.height \|\| 900\}/);
  const tile = src.slice(src.indexOf("function ImageTile"), src.indexOf("function ImageBlock"));
  assert.doesNotMatch(tile, /target=/);
});

test("editor: block library and move dialog are portaled into an admin-scope wrapper", async () => {
  const src = await readFile(new URL("../src/components/admin/articles/BlockEditor.jsx", import.meta.url), "utf8");
  // AdminPortal حالا مشترک است (ویرایشگرِ پیش‌نمایش هم همان را باز می‌کند)، پس
  // تعریفش در blockUi است؛ قاعده همان است: پورتال داخلِ .admin-scope می‌نشیند.
  const ui = await readFile(new URL("../src/components/admin/articles/blockUi.jsx", import.meta.url), "utf8");
  assert.match(ui, /createPortal\(<div className="admin-scope contents"/);
  for (const name of ["function MoveDialog", "function BlockLibrary"]) {
    const start = src.indexOf(name);
    const body = src.slice(start, src.indexOf("\nfunction ", start + 1) === -1 ? undefined : src.indexOf("\nfunction ", start + 1));
    assert.match(body, /return <AdminPortal><div className="fixed inset-0/, name);
  }
});
