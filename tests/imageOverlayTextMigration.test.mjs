/**
 * tests/imageOverlayTextMigration.test.mjs
 *
 * «متنِ روی تصویر» حذف شد. این تست قفل می‌کند که مهاجرت هیچ متنی را دور نریزد و
 * بارِ دوم چیزی را دوباره منتقل نکند.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { LEGACY_SHADE, migrateImageOverlayText, overlayTexts } from "../src/lib/imageOverlayTextMigration.js";

const image = (data) => ({ id: "img", type: "image", version: 1, data });

test("هر متن به یک پاراگرافِ تودرتو تبدیل می‌شود، به همان ترتیب", () => {
  const blocks = [image({
    url: "https://ik.imagekit.io/t/a.jpg",
    images: [{ url: "https://ik.imagekit.io/t/a.jpg", overlayText: "  یک  " }, { url: "https://ik.imagekit.io/t/b.jpg", overlayText: "دو" }],
    overlay: { align: "right", color: "#ffaa00", position: "bottom", size: "xl" },
  })];
  assert.equal(migrateImageOverlayText(blocks), 2);

  const nested = blocks[0].data.blocks;
  assert.deepEqual(nested.map((block) => block.type), ["paragraph", "paragraph"]);
  assert.deepEqual(nested.map((block) => block.data.text), ["یک", "دو"]);
  // چینش و رنگ منتقل می‌شوند؛ اندازه و جهت نه — پاراگراف تنظیماتِ خودش را دارد.
  assert.deepEqual(nested[0].style, { align: "right", textColor: "#ffaa00" });
  // شناسه‌ها یکتا هستند، وگرنه سرور کلِ ذخیره را رد می‌کند.
  assert.notEqual(nested[0].id, nested[1].id);

  // سایه‌ی پیش‌فرضِ قدیمی (bg-black/35) عددی می‌شود و جای عمودی می‌ماند.
  assert.equal(blocks[0].data.shade, LEGACY_SHADE);
  assert.equal(blocks[0].data.contentPosition, "bottom");

  // دادهٔ مرده می‌رود.
  assert.equal("overlay" in blocks[0].data, false);
  assert.equal("overlayText" in blocks[0].data.images[0], false);
});

test("«بدونِ سایه»ی قدیمی سایه نمی‌گیرد، و وسط پیش‌فرض است پس نوشته نمی‌شود", () => {
  const blocks = [image({ images: [{ url: "https://ik.imagekit.io/t/a.jpg", overlayText: "متن" }], overlay: { shade: false, position: "center" } })];
  migrateImageOverlayText(blocks);
  assert.equal("shade" in blocks[0].data, false);
  assert.equal("contentPosition" in blocks[0].data, false);
});

test("idempotent: بارِ دوم هیچ متنی منتقل نمی‌شود", () => {
  const blocks = [image({ images: [{ url: "https://ik.imagekit.io/t/a.jpg", overlayText: "متن" }] })];
  assert.equal(migrateImageOverlayText(blocks), 1);
  assert.equal(migrateImageOverlayText(blocks), 0);
  assert.equal(blocks[0].data.blocks.length, 1, "پاراگراف دوباره ساخته نمی‌شود");
});

test("بلوکِ بدونِ متن دست‌نخورده می‌ماند", () => {
  const blocks = [image({ url: "https://ik.imagekit.io/t/a.jpg", alt: "a", caption: "c" })];
  const before = JSON.stringify(blocks);
  assert.equal(migrateImageOverlayText(blocks), 0);
  assert.equal(JSON.stringify(blocks), before);
  assert.deepEqual(overlayTexts(blocks[0]), []);
});

test("متنِ تصویرِ داخلِ بلوکِ ادغام‌شده و داخلِ بلوکِ تصویر هم منتقل می‌شود", () => {
  const blocks = [{
    id: "m", type: "merged", version: 1,
    data: { blocks: [image({ images: [{ url: "https://ik.imagekit.io/t/a.jpg", overlayText: "داخلِ ادغام" }] })] },
  }, image({
    url: "https://ik.imagekit.io/t/b.jpg",
    blocks: [{ ...image({ images: [{ url: "https://ik.imagekit.io/t/c.jpg", overlayText: "روی تصویر" }] }), id: "inner" }],
  })];
  assert.equal(migrateImageOverlayText(blocks), 2);
  assert.equal(blocks[0].data.blocks[0].data.blocks[0].data.text, "داخلِ ادغام");
  assert.equal(blocks[1].data.blocks[0].data.blocks[0].data.text, "روی تصویر");
});

test("متنِ موجودِ روی تصویر پاک نمی‌شود — پاراگراف‌ها به آن اضافه می‌شوند", () => {
  const blocks = [image({
    images: [{ url: "https://ik.imagekit.io/t/a.jpg", overlayText: "قدیمی" }],
    blocks: [{ id: "keep", type: "button", version: 1, data: { label: "خرید" } }],
  })];
  migrateImageOverlayText(blocks);
  assert.deepEqual(blocks[0].data.blocks.map((block) => block.id), ["keep", blocks[0].data.blocks[1].id]);
});
