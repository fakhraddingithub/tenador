import { permanentRedirect } from "next/navigation";

// مسیر متعارف صفحه‌ی «درباره ما» اکنون /about است (مطابق لینک‌های فوتر).
export default function AboutUsRedirect() {
  permanentRedirect("/about");
}
