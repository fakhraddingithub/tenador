/**
 * services/priceEngine.js
 *
 * موتور مرکزی قیمت‌گذاری — تنها مرجع معتبر برای محاسبه قیمت نهایی
 *
 * مسئولیت‌ها:
 *  1. دریافت نرخ ارز (یورو → تومان) از cache
 *  2. اعمال FlashSale
 *  3. اعمال DiscountRule (product / category / serie / brand / global / userRole / userLevel / cartValue)
 *  4. اعمال کوپن (با بررسی محدودیت استفاده)
 *  5. محاسبه کردیت مربی بر اساس CoachCredit
 *
 * ⚠️  این فایل فقط سمت سرور اجرا می‌شود. هرگز در client import نشود.
 */

import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import { getCachedRate, eurToToman } from "@/lib/Exchangerate";
import DiscountRule from "base/models/DiscountRule";
import FlashSale from "base/models/FlashSale";
import Coupon from "base/models/Coupon";
import CoachCredit from "base/models/CoachCredit";
import Order from "base/models/Order";

// ---------------------------------------------------------------------------
// 1. نرخ ارز
// ---------------------------------------------------------------------------

/**
 * دریافت نرخ ارز با fallback صفر
 * @returns {Promise<number>}
 */
export async function getRate() {
  const rate = await getCachedRate();
  if (!rate || rate <= 0) throw new Error("نرخ ارز در دسترس نیست");
  return rate;
}

// ---------------------------------------------------------------------------
// 2. بارگذاری قوانین تخفیف مرتبط با یک محصول
// ---------------------------------------------------------------------------

/**
 * @param {Object} product  - lean product document (باید brand, category, serie داشته باشد)
 * @param {Object|null} user - decoded token payload (role, level, userId)
 * @param {number} cartValueToman - مجموع سبد خرید به تومان (برای نوع cartValue)
 * @returns {Promise<Object[]>} - قوانین تخفیف مرتبط مرتب‌شده بر اساس priority
 */
export async function loadActiveRules(product, user = null, cartValueToman = 0) {
  const now = new Date();

  const toId = (v) => (v ? new mongoose.Types.ObjectId(v.toString()) : null);
  const productId = toId(product._id);
  const brandId = toId(product.brand?._id ?? product.brand);
  const categoryId = toId(product.category?._id ?? product.category);
  const serieId = product.serie ? toId(product.serie?._id ?? product.serie) : null;

  // ساخت کوئری‌های $or برای نوع‌های مختلف
  const typeQueries = [{ type: "global" }];

  if (productId) typeQueries.push({ type: "product", targets: { $in: [productId] } });
  if (brandId)   typeQueries.push({ type: "brand",   targets: { $in: [brandId]   } });
  if (categoryId)typeQueries.push({ type: "category",targets: { $in: [categoryId]} });
  if (serieId)   typeQueries.push({ type: "serie",   targets: { $in: [serieId]   } });

  // قوانین مرتبط با نقش کاربر
  if (user?.role) {
    typeQueries.push({ type: "userRole", targetRoles: { $in: [user.role] } });
  }

  // قوانین مرتبط با سطح کاربر
  if (user?.level != null && user.level > 0) {
    typeQueries.push({ type: "userLevel", targetLevels: { $in: [user.level] } });
  }

  // قوانین مرتبط با حداقل سبد
  if (cartValueToman > 0) {
    typeQueries.push({ type: "cartValue", "conditions.minCartValue": { $lte: cartValueToman } });
  }

  const rules = await DiscountRule.find({
    active: true,
    startAt: { $lte: now },
    endAt:   { $gte: now },
    $or: typeQueries,
  })
    .sort({ priority: 1 }) // عدد کمتر = اولویت بالاتر
    .lean();

  return rules;
}

// ---------------------------------------------------------------------------
// 3. محاسبه تخفیف پایه (FlashSale + DiscountRules)
// ---------------------------------------------------------------------------

/**
 * محاسبه تخفیف پایه روی یک محصول
 *
 * @param {Object} product       - lean product (basePrice به یورو)
 * @param {number} rate          - نرخ تبدیل یورو → تومان
 * @param {Object|null} user     - اطلاعات کاربر
 * @param {number} cartValueToman
 * @returns {Promise<{
 *   basePriceToman: number,
 *   finalPriceToman: number,
 *   discountAmount: number,
 *   discountPercent: number,
 *   appliedRules: Array<{id: string, type: string, title: string}>
 * }>}
 */
export async function computeProductPrice(product, rate, user = null, cartValueToman = 0) {
  const basePriceToman = eurToToman(product.basePrice || 0, rate);

  // --- FlashSale (بالاترین اولویت) ---
  const now = new Date();
  const flash = await FlashSale.findOne({
    productId: product._id,
    active: true,
    startsAt: { $lte: now },
    endsAt:   { $gte: now },
  }).lean();

  if (flash) {
    const flashPriceToman = eurToToman(flash.flashPrice, rate);
    const discountAmount  = Math.max(0, basePriceToman - flashPriceToman);
    return {
      basePriceToman,
      finalPriceToman: flashPriceToman,
      discountAmount,
      discountPercent: basePriceToman > 0 ? Math.round((discountAmount / basePriceToman) * 100) : 0,
      appliedRules: [{ id: flash._id.toString(), type: "flash", title: flash.title || "حراج فوری" }],
    };
  }

  // --- DiscountRules ---
  const rules = await loadActiveRules(product, user, cartValueToman);

  if (!rules.length) {
    return {
      basePriceToman,
      finalPriceToman: basePriceToman,
      discountAmount: 0,
      discountPercent: 0,
      appliedRules: [],
    };
  }

  // محاسبه مقدار تخفیف هر قانون
  const candidates = rules.map((r) => {
    const amt =
      r.discount.kind === "percent"
        ? Math.min(
            Math.floor(basePriceToman * (r.discount.value / 100)),
            r.discount.maxAmount ?? Infinity
          )
        : eurToToman(r.discount.value, rate); // مقادیر ثابت هم به تومان تبدیل می‌شوند
    return { rule: r, amount: Math.max(0, amt) };
  });

  // اعمال اولین قانون + قوانین combinable
  let totalDiscount = 0;
  const appliedRules = [];

  candidates.forEach((c, idx) => {
    if (idx === 0 || c.rule.combinable) {
      totalDiscount += c.amount;
      appliedRules.push({
        id:    c.rule._id.toString(),
        type:  c.rule.type,
        title: c.rule.title,
      });
    }
  });

  // سقف تخفیف = قیمت پایه
  totalDiscount = Math.min(totalDiscount, basePriceToman);
  const finalPriceToman = basePriceToman - totalDiscount;

  return {
    basePriceToman,
    finalPriceToman,
    discountAmount: totalDiscount,
    discountPercent: basePriceToman > 0 ? Math.round((totalDiscount / basePriceToman) * 100) : 0,
    appliedRules,
  };
}

// ---------------------------------------------------------------------------
// 4. اعمال کوپن
// ---------------------------------------------------------------------------

/**
 * @param {string} couponCode
 * @param {string} userId
 * @param {number} cartTotalToman - مجموع قیمت نهایی سبد قبل از کوپن (به تومان)
 * @param {Object[]} cartItems    - [{ productId, categoryId, brandId, quantity }]
 * @returns {Promise<{valid: boolean, discount: number, coupon: Object|null, reason: string}>}
 */
export async function validateCoupon(couponCode, userId, cartTotalToman, cartItems = []) {
  if (!couponCode?.trim()) return { valid: false, discount: 0, coupon: null, reason: "کد خالی" };

  const now = new Date();
  const coupon = await Coupon.findOne({
    code: couponCode.trim().toUpperCase(),
    active: true,
    startAt: { $lte: now },
    endAt:   { $gte: now },
  }).lean();

  if (!coupon) return { valid: false, discount: 0, coupon: null, reason: "کد تخفیف معتبر نیست" };

  // بررسی حداقل سبد خرید
  if ((coupon.minCartValue || 0) > cartTotalToman) {
    return {
      valid: false, discount: 0, coupon: null,
      reason: `حداقل خرید برای این کد ${coupon.minCartValue.toLocaleString("fa-IR")} تومان است`,
    };
  }

  // بررسی محدودیت کل استفاده
  if (coupon.usageLimit != null) {
    const usedCount = await Order.countDocuments({ "coupon.code": couponCode.trim().toUpperCase() });
    if (usedCount >= coupon.usageLimit) {
      return { valid: false, discount: 0, coupon: null, reason: "ظرفیت کد تخفیف تمام شده است" };
    }
  }

  // بررسی محدودیت per-user
  if (userId && coupon.perUserLimit != null) {
    const userUsed = await Order.countDocuments({
      user: new mongoose.Types.ObjectId(userId),
      "coupon.code": couponCode.trim().toUpperCase(),
    });
    if (userUsed >= coupon.perUserLimit) {
      return { valid: false, discount: 0, coupon: null, reason: "شما قبلاً از این کد استفاده کرده‌اید" };
    }
  }

  // بررسی قابلیت اعمال روی محصولات سبد
  let applicableTotal = 0;
  for (const item of cartItems) {
    let applicable = coupon.applicableTo === "all";
    if (!applicable && coupon.targets?.length) {
      const targets = coupon.targets.map((t) => t.toString());
      if (coupon.applicableTo === "product"  && targets.includes(item.productId?.toString()))  applicable = true;
      if (coupon.applicableTo === "category" && targets.includes(item.categoryId?.toString())) applicable = true;
      if (coupon.applicableTo === "brand"    && targets.includes(item.brandId?.toString()))    applicable = true;
    }
    if (applicable) applicableTotal += item.lineTotalToman || 0;
  }

  if (coupon.applicableTo !== "all" && applicableTotal === 0) {
    return { valid: false, discount: 0, coupon: null, reason: "این کد برای محصولات سبد شما قابل استفاده نیست" };
  }

  const base = coupon.applicableTo === "all" ? cartTotalToman : applicableTotal;
  let discountAmount =
    coupon.discount.kind === "percent"
      ? Math.floor(base * (coupon.discount.value / 100))
      : coupon.discount.value;

  discountAmount = Math.min(discountAmount, base);

  return { valid: true, discount: discountAmount, coupon, reason: "" };
}

// ---------------------------------------------------------------------------
// 5. محاسبه کردیت مربی
// ---------------------------------------------------------------------------

/**
 * محاسبه مبلغ کردیتی که باید به مربی پرداخت شود
 *
 * @param {string} coachId
 * @param {Object[]} items  - [{ productId, categoryId, serieId, lineTotalToman }]
 * @returns {Promise<number>} مبلغ کردیت به تومان
 */
export async function computeCoachCredit(coachId, items) {
  if (!coachId || !items?.length) return 0;

  const now = new Date();
  const coachObjectId = new mongoose.Types.ObjectId(coachId.toString());

  // بارگذاری همه قوانین فعال مربی
  const rules = await CoachCredit.find({
    active: true,
    $or: [
      { scope: "all_coaches" },
      { scope: "specific_coach", coach: coachObjectId },
    ],
    $or: [
      { startAt: null },
      { startAt: { $lte: now } },
    ],
    $or: [
      { endAt: null },
      { endAt: { $gte: now } },
    ],
  })
    .sort({ priority: -1 }) // اولویت بالاتر اول
    .lean();

  if (!rules.length) return 0;

  let totalCredit = 0;

  for (const item of items) {
    if (!item.lineTotalToman || item.lineTotalToman <= 0) continue;

    // پیدا کردن بهترین قانون برای این آیتم
    const matchingRule = rules.find((r) => {
      if (r.targetType === "all") return true;
      if (!r.targets?.length) return false;
      const targets = r.targets.map((t) => t.toString());
      if (r.targetType === "product"  && targets.includes(item.productId?.toString()))  return true;
      if (r.targetType === "category" && targets.includes(item.categoryId?.toString())) return true;
      if (r.targetType === "serie"    && targets.includes(item.serieId?.toString()))    return true;
      return false;
    });

    if (!matchingRule) continue;

    const credit =
      matchingRule.credit.kind === "percent"
        ? Math.floor(item.lineTotalToman * (matchingRule.credit.value / 100))
        : matchingRule.credit.value;

    totalCredit += Math.max(0, credit);
  }

  return totalCredit;
}

// ---------------------------------------------------------------------------
// 6. تابع اصلی — محاسبه قیمت کامل سبد خرید (server-side)
// ---------------------------------------------------------------------------

/**
 * محاسبه کامل قیمت سبد خرید — این تابع باید در سرور صدا زده شود
 *
 * @param {Object[]} cartItems  - [{ productId, variantId?, quantity }]
 * @param {Object|null} user    - decoded token (userId, role, level)
 * @param {string|null} couponCode
 * @returns {Promise<{
 *   items: Array,
 *   subtotalToman: number,
 *   discountToman: number,
 *   couponDiscountToman: number,
 *   finalTotalToman: number,
 *   coupon: Object|null,
 *   couponError: string,
 *   rate: number
 * }>}
 */
export async function computeCartPrice(cartItems, user = null, couponCode = null) {
  await connectToDB();

  const rate = await getRate();

  // import داینامیک برای جلوگیری از circular dependency
  const { default: Product } = await import("base/models/Product");
  const { default: Variant  } = await import("base/models/Variant");

  // بارگذاری محصولات و واریانت‌ها
  const productIds = [...new Set(cartItems.map((i) => i.productId))];
  const variantIds = cartItems.filter((i) => i.variantId).map((i) => i.variantId);

  const [products, variants] = await Promise.all([
    Product.find({ _id: { $in: productIds } })
      .populate("brand", "_id")
      .populate("category", "_id")
      .populate("serie", "_id")
      .lean(),
    variantIds.length ? Variant.find({ _id: { $in: variantIds } }).lean() : Promise.resolve([]),
  ]);

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));
  const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));

  // محاسبه موقت subtotal برای قوانین cartValue
  let subtotalToman = 0;
  for (const ci of cartItems) {
    const p = productMap.get(ci.productId);
    if (!p) continue;
    const v = ci.variantId ? variantMap.get(ci.variantId) : null;
    const eurPrice = v?.price ?? p.basePrice ?? 0;
    subtotalToman += eurToToman(eurPrice, rate) * (ci.quantity || 1);
  }

  // محاسبه قیمت هر آیتم
  const enrichedItems = [];
  let totalDiscount = 0;

  for (const ci of cartItems) {
    const p = productMap.get(ci.productId);
    if (!p) continue;

    const v = ci.variantId ? variantMap.get(ci.variantId) : null;
    const eurPrice = v?.price ?? p.basePrice ?? 0;
    const basePriceToman = eurToToman(eurPrice, rate);
    const qty = Math.max(1, ci.quantity || 1);

    // محاسبه تخفیف برای این محصول
    const priceResult = await computeProductPrice(p, rate, user, subtotalToman);

    // اگر واریانت قیمت خودش را دارد، discount را روی قیمت واریانت محاسبه می‌کنیم
    let unitFinalPrice = priceResult.finalPriceToman;
    let unitDiscount   = priceResult.discountAmount;
    if (v?.price != null) {
      // درصد تخفیف را روی قیمت واریانت اعمال می‌کنیم
      const variantBase = eurToToman(v.price, rate);
      unitDiscount   = Math.min(
        Math.floor(variantBase * (priceResult.discountPercent / 100)),
        variantBase
      );
      unitFinalPrice = variantBase - unitDiscount;
    }

    const lineTotal  = unitFinalPrice * qty;
    const lineDiscount = unitDiscount * qty;
    totalDiscount += lineDiscount;

    enrichedItems.push({
      productId:     p._id.toString(),
      variantId:     v?._id?.toString() ?? null,
      productName:   p.name,
      sku:           v?.sku ?? p.sku,
      quantity:      qty,
      basePriceToman,
      unitFinalPrice,
      unitDiscount,
      lineTotalToman: lineTotal,
      appliedRules:  priceResult.appliedRules,
      // داده‌های لازم برای کوپن و کردیت مربی
      categoryId:    (p.category?._id ?? p.category)?.toString() ?? null,
      brandId:       (p.brand?._id ?? p.brand)?.toString() ?? null,
      serieId:       (p.serie?._id ?? p.serie)?.toString() ?? null,
    });
  }

  const subtotalAfterRules = enrichedItems.reduce((s, i) => s + i.lineTotalToman, 0);

  // اعمال کوپن
  let couponDiscount = 0;
  let appliedCoupon  = null;
  let couponError    = "";

  if (couponCode) {
    const couponResult = await validateCoupon(
      couponCode,
      user?.userId ?? null,
      subtotalAfterRules,
      enrichedItems
    );
    if (couponResult.valid) {
      couponDiscount = couponResult.discount;
      appliedCoupon  = { code: couponResult.coupon.code, _id: couponResult.coupon._id };
    } else {
      couponError = couponResult.reason;
    }
  }

  const finalTotalToman = Math.max(0, subtotalAfterRules - couponDiscount);

  return {
    items:                enrichedItems,
    subtotalToman:        enrichedItems.reduce((s, i) => s + i.basePriceToman * i.quantity, 0),
    discountToman:        totalDiscount,
    couponDiscountToman:  couponDiscount,
    finalTotalToman,
    coupon:               appliedCoupon,
    couponError,
    rate,
  };
}
