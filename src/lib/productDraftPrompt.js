/**
 * src/lib/productDraftPrompt.js  (server)
 *
 * پرامپتِ کاملِ تولیدِ محصول برای یک دسته — تنها مسیرِ ساختِ آن. هم
 * «ساخت محصول با پرامپت» (POST /api/ai/product-draft) و هم هر دو حالتِ
 * بازتولید (دستی و خودکار) از همین تابع می‌خوانند، پس پرامپتِ پایه، گروه‌های
 * پرامپتِ دسته و قواعدِ خودِ دسته که در پنل تنظیم می‌شوند به یک شکل روی
 * همه اثر می‌گذارند و خروجی‌ها یکسان می‌ماند.
 *
 * داده‌ی دیتابیس فقط به اندازه‌ی نیاز: ورزش فقط از خودِ دسته، و ورزشکاران فقط
 * از همان ورزش (همان فیلترِ فرمِ ویرایش). برندها، سری‌ها و لیمیتد ادیشن‌ها کامل
 * می‌روند چون انتخابِ برند کارِ خودِ مدل است.
 *
 * caller باید اتصالِ دیتابیس را برقرار کرده باشد.
 */
import Category from "base/models/Category";
import Brand from "base/models/Brand";
import Athlete from "base/models/Athlete";
import LimitedEdition from "base/models/LimitedEdition";
import ProductPromptConfig from "base/models/ProductPromptConfig";
import { buildProductTemplate } from "./buildProductTemplate.js";

export const RAW_CONTENT_MIN = 50;
export const RAW_CONTENT_MAX = 60000;

/** @returns {{ error: string, status: number } | null} */
export function validateRawContent(rawContent) {
  if (typeof rawContent !== "string" || rawContent.trim().length < RAW_CONTENT_MIN) {
    return { error: `متن محصول خیلی کوتاه است؛ دست‌کم ${RAW_CONTENT_MIN} نویسه از توضیحاتِ محصول را وارد کنید`, status: 400 };
  }
  if (rawContent.length > RAW_CONTENT_MAX) {
    return { error: `متن محصول بیش از حد طولانی است (حداکثر ${RAW_CONTENT_MAX.toLocaleString("fa-IR")} نویسه)؛ فقط بخش‌های مربوط به محصول را بیاورید`, status: 400 };
  }
  return null;
}

/**
 * @returns {Promise<{ error: string, status: number } | { prompt: string, category: object, meta: object }>}
 */
export async function buildProductDraftPrompt({ categoryId, rawContent }) {
  if (!categoryId) return { error: "categoryId and rawContent are required", status: 400 };
  const invalid = validateRawContent(rawContent);
  if (invalid) return invalid;

  const category = await Category.findById(categoryId)
    .populate({ path: "sport", select: "name title" })
    .lean();
  if (!category) return { error: "Category not found", status: 404 };

  if (!category.sport?._id || !category.sport.name?.trim()) {
    return { error: "ورزش اصلی این دسته‌بندی معتبر نیست؛ ابتدا ورزش دسته‌بندی را اصلاح کنید", status: 400 };
  }

  const [brands, athletes, limitedEditions, promptConfig] = await Promise.all([
    Brand.find({}, { name: 1 }).populate("series").lean(),
    Athlete.find({ sport: category.sport._id }, { name: 1 }).lean(),
    // brand لازم است تا قیدِ «ادیشن ← برند مالک» به مدل داده شود؛ بدونِ آن مدل
    // می‌توانست ادیشنِ یک برند را به محصولِ برندِ دیگری بچسباند.
    LimitedEdition.find({}, { name: 1, title: 1, brand: 1 }).populate({ path: "brand", select: "name" }).lean(),
    // پرامپت پایه + گروه‌های پرامپت دسته (بدونِ سند → پرامپتِ پیش‌فرض)
    ProductPromptConfig.findOne({ key: "product" }).sort({ createdAt: 1 }).lean(),
  ]);

  if (!brands.length) return { error: "Brands not configured", status: 500 };

  const prompt = buildProductTemplate({ category, brands, athletes, limitedEditions, rawContent, promptConfig });

  return {
    prompt,
    category,
    meta: {
      category: category.title,
      categoryId: category._id.toString(),
      sport: { id: category.sport._id.toString(), name: category.sport.name, title: category.sport.title },
    },
  };
}
