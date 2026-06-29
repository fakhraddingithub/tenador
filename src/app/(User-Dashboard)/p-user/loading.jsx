import RouteLoader from "@/components/common/RouteLoader";

// loading.js سطح-روت برای داشبورد کاربر — هنگام ناوبری به هر صفحه‌ی p-user
// به‌صورت خودکار نمایش داده می‌شود؛ سایدبار/هدر داشبورد پایدار می‌ماند.
export default function Loading() {
  return <RouteLoader />;
}
