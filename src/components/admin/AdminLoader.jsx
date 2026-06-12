/**
 * src/components/admin/AdminLoader.jsx
 *
 * لودر یکپارچه پنل ادمین — همه صفحات ادمین هنگام بارگذاری فقط همین
 * اسپینر دایره‌ای را نمایش می‌دهند (بدون هیچ متن سفارشی).
 */

export default function AdminLoader({ fullScreen = false }) {
  return (
    <div
      className={`flex items-center justify-center ${
        fullScreen ? "min-h-screen" : "min-h-[50vh] py-20"
      }`}
    >
      <div className="w-12 h-12 border-4 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin" />
    </div>
  );
}
