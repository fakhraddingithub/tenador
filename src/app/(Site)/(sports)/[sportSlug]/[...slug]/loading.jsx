import RouteLoader from "@/components/common/RouteLoader";

// loading.js مسیرِ پویای زیرِ ورزش — این مسیر صفحات «دسته‌بندی»، «برند» و «سری»
// را سرو می‌کند؛ پس همان لودرِ یکپارچه هنگام ناوبری به همه‌ی این‌ها نمایش می‌یابد.
export default function Loading() {
  return <RouteLoader />;
}
