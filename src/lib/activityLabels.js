/**
 * src/lib/activityLabels.js
 *
 * برچسب‌های فارسیِ دفترِ فعالیت — تنها منبعِ نامِ خواندنیِ اقدام‌ها.
 *
 * چرا یک فایلِ جدا و نه ترجمه در کامپوننت: هم API (برای فیلترِ کشویی) و هم
 * جدولِ خطِ زمانی از همین نگاشت استفاده می‌کنند، و اقدامِ ناشناخته باید در هر
 * دو یکسان و بی‌سروصدا به شناسه‌ی خامش برگردد، نه اینکه خالی رندر شود.
 *
 * ── دو منبع، یک نگاشت ────────────────────────────────────────────────────
 * ۱. `MANUAL_ACTIONS` — شناسه‌هایی که کدِ روت‌ها دستی می‌نویسند (رد دسترسی،
 *    نقش‌ها، …). اینها از فاز ۶ در رکوردهای موجود هستند و برچسبشان نباید
 *    عوض شود.
 * ۲. رجیستریِ موجودیت‌ها (`src/lib/auditEntities.js`) — شناسه‌هایی که پلاگینِ
 *    Mongoose خودکار می‌سازد. افزودنِ یک موجودیت به آن رجیستری، خودبه‌خود
 *    فیلترِ کشویی و برچسبش را هم می‌آورد؛ اینجا کاری لازم نیست.
 */

import { AUDIT_ENTITIES, entityDescriptor, generatedActionIds } from "./auditEntities.js";

/** دسته‌بندیِ اقدام‌ها — همان گروه‌بندیِ بخش‌های پنل. */
export const ACTIVITY_CATEGORIES = {
  authz: "دسترسی",
  admins: "ادمین‌ها",
  users: "کاربران",
  orders: "سفارش‌ها",
  finance: "مالی",
  catalog: "کاتالوگ",
  content: "محتوا",
  marketing: "بازاریابی",
  support: "پشتیبانی",
  other: "سایر",
};

/** کلیدِ موجودیت → دسته. موجودیتِ بی‌نگاشت در «سایر» می‌نشیند. */
const ENTITY_CATEGORY = {
  order: "orders",
  payment: "orders",
  installment: "finance",
  exchangeRate: "finance",
  coachCredit: "finance",
  coachWallet: "finance",
  setting: "finance",

  admin: "admins",
  role: "admins",

  user: "users",
  ban: "users",
  address: "users",
  healthCard: "users",

  product: "catalog",
  variant: "catalog",
  category: "catalog",
  sport: "catalog",
  brand: "catalog",
  serie: "catalog",
  athlete: "catalog",
  limitedEdition: "catalog",
  usedProduct: "catalog",
  orderFlow: "catalog",

  article: "content",
  articleCategory: "content",
  articleTag: "content",
  page: "content",
  banner: "content",
  slide: "content",
  comment: "content",

  discount: "marketing",
  coupon: "marketing",
  quantityDiscount: "marketing",
  flashSale: "marketing",
  event: "marketing",
  newsletter: "marketing",
  userNotification: "marketing",

  ticket: "support",
  ticketMessage: "support",
  contactMessage: "support",
  reviewCredit: "support",
};

/**
 * شناسه‌های دست‌نویس. ترتیب و متنشان عمداً از فاز ۶ دست‌نخورده مانده تا
 * رکوردهای قدیمی دقیقاً همان‌طور که بودند خوانده شوند.
 */
const MANUAL_ACTIONS = {
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

/** دسته‌ی یک شناسه‌ی تولیدشده، از روی نیمه‌ی اولش. */
function categoryForAction(action) {
  const key = String(action).split(".")[0];
  return ENTITY_CATEGORY[key] || "other";
}

function buildActions() {
  const actions = {};
  for (const [action, label] of generatedActionIds()) {
    actions[action] = { label, category: categoryForAction(action) };
  }
  // دست‌نویس‌ها آخر می‌آیند تا برچسبِ تاریخی‌شان برنده باشد.
  Object.assign(actions, MANUAL_ACTIONS);
  return actions;
}

/**
 * شناسه‌ی اقدام → { label, category }
 *
 * شناسه‌ها نقطه‌دار و پایدارند؛ برچسب‌ها می‌توانند عوض شوند بدون آنکه
 * رکوردهای قدیمی بی‌معنا شوند.
 */
export const ACTIVITY_ACTIONS = buildActions();

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

/**
 * عنوانِ ردیفِ خطِ زمانی.
 *
 * رکوردهای جدید جمله‌ی کاملِ سرورساخته دارند («تغییر قیمت محصول «X»»)؛
 * رکوردهای پیش از فاز ۹ ندارند و به برچسبِ اقدام برمی‌گردند. هیچ رکوردی
 * خالی یا نامفهوم نمایش داده نمی‌شود.
 */
export function activityHeadline(item) {
  return item?.description?.trim() || activityLabel(item?.action);
}

/** نامِ فارسیِ نوعِ موجودیت — برای رکوردهایی که فقط resourceType دارند. */
export function resourceTypeLabel(type) {
  if (!type) return "";
  return AUDIT_ENTITIES[type]?.label || entityDescriptor(type).label;
}

/** فهرستِ اقدام‌ها برای فیلترِ کشویی، گروه‌بندی‌شده مثل پنل. */
export function activityFilterOptions() {
  return Object.entries(ACTIVITY_CATEGORIES)
    .map(([key, title]) => ({
      key,
      title,
      actions: Object.entries(ACTIVITY_ACTIONS)
        .filter(([, meta]) => meta.category === key)
        .map(([action, meta]) => ({ action, label: meta.label }))
        .sort((a, b) => a.label.localeCompare(b.label, "fa")),
    }))
    .filter((group) => group.actions.length);
}
