import RouteLoader from "@/components/common/RouteLoader";

// loading.js صفحه‌ی ورزش (و به‌عنوان مرزِ والد برای صفحات برند/سری ریشه‌ی هم‌سطح)
// — هنگام ناوبری بلافاصله لودرِ یکپارچه‌ی سایت را نشان می‌دهد.
export default function Loading() {
  return <RouteLoader />;
}
