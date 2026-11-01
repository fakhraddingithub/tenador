import ProductReviews from "./ProductReviews";
import ReviewForm from "@/components/reviews/ReviewForm";
import { generateProductSchema } from "@/lib/seo/productSchema";

export function ReviewsLoading() {
  return <div role="status" className="min-h-[300px] rounded-[6px] bg-gray-50 p-6 text-sm text-gray-500">در حال دریافت نظرات…</div>;
}

export async function ProductReviewCount({ reviewsPromise, className = "rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-gray-500" }) {
  const result = await reviewsPromise;
  const count = result.data?.stats?.count;
  return count > 0 ? <span className={className}>{count.toLocaleString("fa-IR")}</span> : null;
}

export async function ProductReviewsContent({ productId, reviewsPromise }) {
  const result = await reviewsPromise;
  if (result.error) return <div role="status" className="min-h-[300px] p-6 text-sm text-gray-500">دریافت نظرات ممکن نشد. لطفاً صفحه را دوباره بارگذاری کنید.</div>;
  return <div className="space-y-6 px-2">
    <ReviewForm productId={productId} />
    <ProductReviews productId={productId} reviews={result.data.reviews} stats={result.data.stats} />
  </div>;
}

export async function ProductSchemaWithReviews({ product, reviewsPromise, publicPricePromise }) {
  const [result, pricing] = await Promise.all([reviewsPromise, publicPricePromise]);
  const schema = generateProductSchema({ ...product, finalPriceToman: pricing.finalPriceToman }, result.data?.stats);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />;
}
