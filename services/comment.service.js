import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Comment from "base/models/Comment";
import { getUserFullName } from "base/utils/userName";

/**
 * نظرهای تأییدشده‌ی یک محصول + خلاصه‌ی امتیاز.
 *
 * فقط نظرهای سطح‌بالا (parent === null) با وضعیت «approved» برگردانده می‌شوند.
 * با unstable_cache و تگ «comments» کش می‌شود؛ پس از تأیید/رد/حذف در پنل ادمین
 * این تگ با revalidateContent باطل می‌شود.
 */
export const getApprovedReviews = unstable_cache(
  async (productId) => {
    if (!productId) return { reviews: [], stats: { count: 0, average: 0 } };

    await connectToDB();

    // status منبع حقیقت است؛ $or فقط برای سازگاری با نظرهای قدیمی‌ای که پیش از
    // افزوده‌شدن فیلد status صرفاً approved:true داشتند (هرگز رد نشده‌اند)
    const docs = await Comment.find({
      product: productId,
      parent: null,
      $or: [{ status: "approved" }, { status: { $exists: false }, approved: true }],
    })
      .populate("user", "name lastName avatar")
      .sort({ createdAt: -1 })
      .lean();

    const reviews = docs.map((c) => ({
      id: String(c._id),
      author: getUserFullName(c.user, "\u06a9\u0627\u0631\u0628\u0631 \u062a\u0646\u0627\u062f\u0648\u0631"),
      avatar: c.user?.avatar || null,
      text: c.text,
      rating: c.rating || 0,
      isVerifiedPurchase: !!c.isVerifiedPurchase,
      createdAt: c.createdAt,
    }));

    const rated = reviews.filter((r) => r.rating > 0);
    const average =
      rated.length > 0
        ? rated.reduce((sum, r) => sum + r.rating, 0) / rated.length
        : 0;

    return {
      reviews,
      stats: {
        count: reviews.length,
        ratedCount: rated.length,
        average: Math.round(average * 10) / 10,
      },
    };
  },
  ["approved-reviews"],
  { revalidate: 10800, tags: ["comments"] }
);
