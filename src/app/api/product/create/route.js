import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import Category from "base/models/Category";
import Variant from "base/models/Variant"; // حتماً مدل واریانت اضافه شود
import { createSlug } from "base/utils/slugify";
import { v2 as cloudinary } from "cloudinary";

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
    
    // اگر مقداری برای این ویژگی ارسال نشده بود، از آن عبور می‌کنیم
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
      athlete, // اکنون قرار است آرایه باشد
      sport,
      attributes,
      technicalStats,
      label,
      variantOptions, // { weight: ["300g", "350g"], color: ["Red", "Blue"] }
      variantDetails
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
    // بررسی ویژگی‌های ثابت
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

    // بررسی شاخص‌های فنی
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
    
    // تبدیل ورزشکار به آرایه ایمن
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
      athlete: formattedAthletes.length > 0 ? formattedAthletes : [],
      sport: sport || undefined,
      attributes: attributes || {},
      technicalStats: technicalStats || {},
      label: label || "none",
    });

    /* -------------------------------
       🔥 Generate & Create Variants
    ------------------------------- */
    if (variantOptions && Object.keys(variantOptions).length > 0) {
      // تولید تمام ترکیب‌های ممکن
      const combinations = generateCombinations(variantOptions);
      
      if (combinations.length > 0) {
        // ایجاد اسناد واریانت با استفاده از Promise.all برای اجرای pre-validate و pre-save
        const variantPromises = combinations.map(async (combo, index) => {
          const variantSku = `${product.sku}-V${index + 1}`; // مثال: RACKET-ABCD-V1

          let specificImages = [];
          let specificPrice = Number(basePrice) || 0;
          let specificStock = 0;

          if (variantDetails) {
            // پیدا کردن مچ شدن با کلیدهای ترکیبی (مثلاً "Red-300g") یا تکی (مثلاً "Red")
            const comboValues = Object.values(combo);
            const exactKey = comboValues.join("-");
            
            // اولویت با کلید دقیق است، اگر نبود مقادیر تکی را چک می‌کنیم (معمولاً تصاویر بر اساس رنگ هستند)
            const matchedDetail = variantDetails[exactKey] || comboValues.reduce((acc, val) => acc || variantDetails[val], null);

            if (matchedDetail) {
              if (matchedDetail.price) specificPrice = Number(matchedDetail.price);
              if (matchedDetail.stock) specificStock = Number(matchedDetail.stock);
              if (Array.isArray(matchedDetail.images) && matchedDetail.images.length > 0) {
                // Rename تصاویر واریانت در کلودینری بر اساس SKU واریانت
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
            stock: specificStock,
            images: specificImages, // تصاویر پردازش شده به مدل اضافه شد
          });
        });

        // صبر کردن تا ذخیره تمام واریانت‌ها
        const createdVariants = await Promise.all(variantPromises);
        
        // استخراج آیدی واریانت‌ها و آپدیت محصول اصلی
        const variantIds = createdVariants.map(v => v._id);
        product.variants = variantIds;
        await product.save();
      }
    }

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