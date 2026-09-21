/**
 * فاصله‌ی بینِ فرزندانِ بلوکِ ادغام‌شده حالا تنظیم‌شدنی است و **پیش‌فرضش صفر**.
 *
 * پیش از این، فاصله در خودِ رندر ثابت بود: ۱rem در موبایل و ۱.۵rem در دسکتاپ.
 * این مهاجرت همان دو عدد را روی محتوای موجود صریح می‌کند تا هیچ بلوکی جابه‌جا
 * نشود؛ از این به بعد هر بلوکِ تازه با فاصله‌ی صفر ساخته می‌شود.
 */
export const LEGACY_MERGED_GAP = { desktop: 1.5, mobile: 1 };

/** آیا این breakpoint هنوز فاصله‌ی صریح ندارد؟ */
const needsGap = (settings) => Boolean(settings) && typeof settings === "object" && settings.gap === undefined;

/**
 * بلوک‌ها را (با فرزندانِ ادغام‌شده، در هر عمقی) در جا به‌روز می‌کند و تعدادِ
 * بلوک‌های ادغام‌شده‌ی تغییرکرده را برمی‌گرداند. idempotent است.
 *
 * بلوکِ ادغام‌شده‌ی *بدونِ* grid دست‌نخورده می‌ماند: آن مسیرِ رندرِ قدیمی است و
 * تنظیمی برای فاصله ندارد؛ ساختنِ grid برایش یعنی عوض کردنِ کلِ چیدمانش.
 */
export function pinMergedGap(blocks) {
  let changed = 0;
  for (const block of Array.isArray(blocks) ? blocks : []) {
    if (block?.type === "merged") {
      const grid = block.data?.grid;
      if (grid && typeof grid === "object" && (needsGap(grid.desktop) || needsGap(grid.mobile))) {
        for (const breakpoint of ["desktop", "mobile"]) {
          if (needsGap(grid[breakpoint])) grid[breakpoint].gap = LEGACY_MERGED_GAP[breakpoint];
        }
        changed += 1;
      }
      changed += pinMergedGap(block.data?.blocks);
    }
  }
  return changed;
}
