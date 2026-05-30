// base/utils/discountCalculator.js
import DiscountRule from "base/models/DiscountRule";

/**
 * محاسبه تخفیف نهایی برای یک آیتم سبد خرید
 * @param {Object} params
 * @param {Object} params.product  - آبجکت محصول { _id, category, serie, brand, basePrice }
 * @param {Object} params.user     - آبجکت کاربر { _id, role, level } یا null
 * @param {number} params.cartTotal - مجموع کل سبد خرید
 * @param {boolean} params.isFirstOrder - آیا اولین سفارش است
 * @returns {{ discountAmount: number, appliedRule: Object|null }}
 */
export async function calculateDiscount({ product, user, cartTotal = 0, isFirstOrder = false }) {
  const now = new Date();

  // ساخت query برای یافتن قوانین مرتبط
  const orConditions = [
    { type: "global" },
    { type: "product", targets: product._id },
    { type: "category", targets: product.category },
    { type: "brand", targets: product.brand },
    ...(product.variantId ? [{ type: "variant", targets: product.variantId }] : []),
  ];
  if (product.serie) {
    orConditions.push({ type: "serie", targets: product.serie });
  }

  if (user) {
    if (user.role) {
      orConditions.push({ type: "userRole", targetRoles: user.role });
    }
    if (user.level > 0) {
      orConditions.push({ type: "userLevel", targetLevels: user.level });
    }
  }

  orConditions.push({ type: "cartValue", "conditions.minCartValue": { $lte: cartTotal } });

  const rules = await DiscountRule.find({
    active: true,
    startAt: { $lte: now },
    endAt: { $gte: now },
    $or: orConditions,
  })
    .sort({ priority: 1 })
    .lean();

  let bestDiscount = 0;
  let appliedRule = null;

  for (const rule of rules) {
    // بررسی شرایط
    if (rule.conditions?.minCartValue && cartTotal < rule.conditions.minCartValue) continue;
    if (rule.conditions?.onlyFirstOrders && !isFirstOrder) continue;
    if (rule.usageLimit !== null && rule.usedCount >= rule.usageLimit) continue;

    const price = product.basePrice || 0;
    let discount = 0;

    if (rule.discount.kind === "percent") {
      discount = (price * rule.discount.value) / 100;
      if (rule.discount.maxAmount) {
        discount = Math.min(discount, rule.discount.maxAmount);
      }
    } else {
      discount = rule.discount.value;
    }

    discount = Math.min(discount, price); // تخفیف بیشتر از قیمت نمی‌شود

    if (discount > bestDiscount) {
      bestDiscount = discount;
      appliedRule = rule;
    }

    // اگر قابل ترکیب نیست، همین اولی کافی است
    if (!rule.combinable) break;
  }

  return { discountAmount: bestDiscount, appliedRule };
}

/**
 * محاسبه کردیت مربی به ازای خرید شاگرد
 * @param {Object} params
 * @param {Object} params.product    - آبجکت محصول
 * @param {Object} params.coach      - آبجکت مربی { _id }
 * @param {number} params.purchaseAmount - مبلغ پرداختی توسط شاگرد
 * @param {boolean} params.isNewStudent  - آیا شاگرد جدید است
 * @returns {{ creditAmount: number, appliedRule: Object|null }}
 */
export async function calculateCoachCredit({ product, coach, purchaseAmount, isNewStudent = false }) {
  if (!coach) return { creditAmount: 0, appliedRule: null };

  const now = new Date();

  const CoachCredit = (await import("base/models/CoachCredit")).default;

  const rules = await CoachCredit.find({
    active: true,
    $or: [
      { startAt: null },
      { startAt: { $lte: now } },
    ],
    $or: [
      { endAt: null },
      { endAt: { $gte: now } },
    ],
    $or: [
      { scope: "all_coaches" },
      { scope: "specific_coach", coach: coach._id },
    ],
  })
    .sort({ priority: 1 })
    .lean();

  for (const rule of rules) {
    // بررسی targetType
    let matched = false;
    if (rule.targetType === "all") {
      matched = true;
    } else if (rule.targetType === "product" && rule.targets.some((t) => t.toString() === product._id.toString())) {
      matched = true;
    } else if (rule.targetType === "category" && rule.targets.some((t) => t.toString() === product.category?.toString())) {
      matched = true;
    } else if (rule.targetType === "serie" && product.serie && rule.targets.some((t) => t.toString() === product.serie.toString())) {
      matched = true;
    }

    if (!matched) continue;
    if (rule.conditions?.onlyNewStudents && !isNewStudent) continue;
    if (rule.conditions?.minPurchaseAmount && purchaseAmount < rule.conditions.minPurchaseAmount) continue;

    let credit = 0;
    if (rule.credit.kind === "percent") {
      credit = (purchaseAmount * rule.credit.value) / 100;
    } else {
      credit = rule.credit.value;
    }

    return { creditAmount: Math.floor(credit), appliedRule: rule };
  }

  return { creditAmount: 0, appliedRule: null };
}
