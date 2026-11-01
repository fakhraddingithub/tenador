import { cache } from "react";
import { cookies } from "next/headers";
import { verifyToken } from "base/utils/auth";
import { getProductBySlug } from "base/services/product.service";
import { getApprovedReviews } from "base/services/comment.service";
import { getRate } from "base/services/priceEngine";
import { getProductDisplayPrice } from "base/services/productDisplayPrice.service";
import { preloadProductImage } from "./productImageHints";

// React.cache deduplicates metadata + page within one render only. The service's
// existing tagged cache still controls public product invalidation.
export const getProductForPage = cache(async (slug) => {
  const product = await getProductBySlug(slug);
  if (product && !product.error) preloadProductImage(product);
  return product;
});

export async function getProductPricingUser() {
  const token = (await cookies()).get("accessToken")?.value;
  return token ? verifyToken(token) || null : null;
}

export async function getProductPageData(slug) {
  const productPromise = getProductForPage(slug);
  // Start reviews as soon as the product resolves, but never gate the buy box on them.
  const reviewsPromise = productPromise.then(product =>
    product && !product.error ? getApprovedReviews(product._id) : null
  ).then(data => ({ data }), error => {
    console.error("Product reviews unavailable", error);
    return { error: true };
  });
  // Handle rejection immediately while product lookup is pending. A missing
  // product must remain a 404 even when pricing infrastructure is unavailable.
  const inputsPromise = Promise.all([getRate(), getProductPricingUser()])
    .then(([rate, user]) => ({ rate, user }), error => ({ error }));
  const product = await productPromise;
  if (!product || product.error) return { product };
  const inputs = await inputsPromise;
  if (inputs.error) throw inputs.error;
  const { rate, user } = inputs;
  const pricing = await getProductDisplayPrice(product, rate, user);
  return { product, rate, pricing, reviewsPromise, personalized: Boolean(user) };
}
