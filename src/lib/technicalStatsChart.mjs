/**
 * آیا نمودار رادارِ صفحه‌ی محصول چیزی برای نشان دادن دارد؟
 *
 * دقیقاً همان‌طور می‌خواند که ProductComparisonGraph می‌خواند: فقط شاخص‌هایی
 * که روی دسته تعریف شده‌اند، با کلیدِ stat.name. پس اگر این تابع «نه» بگوید،
 * نمودار واقعاً خالی (همه صفر) رسم می‌شد.
 *
 * @param {{ productStats?: object, categoryStats?: Array<{name: string}> }} technicalStats
 */
export function hasChartableStats(technicalStats) {
  const productStats = technicalStats?.productStats || {};
  const categoryStats = technicalStats?.categoryStats || [];
  return categoryStats.some((stat) => {
    const value = Number(productStats[stat?.name] ?? 0);
    return Number.isFinite(value) && value !== 0;
  });
}
