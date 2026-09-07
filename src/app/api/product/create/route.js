import "base/models/registerModels";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import Category from "base/models/Category";
import Variant from "base/models/Variant";
import { createSlug } from "base/utils/slugify";
import { revalidateContent } from "@/lib/revalidate";
import { makeComboKey } from "@/lib/variantKey";
import {
  validateProductVariants,
  validateProductFields,
} from "@/lib/productVariantValidation";
import { createProductWithVariants } from "@/lib/createProductWithVariants";
import { apiError, handleApiError } from "@/lib/apiError";
import { normalizeTargetAudience } from "base/utils/targetAudience";
import { resolveProductLimitedEdition } from "@/lib/limitedEditionRelations";
import requireAdminPermission from "@/lib/requireAdminPermission";

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
   POST: Create Product
---------------------------------- */
export async function POST(req) {
  const { denied } = await requireAdminPermission("products.create");
  if (denied) return denied;

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
      attributes,
      technicalStats,
      customTabItems,
      label,
      targetAudience,
      isActive, // ✨ اضافه شد: دریافت وضعیت فعال بودن از فرانت‌اند
      variantOptions,
      variantDetails,
      selectedCombos, // آرایه‌ی کلیدِ ترکیب‌های انتخاب‌شده برای ساخت (اختیاری)
      variantMeta, // متادیتای سطحِ مقدار (تصاویرِ مشترک هر مقدار و ...)
    } = body;

    /* -------------------------------
        Validate Required Fields
     ------------------------------- */
    const requiredLabels = {
      name: "نام محصول",
      shortDescription: "توضیح کوتاه",
      longDescription: "توضیح کامل",
      category: "دسته‌بندی",
      mainImage: "تصویر اصلی",
      brand: "برند",
      sport: "ورزش",
    };

    for (const key of Object.keys(requiredLabels)) {
      if (!body[key]) {
        return apiError(`«${requiredLabels[key]}» الزامی است`, 400, {
          fieldErrors: { [key]: `«${requiredLabels[key]}» الزامی است` },
        });
      }
    }

    const normalizedTargetAudience = normalizeTargetAudience(targetAudience);
    if (targetAudience != null && targetAudience !== "" && !normalizedTargetAudience) {
      return apiError("«مخاطب هدف» نامعتبر است", 400, {
        fieldErrors: { targetAudience: "مخاطب هدف انتخاب‌شده معتبر نیست" },
      });
    }

    /* -------------------------------
        Validate Limited Edition ↔ Brand
     ------------------------------- */
    const resolvedLimitedEdition = await resolveProductLimitedEdition(
      limitedEdition,
      brand,
    );
    if (resolvedLimitedEdition.error) {
      return apiError(resolvedLimitedEdition.error, resolvedLimitedEdition.status, {
        fieldErrors: { limitedEdition: resolvedLimitedEdition.error },
      });
    }

    /* -------------------------------
        Validate Category
     ------------------------------- */
    const foundCategory = await Category.findById(category);
    if (!foundCategory) {
      return apiError("دسته‌بندی انتخاب‌شده یافت نشد", 404, {
        fieldErrors: { category: "دسته‌بندی انتخاب‌شده یافت نشد" },
      });
    }

    const variantValidation = validateProductVariants(
      foundCategory.variantAttributes, variantOptions, selectedCombos,
    );
    if (variantValidation.error) {
      return apiError(variantValidation.error, 400, { fieldErrors: variantValidation.fieldErrors });
    }

    // تبدیل تایتل‌های انتخاب‌شده (از AI یا انتخاب دستی ادمین) به شناسه‌ی واقعیِ آیتم در دسته‌بندی
    let resolvedCustomTabItemIds = [];
    if (Array.isArray(customTabItems) && customTabItems.length > 0) {
      const categoryItems = foundCategory.customTab?.items || [];
      resolvedCustomTabItemIds = customTabItems
        .map((title) => categoryItems.find((it) => it.title === title)?._id)
        .filter(Boolean);
      const unmatchedCount = customTabItems.length - resolvedCustomTabItemIds.length;
      if (unmatchedCount > 0) {
        console.warn(`${unmatchedCount} customTabItems title(s) did not match any item in category "${foundCategory.title}" and were skipped.`);
      }
    }

    /* -------------------------------
        Validate Base Price, Attributes & Tech Stats
     ------------------------------- */
    // مشترک با روتِ ویرایش (src/lib/productVariantValidation.js). پیش‌تر این
    // بررسی‌ها فقط اینجا و به‌صورت درون‌خطی بودند، پس ویرایش هیچ‌کدامشان را
    // نداشت. سه نشتیِ قبلی هم بسته شد: نیامدنِ کلِ `attributes` بررسیِ ویژگیِ
    // الزامی را دور می‌زد، رشتهٔ خالی به‌جای مقدار قبول می‌شد، و شاخصِ فنیِ
    // خارج از بازه فقط console.warn می‌گرفت و ذخیره می‌شد.
    const fieldValidation = validateProductFields(foundCategory, {
      attributes: attributes || {},
      technicalStats: technicalStats || {},
      basePrice,
    });
    if (fieldValidation.error) {
      return apiError(fieldValidation.error, 400, {
        fieldErrors: fieldValidation.fieldErrors,
      });
    }

    /* -------------------------------
        Generate SKU & Rename Images
     ------------------------------- */
    const sku = await generateUniqueSKU(name);
    // نکته‌ی مهاجرت به ImageKit: فایل‌ها دیگر بعد از ساختِ محصول بر اساسِ SKU
    // rename نمی‌شوند (fileId لازم برای rename در فرانت‌اند ذخیره نمی‌شود).
    // آدرس‌های برگشتی از آپلود همان‌طور که هستند ذخیره می‌شوند.
    const normalizedMainImage = mainImage || null;
    const normalizedGallery = Array.isArray(gallery) ? gallery : [];

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
    const productData = {
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
      limitedEdition: resolvedLimitedEdition.value || undefined,
      athlete: formattedAthletes.length > 0 ? formattedAthletes : [],
      sport: sport || undefined,
      attributes: attributes || {},
      technicalStats: technicalStats || {},
      customTabItems: resolvedCustomTabItemIds,
      variantMeta: variantMeta && typeof variantMeta === "object" ? variantMeta : {},
      label: label || "none",
      targetAudience: normalizedTargetAudience,
      isActive: isActive !== undefined ? isActive : true, // ✨ اضافه شد: اگر ارسال نشود به صورت پیش‌فرض true خواهد بود
    };

    const variants = variantValidation.combinations.map((combo) => {
      const detail = variantDetails?.[makeComboKey(combo)];
      return {
        categoryId: category,
        attributes: combo,
        price: detail?.price ? Number(detail.price) : Number(basePrice) || 0,
        images: Array.isArray(detail?.images) ? detail.images : [],
      };
    });
    const product = await createProductWithVariants({ Product, Variant, productData, variants });

    // باطل‌سازی کش محتوا تا محصول جدید بلافاصله در صفحات نمایش داده شود
    revalidateContent(["products", "navbar"]);

    return Response.json(
      { message: "Product and variants created successfully", product },
      { status: 201 }
    );

  } catch (err) {
    return handleApiError(err, "خطا در ایجاد محصول");
  }
}
