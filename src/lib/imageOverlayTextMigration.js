/**
 * «متنِ روی تصویر» (image.images[].overlayText) حذف شد و جایش را بلوک‌های واقعیِ
 * روی تصویر گرفتند (image.data.blocks).
 *
 * این مهاجرت هیچ متنی را دور نمی‌ریزد: هر overlayText به یک بلوکِ پاراگرافِ
 * تودرتو تبدیل می‌شود و تنظیماتِ قابلِ انتقالِ قدیمی با آن می‌آید:
 *
 * | قدیمی | جدید |
 * |---|---|
 * | `overlay.shade !== false` | `data.shade = 35` (همان `bg-black/35`) |
 * | `overlay.shade === false` | بدونِ لایه |
 * | `overlay.position` | `data.contentPosition` |
 * | `overlay.align` | `style.align` پاراگراف |
 * | `overlay.color` | `style.textColor` پاراگراف |
 * | `overlay.size` / `overlay.dir` | منتقل نمی‌شود — پاراگراف اندازه و جهتِ خودش را دارد |
 *
 * بلوکی که چند تصویرِ متن‌دار دارد، به ازای هر متن یک پاراگراف می‌گیرد (به همان
 * ترتیب)، چون لایه‌ی رویی برای کلِ ناحیه‌ی تصویرِ بلوک است نه تک‌تکِ کاشی‌ها.
 *
 * idempotent: پس از اجرا دیگر overlayText ای نمانده، پس بارِ دوم صفر می‌دهد.
 */

/** همان تیرگیِ `bg-black/35` که متنِ روی تصویر به‌طورِ پیش‌فرض داشت. */
export const LEGACY_SHADE = 35;

const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `img-overlay-${Math.random().toString(36).slice(2)}-${Date.now()}`);

/** متن‌های روی تصویرِ یک بلوک، به ترتیبِ تصاویر. */
export function overlayTexts(block) {
  if (block?.type !== "image") return [];
  const images = Array.isArray(block.data?.images) ? block.data.images : [];
  return images.map((image) => (typeof image?.overlayText === "string" ? image.overlayText.trim() : "")).filter(Boolean);
}

function paragraphFor(text, overlay) {
  const style = {};
  if (["right", "center", "left"].includes(overlay?.align)) style.align = overlay.align;
  if (typeof overlay?.color === "string" && /^#[0-9a-f]{6}$/i.test(overlay.color)) style.textColor = overlay.color;
  const block = { id: newId(), type: "paragraph", version: 1, data: { text } };
  if (Object.keys(style).length) block.style = style;
  return block;
}

/**
 * بلوک‌ها را در جا به‌روز می‌کند (با فرزندانِ هر بلوکِ تودرتو، در هر عمقی) و
 * تعدادِ *متن‌های* منتقل‌شده را برمی‌گرداند.
 */
export function migrateImageOverlayText(blocks) {
  let moved = 0;
  for (const block of Array.isArray(blocks) ? blocks : []) {
    if (!block || typeof block !== "object") continue;

    if (block.type === "image") {
      const texts = overlayTexts(block);
      if (texts.length) {
        const overlay = block.data?.overlay || {};
        const existing = Array.isArray(block.data.blocks) ? block.data.blocks : [];
        block.data.blocks = [...existing, ...texts.map((text) => paragraphFor(text, overlay))];
        if (overlay.shade !== false) block.data.shade = LEGACY_SHADE;
        if (["top", "bottom"].includes(overlay.position)) block.data.contentPosition = overlay.position;
        moved += texts.length;
      }
      // overlayText و تنظیماتِ ظاهرِ آن دیگر خوانده نمی‌شوند؛ نگه‌داشتنشان فقط
      // دادهٔ مرده است و بارِ دوم هم دوباره منتقل می‌شد.
      for (const image of Array.isArray(block.data?.images) ? block.data.images : []) delete image.overlayText;
      if (block.data?.overlay) delete block.data.overlay;
    }

    // هر دو نوعِ تودرتویی: بلوکِ ادغام‌شده و خودِ بلوکِ تصویر.
    if (Array.isArray(block.data?.blocks)) moved += migrateImageOverlayText(block.data.blocks);
  }
  return moved;
}
