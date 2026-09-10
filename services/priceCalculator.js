// services/priceCalculator.js
import { discountWindowFilter } from "base/utils/discountWindow";
import { computeBaseDiscountForProduct } from "./discountEngine.js";
import Coupon from "base/models/Coupon";

export async function calculateFinalPrice(product, opts = {}) {
  const { quantity = 1, couponCode = null, cartValue = 0, user = null } = opts;
  const base = (product.basePrice || 0) * quantity;

  // base discount (precompute logic) - returns best base discount ignoring coupon/cart rules
  const baseResult = await computeBaseDiscountForProduct(product);
  let totalDiscount = baseResult.bestDiscount * (quantity || 1);
  // baseResult.applied ممکن است شامل flash sale یا rule باشد
  const applied = baseResult.applied.map(item => {
    if (typeof item === 'object' && item.type) {
      return item; // اگر قبلاً type دارد (مثل flash sale)
    }
    return { id: item, type: "rule" }; // اگر فقط ID است
  });

  // coupon logic
  if (couponCode) {
    const now = new Date();
    const coupon = await Coupon.findOne({
      code: couponCode,
      active: true,
      ...discountWindowFilter(now),
    }).lean();

    if (coupon) {
      // check cart min
      if ((coupon.minCartValue || 0) <= cartValue) {
        // بررسی اینکه آیا کوپن برای این محصول قابل استفاده است
        let isApplicable = true;
        if (coupon.applicableTo !== "all") {
          if (coupon.applicableTo === "product" && (!coupon.targets || !coupon.targets.includes(product._id.toString()))) {
            isApplicable = false;
          } else if (coupon.applicableTo === "brand" && (!coupon.targets || !coupon.targets.includes(product.brand?.toString()))) {
            isApplicable = false;
          } else if (coupon.applicableTo === "category" && (!coupon.targets || !coupon.targets.includes(product.category?.toString()))) {
            isApplicable = false;
          }
        }
        
        if (isApplicable) {
          const cAmount = coupon.discount.kind === "percent"
            ? Math.floor(base * (coupon.discount.value / 100))
            : coupon.discount.value * quantity;
          totalDiscount += cAmount;
          applied.push({ id: coupon._id, type: "coupon" });
        }
      }
    }
  }

  if (totalDiscount > base) totalDiscount = base;
  const finalPrice = base - totalDiscount;
  return { base, discount: totalDiscount, finalPrice, applied };
}
