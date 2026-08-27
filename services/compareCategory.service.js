import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Category from "base/models/Category";

export const getCompareCategories = unstable_cache(
  async () => {
    await connectToDB();
    const categories = await Category.find({
      "technicalStats.0": { $exists: true },
    })
      .select("title slug icon image technicalStats sport")
      .populate("sport", "slug title")
      .sort({ order: 1 })
      .lean();

    return categories.map((category) => ({
      _id: category._id.toString(),
      title: category.title,
      slug: category.slug,
      // اسلاگِ دسته فقط درون یک ورزش یکتاست (مثلاً «racket» هم در تنیس هست هم در
      // پدل)، پس هم آدرسِ صفحه و هم عنوانِ کارت باید ورزش را داشته باشند.
      // افزایشی است و چیزی از خروجیِ قبلی کم نمی‌کند.
      sportSlug: category.sport?.slug || null,
      sportTitle: category.sport?.title || null,
      icon: category.icon || null,
      image: category.image || null,
      technicalStats: category.technicalStats || [],
    }));
  },
  ["compare-categories"],
  {
    revalidate: 3600,
    tags: ["categories"],
  },
);
