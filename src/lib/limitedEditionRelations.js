import mongoose from "mongoose";
import Brand from "base/models/Brand";
import LimitedEdition from "base/models/LimitedEdition";
import {
  escapeRegexLiteral,
  normalizeRelatedBrandIds,
} from "base/utils/limitedEditionRelations";

export { escapeRegexLiteral, normalizeRelatedBrandIds };

/**
 * یک لیمیتد ادیشن فقط روی محصولاتِ «برند مالکِ خودش» معنا دارد — همان قیدی که
 * فرم‌های ادمین در dropdown اعمال می‌کنند و مسیرِ /[brand]/[limitedEdition] هم
 * بر اساسش کوئری می‌زند. تا پیش از این هیچ‌جای سرور آن را چک نمی‌کرد، پس ردیف‌های
 * ناسازگار (میراثِ مدلِ سراسریِ Collaboration، یا خروجیِ AI draft) بی‌صدا ذخیره
 * می‌شدند و بعداً روی صفحه‌ی برندهای دیگر بیرون می‌زدند.
 *
 * caller باید پیش از فراخوانی اتصال دیتابیس را برقرار کرده باشد.
 *
 * @returns {{ value: string|null } | { error: string, status: number }}
 */
export async function resolveProductLimitedEdition(limitedEditionId, brandId) {
  const id = limitedEditionId == null ? "" : String(limitedEditionId).trim();
  if (id === "") return { value: null };

  if (!mongoose.isValidObjectId(id)) {
    return { error: "لیمیتد ادیشن انتخاب‌شده معتبر نیست", status: 422 };
  }

  const edition = await LimitedEdition.findById(id).select("brand").lean();
  if (!edition) {
    return { error: "لیمیتد ادیشن انتخاب‌شده یافت نشد", status: 404 };
  }

  if (String(edition.brand || "") !== String(brandId || "")) {
    return {
      error: "لیمیتد ادیشن انتخاب‌شده متعلق به برند این محصول نیست",
      status: 422,
    };
  }

  return { value: id };
}

/**
 * اعتبارسنجی مشترک create/edit برای برند مالک و برندهای مرتبط.
 * caller باید پیش از فراخوانی اتصال دیتابیس را برقرار کرده باشد.
 */
export async function validateLimitedEditionBrands(ownerBrandId, rawRelatedBrands) {
  const owner = ownerBrandId == null ? "" : String(ownerBrandId).trim();
  if (!mongoose.isValidObjectId(owner)) {
    return { error: "برند مالک نامعتبر است", status: 422 };
  }

  const relatedBrands = normalizeRelatedBrandIds(rawRelatedBrands);
  if (relatedBrands === null) {
    return { error: "برندهای مرتبط باید به‌صورت یک فهرست ارسال شوند", status: 422 };
  }
  if (relatedBrands.some((id) => !mongoose.isValidObjectId(id))) {
    return { error: "یک یا چند برند مرتبط نامعتبر است", status: 422 };
  }
  if (relatedBrands.includes(owner)) {
    return {
      error: "برند مالک را نمی‌توان دوباره به‌عنوان برند مرتبط انتخاب کرد",
      status: 422,
    };
  }

  const ids = [owner, ...relatedBrands];
  const existingIds = await Brand.find({ _id: { $in: ids } }).distinct("_id");
  if (existingIds.length !== ids.length) {
    return { error: "یک یا چند برند انتخاب‌شده یافت نشد", status: 422 };
  }

  return { owner, relatedBrands };
}
