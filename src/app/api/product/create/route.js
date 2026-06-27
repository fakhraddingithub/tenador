import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import Category from "base/models/Category";
import Variant from "base/models/Variant";
import { createSlug } from "base/utils/slugify";
import { v2 as cloudinary } from "cloudinary";
import { revalidateContent } from "@/lib/revalidate";
import { makeComboKey } from "@/lib/variantKey";

/* ----------------------------------
   Cloudinary config
---------------------------------- */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ----------------------------------
   Generate unique SKU
---------------------------------- */
async function generateUniqueSKU(name) {
  const base = createSlug(name);
  let sku;
  let exists = true;

  while (exists) {
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    sku = `${base}-${rand}`;
    exists = await Product.exists({ sku });
  }

  return sku;
}

/* ----------------------------------
   Cloudinary helpers
---------------------------------- */
function extractPublicId(url) {
  const parts = url.split("/upload/")[1];
  const withoutVersion = parts.replace(/v\d+\//, "");
  return withoutVersion.replace(/\.[^/.]+$/, "");
}

async function renameCloudinaryImage(imageUrl, sku, index = null) {
  if (!imageUrl) return null;
  if (imageUrl.includes(sku)) return imageUrl;
  
  const oldPublicId = extractPublicId(imageUrl);
  const folder = oldPublicId.split("/").slice(0, -1).join("/");
  try {
    const newPublicId = index !== null ? `${folder}/${sku}-${index}` : `${folder}/${sku}`;
    const result = await cloudinary.uploader.rename(oldPublicId, newPublicId, { overwrite: true });
    return result.secure_url;
  } catch (error) {
    console.warn(`⚠️ Cloudinary Rename skipped for ${imageUrl}:`, error.message);
    return imageUrl; 
  }
}

/* ----------------------------------
   Helper: Generate Variant Combinations (Cartesian Product)
---------------------------------- */
function generateCombinations(options) {
  const keys = Object.keys(options);
  if (keys.length === 0) return [];
  
  const result = [];
  function helper(index, currentCombo) {
    if (index === keys.length) {
      result.push({ ...currentCombo });
      return;
    }
    const key = keys[index];
    const values = options[key];
    
    if (Array.isArray(values) && values.length > 0) {
      for (const val of values) {
        currentCombo[key] = val;
        helper(index + 1, currentCombo);
      }
    } else {
      helper(index + 1, currentCombo);
    }
  }
  
  helper(0, {});
  return result;
}

/* ----------------------------------
   POST: Create Product
---------------------------------- */
export async function POST(req) {
  try {
    await connectToDB();
    const body = await req.json();

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
      limitedEdition,
      athlete,
      sport,
      gender, // جنسیت محصول (men|women|kids یا null)
      attributes,
      technicalStats,
      label,
      isActive, // ✨ اضافه شد: دریافت وضعیت فعال بودن از فرانت‌اند
      variantOptions,
      variantDetails,
      selectedCombos, // آرایه‌ی کلیدِ ترکیب‌های انتخاب‌شده برای ساخت (اختیاری)
      variantMeta, // متادیتای سطحِ مقدار (تصاویرِ مشترک هر مقدار و ...)
    } = body;

    /* -------------------------------
        Validate Required Fields
     ------------------------------- */
    const requiredFields = { name, shortDescription, longDescription, category, mainImage, brand, sport };

    for (const key in requiredFields) {
      if (!requiredFields[key]) {
        return Response.json({ error: `${key} is required` }, { status: 400 });
      }
    }

    /* -------------------------------
        Validate Category
     ------------------------------- */
    const foundCategory = await Category.findById(category);
    if (!foundCategory) {
      return Response.json({ error: "Category not found" }, { status: 404 });
    }

    /* -------------------------------
        Validate Attributes & Tech Stats
     ------------------------------- */
    const allowedAttrs = foundCategory.attributes.map(a => a.name);
    if (attributes) {
      for (const key of Object.keys(attributes)) {
        if (!allowedAttrs.includes(key)) {
          return Response.json({ error: `Attribute "${key}" is not allowed` }, { status: 400 });
        }
      }
      for (const attr of foundCategory.attributes) {
        if (attr.required && (attributes[attr.name] === undefined || attributes[attr.name] === null)) {
          return Response.json({ error: `ویژگی "${attr.label}" را وارد کنید` }, { status: 400 });
        }
      }
    }

    const allowedStats = foundCategory.technicalStats ? foundCategory.technicalStats.map(s => s.name) : [];
    if (technicalStats) {
      for (const key of Object.keys(technicalStats)) {
        if (!allowedStats.includes(key)) {
          return Response.json({ error: `شاخص فنی "${key}" در این دسته تعریف نشده است` }, { status: 400 });
        }
        const val = technicalStats[key];
        if (isNaN(val) || val < 0 || val > 100) {
           console.warn(`Value for ${key} is not a standard score (0-100): ${val}`);
        }
      }
    }

    /* -------------------------------
        Generate SKU & Rename Images
     ------------------------------- */
    const sku = await generateUniqueSKU(name);
    const normalizedMainImage = await renameCloudinaryImage(mainImage, sku);
    const normalizedGallery = Array.isArray(gallery)
      ? await Promise.all(gallery.map((img, i) => renameCloudinaryImage(img, sku, i + 1)))
      : [];

    /* -------------------------------
        Format Arrays (Tag & Athlete)
     ------------------------------- */
    const formattedTags = Array.isArray(tag) ? tag : typeof tag === "string" ? tag.split(",").map(t => t.trim()) : [];
    
    let formattedAthletes = [];
    if (Array.isArray(athlete)) {
      formattedAthletes = athlete;
    } else if (typeof athlete === "string" && athlete.trim() !== "") {
      formattedAthletes = [athlete];
    }

    /* -------------------------------
        Create Product
     ------------------------------- */
    const product = await Product.create({
      name,
      shortDescription,
      longDescription,
      color,
      sku,
      basePrice: Number(basePrice) || 0,
      category,
      tag: formattedTags,
      mainImage: normalizedMainImage,
      gallery: normalizedGallery,
      brand: brand || undefined,
      serie: (serie && serie !== "") ? serie : undefined,
      limitedEdition: (limitedEdition && limitedEdition !== "") ? limitedEdition : undefined,
      athlete: formattedAthletes.length > 0 ? formattedAthletes : [],
      sport: sport || undefined,
      gender: ["men", "women", "kids"].includes(gender) ? gender : null,
      attributes: attributes || {},
      technicalStats: technicalStats || {},
      variantMeta: variantMeta && typeof variantMeta === "object" ? variantMeta : {},
      label: label || "none",
      isActive: isActive !== undefined ? isActive : true, // ✨ اضافه شد: اگر ارسال نشود به صورت پیش‌فرض true خواهد بود
    });

    /* -------------------------------
        Generate & Create Variants
     ------------------------------- */
    if (variantOptions && Object.keys(variantOptions).length > 0) {
      const allCombinations = generateCombinations(variantOptions);
      // اگر لیست انتخاب‌شده ارسال شده باشد فقط همان ترکیب‌ها ساخته می‌شوند؛
      // در غیر این صورت همه‌ی ترکیب‌ها (سازگاری با کلاینت‌های قدیمی)
      const selectedSet = Array.isArray(selectedCombos) ? new Set(selectedCombos) : null;
      const combinations = selectedSet
        ? allCombinations.filter((c) => selectedSet.has(makeComboKey(c)))
        : allCombinations;

      if (combinations.length > 0) {
        const variantPromises = combinations.map(async (combo, index) => {
          const variantSku = `${product.sku}-V${index + 1}`;

          let specificImages = [];
          let specificPrice = Number(basePrice) || 0;

          if (variantDetails) {
            const matchedDetail = variantDetails[makeComboKey(combo)] || null;

            if (matchedDetail) {
              if (matchedDetail.price) specificPrice = Number(matchedDetail.price);
              if (Array.isArray(matchedDetail.images) && matchedDetail.images.length > 0) {
                specificImages = await Promise.all(
                  matchedDetail.images.map((imgUrl, i) => renameCloudinaryImage(imgUrl, variantSku, i + 1))
                );
              }
            }
          }
          return await Variant.create({
            productId: product._id,
            categoryId: category,
            sku: variantSku,
            attributes: combo,
            price: specificPrice,
            images: specificImages,
          });
        });

        const createdVariants = await Promise.all(variantPromises);
        
        const variantIds = createdVariants.map(v => v._id);
        product.variants = variantIds;
        await product.save();
      }
    }

    // باطل‌سازی کش محتوا تا محصول جدید بلافاصله در صفحات نمایش داده شود
    revalidateContent();

    return Response.json(
      { message: "Product and variants created successfully", product },
      { status: 201 }
    );

  } catch (err) {
    console.error(err);
    return Response.json(
      { error: "Internal server error", detail: err.message },
      { status: 500 }
    );
  }
}