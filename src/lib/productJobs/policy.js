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

export const analysisSchema = z.object({
  draft: z.record(z.string(), z.unknown()),
  facts: z.array(z.object({ field: z.string(), value: z.string(), evidence: z.string().min(8) })).min(1).max(150),
  missing: z.array(z.string().min(1)).max(20),
  imageUrls: z.array(z.string().url()).max(6),
});
export const writingSchema = z.object({
  shortDescription: z.string().min(10).max(30000),
  longDescription: z.string().min(30).max(150000),
}).strict();
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
export function publicJob(job) {
  return {
    jobId: String(job._id), status: job.status, stage: job.stage,
    updatedAt: job.updatedAt, questions: job.questions || [], error: job.error || null,
    errorCode: job.errorCode || null, attempts: job.attempts,
    nextRunAt: job.status === "queued" ? job.nextRunAt : null,
    result: job.result || null, revisions: job.revisions,
    editorialNotes: job.data?.review?.editorialNotes || [],
    stages: (job.history || []).map(({ stage, at, provider, model }) => ({ stage, at, provider, model })),
    pollAfterSeconds: ["queued", "running"].includes(job.status) ? 15 : null,
    warning: job.status === "queued" && Date.now() - new Date(job.updatedAt).getTime() > 120000
      ? "کار هنوز در صف است؛ فعال بودن worker:products و دسترسی آن به سرور را بررسی کنید." : null,
  };
}
export function validateEvidence(facts, rawContent) {
  const normalize = s => s.replace(/\s+/g, " ").trim();
  return facts.every(f => normalize(rawContent).includes(normalize(f.evidence)));
}
export function assertVariantLimit(draft) {
  let count = 1;
  for (const values of Object.values(draft.variantOptions || {})) {
    if (!Array.isArray(values) || values.length > 100) throw new Error("INVALID_VARIANTS");
    count *= Math.max(1, values.length);
    if (count > 500) throw new Error("TOO_MANY_VARIANTS");
  }
}
