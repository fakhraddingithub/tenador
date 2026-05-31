// services/enrichProductsWithDiscounts.js
// این فایل به صفحات listing (home، products list، sport page و ...) اضافه می‌شود
// تا محصولات همراه با قیمت تخفیف‌خورده (discountPrice) نمایش داده شوند.
//
// نحوه استفاده:
//   import { enrichProductsWithDiscounts } from "base/services/enrichProductsWithDiscounts";
//   const products = await getProducts();
//   const rate = await getCachedRate();
//   const enriched = await enrichProductsWithDiscounts(products, rate);
//   // حالا enriched[i].discountPrice و enriched[i].discountPercent دارد (یا null اگر تخفیف ندارد)

import connectToDB from "base/configs/db";
import DiscountRule from "base/models/DiscountRule";

/**
 * برای هر محصول از لیست، تخفیف فعال را محاسبه می‌کند و به آن اضافه می‌کند.
 *
 * @param {Object[]} products - آرایه محصولات (lean objects با فیلدهای _id, basePrice, category, brand, serie)
 * @param {number}   rate     - نرخ تبدیل یورو به تومان
 * @param {Object|null} user  - کاربر جاری ({ _id, role, level }) یا null
 * @returns {Promise<Object[]>} محصولات با فیلدهای جدید: discountPrice, discountPercent
 */
export async function enrichProductsWithDiscounts(products, rate, user = null) {
  if (!products?.length || !rate) return products;

  await connectToDB();

  const now = new Date();

  // دریافت تمام قوانین تخفیف فعال (یک بار برای همه محصولات)
  const rules = await DiscountRule.find({
    active: true,
    startAt: { $lte: now },
    endAt: { $gte: now },
  })
    .sort({ priority: 1 })
    .lean();

  if (!rules.length) return products;

  // ─── Helper: پیدا کردن بهترین تخفیف برای یک محصول ─────────────────────────
  function getBestDiscount(product, basePriceToman) {
    let bestDiscountToman = 0;
    let bestPercent = 0;

    for (const rule of rules) {
      // بررسی تطابق rule با محصول
      const matched = isRuleMatchedForProduct(rule, product, user);
      if (!matched) continue;

      // بررسی شرایط استفاده
      if (rule.usageLimit !== null && rule.usedCount >= rule.usageLimit) continue;

      // محاسبه مقدار تخفیف
      let discountToman = 0;
      if (rule.discount.kind === "percent") {
        discountToman = Math.round((basePriceToman * rule.discount.value) / 100);
        if (rule.discount.maxAmount) {
          discountToman = Math.min(discountToman, rule.discount.maxAmount);
        }
      } else {
        discountToman = rule.discount.value;
      }
      discountToman = Math.min(discountToman, basePriceToman);

      if (discountToman > bestDiscountToman) {
        bestDiscountToman = discountToman;
        bestPercent =
          rule.discount.kind === "percent"
            ? rule.discount.value
            : Math.round((discountToman / basePriceToman) * 100);
      }

      // اگر قابل ترکیب نیست، اولین match کافی است
      if (!rule.combinable) break;
    }

    return { discountToman: bestDiscountToman, discountPercent: bestPercent };
  }

  // ─── اعمال روی همه محصولات ─────────────────────────────────────────────────
  return products.map((product) => {
    const basePriceToman =
      Math.floor(Math.round((product.basePrice || 0) * rate) / 1000) * 1000;

    const { discountToman, discountPercent } = getBestDiscount(
      product,
      basePriceToman
    );

    if (discountToman <= 0) {
      return product; // بدون تخفیف
    }

    return {
      ...product,
      discountPrice: basePriceToman - discountToman,
      discountPercent,
    };
  });
}

// ─── Helper: آیا یک قانون برای این محصول اعمال می‌شود؟ ──────────────────────
function isRuleMatchedForProduct(rule, product, user) {
  const productId = String(product._id);
  const categoryId = String(product.category?._id || product.category || "");
  const brandId = String(product.brand?._id || product.brand || "");
  const serieId = String(product.serie?._id || product.serie || "");

  const targetStrs = (rule.targets || []).map((t) => String(t));

  switch (rule.type) {
    case "global":
      return true;

    case "product":
      return targetStrs.includes(productId);

    case "category":
      return targetStrs.includes(categoryId);

    case "brand":
      return targetStrs.includes(brandId);

    case "serie":
      return serieId && targetStrs.includes(serieId);

    case "variant":
      // برای listing کارت، variant-level discount روی قیمت پایه محصول اعمال نمی‌شود
      // (در صفحه محصول و QuickView با انتخاب واریانت اعمال می‌شود)
      return false;

    case "userRole":
      if (!user?.role) return false;
      return (rule.targetRoles || []).includes(user.role);

    case "userLevel":
      if (!user?.level) return false;
      return (rule.targetLevels || []).includes(user.level);

    case "cartValue":
      // در listing بدون اطلاعات cart، این نوع اعمال نمی‌شود
      return false;

    default:
      return false;
  }
}
