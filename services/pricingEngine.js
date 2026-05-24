/**
 * services/pricingEngine.js
 *
 * موتور قیمت‌گذاری مرکزی — تنها منبع حقیقت برای محاسبه قیمت
 *
 * این فایل فقط سمت سرور اجرا می‌شود.
 * هرگز قیمت نهایی را از client دریافت و اعتماد نکنید.
 *
 * جریان محاسبه:
 *   basePrice (EUR) → toman → flashSale? → discountRules → coupon → finalPrice
 */

import mongoose from "mongoose";
import { ExchangeRate } from "base/models/ExchangeRate";
import DiscountRule from "base/models/DiscountRule";
import FlashSale from "base/models/FlashSale";
import Coupon from "base/models/Coupon";
import Order from "base/models/Order";

/* ─────────────────────────────────────────
   1. نرخ ارز — کش در‌حافظه با TTL
───────────────────────────────────────── */
let _rateCache = null;
let _rateCacheAt = 0;
const RATE_TTL_MS = 10 * 60 * 1000; // ۱۰ دقیقه

export async function getExchangeRate() {
  const now = Date.now();
  if (_rateCache && now - _rateCacheAt < RATE_TTL_MS) return _rateCache;

  const doc = await ExchangeRate.findOne({ currency: "EUR" }).lean();
  if (!doc?.rateToToman) throw new Error("نرخ ارز تنظیم نشده است");

  _rateCache = doc.rateToToman;
  _rateCacheAt = now;
  return _rateCache;
}

export function invalidateRateCache() {
  _rateCache = null;
  _rateCacheAt = 0;
}

/* ─────────────────────────────────────────
   2. تبدیل یورو → تومان (گرد به هزار)
───────────────────────────────────────── */
export function eurToToman(eurPrice, rate) {
  if (!eurPrice || !rate) return 0;
  const raw = Math.round(Number(eurPrice) * Number(rate));
  return Math.floor(raw / 1000) * 1000;
}

/* ─────────────────────────────────────────
   3. قوانین تخفیف برای یک محصول
───────────────────────────────────────── */
async function loadDiscountRules(product, user = null, cartTotal = 0) {
  const now = new Date();

  const orConditions = [{ type: "global" }];

  if (product._id) {
    orConditions.push({ type: "product", targets: product._id });
  }
  if (product.brand) {
    const brandId =
      product.brand._id ? product.brand._id : product.brand;
    orConditions.push({ type: "brand", targets: brandId });
  }
  if (product.category) {
    const catId =
      product.category._id ? product.category._id : product.category;
    orConditions.push({ type: "category", targets: catId });
  }
  if (product.serie) {
    const serieId =
      product.serie._id ? product.serie._id : product.serie;
    orConditions.push({ type: "serie", targets: serieId });
  }
  if (user?.role) {
    orConditions.push({ type: "userRole", targetRoles: user.role });
  }
  if (user?.level && user.level > 0) {
    orConditions.push({ type: "userLevel", targetLevels: user.level });
  }
  if (cartTotal > 0) {
    orConditions.push({
      type: "cartValue",
      "conditions.minCartValue": { $lte: cartTotal },
    });
  }

  return DiscountRule.find({
    active: true,
    startAt: { $lte: now },
    endAt: { $gte: now },
    $or: orConditions,
  })
    .sort({ priority: 1 })
    .lean();
}

/* ─────────────────────────────────────────
   4. محاسبه تخفیف از rules (بدون کوپن)
───────────────────────────────────────── */
function applyRules(baseToman, rules) {
  if (!rules || rules.length === 0) return { discount: 0, appliedRules: [] };

  let total = 0;
  const appliedRules = [];

  for (const rule of rules) {
    // بررسی محدودیت استفاده
    if (rule.usageLimit !== null && rule.usedCount >= rule.usageLimit) continue;

    let amount =
      rule.discount.kind === "percent"
        ? Math.floor(baseToman * (rule.discount.value / 100))
        : rule.discount.value;

    // سقف تخفیف درصدی
    if (rule.discount.kind === "percent" && rule.discount.maxAmount) {
      amount = Math.min(amount, rule.discount.maxAmount);
    }

    amount = Math.min(amount, baseToman); // تخفیف بیشتر از قیمت نمی‌شود

    if (appliedRules.length === 0) {
      // اولین rule (بالاترین اولویت) همیشه اعمال می‌شود
      total += amount;
      appliedRules.push(rule._id);
    } else if (rule.combinable) {
      // فقط rule های combinable بعد از اولی
      total += amount;
      appliedRules.push(rule._id);
    }
  }

  return { discount: Math.min(total, baseToman), appliedRules };
}

/* ─────────────────────────────────────────
   5. محاسبه تخفیف کوپن
───────────────────────────────────────── */
async function applyCoupon(
  couponCode,
  product,
  user,
  baseToman,
  cartTotal,
  quantity
) {
  if (!couponCode) return { discount: 0, couponId: null, error: null };

  const now = new Date();
  const coupon = await Coupon.findOne({
    code: couponCode.trim().toUpperCase(),
    active: true,
    startAt: { $lte: now },
    endAt: { $gte: now },
  }).lean();

  if (!coupon) return { discount: 0, couponId: null, error: "کوپن معتبر نیست" };
  if ((coupon.minCartValue || 0) > cartTotal)
    return {
      discount: 0,
      couponId: null,
      error: `حداقل خرید ${coupon.minCartValue.toLocaleString("fa-IR")} تومان`,
    };

  // بررسی محدودیت کل استفاده
  if (coupon.usageLimit !== null) {
    const usedTotal = await Order.countDocuments({
      "appliedCoupon.couponId": coupon._id,
    });
    if (usedTotal >= coupon.usageLimit)
      return { discount: 0, couponId: null, error: "ظرفیت کوپن پر شده است" };
  }

  // بررسی محدودیت per-user
  if (user && coupon.perUserLimit) {
    const usedByUser = await Order.countDocuments({
      user: user._id,
      "appliedCoupon.couponId": coupon._id,
    });
    if (usedByUser >= coupon.perUserLimit)
      return {
        discount: 0,
        couponId: null,
        error: "شما قبلاً از این کوپن استفاده کرده‌اید",
      };
  }

  // بررسی اینکه کوپن برای این محصول اعمال می‌شود
  if (coupon.applicableTo !== "all") {
    const productId = product._id?.toString();
    const brandId = (product.brand?._id || product.brand)?.toString();
    const catId = (product.category?._id || product.category)?.toString();
    const targets = coupon.targets.map((t) => t.toString());

    let applicable = false;
    if (coupon.applicableTo === "product") applicable = targets.includes(productId);
    else if (coupon.applicableTo === "brand") applicable = targets.includes(brandId);
    else if (coupon.applicableTo === "category") applicable = targets.includes(catId);

    if (!applicable)
      return {
        discount: 0,
        couponId: null,
        error: "این کوپن برای این محصول قابل استفاده نیست",
      };
  }

  const itemBase = baseToman * quantity;
  const discount =
    coupon.discount.kind === "percent"
      ? Math.floor(itemBase * (coupon.discount.value / 100))
      : coupon.discount.value;

  return {
    discount: Math.min(discount, itemBase),
    couponId: coupon._id,
    error: null,
  };
}

/* ─────────────────────────────────────────
   6. محاسبه قیمت نهایی یک آیتم (تومان)
───────────────────────────────────────── */
/**
 * @param {Object} params
 * @param {Object} params.product      - آبجکت محصول (از DB، با populate)
 * @param {Object|null} params.variant - واریانت انتخابی یا null
 * @param {number} params.quantity     - تعداد
 * @param {Object|null} params.user    - { _id, role, level }
 * @param {string|null} params.couponCode - کد کوپن
 * @param {number} params.cartTotal    - مجموع سبد (تومان) برای محاسبه cartValue discounts
 * @param {number} params.rate         - نرخ ارز (EUR→Toman)
 * @returns {Promise<PriceResult>}
 */
export async function calculateItemPrice({
  product,
  variant = null,
  quantity = 1,
  user = null,
  couponCode = null,
  cartTotal = 0,
  rate,
}) {
  if (!rate) rate = await getExchangeRate();

  // قیمت پایه: واریانت اولویت دارد
  const eurBase = variant ? variant.price : product.basePrice;
  const tomanBase = eurToToman(eurBase, rate);
  const tomanBaseTotal = tomanBase * quantity;

  // FlashSale — بالاترین اولویت
  const now = new Date();
  const flash = await FlashSale.findOne({
    productId: product._id,
    active: true,
    startsAt: { $lte: now },
    endsAt: { $gte: now },
  }).lean();

  if (flash) {
    const flashToman = eurToToman(flash.flashPrice, rate);
    const flashDiscount = Math.max(0, tomanBase - flashToman) * quantity;
    return {
      eurBase,
      tomanBase,
      tomanBaseTotal,
      discount: flashDiscount,
      discountPercent: tomanBase > 0 ? Math.round((flashDiscount / tomanBaseTotal) * 100) : 0,
      finalPrice: flashToman * quantity,
      unitFinalPrice: flashToman,
      appliedRules: [],
      appliedFlash: flash._id,
      couponDiscount: 0,
      couponId: null,
      couponError: null,
    };
  }

  // قوانین تخفیف
  const rules = await loadDiscountRules(product, user, cartTotal);
  const { discount: ruleDiscount, appliedRules } = applyRules(tomanBase, rules);
  const afterRules = tomanBase - ruleDiscount;

  // کوپن روی هر آیتم جداگانه یا روی کل سبد اعمال می‌شود
  // در این تابع فقط اگر couponCode داده شده باشد محاسبه می‌کنیم
  const {
    discount: couponDiscount,
    couponId,
    error: couponError,
  } = await applyCoupon(
    couponCode,
    product,
    user,
    afterRules,
    cartTotal,
    quantity
  );

  const totalDiscount = ruleDiscount * quantity + couponDiscount;
  const finalPrice = tomanBaseTotal - totalDiscount;

  return {
    eurBase,
    tomanBase,
    tomanBaseTotal,
    discount: totalDiscount,
    discountPercent: tomanBaseTotal > 0 ? Math.round((totalDiscount / tomanBaseTotal) * 100) : 0,
    finalPrice: Math.max(0, finalPrice),
    unitFinalPrice: Math.max(0, Math.round(finalPrice / quantity)),
    appliedRules,
    appliedFlash: null,
    couponDiscount,
    couponId,
    couponError,
  };
}

/* ─────────────────────────────────────────
   7. محاسبه کردیت مربی (بعد از ثبت سفارش)
───────────────────────────────────────── */
export async function calculateCoachCredit({ product, coachId, purchaseAmount, isNewStudent = false }) {
  if (!coachId) return { creditAmount: 0, ruleId: null };

  const CoachCredit = (await import("base/models/CoachCredit")).default;
  const now = new Date();

  const rules = await CoachCredit.find({
    active: true,
    $or: [{ scope: "all_coaches" }, { scope: "specific_coach", coach: coachId }],
    $and: [
      { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
      { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
    ],
  })
    .sort({ priority: -1 }) // اولویت بالاتر = عدد بزرگتر
    .lean();

  for (const rule of rules) {
    // بررسی تطابق هدف
    let matched = false;
    if (rule.targetType === "all") {
      matched = true;
    } else if (rule.targetType === "product") {
      matched = rule.targets.some((t) => t.toString() === product._id.toString());
    } else if (rule.targetType === "category") {
      const catId = (product.category?._id || product.category)?.toString();
      matched = rule.targets.some((t) => t.toString() === catId);
    } else if (rule.targetType === "serie") {
      const serieId = (product.serie?._id || product.serie)?.toString();
      matched = serieId && rule.targets.some((t) => t.toString() === serieId);
    }

    if (!matched) continue;
    if (rule.conditions?.onlyNewStudents && !isNewStudent) continue;
    if (rule.conditions?.minPurchaseAmount && purchaseAmount < rule.conditions.minPurchaseAmount) continue;

    const credit =
      rule.credit.kind === "percent"
        ? Math.floor(purchaseAmount * (rule.credit.value / 100))
        : rule.credit.value;

    return { creditAmount: credit, ruleId: rule._id };
  }

  return { creditAmount: 0, ruleId: null };
}

/* ─────────────────────────────────────────
   8. محاسبه کل سبد خرید (server-side)
   برای اعتبارسنجی totalPrice در ثبت سفارش
───────────────────────────────────────── */
export async function calculateCartTotal({ items, user, couponCode }) {
  const rate = await getExchangeRate();

  // بارگذاری محصولات
  const Product = (await import("base/models/Product")).default;
  const Variant = (await import("base/models/Variant")).default;

  const productIds = items.map((i) => i.productId);
  const variantIds = items.filter((i) => i.variantId).map((i) => i.variantId);

  const [products, variants] = await Promise.all([
    Product.find({ _id: { $in: productIds } })
      .populate("brand category serie")
      .lean(),
    variantIds.length > 0
      ? Variant.find({ _id: { $in: variantIds } }).lean()
      : Promise.resolve([]),
  ]);

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));
  const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));

  // اول کل قیمت پایه را برای محاسبه cartValue discounts حساب کنیم
  let roughCartTotal = 0;
  for (const item of items) {
    const product = productMap.get(item.productId?.toString());
    if (!product) continue;
    const variant = item.variantId ? variantMap.get(item.variantId?.toString()) : null;
    const eurBase = variant ? variant.price : product.basePrice;
    roughCartTotal += eurToToman(eurBase, rate) * (item.quantity || 1);
  }

  // محاسبه دقیق هر آیتم
  const calculatedItems = [];
  let totalFinal = 0;
  let totalBase = 0;
  let couponError = null;

  for (const item of items) {
    const product = productMap.get(item.productId?.toString());
    if (!product) continue;

    const variant = item.variantId ? variantMap.get(item.variantId?.toString()) : null;
    const quantity = Math.max(1, Math.floor(item.quantity || 1));

    // بررسی موجودی
    const available = variant ? variant.stock : (product.stock ?? 999);
    const safeQty = Math.min(quantity, available > 0 ? available : 0);
    if (safeQty === 0) continue; // اگر موجودی ندارد، از سبد حذف می‌شود

    const priceResult = await calculateItemPrice({
      product,
      variant,
      quantity: safeQty,
      user,
      couponCode,
      cartTotal: roughCartTotal,
      rate,
    });

    if (priceResult.couponError) couponError = priceResult.couponError;

    calculatedItems.push({
      productId: product._id,
      variantId: variant?._id || null,
      quantity: safeQty,
      tomanBase: priceResult.tomanBase,
      unitFinalPrice: priceResult.unitFinalPrice,
      itemFinalPrice: priceResult.finalPrice,
      discount: priceResult.discount,
      appliedRules: priceResult.appliedRules,
      appliedFlash: priceResult.appliedFlash,
      couponDiscount: priceResult.couponDiscount,
      // برای ذخیره در order.items
      productSnapshot: {
        name: product.name,
        mainImage: product.mainImage,
        sku: product.sku,
      },
    });

    totalFinal += priceResult.finalPrice;
    totalBase += priceResult.tomanBaseTotal;
  }

  return {
    items: calculatedItems,
    totalBase,
    totalFinal,
    totalDiscount: totalBase - totalFinal,
    rate,
    couponError,
  };
}
