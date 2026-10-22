import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Comment from "base/models/Comment";
import { getUserFullName } from "base/utils/userName";
import { matchesSearch, rankBySearch } from "@/lib/search";

// status منبع حقیقت است؛ approved:true بدونِ status نظرهای قدیمی‌اند (هرگز رد نشده‌اند).
const APPROVED = { $or: [{ status: "approved" }, { status: { $exists: false }, approved: true }] };

/**
 * شکلِ کارتِ نظر (UsedProductReviewCard) — یک جا، برای صفحه‌ی دست‌دوم و بلوکِ
 * «اسلایدر نظرات». نظرِ محصولِ نو و دست‌دوم هر دو به همین شکل درمی‌آیند؛ فقط
 * مقصدِ پیوند و تصویرِ محصول از مدلِ خودشان می‌آید.
 */
function toReviewCard(comment) {
  const used = comment.usedProduct;
  const product = used
    ? { id: String(used._id), name: used.name, slug: used.slug || null, image: used.images?.[0] || null }
    : { id: String(comment.product._id), name: comment.product.name, slug: comment.product.slug || null, image: comment.product.mainImage || null, href: comment.product.slug ? `/products/${comment.product.slug}` : "/products" };
  return {
    id: String(comment._id),
    author: getUserFullName(comment.user, "کاربر تنادور"),
    avatar: comment.user?.avatar || null,
    text: comment.text,
    rating: comment.rating || 0,
    images: Array.isArray(comment.images) ? comment.images.slice(0, 4) : [],
    isVerifiedPurchase: !!comment.isVerifiedPurchase,
    createdAt: comment.createdAt,
    product,
  };
}

const withReviewRefs = (query) => query
  .populate("user", "name lastName avatar")
  .populate("usedProduct", "name slug images")
  .populate("product", "name slug mainImage");

// محصولِ حذف‌شده populate را null می‌کند؛ چنین نظری کارتی برای نمایش ندارد.
const hasProduct = (comment) => comment.usedProduct || comment.product;

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

    return docs.filter((comment) => comment.usedProduct).map(toReviewCard);
  },
  ["approved-used-product-reviews"],
  { revalidate: 10800, tags: ["comments"] }
);

/**
 * نظرهای انتخاب‌شده برای بلوکِ «اسلایدر نظرات»، به ترتیبِ انتخابِ ادمین.
 * فقط نظرِ سطح‌بالای تأییدشده — نظری که بعداً رد یا حذف شد، یا محصولش دیگر
 * نیست، بی‌صدا کنار می‌رود.
 */
export async function getReviewCardsByIds(ids = []) {
  const wanted = ids.map(String).filter((id) => /^[a-f\d]{24}$/i.test(id));
  if (!wanted.length) return [];
  await connectToDB();
  const docs = await withReviewRefs(Comment.find({ _id: { $in: wanted }, parent: null, ...APPROVED })).lean();
  const byId = new Map(docs.filter(hasProduct).map((comment) => [String(comment._id), toReviewCard(comment)]));
  return wanted.map((id) => byId.get(id)).filter(Boolean);
}

/**
 * جستجوی نظرهای تأییدشده‌ی محصولِ نو و دست‌دوم برای انتخاب در پنل (متن، نامِ
 * نویسنده یا نامِ محصول). بدونِ عبارت، تازه‌ترین‌ها.
 * ponytail: روی تازه‌ترین ۵۰۰ نظر جستجو می‌کند؛ اگر نظرها خیلی بیشتر شد، جستجوی متنی در خودِ کوئری.
 */
export async function searchReviewCards(q = "", limit = 50) {
  await connectToDB();
  const docs = await withReviewRefs(Comment.find({ parent: null, ...APPROVED }).sort({ createdAt: -1 }).limit(500)).lean();
  const cards = docs.filter(hasProduct).map(toReviewCard);
  if (!q) return cards.slice(0, limit);
  const hits = cards.filter((card) => matchesSearch(q, `${card.text} ${card.author} ${card.product.name}`));
  return rankBySearch(q, hits, (card) => [[card.product.name, 2], [card.author, 2], [card.text, 1]]).slice(0, limit);
}
