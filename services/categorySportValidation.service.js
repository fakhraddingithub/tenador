import mongoose from "mongoose";
import Category from "base/models/Category";
import Sport from "base/models/Sport";
import { createSlug } from "base/utils/slugify";
import {
  getCategorySportIds,
  normalizeSportIds,
} from "base/utils/categorySportVisibility";

export class CategorySportValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "CategorySportValidationError";
    this.status = status;
  }
}

/**
 * Validates the sports occupied by a category and detects semantic slug/name
 * collisions across both owner and additional sports. No product is mutated.
 */
export async function validateCategorySportConfiguration({
  sport,
  additionalSports,
  title,
  name,
  slug = null,
  excludeCategoryId = null,
}) {
  if (!sport || !mongoose.isValidObjectId(sport)) {
    throw new CategorySportValidationError(
      "انتخاب ورزش اصلی برای دسته‌بندی الزامی است",
    );
  }

  const normalized = normalizeSportIds(additionalSports);
  if (normalized === null) {
    throw new CategorySportValidationError(
      "فهرست ورزش‌های نمایشی باید آرایه باشد",
    );
  }
  if (normalized.length > 50) {
    throw new CategorySportValidationError(
      "تعداد ورزش‌های نمایشی بیشتر از حد مجاز است",
    );
  }
  if (normalized.some((id) => !mongoose.isValidObjectId(id))) {
    throw new CategorySportValidationError(
      "یکی از ورزش‌های نمایشی معتبر نیست",
    );
  }

  const ownerId = String(sport);
  if (normalized.includes(ownerId)) {
    throw new CategorySportValidationError(
      "ورزش اصلی نباید دوباره در ورزش‌های نمایشی انتخاب شود",
    );
  }

  const occupiedSportIds = [ownerId, ...normalized].map(
    (id) => new mongoose.Types.ObjectId(id),
  );
  const foundSports = await Sport.countDocuments({
    _id: { $in: occupiedSportIds },
  });
  if (foundSports !== occupiedSportIds.length) {
    throw new CategorySportValidationError(
      "یکی از ورزش‌های انتخاب‌شده در سیستم وجود ندارد",
    );
  }

  const normalizedTitle = String(title || "").trim();
  const normalizedName = String(name || "").trim();
  const normalizedSlug = String(slug || createSlug(normalizedName)).trim();
  const identityMatches = [
    normalizedSlug ? { slug: normalizedSlug } : null,
    normalizedTitle ? { title: normalizedTitle } : null,
    normalizedName ? { name: normalizedName } : null,
  ].filter(Boolean);

  if (identityMatches.length > 0) {
    const conflict = await Category.findOne({
      ...(excludeCategoryId ? { _id: { $ne: excludeCategoryId } } : {}),
      $and: [
        {
          $or: [
            { sport: { $in: occupiedSportIds } },
            { additionalSports: { $in: occupiedSportIds } },
          ],
        },
        { $or: identityMatches },
      ],
    })
      .select("_id title slug sport additionalSports")
      .lean();

    if (conflict) {
      throw new CategorySportValidationError(
        `دسته «${conflict.title}» با همین نام یا اسلاگ در یکی از ورزش‌های انتخاب‌شده وجود دارد`,
        409,
      );
    }
  }

  return normalized.map((id) => new mongoose.Types.ObjectId(id));
}

/**
 * Resolves the URL slugs affected by one or more old/new category
 * configurations. This is intentionally called only after admin mutations.
 */
export async function getCategoryVisibilitySportSlugs(...categories) {
  const sportIds = [
    ...new Set(categories.flatMap((category) => getCategorySportIds(category))),
  ].filter((id) => mongoose.isValidObjectId(id));

  if (sportIds.length === 0) return [];

  return Sport.find({ _id: { $in: sportIds } }).distinct("slug");
}
