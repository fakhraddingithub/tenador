import { z } from "zod";

export const jobInput = z.object({
  requestKey: z.string().min(8).max(100),
  categoryId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  productId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  rawContent: z.string().min(50).max(60000).optional(),
  sourceUrl: z.string().url().max(2048).optional(),
  imageUrls: z.array(z.string().url().max(2048)).max(6).default([]),
}).refine(v => v.categoryId || v.productId, "دسته یا محصول لازم است")
  .refine(v => v.rawContent || v.sourceUrl, "متن یا لینک مرجع لازم است");

export const reviewSchema = z.object({
  approved: z.boolean(),
  checks: z.object({ facts: z.boolean(), identity: z.boolean(), coherence: z.boolean(), rules: z.boolean(), depth: z.boolean(), images: z.boolean() }).strict(),
  issues: z.array(z.object({ field: z.string(), problem: z.string().min(1), fix: z.string().min(1), requiresInput: z.boolean() })).max(30),
  editorialNotes: z.array(z.string()).max(30),
}).strict();

export function approvedReview(review) {
  return review.approved && Object.values(review.checks).every(Boolean) && review.issues.length === 0;
}
export function permissionsFor(input) {
  return ["products.view", "ai.productDraft", input.productId ? "products.edit" : "products.create"];
}
