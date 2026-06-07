import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import Banner from "base/models/Banner";

export const getActiveBanners = unstable_cache(
  async () => {
    await connectToDB();
    const banners = await Banner.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .lean();
    return JSON.parse(JSON.stringify(banners));
  },
  ["active-banners"],
  { revalidate: 3600, tags: ["banners"] }
);
