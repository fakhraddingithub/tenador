// هندسه‌ی «پازل مقالات منتخب» — یک سیلوئتِ پیوسته برای هر قطعه.
//
// هر اتصال یک جفتِ کاملاً مکمل است. «سوکت» دقیقاً همان «تب» است که به اندازه‌ی
// GAP به بیرون آفست شده باشد؛ یعنی فاصله‌ی ۱۶ پیکسلی در تمامِ طولِ اتصال ثابت
// می‌ماند و لبه‌ها هیچ‌جا به هم نمی‌چسبند یا هم‌پوشانی نمی‌کنند:
//
//   تب   : کمانِ محدب به شعاع TAB روی خطِ لبه + دو فیلتِ مقعر به شعاع FILLET
//   سوکت : کمانِ مقعر به شعاع TAB+GAP با همان مرکز + دو فیلتِ محدب به شعاع FILLET-GAP
//
// مرکزِ فیلت‌ها در هر دو یکی است (فاصله‌ی FILLET از خطِ لبه‌ی تب)، بنابراین نقاطِ
// شروع و پایانِ اتصال روی هر دو قطعه دقیقاً روبه‌روی هم می‌افتند: مرکزِ اتصال
// ± HALF_SPAN. هیچ عددی دستی تنظیم نشده — همه از همین چند ثابت مشتق می‌شوند.

export const GAP = 16; // فاصله‌ی پایه (هم‌ارزِ gap-4 تیلویند)
export const CORNER = 6; // شعاع گوشه‌های بیرونیِ کارت
export const TAB = 24; // بیرون‌زدگیِ تب / عمقِ سوکت
export const FILLET = 22; // شعاع فیلتِ پای تب — باید بزرگ‌تر از GAP باشد
export const BLEED = TAB; // بزرگ‌ترشدنِ جعبه‌ی هر قطعه تا تب داخلش جا شود

const SOCKET_ARC = TAB + GAP;
const SOCKET_FILLET = FILLET - GAP;

// نصفِ دهانه‌ی اتصال: فاصله‌ی نقطه‌ی مماسِ فیلت با خطِ لبه تا مرکزِ اتصال.
export const HALF_SPAN = Math.sqrt(TAB * TAB + 2 * TAB * FILLET);

// t: جهتِ حرکت روی لبه (مسیر ساعتگرد)، n: نرمالِ بیرونی
const EDGES = {
  top: { t: [1, 0], n: [0, -1] },
  right: { t: [0, 1], n: [1, 0] },
  bottom: { t: [-1, 0], n: [0, 1] },
  left: { t: [0, -1], n: [-1, 0] },
};
export const SIDES = ["top", "right", "bottom", "left"];

export const OPPOSITE = { top: "bottom", bottom: "top", left: "right", right: "left" };

const mix = (p, v1, k1, v2, k2) => [
  p[0] + v1[0] * k1 + (v2 ? v2[0] * k2 : 0),
  p[1] + v1[1] * k1 + (v2 ? v2[1] * k2 : 0),
];

// مختصاتِ خطِ لبه: برای لبه‌های چپ/راست یک X ثابت و برای بالا/پایین یک Y ثابت.
export function edgeLine({ x, y, w, h }, side) {
  if (side === "top") return y;
  if (side === "bottom") return y + h;
  if (side === "left") return x;
  return x + w;
}

// بازه‌ی مجازِ اتصال روی هر لبه (بدونِ گوشه‌های گرد).
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

const pointAt = (piece, side) =>
  side === "top" || side === "bottom"
    ? (a) => [a, edgeLine(piece, side)]
    : (a) => [edgeLine(piece, side), a];

/**
 * مسیرِ بسته‌ی سیلوئتِ یک قطعه، نرمال‌شده در فضای objectBoundingBox (۰ تا ۱)
 * تا با هر اندازه‌ای از کارت مقیاس بگیرد. کمان‌ها به‌صورتِ بیضویِ جبران‌شده
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
  const arc = (radius, sweep, p) =>
    out.push(`A${round(radius / ew)} ${round(radius / eh)} 0 0 ${sweep} ${pt(p)}`);

  SIDES.forEach((side, i) => {
    const { t, n } = EDGES[side];
    const at = pointAt(piece, side);
    const dir = t[0] + t[1]; // ‎+۱ روی لبه‌های بالا/راست، ‎−۱ روی پایین/چپ
    const list = [...(connections[side] || [])].sort((a, b) => (a.at - b.at) * dir);

    for (const link of list) {
      const centre = at(link.at);
      line(at(link.at - HALF_SPAN * dir));
      if (link.kind === "tab") {
        const k = TAB / (TAB + FILLET);
        arc(FILLET, 0, mix(centre, t, -HALF_SPAN * k, n, FILLET * k));
        arc(TAB, 1, mix(centre, t, HALF_SPAN * k, n, FILLET * k));
        arc(FILLET, 0, at(link.at + HALF_SPAN * dir));
      } else {
        const k = SOCKET_ARC / (TAB + FILLET);
        const c = mix(centre, n, GAP); // مرکزِ کمانِ سوکت = مرکزِ کمانِ تبِ روبه‌رو
        arc(SOCKET_FILLET, 1, mix(c, t, -HALF_SPAN * k, n, -FILLET * k));
        arc(SOCKET_ARC, 0, mix(c, t, HALF_SPAN * k, n, -FILLET * k));
        arc(SOCKET_FILLET, 1, at(link.at + HALF_SPAN * dir));
      }
    }

    line(edgeEnd(piece, side));
    arc(CORNER, 1, edgeStart(piece, SIDES[(i + 1) % 4]));
  });

  out.push("Z");
  return out.join("");
}

// ── چیدمان‌ها ─────────────────────────────────────────────────────────────
// ترتیبِ قطعه‌ها = ترتیبِ ذخیره‌شده‌ی مقالات در پنل ادمین (۰ تا ۷).
// links: هر اتصال یک بار تعریف می‌شود؛ tab و socket روی مختصاتِ مطلقِ `at`
// می‌نشینند، پس هم‌ترازیِ دقیق ذاتیِ ساختار است و قابلِ خطا نیست.

export const LAYOUTS = {
  // تبلت — ترکیبِ ساده‌ترِ همان زبانِ بصری.
  // عرضِ فضای طراحی برابرِ عرضِ واقعیِ container در همین بازه است
  // (۷۶۸ ← container و px-12 ⇒ ۶۷۲)، پس مقیاس دقیقاً ۱ است و فاصله‌ی
  // ۱۶ پیکسلی و شعاعِ ۶ پیکسلی عیناً روی صفحه رندر می‌شوند.
  tablet: {
    min: 768,
    viewportShare: 88,
    w: 672,
    h: 692,
    pieces: [
      { x: 0, y: 0, w: 328, h: 300 },
      { x: 344, y: 0, w: 328, h: 142 },
      { x: 344, y: 158, w: 328, h: 142 },
      { x: 0, y: 316, w: 213, h: 180 },
      { x: 229, y: 316, w: 213, h: 180 },
      { x: 458, y: 316, w: 214, h: 180 },
      { x: 0, y: 512, w: 328, h: 180 },
      { x: 344, y: 512, w: 328, h: 180 },
    ],
    links: [
      { tab: [0, "right"], socket: [1, "left"], at: 71 },
      { tab: [2, "left"], socket: [0, "right"], at: 229 },
      { tab: [0, "bottom"], socket: [3, "top"], at: 106 },
      { tab: [2, "bottom"], socket: [5, "top"], at: 565 },
      { tab: [3, "right"], socket: [4, "left"], at: 406 },
      { tab: [5, "left"], socket: [4, "right"], at: 406 },
      { tab: [3, "bottom"], socket: [6, "top"], at: 106 },
      { tab: [5, "bottom"], socket: [7, "top"], at: 565 },
      { tab: [6, "right"], socket: [7, "left"], at: 602 },
    ],
  },

  // دسکتاپ — یک ستونِ بلندِ عمودی، دو قطعه‌ی افقیِ میانی، یک قطعه‌ی شاخص و
  // چهار قطعه‌ی کوچک‌ترِ پایینی. عرضِ فضای طراحی = عرضِ واقعیِ container در
  // بازه‌ی xl (۱۲۸۰ ← container و px-20 ⇒ ۱۱۲۰) تا مقیاس دقیقاً ۱ باشد.
  desktop: {
    min: 1024,
    viewportShare: 78,
    w: 1120,
    h: 636,
    pieces: [
      { x: 0, y: 0, w: 244, h: 392 }, // ستونِ بلندِ چپ
      { x: 260, y: 0, w: 414, h: 188 }, // افقیِ میانیِ بالا
      { x: 260, y: 204, w: 414, h: 188 }, // افقیِ میانیِ پایین
      { x: 690, y: 0, w: 430, h: 392 }, // قطعه‌ی شاخص
      { x: 0, y: 408, w: 244, h: 228 },
      { x: 260, y: 408, w: 199, h: 228 },
      { x: 475, y: 408, w: 199, h: 228 },
      { x: 690, y: 408, w: 430, h: 228 },
    ],
    links: [
      { tab: [0, "right"], socket: [1, "left"], at: 94 },
      { tab: [2, "left"], socket: [0, "right"], at: 298 },
      { tab: [1, "right"], socket: [3, "left"], at: 94 },
      { tab: [3, "left"], socket: [2, "right"], at: 298 },
      { tab: [0, "bottom"], socket: [4, "top"], at: 122 },
      { tab: [2, "bottom"], socket: [5, "top"], at: 360 },
      { tab: [2, "bottom"], socket: [6, "top"], at: 574 },
      { tab: [3, "bottom"], socket: [7, "top"], at: 905 },
      { tab: [4, "right"], socket: [5, "left"], at: 522 },
      { tab: [6, "right"], socket: [7, "left"], at: 522 },
    ],
  },
};

export const PIECE_COUNT = LAYOUTS.desktop.pieces.length;

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
  return layout.pieces.map((piece, i) => ({
    id: `${prefix}${i}`,
    d: piecePath(piece, connections[i]),
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
// یک DOM و سه چیدمان: موبایل (بدون پازل)، تبلت و دسکتاپ. چون همه‌چیز از روی
// همین چیدمان‌ها ساخته می‌شود، هیچ عددی در دو جا تکرار نمی‌شود.

const pct = (v) => `${Math.round(v * 1e6) / 1e4}%`;
const CONTENT_PAD = 16;
// عمقِ سوکت وقتی container از عرضِ فضای طراحی بزرگ‌تر می‌شود (بازه‌ی 2xl،
// حداکثر ۱٫۲۳ برابر) تا ~۳۰ پیکسل می‌رسد؛ ۳۲ پیکسل تضمین می‌کند عنوان و
// برچسب در هیچ عرضی روی اتصال نیفتند.
const SOCKET_PAD = 32;

function layoutCss(layout, prefix) {
  const shapes = shapesOf(layout, prefix);
  let css =
    `.fa-grid{display:block;position:relative;gap:0;aspect-ratio:${layout.w}/${layout.h}}` +
    `.fa-piece{position:absolute;grid-column:auto;aspect-ratio:auto;overflow:visible}`;

  layout.pieces.forEach((piece, i) => {
    const ew = piece.w + 2 * BLEED;
    const eh = piece.h + 2 * BLEED;
    const { id, socketSides } = shapes[i];
    const padding = SIDES.map((side) => `${socketSides[side] ? SOCKET_PAD : CONTENT_PAD}px`).join(" ");
    css +=
      `.fa-p${i}{left:${pct((piece.x - BLEED) / layout.w)};top:${pct((piece.y - BLEED) / layout.h)};` +
      `width:${pct(ew / layout.w)};height:${pct(eh / layout.h)};` +
      `-webkit-clip-path:url(#${id});clip-path:url(#${id})}` +
      `.fa-p${i} .fa-body{top:${pct(BLEED / eh)};right:${pct(BLEED / ew)};bottom:${pct(BLEED / eh)};` +
      `left:${pct(BLEED / ew)};padding:${padding}}`;
  });

  return `@media (min-width:${layout.min}px){${css}}`;
}

const MOBILE_CSS =
  `.fa-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:${GAP}px}` +
  `.fa-piece{position:relative;display:block;overflow:hidden;border-radius:${CORNER}px;` +
  `background-color:#111827;aspect-ratio:4/5;outline:none}` +
  `.fa-p0,.fa-p7{grid-column:1/-1;aspect-ratio:16/10}` +
  `.fa-body{position:absolute;inset:0;display:flex;flex-direction:column;align-items:flex-start;` +
  `justify-content:flex-end;padding:14px;border-radius:${CORNER}px;transition:box-shadow .2s ease}` +
  `.fa-piece:focus-visible .fa-body{box-shadow:inset 0 0 0 3px var(--color-primary),` +
  `inset 0 0 0 6px rgba(255,255,255,.9)}`;

// مرورگرهایی که clip-path ارجاعی را پشتیبانی نمی‌کنند به همان چیدمانِ
// دو ستونیِ موبایل برمی‌گردند (بدون هم‌پوشانی و بدون شکلِ خراب).
const FALLBACK_CSS =
  `@supports not (clip-path:url(#fa-d0)){` +
  `.fa-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:${GAP}px;aspect-ratio:auto}` +
  `.fa-piece{position:relative;left:auto;top:auto;width:auto;height:auto;overflow:hidden;` +
  `border-radius:${CORNER}px;aspect-ratio:4/5;clip-path:none;-webkit-clip-path:none}` +
  `.fa-p0,.fa-p7{grid-column:1/-1;aspect-ratio:16/10}` +
  `.fa-piece .fa-body{top:0;right:0;bottom:0;left:0;padding:14px}}`;

export const PUZZLE_CSS =
  MOBILE_CSS + layoutCss(LAYOUTS.tablet, "fa-t") + layoutCss(LAYOUTS.desktop, "fa-d") + FALLBACK_CSS;

// sizes واقعیِ هر قطعه تا next/image بزرگ‌تر از نیاز دانلود نکند.
const share = (layout, piece) =>
  Math.ceil(((piece.w + 2 * BLEED) / layout.w) * layout.viewportShare);

export const PIECE_SIZES = LAYOUTS.desktop.pieces.map((piece, i) => {
  const mobile = i === 0 || i === PIECE_COUNT - 1 ? "100vw" : "50vw";
  return (
    `(max-width:${LAYOUTS.tablet.min - 1}px) ${mobile}, ` +
    `(max-width:${LAYOUTS.desktop.min - 1}px) ${share(LAYOUTS.tablet, LAYOUTS.tablet.pieces[i])}vw, ` +
    `${share(LAYOUTS.desktop, piece)}vw`
  );
});
