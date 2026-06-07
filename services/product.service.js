import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import SlugRegistery from "base/models/SlugRegistery";
import Brand from "base/models/Brand";
import Sport from "base/models/Sport";
import Athlete from "base/models/Athlete";
import Category from "base/models/Category";
import Variant from "base/models/Variant";

const modelsMap = { Sport, Brand, Athlete, Category };

export const getProducts = unstable_cache(
  async () => {
    await connectToDB();
    const products = await Product.find({ isActive: true })
      .populate("brand")
      .populate("sport")
      .populate("athlete")
      .populate("category")
      .populate("variants")
      .lean();
    return JSON.parse(JSON.stringify(products));
  },
  ["all-products"],
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
    const products = await Product.find(productQuery)
      .populate("brand")
      .populate("sport")
      .populate("athlete")
      .populate("category")
      .populate("variants")
      .sort({ createdAt: -1 })
      .lean();

    return JSON.parse(
      JSON.stringify({
        type: slugData.type,
        info: entityInfo,
        products,
        label: slugData.label,
        slugData,
      })
    );
  },
  ["page-data-by-slug"],
  { revalidate: 300, tags: ["products", "sports", "categories", "brands"] }
);
