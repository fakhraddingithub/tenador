/**
 * src/lib/permissions.js
 *
 * رجیستری مرکزی دسترسی‌های پنل ادمین — تنها منبع حقیقت (Single Source of Truth).
 *
 * دسترسی‌ها در دیتابیس فقط به‌صورت آرایه‌ای از کلیدهای رشته‌ای ذخیره می‌شوند
 * ("products.view"، "orders.changeStatus" و ...)؛ بنابراین افزودن ماژول یا
 * دسترسی جدید فقط نیازمند ویرایش همین فایل است و هیچ تغییری در اسکیمای
 * دیتابیس لازم ندارد.
 *
 * ⚠️ در این فاز هیچ دسترسی‌ای در سیستم اعمال/محدود نمی‌شود؛ این رجیستری فقط
 * زیرساخت ذخیره و مدیریت دسترسی‌هاست تا در فاز بعدی enforcement روی آن سوار شود.
 *
 * قرارداد کلید: `${moduleKey}.${actionKey}`
 */

export const PERMISSION_MODULES = [
  {
    key: "dashboard",
    title: "داشبورد",
    description: "صفحه اصلی پنل مدیریت و آمار کلی",
    permissions: [
      { key: "view", title: "مشاهده داشبورد" },
    ],
  },
  {
    key: "home",
    title: "صفحه اصلی سایت",
    description: "بنرها، اسلایدها و محتوای صفحه اصلی",
    permissions: [
      { key: "view", title: "مشاهده تنظیمات صفحه اصلی" },
      { key: "edit", title: "ویرایش بنرها و محتوا" },
    ],
  },
  {
    key: "products",
    title: "محصولات",
    description: "مدیریت کالاهای فروشگاه و واریانت‌ها",
    permissions: [
      { key: "view", title: "مشاهده محصولات" },
      { key: "create", title: "ایجاد محصول" },
      { key: "edit", title: "ویرایش محصول" },
      { key: "delete", title: "حذف محصول" },
    ],
  },
  {
    key: "orders",
    title: "سفارشات",
    description: "سفارش‌های مشتریان و وضعیت آن‌ها",
    permissions: [
      { key: "view", title: "مشاهده سفارشات" },
      { key: "edit", title: "ویرایش سفارش" },
      { key: "changeStatus", title: "تغییر وضعیت سفارش" },
    ],
  },
  {
    key: "payments",
    title: "پرداخت‌ها",
    description: "رسیدهای بانکی، اقساط و تأیید پرداخت",
    permissions: [
      { key: "view", title: "مشاهده پرداخت‌ها" },
      { key: "approve", title: "تأیید پرداخت" },
      { key: "reject", title: "رد پرداخت" },
    ],
  },
  {
    key: "inventory",
    title: "انبار",
    description: "موجودی انبار و رهگیری اقلام",
    permissions: [
      { key: "view", title: "مشاهده انبار" },
      { key: "create", title: "ایجاد آیتم انبار" },
      { key: "edit", title: "ویرایش آیتم انبار" },
    ],
  },
  {
    key: "secondHand",
    title: "بازار دست دوم",
    description: "محصولات دست دوم و کارت سلامت",
    permissions: [
      { key: "view", title: "مشاهده محصولات دست دوم" },
      { key: "create", title: "ایجاد محصول دست دوم" },
      { key: "edit", title: "ویرایش محصول دست دوم" },
      { key: "delete", title: "حذف محصول دست دوم" },
    ],
  },
  {
    key: "categories",
    title: "دسته‌بندی‌ها",
    description: "دسته‌بندی محصولات و ویژگی‌های آن‌ها",
    permissions: [
      { key: "view", title: "مشاهده دسته‌بندی‌ها" },
      { key: "create", title: "ایجاد دسته‌بندی" },
      { key: "edit", title: "ویرایش دسته‌بندی" },
      { key: "delete", title: "حذف دسته‌بندی" },
    ],
  },
  {
    key: "brands",
    title: "برندها",
    description: "برندها و اطلاعات آن‌ها",
    permissions: [
      { key: "view", title: "مشاهده برندها" },
      { key: "create", title: "ایجاد برند" },
      { key: "edit", title: "ویرایش برند" },
      { key: "delete", title: "حذف برند" },
    ],
  },
  {
    key: "series",
    title: "سری‌ها",
    description: "سری‌های محصولات هر برند",
    permissions: [
      { key: "view", title: "مشاهده سری‌ها" },
      { key: "create", title: "ایجاد سری" },
      { key: "edit", title: "ویرایش سری" },
      { key: "delete", title: "حذف سری" },
    ],
  },
  {
    key: "events",
    title: "رویدادها و همکاری‌ها",
    description: "همکاری‌های مشترک مثل Roland Garros",
    permissions: [
      { key: "view", title: "مشاهده همکاری‌ها" },
      { key: "create", title: "ایجاد همکاری" },
      { key: "edit", title: "ویرایش همکاری" },
      { key: "delete", title: "حذف همکاری" },
    ],
  },
  {
    key: "sports",
    title: "ورزش‌ها",
    description: "رشته‌های ورزشی فروشگاه",
    permissions: [
      { key: "view", title: "مشاهده ورزش‌ها" },
      { key: "create", title: "ایجاد ورزش" },
      { key: "edit", title: "ویرایش ورزش" },
      { key: "delete", title: "حذف ورزش" },
    ],
  },
  {
    key: "athletes",
    title: "ورزشکاران",
    description: "ورزشکاران معرفی‌شده در سایت",
    permissions: [
      { key: "view", title: "مشاهده ورزشکاران" },
      { key: "create", title: "ایجاد ورزشکار" },
      { key: "edit", title: "ویرایش ورزشکار" },
      { key: "delete", title: "حذف ورزشکار" },
    ],
  },
  {
    key: "orderFlows",
    title: "فرایند سفارش",
    description: "فرایندهای سفارشی‌سازی محصول",
    permissions: [
      { key: "view", title: "مشاهده فرایندها" },
      { key: "create", title: "ایجاد فرایند" },
      { key: "edit", title: "ویرایش فرایند" },
      { key: "delete", title: "حذف فرایند" },
    ],
  },
  {
    key: "discounts",
    title: "تخفیف‌ها",
    description: "قوانین تخفیف، کوپن‌ها و اعتبار مربیان",
    permissions: [
      { key: "view", title: "مشاهده تخفیف‌ها" },
      { key: "create", title: "ایجاد تخفیف" },
      { key: "edit", title: "ویرایش تخفیف" },
      { key: "delete", title: "حذف تخفیف" },
    ],
  },
  {
    key: "finance",
    title: "مدیریت مالی",
    description: "گزارش‌های مالی و تراکنش‌ها",
    permissions: [
      { key: "view", title: "مشاهده گزارش‌های مالی" },
      { key: "manage", title: "مدیریت امور مالی" },
    ],
  },
  {
    key: "users",
    title: "کاربران",
    description: "اعضای سایت، مربیان و وضعیت حساب‌ها",
    permissions: [
      { key: "view", title: "مشاهده کاربران" },
      { key: "edit", title: "ویرایش کاربران" },
      { key: "ban", title: "مسدودسازی کاربران" },
      { key: "manageCoaches", title: "مدیریت مربیان" },
    ],
  },
  {
    key: "tickets",
    title: "تیکت‌ها",
    description: "تیکت‌های پشتیبانی کاربران",
    permissions: [
      { key: "view", title: "مشاهده تیکت‌ها" },
      { key: "reply", title: "پاسخ به تیکت" },
    ],
  },
  {
    key: "admins",
    title: "مدیریت ادمین‌ها",
    description: "ساخت ادمین، نقش‌ها و سطوح دسترسی",
    permissions: [
      { key: "view", title: "مشاهده ادمین‌ها" },
      { key: "create", title: "ایجاد ادمین" },
      { key: "edit", title: "ویرایش ادمین" },
      { key: "managePermissions", title: "مدیریت دسترسی‌ها و نقش‌ها" },
    ],
  },
];

/** کلید کامل یک دسترسی: `${moduleKey}.${actionKey}` */
export function buildPermissionKey(moduleKey, actionKey) {
  return `${moduleKey}.${actionKey}`;
}

/** همه کلیدهای معتبر دسترسی به‌صورت آرایه تخت */
export function getAllPermissionKeys() {
  return PERMISSION_MODULES.flatMap((mod) =>
    mod.permissions.map((p) => buildPermissionKey(mod.key, p.key))
  );
}

/**
 * پاک‌سازی آرایه دسترسی‌های ورودی: فقط کلیدهای معتبرِ موجود در رجیستری،
 * بدون تکرار. ورودی غیرآرایه → آرایه خالی.
 */
export function sanitizePermissions(permissions) {
  if (!Array.isArray(permissions)) return [];
  const valid = new Set(getAllPermissionKeys());
  return [...new Set(permissions.filter((p) => valid.has(p)))];
}
