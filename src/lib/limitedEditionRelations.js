import mongoose from "mongoose";
import Brand from "base/models/Brand";
import {
  escapeRegexLiteral,
  normalizeRelatedBrandIds,
} from "base/utils/limitedEditionRelations";

export { escapeRegexLiteral, normalizeRelatedBrandIds };

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
