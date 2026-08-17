/**
 * src/lib/permissions.js
 *
 * رجیستری مرکزی دسترسی‌های پنل ادمین — تنها منبع حقیقت (Single Source of Truth).
 *
 * ساختار سه‌سطحی:
 *   بخش (section = آیتم سایدبار)  →  ماژول (module = صفحه/زیربخش واقعی)  →  اکشن
 * کلید ذخیره‌شده در دیتابیس همچنان دو‌بخشی و تخت است: `${moduleKey}.${actionKey}`
 * (مثل "products.edit") تا داده‌ی موجود بدون بازنویسی معتبر بماند.
 *
 * فاز ۲: این کلیدها روی روت‌های ادمین اعمال *می‌شوند* (نگاشتِ روت→کلید در
 * src/lib/apiPermissions.js و گیت در src/lib/requireAdminPermission.js).
 * تا اجرای مهاجرت، ادمین‌هایی که از مسیر legacy وارد می‌شوند همه‌ی کلیدها را
 * دارند، پس enforcement برایشان عملاً بی‌اثر است (وضعیتِ موقتِ مستندشده).
 *
 * قواعد مهم:
 *  - هر ماژول از روی یک صفحه/قابلیتِ *واقعیِ* موجود در پنل ساخته شده است. هیچ
 *    ماژولی از روی برچسبِ رجیستریِ قدیمی حدس زده نشده؛ ماژول جعلیِ «انبار»
 *    (inventory) حذف شد چون چنین بخشی در پنل وجود ندارد.
 *  - «دسترسی کامل» یک کلید ذخیره‌شدنی نیست؛ با پرچم AdminRole.isFullAccess
 *    بیان می‌شود تا کلیدهای آینده هم خودکار پوشش داده شوند و کسی نتواند از
 *    طریق API یک کلید wildcard برای خودش ذخیره کند.
 *  - وابستگی‌ها fail-closed اند: اگر پیش‌نیاز یک اکشن (معمولاً `<module>.view`)
 *    موجود/باقی‌مانده نباشد، خود اکشن هم حذف می‌شود.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * تعریف بخش‌ها و ماژول‌ها
 * منبع: منوی سایدبار (src/components/admin/Layout.jsx)، ۸۱ صفحه‌ی واقعی زیر
 * src/app/(Admin-Panel)/p-admin و روت‌های src/app/api/admin.
 * ──────────────────────────────────────────────────────────────────────────── */

const SECTION_DEFINITIONS = [
  {
    key: "dashboard",
    title: "داشبورد",
    path: "/p-admin",
    modules: [
      {
        key: "dashboard",
        title: "داشبورد",
        description: "صفحه اصلی پنل مدیریت و آمار کلی",
        path: "/p-admin",
        api: ["/api/admin/stats"],
        permissions: [{ key: "view", title: "مشاهده داشبورد" }],
      },
    ],
  },

  {
    key: "sports",
    title: "ورزش‌ها",
    path: "/p-admin/admin-sports",
    modules: [
      {
        key: "sports",
        title: "ورزش‌ها",
        description: "رشته‌های ورزشی فروشگاه",
        path: "/p-admin/admin-sports",
        api: ["/api/sports"],
        permissions: [
          { key: "view", title: "مشاهده ورزش‌ها" },
          { key: "create", title: "ایجاد ورزش" },
          { key: "edit", title: "ویرایش ورزش" },
          { key: "delete", title: "حذف ورزش" },
          { key: "reorder", title: "تغییر ترتیب نمایش" },
        ],
      },
      {
        key: "categories",
        title: "دسته‌بندی‌ها",
        description: "دسته‌بندی‌های هر ورزش و محصولات آن‌ها",
        path: "/p-admin/admin-categories",
        api: ["/api/categories"],
        permissions: [
          { key: "view", title: "مشاهده دسته‌بندی‌ها" },
          { key: "create", title: "ایجاد دسته‌بندی" },
          { key: "edit", title: "ویرایش دسته‌بندی" },
          { key: "delete", title: "حذف دسته‌بندی" },
          { key: "reorder", title: "تغییر ترتیب نمایش" },
        ],
      },
      {
        key: "athletes",
        title: "ورزشکاران",
        description: "ورزشکاران معرفی‌شده در سایت",
        path: "/p-admin/admin-athletes",
        api: ["/api/athletes"],
        permissions: [
          { key: "view", title: "مشاهده ورزشکاران" },
          { key: "create", title: "ایجاد ورزشکار" },
          { key: "edit", title: "ویرایش ورزشکار" },
          { key: "delete", title: "حذف ورزشکار" },
        ],
      },
    ],
  },

  {
    key: "brands",
    title: "برندها",
    path: "/p-admin/admin-brands",
    modules: [
      {
        key: "brands",
        title: "برندها",
        description: "برندها و اطلاعات آن‌ها",
        path: "/p-admin/admin-brands",
        api: ["/api/brands"],
        permissions: [
          { key: "view", title: "مشاهده برندها" },
          { key: "create", title: "ایجاد برند" },
          { key: "edit", title: "ویرایش برند" },
          { key: "delete", title: "حذف برند" },
          { key: "reorder", title: "تغییر ترتیب نمایش" },
        ],
      },
      {
        key: "series",
        title: "سری‌ها",
        description: "سری‌های محصولات هر برند",
        path: "/p-admin/admin-brands",
        api: ["/api/series"],
        permissions: [
          { key: "view", title: "مشاهده سری‌ها" },
          { key: "create", title: "ایجاد سری" },
          { key: "edit", title: "ویرایش سری" },
          { key: "delete", title: "حذف سری" },
        ],
      },
      {
        key: "limitedEditions",
        title: "لیمیتد ادیشن‌ها",
        // ⚠️ کاملاً متمایز از «کالکشن‌ها» (collections). لیمیتد ادیشن زیرمجموعه‌ی
        // برند است (models/LimitedEdition.js، صفحات admin-brands/[brandId]/
        // limited-editions/*) و کالکشن یک کمپین مستقل است (models/Event.js).
        description: "نسخه‌های محدود هر برند (مثل Roland Garros) — زیرمجموعه‌ی برند",
        path: "/p-admin/admin-brands",
        api: ["/api/limited-editions"],
        permissions: [
          { key: "view", title: "مشاهده لیمیتد ادیشن‌ها" },
          { key: "create", title: "ایجاد لیمیتد ادیشن" },
          { key: "edit", title: "ویرایش لیمیتد ادیشن" },
          { key: "delete", title: "حذف لیمیتد ادیشن" },
        ],
      },
    ],
  },

  {
    key: "orderFlows",
    title: "فرایند سفارش",
    path: "/p-admin/admin-order-flows",
    modules: [
      {
        key: "orderFlows",
        title: "فرایند سفارش",
        description: "گراف مراحل سفارش و سفارشی‌سازی محصول",
        path: "/p-admin/admin-order-flows",
        api: ["/api/admin/order-flows", "/api/order-flows"],
        permissions: [
          { key: "view", title: "مشاهده فرایندها" },
          { key: "create", title: "ایجاد فرایند" },
          { key: "edit", title: "ویرایش فرایند" },
          { key: "delete", title: "حذف فرایند" },
        ],
      },
    ],
  },

  {
    key: "products",
    title: "محصولات",
    path: "/p-admin/admin-products",
    modules: [
      {
        key: "products",
        title: "محصولات",
        description: "مدیریت کالاهای فروشگاه",
        path: "/p-admin/admin-products",
        api: ["/api/product"],
        permissions: [
          { key: "view", title: "مشاهده محصولات" },
          { key: "create", title: "ایجاد محصول" },
          { key: "edit", title: "ویرایش محصول" },
          { key: "delete", title: "حذف محصول" },
        ],
      },
      {
        key: "variants",
        title: "واریانت‌ها",
        description: "واریانت‌ها، موجودی و قیمت هر محصول",
        path: "/p-admin/admin-products",
        api: ["/api/admin/variants", "/api/variants"],
        permissions: [
          { key: "view", title: "مشاهده واریانت‌ها" },
          { key: "edit", title: "ویرایش واریانت و موجودی" },
        ],
      },
    ],
  },

  {
    key: "collections",
    title: "کالکشن‌ها",
    path: "/p-admin/admin-events",
    modules: [
      {
        key: "collections",
        title: "کالکشن‌ها",
        description: "کمپین‌ها و کالکشن‌های فصلی با هویت بصری مستقل",
        path: "/p-admin/admin-events/campaigns",
        api: ["/api/admin/events", "/api/events"],
        permissions: [
          { key: "view", title: "مشاهده کالکشن‌ها" },
          { key: "create", title: "ایجاد کالکشن" },
          { key: "edit", title: "ویرایش کالکشن" },
          { key: "publish", title: "انتشار / توقف کالکشن" },
          { key: "delete", title: "حذف کالکشن" },
        ],
      },
    ],
  },

  {
    key: "secondHand",
    title: "بازار دست دوم",
    path: "/p-admin/admin-secondHands",
    modules: [
      {
        key: "secondHand",
        title: "محصولات دست دوم",
        description: "آگهی‌های محصولات دست دوم",
        path: "/p-admin/admin-secondHands/used-products",
        api: ["/api/admin/used-products"],
        permissions: [
          { key: "view", title: "مشاهده محصولات دست دوم" },
          { key: "create", title: "ایجاد محصول دست دوم" },
          { key: "edit", title: "ویرایش محصول دست دوم" },
          { key: "delete", title: "حذف محصول دست دوم" },
        ],
      },
      {
        key: "healthCards",
        title: "کارت سلامت",
        description: "کارت سلامت و مقیاس سلامت کالای دست دوم",
        path: "/p-admin/admin-secondHands/healthcards",
        api: ["/api/admin/healthcards"],
        permissions: [
          { key: "view", title: "مشاهده کارت‌های سلامت" },
          { key: "create", title: "ایجاد کارت سلامت" },
          { key: "edit", title: "ویرایش کارت سلامت" },
          { key: "delete", title: "حذف کارت سلامت" },
        ],
      },
    ],
  },

  {
    key: "orders",
    title: "سفارشات",
    path: "/p-admin/admin-orders",
    modules: [
      {
        key: "orders",
        title: "سفارشات",
        description: "سفارش‌های مشتریان و وضعیت آن‌ها",
        path: "/p-admin/admin-orders",
        api: ["/api/admin/orders", "/api/orders"],
        permissions: [
          { key: "view", title: "مشاهده سفارشات" },
          // `orders.edit` در فاز ۵ برداشته شد: هیچ روتی اعمالش نمی‌کرد و چهار
          // کلیدِ زیر دقیقاً همان عملیات را ریزدانه پوشش می‌دهند. چون معلوم
          // نیست دارنده‌ی کلیدِ قدیمی کدام‌یک را باید بگیرد، در
          // AMBIGUOUS_PERMISSIONS ثبت شده تا مهاجرت صریح تصمیم بگیرد.
          { key: "changeStatus", title: "تغییر وضعیت سفارش" },
          { key: "editItems", title: "ویرایش اقلام سفارش" },
          { key: "adjustDiscount", title: "اعمال تخفیف دستی روی سفارش" },
          { key: "setCurrency", title: "تعیین نرخ ارز سفارش" },
        ],
      },
      {
        key: "orderTracking",
        title: "رهگیری اقلام سفارش",
        // مفهوم «انبار» عمداً حذف شد: در این پروژه هیچ صفحه/مدل/APIِ انبار
        // وجود ندارد. آنچه واقعاً هست، رهگیری و تخصیص کد رهگیری برای اقلام یک
        // سفارش است (api/admin/orders/tracking-items/lookup،
        // orders/used-product-tracking، orders/[orderId]/tracking).
        description: "رهگیری و تخصیص کد رهگیری اقلام هر سفارش",
        path: "/p-admin/admin-orders",
        api: [
          "/api/admin/orders/tracking-items/lookup",
          "/api/admin/orders/used-product-tracking",
        ],
        permissions: [
          { key: "view", title: "مشاهده رهگیری اقلام" },
          { key: "assign", title: "ثبت و تخصیص کد رهگیری" },
        ],
      },
      {
        key: "payments",
        title: "پرداخت‌ها",
        description: "رسیدهای بانکی و تأیید پرداخت سفارش",
        path: "/p-admin/admin-orders",
        api: ["/api/admin/payments", "/api/payments"],
        permissions: [
          { key: "view", title: "مشاهده پرداخت‌ها" },
          { key: "approve", title: "تأیید پرداخت" },
          { key: "reject", title: "رد پرداخت" },
          // PATCH /api/admin/payments/[id]/edit — اصلاح مبلغ/تاریخ رسید، که نه
          // تأیید است و نه رد؛ بدون این کلید مجبور بودیم آن را زیر approve
          // ببریم و دسترسی را گشادتر از واقعیت کنیم.
          { key: "edit", title: "ویرایش اطلاعات پرداخت" },
        ],
      },
    ],
  },

  {
    key: "sitePages",
    title: "صفحات سایت",
    path: "/p-admin/admin-pages",
    modules: [
      {
        key: "home",
        title: "صفحه اصلی سایت",
        description: "صفحه‌ی مرکزیِ بخش‌های ویترین (هاب)",
        path: "/p-admin/admin-home",
        api: [],
        permissions: [{ key: "view", title: "ورود به بخش صفحه اصلی" }],
      },
      // هر بخشِ ویترین یک صفحه‌ی واقعیِ جداگانه دارد؛ یک `home.edit` عمومی
      // اجازه‌ی پنهان‌کردن دقیقِ این صفحه‌ها را نمی‌داد.
      {
        key: "homeSlider",
        title: "اسلایدر اصلی",
        description: "تصاویر، متون و ترتیب اسلایدهای صفحه اول",
        path: "/p-admin/admin-home/slider",
        api: ["/api/admin/home-sliders", "/api/slides"],
        permissions: [
          { key: "view", title: "مشاهده اسلایدر اصلی" },
          { key: "edit", title: "ویرایش اسلایدر اصلی" },
        ],
      },
      {
        key: "homeBanners",
        title: "بنرهای گرید",
        description: "بنر افقی بزرگ، بنرهای عمودی کناری و نوار پایین صفحه",
        path: "/p-admin/admin-home/banners",
        api: ["/api/banners"],
        permissions: [
          { key: "view", title: "مشاهده بنرها" },
          { key: "edit", title: "ویرایش بنرها" },
        ],
      },
      {
        key: "homeProductSliders",
        title: "اسلایدرهای محصول",
        description: "چیدمان «پرفروش‌ها» و «شگفت‌انگیزها»",
        path: "/p-admin/admin-home/product-sliders",
        api: ["/api/admin/home-sliders"],
        permissions: [
          { key: "view", title: "مشاهده اسلایدرهای محصول" },
          { key: "edit", title: "ویرایش اسلایدرهای محصول" },
        ],
      },
      {
        key: "homeRolandGarros",
        title: "بنر رولند گاروس",
        description: "متون، تصویر و لینک دکمه‌ی بنر رولند گاروس",
        path: "/p-admin/admin-home/roland-garros",
        api: ["/api/admin/home-roland-garros"],
        permissions: [
          { key: "view", title: "مشاهده بنر رولند گاروس" },
          { key: "edit", title: "ویرایش بنر رولند گاروس" },
        ],
      },
      {
        key: "homeFeaturedArticles",
        title: "مقالات منتخب",
        description: "انتخاب مقاله برای ۸ جایگاه پازل صفحه اصلی",
        path: "/p-admin/admin-home/featured-articles",
        api: ["/api/admin/site-settings?key=home_featured_article_ids"],
        permissions: [
          { key: "view", title: "مشاهده مقالات منتخب" },
          { key: "edit", title: "ویرایش مقالات منتخب" },
        ],
      },
      {
        key: "navbar",
        title: "منوی ناوبری سایت",
        description: "باطل‌سازی دستیِ کشِ منو پس از تغییر ورزش/برند/دسته‌بندی",
        path: "/p-admin/admin-pages",
        api: ["/api/navbar"],
        permissions: [{ key: "revalidate", title: "باطل‌سازی کش منو" }],
      },
      {
        key: "pages",
        title: "صفحات محتوایی",
        description: "صفحات اطلاع‌رسانی بلوک‌محور (CMS)",
        path: "/p-admin/admin-pages",
        api: ["/api/admin/pages"],
        // مجموعه‌ی صفحات ثابت است (PAGE_SLUGS در src/lib/pageDefaults.js)؛
        // نه ساختی هست نه حذفی. `create` و `delete` در فاز ۵ بازنشسته شدند.
        permissions: [
          { key: "view", title: "مشاهده صفحات" },
          { key: "edit", title: "ویرایش محتوای صفحه" },
          { key: "publish", title: "انتشار / برداشتن از انتشار صفحه" },
        ],
      },
    ],
  },

  {
    key: "finance",
    title: "مدیریت مالی",
    path: "/p-admin/financial",
    modules: [
      // ⚠️ عمداً هیچ ماژول/کلیدِ عمومیِ `finance` وجود ندارد.
      // صفحه‌ی /p-admin/financial محتوای مستقلی ندارد: فقط PageHeader + چهار تبِ
      // واقعی (bank / exchange / financing / review-credit) و سه لینک بیرونی
      // (analytics / installments / discounts) است و پیش‌فرض روی تبِ «حساب
      // بانکی» باز می‌شود. پس یک کلیدِ `finance.view` در عمل یعنی «دیدن حساب
      // بانکی» — یک meta-permission که قابلیتِ واقعی نیست و دسترسی را گشادتر
      // از چیزی می‌کند که نامش نشان می‌دهد. دسترسی به هاب از روی *فرزندان*
      // محاسبه می‌شود (ADMIN_ROUTE_PERMISSIONS + ADMIN_ROUTE_ANY_MODE).
      //
      // هر تبِ صفحه‌ی مالی یک قابلیت مستقل با کلید تنظیماتِ خودش است؛
      // `/api/admin/site-settings` یک key-value عمومی است، پس مالکیتِ آن با
      // پارامتر `key` تفکیک شده تا دو ماژول یک منبع را ادعا نکنند.
      {
        key: "bankAccount",
        title: "حساب بانکی",
        description: "اطلاعات حساب بانکی فروشگاه",
        path: "/p-admin/financial",
        api: ["/api/admin/site-settings?key=bank_account_details"],
        permissions: [
          { key: "view", title: "مشاهده حساب بانکی" },
          { key: "edit", title: "ویرایش حساب بانکی" },
        ],
      },
      {
        key: "exchangeRate",
        title: "نرخ تبدیل ارز",
        description: "نرخ تبدیل ارز مبنای قیمت‌گذاری",
        path: "/p-admin/financial",
        api: ["/api/admin/exchange-rate"],
        permissions: [
          { key: "view", title: "مشاهده نرخ ارز" },
          { key: "edit", title: "ویرایش نرخ ارز" },
        ],
      },
      {
        key: "financingSettings",
        title: "تنظیمات اقساط",
        description: "نرخ ماهانه و پارامترهای فروش اقساطی",
        path: "/p-admin/financial",
        api: ["/api/admin/site-settings?key=monthly_installment_rate"],
        permissions: [
          { key: "view", title: "مشاهده تنظیمات اقساط" },
          { key: "edit", title: "ویرایش تنظیمات اقساط" },
        ],
      },
      {
        key: "reviewCredit",
        title: "پاداش نظر",
        description: "پیکربندی اعتبار پاداشِ ثبت نظر",
        path: "/p-admin/financial",
        api: ["/api/admin/site-settings?key=review_credit_config"],
        permissions: [
          { key: "view", title: "مشاهده تنظیمات پاداش نظر" },
          { key: "edit", title: "ویرایش تنظیمات پاداش نظر" },
        ],
      },
      {
        key: "analytics",
        title: "تحلیل و هوش فروش",
        description: "گزارش‌های درآمد، وصولی، معوق و نرخ وصول",
        path: "/p-admin/financial/analytics",
        api: ["/api/admin/analytics"],
        permissions: [
          { key: "view", title: "مشاهده گزارش‌های تحلیلی" },
          { key: "export", title: "خروجی گرفتن (Excel/CSV)" },
        ],
      },
      {
        key: "installments",
        title: "اقساط",
        description: "چک‌های اقساطی، سررسیدها و وصول",
        path: "/p-admin/financial/installments",
        api: [
          "/api/admin/installments",
          "/api/admin/installment-balance",
          "/api/installments",
        ],
        permissions: [
          { key: "view", title: "مشاهده اقساط" },
          { key: "edit", title: "ویرایش چک‌ها و اطلاعات اقساط" },
          { key: "approveCheck", title: "تأیید / وصول چک" },
        ],
      },
      {
        key: "discounts",
        title: "تخفیف‌ها",
        description: "قوانین تخفیف، تخفیف تعدادی و کدهای تخفیف",
        path: "/p-admin/discounts",
        api: [
          "/api/admin/discounts",
          "/api/admin/quantity-discounts",
          "/api/admin/coupons",
        ],
        permissions: [
          { key: "view", title: "مشاهده تخفیف‌ها" },
          { key: "create", title: "ایجاد تخفیف" },
          { key: "edit", title: "ویرایش تخفیف" },
          { key: "delete", title: "حذف تخفیف" },
        ],
      },
    ],
  },

  {
    key: "users",
    title: "کاربران",
    path: "/p-admin/users",
    modules: [
      {
        key: "users",
        title: "کاربران سایت",
        description: "اعضای سایت، نقش کسب‌وکاری و وضعیت حساب",
        path: "/p-admin/users",
        api: ["/api/admin/users"],
        permissions: [
          { key: "view", title: "مشاهده کاربران" },
          { key: "edit", title: "ویرایش کاربران" },
          { key: "ban", title: "مسدودسازی کاربران" },
          // PATCH /api/admin/users/[userId] می‌تواند role را عوض کند و
          // `role: "admin"` از مسیر legacy مستقیماً دسترسی پنل می‌دهد. این
          // یک ارتقای دسترسی است، نه «ویرایش کاربر»، پس کلید جدا دارد.
          { key: "changeRole", title: "تغییر نقش کاربر" },
          // walletBalance پول است، نه فیلدِ پروفایل. زیر users.edit بودنش یعنی
          // هرکس بتواند نام کاربر را اصلاح کند، می‌توانست موجودی کیف پولش را
          // هم تغییر دهد.
          { key: "adjustWallet", title: "تغییر موجودی کیف پول کاربر" },
        ],
      },
      {
        key: "coaches",
        title: "مربیان",
        description: "درخواست‌های مربیگری، کدها، اعتبار و کیف پول مربیان",
        path: "/p-admin/users/coaches",
        api: [
          "/api/admin/coaches",
          "/api/admin/coach-applications",
          "/api/admin/coach-credits",
        ],
        permissions: [
          { key: "view", title: "مشاهده مربیان" },
          { key: "manage", title: "مدیریت مربیان و درخواست‌ها" },
          { key: "manageCredits", title: "مدیریت اعتبار و کیف پول مربیان" },
        ],
      },
      {
        key: "admins",
        title: "ادمین‌های پنل",
        description: "عضویت ادمین‌ها در پنل، فعال‌سازی و لغو دسترسی",
        path: "/p-admin/users/admins",
        api: ["/api/admin/admins"],
        permissions: [
          { key: "view", title: "مشاهده ادمین‌ها" },
          { key: "create", title: "افزودن ادمین" },
          { key: "edit", title: "ویرایش ادمین" },
          { key: "activate", title: "فعال‌سازی ادمین" },
          { key: "revoke", title: "لغو دسترسی ادمین" },
          { key: "managePermissions", title: "مدیریت دسترسی‌های اختصاصی" },
          { key: "viewActivity", title: "مشاهده تاریخچه فعالیت ادمین‌ها" },
        ],
      },
      {
        key: "roles",
        title: "نقش‌های ادمین",
        description: "قالب‌های دسترسی نام‌دار",
        path: "/p-admin/users/admins",
        api: ["/api/admin/roles", "/api/admin/permissions"],
        permissions: [
          { key: "view", title: "مشاهده نقش‌ها" },
          { key: "create", title: "ایجاد نقش" },
          { key: "edit", title: "ویرایش نقش" },
          { key: "delete", title: "حذف نقش" },
        ],
      },
      {
        key: "userNotifications",
        title: "اطلاع‌رسانی به کاربران",
        description: "پیام‌های همگانی ادمین به کاربران",
        path: "/p-admin/users/notifications",
        api: ["/api/admin/user-notifications"],
        permissions: [
          { key: "view", title: "مشاهده اطلاع‌رسانی‌ها" },
          { key: "send", title: "ارسال اطلاع‌رسانی" },
        ],
      },
    ],
  },

  {
    key: "support",
    title: "پشتیبانی",
    path: "/p-admin/support",
    modules: [
      {
        key: "tickets",
        title: "تیکت‌ها",
        description: "تیکت‌های پشتیبانی کاربران",
        path: "/p-admin/support?tab=tickets",
        api: ["/api/admin/tickets", "/api/tickets"],
        permissions: [
          { key: "view", title: "مشاهده تیکت‌ها" },
          { key: "reply", title: "پاسخ به تیکت" },
          { key: "close", title: "بستن / تغییر وضعیت تیکت" },
        ],
      },
      {
        key: "comments",
        title: "نظرات",
        description: "بازبینی و تأیید نظرات محصولات",
        path: "/p-admin/support?tab=comments",
        api: ["/api/admin/comments", "/api/comments"],
        permissions: [
          { key: "view", title: "مشاهده نظرات" },
          { key: "moderate", title: "تأیید / رد نظر" },
          { key: "delete", title: "حذف نظر" },
        ],
      },
      {
        key: "contactMessages",
        title: "پیام‌های تماس",
        description: "صندوق پیام‌های فرم تماس با ما",
        path: "/p-admin/support?tab=messages",
        api: ["/api/admin/contact-messages"],
        permissions: [
          { key: "view", title: "مشاهده پیام‌ها" },
          { key: "manage", title: "پاسخ / بستن پیام" },
        ],
      },
    ],
  },

  {
    key: "articles",
    title: "مقالات",
    path: "/p-admin/admin-articles",
    modules: [
      {
        key: "articles",
        title: "مقالات",
        description: "مدیریت مقالات، انتشار و نسخه‌ها",
        path: "/p-admin/admin-articles",
        api: ["/api/admin/articles", "/api/admin/article-cms"],
        permissions: [
          { key: "view", title: "مشاهده مقالات" },
          { key: "create", title: "ایجاد مقاله" },
          { key: "edit", title: "ویرایش و نسخه‌ها" },
          { key: "publish", title: "انتشار و زمان‌بندی" },
          { key: "delete", title: "انتقال به زباله‌دان" },
        ],
      },
      {
        key: "articleTaxonomy",
        title: "دسته‌بندی و برچسب مقالات",
        description: "دسته‌بندی‌ها و برچسب‌های بخش مقالات",
        path: "/p-admin/admin-articles/settings",
        api: ["/api/admin/article-categories", "/api/admin/article-tags"],
        permissions: [
          { key: "view", title: "مشاهده دسته‌بندی و برچسب" },
          { key: "manage", title: "مدیریت دسته‌بندی و برچسب" },
        ],
      },
    ],
  },

  {
    key: "tools",
    title: "ابزارها",
    // بدون آیتم سایدبار — این اکشن‌ها داخل فرم‌های بخش‌های دیگر ظاهر می‌شوند.
    path: null,
    modules: [
      {
        key: "ai",
        title: "دستیار هوش مصنوعی",
        // فقط دو اکشنِ واقعاً موجود. صفحه/APIِ «مصرف و هزینه» وجود ندارد،
        // بنابراین هیچ کلیدِ usage تعریف نشده است.
        description:
          "تولید پیش‌نویس محصول و پرامپت ورزشکار — صفحه‌ی مستقل ندارد و داخلِ جریان‌های «ساخت محصول» و «ساخت ورزشکار» ظاهر می‌شود",
        path: null,
        api: ["/api/ai/product-draft", "/api/ai/athlete-prompt"],
        permissions: [
          { key: "productDraft", title: "تولید پیش‌نویس محصول با AI" },
          { key: "athletePrompt", title: "تولید پرامپت ورزشکار با AI" },
        ],
      },
    ],
  },
];

/* ────────────────────────────────────────────────────────────────────────────
 * کلیدهای بازنشسته و مبهم
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * کلیدهای بازنشسته.
 *
 *  action: "rewrite" → معنایش تأیید شده و معادل قطعی دارد (`replacement`).
 *  action: "drop"    → معادلِ تأییدشده‌ای وجود ندارد؛ حدس زده نمی‌شود و
 *                      مهاجرت آن را حذف و گزارش می‌کند (fail-closed).
 *
 * `replacement` می‌تواند چند کلید باشد (مثل home.edit که دقیقاً پنج صفحه‌ی
 * ویترین را پوشش می‌داد).
 */
export const RETIRED_PERMISSIONS = {
  // ماژول انبار هیچ‌گاه صفحه/مدل/API نداشت؛ رهگیری اقلامِ سفارش قابلیتِ
  // دیگری است و معادل بودنشان تأیید نشده → حذف، نه نگاشت.
  "inventory.view": {
    action: "drop",
    replacement: [],
    reason:
      "ماژول «انبار» در پنل وجود خارجی نداشت. رهگیری اقلام سفارش (orderTracking) قابلیت دیگری است و هم‌معنا بودنشان تأیید نشد.",
  },
  "inventory.create": {
    action: "drop",
    replacement: [],
    reason: "ماژول «انبار» در پنل وجود خارجی نداشت.",
  },
  "inventory.edit": {
    action: "drop",
    replacement: [],
    reason: "ماژول «انبار» در پنل وجود خارجی نداشت.",
  },

  // ── فاز ۵ — CMS مجموعه‌ی ثابتی از اسلاگ‌ها دارد؛ این دو عملیات هرگز
  // وجود نداشتند و هیچ روتی هم برایشان نبود.
  "pages.create": {
    action: "drop",
    replacement: [],
    reason:
      "صفحات CMS مجموعه‌ی ثابتی از اسلاگ‌ها هستند (PAGE_SLUGS)؛ «ایجاد صفحه» در پنل وجود ندارد.",
  },
  "pages.delete": {
    action: "drop",
    replacement: [],
    reason: "صفحات CMS حذف نمی‌شوند؛ فقط محتوایشان ویرایش و انتشارشان قطع می‌شود.",
  },

  // عنوان کلید قدیمی دقیقاً «مدیریت مربیان» بود → نگاشت قطعی.
  "users.manageCoaches": {
    action: "rewrite",
    replacement: ["coaches.manage"],
    reason: "مدیریت مربیان به ماژول مستقل coaches منتقل شد (عنوان قدیمی عیناً همین بود).",
  },

  // تنها اکشنِ ویرایشیِ بخش «صفحه اصلی» بود و آن بخش دقیقاً همین پنج صفحه است.
  "home.edit": {
    action: "rewrite",
    replacement: [
      "homeSlider.edit",
      "homeBanners.edit",
      "homeProductSliders.edit",
      "homeRolandGarros.edit",
      "homeFeaturedArticles.edit",
    ],
    reason:
      "بخش «صفحه اصلی» به پنج صفحه‌ی واقعی تفکیک شد؛ home.edit تنها اکشن ویرایشی همین پنج صفحه بود.",
  },

};

/** کاندیدهای مالی — هفت قابلیتِ واقعیِ جایگزینِ کلیدهای عمومیِ قدیمی. */
const FINANCE_VIEW_KEYS = [
  "bankAccount.view",
  "exchangeRate.view",
  "financingSettings.view",
  "reviewCredit.view",
  "analytics.view",
  "installments.view",
  "discounts.view",
];

/**
 * کلیدهای مبهم — هیچ map یا بازنویسیِ خودکاری نباید انجام شود.
 *
 * `events.*` در رجیستری قبلی با عنوان «لیمیتد ادیشن» تعریف شده بود، ولی بخشِ
 * پنل با همان مسیر امروز «کالکشن‌ها» (models/Event.js) است. پس داده‌ی موجود
 * می‌تواند هرکدام را قصد کرده باشد → fail closed: دست‌نخورده می‌ماند، گزارش
 * می‌شود، و چون کلید معتبری نیست هیچ دسترسی‌ای هم نمی‌دهد.
 */
export const AMBIGUOUS_PERMISSIONS = {
  "events.view": { candidates: ["collections.view", "limitedEditions.view"] },
  "events.create": { candidates: ["collections.create", "limitedEditions.create"] },
  "events.edit": { candidates: ["collections.edit", "limitedEditions.edit"] },
  "events.delete": { candidates: ["collections.delete", "limitedEditions.delete"] },

  // کلیدهای عمومیِ مالی هم مبهم‌اند، نه «قابل حذف».
  //
  // برخلاف inventory.* که هیچ قابلیتِ متناظری در پنل نداشت (پس حذفش چیزی را
  // از دست نمی‌دهد)، بخش مالی هفت قابلیتِ واقعی دارد. عنوان قدیمی
  // finance.view «مشاهده گزارش‌های مالی» بود که به analytics اشاره دارد، ولی
  // مسیرِ همان ماژول /p-admin/financial بود که *گزارش* نیست و تنظیمات است.
  // پس نگاشت قطعی نیست و حدس زدنش یا دسترسی را گشاد می‌کند یا بی‌صدا از بین
  // می‌برد → مسدودکننده تا تعیین تکلیفِ انسانی.
  // فاز ۵: «ویرایش سفارش» به چهار عملیاتِ ماهیتاً متفاوت تفکیک شد. دادنِ
  // خودکارِ هر چهار اختیار به دارنده‌ی کلیدِ قدیمی، ارتقای بی‌صدای دسترسی بود.
  "orders.edit": {
    candidates: [
      "orders.changeStatus",
      "orders.editItems",
      "orders.adjustDiscount",
      "orders.setCurrency",
    ],
  },

  "finance.view": { candidates: FINANCE_VIEW_KEYS },
  "finance.manage": {
    candidates: [
      "bankAccount.edit",
      "exchangeRate.edit",
      "financingSettings.edit",
      "reviewCredit.edit",
      "installments.edit",
      "discounts.edit",
    ],
  },
};

/* ────────────────────────────────────────────────────────────────────────────
 * نقش سیستمیِ محافظت‌شده
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * شناسه‌ی داخلی و پایدارِ نقشِ «دسترسی کامل».
 * هویت نقش هرگز از روی «نام نمایشی» تشخیص داده نمی‌شود — نام قابل تغییر و
 * قابل جعل است. تنها معیارها: systemKey، یا پرچم‌های isSystem+isFullAccess.
 */
export const SUPER_ADMIN_SYSTEM_KEY = "super-admin";

/** نام نمایشیِ پیش‌فرض هنگام ساخت (فقط نمایش — هرگز معیار تشخیص نیست). */
export const SUPER_ADMIN_ROLE_NAME = "دسترسی کامل";

/** فیلدهایی که هیچ‌گاه از طریق API قابل نوشتن نیستند. */
export const PROTECTED_ROLE_FIELDS = ["isSystem", "isFullAccess", "systemKey"];

/** آیا این سند نقشِ محافظت‌شده است؟ (API حق ویرایش/حذفش را ندارد) */
export function isProtectedRole(role) {
  if (!role) return false;
  return (
    role.systemKey === SUPER_ADMIN_SYSTEM_KEY ||
    !!role.isFullAccess ||
    !!role.isSystem
  );
}

/**
 * حذف فیلدهای محافظت‌شده از payload ورودیِ API.
 * خروجی: { payload, rejected } — `rejected` برای پاسخ ۴۲۲/لاگ.
 */
export function stripProtectedRoleFields(body) {
  const payload = { ...(body || {}) };
  const rejected = PROTECTED_ROLE_FIELDS.filter((f) => f in payload);
  for (const field of rejected) delete payload[field];
  return { payload, rejected };
}

/* ────────────────────────────────────────────────────────────────────────────
 * ساخت ساختارهای مشتق‌شده
 * ──────────────────────────────────────────────────────────────────────────── */

/** کلید کامل یک دسترسی: `${moduleKey}.${actionKey}` */
export function buildPermissionKey(moduleKey, actionKey) {
  return `${moduleKey}.${actionKey}`;
}

// قرارداد وابستگی: هر اکشنِ غیر از `view` به‌صورت پیش‌فرض به `<module>.view`
// وابسته است، مگر آنکه صریحاً requires تعریف شده باشد.
function buildModule(mod, section) {
  const viewKey = mod.permissions.some((p) => p.key === "view")
    ? buildPermissionKey(mod.key, "view")
    : null;

  return {
    key: mod.key,
    title: mod.title,
    description: mod.description || "",
    section: section.key,
    sectionTitle: section.title,
    path: mod.path || section.path || null,
    api: mod.api || [],
    permissions: mod.permissions.map((p) => {
      const key = buildPermissionKey(mod.key, p.key);
      const requires =
        p.requires !== undefined
          ? p.requires
          : p.key !== "view" && viewKey
            ? [viewKey]
            : [];
      return { key: p.key, fullKey: key, title: p.title, requires };
    }),
  };
}

/** بخش‌های پنل با ماژول‌ها و اکشن‌های کامل (ساختار سلسله‌مراتبی) */
export const PERMISSION_SECTIONS = SECTION_DEFINITIONS.map((section) => ({
  key: section.key,
  title: section.title,
  path: section.path ?? null,
  modules: section.modules.map((mod) => buildModule(mod, section)),
}));

/**
 * نمای تخت ماژول‌ها — سازگارِ عقب با UI موجود (`/api/admin/permissions` و
 * PermissionPicker) که انتظار `{ key, title, description, permissions:[{key,title}] }`
 * دارد؛ فیلدهای section/path/api صرفاً افزوده شده‌اند.
 */
export const PERMISSION_MODULES = PERMISSION_SECTIONS.flatMap((s) => s.modules);

const MODULE_BY_KEY = new Map(PERMISSION_MODULES.map((m) => [m.key, m]));

const PERMISSION_META = new Map(
  PERMISSION_MODULES.flatMap((mod) =>
    mod.permissions.map((p) => [
      p.fullKey,
      {
        key: p.fullKey,
        action: p.key,
        title: p.title,
        requires: p.requires,
        module: mod.key,
        moduleTitle: mod.title,
        section: mod.section,
        sectionTitle: mod.sectionTitle,
        path: mod.path,
        api: mod.api,
      },
    ])
  )
);

const ALL_KEYS = [...PERMISSION_META.keys()];
const ALL_KEYS_SET = new Set(ALL_KEYS);

/* ────────────────────────────────────────────────────────────────────────────
 * نگاشت روت‌های پنل → دسترسی
 * پوشش‌دهنده‌ی هر ۸۱ صفحه‌ی واقعیِ زیر src/app/(Admin-Panel)/p-admin
 * (تست tests/adminRbac.test.mjs تطابق ۱به۱ با فایل‌سیستم را بررسی می‌کند).
 * ──────────────────────────────────────────────────────────────────────────── */

export const ADMIN_ROUTE_PERMISSIONS = {
  "/p-admin": ["dashboard.view"],

  // مقالات
  "/p-admin/admin-articles": ["articles.view"],
  // ⚠️ این روت ویرایشگرِ کامل را رندر می‌کند (ArticleEditor)، نه نمای فقط‌خواندنی.
  // با کلیدِ قبلیِ articles.view، ادمینی که فقط اجازه‌ی دیدن داشت ویرایشگر را
  // باز می‌کرد و تازه هنگام ذخیره ۴۰۳ می‌گرفت. مسیرِ خواندن، `/preview` است.
  "/p-admin/admin-articles/[articleId]": ["articles.edit"],
  "/p-admin/admin-articles/[articleId]/preview": ["articles.view"],
  "/p-admin/admin-articles/add-artlicle": ["articles.create"],
  "/p-admin/admin-articles/new": ["articles.create"],
  "/p-admin/admin-articles/edit-article/[articleId]": ["articles.edit"],
  "/p-admin/admin-articles/settings": ["articleTaxonomy.view"],

  // ورزشکاران
  "/p-admin/admin-athletes": ["athletes.view"],
  "/p-admin/admin-athletes/add": ["athletes.create"],
  "/p-admin/admin-athletes/edit/[athleteId]": ["athletes.edit"],

  // برندها / سری‌ها / لیمیتد ادیشن‌ها
  "/p-admin/admin-brands": ["brands.view"],
  "/p-admin/admin-brands/add": ["brands.create"],
  "/p-admin/admin-brands/edit/[brandId]": ["brands.edit"],
  "/p-admin/admin-brands/[brandId]": ["brands.view"],
  "/p-admin/admin-brands/[brandId]/add-serie": ["series.create"],
  "/p-admin/admin-brands/[brandId]/[serieId]": ["series.view"],
  "/p-admin/admin-brands/[brandId]/[serieId]/edit": ["series.edit"],
  "/p-admin/admin-brands/[brandId]/[serieId]/products": [
    "series.view",
    "products.view",
  ],
  "/p-admin/admin-brands/[brandId]/limited-editions/add": [
    "limitedEditions.create",
  ],
  "/p-admin/admin-brands/[brandId]/limited-editions/[limitedEditionId]/edit": [
    "limitedEditions.edit",
  ],

  // دسته‌بندی‌ها
  "/p-admin/admin-categories": ["categories.view"],
  "/p-admin/admin-categories/add": ["categories.create"],
  "/p-admin/admin-categories/edit/[categoryId]": ["categories.edit"],
  "/p-admin/admin-categories/category-products/[categoryId]": [
    "categories.view",
    "products.view",
  ],
  "/p-admin/admin-categories/category-products/[categoryId]/add-product": [
    "products.create",
  ],

  // نظرات (ریدایرکت به مرکز پشتیبانی)
  "/p-admin/admin-comments": ["comments.view"],

  // کالکشن‌ها
  "/p-admin/admin-events": ["collections.view"],
  "/p-admin/admin-events/campaigns": ["collections.view"],
  "/p-admin/admin-events/campaigns/new": ["collections.create"],
  "/p-admin/admin-events/campaigns/[id]": ["collections.edit"],

  // صفحه اصلی سایت
  "/p-admin/admin-home": ["home.view"],
  "/p-admin/admin-home/banners": ["homeBanners.view"],
  "/p-admin/admin-home/featured-articles": ["homeFeaturedArticles.view"],
  "/p-admin/admin-home/product-sliders": ["homeProductSliders.view"],
  "/p-admin/admin-home/roland-garros": ["homeRolandGarros.view"],
  "/p-admin/admin-home/slider": ["homeSlider.view"],
  "/p-admin/admin-home/slider/create": ["homeSlider.edit"],
  "/p-admin/admin-home/slider/edit/[id]": ["homeSlider.edit"],

  // فرایند سفارش
  "/p-admin/admin-order-flows": ["orderFlows.view"],
  "/p-admin/admin-order-flows/create": ["orderFlows.create"],
  "/p-admin/admin-order-flows/edit/[flowId]": ["orderFlows.edit"],

  // سفارشات
  "/p-admin/admin-orders": ["orders.view"],
  "/p-admin/admin-orders/[orderId]": ["orders.view"],

  // صفحات سایت — هابِ دو تبی (?tab=home | ?tab=content). مسیر پایه با هر کدام
  // از دو قابلیت باز می‌شود؛ تبِ صریح در ADMIN_TAB_PERMISSIONS دقیق می‌ماند.
  "/p-admin/admin-pages": ["home.view", "pages.view"],
  "/p-admin/admin-pages/[slug]": ["pages.edit"],

  // محصولات و واریانت‌ها
  "/p-admin/admin-products": ["products.view"],
  "/p-admin/admin-products/add": ["products.create"],
  "/p-admin/admin-products/edit/[productId]": ["products.edit"],
  "/p-admin/admin-products/[productId]/variants": ["variants.view"],
  "/p-admin/admin-products/[productId]/variants/add": ["variants.edit"],

  // بازار دست دوم
  "/p-admin/admin-secondHands": ["secondHand.view"],
  "/p-admin/admin-secondHands/used-products": ["secondHand.view"],
  "/p-admin/admin-secondHands/used-products/create": ["secondHand.create"],
  "/p-admin/admin-secondHands/used-products/[id]/edit": ["secondHand.edit"],
  "/p-admin/admin-secondHands/healthcards": ["healthCards.view"],
  "/p-admin/admin-secondHands/healthcards/create": ["healthCards.create"],
  "/p-admin/admin-secondHands/healthcards/[id]/edit": ["healthCards.edit"],

  // ورزش‌ها
  "/p-admin/admin-sports": ["sports.view"],
  "/p-admin/admin-sports/add": ["sports.create"],
  "/p-admin/admin-sports/edit/[sportId]": ["sports.edit"],
  "/p-admin/admin-sports/[sportId]": ["sports.view"],
  "/p-admin/admin-sports/[sportId]/athletes": ["athletes.view"],

  // مالی
  "/p-admin/discounts": ["discounts.view"],
  "/p-admin/exchange-rate": ["exchangeRate.view"],
  // هاب مالی: هر کدام از قابلیت‌های واقعیِ فرزند کافی است (حالت any).
  // فاز UI فقط تب‌ها/لینک‌های مجاز و اولین تبِ مجاز را نشان می‌دهد.
  "/p-admin/financial": FINANCE_VIEW_KEYS,
  "/p-admin/financial/analytics": ["analytics.view"],
  "/p-admin/financial/installments": ["installments.view"],
  "/p-admin/financial/installments/[id]": ["installments.view"],

  // پشتیبانی
  "/p-admin/support": ["tickets.view", "comments.view", "contactMessages.view"],
  "/p-admin/support/messages": ["contactMessages.view"],
  "/p-admin/support/tickets/[id]": ["tickets.view"],

  // کاربران
  "/p-admin/users": ["users.view"],
  "/p-admin/users/[userId]": ["users.view"],
  "/p-admin/users/admins": ["admins.view"],
  "/p-admin/users/admins/add": ["admins.create"],
  // صفحه‌ی جزئیات + تاریخچه‌ی فعالیت (فاز ۶). خودِ خطِ زمانی داخلِ صفحه با
  // admins.viewActivity گیت می‌شود، پس بازکردنِ صفحه فقط admins.view می‌خواهد.
  "/p-admin/users/admins/[adminId]": ["admins.view"],
  "/p-admin/users/admins/edit/[adminId]": ["admins.edit"],
  "/p-admin/users/coaches": ["coaches.view"],
  "/p-admin/users/coaches/[coachId]": ["coaches.view"],
  "/p-admin/users/coaches/[coachId]/credit/[orderId]": ["coaches.manageCredits"],
  "/p-admin/users/notifications": ["userNotifications.view"],
};

/**
 * روت‌هایی که با query-tab تفکیک می‌شوند.
 *
 * فقط تب‌هایی اینجا هستند که *واقعاً* در URL همگام می‌شوند — بر اساس خودِ
 * کامپوننت‌ها، نه حدس:
 *   • src/app/(Admin-Panel)/p-admin/support/page.jsx
 *       VALID = { tickets, comments, messages } + router.replace(`?tab=`)
 *   • src/app/(Admin-Panel)/p-admin/admin-pages/page.jsx
 *       VALID = { home, content } + router.replace(`?tab=`)
 *
 * ⚠️ صفحه‌ی «مدیریت مالی» (financial/page.jsx) عمداً اینجا نیست: تب‌هایش
 * (bank / exchange / financing / review-credit) فقط useState محلی‌اند و هیچ
 * پارامتر URL ای ندارند؛ ساختنِ نگاشتِ query برایشان یعنی جعلِ قابلیتی که در
 * UI وجود ندارد. تفکیک دسترسی آن‌ها با کلیدهای ماژولیِ bankAccount/
 * exchangeRate/financingSettings/reviewCredit انجام می‌شود، نه با روت.
 */
export const ADMIN_TAB_PERMISSIONS = {
  "/p-admin/admin-pages?tab=home": ["home.view"],
  "/p-admin/admin-pages?tab=content": ["pages.view"],
  "/p-admin/support?tab=tickets": ["tickets.view"],
  "/p-admin/support?tab=comments": ["comments.view"],
  "/p-admin/support?tab=messages": ["contactMessages.view"],
};

/**
 * روت‌هایی که با «هر یک از» کلیدها باز می‌شوند (صفحه‌های هابِ چند‌قابلیتی).
 * بقیه‌ی روت‌ها حالت «همه‌ی کلیدها لازم است» دارند.
 */
export const ADMIN_ROUTE_ANY_MODE = new Set([
  "/p-admin/support",
  "/p-admin/financial",
  "/p-admin/admin-pages",
]);

/** روت‌هایی که manifest تب دارند — تبِ ناشناخته روی این‌ها fail-closed است. */
const TAB_AWARE_ROUTES = new Set(
  Object.keys(ADMIN_TAB_PERMISSIONS).map((key) => key.split("?")[0])
);

/* ────────────────────────────────────────────────────────────────────────────
 * تطبیق‌دهنده‌ی روت (canonical matcher)
 *
 * ورودی یک URLِ *واقعی* است (`/p-admin/admin-orders/507f1f77bcf86cd799439011`)،
 * نه الگو. الگوهای `[param]` از manifest بالا ساخته می‌شوند.
 *
 * قواعد:
 *   • slash انتهایی، اسلشِ تکراری و percent-encoding نرمال می‌شوند
 *   • ترتیب و وجودِ پارامترهای اضافه‌ی query بی‌اثر است (URLSearchParams)
 *   • انتخاب الگو قطعی است: هر segmentِ ثابت بر segmentِ داینامیک اولویت دارد
 *     (همان قاعده‌ی Next.js) و مقایسه lexicographic روی بردار امتیاز است
 *   • اگر دو الگو امتیاز *برابر* بگیرند → ابهام → fail-closed
 *   • روتِ ناشناخته → null → دسترسی رد می‌شود
 * ──────────────────────────────────────────────────────────────────────────── */

const DYNAMIC_SEGMENT = /^\[(\.\.\.)?[^[\]]+\]$/;

function compilePatterns(manifest) {
  return Object.keys(manifest).map((pattern) => ({
    pattern,
    segments: pattern
      .split("/")
      .filter(Boolean)
      .map((value) => ({ value, dynamic: DYNAMIC_SEGMENT.test(value) })),
  }));
}

const COMPILED_ROUTES = compilePatterns(ADMIN_ROUTE_PERMISSIONS);

/**
 * تجزیه‌ی امنِ ورودی به segmentهای decode‌شده + query.
 * خروجی null یعنی ورودی بدشکل است (مثلاً percent-encoding خراب).
 */
export function parseAdminUrl(input) {
  if (typeof input !== "string" || !input.trim()) return null;

  let url;
  try {
    // base ساختگی تا مسیرهای نسبی و مطلق هر دو پشتیبانی شوند
    url = new URL(input, "http://admin.invalid");
  } catch {
    return null;
  }

  let segments;
  try {
    segments = url.pathname
      .split("/")
      .filter(Boolean) // slash انتهایی و // تکراری
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return null; // percent-encoding نامعتبر
  }

  if (segments.some((segment) => segment.length === 0)) return null;

  return { segments, searchParams: url.searchParams };
}

// مقایسه‌ی بردار امتیاز: ثابت(۱) بر داینامیک(۰) اولویت دارد، از چپ به راست.
function compareSpecificity(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * تطبیق یک URL واقعی با manifest.
 *
 * خروجی:
 *   null                                   → روت ناشناخته
 *   { ambiguous: true, patterns: [...] }   → چند الگوی هم‌امتیاز (fail-closed)
 *   { pattern, params, permissions, mode, tab }
 *
 * پارامتر `manifest` فقط برای تست‌پذیریِ حالت ابهام قابل تزریق است.
 */
export function matchAdminRoute(input, manifest = null) {
  const parsed = parseAdminUrl(input);
  if (!parsed) return null;

  const compiled = manifest ? compilePatterns(manifest) : COMPILED_ROUTES;
  const table = manifest || ADMIN_ROUTE_PERMISSIONS;

  const matches = [];
  for (const candidate of compiled) {
    if (candidate.segments.length !== parsed.segments.length) continue;

    const params = {};
    let ok = true;
    for (let i = 0; i < candidate.segments.length; i += 1) {
      const segment = candidate.segments[i];
      const actual = parsed.segments[i];
      if (segment.dynamic) {
        params[segment.value.replace(/^\[\.{0,3}|\]$/g, "")] = actual;
      } else if (segment.value !== actual) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    matches.push({
      pattern: candidate.pattern,
      params,
      score: candidate.segments.map((s) => (s.dynamic ? 0 : 1)),
    });
  }

  if (!matches.length) return null;

  matches.sort((a, b) => compareSpecificity(b.score, a.score));
  const best = matches[0];
  const tied = matches.filter(
    (m) => compareSpecificity(m.score, best.score) === 0
  );
  if (tied.length > 1) {
    return { ambiguous: true, patterns: tied.map((m) => m.pattern) };
  }

  const base = {
    ambiguous: false,
    pattern: best.pattern,
    params: best.params,
    tab: null,
    unknownTab: false,
    duplicateTab: false,
  };

  // ── تبِ query — مستقل از ترتیب و از پارامترهای اضافه ──────────────────
  // فقط روی روت‌هایی که واقعاً manifest تب دارند سخت‌گیری می‌شود؛ `?tab=` روی
  // بقیه‌ی روت‌ها بی‌معنا و بی‌اثر است.
  if (TAB_AWARE_ROUTES.has(best.pattern)) {
    const tabValues = parsed.searchParams.getAll("tab");

    // `?tab=a&tab=b` — کدام مقصود است؟ حدس نمی‌زنیم.
    if (tabValues.length > 1) {
      return { ...base, duplicateTab: true, permissions: [], mode: "all" };
    }

    if (tabValues.length === 1) {
      const tabPermissions =
        ADMIN_TAB_PERMISSIONS[`${best.pattern}?tab=${tabValues[0]}`];

      // تبِ صریحِ ناشناخته → fail-closed.
      // fallback به کلیدهای پایه غلط بود: کامپوننت برای مقدار نامعتبر به تبِ
      // پیش‌فرض (tickets / home) می‌رود، پس کاربری که فقط comments.view دارد
      // با `?tab=zzz` عملاً وارد تیکت‌ها می‌شد.
      if (!tabPermissions) {
        return { ...base, unknownTab: true, permissions: [], mode: "all" };
      }

      return {
        ...base,
        tab: tabValues[0],
        permissions: tabPermissions,
        mode: "all",
      };
    }
  }

  // بدون تب → هاب. فاز UI اولین تبِ مجاز را انتخاب می‌کند.
  return {
    ...base,
    permissions: table[best.pattern],
    mode: ADMIN_ROUTE_ANY_MODE.has(best.pattern) ? "any" : "all",
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * هلپرها
 * ──────────────────────────────────────────────────────────────────────────── */

/** همه کلیدهای معتبر دسترسی به‌صورت آرایه تخت */
export function getAllPermissionKeys() {
  return [...ALL_KEYS];
}

export function isValidPermissionKey(key) {
  return ALL_KEYS_SET.has(key);
}

export function getPermissionMeta(key) {
  return PERMISSION_META.get(key) || null;
}

export function getModule(moduleKey) {
  return MODULE_BY_KEY.get(moduleKey) || null;
}

/**
 * @deprecated فقط برای مسیرهای legacy.
 *
 * کلیدهای ناشناخته را بی‌صدا حذف می‌کند و همین باعث ناهم‌خوانیِ خاموشِ UI/API
 * می‌شود (کاربر کلید می‌فرستد، سرور بی‌خبر دورش می‌ریزد). مسیرهای نوشتنیِ
 * API باید از `validatePermissionKeys` استفاده کنند و ۴۲۲ برگردانند.
 * اینجا صرفاً به‌عنوان فیلترِ داخلیِ محاسبه‌ی دسترسی باقی مانده است.
 */
export function sanitizePermissions(permissions) {
  if (!Array.isArray(permissions)) return [];
  return [...new Set(permissions.filter((p) => ALL_KEYS_SET.has(p)))];
}

/**
 * تفکیک کلیدها برای گزارش‌گیری و مهاجرت.
 * خروجی: { valid, retired: [{key, action, replacement, reason}],
 *           ambiguous: [{key, candidates}], unknown }
 */
export function classifyPermissionKeys(permissions) {
  const out = { valid: [], retired: [], ambiguous: [], unknown: [] };
  if (!Array.isArray(permissions)) return out;

  for (const key of [...new Set(permissions)]) {
    if (ALL_KEYS_SET.has(key)) out.valid.push(key);
    else if (RETIRED_PERMISSIONS[key])
      out.retired.push({ key, ...RETIRED_PERMISSIONS[key] });
    else if (AMBIGUOUS_PERMISSIONS[key])
      out.ambiguous.push({ key, ...AMBIGUOUS_PERMISSIONS[key] });
    else out.unknown.push(key);
  }
  return out;
}

/**
 * مرز اعتبارسنجیِ سخت برای APIهای نوشتنی.
 * هیچ کلیدی بی‌صدا حذف نمی‌شود: یا همه معتبرند، یا خطای ۴۲۲ با جزئیات.
 *
 * خروجی: { ok, permissions, invalid: { retired, ambiguous, unknown }, message }
 */
export function validatePermissionKeys(permissions) {
  if (permissions === undefined || permissions === null) {
    return { ok: true, permissions: [], invalid: null, message: "" };
  }
  if (!Array.isArray(permissions)) {
    return {
      ok: false,
      permissions: [],
      invalid: { retired: [], ambiguous: [], unknown: [] },
      message: "فهرست دسترسی‌ها باید آرایه باشد",
    };
  }

  const report = classifyPermissionKeys(permissions);
  const problems = [];

  if (report.retired.length) {
    problems.push(
      `کلیدهای بازنشسته: ${report.retired
        .map((r) =>
          r.action === "rewrite"
            ? `${r.key} (به‌جای آن: ${r.replacement.join("، ")})`
            : `${r.key} (معادلی ندارد)`
        )
        .join("، ")}`
    );
  }
  if (report.ambiguous.length) {
    problems.push(
      `کلیدهای مبهم که باید دستی تعیین تکلیف شوند: ${report.ambiguous
        .map((r) => `${r.key} (${r.candidates.join(" یا ")})`)
        .join("، ")}`
    );
  }
  if (report.unknown.length) {
    problems.push(`کلیدهای ناشناخته: ${report.unknown.join("، ")}`);
  }

  if (problems.length) {
    return {
      ok: false,
      permissions: [],
      invalid: {
        retired: report.retired,
        ambiguous: report.ambiguous,
        unknown: report.unknown,
      },
      message: problems.join(" | "),
    };
  }

  return {
    ok: true,
    permissions: [...new Set(report.valid)],
    invalid: null,
    message: "",
  };
}

/**
 * بازنویسیِ قطعیِ کلیدهای بازنشسته — فقط برای مهاجرت.
 * خروجی: { permissions, rewritten, dropped, ambiguous, unknown }
 *   • rewrite → با معادلِ تأییدشده جایگزین می‌شود
 *   • drop    → حذف می‌شود (حدس زده نمی‌شود)
 *   • مبهم/ناشناخته → دست نمی‌خورد و فقط گزارش می‌شود
 */
export function migratePermissionKeys(permissions) {
  const report = classifyPermissionKeys(permissions);
  const out = new Set(report.valid);
  const rewritten = [];
  const dropped = [];

  for (const entry of report.retired) {
    if (entry.action === "rewrite" && entry.replacement.length) {
      for (const key of entry.replacement) out.add(key);
      rewritten.push({ from: entry.key, to: entry.replacement });
    } else {
      dropped.push({ key: entry.key, reason: entry.reason });
    }
  }

  return {
    permissions: [...out],
    rewritten,
    dropped,
    ambiguous: report.ambiguous,
    unknown: report.unknown,
  };
}

/**
 * افزودن پیش‌نیازها: انتخاب "products.edit" بدون "products.view" بی‌معناست.
 */
export function normalizePermissions(permissions) {
  const out = new Set(sanitizePermissions(permissions));
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of [...out]) {
      for (const dep of PERMISSION_META.get(key)?.requires || []) {
        if (!out.has(dep)) {
          out.add(dep);
          changed = true;
        }
      }
    }
  }
  return [...out];
}

/**
 * حذف اکشن‌هایی که پیش‌نیازشان موجود نیست (fail-closed).
 * لازم است چون denial می‌تواند یک پیش‌نیاز را بردارد.
 */
export function pruneUnsatisfiedDependencies(permissions) {
  const out = new Set(sanitizePermissions(permissions));
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of [...out]) {
      const requires = PERMISSION_META.get(key)?.requires || [];
      if (requires.some((dep) => !out.has(dep))) {
        out.delete(key);
        changed = true;
      }
    }
  }
  return [...out];
}

/**
 * دسترسی مؤثر.
 *
 *  • نقش عادی: (دسترسی‌های نقش ∪ grants) − denials، با نرمال‌سازی وابستگی.
 *  • نقش محافظت‌شده‌ی «دسترسی کامل» (fullAccess): استثناء صریح — همه‌ی کلیدهای
 *    رجیستری، و grants/denialsِ سطحِ ادمین *نادیده* گرفته می‌شوند. دلیل: این
 *    نقش باید همیشه شاملِ کلیدهای آینده باشد و نباید بشود با یک denial
 *    نامحسوس، سوپرادمین را ناقص یا قفل کرد. اگر برای کسی محدودیت لازم است،
 *    باید نقش دیگری بگیرد، نه اینکه نقش محافظت‌شده وصله شود.
 */
export function computeEffectivePermissions({
  rolePermissions = [],
  grants = [],
  denials = [],
  fullAccess = false,
} = {}) {
  if (fullAccess) return getAllPermissionKeys();

  const denied = new Set(sanitizePermissions(denials));
  const granted = normalizePermissions([
    ...(Array.isArray(rolePermissions) ? rolePermissions : []),
    ...(Array.isArray(grants) ? grants : []),
  ]);

  return pruneUnsatisfiedDependencies(granted.filter((k) => !denied.has(k)));
}

/** بررسی یک یا چند کلید (حالت پیش‌فرض: «همه‌ی کلیدها لازم است»). */
export function hasPermission(effective, required, { mode = "all" } = {}) {
  const set = effective instanceof Set ? effective : new Set(effective || []);
  const keys = Array.isArray(required) ? required : [required];
  if (!keys.length) return true;
  return mode === "any"
    ? keys.some((k) => set.has(k))
    : keys.every((k) => set.has(k));
}

/**
 * آیا این دسترسی مؤثر اجازه‌ی باز کردن یک URLِ واقعیِ پنل را می‌دهد؟
 * ورودی می‌تواند URLِ واقعی (`/p-admin/users/64f...?tab=x`) یا خودِ الگو باشد.
 * ناشناخته یا مبهم → false.
 */
export function canAccessAdminRoute(effective, route) {
  const match = matchAdminRoute(route);
  if (!match || match.ambiguous || match.unknownTab || match.duplicateTab) {
    return false;
  }
  // فهرست خالی هرگز نباید «مجاز» تعبیر شود (hasPermission برای آرایه‌ی خالی
  // true برمی‌گرداند) — این نگهبانِ آخر است.
  if (!match.permissions?.length) return false;
  return hasPermission(effective, match.permissions, { mode: match.mode });
}

/**
 * متادیتای ناوبری: بخش‌هایی که با دسترسی مؤثرِ داده‌شده قابل مشاهده‌اند.
 * (برای ساخت سایدبار در فاز enforcement.)
 */
export function getVisibleSections(effective) {
  const set = effective instanceof Set ? effective : new Set(effective || []);
  return PERMISSION_SECTIONS.map((section) => ({
    key: section.key,
    title: section.title,
    path: section.path,
    modules: section.modules.filter((mod) =>
      mod.permissions.some((p) => set.has(p.fullKey))
    ),
  })).filter((section) => section.modules.length > 0);
}
