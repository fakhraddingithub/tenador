import test from "node:test";
import assert from "node:assert/strict";
import {
  BLEED,
  CLIP_PATHS,
  CORNER,
  GAP,
  LAYOUTS,
  OPPOSITE,
  PIECE_COUNT,
  SIDES,
  SOCKET_SPAN,
  TAB_DEPTH,
  TAB_SPAN,
  connectionsOf,
  edgeLine,
  edgeRange,
  layoutSize,
  rectsOf,
} from "../src/lib/articlePuzzle.mjs";

const layouts = Object.entries(LAYOUTS);

test("هر چیدمان هشت قطعه‌ی بدونِ هم‌پوشانی با فاصله‌ی دقیقاً ۱۶ دارد", () => {
  for (const [name, layout] of layouts) {
    const rects = rectsOf(layout);
    const size = layoutSize(layout);
    assert.equal(rects.length, PIECE_COUNT, name);
    for (const r of rects) {
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= size.w && r.y + r.h <= size.h, name);
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const gapX = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w));
        const gapY = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
        assert.ok(Math.max(gapX, gapY) >= GAP, `${name}: ${i}/${j} فاصله‌ی کافی ندارند`);
      }
    }
  }
});

test("ترکیبِ دسکتاپ ارتفاعِ ادیتوریال دارد و قطعه‌ی شاخص غالب است", () => {
  const rects = rectsOf(LAYOUTS.desktop);
  const { h } = layoutSize(LAYOUTS.desktop);
  assert.ok(h >= 650 && h <= 850, `ارتفاعِ ترکیب ${h}`);
  for (const r of rects) assert.ok(r.h >= 180, `قطعه‌ی کوتاه: ${r.h}`);
  const areas = rects.map((r) => r.w * r.h);
  const biggest = Math.max(...areas);
  assert.equal(biggest, rects[3].w * rects[3].h, "قطعه‌ی شاخص باید بزرگ‌ترین باشد");
  assert.ok(rects[3].h >= 320 && rects[3].h <= 500, `ارتفاعِ قطعه‌ی شاخص ${rects[3].h}`);
  assert.ok(biggest > areas.toSorted((a, b) => b - a)[1] * 1.2, "قطعه‌ی شاخص به‌قدرِ کافی غالب نیست");
});

test("هر تب یک سوکتِ روبه‌روی دقیقاً مکمل دارد", () => {
  for (const [name, layout] of layouts) {
    const rects = rectsOf(layout);
    for (const link of layout.links) {
      const [ti, tside] = link.tab;
      const [si, sside] = link.socket;

      // لبه‌ها باید روبه‌روی هم باشند و دقیقاً GAP فاصله داشته باشند.
      assert.equal(sside, OPPOSITE[tside], `${name}: جهتِ اتصال ${ti}→${si}`);
      const distance = Math.abs(edgeLine(rects[si], sside) - edgeLine(rects[ti], tside));
      assert.equal(distance, GAP, `${name}: فاصله‌ی لبه‌ی ${ti}→${si}`);

      // سوکت = تب به‌اضافه‌ی GAP در هر سه ضلع، با همان عمق و همان مرکز.
      assert.equal(SOCKET_SPAN - TAB_SPAN, GAP, "عرضِ سوکت باید یک GAP بزرگ‌تر باشد");

      // ردِ اتصال روی هر دو قطعه به گوشه‌ی کارت نمی‌رسد.
      for (const [rect, side, reach, index] of [
        [rects[ti], tside, TAB_SPAN, ti],
        [rects[si], sside, SOCKET_SPAN, si],
      ]) {
        const [from, to] = edgeRange(rect, side);
        assert.ok(
          link.at - reach > from + CORNER && link.at + reach < to - CORNER,
          `${name}: اتصالِ قطعه‌ی ${index} روی لبه‌ی ${side} به گوشه می‌خورد`,
        );
      }
    }
    assert.ok(BLEED >= TAB_DEPTH, "BLEED باید بیرون‌زدگیِ تب را در خود جا دهد");
  }
});

test("اتصال‌های یک لبه روی هم نمی‌افتند", () => {
  for (const [name, layout] of layouts) {
    connectionsOf(layout).forEach((byside, index) => {
      for (const side of SIDES) {
        const spans = (byside[side] || []).map((c) => c.at).sort((a, b) => a - b);
        for (let i = 1; i < spans.length; i++) {
          assert.ok(
            spans[i] - spans[i - 1] > 2 * SOCKET_SPAN,
            `${name}: دو اتصال روی لبه‌ی ${side} قطعه‌ی ${index} هم‌پوشانی دارند`,
          );
        }
      }
    });
  }
});

test("مسیرهای کلیپ مستطیلی، سالم و نرمال‌شده‌اند", () => {
  assert.equal(CLIP_PATHS.length, 2 * PIECE_COUNT);
  for (const { id, d } of CLIP_PATHS) {
    assert.match(d, /^M[\d.]/, id);
    assert.match(d, /Z$/, id);
    assert.ok(!d.includes("NaN"), `${id}: مختصاتِ نامعتبر`);
    // فقط خطِ راست و کمانِ گوشه — هیچ منحنیِ بزیه یا کمانِ بزرگی وجود ندارد.
    assert.ok(!/[CcSsQqTt]/.test(d), `${id}: منحنیِ غیرمستطیلی دارد`);
    for (const value of d.match(/-?\d+\.?\d*/g).map(Number)) {
      assert.ok(value >= -0.001 && value <= 1.001, `${id}: مختصاتِ خارج از بازه ${value}`);
    }
  }
});
