/**
 * services/racketMatch.service.js
 *
 * کاتالوگِ آمادهٔ راکت‌های تنیس برای موتور تطبیق.
 *
 * دو لایهٔ جدا، عمداً:
 *
 *  ۱) «فهرستِ امتیازدهی» (getRacketCatalog) — سبک و کش‌شده. فقط مشخصاتِ فنیِ
 *     لازم برای نمره‌دادن. ابزارِ تطبیق با هر تغییرِ پاسخ دوباره صدا زده می‌شود؛
 *     اگر هر بار کلِ دسته از دیتابیس خوانده شود مصرفِ CPU روی Vercel بالا می‌رود.
 *
 *  ۲) «دادهٔ نمایشی» (loadDisplayProducts) — فقط برای همان سه محصولِ برنده، و
 *     دقیقاً با همان projection و populateهایی که بقیهٔ سایت برای کارت محصول و
 *     «نمایش سریع» استفاده می‌کند (LISTING_FIELDS/POPULATES). این تضمین می‌کند
 *     مودالِ نمایش سریع در نتایجِ تطبیق دقیقاً همان چیزی را ببیند که در صفحهٔ
 *     دسته‌بندی می‌بیند — نه یک نسخهٔ خلاصه‌شده.
 *
 * توضیح: فیلدهای سنگین (گالری، توضیحات، ویژگی‌ها) عمداً وارد لایهٔ کش‌شده
 * نمی‌شوند؛ ۲۹۱ محصول با آن فیلدها یک بلابِ چندصد کیلوبایتی می‌سازد که کشِ داده
 * را بی‌جهت پر می‌کند. سه سند خواندن با ایندکسِ _id ارزان‌تر است.
 */

import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Product from "base/models/Product";
import Category from "base/models/Category";
import Sport from "base/models/Sport";
import { attachListingPrices } from "base/services/priceEngine";
import { LISTING_FIELDS, POPULATES } from "base/services/productListing.service";
import { getCachedRate } from "@/lib/Exchangerate";
import { normalizeRacketSpecs } from "@/lib/racketMatch/normalize";

/** دستهٔ راکتِ ورزشِ تنیس — اسلاگِ دسته فقط درون ورزش یکتاست، پس هر دو لازم است */
const SPORT_SLUG = "tennis";
const CATEGORY_SLUG = "racket";

async function loadRacketCatalog() {
  await connectToDB();

  const sport = await Sport.findOne({ slug: SPORT_SLUG }).select("_id").lean();
  if (!sport) return null;

  const category = await Category.findOne({ sport: sport._id, slug: CATEGORY_SLUG })
    .select("_id title slug variantAttributes technicalStats")
    .lean();
  if (!category) return null;

  const products = await Product.find({ category: category._id, isActive: true })
    .select("name slug mainImage basePrice label attributes technicalStats brand serie category")
    .populate("brand", "title name icon")
    .populate("variants", "attributes price stock sku")
    .lean();

  const rate = await getCachedRate();
  const priced = await attachListingPrices(products, rate);

  return {
    categoryId: String(category._id),
    categoryTitle: category.title,
    variantAttributes: category.variantAttributes || [],
    rate: rate ?? null,
    products: priced.map((product) => ({
      _id: String(product._id),
      name: product.name,
      slug: product.slug,
      mainImage: product.mainImage,
      basePrice: product.basePrice,
      label: product.label,
      brand: product.brand ? { icon: product.brand.icon || null } : null,
      variants: (product.variants || []).map((variant) => ({
        _id: String(variant._id),
        attributes: variant.attributes || {},
        price: variant.price,
        stock: variant.stock,
        images: [],
      })),
      basePriceToman: product.basePriceToman ?? null,
      finalPriceToman: product.finalPriceToman ?? null,
      discountPercent: product.discountPercent ?? 0,
      hasQuantityDiscount: product.hasQuantityDiscount ?? false,
      specs: normalizeRacketSpecs(product),
    })),
  };
}

export const getRacketCatalog = unstable_cache(loadRacketCatalog, ["racket-match-catalog"], {
  revalidate: 300,
  tags: ["products", "categories", "exchange-rate"],
});

/**
 * دادهٔ نمایشیِ کاملِ چند محصول — همان مسیری که صفحهٔ دسته‌بندی و ویترین برند از
 * آن استفاده می‌کنند. هیچ projectionِ اختصاصی‌ای این‌جا تعریف نشده تا اگر روزی
 * LISTING_FIELDS عوض شود، «نمایش سریع» در ابزار تطبیق هم خودبه‌خود همراهش برود.
 *
 * @param {string[]} ids شناسهٔ محصولات (حداکثر چند تا — سه نتیجهٔ برنده)
 * @returns {Promise<Map<string, Object>>} نگاشتِ شناسه به محصولِ کامل و قیمت‌خورده
 */
export async function loadDisplayProducts(ids = []) {
  if (!ids.length) return new Map();

  await connectToDB();

  let query = Product.find({ _id: { $in: ids }, isActive: true }).select(LISTING_FIELDS);
  for (const populate of POPULATES) query = query.populate(populate);

  const [products, rate] = await Promise.all([query.lean(), getCachedRate()]);
  const priced = await attachListingPrices(products, rate);

  // ترتیبِ بازگشتیِ $in تضمین‌شده نیست، پس با نگاشت به فراخوان برمی‌گردانیم
  return new Map(priced.map((product) => [String(product._id), product]));
}
