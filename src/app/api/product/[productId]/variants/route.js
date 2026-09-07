import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import Variant from "base/models/Variant";
import Category from "base/models/Category";
import requireAdminPermission from "@/lib/requireAdminPermission";
import { revalidateContent } from "@/lib/revalidate";
import { apiError, handleApiError } from "@/lib/apiError";
import { validateProductVariants } from "@/lib/productVariantValidation";
import { makeComboKey } from "@/lib/variantKey";

// ⚠️ در Next 16 مقدارِ params یک Promise است، نه تابع. `await params()` پیش از
// هر کاری TypeError می‌داد و همین باگ، نبودِ احراز هویت را پنهان کرده بود.
// اصلاحِ params و افزودنِ requireAdmin عمداً با هم انجام می‌شوند: اصلاحِ تنهای
// params یک اندپوینتِ ساخت/حذفِ واریانتِ بدونِ احراز هویت باز می‌کرد.
// این روت‌ها فقط از صفحاتِ پنلِ ادمین فراخوانی می‌شوند.

export async function GET(req, { params }) {
  const { denied } = await requireAdminPermission("variants.view");
  if (denied) return denied;

  try {
    await connectToDB();
    const resolvedParams = await params;
    const productId = resolvedParams.productId || resolvedParams.id;

    const variants = await Variant.find({ productId }).lean();

    return NextResponse.json({
      variants,
    });
  } catch (error) {
    return handleApiError(error, "خطا در دریافت واریانت‌ها");
  }
}

export async function POST(req, { params }) {
  const { denied } = await requireAdminPermission("variants.edit");
  if (denied) return denied;

  try {
    await connectToDB();

    const resolvedParams = await params;
    const productId = resolvedParams.productId || resolvedParams.id;
    const body = await req.json();

    const { sku, price, images, attributes } = body;

    if (!sku || !attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
      return apiError("«کد کالا (SKU)» و ویژگی‌های واریانت الزامی هستند", 400);
    }

    // پیدا کردن محصول
    const product = await Product.findById(productId).lean();
    if (!product) {
      return apiError("محصول پیدا نشد", 404);
    }

    // پیدا کردن کتگوری محصول
    const category = await Category.findById(product.category).lean();
    if (!category) {
      return apiError("دسته‌بندی محصول یافت نشد", 404);
    }

    // ویژگی‌های واریانت با category.variantAttributes سنجیده می‌شوند، نه با
    // category.attributes. بررسیِ قبلی به فهرستِ اشتباه (ویژگی‌های ثابتِ محصول)
    // نگاه می‌کرد و صفحهٔ افزودنِ واریانت هم فیلدهای همان فهرست را می‌ساخت — پس
    // هوکِ pre("validate") مدلِ Variant هر ذخیره را رد می‌کرد و این روت خطا را
    // به ۵۰۰ «مشکل سمت سرور» تبدیل می‌کرد. حالا همان اعتبارسنجیِ مشترکِ روت‌های
    // ساخت/ویرایشِ محصول اجرا می‌شود (هر ویژگی یک مقدار دارد).
    const variantValidation = validateProductVariants(
      category.variantAttributes,
      Object.fromEntries(Object.entries(attributes).map(([key, value]) => [key, [value]])),
    );
    if (variantValidation.error) {
      return apiError(variantValidation.error, 400, {
        fieldErrors: variantValidation.fieldErrors,
      });
    }

    // ترکیبِ ویژگی‌ها هویتِ واریانت است (src/lib/variantReconcile.js). دو واریانت
    // با یک ترکیب یعنی دادهٔ خراب: اولین ذخیرهٔ بعدیِ محصول دومی را حذف می‌کند.
    const comboKey = makeComboKey(attributes);
    const siblings = await Variant.find({ productId }).select("attributes").lean();
    if (siblings.some((variant) => makeComboKey(variant.attributes || {}) === comboKey)) {
      return apiError("واریانتی با همین ترکیبِ ویژگی‌ها از قبل برای این محصول وجود دارد", 409);
    }

    // قیمت ۰ یا خالی → قیمت پایه محصول
    const finalPrice = Number(price) || Number(product.basePrice) || 0;

    // ساختِ واریانت و وصل‌کردنش به محصول در یک تراکنش — وگرنه شکستِ مرحلهٔ دوم
    // یک واریانتِ بی‌صاحب جا می‌گذارد.
    let variant;
    await Product.db.transaction(async (session) => {
      variant = new Variant({
        productId,
        categoryId: category._id,
        sku,
        price: finalPrice,
        images: Array.isArray(images) ? images : [],
        attributes,
      });
      variant.$session(session);
      await variant.save();

      await Product.updateOne(
        { _id: productId },
        { $push: { variants: variant._id } },
        { session },
      );
    });

    // صفحه‌ی محصول واریانت‌ها را از کشِ داده می‌خواند
    revalidateContent(["products"]);

    return NextResponse.json(
      {
        message: "واریانت با موفقیت ایجاد شد",
        variant,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err, "خطا در ایجاد واریانت");
  }
}
