/**
 * tests/blockSpacing.test.mjs
 *
 * فاصله‌ی پیش‌فرضِ بلوک صفر شد. این فایل دو چیز را قفل می‌کند: مهاجرتی که
 * فاصله‌ی *فعلیِ* محتوای موجود را صریح می‌کند (پس هیچ صفحه‌ای جابه‌جا نمی‌شود)،
 * و اینکه کلاسِ مشترکِ بلوک دیگر حاشیه‌ی پیش‌فرض ندارد.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { needsSpacingPin, pinBlockSpacing, SPACING_EXEMPT_TYPES } from "../src/lib/blockSpacingMigration.js";

const block = (type, style) => ({ id: type, type, data: {}, ...(style ? { style } : {}) });

test("migration pins the current spacing of blocks that use the shared default", () => {
  const blocks = [block("image"), block("button"), block("heading", { textColor: "#112233" })];
  assert.equal(pinBlockSpacing(blocks), 3);
  assert.deepEqual(blocks.map((b) => b.style.spacing), ["md", "md", "md"]);
  assert.equal(blocks[2].style.textColor, "#112233", "other style keys survive");
  assert.equal(pinBlockSpacing(blocks), 0, "idempotent");
});

test("paragraph and divider keep their own rhythm and are never pinned", () => {
  const blocks = [block("paragraph"), block("divider")];
  assert.equal(pinBlockSpacing(blocks), 0);
  assert.deepEqual(blocks.map((b) => b.style), [undefined, undefined]);
  assert.deepEqual(SPACING_EXEMPT_TYPES, ["paragraph", "divider"]);
});

test("an explicit spacing is never overwritten, at any depth", () => {
  const chosen = block("image", { spacing: "none" });
  const merged = { id: "m", type: "merged", data: { blocks: [chosen, block("quote"), { id: "m2", type: "merged", data: { blocks: [block("video")] } }] } };
  assert.equal(pinBlockSpacing([merged]), 4, "outer merged + quote + inner merged + nested video");
  assert.equal(chosen.style.spacing, "none", "an admin's choice is kept");
  assert.equal(merged.data.blocks[2].data.blocks[0].style.spacing, "md");
  assert.equal(needsSpacingPin(block("image", { spacing: "lg" })), false);
  assert.equal(pinBlockSpacing(undefined), 0);
});

test("the shared block class no longer carries a default margin", async () => {
  const src = await readFile(new URL("../src/components/features/articles/ArticleBlockRenderer.jsx", import.meta.url), "utf8");
  assert.match(src, /const blockSection = "scroll-mt-28";/);
  assert.match(src, /my-5/, "paragraph keeps its own rhythm");
  assert.match(src, /my-10/, "divider keeps its own rhythm");
});

test("spacing round-trip: md survives a save, none is the stripped default", async () => {
  const { sanitizeArticleBlockStyle } = await import("../src/lib/articleBlockValidation.js");
  assert.deepEqual(sanitizeArticleBlockStyle({ spacing: "md" }), { spacing: "md" }, "the pinned value must survive an admin save");
  assert.deepEqual(sanitizeArticleBlockStyle({ spacing: "lg" }), { spacing: "lg" });
  assert.equal(sanitizeArticleBlockStyle({ spacing: "none" }), undefined, "none is the default and is not stored");
  const src = await readFile(new URL("../src/components/features/articles/ArticleBlockRenderer.jsx", import.meta.url), "utf8");
  assert.match(src, /const SPACING_CSS = \{ none: "0rem", sm: "1rem", md: "2\.25rem", lg: "4rem" \};/, "every spacing value renders, md included");
});
