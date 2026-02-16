// app/api/product/[productId]/route.js
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import Brand from "base/models/Brand";
import Sport from "base/models/Sport";
import Athlete from "base/models/Athlete";
import Category from "base/models/Category";
import PriceCache from "base/models/PriceCache";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
function extractPublicId(url) {
  if (!url) return null;

  try {
    const u = new URL(url);
    const pathname = u.pathname;

    const uploadIndex = pathname.indexOf("/upload/");
    if (uploadIndex === -1) return null;

    let publicPath = pathname.slice(uploadIndex + 8); // بعد از /upload/

    // حذف version اگه بود
    publicPath = publicPath.replace(/^v\d+\//, "");

    // حذف extension
    publicPath = publicPath.replace(/\.[^/.]+$/, "");

    return publicPath;
  } catch {
    return null;
  }
}



const REDIS_PREFIX = "pricecache:product:";

export async function GET(req, { params }) {
  try {
    await connectToDB();
    const resolvedParams = await params;
    const productId = resolvedParams.productId || resolvedParams.id;
    
    const product = await Product.findById(productId)
    .populate('brand')
    .populate('sport')
    .populate('athlete')
    .populate('category')
    .populate('serie')
    .lean();
    
    if (!product) {
      return NextResponse.json({ error: "محصول پیدا نشد" }, { status: 404 });
    }

    product.variants = product.variants || [];
    product.tag = product.tag || [];
    product.gallery = product.gallery || [];
    product.attributes = product.attributes || {};
    product.technicalStats = product.technicalStats || {};
    
    const priceDoc = await PriceCache.findOne({ productId }).lean();
    const price = priceDoc || { finalPrice: product.basePrice, bestDiscount: 0 };
    
    return NextResponse.json({ product, price });
  } catch (err) {
    console.log(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

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
      suitableFor,
      basePrice,
      category,
      tag,
      mainImage,
      gallery,
      brand,
      serie,
      athlete,
      sport,
      attributes,
      technicalStats,
      label,
    } = body;

    // -------------------------
    // Validate Category + Attributes + TechnicalStats
    // -------------------------
    let finalCategoryId = category || product.category;
    const foundCategory = await Category.findById(finalCategoryId);

    if (!foundCategory) {
        return NextResponse.json({ error: "دسته‌بندی نامعتبر است" }, { status: 400 });
    }

    // اعتبارسنجی ویژگی‌های معمولی (Attributes)
    if (attributes !== undefined) {
      const allowedAttrs = foundCategory.attributes.map((a) => a.name);
      for (const key of Object.keys(attributes)) {
        if (!allowedAttrs.includes(key)) {
          return NextResponse.json({ error: `ویژگی "${key}" مجاز نیست` }, { status: 400 });
        }
      }
      product.attributes = attributes;
    }

    // اعتبارسنجی شاخص‌های فنی (Technical Stats) 🔥
    if (technicalStats !== undefined) {
      if (typeof technicalStats !== "object" || Array.isArray(technicalStats)) {
        return NextResponse.json({ error: "فرمت technicalStats نامعتبر است" }, { status: 400 });
      }

      const allowedStats = foundCategory.technicalStats 
        ? foundCategory.technicalStats.map(s => s.name) 
        : [];

      for (const key of Object.keys(technicalStats)) {
        if (!allowedStats.includes(key)) {
          return NextResponse.json(
            { error: `شاخص فنی "${key}" در این دسته‌بندی تعریف نشده است` },
            { status: 400 }
          );
        }
      }
      // جایگزینی مقادیر جدید
      product.technicalStats = technicalStats;
      // چون فیلد Mixed/Object است، به مانگوز اطلاع می‌دهیم که تغییر کرده
      product.markModified('technicalStats');
    }

    // -------------------------
    // Validate Relations (بدون تغییر نسبت به کد شما)
    // -------------------------
    if (brand) {
      const exists = await Brand.findById(brand);
      if (!exists) return NextResponse.json({ error: "برند نامعتبر است" }, { status: 400 });
      if (serie) {
        const isSerieValid = exists.series.some(s => s.toString() === serie.toString());
        if (!isSerieValid) return NextResponse.json({ error: "سری متعلق به این برند نیست" }, { status: 400 });
      }
    }
    
    if (sport) {
      const exists = await Sport.findById(sport);
      if (!exists)
        return NextResponse.json({ error: "ورزش نامعتبر است" }, { status: 400 });
    }

    if (athlete !== undefined && athlete !== null) {
      const exists = await Athlete.findById(athlete);
      if (!exists)
        return NextResponse.json({ error: "ورزشکار نامعتبر است" }, { status: 400 });
    }

    // -------------------------
    // Update Other Fields
    // -------------------------
    if (name !== undefined) product.name = name.trim();
    if (shortDescription !== undefined) product.shortDescription = shortDescription.trim();
    if (longDescription !== undefined) product.longDescription = longDescription.trim();
    if (suitableFor !== undefined) product.suitableFor = suitableFor.trim();

    if (basePrice !== undefined) {
      const parsedPrice = Number(basePrice);
      if (isNaN(parsedPrice)) return NextResponse.json({ error: "قیمت نامعتبر است" }, { status: 400 });
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
      if (!allowedLabels.includes(label)) return NextResponse.json({ error: "لیبل نامعتبر" }, { status: 400 });
      product.label = label;
    }

    if (mainImage !== undefined) product.mainImage = mainImage;
    if (gallery !== undefined) {
      if (!Array.isArray(gallery))
        return NextResponse.json(
          { error: "gallery باید آرایه باشد" },
          { status: 400 }
        );
      product.gallery = gallery;
    }

    if (brand !== undefined) product.brand = brand || undefined;

    if (serie !== undefined) {
        product.serie = (serie && serie !== "") ? serie : null;
    }
    
    if (athlete !== undefined) {
        product.athlete = (athlete && athlete !== "") ? athlete : null;
    }
    
    if (sport !== undefined) product.sport = sport || undefined;

    await product.save();

    const populatedProduct = await Product.findById(product._id)
      .populate("brand serie sport athlete category")
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


export async function DELETE(req, { params }) {
  try {
    await connectToDB();
    const resolvedParams =await params;
    const productId = resolvedParams.productId || resolvedParams.id;

    const product = await Product.findById(productId).lean();
    if (!product) {
      return NextResponse.json(
        { error: "محصول پیدا نشد" },
        { status: 404 }
      );
    }

    /* -------------------------------
       Collect images public_ids
    ------------------------------- */
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

    /* -------------------------------
       Delete images from Cloudinary
    ------------------------------- */
    if (publicIds.length > 0) {
      await cloudinary.api.delete_resources(publicIds, {
        resource_type: "image",
      });
    }

    /* -------------------------------
       Delete product from DB
    ------------------------------- */
    await Product.findByIdAndDelete(productId);

    return NextResponse.json({
      message: "محصول و تصاویر آن با موفقیت حذف شدند",
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

