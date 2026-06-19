import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import Sport from "base/models/Sport";

/**
 * اولین ورزش بر اساس ترتیب دستی ادمین (order صعودی) — همان ترتیبی که در
 * API ورزش‌ها (GET /api/sports) و نوبار استفاده می‌شود. برای هدرِ صفحه‌ی
 * محصولات، تصویرِ همین ورزش به‌عنوان تصویر هدر استفاده می‌شود.
 */
export const getFirstSport = unstable_cache(
  async () => {
    await connectToDB();
    const sport = await Sport.findOne().sort({ order: 1 }).lean();
    return sport ? JSON.parse(JSON.stringify(sport)) : null;
  },
  ["first-sport"],
  { revalidate: 600, tags: ["sports"] },
);
