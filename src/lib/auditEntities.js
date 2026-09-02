/**
 * src/lib/auditEntities.js
 *
 * رجیستریِ موجودیت‌های ممیزی — تنها منبعِ «این تغییر یعنی چه».
 *
 * این فایل عمداً *خالص* است: هیچ ایمپورتی ندارد، نه mongoose، نه next، نه
 * آیکون. هم پلاگینِ سرور (models/auditPlugin.js) و هم مودالِ کلاینت
 * (ActivityDetailModal) از همین نگاشت می‌خوانند، پس «آنچه ثبت می‌شود» و
 * «آنچه نمایش داده می‌شود» هرگز از هم جدا نمی‌افتند.
 *
 * ── چرا برچسب‌های وضعیت اینجا دوباره نوشته شده‌اند ─────────────────────
 * نسخه‌ی موجودشان در src/components/modules/payments/constants.js است که
 * lucide-react ایمپورت می‌کند؛ کشیدنِ آن به لایه‌ی مدل یعنی آیکون‌ها در
 * باندلِ سرور. پانزده رشته تکرار، ارزانی‌ترین گزینه است.
 *
 * ── افزودنِ موجودیتِ جدید ────────────────────────────────────────────
 * فقط یک ورودی به AUDIT_ENTITIES اضافه کنید. اگر اضافه نکنید هم کار
 * می‌کند: مدلِ ناشناخته با توصیفگرِ پیش‌فرض ثبت می‌شود (نامِ مدل به‌عنوان
 * برچسب). رجیستری برای *دقت* است، نه برای *پوشش*.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * مدل‌هایی که هرگز ممیزی نمی‌شوند
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * سه دسته:
 *   ۱) AdminActivity — بازگشتِ بی‌نهایت: ثبتِ ممیزی خودش یک نوشتن است.
 *   ۲) زیرساخت — کش، محدودسازیِ نرخ، توکنِ یک‌بارمصرف. نه اقدامِ ادمین‌اند و
 *      نه چیزی برای ممیزی دارند.
 *   ۳) اثرِ جانبی — اعلانی که خودِ سیستم بعد از اقدامِ ادمین می‌سازد. اینها
 *      «کارِ ادمین» نیستند و اگر ثبت شوند هر اقدام سه ردیف می‌شود.
 */
export const AUDIT_IGNORED_MODELS = new Set([
  "AdminActivity",
  "PriceCache",
  "RateLimitHit",
  "Otp",
  "PasswordResetToken",
  "PushSubscription",
  "SlugRegistery",
  "Notification",
  "UserNotificationState",
  "ArticleRevision",
  "ArticleRedirect",
]);

/** مسیرهایی که در هیچ تفاوتی نمی‌آیند — نویزِ محض. */
export const AUDIT_IGNORED_PATHS = new Set([
  "_id",
  "__v",
  "createdAt",
  "updatedAt",
  "id",
]);

/* ────────────────────────────────────────────────────────────────────────────
 * نگاشتِ مقادیرِ enum
 * ──────────────────────────────────────────────────────────────────────────── */

export const AUDIT_ENUMS = {
  paymentStatus: {
    UNPAID: "پرداخت نشده",
    PARTIALLY_PAID: "پرداخت جزئی",
    PAID: "پرداخت شده",
  },
  fulfillmentStatus: {
    WAITING: "در انتظار",
    NEEDS_PURCHASE: "در انتظار خرید",
    PROCESSING: "در حال پردازش",
    SENT: "ارسال شده",
    DELIVERED: "تحویل شده",
    CANCELED: "لغو شده",
  },
  paymentDocStatus: {
    PENDING: "در انتظار بررسی",
    PAID: "تأیید شده",
    REJECTED: "رد شده",
    FAILED: "ناموفق",
  },
  paymentMethod: {
    ONLINE: "پرداخت آنلاین",
    BANK_RECEIPT: "فیش بانکی",
  },
  reviewStatus: {
    PENDING: "در انتظار",
    APPROVED: "تأیید شده",
    REJECTED: "رد شده",
  },
  articleStatus: {
    draft: "پیش‌نویس",
    review: "در انتظار بازبینی",
    published: "منتشرشده",
    archived: "بایگانی",
  },
  // نگاشتِ برچسبِ نقش‌ها. "seller" دیگر نقشِ قابل‌انتخابی نیست (با "store" ادغام
  // شد) ولی اینجا عمداً می‌ماند: دفترِ ممیزی append-only است و رکوردهای گذشته
  // ممکن است هنوز مقدارِ seller را ثبت کرده باشند؛ بدون این کلید، تاریخچه به‌جای
  // برچسب، رشته‌ی خام نمایش می‌داد.
  userRole: {
    user: "کاربر",
    coach: "مربی",
    admin: "مدیر",
    seller: "فروشنده (حذف‌شده)",
    national_player: "ملی‌پوش",
    store: "فروشگاه",
  },
  coachApplicationStatus: {
    none: "بدون درخواست",
    pending: "در انتظار بررسی",
    approved: "تأییدشده",
    rejected: "ردشده",
  },
  checkStatus: {
    PENDING: "در انتظار",
    CLEARED: "پاس شده",
    BOUNCED: "برگشت خورده",
    CANCELED: "لغو شده",
  },
  commentStatus: {
    pending: "در انتظار تأیید",
    approved: "تأییدشده",
    rejected: "ردشده",
  },
  ticketStatus: {
    open: "باز",
    answered: "پاسخ داده‌شده",
    pending: "در انتظار کاربر",
    closed: "بسته",
  },
  eventStatus: {
    draft: "پیش‌نویس",
    scheduled: "زمان‌بندی‌شده",
    active: "فعال",
    ended: "پایان‌یافته",
    archived: "بایگانی",
  },
  usedProductStatus: {
    DRAFT: "پیش‌نویس",
    AVAILABLE: "موجود",
    RESERVED: "رزرو شده",
    SOLD: "فروخته شده",
    HIDDEN: "پنهان",
  },
};

/* ────────────────────────────────────────────────────────────────────────────
 * ابزارهای کوچک
 * ──────────────────────────────────────────────────────────────────────────── */

const shortId = (value) => (value ? String(value).slice(-6).toUpperCase() : "");

/** نامِ نمایشیِ استاندارد: هر چه اول پیدا شد. */
const firstOf = (doc, keys) => {
  for (const key of keys) {
    const value = doc?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const genericName = (doc) =>
  firstOf(doc, ["name", "title", "label", "code", "key", "subject", "slug"]);

/** کلیدهای SiteSetting → نامِ فارسی. کلیدِ ناشناخته خودش نمایش داده می‌شود. */
const SITE_SETTING_LABELS = {
  bank_account_details: "اطلاعات حساب بانکی",
  monthly_installment_rate: "نرخ ماهانه اقساط",
  review_credit_config: "پیکربندی اعتبار نظرات",
  home_featured_article_ids: "مقالات منتخب صفحه اصلی",
  secondhand_header_image: "تصویر سربرگ بازار دست دوم",
};

/* ────────────────────────────────────────────────────────────────────────────
 * توصیفگرها
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * ساختارِ یک توصیفگر:
 *
 *   key       شناسه‌ی کوتاه — نیمه‌ی اولِ شناسه‌ی اقدام (`product.update`).
 *   label     نامِ فارسیِ موجودیت.
 *   priority  وقتی یک درخواست چند موجودیت را عوض می‌کند، بالاترین اولویت
 *             «موضوعِ اصلی» می‌شود و بقیه «تغییراتِ مرتبط».
 *   name      نامِ خواندنیِ نمونه — از روی سند.
 *   fields    نامِ فارسیِ فیلدها + نوعشان، برای مودال.
 *   refine    شناسه‌ی اقدامِ دقیق‌تر و جمله‌ی توصیف، بر اساسِ *آنچه واقعاً
 *             عوض شد*. اینجاست که «ویرایش سفارش» به «تأیید سفارش» تبدیل
 *             می‌شود.
 */
export const AUDIT_ENTITIES = {
  Order: {
    key: "order",
    label: "سفارش",
    priority: 100,
    name: (doc) => (doc?.trackingCode ? `#${doc.trackingCode}` : `#${shortId(doc?._id)}`),
    fields: {
      paymentStatus: { label: "وضعیت پرداخت", enum: "paymentStatus" },
      fulfillmentStatus: { label: "وضعیت آماده‌سازی", enum: "fulfillmentStatus" },
      totalPrice: { label: "مبلغ کل", type: "price" },
      subtotalPrice: { label: "جمع اقلام", type: "price" },
      discountAmount: { label: "تخفیف", type: "price" },
      couponDiscount: { label: "تخفیف کوپن", type: "price" },
      priceEUR: { label: "مبلغ یورویی", type: "number" },
      trackingCode: { label: "کد پیگیری" },
      deliveredAt: { label: "زمان تحویل", type: "date" },
      description: { label: "توضیح سفارش" },
      items: { label: "اقلام سفارش" },
      payments: { label: "پرداخت‌ها" },
    },
    refine: ({ changes, name }) => {
      if (changes?.fulfillmentStatus) {
        return {
          action: "order.status.change",
          description: `تغییر وضعیت سفارش ${name}`,
        };
      }
      if (changes?.paymentStatus) {
        return {
          action: "order.payment.status.change",
          description: `تغییر وضعیت پرداخت سفارش ${name}`,
        };
      }
      if (changes?.items) {
        return { action: "order.items.change", description: `تغییر اقلام سفارش ${name}` };
      }
      if (changes?.discountAmount || changes?.couponDiscount || changes?.totalPrice) {
        return { action: "order.price.change", description: `تغییر مبلغ سفارش ${name}` };
      }
      return null;
    },
  },

  Payment: {
    key: "payment",
    label: "پرداخت",
    // بالاتر از Order عمداً: تأییدِ پرداخت هم Payment و هم Order را می‌نویسد و
    // تیترِ درست «تأیید پرداخت سفارش X» است، نه «تغییر وضعیت سفارش X».
    priority: 102,
    name: (doc, context) => {
      const order = context?.find?.((event) => event.model === "Order");
      return order?.name ? `سفارش ${order.name}` : `#${shortId(doc?._id)}`;
    },
    fields: {
      status: { label: "وضعیت پرداخت", enum: "paymentDocStatus" },
      amount: { label: "مبلغ", type: "price" },
      method: { label: "روش پرداخت", enum: "paymentMethod" },
      "bankReceipt.reviewStatus": { label: "نتیجه بررسی فیش", enum: "reviewStatus" },
      "bankReceipt.rejectionReason": { label: "دلیل رد" },
      "bankReceipt.reviewedAt": { label: "زمان بررسی", type: "date" },
    },
    refine: ({ changes, name }) => {
      const status = changes?.status?.to;
      if (status === "PAID") return { action: "payment.approve", description: `تأیید پرداخت ${name}` };
      if (status === "REJECTED") return { action: "payment.reject", description: `رد پرداخت ${name}` };
      if (changes?.amount) return { action: "payment.edit", description: `ویرایش مبلغ پرداخت ${name}` };
      return null;
    },
  },

  Installment: {
    key: "installment",
    label: "پرونده اقساط",
    priority: 90,
    name: (doc) => `#${shortId(doc?.order || doc?._id)}`,
    fields: {
      totalAmount: { label: "مبلغ کل", type: "price" },
      downPayment: { label: "پیش‌پرداخت", type: "price" },
      numberOfChecks: { label: "تعداد چک", type: "number" },
      checks: { label: "چک‌ها" },
      orderConfirmedAt: { label: "زمان تأیید سفارش", type: "date" },
    },
    refine: ({ changes, name }) => {
      if (changes?.checks) {
        return { action: "installment.check.update", description: `بروزرسانی چک‌های ${name}` };
      }
      if (changes?.orderConfirmedAt) {
        return { action: "installment.order.confirm", description: `تأیید سفارش اقساطی ${name}` };
      }
      return null;
    },
  },

  Product: {
    key: "product",
    label: "محصول",
    priority: 80,
    name: (doc) => genericName(doc) || `#${shortId(doc?._id)}`,
    fields: {
      name: { label: "نام" },
      basePrice: { label: "قیمت پایه", type: "price" },
      isActive: { label: "فعال", type: "bool" },
      sku: { label: "کد کالا" },
      slug: { label: "نشانی" },
      label: { label: "برچسب" },
      score: { label: "امتیاز", type: "number" },
      category: { label: "دسته‌بندی", type: "ref" },
      brand: { label: "برند", type: "ref" },
      sport: { label: "ورزش", type: "ref" },
      order: { label: "ترتیب", type: "number" },
      shortDescription: { label: "توضیح کوتاه" },
      longDescription: { label: "توضیح بلند" },
      gallery: { label: "گالری" },
      mainImage: { label: "تصویر اصلی" },
      attributes: { label: "ویژگی‌ها" },
    },
    refine: ({ changes, name }) => {
      if (changes?.basePrice) return { action: "product.price.change", description: `تغییر قیمت محصول «${name}»` };
      if (changes?.isActive) {
        return {
          action: changes.isActive.to ? "product.activate" : "product.deactivate",
          description: `${changes.isActive.to ? "فعال‌سازی" : "غیرفعال‌سازی"} محصول «${name}»`,
        };
      }
      return null;
    },
  },

  Variant: {
    key: "variant",
    label: "تنوع محصول",
    priority: 78,
    name: (doc, context) => {
      const product = context?.find?.((event) => event.model === "Product");
      return product?.name || genericName(doc) || `#${shortId(doc?._id)}`;
    },
    fields: {
      stock: { label: "موجودی", type: "number" },
      price: { label: "قیمت", type: "price" },
      priceEUR: { label: "قیمت یورویی", type: "number" },
      isActive: { label: "فعال", type: "bool" },
      sku: { label: "کد کالا" },
      attributes: { label: "ویژگی‌ها" },
    },
    refine: ({ changes, name }) => {
      if (changes?.stock) return { action: "product.stock.change", description: `تغییر موجودی «${name}»` };
      if (changes?.price || changes?.priceEUR) {
        return { action: "product.price.change", description: `تغییر قیمت «${name}»` };
      }
      return null;
    },
  },

  Article: {
    key: "article",
    label: "مقاله",
    priority: 70,
    name: (doc) => firstOf(doc, ["title", "slug"]) || `#${shortId(doc?._id)}`,
    fields: {
      title: { label: "عنوان" },
      slug: { label: "نشانی" },
      status: { label: "وضعیت", enum: "articleStatus" },
      publishedAt: { label: "زمان انتشار", type: "date" },
      category: { label: "دسته‌بندی", type: "ref" },
      tags: { label: "برچسب‌ها" },
      featured: { label: "ویژه", type: "bool" },
      pinned: { label: "سنجاق‌شده", type: "bool" },
      excerpt: { label: "چکیده" },
      blocks: { label: "محتوا" },
      cover: { label: "کاور" },
      seo: { label: "سئو" },
      deletedAt: { label: "زمان حذف", type: "date" },
    },
    refine: ({ changes, name }) => {
      if (changes?.deletedAt?.to) return { action: "article.trash", description: `انتقال مقاله «${name}» به زباله‌دان` };
      if (changes?.status?.to === "published") {
        return { action: "article.publish", description: `انتشار مقاله «${name}»` };
      }
      if (changes?.status && changes.status.from === "published") {
        return { action: "article.unpublish", description: `لغو انتشار مقاله «${name}»` };
      }
      return null;
    },
  },

  User: {
    key: "user",
    label: "کاربر",
    priority: 75,
    name: (doc) =>
      [doc?.name, doc?.lastName].filter(Boolean).join(" ").trim() ||
      doc?.phone ||
      doc?.email ||
      `#${shortId(doc?._id)}`,
    fields: {
      name: { label: "نام" },
      lastName: { label: "نام خانوادگی" },
      phone: { label: "شماره تماس" },
      email: { label: "ایمیل" },
      role: { label: "نقش", enum: "userRole" },
      isBanned: { label: "مسدود", type: "bool" },
      level: { label: "سطح", type: "number" },
      walletBalance: { label: "موجودی کیف پول", type: "price" },
      vipExpiresAt: { label: "انقضای ویژه", type: "date" },
      coachCode: { label: "کد مربی" },
      "coachApplication.status": { label: "وضعیت درخواست مربیگری", enum: "coachApplicationStatus" },
      "coachApplication.rejectionReason": { label: "دلیل رد مربیگری" },
    },
    refine: ({ changes, name }) => {
      if (changes?.isBanned) {
        return changes.isBanned.to
          ? { action: "user.ban", description: `مسدودسازی کاربر ${name}` }
          : { action: "user.unban", description: `رفع مسدودیت کاربر ${name}` };
      }
      if (changes?.role) return { action: "user.role.change", description: `تغییر نقش کاربر ${name}` };
      if (changes?.walletBalance) {
        return { action: "user.wallet.adjust", description: `تغییر موجودی کیف پول ${name}` };
      }
      if (changes?.["coachApplication.status"]) {
        return {
          action: "user.coach.review",
          description: `بررسی درخواست مربیگری ${name}`,
        };
      }
      return { action: "user.profile.update", description: `ویرایش کاربر ${name}` };
    },
  },

  Admin: {
    key: "admin",
    label: "ادمین",
    priority: 96,
    name: (doc) => doc?.username || `#${shortId(doc?.user || doc?._id)}`,
    fields: {
      role: { label: "نقش", type: "ref" },
      isActive: { label: "فعال", type: "bool" },
      title: { label: "عنوان" },
      username: { label: "نام کاربری" },
      permissionGrants: { label: "دسترسی‌های افزوده" },
      permissionDenials: { label: "دسترسی‌های سلب‌شده" },
      revokedAt: { label: "زمان لغو", type: "date" },
      revokeReason: { label: "دلیل لغو" },
      lastLoginAt: { label: "آخرین ورود", type: "date" },
    },
    refine: ({ changes, name, op }) => {
      if (op === "create") return { action: "admin.create", description: `افزودن ادمین ${name}` };
      if (changes?.revokedAt?.to) return { action: "admin.revoke", description: `لغو دسترسی ادمین ${name}` };
      if (changes?.isActive?.to === true) {
        return { action: "admin.activate", description: `فعال‌سازی ادمین ${name}` };
      }
      if (changes?.permissionGrants || changes?.permissionDenials || changes?.role) {
        return { action: "admin.permissions.change", description: `تغییر دسترسی‌های ادمین ${name}` };
      }
      return null;
    },
  },

  AdminRole: {
    key: "role",
    label: "نقش ادمین",
    priority: 95,
    name: (doc) => doc?.name || doc?.systemKey || `#${shortId(doc?._id)}`,
    fields: {
      name: { label: "نام نقش" },
      description: { label: "توضیح" },
      permissions: { label: "دسترسی‌ها" },
      isFullAccess: { label: "دسترسی کامل", type: "bool" },
    },
  },

  Category: {
    key: "category",
    label: "دسته‌بندی",
    priority: 60,
    // `title` نامِ فارسیِ نمایشی است و `name` شناسه‌ی لاتین؛ برای یک دفترِ
    // فارسی اولی خواناتر است.
    name: (doc) => doc?.title || genericName(doc) || `#${shortId(doc?._id)}`,
    fields: {
      name: { label: "نام" },
      slug: { label: "نشانی" },
      sport: { label: "ورزش", type: "ref" },
      parent: { label: "والد", type: "ref" },
      order: { label: "ترتیب", type: "number" },
      attributes: { label: "ویژگی‌ها" },
      icon: { label: "آیکون" },
      image: { label: "تصویر" },
    },
  },

  Sport: { key: "sport", label: "ورزش", priority: 58, fields: { name: { label: "نام" }, slug: { label: "نشانی" }, order: { label: "ترتیب", type: "number" } } },
  Brand: { key: "brand", label: "برند", priority: 58, fields: { name: { label: "نام" }, slug: { label: "نشانی" }, order: { label: "ترتیب", type: "number" } } },
  Serie: { key: "serie", label: "سری", priority: 56 },
  Athlete: { key: "athlete", label: "ورزشکار", priority: 55 },
  LimitedEdition: { key: "limitedEdition", label: "نسخه محدود", priority: 55 },

  ArticleCategory: { key: "articleCategory", label: "دسته‌بندی مقاله", priority: 54 },
  ArticleTag: { key: "articleTag", label: "برچسب مقاله", priority: 52 },

  DiscountRule: {
    key: "discount",
    label: "قانون تخفیف",
    priority: 85,
    name: (doc) => doc?.title || `#${shortId(doc?._id)}`,
    fields: {
      title: { label: "عنوان" },
      active: { label: "فعال", type: "bool" },
      "discount.value": { label: "مقدار تخفیف", type: "number" },
      "discount.kind": { label: "نوع تخفیف" },
      startAt: { label: "شروع", type: "date" },
      endAt: { label: "پایان", type: "date" },
      priority: { label: "اولویت", type: "number" },
      targets: { label: "هدف‌ها" },
    },
  },

  Coupon: {
    key: "coupon",
    label: "کوپن",
    priority: 85,
    name: (doc) => doc?.code || `#${shortId(doc?._id)}`,
    fields: {
      code: { label: "کد" },
      active: { label: "فعال", type: "bool" },
      "discount.value": { label: "مقدار تخفیف", type: "number" },
      usageLimit: { label: "سقف استفاده", type: "number" },
      startAt: { label: "شروع", type: "date" },
      endAt: { label: "پایان", type: "date" },
    },
  },

  QuantityDiscount: { key: "quantityDiscount", label: "تخفیف تعدادی", priority: 84 },
  FlashSale: { key: "flashSale", label: "فروش ویژه", priority: 84 },

  ExchangeRate: {
    key: "exchangeRate",
    label: "نرخ ارز",
    priority: 92,
    // هر ثبت یک ردیفِ تازه در تاریخچه است، پس نامِ نمونه باید خودِ نرخ باشد؛
    // وگرنه رکورد می‌شود «ایجاد نرخ ارز: نرخ ارز».
    name: (doc) => {
      const rate = doc?.rateToToman ?? doc?.rate ?? doc?.value;
      return rate ? `${Number(rate).toLocaleString("fa-IR")} تومان` : "نرخ ارز";
    },
    fields: {
      rateToToman: { label: "نرخ به تومان", type: "price" },
      rate: { label: "نرخ", type: "number" },
      value: { label: "مقدار", type: "number" },
      note: { label: "یادداشت" },
    },
  },

  SiteSetting: {
    key: "setting",
    label: "تنظیمات سایت",
    priority: 91,
    name: (doc) => SITE_SETTING_LABELS[doc?.key] || doc?.key || "تنظیمات",
    fields: { value: { label: "مقدار" }, key: { label: "کلید" } },
    // upsert است: بارِ اول ایجاد می‌شود ولی از دیدِ ممیز همیشه «تغییرِ
    // تنظیمات» است، نه «ایجادِ تنظیمات».
    alwaysRefine: true,
    refine: ({ name }) => ({ action: "setting.update", description: `تغییر تنظیمات «${name}»` }),
  },

  PageContent: {
    key: "page",
    label: "صفحه",
    priority: 65,
    name: (doc) => doc?.title || doc?.slug || `#${shortId(doc?._id)}`,
    fields: {
      title: { label: "عنوان" },
      slug: { label: "نشانی" },
      published: { label: "منتشرشده", type: "bool" },
      sections: { label: "بخش‌ها" },
      blocks: { label: "بلوک‌ها" },
    },
    refine: ({ changes, name }) => {
      if (changes?.published) {
        return {
          action: "page.publish",
          description: `${changes.published.to ? "انتشار" : "لغو انتشار"} صفحه «${name}»`,
        };
      }
      return null;
    },
  },

  Event: {
    key: "event",
    label: "کمپین",
    priority: 66,
    name: (doc) => doc?.name || doc?.slug || `#${shortId(doc?._id)}`,
    fields: {
      name: { label: "نام" },
      slug: { label: "نشانی" },
      status: { label: "وضعیت", enum: "eventStatus" },
      startDate: { label: "شروع", type: "date" },
      endDate: { label: "پایان", type: "date" },
      priority: { label: "اولویت", type: "number" },
    },
  },

  UsedProduct: {
    key: "usedProduct",
    label: "کالای دست‌دوم",
    priority: 68,
    name: (doc) => doc?.name || `#${shortId(doc?._id)}`,
    fields: {
      name: { label: "نام" },
      price: { label: "قیمت", type: "price" },
      status: { label: "وضعیت", enum: "usedProductStatus" },
      overallScore: { label: "امتیاز سلامت", type: "number" },
      assignedBarcode: { label: "بارکد" },
      assignedTrackingCode: { label: "کد رهگیری" },
    },
  },

  OrderFlow: {
    key: "orderFlow",
    label: "فلوی سفارش",
    priority: 64,
    name: (doc) => doc?.name || `#${shortId(doc?._id)}`,
    fields: {
      name: { label: "نام" },
      isActive: { label: "فعال", type: "bool" },
      nodes: { label: "گره‌ها" },
      edges: { label: "یال‌ها" },
      rootCategory: { label: "دسته‌بندی ریشه", type: "ref" },
    },
  },

  Comment: {
    key: "comment",
    label: "دیدگاه",
    priority: 62,
    name: (doc) => `#${shortId(doc?._id)}`,
    fields: {
      status: { label: "وضعیت", enum: "commentStatus" },
      approved: { label: "تأییدشده", type: "bool" },
      text: { label: "متن" },
      rating: { label: "امتیاز", type: "number" },
    },
    refine: ({ changes, name }) => {
      const next = changes?.status?.to ?? (changes?.approved ? (changes.approved.to ? "approved" : "rejected") : null);
      if (next === "approved") return { action: "comment.approve", description: `تأیید دیدگاه ${name}` };
      if (next === "rejected") return { action: "comment.reject", description: `رد دیدگاه ${name}` };
      return null;
    },
  },

  Ticket: {
    key: "ticket",
    label: "تیکت",
    priority: 63,
    name: (doc) => doc?.subject || `#${shortId(doc?._id)}`,
    fields: {
      status: { label: "وضعیت", enum: "ticketStatus" },
      priority: { label: "اولویت" },
      department: { label: "دپارتمان" },
      assignedAdmin: { label: "ادمین مسئول", type: "ref" },
      closedAt: { label: "زمان بستن", type: "date" },
    },
  },

  TicketMessage: { key: "ticketMessage", label: "پیام تیکت", priority: 61 },
  ContactMessage: { key: "contactMessage", label: "پیام تماس", priority: 50 },
  UserNotification: { key: "userNotification", label: "اطلاعیه کاربران", priority: 57 },
  CoachCredit: { key: "coachCredit", label: "اعتبار مربی", priority: 82 },
  CoachWalletTransaction: { key: "coachWallet", label: "تراکنش کیف پول مربی", priority: 82 },
  ReviewCreditTransaction: { key: "reviewCredit", label: "اعتبار نظر", priority: 50 },
  HealthCard: { key: "healthCard", label: "کارت سلامت", priority: 54 },
  Banner: { key: "banner", label: "بنر", priority: 50 },
  Slide: { key: "slide", label: "اسلاید", priority: 50 },
  Newsletter: { key: "newsletter", label: "خبرنامه", priority: 45 },
  Ban: { key: "ban", label: "مسدودسازی", priority: 74 },
  Address: { key: "address", label: "آدرس", priority: 40 },
  SenderAddress: {
    key: "senderAddress",
    label: "آدرس فرستنده",
    priority: 40,
    name: (doc) => doc?.title || doc?.fullName || null,
    fields: {
      title: { label: "عنوان" },
      fullName: { label: "نام فرستنده" },
      phone: { label: "شماره تماس" },
      province: { label: "استان" },
      city: { label: "شهر" },
      addressLine: { label: "آدرس" },
      postalCode: { label: "کد پستی" },
    },
  },
};

/* ────────────────────────────────────────────────────────────────────────────
 * دسترسی
 * ──────────────────────────────────────────────────────────────────────────── */

/** توصیفگرِ پیش‌فرضِ یک مدلِ ثبت‌نشده — پوشش هرگز به رجیستری وابسته نیست. */
function fallbackDescriptor(modelName) {
  const key = modelName ? modelName.charAt(0).toLowerCase() + modelName.slice(1) : "entity";
  return { key, label: modelName || "موجودیت", priority: 10, fields: {} };
}

export function entityDescriptor(modelName) {
  return AUDIT_ENTITIES[modelName] || fallbackDescriptor(modelName);
}

/** نامِ خواندنیِ یک سند بر اساسِ توصیفگرش. */
export function entityName(modelName, doc, context) {
  const descriptor = entityDescriptor(modelName);
  const custom = descriptor.name?.(doc, context);
  if (custom) return String(custom).slice(0, 120);
  return String(genericName(doc) || `#${shortId(doc?._id)}`).slice(0, 120);
}

/** برچسبِ فارسیِ یک فیلد — ناشناخته → خودِ نامِ فیلد. */
export function fieldLabel(modelName, path) {
  return entityDescriptor(modelName).fields?.[path]?.label || path;
}

export function fieldMeta(modelName, path) {
  return entityDescriptor(modelName).fields?.[path] || null;
}

/** ترجمه‌ی یک مقدار بر اساسِ نگاشتِ enum فیلد. */
export function enumLabel(modelName, path, value) {
  const meta = fieldMeta(modelName, path);
  if (!meta?.enum) return null;
  return AUDIT_ENUMS[meta.enum]?.[value] ?? null;
}

const OP_VERB = {
  create: "ایجاد",
  update: "ویرایش",
  delete: "حذف",
  archive: "بایگانی",
  trash: "انتقال به زباله‌دان",
};

/**
 * حذفِ نرم را «ویرایش» ننامیم.
 *
 * بیشترِ روت‌های حذف در این پروژه سند را پاک نمی‌کنند؛ `status: "archived"` یا
 * `deletedAt` می‌گذارند. بدونِ این قاعده، «حذف مقاله» در دفتر «ویرایش مقاله»
 * ثبت می‌شد — دقیقاً همان ابهامی که این کار باید از بین ببرد. قاعده عمومی
 * است و به هیچ موجودیتی گره نخورده.
 */
function softDeleteVerb(changes) {
  if (changes?.deletedAt?.to && !changes?.deletedAt?.from) return "trash";
  if (changes?.status?.to === "archived") return "archive";
  if (changes?.isDeleted?.to === true) return "trash";
  return null;
}

/**
 * شناسه‌ی اقدام و جمله‌ی توصیف برای یک رویدادِ تغییر.
 *
 * `refine` می‌تواند `null` بدهد — یعنی «چیزِ خاصی نبود، همان فعلِ عمومی».
 * این‌طوری هیچ موجودیتی مجبور نیست همه‌ی حالت‌ها را پوشش دهد.
 */
export function describeMutation({ model, op, name, changes }) {
  const descriptor = entityDescriptor(model);
  const displayName = name || descriptor.label;

  if (op === "update") {
    const refined = descriptor.refine?.({ changes: changes || {}, name: displayName, op });
    if (refined) return refined;

    const soft = softDeleteVerb(changes);
    if (soft) {
      return {
        action: `${descriptor.key}.${soft}`,
        description: `${OP_VERB[soft]} ${descriptor.label}: ${displayName}`,
      };
    }
  }
  if (op === "create" && descriptor.refine) {
    const refined = descriptor.refine({ changes: changes || {}, name: displayName, op });
    // یا توصیفگر صریحاً گفته «همیشه»، یا خودِ refine یک اقدامِ ایجاد برگردانده.
    if (refined && (descriptor.alwaysRefine || refined.action.endsWith(".create"))) {
      return refined;
    }
  }

  const verb = OP_VERB[op] || op;
  return {
    action: `${descriptor.key}.${op}`,
    description: `${verb} ${descriptor.label}: ${displayName}`,
  };
}

/** توصیفِ عملیاتِ دسته‌ای (updateMany/deleteMany) — بدونِ خواندنِ اسناد. */
export function describeBulk({ model, op, count }) {
  const descriptor = entityDescriptor(model);
  const verb = op === "deleteMany" ? "حذف گروهی" : "ویرایش گروهی";
  return {
    action: `${descriptor.key}.${op === "deleteMany" ? "deleteMany" : "updateMany"}`,
    description: `${verb} ${descriptor.label} (${count} مورد)`,
  };
}

/**
 * شناسه‌هایی که `refine` می‌سازد.
 *
 * اینها از روی کد قابل استخراج نیستند (داخلِ شرط‌اند)، پس صریح فهرست
 * می‌شوند تا فیلترِ کشویی و برچسبشان وجود داشته باشد. تستِ
 * `tests/adminAudit.test.mjs` هر شناسه‌ای را که refine واقعاً برمی‌گرداند با
 * همین فهرست می‌سنجد، پس از قلم افتادنِ یکی بی‌سروصدا رد نمی‌شود.
 */
export const REFINED_ACTIONS = {
  "order.status.change": "تغییر وضعیت سفارش",
  "order.payment.status.change": "تغییر وضعیت پرداخت سفارش",
  "order.items.change": "تغییر اقلام سفارش",
  "order.price.change": "تغییر مبلغ سفارش",
  "payment.approve": "تأیید پرداخت",
  "payment.reject": "رد پرداخت",
  "payment.edit": "ویرایش مبلغ پرداخت",
  "installment.check.update": "بروزرسانی چک اقساط",
  "installment.order.confirm": "تأیید سفارش اقساطی",
  "product.price.change": "تغییر قیمت",
  "product.stock.change": "تغییر موجودی",
  "product.activate": "فعال‌سازی محصول",
  "product.deactivate": "غیرفعال‌سازی محصول",
  "article.publish": "انتشار مقاله",
  "article.unpublish": "لغو انتشار مقاله",
  "article.trash": "انتقال مقاله به زباله‌دان",
  "user.ban": "مسدودسازی کاربر",
  "user.unban": "رفع مسدودیت کاربر",
  "user.role.change": "تغییر نقش کاربر",
  "user.wallet.adjust": "تغییر موجودی کیف پول",
  "user.coach.review": "بررسی درخواست مربیگری",
  "user.profile.update": "ویرایش پروفایل کاربر",
  "admin.create": "افزودن ادمین",
  "admin.revoke": "لغو دسترسی ادمین",
  "admin.activate": "فعال‌سازی ادمین",
  "admin.permissions.change": "تغییر دسترسی‌های ادمین",
  "setting.update": "تغییر تنظیمات سایت",
  "page.publish": "انتشار/لغو انتشار صفحه",
  "comment.approve": "تأیید دیدگاه",
  "comment.reject": "رد دیدگاه",
};

/**
 * همه‌ی شناسه‌های اقدامی که رجیستری می‌تواند تولید کند.
 *
 * افزودنِ یک موجودیت خودبه‌خود فیلترِ کشویی‌اش را هم می‌سازد.
 */
export function generatedActionIds() {
  const ids = new Map();
  for (const descriptor of Object.values(AUDIT_ENTITIES)) {
    for (const op of ["create", "update", "delete", "archive", "trash", "updateMany", "deleteMany"]) {
      const suffix =
        op === "updateMany" ? "ویرایش گروهی" : op === "deleteMany" ? "حذف گروهی" : OP_VERB[op];
      ids.set(`${descriptor.key}.${op}`, `${suffix} ${descriptor.label}`);
    }
  }
  for (const [action, label] of Object.entries(REFINED_ACTIONS)) ids.set(action, label);
  return ids;
}
