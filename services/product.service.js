import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import SlugRegistery from "base/models/SlugRegistery";
import Brand from "base/models/Brand";
import Sport from "base/models/Sport";
import Athlete from "base/models/Athlete";
import Category from "base/models/Category";
import Variant from "base/models/Variant";
import SiteSetting from "base/models/SiteSetting";
import { getCachedRate } from "@/lib/Exchangerate";
import { attachListingPrices } from "base/services/priceEngine";
import { getProductListingPage } from "base/services/productListing.service";

const modelsMap = { Sport, Brand, Athlete, Category };

/**
 * کلیدهای SiteSetting برای اسلایدرهای محصولِ صفحه‌ی اصلی.
 * هر اسلایدر فهرستِ مرتبِ مستقلی از شناسه‌ی محصولات را نگه می‌دارد.
 */
export const HOME_SLIDER_KEYS = {
  bestsellers: "home_slider_bestsellers",
  offers: "home_slider_amazing_offers",
};

export const getProducts = unstable_cache(
  async () => {
    return getProductListingPage();
  },
  ["all-products"],
  { revalidate: 10800, tags: ["products"] }
);

/**
 * داده‌ی صفحه‌ی اصلی — فقط ۱۰ محصول برای هر اسلایدر (پرفروش‌ها و پیشنهادهای شگفت‌انگیز)
 * به‌جای واکشی کل محصولات. قیمت‌ها از قبل محاسبه و چسبانده شده‌اند.
 */
export const getHomeProducts = unstable_cache(
  async () => {
    await connectToDB();
    const rate = await getCachedRate();

    // فقط ۲۰ محصول اخیر را می‌گیریم و از همان‌ها دو لیست ۱۰‌تایی می‌سازیم
    const products = await Product.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("brand")
      .populate("category")
      .populate("variants")
      .lean();

    const priced = await attachListingPrices(products, rate);

    const bestSellers = priced.slice(0, 10);
    const discounted = priced.filter((p) => p.discountPercent > 0);
    const offers = (discounted.length ? discounted : priced).slice(0, 10);

    return JSON.parse(JSON.stringify({ bestSellers, offers }));
  },
  ["home-products"],
  { revalidate: 10800, tags: ["products"] }
);

/**
 * فهرستِ مرتب و قیمت‌خورده‌ی محصولات یک اسلایدر را از روی آرایه‌ی شناسه‌ها می‌سازد.
 * فقط محصولاتِ فعال برگردانده می‌شوند و ترتیبِ ذخیره‌شده دقیقاً حفظ می‌شود.
 * اگر هیچ شناسه‌ای پیکربندی نشده باشد، null برمی‌گرداند تا فراخواننده به منطقِ
 * پیش‌فرض برگردد (بدون رگرسیون پیش از پیکربندی توسط ادمین).
 */
async function buildSliderList(ids, rate) {
  if (!Array.isArray(ids) || ids.length === 0) return null;

  const products = await Product.find({ _id: { $in: ids }, isActive: true })
    .populate("brand")
    .populate("category")
    .populate("variants")
    .lean();

  // مرتب‌سازی بر اساس ترتیبِ ذخیره‌شده + حذفِ محصولاتِ غیرفعال/حذف‌شده
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const ordered = ids.map((id) => byId.get(String(id))).filter(Boolean);
  if (ordered.length === 0) return null;

  return attachListingPrices(ordered, rate);
}

/**
 * منبعِ داده‌ی اسلایدرهای صفحه‌ی اصلی (پرفروش‌ها و پیشنهادهای شگفت‌انگیز).
 * محصولات از روی پیکربندیِ ادمین (SiteSetting) و با ترتیبِ دقیقِ تعیین‌شده خوانده
 * می‌شوند. اگر یک اسلایدر هنوز پیکربندی نشده باشد، به رفتارِ خودکارِ قبلی برمی‌گردد.
 */
export const getHomeSliderProducts = unstable_cache(
  async () => {
    await connectToDB();
    const rate = await getCachedRate();

    const [bestSetting, offersSetting] = await Promise.all([
      SiteSetting.findOne({ key: HOME_SLIDER_KEYS.bestsellers }).lean(),
      SiteSetting.findOne({ key: HOME_SLIDER_KEYS.offers }).lean(),
    ]);

    const bestIds = Array.isArray(bestSetting?.value) ? bestSetting.value : [];
    const offerIds = Array.isArray(offersSetting?.value) ? offersSetting.value : [];

    let [bestSellers, offers] = await Promise.all([
      buildSliderList(bestIds, rate),
      buildSliderList(offerIds, rate),
    ]);

    // ── منطقِ پیش‌فرض برای اسلایدرهای پیکربندی‌نشده (همان رفتارِ getHomeProducts) ──
    if (!bestSellers || !offers) {
      const recent = await Product.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("brand")
        .populate("category")
        .populate("variants")
        .lean();
      const pricedFallback = await attachListingPrices(recent, rate);

      if (!bestSellers) bestSellers = pricedFallback.slice(0, 10);
      if (!offers) {
        const discounted = pricedFallback.filter((p) => p.discountPercent > 0);
        offers = (discounted.length ? discounted : pricedFallback).slice(0, 10);
      }
    }

    return JSON.parse(JSON.stringify({ bestSellers, offers }));
  },
  ["home-slider-products"],
  { revalidate: 10800, tags: ["products", "home-sliders"] }
);

export const getProductBySlug = unstable_cache(
  async (slug) => {
    const decodedSlug = decodeURIComponent(slug);

    try {
      await connectToDB();

      const product = await Product.findOne({ slug: decodedSlug, isActive: true })
        .populate("brand")
        .populate("serie")
        .populate("limitedEdition")
        .populate("sport")
        .populate("athlete")
        .populate("category")
        .populate("variants")
        .lean();

      if (!product) {
        return { error: "محصول پیدا نشد یا غیرفعال است", status: 404 };
      }

      // category در اسکیمای Product برابر required:true است؛ پس null بودنِ آن
      // یعنی رفرنسِ شکسته (خرابیِ داده)، نه یک حالتِ پشتیبانی‌شده. با throw این
      // حالت کش نمی‌شود و به‌جای TypeErrorِ مبهم، خطای کددارِ قابلِ پایش می‌دهد.
      if (!product.category) {
        const err = new Error(
          `Product ${product.slug} has a dangling category reference`
        );
        err.code = "PRODUCT_CATEGORY_MISSING";
        throw err;
      }

      const mergedAttributes = product.category.attributes.map((attr) => ({
        ...attr,
        value: product.attributes?.[attr.name] ?? null,
      }));

      return JSON.parse(
        JSON.stringify({
          ...product,
          attributes: mergedAttributes,
        })
      );
    } catch (err) {
      // خطا را برنگردان — unstable_cache هر مقدارِ بازگشتی را کش می‌کند، پس یک
      // قطعیِ لحظه‌ایِ دیتابیس تا ۳ ساعت به‌صورتِ «محصول پیدا نشد» تکرار می‌شد
      // (page.jsx خروجیِ error را به notFound تبدیل می‌کند). با throw هیچ چیزی
      // کش نمی‌شود و درخواستِ بعدی دوباره تلاش می‌کند.
      // نکته: return با status:404 در بالا یک نتیجه‌ی معتبر است و کش می‌ماند.
      throw err;
    }
  },
  ["product-by-slug"],
  { revalidate: 10800, tags: ["products"] }
);

/**
 * فهرست ویژگی‌هایی که ادمین در هر دسته‌بندی «قابل فیلتر» علامت زده — یک‌بار از
 * روی همه‌ی دسته‌ها جمع و بر اساس name یکتا می‌شود. صفحه‌ی محصولات از این لیست
 * برای رندر کردن اینپوت‌های فیلتر متنی استفاده می‌کند (ماچینگ همان منطق
 * مشترکِ attributeFilters است — کلاینت‌ساید و substring).
 */
export const getFilterableAttributes = unstable_cache(
  async () => {
    await connectToDB();
    const categories = await Category.find({ "attributes.filterable": true })
      .select("attributes")
      .lean();

    const map = new Map();
    for (const cat of categories) {
      for (const attr of cat.attributes || []) {
        if (attr?.filterable && attr.name && !map.has(attr.name)) {
          // filterable:true را همراه می‌بریم تا buildAttributeMeta (که فقط ویژگی‌های
          // قابل فیلتر را می‌پذیرد) این لیستِ ازقبل‌فیلترشده را هم رد نکند.
          map.set(attr.name, {
            name: attr.name,
            label: attr.label || attr.name,
            filterable: true,
          });
        }
      }
    }
    return Array.from(map.values());
  },
  ["filterable-attributes"],
  { revalidate: 10800, tags: ["categories"] }
);

export const getPageDataBySlug = unstable_cache(
  async (slug) => {
    await connectToDB();

    const slugData = await SlugRegistery.findOne({ slug: slug.toLowerCase() }).lean();
    if (!slugData) return null;

    const EntityModel = modelsMap[slugData.model];
    if (!EntityModel) {
      console.error(`مدل ${slugData.model} در نقشه مدل‌ها تعریف نشده است.`);
      return null;
    }

    const entityInfo = await EntityModel.findOne({ slug }).lean();
    if (!entityInfo) return null;

    const articleBlocks =
      slugData.type === "brand" && Array.isArray(entityInfo.articleBlocks)
        ? entityInfo.articleBlocks
        : [];

    // Product listing and block references are independent once the brand is
    // known. Resolve them in parallel, then cache the combined page payload so
    // the public render never needs a second request or a client-side fetch.
    const [listing, articleEntities] = await Promise.all([
      getProductListingPage({
        filter: { [slugData.filterField]: entityInfo._id },
      }),
      articleBlocks.length > 0
        ? import("base/services/publicArticle.service").then(
            ({ resolveArticleEntities }) =>
              resolveArticleEntities({ blocks: articleBlocks }),
          )
        : Promise.resolve(null),
    ]);

    const publicEntityInfo = { ...entityInfo };
    delete publicEntityInfo.articleBlocks;

    return JSON.parse(
      JSON.stringify({
        type: slugData.type,
        info: publicEntityInfo,
        products: listing.products,
        totalResults: listing.totalResults,
        label: slugData.label,
        slugData,
        miniArticle: articleBlocks.length > 0
          ? { blocks: articleBlocks, entities: articleEntities }
          : null,
      })
    );
  },
  ["page-data-by-slug"],
  {
    revalidate: 10800,
    tags: ["products", "sports", "categories", "brands", "series", "articles"],
  }
);
