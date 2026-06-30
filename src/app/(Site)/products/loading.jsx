import RouteLoader from "@/components/common/RouteLoader";

// loading.js اختصاصیِ صفحه‌ی لیست محصولات — هنگام ناوبری به این مسیر بلافاصله
// نمایش داده می‌شود (همان لودرِ یکپارچه‌ی سایت با لوگو + انیمیشن).
export default function Loading() {
  return <RouteLoader />;
}
