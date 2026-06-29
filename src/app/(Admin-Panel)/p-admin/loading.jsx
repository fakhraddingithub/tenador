import RouteLoader from "@/components/common/RouteLoader";

// loading.js سطح-روت برای پنل ادمین — هنگام ناوبری به هر صفحه‌ی p-admin
// به‌صورت خودکار نمایش داده می‌شود؛ سایدبار/هدر ادمین پایدار می‌ماند.
export default function Loading() {
  return <RouteLoader />;
}
