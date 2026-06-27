import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import Product from "base/models/Product";
import Variant from "base/models/Variant";
import UsedProduct from "base/models/UsedProduct";
import {
  getRate,
  computeProductPrice,
  buildFlowAddonResolver,
  loadQuantityDiscountMap,
  quantityTierFor,
  quantityDiscountPerUnit,
} from "base/services/priceEngine";
import { eurToToman } from "@/lib/Exchangerate";
import { calculateDiscount } from "base/utils/discountCalculator";
import { variantAttributeImages, variantAttributeUnits } from "@/lib/variantImages";

async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

export async function POST(request) {
  try {
    await connectToDB();
    
    const { items } = await request.json();
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "آیتم‌های سبد خرید معتبر نیست" },
        { status: 400 },
      );
    }
    
    const user = await getUserFromToken();
    const rate = await getRate();
    
    // ۱. تفکیک آی‌دی‌ها
    const productIds = items
      .filter((i) => i.itemType === "product" && i.productId)
      .map((i) => i.productId);

    const variantIds = items
      .filter((i) => i.itemType === "product" && i.variantId)
      .map((i) => i.variantId);

    const usedProductIds = items
      .filter((i) => i.itemType === "used_product" && i.usedProductId)
      .map((i) => i.usedProductId);

    // ۲. دریافت اطلاعات از دیتابیس به صورت موازی
    const [products, variants, usedProducts] = await Promise.all([
      productIds.length
        ? Product.find({ _id: { $in: productIds } })
            .populate("brand", "_id name")
            .populate("category", "_id name")
            .populate("serie", "_id name")
            .lean()
        : Promise.resolve([]),
      variantIds.length
        ? Variant.find({ _id: { $in: variantIds } }).lean()
        : Promise.resolve([]),
      usedProductIds.length
        ? UsedProduct.find({ _id: { $in: usedProductIds } })
            .populate({
              path: "baseProduct",
              populate: [
                { path: "brand", select: "_id name" },
                { path: "category", select: "_id name" },
                { path: "serie", select: "_id name" }
              ]
            })
            .lean()
        : Promise.resolve([]),
    ]);

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));
    const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));
    const usedProductMap = new Map(usedProducts.map((up) => [up._id.toString(), up]));

    // تخفیف‌های تعدادی فعال (یک‌بار batch)
    // ⚠️ باید آبجکت‌های محصول پاس داده شوند (نه فقط idها)؛ این تابع برای تطبیقِ
    // برند/دسته/سری به p.brand/p.category/p.serie نیاز دارد و در غیر این صورت
    // روی p._id کرش می‌کند و کل سبد را خالی نشان می‌دهد.
    const quantityDiscountMap = await loadQuantityDiscountMap(products);

    // ───── فرایند سفارش: resolver افزوده‌ی قیمت (واکشی batch محصولات/واریانت/فرایندها) ─────
    const resolveFlowAddon = await buildFlowAddonResolver(items, productMap, rate);

    // ۳. محاسبه اولیه subtotal تومان (شامل افزوده‌ی فرایند برای آستانه‌ی تخفیف)
    let subtotalToman = 0;
    for (const ci of items) {
      if (ci.itemType === "used_product") {
        const up = usedProductMap.get(ci.usedProductId);
        if (!up) continue;
        subtotalToman += eurToToman(up.price || 0, rate) * (ci.quantity || 1);
      } else {
        const p = productMap.get(ci.productId);
        if (!p) continue;
        const v = ci.variantId ? variantMap.get(ci.variantId) : null;
        // قیمت ۰ یا خالی واریانت → قیمت پایه محصول (پشتیبانی از داده‌های قدیمی)
        const eurPrice = v?.price || p.basePrice || 0;
        const { addonToman } = resolveFlowAddon(ci);
        subtotalToman += (eurToToman(eurPrice, rate) + addonToman) * (ci.quantity || 1);
      }
    }

    let grandTotalToman = 0;
    let grandDiscountToman = 0;

    // ۴. غنی‌سازی نهایی داده‌های سبد خرید
    const enrichedItems = await Promise.all(
      items.map(async (ci) => {
        let p = null;
        let v = null;
        let up = null;
        let eurPrice = 0;

        if (ci.itemType === "used_product") {
          up = usedProductMap.get(ci.usedProductId);
          if (!up) return null;
          p = up.baseProduct; 
          eurPrice = up.price || 0;
        } else {
          p = productMap.get(ci.productId);
          if (!p) return null;
          v = ci.variantId ? variantMap.get(ci.variantId) : null;
          // قیمت ۰ یا خالی واریانت → قیمت پایه محصول (پشتیبانی از داده‌های قدیمی)
          eurPrice = v?.price || p.basePrice || 0;
        }

        const qty = Math.max(1, Math.floor(ci.quantity || 1));
        const basePriceToman = eurToToman(eurPrice, rate);

        let unitFinalPrice = basePriceToman;
        let unitDiscount = 0;
        let appliedRules = [];

        // افزوده‌ی فرایند سفارش (خدمات + محصولات انتخاب‌شده) — معتبرسازی‌شده در سرور
        const { addonToman: flowAddonToman, enriched: flowSelectionsEnriched } =
          ci.itemType !== "used_product"
            ? resolveFlowAddon(ci)
            : { addonToman: 0, enriched: [] };

        if (ci.itemType !== "used_product" && p) {
          const priceResult = await computeProductPrice(p, rate, user, subtotalToman);
          unitFinalPrice = priceResult.finalPriceToman;
          unitDiscount = priceResult.discountAmount;
          appliedRules = priceResult.appliedRules;

          if (v?.price) {
            const variantBase = eurToToman(v.price, rate);
            const productDiscount = Math.floor(variantBase * (priceResult.discountPercent / 100));

            const { discountAmount: variantDiscount } = await calculateDiscount({
              product: {
                _id: p._id,
                category: p.category?._id ?? p.category,
                brand: p.brand?._id ?? p.brand,
                serie: p.serie?._id ?? p.serie ?? null,
                variantId: v._id,
                basePrice: eurPrice,
              },
              user,
              cartTotal: subtotalToman,
            });

            unitDiscount = Math.min(
              Math.max(productDiscount, eurToToman(variantDiscount, rate)),
              variantBase,
            );
            unitFinalPrice = variantBase - unitDiscount;
          }

          // تخفیف تعدادی — روی قیمت واحدِ پس از سایر تخفیف‌ها (قبل از افزوده‌ی فرایند)
          const qd = quantityDiscountMap.get(ci.productId);
          const tier = quantityTierFor(qd, qty);
          const qtyDiscountPerUnit = quantityDiscountPerUnit(tier, unitFinalPrice);
          if (qtyDiscountPerUnit > 0) {
            unitFinalPrice -= qtyDiscountPerUnit;
            unitDiscount += qtyDiscountPerUnit;
            appliedRules = [
              ...appliedRules,
              {
                id: qd._id.toString(),
                type: "quantity",
                title: qd.title || `تخفیف تعدادی (${tier.minQty}+ عدد)`,
              },
            ];
          }
        }

        // افزوده‌ی فرایند روی قیمت واحدِ نهایی اعمال می‌شود (مشمول تخفیف نمی‌شود)
        unitFinalPrice += flowAddonToman;

        const lineTotalToman = unitFinalPrice * qty;
        const lineDiscountToman = unitDiscount * qty;

        grandTotalToman += lineTotalToman;
        grandDiscountToman += lineDiscountToman;

        let inStock = false;

        if (ci.itemType === "used_product" && up) {
          // کالای دست‌دوم تک‌نسخه است و فقط در صورت available بودن قابل سفارش است
          inStock = up.status === "available";
        } else if (p) {
          // محصولات نو همیشه قابل سفارش هستند (مفهوم موجودی حذف شده)
          inStock = true;
        }

        return {
          productId: p?._id?.toString() ?? null,
          variantId: v?._id?.toString() ?? null,
          usedProductId: up?._id?.toString() ?? null,
          itemType: ci.itemType,
          quantity: qty,

          // اصلاح نام و تصویر محصول بر اساس دست‌دوم یا نو بودن کالا
          product: p ? {
            _id: p._id.toString(),
            name: up ? up.name : p.name, // اگر دست‌دوم بود نام خود دست‌دوم، در غیر این صورت نام اصلی
            // برای دست‌دوم اولین تصویر گالری خودش نمایش داده می‌شود نه تصویر محصول پایه
            mainImage: up ? (up.images?.[0] || p.mainImage) : p.mainImage,
            sku: p.sku,
            brand: p.brand?.name ?? null,
          } : null,

          variant: v ? {
            _id: v._id,
            sku: v.sku,
            attributes: v.attributes instanceof Map ? Object.fromEntries(v.attributes) : v.attributes || {},
            images: v.images || [],
            // تصویرِ نماینده‌ی هر ویژگیِ تصویری (برای نمایش thumbnail در سبد) — Change 4
            attributeImages: variantAttributeImages(v, p),
            // مقادیرِ واحدهای هر ویژگیِ چندواحدی (برای نمایش در سبد/سفارش) — Change 3
            attributeUnits: variantAttributeUnits(v, p),
          } : null,

          usedProduct: up ? {
            _id: up._id,
            name: up.name,
            overallScore: up.overallScore,
            healthScores: up.healthScores,
            images: up.images || [],
            status: up.status,
          } : null,

          inStock,

          basePriceToman,
          unitPriceToman: unitFinalPrice,
          discountToman: unitDiscount,
          itemFinalToman: lineTotalToman,
          appliedRules,
          hasDiscount: unitDiscount > 0,

          // فرایند سفارش
          flowSelections: flowSelectionsEnriched,
          flowAddonToman,
        };
      }),
    );

    const validItems = enrichedItems.filter(Boolean);

    return NextResponse.json({
      items: validItems,
      grandTotalToman, 
      grandDiscountToman,
      rate,
    });
  } catch (error) {
    console.error("خطا در دریافت محصولات سبد خرید:", error);
    return NextResponse.json(
      { error: "خطا در دریافت اطلاعات قیمت" },
      { status: 500 },
    );
  }
}