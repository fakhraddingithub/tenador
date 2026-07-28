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
      .select("title slug icon image technicalStats")
      .sort({ order: 1 })
      .lean();

    return categories.map((category) => ({
      _id: category._id.toString(),
      title: category.title,
      slug: category.slug,
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
