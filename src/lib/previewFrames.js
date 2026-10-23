/**
 * ظرفِ هر نوع سند در پیش‌نمایش — عیناً همان کلاس‌هایی که صفحه‌ی عمومی دورِ همان
 * بلوک‌ها می‌گذارد، تا بلوک در پیش‌نمایش همان عرضی را بگیرد که روی سایت می‌گیرد.
 *
 * page: زمینه‌ی تمام‌عرضِ بوم (بوم خودش تا لبه‌ی سایدبار و پنجره می‌رود).
 * column: ظرفِ محتوا داخلِ آن.
 *
 * اگر ظرفِ یکی از صفحه‌های عمومی عوض شد، این‌جا هم باید عوض شود:
 *   article    → ستونِ بدنه در PublicArticlePage.jsx (۸۲۰ پیکسل، px-5 md:px-10)
 *   brochure   → BrandBrochure.jsx
 *   miniArticle → BrandMiniArticleSection.jsx
 */
export const PREVIEW_FRAMES = {
  article: {
    page: "bg-[var(--color-background)] px-4 py-10",
    column: "mx-auto max-w-[820px] min-w-0 rounded-[var(--radius)] bg-white px-5 py-3 md:px-10",
  },
  brochure: {
    page: "bg-white",
    column: "mx-auto w-full max-w-[1440px] px-4 py-4 md:py-8 lg:px-8",
  },
  miniArticle: {
    page: "bg-white",
    column: "mx-auto w-full max-w-[1440px] px-4 py-3 md:py-5 lg:px-8",
  },
};
