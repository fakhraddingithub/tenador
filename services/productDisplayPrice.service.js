import "base/models/registerModels";
import connectToDB from "base/configs/db";
import { computeProductPrice, loadQuantityDiscountMap } from "base/services/priceEngine";
import { eurToToman } from "@/lib/currency";

// Shared by SSR and the price API. Product variants must already be populated.
// Never cache personalized prices across requests.
export async function getProductDisplayPrice(product, rate, user = null) {
  if (!Number.isFinite(Number(rate)) || Number(rate) <= 0) throw new Error("نرخ ارز در دسترس نیست");
  await connectToDB();
  // قیمت پایه محصول
  const [priceResult, qdMap] = await Promise.all([
    computeProductPrice(product, rate, user),
    loadQuantityDiscountMap([product]),
  ]);

  // قیمت واریانت‌ها
  let variants = [];
  if (product.variants?.length) {
    const rawVariants = product.variants;
    variants = rawVariants.map((v) => {
      // قیمت ۰ یا خالی واریانت → قیمت پایه محصول (پشتیبانی از داده‌های قدیمی)
      const variantBaseToman = eurToToman(v.price || product.basePrice || 0, rate);
      const unitDiscount = Math.min(
        Math.floor(variantBaseToman * (priceResult.discountPercent / 100)),
        variantBaseToman
      );
      return {
        _id:            v._id,
        sku:            v.sku,
        attributes:     v.attributes || [],
        basePriceToman: variantBaseToman,
        finalPriceToman: variantBaseToman - unitDiscount,
        discountAmount:  unitDiscount,
        discountPercent: priceResult.discountPercent,
      };
    });
  }

  // تخفیف تعدادی فعال (برای نمایش پله‌ها در صفحه محصول/مودال)
  // ⚠️ آبجکت محصول پاس داده می‌شود (نه id)؛ تابع به brand/category/serie نیاز دارد
  const qd = qdMap.get(product._id.toString());
  const quantityDiscount = qd
    ? {
        title: qd.title || "",
        tiers: [...qd.tiers]
          .sort((a, b) => a.minQty - b.minQty)
          .map((t) => ({
            minQty: t.minQty,
            kind: t.discount.kind,
            value: t.discount.value,
          })),
      }
    : null;

  return {
    productId:      product._id,
    basePriceToman: priceResult.basePriceToman,
    finalPriceToman: priceResult.finalPriceToman,
    discountAmount:  priceResult.discountAmount,
    discountPercent: priceResult.discountPercent,
    appliedRules:    priceResult.appliedRules,
    quantityDiscount,
    variants,
    rate,
  };
}
