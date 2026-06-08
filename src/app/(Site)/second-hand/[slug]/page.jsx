import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import UsedProduct from "base/models/UsedProduct";
import HealthCard from "base/models/HealthCard";
import Product from "base/models/Product";
import Brand from "base/models/Brand";
import Category from "base/models/Category";
import UsedProductTemplate from "@/components/templates/secondHand/UsedProductTemplate";
import { notFound } from "next/navigation";
import { getCachedRate, eurToToman } from "@/lib/Exchangerate";

// اسلاگ‌های فارسی این مسیر قبلاً باعث خطای ۵۰۰ می‌شدند (باگ Next: کاراکترِ
// غیر-ASCII در هدر x-next-cache-tags → ERR_INVALID_CHAR). با پچِ
// patches/next+16.2.6.patch مسیر با encodeURI امن شد، پس ISR دوباره فعال است.
export const revalidate = 300;

// مسیرها on-demand ساخته می‌شوند؛ در زمان build هیچ‌کدام pre-render نمی‌شوند
export async function generateStaticParams() {
  return [];
}

// اسلاگ‌های فارسی در URL به صورت percent-encoded می‌آیند — قبل از کوئری دیکد می‌کنیم
function decodeSlug(slug) {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

// آدرس‌دهی با اسلاگ — برای رکوردهای قدیمی بدون اسلاگ، fallback به ObjectId
function buildLookup(rawSlug) {
  const slug = decodeSlug(rawSlug);
  return mongoose.Types.ObjectId.isValid(slug)
    ? { $or: [{ slug }, { _id: slug }] }
    : { slug };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  await connectToDB();
  const item = await UsedProduct.findOne(buildLookup(slug)).select("name").lean();
  return { title: item?.name || "محصول دست‌دوم" };
}

export default async function UsedProductPage({ params }) {
  const { slug } = await params;

  await connectToDB();

  const raw = await UsedProduct.findOne(buildLookup(slug))
    .populate({
      path: "baseProduct",
      populate: [
        { path: "brand", select: "title slug logo icon" },
        {
          path: "category",
          select: "title slug technicalStats attributes variantAttributes",
          populate: { path: "technicalStats" },
        },
      ],
    })
    .populate({
      path: "baseVariant",
      select: "sku price stock attributes images",
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

  // attributes توی Variant به صورت Map ذخیره می‌شه — باید به Object تبدیل بشه
  const variantAttributes = raw.baseVariant?.attributes
    ? Object.fromEntries(
        raw.baseVariant.attributes instanceof Map
          ? raw.baseVariant.attributes
          : Object.entries(raw.baseVariant.attributes)
      )
    : null;

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
    baseVariant: raw.baseVariant
      ? {
          _id:        raw.baseVariant._id.toString(),
          sku:        raw.baseVariant.sku,
          price:      raw.baseVariant.price,
          stock:      raw.baseVariant.stock,
          images:     raw.baseVariant.images || [],
          attributes: variantAttributes,
        }
      : null,
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