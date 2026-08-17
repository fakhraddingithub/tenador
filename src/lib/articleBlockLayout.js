/**
 * چیدمانِ کنارِ‌هم قرارگرفتنِ بلوک‌ها.
 *
 * هیچ «سطر»ی در داده ذخیره نمی‌شود؛ فقط هر بلوک عرضِ خودش را دارد و سطرها هنگامِ
 * رندر دوباره ساخته می‌شوند. برای همین جابه‌جایی، تکثیر و حذفِ بلوک هرگز نمی‌تواند
 * ساختار را خراب کند. نبودِ layout یعنی تمام‌عرض — دقیقاً رفتارِ مقاله‌های قبلی.
 *
 * این ماژول عمداً هیچ وابستگی‌ای ندارد تا هم رندرِ عمومی و هم تست بتوانند
 * مستقیم واردش کنند (mongoose نباید به کامپوننت راه پیدا کند).
 */

/** پایه‌ی ۶ ستونی: نصف/یک‌سوم/دوسوم هر سه دقیق در می‌آیند. */
export const BLOCK_WIDTH_SPANS = { "1/2": 3, "1/3": 2, "2/3": 4 };

export const BLOCK_WIDTHS = ["full", ...Object.keys(BLOCK_WIDTH_SPANS)];

/** کلاسِ ستونیِ هر عرض. رشته‌ها باید عینی باشند تا تیلویند آن‌ها را بسازد. */
export const BLOCK_WIDTH_CLASS = {
  "1/2": "md:col-span-3",
  "1/3": "md:col-span-2",
  "2/3": "md:col-span-4",
};

export function sanitizeArticleBlockLayout(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  // "full" پیش‌فرض است و ذخیره نمی‌شود تا بلوکِ بدونِ چیدمان واقعاً بدونِ کلید بماند.
  return BLOCK_WIDTH_SPANS[value.width] ? { width: value.width } : undefined;
}

/** عرضِ مؤثرِ یک بلوک؛ هر چیزِ ناشناخته تمام‌عرض حساب می‌شود. */
export function blockWidth(block) {
  const width = block?.layout?.width;
  return BLOCK_WIDTH_SPANS[width] ? width : "full";
}

/**
 * بلوک‌های اندازه‌دارِ پشتِ‌سرِ‌هم را در یک گروه جمع می‌کند؛ بلوکِ تمام‌عرض همیشه
 * گروه را می‌بندد و خودش تنها می‌ماند.
 *
 * گروهی که بیش از ۶ ستون شود را نمی‌شکنیم — خودِ CSS Grid به سطرِ بعد می‌برد.
 */
export function groupBlockRows(items = [], getWidth = blockWidth) {
  const rows = [];
  for (const item of items) {
    if (getWidth(item) === "full") {
      rows.push({ sized: false, blocks: [item] });
      continue;
    }
    const last = rows[rows.length - 1];
    if (last && last.sized) last.blocks.push(item);
    else rows.push({ sized: true, blocks: [item] });
  }
  return rows;
}
