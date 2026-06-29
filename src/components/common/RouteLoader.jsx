/**
 * src/components/common/RouteLoader.jsx
 *
 * اسپینر دایره‌ای ساده و مرکزی برای loading.js سطح-روت (App Router).
 * هنگام ناوبری بلافاصله به‌عنوان fallback مرز Suspense نمایش داده می‌شود تا
 * انتقال صفحه آنی حس شود و تا آماده‌شدن کاملِ صفحه روی صفحه بماند.
 *
 * استایل اسپینر عیناً مطابق AdminLoader است تا در کل اپلیکیشن یکدست بماند.
 */
export default function RouteLoader() {
  return (
    <div
      className="flex items-center justify-center min-h-[100vh] w-full"
      role="status"
      aria-label="در حال بارگذاری"
    >
      <div className="w-12 h-12 border-4 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin" />
    </div>
  );
}
