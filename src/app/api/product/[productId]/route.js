// app/api/product/[productId]/route.js
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import Brand from "base/models/Brand";
import Sport from "base/models/Sport";
import Athlete from "base/models/Athlete";
import Category from "base/models/Category";
import Variant from "base/models/Variant";
import PriceCache from "base/models/PriceCache";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ----------------------------------
   Cloudinary helpers
---------------------------------- */
function extractPublicId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const pathname = u.pathname;
    const uploadIndex = pathname.indexOf("/upload/");
    if (uploadIndex === -1) return null;
    let publicPath = pathname.slice(uploadIndex + 8);
    publicPath = publicPath.replace(/^v\d+\//, "");
    publicPath = publicPath.replace(/\.[^/.]+$/, "");
    return publicPath;
  } catch {
    return null;
  }
}

async function renameCloudinaryImage(imageUrl, sku, index = null) {
  if (!imageUrl) return null;
  if (imageUrl.includes(sku)) return imageUrl;

  const oldPublicId = extractPublicId(imageUrl);
  if (!oldPublicId) return imageUrl;

  const folder = oldPublicId.split("/").slice(0, -1).join("/");
  try {
    const newPublicId =
      index !== null ? `${folder}/${sku}-${index}` : `${folder}/${sku}`;
    const result = await cloudinary.uploader.rename(oldPublicId, newPublicId, {
      overwrite: true,
    });
    return result.secure_url;
  } catch (error) {
    console.warn(`⚠️ Cloudinary Rename skipped for ${imageUrl}:`, error.message);
    return imageUrl;
  }
}

/* ----------------------------------
   Cartesian product — identical to POST logic
---------------------------------- */
function generateCombinations(options) {
  const keys = Object.keys(options).filter(
    (k) => Array.isArray(options[k]) && options[k].length > 0
  );
  if (keys.length === 0) return [];

  const result = [];
  function helper(index, currentCombo) {
    if (index === keys.length) {
      result.push({ ...currentCombo });
      return;
    }
    const key = keys[index];
    for (const val of options[key]) {
      helper(index + 1, { ...currentCombo, [key]: val });
    }
  }
  helper(0, {});
  return result;
}

/* ----------------------------------
   GET
---------------------------------- */
import { getCachedRate, eurToToman } from "@/lib/Exchangerate"; // آدرس فایل اکسچنج را چک کنید

export async function GET(req, { params }) {
  try {
    await connectToDB();
    const resolvedParams = await params;
    const productId = resolvedParams.productId || resolvedParams.id;

    const product = await Product.findById(productId)
      .populate("brand")
      .populate("sport")
      .populate("athlete")
      .populate("category")
      .populate("serie")
      .populate("variants")
      .lean();

    if (!product) {
      return NextResponse.json({ error: "محصول پیدا نشد" }, { status: 404 });
    }

    // ۱. دریافت نرخ ارز کش شده
    const rate = await getCachedRate();

    // ۲. تبدیل قیمت پایه محصول به تومان
    const basePriceInToman = eurToToman(product.basePrice, rate);

    // ۳. دریافت قیمت نهایی از PriceCache و تبدیل آن
    const priceDoc = await PriceCache.findOne({ productId }).lean();
    
    // اگر داکیوومنت قیمت وجود داشت تبدیل شود، در غیر این صورت قیمت پایه محصول استفاده شود
    const finalPriceInEur = priceDoc ? priceDoc.finalPrice : product.basePrice;
    
    const price = {
      finalPrice: eurToToman(finalPriceInEur, rate),
      bestDiscount: priceDoc?.bestDiscount || 0,
      basePrice: basePriceInToman, // اضافه کردن قیمت پایه برای نمایش قیمت خط خورده در کلاینت
    };

    // ۴. تبدیل قیمت واریانت‌ها (اگر واریانت دارید)
    const convertedVariants = product.variants?.map(v => ({
      ...v,
      price: eurToToman(v.price, rate)
    })) || [];

    // آماده‌سازی آبجکت محصول نهایی
    const finalProduct = {
      ...product,
      basePrice: basePriceInToman,
      variants: convertedVariants,
      tag: product.tag || [],
      gallery: product.gallery || [],
      attributes: product.attributes || {},
      technicalStats: product.technicalStats || {},
    };

    return NextResponse.json({ product: finalProduct, price });
  } catch (err) {
    console.log(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/* ----------------------------------
   PUT — Edit Product + Variants
---------------------------------- */
export async function PUT(req, { params }) {
  try {
    await connectToDB();

    const resolvedParams = await params;
    const productId = resolvedParams.productId || resolvedParams.id;
    const body = await req.json();

    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json({ error: "محصول پیدا نشد" }, { status: 404 });
    }

    const {
      name,
      shortDescription,
      longDescription,
      color,
      basePrice,
      category,
      tag,
      mainImage,
      gallery,
      brand,
      serie,
      athlete,   // now expected as an array of IDs
      sport,
      attributes,
      technicalStats,
      label,
      variantOptions,  // { weight: ["300g", "350g"], color: ["Red", "Blue"] }
      variantDetails,  // { "Red-300g": { price, stock, images[] } }
    } = body;

    /* ────────────────────────────────
       1. Validate Category
    ──────────────────────────────── */
    const finalCategoryId = category || product.category;
    const foundCategory = await Category.findById(finalCategoryId);
    if (!foundCategory) {
      return NextResponse.json(
        { error: "دسته‌بندی نامعتبر است" },
        { status: 400 }
      );
    }

    /* ────────────────────────────────
       2. Validate & Update Attributes
    ──────────────────────────────── */
    if (attributes !== undefined) {
      const allowedAttrs = foundCategory.attributes.map((a) => a.name);
      for (const key of Object.keys(attributes)) {
        if (!allowedAttrs.includes(key)) {
          return NextResponse.json(
            { error: `ویژگی "${key}" مجاز نیست` },
            { status: 400 }
          );
        }
      }
      product.attributes = attributes;
    }

    /* ────────────────────────────────
       3. Validate & Update Technical Stats
    ──────────────────────────────── */
    if (technicalStats !== undefined) {
      if (typeof technicalStats !== "object" || Array.isArray(technicalStats)) {
        return NextResponse.json(
          { error: "فرمت technicalStats نامعتبر است" },
          { status: 400 }
        );
      }
      const allowedStats = foundCategory.technicalStats
        ? foundCategory.technicalStats.map((s) => s.name)
        : [];
      for (const key of Object.keys(technicalStats)) {
        if (!allowedStats.includes(key)) {
          return NextResponse.json(
            { error: `شاخص فنی "${key}" در این دسته‌بندی تعریف نشده است` },
            { status: 400 }
          );
        }
      }
      product.technicalStats = technicalStats;
      product.markModified("technicalStats");
    }

    /* ────────────────────────────────
       4. Validate Relations
    ──────────────────────────────── */
    if (brand !== undefined && brand) {
      const brandDoc = await Brand.findById(brand);
      if (!brandDoc) {
        return NextResponse.json(
          { error: "برند نامعتبر است" },
          { status: 400 }
        );
      }
      if (serie) {
        const isSerieValid = brandDoc.series.some(
          (s) => s.toString() === serie.toString()
        );
        if (!isSerieValid) {
          return NextResponse.json(
            { error: "سری متعلق به این برند نیست" },
            { status: 400 }
          );
        }
      }
    }

    if (sport !== undefined && sport) {
      const exists = await Sport.findById(sport);
      if (!exists) {
        return NextResponse.json(
          { error: "ورزش نامعتبر است" },
          { status: 400 }
        );
      }
    }

    // athlete — validate each ID in the array
    if (athlete !== undefined && athlete !== null) {
      const athleteIds = Array.isArray(athlete) ? athlete : [athlete];
      if (athleteIds.length > 0) {
        const foundCount = await Athlete.countDocuments({
          _id: { $in: athleteIds },
        });
        if (foundCount !== athleteIds.length) {
          return NextResponse.json(
            { error: "یک یا چند ورزشکار نامعتبر است" },
            { status: 400 }
          );
        }
      }
    }

    /* ────────────────────────────────
       5. Update Simple Fields
    ──────────────────────────────── */
    if (name !== undefined) product.name = name.trim();
    if (shortDescription !== undefined)
      product.shortDescription = shortDescription.trim();
    if (longDescription !== undefined)
      product.longDescription = longDescription.trim();

    // color replaces suitableFor
    if (color !== undefined) product.color = color;

    if (basePrice !== undefined) {
      const parsedPrice = Number(basePrice);
      if (isNaN(parsedPrice)) {
        return NextResponse.json(
          { error: "قیمت نامعتبر است" },
          { status: 400 }
        );
      }
      product.basePrice = parsedPrice;
    }

    if (category !== undefined) product.category = category;

    if (tag !== undefined) {
      if (Array.isArray(tag)) {
        product.tag = tag;
      } else if (typeof tag === "string") {
        product.tag = tag
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      } else {
        return NextResponse.json(
          { error: "فرمت tag نامعتبر است" },
          { status: 400 }
        );
      }
    }

    if (label !== undefined) {
      const allowedLabels = ["none", "new", "hot", "discount", "limited"];
      if (!allowedLabels.includes(label)) {
        return NextResponse.json({ error: "لیبل نامعتبر" }, { status: 400 });
      }
      product.label = label;
    }

    if (mainImage !== undefined) product.mainImage = mainImage;
    if (gallery !== undefined) {
      if (!Array.isArray(gallery)) {
        return NextResponse.json(
          { error: "gallery باید آرایه باشد" },
          { status: 400 }
        );
      }
      product.gallery = gallery;
    }

    if (brand !== undefined) product.brand = brand || undefined;
    if (serie !== undefined) product.serie = serie && serie !== "" ? serie : null;

    // athlete — store as array (empty array if cleared)
    if (athlete !== undefined) {
      if (athlete === null || (Array.isArray(athlete) && athlete.length === 0)) {
        product.athlete = [];
      } else {
        product.athlete = Array.isArray(athlete) ? athlete : [athlete];
      }
    }

    if (sport !== undefined) product.sport = sport || undefined;

    await product.save();

    /* ────────────────────────────────
       6. Sync Variants (if provided)
    ──────────────────────────────── */
    if (variantOptions !== undefined) {
      const hasOptions =
        variantOptions &&
        typeof variantOptions === "object" &&
        Object.keys(variantOptions).length > 0;

      if (!hasOptions) {
        /*
         * variantOptions was explicitly passed as empty → delete all variants
         */
        const existingVariants = await Variant.find({
          productId: product._id,
        }).lean();

        // Delete variant images from Cloudinary
        const imagePublicIds = existingVariants.flatMap((v) =>
          (v.images || []).map(extractPublicId).filter(Boolean)
        );
        if (imagePublicIds.length > 0) {
          await cloudinary.api
            .delete_resources(imagePublicIds, { resource_type: "image" })
            .catch((e) =>
              console.warn("⚠️ Cloudinary delete skipped:", e.message)
            );
        }

        await Variant.deleteMany({ productId: product._id });
        product.variants = [];
        await product.save();
      } else {
        /*
         * Compute the full new set of combinations and reconcile with DB
         */
        const combinations = generateCombinations(variantOptions);

        // Fetch existing variants for this product
        const existingVariants = await Variant.find({
          productId: product._id,
        });

        // Index existing by their combo key (Object.values(attributes).join('-'))
        const existingByKey = {};
        for (const v of existingVariants) {
          const key = Object.values(v.attributes || {}).join("-");
          existingByKey[key] = v;
        }

        // Index desired combinations
        const desiredKeys = new Set(
          combinations.map((combo) => Object.values(combo).join("-"))
        );

        /* ── Delete variants that no longer exist ── */
        const toDelete = existingVariants.filter(
          (v) => !desiredKeys.has(Object.values(v.attributes || {}).join("-"))
        );

        if (toDelete.length > 0) {
          const deletedImageIds = toDelete.flatMap((v) =>
            (v.images || []).map(extractPublicId).filter(Boolean)
          );
          if (deletedImageIds.length > 0) {
            await cloudinary.api
              .delete_resources(deletedImageIds, { resource_type: "image" })
              .catch((e) =>
                console.warn("⚠️ Cloudinary delete skipped:", e.message)
              );
          }
          await Variant.deleteMany({ _id: { $in: toDelete.map((v) => v._id) } });
        }

        /* ── Upsert each combination ── */
        const upsertedIds = [];

        const upsertPromises = combinations.map(async (combo, index) => {
          const comboKey = Object.values(combo).join("-");
          const existing = existingByKey[comboKey];

          // Determine detail overrides for this combo
          let specificPrice = Number(product.basePrice) || 0;
          let specificStock = 0;
          let specificImages = existing?.images || [];

          if (variantDetails && typeof variantDetails === "object") {
            const matchedDetail =
              variantDetails[comboKey] ||
              Object.values(combo).reduce(
                (acc, val) => acc || variantDetails[val],
                null
              );

            if (matchedDetail) {
              if (matchedDetail.price !== undefined && matchedDetail.price !== "")
                specificPrice = Number(matchedDetail.price);
              if (matchedDetail.stock !== undefined && matchedDetail.stock !== "")
                specificStock = Number(matchedDetail.stock);

              if (
                Array.isArray(matchedDetail.images) &&
                matchedDetail.images.length > 0
              ) {
                // Determine SKU for this variant
                const variantSku = existing
                  ? existing.sku
                  : `${product.sku}-V${index + 1}`;

                specificImages = await Promise.all(
                  matchedDetail.images.map((imgUrl, i) =>
                    renameCloudinaryImage(imgUrl, variantSku, i + 1)
                  )
                );
              }
            }
          }

          if (existing) {
            /* UPDATE existing variant */
            existing.attributes = combo;
            existing.price = specificPrice;
            existing.stock = specificStock;
            existing.images = specificImages;
            await existing.save();
            return existing._id;
          } else {
            /* CREATE new variant */
            const variantSku = `${product.sku}-V${Date.now()}-${index}`;
            const created = await Variant.create({
              productId: product._id,
              categoryId: finalCategoryId,
              sku: variantSku,
              attributes: combo,
              price: specificPrice,
              stock: specificStock,
              images: specificImages,
            });
            return created._id;
          }
        });

        const resolvedIds = await Promise.all(upsertPromises);
        upsertedIds.push(...resolvedIds);

        // Sync product.variants array
        product.variants = upsertedIds;
        await product.save();
      }
    }

    /* ────────────────────────────────
       7. Return populated product
    ──────────────────────────────── */
    const populatedProduct = await Product.findById(product._id)
      .populate("brand serie sport athlete category")
      .populate("variants")
      .lean();

    return NextResponse.json({
      message: "محصول با موفقیت به‌روزرسانی شد",
      product: populatedProduct,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/* ----------------------------------
   DELETE
---------------------------------- */
export async function DELETE(req, { params }) {
  try {
    await connectToDB();
    const resolvedParams = await params;
    const productId = resolvedParams.productId || resolvedParams.id;

    const product = await Product.findById(productId).lean();
    if (!product) {
      return NextResponse.json({ error: "محصول پیدا نشد" }, { status: 404 });
    }

    /* ── Collect product image public_ids ── */
    const publicIds = [];

    if (product.mainImage) {
      const pid = extractPublicId(product.mainImage);
      if (pid) publicIds.push(pid);
    }

    if (Array.isArray(product.gallery)) {
      for (const img of product.gallery) {
        const pid = extractPublicId(img);
        if (pid) publicIds.push(pid);
      }
    }

    /* ── Collect variant image public_ids and delete variant docs ── */
    const variants = await Variant.find({ productId }).lean();
    for (const v of variants) {
      for (const img of v.images || []) {
        const pid = extractPublicId(img);
        if (pid) publicIds.push(pid);
      }
    }

    if (variants.length > 0) {
      await Variant.deleteMany({ productId });
    }

    /* ── Delete all collected images from Cloudinary ── */
    if (publicIds.length > 0) {
      await cloudinary.api
        .delete_resources(publicIds, { resource_type: "image" })
        .catch((e) =>
          console.warn("⚠️ Cloudinary delete partial failure:", e.message)
        );
    }

    /* ── Delete product ── */
    await Product.findByIdAndDelete(productId);

    return NextResponse.json({
      message: "محصول، واریانت‌ها و تصاویر آن با موفقیت حذف شدند",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}