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
  PUZZLE_CSS,
  SIDES,
  SOCKET_SPAN,
  TAB_DEPTH,
  TAB_SPAN,
  bandHeight,
  bandRows,
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

test("ارتفاعِ هر بازه صریح است و هیچ‌جا از aspect-ratio مشتق نمی‌شود", () => {
  assert.ok(!PUZZLE_CSS.includes(".fa-grid{direction:ltr;display:grid;gap:16px;aspect-ratio"));
  for (const [name, layout] of layouts) {
    for (const band of layout.bands) {
      const rows = bandRows(layout, band);
      assert.ok(rows.every((r) => r > 0), `${name}@${band.min}: ردیفِ صفر`);
      assert.ok(
        PUZZLE_CSS.includes(`@media (min-width:${band.min}px){.fa-grid{grid-template-rows:`),
        `${name}@${band.min}: ارتفاعِ پیکسلی تولید نشده`,
      );
    }
  }
  // ارتفاعِ اسمیِ هر بازه در محدوده‌ی خواسته‌شده
  const desktop = bandHeight(bandRows(LAYOUTS.desktop, LAYOUTS.desktop.bands[0]));
  assert.ok(desktop >= 700 && desktop <= 850, `ارتفاعِ دسکتاپ ${desktop}`);
  const tablet = bandHeight(bandRows(LAYOUTS.tablet, LAYOUTS.tablet.bands[0]));
  assert.ok(tablet >= 750 && tablet <= 1000, `ارتفاعِ تبلت ${tablet}`);
});

test("ترکیبِ دسکتاپ مجله‌ای است: قطعه‌ی شاخص غالب و هیچ نوارِ باریکی نیست", () => {
  const rects = rectsOf(LAYOUTS.desktop);
  const { w, h } = layoutSize(LAYOUTS.desktop);
  assert.ok(w / h >= 1.4 && w / h <= 1.8, `نسبتِ ترکیب ${(w / h).toFixed(2)}`);
  for (const r of rects) {
    assert.ok(r.h >= 190, `قطعه‌ی کوتاه: ${r.w}×${r.h}`);
    assert.ok(r.w / r.h <= 4, `قطعه‌ی نواری: ${r.w}×${r.h}`);
  }
  const areas = rects.map((r) => r.w * r.h);
  const biggest = Math.max(...areas);
  assert.equal(biggest, rects[3].w * rects[3].h, "قطعه‌ی شاخص باید بزرگ‌ترین باشد");
  assert.ok(rects[3].h >= 400 && rects[3].h <= 550, `ارتفاعِ قطعه‌ی شاخص ${rects[3].h}`);
  assert.ok(rects[0].h >= 400, `ستونِ بلند ${rects[0].h}`);
  for (const i of [1, 2]) assert.ok(rects[i].h >= 240 && rects[i].h <= 360, `میانی ${rects[i].h}`);
  for (const i of [4, 5, 6, 7]) assert.ok(rects[i].h >= 190 && rects[i].h <= 300, `پشتیبان ${rects[i].h}`);
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
