/**
 * src/lib/activityLabels.js
 *
 * برچسب‌های فارسیِ دفترِ فعالیت — تنها منبعِ نامِ خواندنیِ اقدام‌ها.
 *
 * چرا یک فایلِ جدا و نه ترجمه در کامپوننت: هم API (برای فیلترِ کشویی) و هم
 * جدولِ خطِ زمانی از همین نگاشت استفاده می‌کنند، و اقدامِ ناشناخته باید در هر
 * دو یکسان و بی‌سروصدا به شناسه‌ی خامش برگردد، نه اینکه خالی رندر شود.
 */

/** دسته‌بندیِ اقدام‌ها — همان گروه‌بندیِ بخش‌های پنل. */
export const ACTIVITY_CATEGORIES = {
  authz: "دسترسی",
  admins: "ادمین‌ها",
  users: "کاربران",
  orders: "سفارش‌ها",
  finance: "مالی",
  content: "محتوا",
};

/**
 * شناسه‌ی اقدام → { label, category }
 *
 * شناسه‌ها نقطه‌دار و پایدارند؛ برچسب‌ها می‌توانند عوض شوند بدون آنکه
 * رکوردهای قدیمی بی‌معنا شوند.
 */
export const ACTIVITY_ACTIONS = {
  "authz.denied": { label: "رد دسترسی", category: "authz" },
  "authz.granted": { label: "اقدامِ نوشتنیِ مجاز", category: "authz" },
  "authz.read": { label: "مشاهده‌ی داده‌ی حساس", category: "authz" },

  "admin.create": { label: "افزودن ادمین", category: "admins" },
  "admin.update": { label: "ویرایش ادمین", category: "admins" },
  "admin.permissions.change": { label: "تغییر دسترسی‌های ادمین", category: "admins" },
  "admin.activate": { label: "فعال‌سازی ادمین", category: "admins" },
  "admin.revoke": { label: "لغو دسترسی ادمین", category: "admins" },
  "role.create": { label: "ایجاد نقش", category: "admins" },
  "role.update": { label: "ویرایش نقش", category: "admins" },
  "role.delete": { label: "حذف نقش", category: "admins" },

  "user.profile.update": { label: "ویرایش پروفایل کاربر", category: "users" },
  "user.ban": { label: "مسدودسازی کاربر", category: "users" },
  "user.unban": { label: "رفع مسدودیت کاربر", category: "users" },
  "user.role.change": { label: "تغییر نقش کاربر", category: "users" },
  "user.wallet.adjust": { label: "تغییر موجودی کیف پول", category: "users" },

  "order.status.change": { label: "تغییر وضعیت سفارش", category: "orders" },
  "payment.approve": { label: "تأیید رسید پرداخت", category: "orders" },
  "payment.reject": { label: "رد رسید پرداخت", category: "orders" },
  "payment.edit": { label: "ویرایش مبلغ پرداخت", category: "orders" },

  "installment.check.update": { label: "بروزرسانی وضعیت چک", category: "finance" },
  "setting.update": { label: "تغییر تنظیمات سایت", category: "finance" },

  "article.publish": { label: "انتشار مقاله", category: "content" },
  "page.publish": { label: "انتشار صفحه", category: "content" },
};

/** برچسبِ نتیجه. */
export const ACTIVITY_RESULT_LABELS = {
  success: "موفق",
  failure: "ناموفق",
  denied: "رد شد",
  attempted: "مجاز شد",
};

/** برچسبِ خواندنیِ یک اقدام؛ ناشناخته → خودِ شناسه. */
export function activityLabel(action) {
  return ACTIVITY_ACTIONS[action]?.label || action || "—";
}

export function activityCategory(action) {
  const key = ACTIVITY_ACTIONS[action]?.category;
  return key ? { key, title: ACTIVITY_CATEGORIES[key] } : null;
}

/** فهرستِ اقدام‌ها برای فیلترِ کشویی، گروه‌بندی‌شده مثل پنل. */
export function activityFilterOptions() {
  return Object.entries(ACTIVITY_CATEGORIES).map(([key, title]) => ({
    key,
    title,
    actions: Object.entries(ACTIVITY_ACTIONS)
      .filter(([, meta]) => meta.category === key)
      .map(([action, meta]) => ({ action, label: meta.label })),
  }));
}
