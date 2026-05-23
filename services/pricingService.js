/**
 * pricingService.js
 *
 * تنها منبع حقیقت برای محاسبه قیمت در سرور.
 * این سرویس:
 *  1. نرخ تبدیل یورو → تومان را از DB می‌خواند
 *  2. تخفیف‌های DiscountRule را بر اساس محصول + کاربر اعمال می‌کند
 *  3. کوپن را (در صورت وجود) validate و اعمال می‌کند
 *  4. قیمت نهایی تومانی را برمی‌گرداند
 *
 * NEVER trust prices sent from the client — always recalculate here.
 */

import connectToDB from "base/configs/db";
import { ExchangeRate } from "base/models/ExchangeRate";
import DiscountRule from "base/models/DiscountRule";
import Coupon from "base/models/Coupon";
import Order from "base/models/Order";

// ─────────────────────────────────────────────
// 1. Exchange Rate (با cache ساده در حافظه)
// ─────────────────────────────────────────────

let _rateCache = null;
let _rateCacheAt = 0;
const RATE_TTL_MS = 5 * 60 * 1000; // 5 دقیقه

export async function getExchangeRate() {
  const now = Date.now();
  if (_rateCache && now - _rateCacheAt < RATE_TTL_MS) {
    return _rateCache;
  }

  const doc = await ExchangeRate.findOne().sort({ updatedAt: -1 }).lean();
  if (!doc || !doc.rateToToman) {
    throw new Error("نرخ تبدیل ارز ثبت نشده است. لطفاً از پنل ادمین نرخ را وارد کنید.");
  }

  _rateCache = doc.rateToToman;
  _rateCacheAt = now;
  return _rateCache;
}

/** یورو → تومان (گرد شده) */
export function eurToToman(eurPrice, rate) {
  return Math.round((eurPrice || 0) * rate);
}

// ─────────────────────────────────────────────
// 2. محاسبه تخفیف قوانین (DiscountRule)
// ─────────────────────────────────────────────

/**
 * @param {Object} product   - lean Product شامل { _id, category, serie, brand, basePrice }
 * @param {Object|null} user - lean User شامل { _id, role, level } یا null
 * @param {number} cartTotalToman - مجموع سبد (تومان) برای قوانین cartValue
 * @param {boolean} isFirstOrder
 * @returns {{ discountToman: number, appliedRuleIds: string[] }}
 */
export async function applyDiscountRules(product, user, cartTotalToman = 0, isFirstOrder = false) {
  const now = new Date();

  const orConditions = [
    { type: "global" },
    { type: "product", targets: product._id },
    { type: "category", targets: product.category },
    { type: "brand", targets: product.brand },
  ];

  if (product.serie) {
    orConditions.push({ type: "serie", targets: product.serie });
  }
  if (user?.role) {
    orConditions.push({ type: "userRole", targetRoles: user.role });
  }
  if (user?.level > 0) {
    orConditions.push({ type: "userLevel", targetLevels: user.level });
  }
  // cartValue rules: فیلتر سرسری اینجا، چک دقیق پایین‌تر
  orConditions.push({ type: "cartValue" });

  const rules = await DiscountRule.find({
    active: true,
    startAt: { $lte: now },
    endAt: { $gte: now },
    $or: orConditions,
  })
    .sort({ priority: 1 })
    .lean();

  // قیمت پایه به تومان (برای محاسبه درصد)
  const rate = await getExchangeRate();
  const basePriceToman = eurToToman(product.basePrice || 0, rate);

  let totalDiscount = 0;
  const appliedRuleIds = [];

  for (const rule of rules) {
    // شرایط cartValue
    if (rule.type === "cartValue") {
      if ((rule.conditions?.minCartValue || 0) > cartTotalToman) continue;
    }
    // سایر شرایط مشترک
    if (rule.conditions?.minCartValue && cartTotalToman < rule.conditions.minCartValue) continue;
    if (rule.conditions?.onlyFirstOrders && !isFirstOrder) continue;
    if (rule.usageLimit !== null && rule.usedCount >= rule.usageLimit) continue;

    let discount = 0;
    if (rule.discount.kind === "percent") {
      discount = (basePriceToman * rule.discount.value) / 100;
      if (rule.discount.maxAmount) {
        discount = Math.min(discount, rule.discount.maxAmount);
      }
    } else {
      discount = rule.discount.value; // مبلغ ثابت به تومان
    }

    discount = Math.floor(Math.min(discount, basePriceToman));

    if (!rule.combinable) {
      // فقط بهترین غیر-ترکیبی را نگه می‌داریم
      if (discount > totalDiscount) {
        totalDiscount = discount;
        appliedRuleIds.length = 0;
        appliedRuleIds.push(rule._id.toString());
      }
      // چون non-combinable است، بعد از اولین مطابق متوقف می‌شویم
      break;
    } else {
      totalDiscount += discount;
      appliedRuleIds.push(rule._id.toString());
    }
  }

  return {
    discountToman: Math.min(totalDiscount, basePriceToman),
    appliedRuleIds,
  };
}

// ─────────────────────────────────────────────
// 3. اعمال کوپن
// ─────────────────────────────────────────────

/**
 * @returns {{ couponDiscountToman: number, couponId: string|null, error: string|null }}
 */
export async function applyCoupon({
  couponCode,
  product,
  userId,
  cartTotalToman,
}) {
  if (!couponCode) return { couponDiscountToman: 0, couponId: null, error: null };

  const now = new Date();
  const coupon = await Coupon.findOne({
    code: couponCode.toUpperCase().trim(),
    active: true,
    startAt: { $lte: now },
    endAt: { $gte: now },
  }).lean();

  if (!coupon) {
    return { couponDiscountToman: 0, couponId: null, error: "کوپن نامعتبر یا منقضی شده است" };
  }

  // بررسی سقف استفاده کلی
  if (coupon.usageLimit !== null) {
    // usedCount نداریم در مدل Coupon فعلی — از Order می‌شماریم
    const usedCount = await Order.countDocuments({ "coupon.id": coupon._id });
    if (usedCount >= coupon.usageLimit) {
      return { couponDiscountToman: 0, couponId: null, error: "ظرفیت استفاده از این کوپن تمام شده است" };
    }
  }

  // بررسی سقف استفاده per user
  if (coupon.perUserLimit && userId) {
    const userUsed = await Order.countDocuments({
      user: userId,
      "coupon.id": coupon._id,
    });
    if (userUsed >= coupon.perUserLimit) {
      return { couponDiscountToman: 0, couponId: null, error: "شما قبلاً از این کوپن استفاده کرده‌اید" };
    }
  }

  // بررسی حداقل سبد
  if ((coupon.minCartValue || 0) > cartTotalToman) {
    return {
      couponDiscountToman: 0,
      couponId: null,
      error: `حداقل مبلغ سبد خرید برای این کوپن ${coupon.minCartValue?.toLocaleString("fa-IR")} تومان است`,
    };
  }

  // بررسی قابلیت اعمال روی محصول
  if (coupon.applicableTo !== "all") {
    const targetIds = coupon.targets.map((t) => t.toString());
    const checkField =
      coupon.applicableTo === "product"
        ? product._id.toString()
        : coupon.applicableTo === "brand"
        ? product.brand?.toString()
        : product.category?.toString();

    if (!checkField || !targetIds.includes(checkField)) {
      return { couponDiscountToman: 0, couponId: null, error: "این کوپن برای محصول انتخابی قابل اعمال نیست" };
    }
  }

  // محاسبه مقدار تخفیف کوپن
  const rate = await getExchangeRate();
  const basePriceToman = eurToToman(product.basePrice || 0, rate);

  let couponDiscount = 0;
  if (coupon.discount.kind === "percent") {
    couponDiscount = Math.floor((basePriceToman * coupon.discount.value) / 100);
  } else {
    couponDiscount = coupon.discount.value;
  }

  couponDiscount = Math.min(couponDiscount, basePriceToman);

  return {
    couponDiscountToman: couponDiscount,
    couponId: coupon._id.toString(),
    error: null,
  };
}

// ─────────────────────────────────────────────
// 4. محاسبه کامل قیمت یک آیتم
// ─────────────────────────────────────────────

/**
 * محاسبه قیمت نهایی یک آیتم — همه چیز سرور-ساید
 *
 * @param {Object} opts
 * @param {Object} opts.product      - lean Product
 * @param {Object|null} opts.variant - lean Variant یا null
 * @param {number} opts.quantity
 * @param {Object|null} opts.user    - lean User یا null
 * @param {string|null} opts.couponCode
 * @param {number} opts.cartTotalToman - مجموع سبد قبل از این آیتم (برای cartValue rules)
 * @param {boolean} opts.isFirstOrder
 * @returns {Promise<{
 *   basePriceToman: number,
 *   unitPriceToman: number,  // قیمت واحد بعد از تخفیف
 *   totalToman: number,       // unitPrice * quantity
 *   discountToman: number,    // تخفیف per unit
 *   discountPercent: number,
 *   appliedRuleIds: string[],
 *   couponDiscountToman: number,
 *   couponId: string|null,
 *   couponError: string|null,
 *   rate: number
 * }>}
 */
export async function calculateItemPrice({
  product,
  variant = null,
  quantity = 1,
  user = null,
  couponCode = null,
  cartTotalToman = 0,
  isFirstOrder = false,
}) {
  const rate = await getExchangeRate();

  // قیمت پایه: اگر variant دارد از variant، وگرنه از product
  const eurBase = variant?.price ?? product.basePrice ?? 0;
  const basePriceToman = eurToToman(eurBase, rate);

  // اعمال قوانین تخفیف
  const { discountToman, appliedRuleIds } = await applyDiscountRules(
    product,
    user,
    cartTotalToman,
    isFirstOrder
  );

  // اعمال کوپن (فقط برای یک آیتم — اگر multi-item بود، کوپن در سطح سبد اعمال شود)
  const { couponDiscountToman, couponId, error: couponError } = await applyCoupon({
    couponCode,
    product,
    userId: user?._id,
    cartTotalToman,
  });

  const totalDiscountPerUnit = Math.min(
    discountToman + couponDiscountToman,
    basePriceToman
  );

  const unitPriceToman = basePriceToman - totalDiscountPerUnit;
  const discountPercent =
    basePriceToman > 0
      ? Math.round((totalDiscountPerUnit / basePriceToman) * 100)
      : 0;

  return {
    basePriceToman,
    unitPriceToman: Math.max(0, unitPriceToman),
    totalToman: Math.max(0, unitPriceToman) * quantity,
    discountToman: totalDiscountPerUnit,
    discountPercent,
    appliedRuleIds,
    couponDiscountToman,
    couponId,
    couponError,
    rate,
  };
}

// ─────────────────────────────────────────────
// 5. محاسبه کل سبد خرید
// ─────────────────────────────────────────────

/**
 * @param {Array<{ product, variant, quantity }>} cartItems
 * @param {Object|null} user
 * @param {string|null} couponCode
 * @param {boolean} isFirstOrder
 * @returns {Promise<{ items: Array, grandTotalToman: number, couponError: string|null }>}
 */
export async function calculateCartTotal({
  cartItems,
  user = null,
  couponCode = null,
  isFirstOrder = false,
}) {
  const rate = await getExchangeRate();

  // محاسبه مجموع سبد (بدون تخفیف) برای قوانین cartValue
  const roughCartTotal = cartItems.reduce((sum, { product, variant, quantity }) => {
    const eurBase = variant?.price ?? product.basePrice ?? 0;
    return sum + eurToToman(eurBase, rate) * (quantity || 1);
  }, 0);

  let couponError = null;
  let couponApplied = false;
  const results = [];

  for (const { product, variant, quantity } of cartItems) {
    // کوپن فقط یک بار (برای اولین آیتم اعمال می‌شود تا از double-dip جلوگیری شود)
    const effectiveCoupon = !couponApplied ? couponCode : null;

    const priceInfo = await calculateItemPrice({
      product,
      variant,
      quantity: quantity || 1,
      user,
      couponCode: effectiveCoupon,
      cartTotalToman: roughCartTotal,
      isFirstOrder,
    });

    if (priceInfo.couponError) {
      couponError = priceInfo.couponError;
    } else if (priceInfo.couponId) {
      couponApplied = true;
    }

    results.push({
      productId: product._id.toString(),
      variantId: variant?._id?.toString() ?? null,
      quantity: quantity || 1,
      ...priceInfo,
    });
  }

  const grandTotalToman = results.reduce((sum, r) => sum + r.totalToman, 0);

  return { items: results, grandTotalToman, couponError };
}
