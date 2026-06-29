import RouteLoader from "@/components/common/RouteLoader";

// loading.js سطح-روت برای فروشگاه — Next.js این را به‌صورت خودکار به‌عنوان
// fallbackِ Suspense هنگام ناوبری به هر صفحه‌ی این گروه نمایش می‌دهد.
// لِی‌اوت (نوار بالا/فوتر) پایدار می‌ماند و فقط ناحیه‌ی محتوا اسپینر نشان می‌دهد.
export default function Loading() {
  return <RouteLoader />;
}
