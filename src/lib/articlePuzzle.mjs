// هندسه‌ی «پازل مقالات منتخب» — یک سیلوئتِ پیوسته برای هر قطعه.
//
// اتصال‌ها مستطیلی‌اند (کلیدِ مربعی، نه قلابِ گردِ کلاسیک) و هر جفت دقیقاً
// مکملِ هم است:
//
//   تب   : مستطیلِ بیرون‌زده به عمقِ TAB_DEPTH و عرضِ 2×TAB_HALF
//   سوکت : همان مستطیل با عرضِ 2×(TAB_HALF+GAP) و همان عمق، پس تب با فاصله‌ی
//          ثابتِ GAP از هر سه ضلعِ سوکت می‌نشیند
//
// همه‌ی گوشه‌های دیده‌شده — گوشه‌های بیرونیِ کارت، نوکِ تب، کفِ سوکت و محلِ
// اتصالِ تب/سوکت به بدنه — شعاعِ CORNER دارند؛ هیچ گوشه‌ی تیزی وجود ندارد.
//
// چیدمان یک گریدِ واقعی است: ستون‌ها و ردیف‌ها با واحدِ fr و نسبتِ ثابتِ
// aspect-ratio مقیاس می‌گیرند و هر قطعه با grid-area جای می‌گیرد؛ پس هیچ
// ارتفاعِ درصدی‌ای در کار نیست و ترکیب هرگز جمع نمی‌شود.

export const GAP = 16; // فاصله‌ی پایه (هم‌ارزِ gap-4 تیلویند)
export const CORNER = 6; // تنها شعاعِ پروژه — روی همه‌ی گوشه‌های دیده‌شده
export const TAB_DEPTH = 26; // بیرون‌زدگیِ تب = عمقِ سوکت
export const TAB_HALF = 28; // نصفِ عرضِ تب
export const BLEED = TAB_DEPTH; // بزرگ‌ترشدنِ جعبه‌ی قطعه تا تب داخلش جا شود

export const TAB_SPAN = TAB_HALF + CORNER; // نصفِ ردِ تب روی لبه
export const SOCKET_HALF = TAB_HALF + GAP; // نصفِ عرضِ سوکت
export const SOCKET_SPAN = SOCKET_HALF + CORNER; // نصفِ ردِ سوکت روی لبه

// t: جهتِ حرکت روی لبه (مسیر ساعتگرد)، n: نرمالِ بیرونی
const EDGES = {
  top: { t: [1, 0], n: [0, -1] },
  right: { t: [0, 1], n: [1, 0] },
  bottom: { t: [-1, 0], n: [0, 1] },
  left: { t: [0, -1], n: [-1, 0] },
};
export const SIDES = ["top", "right", "bottom", "left"];
export const OPPOSITE = { top: "bottom", bottom: "top", left: "right", right: "left" };

// نقطه = مرکزِ اتصال + a×t + b×n
const at = (p, t, a, n, b) => [p[0] + t[0] * a + n[0] * b, p[1] + t[1] * a + n[1] * b];

export function edgeLine({ x, y, w, h }, side) {
  if (side === "top") return y;
  if (side === "bottom") return y + h;
  if (side === "left") return x;
  return x + w;
}

export function edgeRange({ x, y, w, h }, side) {
  return side === "top" || side === "bottom" ? [x, x + w] : [y, y + h];
}

const edgeStart = ({ x, y, w, h }, side) =>
  side === "top" ? [x + CORNER, y]
    : side === "right" ? [x + w, y + CORNER]
      : side === "bottom" ? [x + w - CORNER, y + h]
        : [x, y + h - CORNER];

const edgeEnd = ({ x, y, w, h }, side) =>
  side === "top" ? [x + w - CORNER, y]
    : side === "right" ? [x + w, y + h - CORNER]
      : side === "bottom" ? [x + CORNER, y + h]
        : [x, y + CORNER];

const pointOn = (piece, side) =>
  side === "top" || side === "bottom"
    ? (a) => [a, edgeLine(piece, side)]
    : (a) => [edgeLine(piece, side), a];

/**
 * مسیرِ بسته‌ی سیلوئتِ یک قطعه، نرمال‌شده در فضای objectBoundingBox (۰ تا ۱)
 * تا با هر اندازه‌ای از کارت مقیاس بگیرد. شعاع‌ها به‌صورتِ بیضویِ جبران‌شده
 * (rx=r/عرض، ry=r/ارتفاع) نوشته می‌شوند تا پس از مقیاسِ غیریکنواختِ مرورگر
 * دقیقاً دایره‌ای رندر شوند.
 */
export function piecePath(piece, connections = {}) {
  const ew = piece.w + 2 * BLEED;
  const eh = piece.h + 2 * BLEED;
  const ox = piece.x - BLEED;
  const oy = piece.y - BLEED;
  const round = (v) => Math.round(v * 1e6) / 1e6;
  const pt = ([px, py]) => `${round((px - ox) / ew)} ${round((py - oy) / eh)}`;

  const out = [`M${pt(edgeStart(piece, "top"))}`];
  const line = (p) => out.push(`L${pt(p)}`);
  const arc = (sweep, p) =>
    out.push(`A${round(CORNER / ew)} ${round(CORNER / eh)} 0 0 ${sweep} ${pt(p)}`);

  SIDES.forEach((side, i) => {
    const { t, n } = EDGES[side];
    const on = pointOn(piece, side);
    const dir = t[0] + t[1]; // ‎+۱ روی لبه‌های بالا/راست، ‎−۱ روی پایین/چپ
    const list = [...(connections[side] || [])].sort((a, b) => (a.at - b.at) * dir);

    for (const link of list) {
      const c = on(link.at);
      if (link.kind === "tab") {
        // دیوارِ ورودی → نوکِ تب → دیوارِ خروجی، همه با گوشه‌ی CORNER
        line(at(c, t, -TAB_SPAN, n, 0));
        arc(0, at(c, t, -TAB_HALF, n, CORNER));
        line(at(c, t, -TAB_HALF, n, TAB_DEPTH - CORNER));
        arc(1, at(c, t, -(TAB_HALF - CORNER), n, TAB_DEPTH));
        line(at(c, t, TAB_HALF - CORNER, n, TAB_DEPTH));
        arc(1, at(c, t, TAB_HALF, n, TAB_DEPTH - CORNER));
        line(at(c, t, TAB_HALF, n, CORNER));
        arc(0, at(c, t, TAB_SPAN, n, 0));
      } else {
        // همان شکل، ‎GAP بزرگ‌تر و رو به داخلِ کارت
        line(at(c, t, -SOCKET_SPAN, n, 0));
        arc(1, at(c, t, -SOCKET_HALF, n, -CORNER));
        line(at(c, t, -SOCKET_HALF, n, -(TAB_DEPTH - CORNER)));
        arc(0, at(c, t, -(SOCKET_HALF - CORNER), n, -TAB_DEPTH));
        line(at(c, t, SOCKET_HALF - CORNER, n, -TAB_DEPTH));
        arc(0, at(c, t, SOCKET_HALF, n, -(TAB_DEPTH - CORNER)));
        line(at(c, t, SOCKET_HALF, n, -CORNER));
        arc(1, at(c, t, SOCKET_SPAN, n, 0));
      }
    }

    line(edgeEnd(piece, side));
    arc(1, edgeStart(piece, SIDES[(i + 1) % 4]));
  });

  out.push("Z");
  return out.join("");
}

// ── چیدمان‌ها ─────────────────────────────────────────────────────────────
// cols/rows: اندازه‌ی تراک‌ها (واحدِ fr، پس نسبت‌ها ثابت می‌مانند).
// pieces: [ستونِ شروع، ردیفِ شروع، تعدادِ ستون، تعدادِ ردیف] — یک‌مبنا.
// ترتیبِ قطعه‌ها = ترتیبِ ذخیره‌شده‌ی مقالات در پنل ادمین (۰ تا ۷).
// links: هر اتصال یک بار تعریف می‌شود و tab و socket روی مختصاتِ مطلقِ `at`
// می‌نشینند، پس هم‌ترازی ذاتیِ ساختار است و قابلِ خطا نیست.

// bands: عرضِ واقعیِ container در هر بازه‌ی بریک‌پوینت. چون max-width کلاسِ
// container تیلویند پله‌ای است، این عرض داخلِ هر بازه ثابت می‌ماند؛ ارتفاعِ
// ردیف‌ها مستقیماً از همین اعداد به پیکسل تولید می‌شود، نه از aspect-ratio.
export const LAYOUTS = {
  // تبلت — ۷۶۸ تا ۱۲۷۹. سه ستون، سه سطحِ ارتفاعی.
  tablet: {
    min: 768,
    viewportShare: 88,
    bands: [
      { min: 768, width: 672 }, // md: 768 − px-12×2
      { min: 1024, width: 896 }, // lg: 1024 − px-16×2
    ],
    cols: [213, 213, 214],
    rows: [300, 220, 240],
    pieces: [
      [1, 1, 2, 1], // شاخصِ بالا ‎۴۴۲×۳۰۰
      [3, 1, 1, 1], // ‎۲۱۴×۳۰۰
      [1, 2, 1, 1],
      [2, 2, 1, 1],
      [3, 2, 1, 1],
      [1, 3, 1, 1],
      [2, 3, 1, 1],
      [3, 3, 1, 1],
    ],
    links: [
      { tab: [0, "right"], socket: [1, "left"], at: 150 },
      { tab: [0, "bottom"], socket: [2, "top"], at: 106 },
      { tab: [1, "bottom"], socket: [4, "top"], at: 565 },
      { tab: [2, "right"], socket: [3, "left"], at: 426 },
      { tab: [4, "left"], socket: [3, "right"], at: 426 },
      { tab: [2, "bottom"], socket: [5, "top"], at: 106 },
      { tab: [3, "bottom"], socket: [6, "top"], at: 335 },
      { tab: [4, "bottom"], socket: [7, "top"], at: 565 },
      { tab: [5, "right"], socket: [6, "left"], at: 672 },
      { tab: [6, "right"], socket: [7, "left"], at: 672 },
    ],
  },

  // دسکتاپ — ۱۲۸۰ به بالا. ستونِ بلندِ عمودی (۱)، دو قطعه‌ی افقیِ میانی (۲و۳)،
  // قطعه‌ی شاخصِ بزرگ (۴) و چهار قطعه‌ی پشتیبانِ پایینی.
  desktop: {
    min: 1280,
    viewportShare: 78,
    bands: [
      { min: 1280, width: 1120 }, // xl: 1280 − px-20×2
      { min: 1536, width: 1376 }, // 2xl: 1536 − px-20×2
    ],
    cols: [256, 176, 176, 464],
    rows: [240, 240, 250],
    pieces: [
      [1, 1, 1, 2], // ستونِ بلندِ چپ ‎۲۵۶×۴۹۶
      [2, 1, 2, 1], // افقیِ میانیِ بالا ‎۳۶۸×۲۴۰
      [2, 2, 2, 1], // افقیِ میانیِ پایین ‎۳۶۸×۲۴۰
      [4, 1, 1, 2], // قطعه‌ی شاخص ‎۴۶۴×۴۹۶
      [1, 3, 1, 1], // ‎۲۵۶×۲۵۰
      [2, 3, 1, 1], // ‎۱۷۶×۲۵۰
      [3, 3, 1, 1], // ‎۱۷۶×۲۵۰
      [4, 3, 1, 1], // ‎۴۶۴×۲۵۰
    ],
    links: [
      { tab: [0, "right"], socket: [1, "left"], at: 120 },
      { tab: [2, "left"], socket: [0, "right"], at: 376 },
      { tab: [1, "right"], socket: [3, "left"], at: 120 },
      { tab: [3, "left"], socket: [2, "right"], at: 376 },
      { tab: [0, "bottom"], socket: [4, "top"], at: 128 },
      { tab: [2, "bottom"], socket: [5, "top"], at: 360 },
      { tab: [2, "bottom"], socket: [6, "top"], at: 552 },
      { tab: [3, "bottom"], socket: [7, "top"], at: 888 },
      { tab: [4, "right"], socket: [5, "left"], at: 637 },
      { tab: [6, "right"], socket: [7, "left"], at: 637 },
    ],
  },
};

export const PIECE_COUNT = LAYOUTS.desktop.pieces.length;

const offsets = (track) => track.reduce((acc, size) => [...acc, acc.at(-1) + size + GAP], [0]);
const span = (track, from, count) =>
  track.slice(from, from + count).reduce((a, b) => a + b, 0) + GAP * (count - 1);

export const layoutSize = (layout) => ({
  w: span(layout.cols, 0, layout.cols.length),
  h: span(layout.rows, 0, layout.rows.length),
});

/** مستطیلِ مطلقِ هر قطعه، مشتق‌شده از همان تراک‌هایی که گرید از آن ساخته می‌شود. */
export function rectsOf(layout) {
  const xs = offsets(layout.cols);
  const ys = offsets(layout.rows);
  return layout.pieces.map(([col, row, cols, rows]) => ({
    x: xs[col - 1],
    y: ys[row - 1],
    w: span(layout.cols, col - 1, cols),
    h: span(layout.rows, row - 1, rows),
  }));
}

/** اتصال‌های هر قطعه، تفکیک‌شده بر اساسِ لبه. */
export function connectionsOf(layout) {
  const map = layout.pieces.map(() => ({}));
  for (const link of layout.links) {
    const [tabPiece, tabSide] = link.tab;
    const [socketPiece, socketSide] = link.socket;
    (map[tabPiece][tabSide] ||= []).push({ kind: "tab", at: link.at });
    (map[socketPiece][socketSide] ||= []).push({ kind: "socket", at: link.at });
  }
  return map;
}

function shapesOf(layout, prefix) {
  const connections = connectionsOf(layout);
  return rectsOf(layout).map((rect, i) => ({
    id: `${prefix}${i}`,
    d: piecePath(rect, connections[i]),
    // فقط سوکت‌ها داخلِ بدنه‌ی کارت فرو می‌روند، پس فقط آن‌ها به پدینگِ
    // اضافه نیاز دارند تا عنوان و برچسب هرگز روی اتصال نیفتند.
    socketSides: Object.fromEntries(
      SIDES.map((side) => [side, (connections[i][side] || []).some((c) => c.kind === "socket")]),
    ),
  }));
}

export const CLIP_PATHS = [
  ...shapesOf(LAYOUTS.tablet, "fa-t"),
  ...shapesOf(LAYOUTS.desktop, "fa-d"),
];

// ── CSS تولیدشده ──────────────────────────────────────────────────────────
// یک DOM و سه چیدمان: موبایل (بدون پازل)، تبلت و دسکتاپ.

const CONTENT_PAD = 16;
// عمقِ سوکت وقتی container از عرضِ فضای طراحی بزرگ‌تر می‌شود (بازه‌ی 2xl،
// حداکثر ~۱٫۲۳ برابر) تا ~۳۲ پیکسل می‌رسد؛ ۴۰ پیکسل حاشیه‌ی امن است.
const SOCKET_PAD = 40;

/** ارتفاعِ ردیف‌ها در یک بازه، به پیکسل. */
export function bandRows(layout, band) {
  const scale = band.width / layoutSize(layout).w;
  return layout.rows.map((r) => Math.round(r * scale));
}

export const bandHeight = (rows) => rows.reduce((a, b) => a + b, 0) + GAP * (rows.length - 1);

function layoutCss(layout, prefix) {
  const shapes = shapesOf(layout, prefix);
  // گرید باید LTR بماند: مسیرهای clip فیزیکی‌اند، پس اگر ستون‌ها در RTL آینه
  // شوند تب‌ها به بیرون از ترکیب می‌افتند. متنِ داخلِ کارت‌ها RTL می‌ماند.
  // ستون‌ها fr هستند تا دقیقاً عرضِ container را پر کنند؛ ردیف‌ها پیکسلی‌اند
  // (پایین‌تر) تا ارتفاع همیشه صریح باشد.
  let css =
    `.fa-grid{direction:ltr;display:grid;gap:${GAP}px;` +
    `grid-template-columns:${layout.cols.map((c) => `${c}fr`).join(" ")}}` +
    `.fa-piece{position:relative;margin:-${BLEED}px;min-width:0;min-height:0;` +
    `aspect-ratio:auto;overflow:visible;border-radius:0}` +
    `.fa-body{inset:${BLEED}px;padding:${CONTENT_PAD}px}`;

  layout.pieces.forEach(([col, row, cols, rows], i) => {
    const { id, socketSides } = shapes[i];
    css +=
      `.fa-p${i}{grid-area:${row}/${col}/${row + rows}/${col + cols};` +
      `-webkit-clip-path:url(#${id});clip-path:url(#${id})}`;
    if (SIDES.some((side) => socketSides[side])) {
      const padding = SIDES.map((side) => `${socketSides[side] ? SOCKET_PAD : CONTENT_PAD}px`);
      css += `.fa-p${i} .fa-body{padding:${padding.join(" ")}}`;
    }
  });

  // ارتفاعِ صریح برای هر بازه. نه aspect-ratio، نه fr، نه درصد — پس اگر هر
  // یک از آن‌ها در محیطی اثر نکند، ترکیب باز هم جمع نمی‌شود.
  const rows = layout.bands.map((band) => {
    const track = bandRows(layout, band);
    return (
      `@media (min-width:${band.min}px){.fa-grid{` +
      `grid-template-rows:${track.map((r) => `${r}px`).join(" ")};` +
      `min-height:${bandHeight(track)}px}}`
    );
  });

  return `@media (min-width:${layout.min}px){${css}}${rows.join("")}`;
}

const MOBILE_CSS =
  `.fa-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:${GAP}px}` +
  `.fa-piece{position:relative;display:block;overflow:hidden;border-radius:${CORNER}px;` +
  `background-color:#111827;aspect-ratio:4/5;outline:none}` +
  `.fa-p0,.fa-p7{grid-column:1/-1;aspect-ratio:16/10}` +
  `.fa-body{position:absolute;inset:0;direction:rtl;display:flex;flex-direction:column;` +
  `align-items:flex-start;justify-content:flex-end;padding:14px;border-radius:${CORNER}px;` +
  `transition:box-shadow .2s ease}` +
  `.fa-piece:focus-visible .fa-body{box-shadow:inset 0 0 0 3px var(--color-primary),` +
  `inset 0 0 0 6px rgba(255,255,255,.9)}`;

// مرورگرهایی که clip-path ارجاعی را پشتیبانی نمی‌کنند به همان چیدمانِ
// دو ستونیِ موبایل برمی‌گردند (بدون هم‌پوشانی و بدون شکلِ خراب).
const FALLBACK_CSS =
  `@supports not (clip-path:url(#fa-d0)){` +
  `.fa-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:auto;` +
  `gap:${GAP}px;aspect-ratio:auto;min-height:0}` +
  `.fa-piece{grid-area:auto;margin:0;overflow:hidden;border-radius:${CORNER}px;aspect-ratio:4/5;` +
  `clip-path:none;-webkit-clip-path:none}` +
  `.fa-p0,.fa-p7{grid-column:1/-1;aspect-ratio:16/10}` +
  `.fa-piece .fa-body{inset:0;padding:14px}}`;

export const PUZZLE_CSS =
  MOBILE_CSS + layoutCss(LAYOUTS.tablet, "fa-t") + layoutCss(LAYOUTS.desktop, "fa-d") + FALLBACK_CSS;

// sizes واقعیِ هر قطعه تا next/image بزرگ‌تر از نیاز دانلود نکند.
const share = (layout, rect) =>
  Math.ceil(((rect.w + 2 * BLEED) / layoutSize(layout).w) * layout.viewportShare);

export const PIECE_SIZES = rectsOf(LAYOUTS.desktop).map((rect, i) => {
  const mobile = i === 0 || i === PIECE_COUNT - 1 ? "100vw" : "50vw";
  return (
    `(max-width:${LAYOUTS.tablet.min - 1}px) ${mobile}, ` +
    `(max-width:${LAYOUTS.desktop.min - 1}px) ${share(LAYOUTS.tablet, rectsOf(LAYOUTS.tablet)[i])}vw, ` +
    `${share(LAYOUTS.desktop, rect)}vw`
  );
});
