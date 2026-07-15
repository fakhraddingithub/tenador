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

// ⚠️ اسلاگ‌های فارسی با هدر x-next-cache-tags ناسازگارند (باگ Next: کاراکتر
// غیر-ASCII در هدر → ERR_INVALID_CHAR → خطای ۵۰۰). داینامیک رندر می‌شود تا هدر
// کش روت ساخته نشود؛ کوئری‌ها همچنان با unstable_cache کش می‌مانند.
export const dynamic = "force-dynamic";

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

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");

// نام پارامتر [sportSlug] است چون Next.js اجازه‌ی دو نامِ متفاوت برای یک سطحِ
// داینامیک را نمی‌دهد (این مسیر با second-hand/[sportSlug]/[categorySlug] هم‌سطح
// است)؛ مقدارِ واقعیِ آن اسلاگِ محصولِ دست‌دوم است.
export async function generateMetadata({ params }) {
  const { sportSlug: slug } = await params;
  await connectToDB();
  const item = await UsedProduct.findOne(buildLookup(slug))
    .select("name images")
    .populate({ path: "baseProduct", select: "mainImage" })
    .lean();

  const name = item?.name || "محصول دست‌دوم";
  const description = `خرید ${name} دست‌دوم با ضمانت اصالت و ارسال سریع از تنادور`;
  const rawImage = item?.images?.[0] || item?.baseProduct?.mainImage || null;
  const imageUrl = rawImage
    ? rawImage.startsWith("http") ? rawImage : `${SITE_URL}${rawImage}`
    : null;

  return {
    title: name,
    description,
    metadataBase: new URL(SITE_URL),
    openGraph: {
      title: name,
      description,
      siteName: "تنادور",
      locale: "fa_IR",
      type: "website",
      ...(imageUrl && {
        images: [{ url: imageUrl, width: 1200, height: 630, alt: name }],
      }),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title: name,
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
  };
}

export default async function UsedProductPage({ params }) {
  const { sportSlug: slug } = await params;

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
      select: "sku price attributes images",
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

  // ترتیب فیلدها در کارت سلامت تعیین‌کننده‌ی ترتیب نمایش در صفحه‌ی محصول است
  const cardFieldOrder = new Map(
    (card?.fields || []).map((f, i) => [f.key, i])
  );
  const orderOf = (key) =>
    cardFieldOrder.has(key) ? cardFieldOrder.get(key) : Infinity;

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
    tested:       !!raw.tested,
    overallScore: raw.overallScore,
    healthScores: (raw.healthScores || [])
      .map((s) => ({
        key:    s.key,
        label:  cardFieldMap[s.key] || s.key,
        rating: s.rating,
        note:   s.note || "",
      }))
      .sort((a, b) => orderOf(a.key) - orderOf(b.key)),
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