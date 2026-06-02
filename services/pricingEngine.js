/**
 * services/priceEngine.js
 *
 * موتور مرکزی قیمت‌گذاری — با پشتیبانی از محصولات معمولی و دست‌دوم
 *
 * آیتم‌های ورودی می‌توانند دو نوع باشند:
 *   { productId, variantId?, quantity }               → محصول معمولی
 *   { usedProductId, quantity, itemType: "used" }     → محصول دست‌دوم
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
export async function getRate() {
  const rate = await getCachedRate();
  if (!rate || rate <= 0) throw new Error("نرخ ارز در دسترس نیست");
  return rate;
}

// ---------------------------------------------------------------------------
// 2. بارگذاری قوانین تخفیف
// ---------------------------------------------------------------------------
export async function loadActiveRules(product, user = null, cartValueToman = 0) {
  const now = new Date();

  const toId = (v) => (v ? new mongoose.Types.ObjectId(v.toString()) : null);
  const productId  = toId(product._id);
  const brandId    = toId(product.brand?._id ?? product.brand);
  const categoryId = toId(product.category?._id ?? product.category);
  const serieId    = product.serie ? toId(product.serie?._id ?? product.serie) : null;

  const typeQueries = [{ type: "global" }];
  if (productId)  typeQueries.push({ type: "product",  targets: { $in: [productId]  } });
  if (brandId)    typeQueries.push({ type: "brand",    targets: { $in: [brandId]    } });
  if (categoryId) typeQueries.push({ type: "category", targets: { $in: [categoryId] } });
  if (serieId)    typeQueries.push({ type: "serie",    targets: { $in: [serieId]    } });
  if (user?.role) typeQueries.push({ type: "userRole", targetRoles: { $in: [user.role] } });
  if (user?.level != null && user.level > 0)
    typeQueries.push({ type: "userLevel", targetLevels: { $in: [user.level] } });
  if (cartValueToman > 0)
    typeQueries.push({ type: "cartValue", "conditions.minCartValue": { $lte: cartValueToman } });

  const rules = await DiscountRule.find({
    active: true,
    startAt: { $lte: now },
    endAt:   { $gte: now },
    $or: typeQueries,
  })
    .sort({ priority: 1 })
    .lean();

  return rules;
}

// ---------------------------------------------------------------------------
// 3. محاسبه تخفیف محصول معمولی
// ---------------------------------------------------------------------------
export async function computeProductPrice(product, rate, user = null, cartValueToman = 0) {
  const basePriceToman = eurToToman(product.basePrice || 0, rate);

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

  const rules = await loadActiveRules(product, user, cartValueToman);

  if (!rules.length) {
    return { basePriceToman, finalPriceToman: basePriceToman, discountAmount: 0, discountPercent: 0, appliedRules: [] };
  }

  const candidates = rules.map((r) => {
    const amt =
      r.discount.kind === "percent"
        ? Math.min(
            Math.floor(basePriceToman * (r.discount.value / 100)),
            r.discount.maxAmount ?? Infinity
          )
        : eurToToman(r.discount.value, rate);
    return { rule: r, amount: Math.max(0, amt) };
  });

  let totalDiscount = 0;
  const appliedRules = [];
  candidates.forEach((c, idx) => {
    if (idx === 0 || c.rule.combinable) {
      totalDiscount += c.amount;
      appliedRules.push({ id: c.rule._id.toString(), type: c.rule.type, title: c.rule.title });
    }
  });

  totalDiscount = Math.min(totalDiscount, basePriceToman);
  return {
    basePriceToman,
    finalPriceToman: basePriceToman - totalDiscount,
    discountAmount: totalDiscount,
    discountPercent: basePriceToman > 0 ? Math.round((totalDiscount / basePriceToman) * 100) : 0,
    appliedRules,
  };
}

// ---------------------------------------------------------------------------
// 4. اعمال کوپن
// ---------------------------------------------------------------------------
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

  if ((coupon.minCartValue || 0) > cartTotalToman) {
    return {
      valid: false, discount: 0, coupon: null,
      reason: `حداقل خرید برای این کد ${coupon.minCartValue.toLocaleString("fa-IR")} تومان است`,
    };
  }

  if (coupon.usageLimit != null) {
    const usedCount = await Order.countDocuments({ "coupon.code": couponCode.trim().toUpperCase() });
    if (usedCount >= coupon.usageLimit)
      return { valid: false, discount: 0, coupon: null, reason: "ظرفیت کد تخفیف تمام شده است" };
  }

  if (userId && coupon.perUserLimit != null) {
    const userUsed = await Order.countDocuments({
      user: new mongoose.Types.ObjectId(userId),
      "coupon.code": couponCode.trim().toUpperCase(),
    });
    if (userUsed >= coupon.perUserLimit)
      return { valid: false, discount: 0, coupon: null, reason: "شما قبلاً از این کد استفاده کرده‌اید" };
  }

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

  if (coupon.applicableTo !== "all" && applicableTotal === 0)
    return { valid: false, discount: 0, coupon: null, reason: "این کد برای محصولات سبد شما قابل استفاده نیست" };

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
export async function computeCoachCredit(coachId, items) {
  if (!coachId || !items?.length) return 0;

  const now = new Date();
  const coachObjectId = new mongoose.Types.ObjectId(coachId.toString());

  const rules = await CoachCredit.find({
    active: true,
    $or: [{ scope: "all_coaches" }, { scope: "specific_coach", coach: coachObjectId }],
  })
    .sort({ priority: -1 })
    .lean();

  if (!rules.length) return 0;

  let totalCredit = 0;
  for (const item of items) {
    if (!item.lineTotalToman || item.lineTotalToman <= 0) continue;
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
// 6. تابع اصلی — محاسبه قیمت سبد خرید (با پشتیبانی از used products)
// ---------------------------------------------------------------------------

/**
 * @param {Object[]} cartItems  - [{ productId, variantId?, quantity } | { usedProductId, quantity, itemType:"used" }]
 * @param {Object|null} user
 * @param {string|null} couponCode
 */
export async function computeCartPrice(cartItems, user = null, couponCode = null) {
  await connectToDB();

  const rate = await getRate();

  const { default: Product     } = await import("base/models/Product");
  const { default: Variant      } = await import("base/models/Variant");
  const { default: UsedProduct  } = await import("base/models/UsedProduct");

  // تفکیک محصولات معمولی از دست‌دوم
  const regularItems = cartItems.filter((i) => i.itemType !== "used" && !i.usedProductId);
  const usedItems    = cartItems.filter((i) => i.itemType === "used" || i.usedProductId);

  // ─── بارگذاری محصولات معمولی ───
  const productIds = [...new Set(regularItems.map((i) => i.productId).filter(Boolean))];
  const variantIds = regularItems.filter((i) => i.variantId).map((i) => i.variantId);

  const [products, variants] = await Promise.all([
    productIds.length
      ? Product.find({ _id: { $in: productIds } })
          .populate("brand",    "_id")
          .populate("category", "_id")
          .populate("serie",    "_id")
          .lean()
      : [],
    variantIds.length ? Variant.find({ _id: { $in: variantIds } }).lean() : [],
  ]);

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));
  const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));

  // ─── بارگذاری محصولات دست‌دوم ───
  const usedProductIds = usedItems.map((i) => i.usedProductId).filter(Boolean);
  const usedProducts = usedProductIds.length
    ? await UsedProduct.find({ _id: { $in: usedProductIds } })
        .populate({
          path: "baseProduct",
          select: "name mainImage sku category brand",
          populate: [
            { path: "category", select: "_id title" },
            { path: "brand",    select: "_id title" },
          ],
        })
        .lean()
    : [];
  const usedProductMap = new Map(usedProducts.map((p) => [p._id.toString(), p]));

  // ─── محاسبه subtotal موقت برای cartValue rules ───
  let subtotalToman = 0;
  for (const ci of regularItems) {
    const p = productMap.get(ci.productId);
    if (!p) continue;
    const v = ci.variantId ? variantMap.get(ci.variantId) : null;
    subtotalToman += eurToToman(v?.price ?? p.basePrice ?? 0, rate) * (ci.quantity || 1);
  }
  for (const ci of usedItems) {
    const up = usedProductMap.get(ci.usedProductId);
    if (!up) continue;
    subtotalToman += eurToToman(up.price, rate) * (ci.quantity || 1);
  }

  const enrichedItems = [];
  let totalDiscount = 0;

  // ─── آیتم‌های معمولی ───
  for (const ci of regularItems) {
    const p = productMap.get(ci.productId);
    if (!p) continue;

    const v = ci.variantId ? variantMap.get(ci.variantId) : null;
    const qty = Math.max(1, ci.quantity || 1);
    const priceResult = await computeProductPrice(p, rate, user, subtotalToman);

    let unitFinalPrice = priceResult.finalPriceToman;
    let unitDiscount   = priceResult.discountAmount;
    if (v?.price != null) {
      const variantBase = eurToToman(v.price, rate);
      unitDiscount   = Math.min(Math.floor(variantBase * (priceResult.discountPercent / 100)), variantBase);
      unitFinalPrice = variantBase - unitDiscount;
    }

    totalDiscount += unitDiscount * qty;

    enrichedItems.push({
      itemType:      "product",
      productId:     p._id.toString(),
      variantId:     v?._id?.toString() ?? null,
      productName:   p.name,
      sku:           v?.sku ?? p.sku,
      mainImage:     p.mainImage,
      quantity:      qty,
      basePriceToman: eurToToman(v?.price ?? p.basePrice ?? 0, rate),
      unitFinalPrice,
      unitDiscount,
      lineTotalToman: unitFinalPrice * qty,
      appliedRules:  priceResult.appliedRules,
      categoryId:    (p.category?._id ?? p.category)?.toString() ?? null,
      brandId:       (p.brand?._id ?? p.brand)?.toString() ?? null,
      serieId:       (p.serie?._id ?? p.serie)?.toString() ?? null,
    });
  }

  // ─── آیتم‌های دست‌دوم (بدون تخفیف rule-based — قیمت ثابت) ───
  for (const ci of usedItems) {
    const up = usedProductMap.get(ci.usedProductId);
    if (!up) continue;

    // بررسی موجودی — محصول دست‌دوم باید available باشد
    if (up.status !== "available") {
      throw new Error(`محصول دست‌دوم "${up.name}" دیگر موجود نیست`);
    }

    const qty           = 1; // محصول دست‌دوم همیشه تعداد ۱ دارد
    const priceToman    = eurToToman(up.price, rate);

    enrichedItems.push({
      itemType:        "used_product",
      usedProductId:   up._id.toString(),
      productId:       up.baseProduct?._id?.toString() ?? null, // base product برای کوپن
      productName:     up.name,
      sku:             up.baseProduct?.sku ?? null,
      mainImage:       up.images?.[0] ?? up.baseProduct?.mainImage ?? null,
      overallScore:    up.overallScore,
      quantity:        qty,
      basePriceToman:  priceToman,
      unitFinalPrice:  priceToman,
      unitDiscount:    0,
      lineTotalToman:  priceToman,
      appliedRules:    [],
      categoryId:      (up.baseProduct?.category?._id ?? up.baseProduct?.category)?.toString() ?? null,
      brandId:         (up.baseProduct?.brand?._id    ?? up.baseProduct?.brand)?.toString()    ?? null,
      serieId:         null,
    });
  }

  const subtotalAfterRules = enrichedItems.reduce((s, i) => s + i.lineTotalToman, 0);

  // ─── اعمال کوپن ───
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
    items:               enrichedItems,
    subtotalToman:       enrichedItems.reduce((s, i) => s + i.basePriceToman * i.quantity, 0),
    discountToman:       totalDiscount,
    couponDiscountToman: couponDiscount,
    finalTotalToman,
    coupon:              appliedCoupon,
    couponError,
    rate,
  };
}