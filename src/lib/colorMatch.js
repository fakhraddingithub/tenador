/**
 * src/lib/colorMatch.js
 *
 * منطق مشترکِ تطبیقِ «رنگ» برای فیلترهای فروشگاه و انتخاب محصولِ کمپین.
 *
 * فروشگاه رنگ را به دو شکل ذخیره می‌کند:
 *  - متنِ فارسی روی product.attributes.Color (مثل «صورتی کالباسی»)
 *  - گاهی هگزِ روی product.color یا روی رنگِ واریانت‌ها
 *
 * به همین خاطر تطبیق «هیبریدی» است: ابتدا تطبیقِ متنی (نامِ سواچ/مترادف‌ها به
 * صورت substring در متنِ رنگ) و در صورت نبودِ متن، تطبیقِ ادراکی بر اساس HSL
 * (همان منطقِ hue-matchingِ ساخته‌شده برای کمپین) روی مقادیرِ هگز.
 *
 * این فایل کاملاً خالص (بدون وابستگی به Node) است تا هم سمت کلاینت و هم سمت
 * سرور قابل import باشد.
 */

// ─── پالتِ ثابتِ ۱۶ رنگ (۴×۴) ─────────────────────────────────────────────────
// چرخش رنگ + خنثی‌ها (مشکی/خاکستری/سفید) + بژ و طلایی. هر سواچ یک هگز برای
// نمایش/تطبیقِ ادراکی و فهرستی از مترادف‌های فارسی/انگلیسی برای تطبیقِ متنی دارد.
export const COLOR_PALETTE = [
  { name: "قرمز", hex: "#e53935", aliases: ["قرمز", "سرخ", "red"] },
  { name: "صورتی", hex: "#ec407a", aliases: ["صورتی", "رز", "pink"] },
  { name: "نارنجی", hex: "#fb8c00", aliases: ["نارنجی", "پرتقالی", "orange"] },
  { name: "زرد", hex: "#fdd835", aliases: ["زرد", "yellow"] },
  { name: "لیمویی", hex: "#c0ca33", aliases: ["لیمویی", "لیمو", "فسفری", "lime"] },
  { name: "سبز", hex: "#43a047", aliases: ["سبز", "green"] },
  { name: "فیروزه‌ای", hex: "#00897b", aliases: ["فیروزه", "سبزآبی", "teal", "turquoise"] },
  { name: "آبی", hex: "#1e88e5", aliases: ["آبی", "blue"] },
  { name: "سرمه‌ای", hex: "#283593", aliases: ["سرمه", "نیلی", "navy"] },
  { name: "بنفش", hex: "#8e24aa", aliases: ["بنفش", "ارغوانی", "یاسی", "purple"] },
  { name: "قهوه‌ای", hex: "#6d4c41", aliases: ["قهوه", "brown"] },
  { name: "بژ", hex: "#d7ccc8", aliases: ["بژ", "کرم", "نخودی", "beige", "cream"] },
  { name: "طلایی", hex: "#c9a227", aliases: ["طلایی", "طلا", "gold"] },
  { name: "مشکی", hex: "#1a1a1a", aliases: ["مشکی", "سیاه", "black"] },
  { name: "خاکستری", hex: "#9e9e9e", aliases: ["خاکستری", "طوسی", "نقره", "grey", "gray", "silver"] },
  { name: "سفید", hex: "#ffffff", aliases: ["سفید", "white"] },
];

const PALETTE_BY_NAME = new Map(COLOR_PALETTE.map((c) => [c.name, c]));

/** سواچ را بر اساس نامِ فارسی برمی‌گرداند (یا undefined). */
export function getSwatchByName(name) {
  return PALETTE_BY_NAME.get(String(name || "").trim());
}

/** آیا این ویژگی همان ویژگیِ «رنگ» است؟ (Color / colour / رنگ) */
export function isColorAttribute(name) {
  return /^(colou?r|رنگ)$/i.test(String(name || "").trim());
}

// ─── HSL helpers (مهاجرت از eventProductResolver برای استفادهٔ مشترک) ──────────

/** "#abc" / "abc" / "#aabbcc" / "AABBCC" → "#aabbcc" کوچک، وگرنه null. */
export function normalizeHex(hex) {
  if (typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return "#" + h.toLowerCase();
}

/** hex → { h: 0–360, s: 0–100, l: 0–100 } یا null. */
export function hexToHsl(hex) {
  const norm = normalizeHex(hex);
  if (!norm) return null;
  const r = parseInt(norm.slice(1, 3), 16) / 255;
  const g = parseInt(norm.slice(3, 5), 16) / 255;
  const b = parseInt(norm.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = (((g - b) / d) % 6 + 6) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

/** کوتاه‌ترین فاصله بین دو hue روی چرخِ ۳۶۰° (قرمز در ۰↔۳۶۰ می‌پیچد). */
export function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

const HUE_TOLERANCE = 30; // همان آستانهٔ کمپین

/**
 * آیا یک مقدارِ هگز با سواچ تطبیق دارد؟ خنثی‌ها (مشکی/سفید/خاکستری/سواچ‌های
 * کم‌اشباع) بر اساس روشنایی/اشباع تطبیق می‌خورند؛ بقیه بر اساس hue با حداقلِ
 * اشباع روی محصول (تا خاکستری‌ها به‌اشتباه با رنگ‌های واضح یکی نشوند).
 */
export function swatchMatchesHex(swatch, hex) {
  const p = hexToHsl(hex);
  if (!p || !swatch) return false;
  const t = hexToHsl(swatch.hex);
  if (!t) return false;

  const neutralTarget = t.s < 15;
  if (neutralTarget) {
    if (p.s > 22) return false; // محصولِ رنگی با سواچِ خنثی تطبیق نمی‌خورد
    if (swatch.name === "مشکی") return p.l <= 28;
    if (swatch.name === "سفید") return p.l >= 80;
    return p.l > 28 && p.l < 80; // خاکستری/بژِ کم‌اشباع
  }

  if (p.s < 18) return false; // محصولِ بی‌رنگ با سواچِ رنگی تطبیق نمی‌خورد
  return hueDistance(p.h, t.h) <= HUE_TOLERANCE;
}

// ─── خواندنِ مقادیرِ رنگ از روی یک محصول ───────────────────────────────────────

/** کلیدِ رنگ را از یک object یا Mongoose Map می‌خواند. */
function readColorVal(obj) {
  if (!obj) return undefined;
  const get = (k) => (obj instanceof Map ? obj.get(k) : obj[k]);
  return get("Color") ?? get("color") ?? get("colour") ?? get("رنگ");
}

/** همهٔ منابعِ رنگِ یک محصول را به صورت [{ text، hex }] جمع می‌کند. */
function collectColorValues(product) {
  if (!product) return [];
  const out = [];
  const push = (v) => {
    if (v == null) return;
    const s = String(v).trim();
    if (!s) return;
    out.push({ text: s, hex: normalizeHex(s) });
  };

  push(readColorVal(product.attributes));
  push(product.color);

  const variants = Array.isArray(product.variants) ? product.variants : [];
  for (const v of variants) {
    if (!v || typeof v !== "object") continue;
    push(readColorVal(v.variantAttributes));
    push(readColorVal(v.attributes));
    push(v.color);
  }
  return out;
}

/**
 * تطبیقِ هیبریدیِ یک محصول با یک سواچ:
 *  ۱) متنی — نام/مترادف‌های سواچ به‌صورت substring در متنِ رنگ
 *  ۲) ادراکی — هر مقدارِ هگزِ محصول در محدودهٔ hue سواچ
 */
export function productColorMatchesSwatch(product, swatch) {
  if (!swatch) return false;
  const values = collectColorValues(product);
  if (values.length === 0) return false;

  const aliases = swatch.aliases.map((a) => a.toLowerCase());
  for (const { text } of values) {
    const lc = text.toLowerCase();
    if (aliases.some((a) => lc.includes(a))) return true;
  }
  for (const { hex } of values) {
    if (hex && swatchMatchesHex(swatch, hex)) return true;
  }
  return false;
}
