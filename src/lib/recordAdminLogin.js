/**
 * src/lib/recordAdminLogin.js
 *
 * ثبتِ «آخرین ورود» روی عضویتِ ادمین.
 *
 * فیلدِ `Admin.lastLoginAt` از همان ابتدا در اسکیما بود ولی هیچ‌جا نوشته
 * نمی‌شد. مکانیزمِ دومی ساخته نشده: همان فیلد پر می‌شود.
 *
 * ── چرا اینجا و نه در دفترِ فعالیت ───────────────────────────────────────
 * «آخرین ورود» یک *وضعیت* است، نه یک رویداد؛ خواندنش باید یک فیلدِ ساده
 * باشد، نه یک aggregate روی دفتر. دفتر برای «چه کرد» است، این برای «کی
 * آمد».
 *
 * ── قواعد ────────────────────────────────────────────────────────────────
 * • فقط برای کاربری که عضویتِ ادمینِ فعال دارد؛ برای بقیه کوئری هیچ سندی
 *   پیدا نمی‌کند و بی‌اثر است.
 * • هرگز throw نمی‌کند: شکستِ این نوشتن نباید ورود را خراب کند.
 * • در زمانِ ورود هیچ دامنه‌ی ممیزی‌ای باز نیست، پس پلاگینِ ممیزی این
 *   بروزرسانی را ثبت نمی‌کند — که درست است، این کارِ ادمین روی داده نیست.
 */

import Admin from "base/models/Admin";

export default async function recordAdminLogin(userId) {
  try {
    if (!userId) return false;
    const result = await Admin.updateOne(
      { user: userId, isActive: true },
      { $set: { lastLoginAt: new Date() } }
    );
    return result.modifiedCount > 0;
  } catch (error) {
    console.error("[recordAdminLogin]", error?.message || error);
    return false;
  }
}
