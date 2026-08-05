import test from "node:test";
import assert from "node:assert/strict";
import {
  BLEED,
  CLIP_PATHS,
  CORNER,
  GAP,
  HALF_SPAN,
  LAYOUTS,
  OPPOSITE,
  PIECE_COUNT,
  SIDES,
  connectionsOf,
  edgeLine,
  edgeRange,
} from "../src/lib/articlePuzzle.mjs";

const layouts = Object.entries(LAYOUTS);

test("هر چیدمان دقیقاً هشت قطعه‌ی بدونِ هم‌پوشانی با فاصله‌ی حداقل ۱۶ دارد", () => {
  for (const [name, layout] of layouts) {
    assert.equal(layout.pieces.length, PIECE_COUNT, name);
    for (const p of layout.pieces) {
      assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= layout.w && p.y + p.h <= layout.h, name);
    }
    for (let i = 0; i < layout.pieces.length; i++) {
      for (let j = i + 1; j < layout.pieces.length; j++) {
        const a = layout.pieces[i];
        const b = layout.pieces[j];
        const gapX = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w));
        const gapY = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
        assert.ok(Math.max(gapX, gapY) >= GAP, `${name}: ${i}/${j} فاصله‌ی کافی ندارند`);
      }
    }
  }
});

test("هر تب یک سوکتِ روبه‌روی دقیقاً مکمل دارد", () => {
  for (const [name, layout] of layouts) {
    for (const link of layout.links) {
      const [ti, tside] = link.tab;
      const [si, sside] = link.socket;
      const tabPiece = layout.pieces[ti];
      const socketPiece = layout.pieces[si];

      // لبه‌ها باید روبه‌روی هم باشند و دقیقاً GAP فاصله داشته باشند.
      assert.equal(sside, OPPOSITE[tside], `${name}: جهتِ اتصال ${ti}→${si}`);
      const distance = Math.abs(edgeLine(socketPiece, sside) - edgeLine(tabPiece, tside));
      assert.equal(distance, GAP, `${name}: فاصله‌ی لبه‌ی ${ti}→${si}`);

      // دهانه‌ی اتصال روی هر دو قطعه یکی است و به گوشه‌ها نمی‌رسد.
      for (const [piece, side, index] of [[tabPiece, tside, ti], [socketPiece, sside, si]]) {
        const [from, to] = edgeRange(piece, side);
        assert.ok(
          link.at - HALF_SPAN > from + CORNER && link.at + HALF_SPAN < to - CORNER,
          `${name}: اتصالِ قطعه‌ی ${index} روی لبه‌ی ${side} به گوشه می‌خورد`,
        );
      }

      // بیرون‌زدگیِ تب هرگز از جعبه‌ی قطعه بیرون نمی‌زند.
      assert.ok(BLEED >= GAP, "BLEED باید حداقل به اندازه‌ی GAP باشد");
    }
  }
});

test("اتصال‌های یک لبه روی هم نمی‌افتند", () => {
  for (const [name, layout] of layouts) {
    connectionsOf(layout).forEach((byside, index) => {
      for (const side of SIDES) {
        const spans = (byside[side] || []).map((c) => c.at).sort((a, b) => a - b);
        for (let i = 1; i < spans.length; i++) {
          assert.ok(
            spans[i] - spans[i - 1] > 2 * HALF_SPAN,
            `${name}: دو اتصال روی لبه‌ی ${side} قطعه‌ی ${index} هم‌پوشانی دارند`,
          );
        }
      }
    });
  }
});

test("مسیرهای کلیپ سالم و نرمال‌شده‌اند", () => {
  assert.equal(CLIP_PATHS.length, 2 * PIECE_COUNT);
  for (const { id, d } of CLIP_PATHS) {
    assert.match(d, /^M[\d.]/, id);
    assert.match(d, /Z$/, id);
    assert.ok(!d.includes("NaN"), `${id}: مختصاتِ نامعتبر`);
    for (const value of d.match(/-?\d+\.?\d*/g).map(Number)) {
      assert.ok(value >= -0.001 && value <= 1.001, `${id}: مختصاتِ خارج از بازه ${value}`);
    }
  }
});
