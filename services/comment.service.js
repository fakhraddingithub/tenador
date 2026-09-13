import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Comment from "base/models/Comment";
import { getUserFullName } from "base/utils/userName";

/**
 * نظرهای تأییدشده‌ی یک محصول + خلاصه‌ی امتیاز.
 *
 * نظرهای سطح‌بالا (parent === null) برگردانده می‌شوند و پاسخ‌های تأییدشده‌ی هر
 * نظر زیرِ خودش در `replies` می‌آیند. پاسخی که والدش تأییدشده نیست (رد شده،
 * در انتظار، یا حذف شده) اصلاً برنمی‌گردد — نه به‌عنوان نظرِ مستقل و نه به‌عنوان
 * پاسخِ یتیم. آمار امتیاز فقط از نظرهای سطح‌بالا حساب می‌شود.
 * با unstable_cache و تگ «comments» کش می‌شود؛ پس از تأیید/رد/حذف در پنل ادمین
 * این تگ با revalidateContent باطل می‌شود.
 */
export const getApprovedReviews = unstable_cache(
  async (productId) => {
    if (!productId) return { reviews: [], stats: { count: 0, average: 0 } };

    await connectToDB();

    // status منبع حقیقت است؛ $or فقط برای سازگاری با نظرهای قدیمی‌ای که پیش از
    // افزوده‌شدن فیلد status صرفاً approved:true داشتند (هرگز رد نشده‌اند)
    // یک کوئری برای نظرها و پاسخ‌ها با هم؛ تفکیک در حافظه انجام می‌شود تا
    // رفت‌وبرگشتِ دومی به دیتابیس لازم نباشد.
    const docs = await Comment.find({
      product: productId,
      $or: [{ status: "approved" }, { status: { $exists: false }, approved: true }],
    })
      .populate("user", "name lastName avatar")
      .sort({ createdAt: -1 })
      .lean();

    const shape = (c) => ({
      id: String(c._id),
      author: getUserFullName(c.user, "\u06a9\u0627\u0631\u0628\u0631 \u062a\u0646\u0627\u062f\u0648\u0631"),
      avatar: c.user?.avatar || null,
      text: c.text,
      rating: c.rating || 0,
      images: Array.isArray(c.images) ? c.images.slice(0, 4) : [],
      isVerifiedPurchase: !!c.isVerifiedPurchase,
      createdAt: c.createdAt,
    });

    const reviews = docs
      .filter((c) => !c.parent)
      .map((c) => ({ ...shape(c), replies: [] }));

    const byId = new Map(reviews.map((r) => [r.id, r]));
    for (const c of docs) {
      if (!c.parent) continue;
      // والدِ ناموجود یا تأییدنشده → پاسخ اصلاً نمایش داده نمی‌شود؛ هیچ پاسخی
      // نمی‌تواند به نظرِ مستقل تبدیل شود.
      byId.get(String(c.parent))?.replies.push(shape(c));
    }
    // پاسخ‌ها برخلافِ نظرها قدیمی‌به‌جدید خوانده می‌شوند (ترتیبِ گفت‌وگو)
    for (const review of reviews) review.replies.reverse();

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

/**
 * تازه‌ترین تجربه‌های تأییدشده‌ی خریداران محصولات دست دوم برای صفحه‌ی بازار.
 */
export const getApprovedUsedProductReviews = unstable_cache(
  async (limit = 12) => {
    await connectToDB();

    const safeLimit = Math.min(24, Math.max(1, Number(limit) || 12));
    const docs = await Comment.find({
      usedProduct: { $ne: null },
      parent: null,
      status: "approved",
      isVerifiedPurchase: true,
    })
      .populate("user", "name lastName avatar")
      .populate("usedProduct", "name slug images")
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean();

    return docs
      .filter((comment) => comment.usedProduct)
      .map((comment) => ({
        id: String(comment._id),
        author: getUserFullName(comment.user, "کاربر تنادور"),
        avatar: comment.user?.avatar || null,
        text: comment.text,
        rating: comment.rating || 0,
        images: Array.isArray(comment.images) ? comment.images.slice(0, 4) : [],
        createdAt: comment.createdAt,
        product: {
          id: String(comment.usedProduct._id),
          name: comment.usedProduct.name,
          slug: comment.usedProduct.slug || null,
          image: comment.usedProduct.images?.[0] || null,
        },
      }));
  },
  ["approved-used-product-reviews"],
  { revalidate: 10800, tags: ["comments"] }
);
