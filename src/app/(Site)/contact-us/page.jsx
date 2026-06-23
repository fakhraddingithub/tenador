import { redirect } from "next/navigation";

// مسیر متعارف صفحه‌ی «تماس با ما» اکنون /contact است (مطابق لینک‌های فوتر).
export default function ContactUsRedirect() {
  redirect("/contact");
}
