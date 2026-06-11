import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import SlugRegistery from "base/models/SlugRegistery";
import Brand from "base/models/Brand";
import Sport from "base/models/Sport";
import Athlete from "base/models/Athlete";
import Category from "base/models/Category";
import Variant from "base/models/Variant";
import { getCachedRate } from "@/lib/Exchangerate";
import { attachListingPrices } from "base/services/priceEngine";

const modelsMap = { Sport, Brand, Athlete, Category };

export const getProducts = unstable_cache(
  async () => {
    await connectToDB();
    const rate = await getCachedRate();
    const products = await Product.find({ isActive: true })
      .populate("brand")
      .populate("sport")
      .populate("athlete")
      .populate("category")
      .populate("variants")
      .lean();
    // قیمت‌ها سمت سرور و به‌صورت دسته‌ای محاسبه می‌شوند تا کارت‌ها دیگر هیچ
    // درخواست price-API نزنند (ریشه‌ی پر شدن کانکشن‌های دیتابیس)
    const priced = await attachListingPrices(products, rate);
    return JSON.parse(JSON.stringify(priced));
  },
  ["all-products"],
  { revalidate: 60, tags: ["products"] }
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
  { revalidate: 60, tags: ["products"] }
);

export const getProductBySlug = unstable_cache(
  async (slug) => {
    const decodedSlug = decodeURIComponent(slug);

    try {
      await connectToDB();

      const product = await Product.findOne({ slug: decodedSlug, isActive: true })
        .populate("brand")
        .populate("serie")
        .populate("collaboration")
        .populate("sport")
        .populate("athlete")
        .populate("category")
        .populate("variants")
        .lean();

      if (!product) {
        return { error: "محصول پیدا نشد یا غیرفعال است", status: 404 };
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
      return { error: err.message, status: 500 };
    }
  },
  ["product-by-slug"],
  { revalidate: 300, tags: ["products"] }
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

    const productQuery = { [slugData.filterField]: entityInfo._id, isActive: true };
    const rate = await getCachedRate();
    const products = await Product.find(productQuery)
      .populate("brand")
      .populate("sport")
      .populate("athlete")
      .populate("category")
      .populate("variants")
      .sort({ createdAt: -1 })
      .lean();

    const priced = await attachListingPrices(products, rate);

    return JSON.parse(
      JSON.stringify({
        type: slugData.type,
        info: entityInfo,
        products: priced,
        label: slugData.label,
        slugData,
      })
    );
  },
  ["page-data-by-slug"],
  { revalidate: 300, tags: ["products", "sports", "categories", "brands"] }
);
