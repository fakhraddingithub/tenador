/**
 * src/lib/apiPermissions.js
 *
 * نگاشتِ «روتِ API × متد → کلید دسترسی» — فاز ۲ (enforcement).
 *
 * این فایل *مرجعِ بازبینی و تست* است: هر هندلرِ ادمین باید اینجا یک ورودی
 * داشته باشد و کلیدش باید در رجیستری (src/lib/permissions.js) موجود باشد.
 * خودِ هندلرها کلید را به‌صورت رشته‌ی صریح صدا می‌زنند (نه lookup در زمان
 * اجرا) تا مسیر تصمیم‌گیری کوتاه و قابل‌خواندن بماند؛ تست تطابقِ این دو را
 * تضمین می‌کند.
 *
 * مقادیر:
 *   "module.action"      → همان یک کلید لازم است
 *   ["a.b", "c.d"]       → همه‌ی کلیدها لازم است
 *   { any: [...] }       → هر یک از کلیدها کافی است
 *   null                 → هر ادمینِ معتبر (بدون کلید خاص)
 *   "BRANCH"             → تصمیم داخل هندلر گرفته می‌شود (بدنه/کوئری فرق می‌کند)
 */

/**
 * هندلرهایی که کلیدشان به بدنه/کوئری وابسته است.
 *
 * «داخل هندلر تصمیم بگیر» به‌تنهایی قابل اثبات نیست. بنابراین هر BRANCH باید
 * نامِ یک *resolverِ خالصِ fail-closed* را اعلام کند؛ اسکنر بررسی می‌کند که
 * هندلر دقیقاً همان resolver را صدا می‌زند و خروجی‌اش را به گیت می‌دهد، و
 * تست‌ها همه‌ی شاخه‌ها + defaultِ نامعتبر را پوشش می‌دهند.
 */
export const branch = (resolver) => ({ branch: resolver });
export const isBranch = (value) => !!value && typeof value === "object" && "branch" in value;

/** هندلرهایی که فقط «ادمینِ معتبر» می‌خواهند (بدون کلید اختصاصی). */
export const ANY_ADMIN = null;

export const ADMIN_API_PERMISSIONS = {
  // ── ادمین‌ها و نقش‌ها ───────────────────────────────────────────────
  "/admin/admins": { GET: "admins.view", POST: "admins.create" },
  // انتخابگرِ کاربر برای ساختِ عضویت — همان کلیدِ ساخت، نه users.view
  // (وگرنه ساختِ ادمین به دیدنِ کلِ پایگاه کاربران گره می‌خورد).
  "/admin/admins/candidates": { GET: "admins.create" },
  "/admin/admins/[id]": {
    GET: "admins.view",
    PUT: branch("resolveAdminPatchPermissions"),
    DELETE: "admins.revoke",
  },
  // دفترِ فعالیت — فقط خواندنی؛ نوشتن فقط از سرویسِ داخلی انجام می‌شود.
  "/admin/activity": { GET: "admins.viewActivity" },
  "/admin/roles": { GET: "roles.view", POST: "roles.create" },
  "/admin/roles/[id]": { PUT: "roles.edit", DELETE: "roles.delete" },
  // رجیستری دسترسی‌ها: فرمِ ویرایشِ ادمین به آن نیاز دارد. گیت کردنش روی
  // roles.view باعث می‌شد کسی که فقط admins.managePermissions دارد نتواند
  // فرم را باز کند. محتوایش هم صرفاً تعریفِ ثابتِ کلیدهاست، نه داده‌ی کاربر.
  "/admin/permissions": {
    GET: { any: ["roles.create", "roles.edit", "admins.managePermissions"] },
  },

  // ── داشبورد و اعلان‌های خودِ ادمین ──────────────────────────────────
  "/admin/stats": { GET: "dashboard.view" },
  "/admin/notifications/summary": { GET: ANY_ADMIN },
  "/admin/notifications/read": { POST: ANY_ADMIN },

  // ── مقالات ─────────────────────────────────────────────────────────
  "/admin/articles": { GET: "articles.view", POST: "articles.create" },
  "/admin/articles/[id]": {
    GET: "articles.view",
    // انتشار کلیدِ جدا دارد — resolveArticlePatchPermissions
    PATCH: branch("resolveArticlePatchPermissions"),
    DELETE: "articles.delete",
  },
  "/admin/articles/[id]/revisions": { GET: "articles.view" },
  "/admin/article-cms": { GET: "articles.view" },
  "/admin/article-cms/entities": { GET: "articles.view" },
  "/admin/article-cms/[id]/autosave": { PATCH: "articles.edit" },
  "/admin/article-cms/[id]/duplicate": { POST: "articles.create" },
  "/admin/article-cms/[id]/restore": { POST: "articles.edit" },
  "/admin/article-cms/[id]/revisions/[revision]": {
    GET: "articles.view",
    POST: "articles.edit",
  },
  "/admin/article-categories": {
    GET: "articleTaxonomy.view",
    POST: "articleTaxonomy.manage",
  },
  "/admin/article-categories/[id]": {
    PATCH: "articleTaxonomy.manage",
    DELETE: "articleTaxonomy.manage",
  },
  "/admin/article-tags": {
    GET: "articleTaxonomy.view",
    POST: "articleTaxonomy.manage",
  },
  "/admin/article-tags/[id]": {
    PATCH: "articleTaxonomy.manage",
    DELETE: "articleTaxonomy.manage",
  },

  // ── مربیان ─────────────────────────────────────────────────────────
  "/admin/coaches": { GET: "coaches.view" },
  "/admin/coaches/[coachId]/orders": { GET: "coaches.view" },
  "/admin/coaches/[coachId]/wallet": { POST: "coaches.manageCredits" },
  "/admin/coach-applications": { GET: "coaches.view" },
  "/admin/coach-applications/[id]/review": { PUT: "coaches.manage" },
  "/admin/coach-credits": {
    GET: "coaches.view",
    POST: "coaches.manageCredits",
  },
  "/admin/coach-credits/[id]": {
    PATCH: "coaches.manageCredits",
    DELETE: "coaches.manageCredits",
  },

  // ── پشتیبانی ───────────────────────────────────────────────────────
  "/admin/comments": { GET: "comments.view" },
  "/admin/comments/[id]": { PATCH: "comments.moderate", DELETE: "comments.delete" },
  "/admin/contact-messages": { GET: "contactMessages.view" },
  "/admin/contact-messages/[id]": {
    PATCH: "contactMessages.manage",
    DELETE: "contactMessages.manage",
  },
  "/admin/tickets": { GET: "tickets.view" },
  "/admin/tickets/stats": { GET: "tickets.view" },
  "/admin/tickets/[id]": { GET: "tickets.view", PATCH: "tickets.close" },
  "/admin/tickets/[id]/messages": { POST: "tickets.reply" },

  // ── تخفیف‌ها ───────────────────────────────────────────────────────
  "/admin/discounts": { GET: "discounts.view", POST: "discounts.create" },
  "/admin/discounts/search": { GET: "discounts.view" },
  "/admin/discounts/[id]": {
    GET: "discounts.view",
    PATCH: "discounts.edit",
    DELETE: "discounts.delete",
  },
  "/admin/coupons": { GET: "discounts.view", POST: "discounts.create" },
  "/admin/coupons/[id]": { PATCH: "discounts.edit", DELETE: "discounts.delete" },
  "/admin/quantity-discounts": {
    GET: "discounts.view",
    POST: "discounts.create",
  },
  "/admin/quantity-discounts/[id]": {
    PATCH: "discounts.edit",
    DELETE: "discounts.delete",
  },

  // ── کالکشن‌ها ──────────────────────────────────────────────────────
  "/admin/events": { GET: "collections.view", POST: "collections.create" },
  "/admin/events/[id]": {
    GET: "collections.view",
    PUT: "collections.edit",
    DELETE: "collections.delete",
  },
  "/admin/events/[id]/status": { PUT: "collections.publish" },
  "/admin/events/[id]/duplicate": { POST: "collections.create" },
  "/admin/events/[id]/products-preview": { GET: "collections.view" },
  "/admin/events/attribute-options": { GET: "collections.view" },
  "/admin/events/preview-products": { POST: "collections.view" },

  // ── مالی ───────────────────────────────────────────────────────────
  "/admin/analytics": { GET: "analytics.view" },
  "/admin/exchange-rate": { GET: "exchangeRate.view", POST: "exchangeRate.edit" },
  "/admin/installments": { GET: "installments.view" },
  "/admin/installments/[id]": { GET: "installments.view" },
  "/admin/installments/[id]/confirm-order": { POST: "installments.approveCheck" },
  "/admin/installment-balance": { GET: "installments.view" },
  // کلید تنظیمات در query می‌آید و هر کلید مالکِ متفاوتی دارد
  "/admin/site-settings": {
    GET: branch("resolveSiteSettingPermission"),
    PUT: branch("resolveSiteSettingPermission"),
  },

  // ── سفارشات ────────────────────────────────────────────────────────
  "/admin/orders": { GET: "orders.view" },
  // بررسیِ خودِ هندلر: PATCH فقط paymentStatus/fulfillmentStatus را می‌نویسد
  // (هیچ فیلد دیگری set نمی‌شود)، پس شاخه‌ای نیست — یک کلیدِ ثابت است.
  "/admin/orders/[orderId]": { GET: "orders.view", PATCH: "orders.changeStatus" },
  "/admin/orders/[orderId]/items": {
    POST: "orders.editItems",
    PATCH: "orders.editItems",
    DELETE: "orders.editItems",
  },
  "/admin/orders/[orderId]/discount": {
    POST: "orders.adjustDiscount",
    DELETE: "orders.adjustDiscount",
  },
  "/admin/orders/[orderId]/eur": {
    PATCH: "orders.setCurrency",
    POST: "orders.setCurrency",
    PUT: "orders.setCurrency",
    DELETE: "orders.setCurrency",
  },
  // قیمت یوروییِ یک قلمِ سفارش — همان کلیدِ سیستم یورو، بدون کلیدِ جدید، تا
  // دسترسی‌های تعریف‌شده‌ی فعلیِ ادمین‌ها بدون تغییر کار کند.
  "/admin/orders/[orderId]/eur/item": { PATCH: "orders.setCurrency" },
  "/admin/orders/[orderId]/tracking": {
    GET: "orderTracking.view",
    POST: "orderTracking.assign",
    DELETE: "orderTracking.assign",
  },
  "/admin/orders/tracking-items/lookup": { GET: "orderTracking.view" },
  "/admin/orders/used-product-tracking": {
    GET: "orderTracking.view",
    POST: "orderTracking.assign",
  },
  "/admin/payments/[id]/approve": { POST: "payments.approve" },
  "/admin/payments/[id]/reject": { POST: "payments.reject" },
  "/admin/payments/[id]/edit": { PATCH: "payments.edit" },

  // ── فرایند سفارش ───────────────────────────────────────────────────
  "/admin/order-flows": { GET: "orderFlows.view", POST: "orderFlows.create" },
  "/admin/order-flows/[flowId]": {
    GET: "orderFlows.view",
    PUT: "orderFlows.edit",
    DELETE: "orderFlows.delete",
  },

  // ── دست دوم ────────────────────────────────────────────────────────
  "/admin/used-products": { GET: "secondHand.view", POST: "secondHand.create" },
  "/admin/used-products/[id]": {
    GET: "secondHand.view",
    PUT: "secondHand.edit",
    DELETE: "secondHand.delete",
  },
  "/admin/healthcards": { GET: "healthCards.view", POST: "healthCards.create" },
  "/admin/healthcards/[id]": {
    GET: "healthCards.view",
    PUT: "healthCards.edit",
    DELETE: "healthCards.delete",
  },

  // ── ویترین و صفحات ─────────────────────────────────────────────────
  "/admin/home-sliders": {
    GET: "homeProductSliders.view",
    PUT: "homeProductSliders.edit",
  },
  "/admin/home-roland-garros": {
    GET: "homeRolandGarros.view",
    PUT: "homeRolandGarros.edit",
  },
  // انتشار کلیدِ جدا دارد — resolvePagePutPermissions
  "/admin/pages": { GET: "pages.view", PUT: branch("resolvePagePutPermissions") },

  // ── کاربران ────────────────────────────────────────────────────────
  "/admin/users": { GET: "users.view" },
  // PATCH بسته به فیلدهای بدنه: ویرایش / مسدودسازی / تغییر نقش
  "/admin/users/[userId]": {
    GET: "users.view",
    PATCH: branch("resolveUserPatchPermissions"),
  },
  "/admin/user-notifications": {
    GET: "userNotifications.view",
    POST: "userNotifications.send",
  },
  "/admin/user-notifications/recipients": { GET: "userNotifications.send" },

  // ── محصولات ────────────────────────────────────────────────────────
  "/admin/variants": { GET: "variants.view" },
};

/**
 * روت‌های *بیرون از* /api/admin که عملیاتِ ادمینی انجام می‌دهند.
 *
 * این‌ها خطرناک‌ترین بخشِ فاز ۲ بودند: بیشترشان هیچ احراز هویتی نداشتند، پس
 * گیت کردنِ /api/admin به‌تنهایی نمایشی بود (مثلاً POST /api/product/create
 * کلید products.create را کاملاً دور می‌زد).
 */
export const PUBLIC_ADMIN_API_PERMISSIONS = {
  "/sports/create": { POST: "sports.create" },
  "/sports/[sportId]": { PUT: "sports.edit", DELETE: "sports.delete" },
  "/sports/reorder": { PUT: "sports.reorder" },

  "/categories/create": { POST: "categories.create" },
  "/categories/[categoryId]": {
    PUT: "categories.edit",
    DELETE: "categories.delete",
  },
  "/categories/reorder": { PUT: "categories.reorder" },

  "/brands/create": { POST: "brands.create" },
  "/brands/[brandId]": { PUT: "brands.edit", DELETE: "brands.delete" },
  "/brands/reorder": { PUT: "brands.reorder" },

  "/series/create": { POST: "series.create" },
  "/series/[id]": { PUT: "series.edit", DELETE: "series.delete" },
  "/series/reorder": { PUT: "series.edit" },

  // ⚠️ فاز ۵ — این دو GET کاملاً بدونِ گیت بودند. ظاهرشان «عمومی» است ولی
  // هیچ مصرف‌کننده‌ی ویترینی ندارند: سایت لیمیتد ادیشن‌ها را از سرویس‌ها
  // (brandGrouped.service / query.service) مستقیم از دیتابیس می‌خواند. تنها
  // مصرف‌کننده‌ها صفحه‌های پنل‌اند، پس روت هم مثل بقیه گیت می‌شود.
  "/limited-editions": { GET: "limitedEditions.view" },
  "/limited-editions/create": { POST: "limitedEditions.create" },
  "/limited-editions/[id]": {
    GET: "limitedEditions.view",
    PUT: "limitedEditions.edit",
    DELETE: "limitedEditions.delete",
  },

  "/product/create": { POST: "products.create" },
  "/product/reorder": { PUT: "products.edit" },
  "/product/[productId]": { PUT: "products.edit", DELETE: "products.delete" },
  // ⚠️ DELETE اینجا قیمت را پاک نمی‌کند؛ کلِ محصول و واریانت‌هایش را حذف
  // می‌کند (کپیِ DELETE /product/[productId]). کلید بر اساس اثرِ واقعی.
  "/product/[productId]/price": { DELETE: "products.delete" },
  "/product/[productId]/variants": { GET: "variants.view", POST: "variants.edit" },
  "/variants/[variantId]": { DELETE: "variants.edit" },

  "/athletes/create": { POST: "athletes.create" },
  "/athletes/[athleteId]": { PUT: "athletes.edit", DELETE: "athletes.delete" },

  "/banners": { POST: "homeBanners.edit" },
  "/banners/[id]": { PUT: "homeBanners.edit", DELETE: "homeBanners.edit" },

  "/slides": { POST: "homeSlider.edit" },
  "/slides/[id]": { PUT: "homeSlider.edit", DELETE: "homeSlider.edit" },
  "/slides/reorder": { POST: "homeSlider.edit" },

  "/ai/product-draft": { POST: "ai.productDraft" },
  "/ai/athlete-prompt": { POST: "ai.athletePrompt" },

  // ── معیار دوم: «منحصراً ادمینی»، حتی بدون فراخوانِ فعلی در UI ────────
  // نبودِ caller دلیل امن بودن نیست؛ این‌ها ماهیتاً عملیاتِ مدیریتی‌اند و
  // همین حالا بدون احراز هویت باز هستند.

  // ساخت/فهرستِ ban — کاملاً مدیریتی. (پیش‌تر `bannedBy` از بدنه خوانده
  // می‌شد؛ حالا از خودِ گیت می‌آید تا ردپای ممیزی جعل‌شدنی نباشد.)
  //
  // GETِ *یک* رکورد هم اینجاست: همان داده‌ی فهرست را با user و bannedByِ
  // populate شده برمی‌گرداند، پس نبودنش در manifest یک شکافِ واقعی بود.
  "/bans": { GET: "users.ban", POST: "users.ban" },
  "/bans/[id]": { GET: "users.ban", PUT: "users.ban", DELETE: "users.ban" },

  // ⚠️ فاز ۴ (بچ ۳) — این روت زیرِ /api/admin نیست، پس اسکنر پیدایش نمی‌کرد و
  // از فاز ۲ جا مانده بود: تنها گیتش `auth.role !== "admin"` از داخلِ JWT بود.
  // یعنی ادمینِ لغو‌شده/مسدود با توکنِ ۱۵روزه‌ی معتبر همچنان می‌توانست چک را
  // «پاس» کند و کلِ سفارش را تسویه‌شده نشان دهد. حالا با دسترسیِ زنده گیت است.
  "/installments/checks/[checkId]/status": { PATCH: "installments.edit" },

  // باطل‌سازیِ دستیِ کشِ منو. GET عمومی می‌ماند (ویترین از آن می‌خواند).
  "/navbar": { POST: "navbar.revalidate" },

  // ⚠️ /api/otps — دورزدنِ کاملِ احراز هویت:
  //   GET  همه‌ی کدهای OTP دیتابیس را برمی‌گرداند (ورود به هر حساب)
  //   POST برای هر شماره، OTP با کدِ دلخواه می‌سازد
  // هیچ فراخوانی در کل کدبیس ندارد. هیچ «قابلیتِ مدیریتیِ مشروعی» هم متناظرش
  // نیست، پس کلیدِ جعلی نمی‌سازیم. تا زمان حذفِ کامل (توصیه‌ی اکید)، پشتِ
  // بالاترین کلیدِ اعتماد بسته می‌شود تا از دسترس خارج باشد.
  "/otps": { GET: "admins.managePermissions", POST: "admins.managePermissions" },
  "/otps/[id]": {
    // GET یک OTP هم دقیقاً همان نشتِ فهرست است — نبودنش در manifest شکاف بود.
    GET: "admins.managePermissions",
    PUT: "admins.managePermissions",
    DELETE: "admins.managePermissions",
  },
};

/**
 * کلیدهای تنظیماتِ عمومی (`/api/admin/site-settings?key=…`) → مالکِ واقعی.
 * یک endpoint، چند مالک؛ بدون این نگاشت، دسترسی «پاداش نظر» به «حساب بانکی»
 * هم نشت می‌کرد.
 */
export const SITE_SETTING_OWNERS = {
  bank_account_details: { view: "bankAccount.view", edit: "bankAccount.edit" },
  monthly_installment_rate: {
    view: "financingSettings.view",
    edit: "financingSettings.edit",
  },
  review_credit_config: { view: "reviewCredit.view", edit: "reviewCredit.edit" },
  home_featured_article_ids: {
    view: "homeFeaturedArticles.view",
    edit: "homeFeaturedArticles.edit",
  },
  secondhand_header_image: { view: "secondHand.view", edit: "secondHand.edit" },
};

/* ────────────────────────────────────────────────────────────────────────────
 * resolverهای شاخه‌ای — خالص، قطعی، fail-closed
 *
 * قرارداد واحد: `{ allowed, permissions, mode, reason }`.
 *
 * ⚠️ چرا `allowed` لازم است و آرایه‌ی خالی کافی نیست:
 * `hasPermission(effective, [], { mode: "all" })` روی آرایه‌ی خالی `every`
 * می‌زند و **true** برمی‌گرداند؛ آرایه‌ی خالی هم در JS truthy است. یعنی اگر
 * resolver فقط `permissions: []` می‌داد، گیت آن را «هیچ کلیدی لازم نیست»
 * تفسیر می‌کرد و درخواست را **مجاز** می‌کرد — دقیقاً برعکسِ منظور.
 * پس هندلر موظف است *قبل از* رسیدن به گیت، `allowed === false` را ۴۰۳ کند.
 * ──────────────────────────────────────────────────────────────────────────── */

const DENY = (reason) => ({
  allowed: false,
  permissions: [],
  mode: "all",
  reason,
});

const ALLOW = (permissions, mode = "all") => ({
  allowed: true,
  permissions,
  mode,
  reason: "ok",
});

/**
 * `/api/admin/site-settings` — یک endpoint، چند مالک.
 * @param {string} key   مقدارِ `?key=`
 * @param {"view"|"edit"} action
 */
export function resolveSiteSettingPermission(key, action) {
  if (typeof key !== "string" || !key) return DENY("missing-key");
  if (action !== "view" && action !== "edit") return DENY("invalid-action");

  const owner = SITE_SETTING_OWNERS[key];
  // کلیدِ ناشناخته: نمی‌دانیم چه چیزی را محافظت می‌کنیم → رد.
  if (!owner) return DENY("unknown-setting-key");

  const permission = owner[action];
  if (!permission) return DENY("no-owner-for-action");

  return ALLOW([permission]);
}

/* ────────────────────────────────────────────────────────────────────────────
 * اعلان‌های ادمین — کمترین امتیاز
 *
 * زنگوله و شمارنده‌ها داده‌ی چند ماژول را با هم جمع می‌کنند. بی‌کلید گذاشتنِ
 * این endpoint یعنی ادمینی که فقط به مقالات دسترسی دارد، تعداد سفارش‌ها و
 * تیکت‌ها و حتی عنوان و لینکِ آن‌ها را می‌بیند. «شکستنِ زنگوله» دلیلِ کافی
 * برای نشتِ داده نیست؛ راهِ درست فیلترکردنِ خروجی است، نه باز گذاشتنِ آن.
 * ──────────────────────────────────────────────────────────────────────────── */

/** هر نوعِ اعلان با کدام دسترسی دیده می‌شود. */
export const NOTIFICATION_TYPE_PERMISSIONS = {
  new_order: "orders.view",
  new_payment: "payments.view",
  coach_student_order: "coaches.view",
  coach_application: "coaches.view",
  new_ticket: "tickets.view",
};

/** شمارنده‌ی «پیام تماسِ جدید» جدا از Notification است. */
export const CONTACT_COUNTER_PERMISSION = "contactMessages.view";

/** انواعی که این دسترسی مؤثر اجازه‌ی دیدنشان را می‌دهد. */
export function allowedNotificationTypes(permissions) {
  const held = new Set(permissions || []);
  return Object.keys(NOTIFICATION_TYPE_PERMISSIONS).filter((type) =>
    held.has(NOTIFICATION_TYPE_PERMISSIONS[type])
  );
}

/**
 * فیلترِ خروجیِ زنگوله بر اساس دسترسی مؤثر.
 *
 * @param {{items?: Array, counts?: object, contactNew?: number}} payload
 * @param {string[]} permissions
 * @param {Record<string,string>} sectionByType نگاشتِ نوع→بخش از خودِ سرویس
 */
export function filterNotificationPayload(payload, permissions, sectionByType = {}) {
  const allowed = new Set(allowedNotificationTypes(permissions));
  const held = new Set(permissions || []);

  const items = (payload?.items || []).filter((n) => allowed.has(n?.type));

  const sourceByType = payload?.counts?.byType || {};
  const byType = {};
  for (const type of Object.keys(sourceByType)) {
    byType[type] = allowed.has(type) ? sourceByType[type] : 0;
  }

  // بخش‌ها از روی byTypeِ فیلترشده بازمحاسبه می‌شوند تا جمعِ بخش، عددِ
  // ماژولِ غیرمجاز را لو ندهد.
  const sections = {};
  for (const section of Object.keys(payload?.counts?.sections || {})) {
    sections[section] = 0;
  }
  for (const [type, count] of Object.entries(byType)) {
    const section = sectionByType[type];
    if (section && section in sections) sections[section] += count;
  }

  const total = Object.values(byType).reduce((sum, n) => sum + n, 0);

  return {
    items,
    counts: { total, byType, sections },
    contactNew: held.has(CONTACT_COUNTER_PERMISSION) ? payload?.contactNew || 0 : 0,
  };
}

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const isObjectIdLike = (v) => typeof v === "string" && OBJECT_ID.test(v);

/**
 * محدودکردنِ فیلترِ «خوانده‌شده» به انواعِ مجازِ همین ادمین.
 *
 * `type` همیشه بازنویسی می‌شود (نه ادغام): چون در buildReadQuery همه‌ی شرط‌ها
 * با AND ترکیب می‌شوند، تحمیلِ `type ∈ allowed` باعث می‌شود حتی `ids` یا
 * `all: true` هم نتواند اعلانِ ماژولِ غیرمجاز را علامت بزند.
 *
 * شناسه‌های بدشکل هم همین‌جا حذف می‌شوند: بدنه‌ی دلخواهِ کلاینت مستقیم به
 * کوئری می‌رفت و یک رشته‌ی نامعتبر (یا آبجکتِ عملگرِ Mongo) CastError و ۵۰۰
 * می‌داد. حذفِ آن‌ها fail-closed است — فیلترِ باقی‌مانده فقط تنگ‌تر می‌شود.
 */
export function constrainReadFilterToPermissions(filter, permissions) {
  const allowed = allowedNotificationTypes(permissions);
  const requested = filter?.type
    ? Array.isArray(filter.type)
      ? filter.type
      : [filter.type]
    : null;

  const types = requested
    ? requested.filter((t) => allowed.includes(t))
    : allowed;

  const safe = { ...(filter || {}), type: types };

  // ⚠️ شناسه‌ی بدشکل *حذف* نمی‌شود، چون حذفش دامنه را گشاد می‌کند: درخواستِ
  // «این دو اعلان» به «همه‌ی اعلان‌های مجاز» تبدیل می‌شد. به‌جایش کل فیلتر به
  // «هیچ‌چیز» تبدیل می‌شود (`$in: []`).
  const NOTHING = { type: [] };

  for (const ref of ["order", "coach", "ticket"]) {
    if (safe[ref] !== undefined && !isObjectIdLike(safe[ref])) return NOTHING;
  }
  if (safe.ids !== undefined) {
    const ids = Array.isArray(safe.ids) ? safe.ids.filter(isObjectIdLike) : [];
    if (!ids.length) return NOTHING;
    safe.ids = ids;
  }
  // `all` فقط بولینِ واقعی — رشته‌ی "false" نباید «همه» معنی بدهد.
  if (safe.all !== undefined && safe.all !== true) delete safe.all;

  return safe;
}

/**
 * فیلدهای سندِ Admin که «ویرایشِ ساده» حساب می‌شوند.
 *
 * فاز ۳: `name` / `username` / `email` از این فهرست حذف شدند. هویتِ عضویت از
 * کاربرِ لینک‌شده مشتق می‌شود و دستی ویرایش نمی‌شود؛ فرستادنشان حالا
 * «فیلدِ ناشناخته» و در نتیجه fail-closed است. تنها متنِ آزادِ باقی‌مانده
 * `title` است که یک برچسبِ نمایشیِ شغلی است، نه هویت.
 */
const ADMIN_EDIT_FIELDS = ["title"];

/* ────────────────────────────────────────────────────────────────────────────
 * انتشار، جدا از ویرایش (فاز ۵)
 *
 * رجیستری از ابتدا `articles.publish` و `pages.publish` داشت، ولی هیچ روتی
 * آن‌ها را اعمال نمی‌کرد: انتشار فقط یک فیلد در همان درخواستِ ویرایش بود. یعنی
 * هر کسی که می‌توانست پیش‌نویس بنویسد، می‌توانست منتشرش هم بکند — دقیقاً همان
 * «کلیدِ بیش‌ازحد گشاد برای دو عملیاتِ ماهیتاً متفاوت» که فاز ۵ باید پیدا کند.
 *
 * توجه: *برداشتن* از انتشار (draft/archived) فقط ویرایش است. پایین‌آوردنِ محتوا
 * خطرِ کمتری از بالا بردنش دارد و نباید پشتِ کلیدِ سخت‌تر قفل شود.
 * ──────────────────────────────────────────────────────────────────────────── */

/** وضعیت‌هایی که محتوا را برای عموم *منتشر نمی‌کنند*. */
const NON_PUBLISHING_ARTICLE_STATUSES = ["draft", "review", "archived"];

/**
 * `PATCH /api/admin/articles/[id]`
 *
 *   • بدونِ `status`                       → articles.edit
 *   • `status` از فهرستِ غیرمنتشرکننده     → articles.edit
 *   • هر `status`ِ دیگر (published/scheduled
 *     و حتی مقدارِ ناشناخته)               → articles.edit + articles.publish
 *
 * مقدارِ ناشناخته عمداً سمتِ سخت‌گیرانه می‌افتد: اگر معنایش را نمی‌دانیم،
 * فرض می‌کنیم ممکن است منتشر کند. اعتبارسنجیِ خودِ مقدار در هندلر انجام
 * می‌شود و ۴۲۲ می‌دهد.
 */
export function resolveArticlePatchPermissions(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return DENY("invalid-body");
  }
  if (!Object.keys(body).length) return DENY("empty-body");

  const required = ["articles.edit"];

  if ("status" in body) {
    const status = body.status;
    const publishing =
      typeof status !== "string" || !NON_PUBLISHING_ARTICLE_STATUSES.includes(status);
    if (publishing) required.push("articles.publish");
  }

  return ALLOW(required);
}

/**
 * `PUT /api/admin/pages`
 *
 * فقط *تغییر دادنِ* وضعیتِ انتشار کلیدِ جدا می‌خواهد، نه صرفِ ذخیره‌ی صفحه‌ای
 * که از قبل منتشر است. اگر `published` در بدنه نباشد، هندلر مقدارِ فعلی را
 * دست‌نخورده می‌گذارد؛ پس ویراستارِ بدونِ pages.publish می‌تواند محتوای یک
 * صفحه‌ی منتشرشده را به‌روز کند بدون اینکه به انتشار دست بزند.
 *
 * (نسخه‌ی اولِ همین resolver `published !== false` را ملاک گرفته بود؛ چون
 * هندلر همیشه این فیلد را می‌نوشت، عملاً هر ذخیره‌ای «انتشار» حساب می‌شد و
 * ویراستار هیچ صفحه‌ی منتشرشده‌ای را نمی‌توانست ذخیره کند.)
 */
export function resolvePagePutPermissions(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return DENY("invalid-body");
  }

  const required = ["pages.edit"];
  if (typeof body.published === "boolean") required.push("pages.publish");
  return ALLOW(required);
}

/** فیلدهای دسترسی روی سندِ Admin. */
const ADMIN_PERMISSION_FIELDS = [
  "permissions",
  "permissionGrants",
  "permissionDenials",
];

/**
 * `PUT /api/admin/admins/[id]` — یک endpoint با چند عملیاتِ کاملاً متفاوت.
 *
 * گیتِ ثابتِ `admins.edit` غلط بود: دارنده‌ی آن می‌توانست دسترسی‌ها را هم
 * عوض کند و ادمین را فعال/لغو کند، یعنی عملاً admins.managePermissions و
 * admins.activate/revoke را رایگان می‌گرفت.
 *
 *   • name/title/email/username           → admins.edit
 *   • isActive: true                      → admins.activate
 *   • isActive: false                     → admins.revoke
 *   • permissions/Grants/Denials          → admins.managePermissions
 *   • role                                → admins.edit  (+ بررسی‌های
 *     ارتقای دسترسی و نقشِ محافظت‌شده که به دیتابیس نیاز دارند و در روت
 *     انجام می‌شوند)
 *
 * payloadِ ترکیبی همه‌ی کلیدها را با هم می‌خواهد (mode: "all").
 * فیلدِ ناشناخته، بدنه‌ی خالی، یا isActiveِ غیرboolean → fail-closed.
 */
export function resolveAdminPatchPermissions(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return DENY("invalid-body");
  }

  const fields = Object.keys(body);
  if (!fields.length) return DENY("empty-body");

  const required = new Set();

  for (const field of fields) {
    if (field === "isActive") {
      if (typeof body.isActive !== "boolean") return DENY("non-boolean-isActive");
      required.add(body.isActive ? "admins.activate" : "admins.revoke");
    } else if (field === "revokeReason") {
      // فقط همراهِ لغو دسترسی معنا دارد
      if (body.isActive !== false) return DENY("revoke-reason-without-revoke");
    } else if (ADMIN_PERMISSION_FIELDS.includes(field)) {
      required.add("admins.managePermissions");
    } else if (field === "role") {
      required.add("admins.edit");
    } else if (ADMIN_EDIT_FIELDS.includes(field)) {
      required.add("admins.edit");
    } else {
      return DENY(`unknown-field:${field}`);
    }
  }

  if (!required.size) return DENY("no-effective-change");
  return ALLOW([...required]);
}

/** فیلدهایی از کاربر که «ویرایش پروفایل» حساب می‌شوند. */
const USER_EDIT_FIELDS = [
  "name",
  "lastName",
  "email",
  "phone",
  "avatar",
  "level",
  "coach",
];

/**
 * `PATCH /api/admin/users/[userId]` — بسته به فیلدهای بدنه.
 *
 * قواعد:
 *   • `role: "admin"` → همیشه رد. ادمین‌کردنِ کاربر از صفحه‌ی کاربر مسیرِ
 *     درستی نیست و باید فقط از طریق عضویتِ Admin انجام شود؛ این مسیر در
 *     نهایت کامل حذف می‌شود. هیچ کلیدی آن را مجاز نمی‌کند.
 *   • `role` غیرادمینی → users.changeRole
 *   • `isBanned`        → users.ban
 *   • `walletBalance`   → users.adjustWallet (مالی، جدا از ویرایش پروفایل)
 *   • فیلدهای پروفایل   → users.edit
 *   • فیلدِ ناشناخته یا بدنه‌ی خالی → رد (fail-closed)
 *
 * چند فیلد با هم → همه‌ی کلیدها لازم است (mode: "all").
 */
export function resolveUserPatchPermissions(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return DENY("invalid-body");
  }

  const fields = Object.keys(body);
  if (!fields.length) return DENY("empty-body");

  const required = new Set();

  for (const field of fields) {
    if (field === "role") {
      if (body.role === "admin") return DENY("admin-role-not-assignable-here");
      required.add("users.changeRole");
    } else if (field === "isBanned") {
      required.add("users.ban");
    } else if (field === "walletBalance") {
      // عملیاتِ مالی — کلیدِ مستقل، نه users.edit
      required.add("users.adjustWallet");
    } else if (USER_EDIT_FIELDS.includes(field)) {
      required.add("users.edit");
    } else {
      // فیلدِ ناشناخته: نمی‌دانیم چه اثری دارد → رد.
      return DENY(`unknown-field:${field}`);
    }
  }

  return ALLOW([...required]);
}
