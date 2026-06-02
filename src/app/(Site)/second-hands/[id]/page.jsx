import connectToDB from "base/configs/db";
import UsedProduct from "base/models/UsedProduct";
import HealthCard from "base/models/HealthCard";
import Product from "base/models/Product";
import Brand from "base/models/Brand";
import Category from "base/models/Category";
import UsedProductTemplate from "@/components/templates/secondHand/UsedProductTemplate";
import { notFound } from "next/navigation";
import { getCachedRate, eurToToman } from "@/lib/Exchangerate";

export async function generateMetadata({ params }) {
  const { id } = await params;
  await connectToDB();
  const item = await UsedProduct.findById(id).select("name").lean();
  return { title: item?.name || "محصول دست‌دوم" };
}

export default async function UsedProductPage({ params }) {
  const { id } = await params;

  await connectToDB();

  const raw = await UsedProduct.findById(id)
    .populate({
      path: "baseProduct",
      populate: [
        { path: "brand",    select: "title slug logo icon" },
        {
          path: "category",
          select: "title slug technicalStats attributes variantAttributes",
          populate: { path: "technicalStats" },
        },
      ],
    })
    .lean();

  if (!raw || !raw.baseProduct) notFound();

  const rate = await getCachedRate();
  const priceInToman = eurToToman(raw.price, rate);

  const card = await HealthCard.findOne({
    category: raw.baseProduct.category?._id,
  }).lean();

  const cardFieldMap = Object.fromEntries(
    (card?.fields || []).map((f) => [f.key, f.label])
  );

  const mergedAttributes = (raw.baseProduct.category?.attributes || []).map((attr) => ({
    ...attr,
    value: raw.baseProduct.attributes?.[attr.name] ?? null,
  }));

  const product = {
    _id:          raw._id.toString(),
    name:         raw.name,
    price:        priceInToman,
    priceEur:     raw.price,
    description:  raw.description || "",
    images:       raw.images || [],
    status:       raw.status,
    overallScore: raw.overallScore,
    healthScores: (raw.healthScores || []).map((s) => ({
      key:    s.key,
      label:  cardFieldMap[s.key] || s.key,
      rating: s.rating,
      note:   s.note || "",
    })),
    customFields: (raw.customFields || []).map((f) => ({
      label:  f.label,
      rating: f.rating,
      note:   f.note || "",
    })),
    baseProduct: {
      _id:              raw.baseProduct._id.toString(),
      name:             raw.baseProduct.name,
      mainImage:        raw.baseProduct.mainImage,
      gallery:          raw.baseProduct.gallery || [],
      shortDescription: raw.baseProduct.shortDescription || "",
      longDescription:  raw.baseProduct.longDescription  || "",
      attributes:       mergedAttributes,
      technicalStats:   raw.baseProduct.technicalStats   || [],
      color:            raw.baseProduct.color,
      brand: raw.baseProduct.brand
        ? {
            _id:   raw.baseProduct.brand._id.toString(),
            title: raw.baseProduct.brand.title,
            slug:  raw.baseProduct.brand.slug,
            logo:  raw.baseProduct.brand.logo,
            icon:  raw.baseProduct.brand.icon,
          }
        : null,
      category: raw.baseProduct.category
        ? {
            _id:               raw.baseProduct.category._id.toString(),
            title:             raw.baseProduct.category.title,
            slug:              raw.baseProduct.category.slug,
            technicalStats:    raw.baseProduct.category.technicalStats    || [],
            variantAttributes: raw.baseProduct.category.variantAttributes || [],
          }
        : null,
    },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <UsedProductTemplate product={product} />
    </div>
  );
}