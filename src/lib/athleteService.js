import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import Athlete from "base/models/Athlete";
import "base/models/Sport";
import "base/models/Brand";

/**
 * ورزشکاران منتخب (مرد/زن) برای صفحه اصلی.
 * نمونه‌گیری تصادفی است اما برای جلوگیری از کوئری در هر بازدید
 * به مدت کوتاهی کش می‌شود (rotation سبک، سرعت بالا).
 */
export const getShowcaseAthletes = unstable_cache(
  async () => {
    await connectToDB();

    const [men, women] = await Promise.all([
      Athlete.aggregate([{ $match: { gender: "male" } }, { $sample: { size: 5 } }]),
      Athlete.aggregate([{ $match: { gender: "female" } }, { $sample: { size: 5 } }]),
    ]);

    const [populatedMen, populatedWomen] = await Promise.all([
      Athlete.populate(men, [
        { path: "sport", select: "name" },
        { path: "sponsors", select: "name logo" },
      ]),
      Athlete.populate(women, [
        { path: "sport", select: "name" },
        { path: "sponsors", select: "name logo" },
      ]),
    ]);

    return JSON.parse(
      JSON.stringify({ men: populatedMen, women: populatedWomen })
    );
  },
  ["showcase-athletes"],
  { revalidate: 10800, tags: ["athletes"] }
);
