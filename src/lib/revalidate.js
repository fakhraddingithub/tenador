import { revalidateTag } from "next/cache";

/**
 * تمام تگ‌های محتوایی کش‌شده را باطل می‌کند.
 * چون عملیات ادمین کم‌تکرار است، باطل‌سازی گسترده امن‌تر از باطل‌سازی ناقص است
 * (هیچ‌وقت داده‌ی قدیمی به کاربر نشان داده نمی‌شود).
 *
 * این تابع را پس از هر mutation (ساخت/ویرایش/حذف) روی محتوای عمومی صدا بزنید.
 */
const CONTENT_TAGS = [
  "products",
  "navbar",
  "banners",
  "athletes",
  "sports",
  "categories",
  "brands",
  "series",
  "limited-editions",
  "events",
];

export function revalidateContent(tags = CONTENT_TAGS) {
  for (const tag of tags) {
    try {
      revalidateTag(tag);
    } catch {
      // در محیط‌هایی که revalidateTag در دسترس نیست بی‌صدا رد شو
    }
  }
}
