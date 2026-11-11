import "base/models/registerModels";
import mongoose from "mongoose";
import sanitizeHtml from "sanitize-html";
import ProductJob from "base/models/ProductJob";
import Variant from "base/models/Variant";
import { buildProductDraftPrompt } from "@/lib/productDraftPrompt";
import { createProduct } from "@/lib/productCreationService";
import { loadRegenerationTarget, previewRegeneration, applyRegeneration } from "@/lib/productRegenerationService";
import { REGENERATED_FIELDS } from "@/lib/productRegeneration";
import { validateProductFields, validateProductVariants } from "@/lib/productVariantValidation";
import { resolveAdminContextForUser } from "@/lib/adminContext";
import { generateJson, getAiProvider } from "@/lib/ai/index";
import { revalidateContent } from "@/lib/revalidate";
import { openAuditScope, activateAuditScope } from "@/lib/adminAuditScope";
import { flushAuditScope } from "@/lib/adminAuditFlush";
import { digest, secret } from "@/lib/mcp/security";
import { downloadPublic, extractSource } from "@/lib/mcp/source";
import { jobInput, analysisSchema, writingSchema, reviewSchema, approvedReview, permissionsFor, publicJob, validateEvidence, assertVariantLimit } from "./policy.js";
import { SYSTEM, ANALYSE, WRITE, REVIEW } from "./prompts.js";
import { uploadJobImage } from "./images.js";

const LEASE_MS = 10 * 60 * 1000;
const fail = (message, questions = []) => Object.assign(new Error(message), { jobPublic: true, questions });
const checked = result => {
  if (result.error) throw fail(typeof result.error === "string" ? result.error : result.error.message);
  return result;
};
function modelEnv(env = process.env) {
  const provider = env.PRODUCT_AI_PROVIDER || env.AI_PROVIDER || "gemini";
  const model = env.PRODUCT_AI_MODEL?.trim();
  if (!model) throw fail("مدل نگارش محصول را در PRODUCT_AI_MODEL تنظیم کنید.");
  return { ...env, AI_PROVIDER: provider, [provider === "openai" ? "OPENAI_MODEL" : "GEMINI_MODEL"]: model };
}
function authorize(ctx, input) {
  if (!ctx?.isAdmin || !ctx.can(permissionsFor(input))) throw fail("دسترسی ساخت یا بازسازی محصول لغو شده یا کافی نیست.");
}
let indexes;
export async function startProductJob(ctx, args) {
  const input = jobInput.parse(args);
  authorize(ctx, input);
  if (!process.env.PRODUCT_JOBS_WORKER_SECRET) throw fail("ورکر محصولات هنوز پیکربندی نشده است.");
  if (!getAiProvider({ env: modelEnv() }).configured) throw fail("کلید سرویس هوش مصنوعی روی سرور تنظیم نشده است.");
  // DB autoIndex is disabled in production. Idempotency requires this index.
  await (indexes ||= ProductJob.createIndexes().catch(e => { indexes = null; throw e; }));
  const requestKey = digest(input.requestKey), inputHash = digest(JSON.stringify(input));
  const filter = { userId: ctx.userId, requestKey };
  let job;
  try {
    job = await ProductJob.findOneAndUpdate(filter, { $setOnInsert: { ...filter, inputHash, input,
      data: { reservedProductId: String(new mongoose.Types.ObjectId()) } } }, { upsert: true, returnDocument: "after" }).lean();
  } catch (e) { if (e.code !== 11000) throw e; job = await ProductJob.findOne(filter).lean(); }
  if (job.inputHash !== inputHash) throw fail("این requestKey قبلاً برای ورودی متفاوت استفاده شده است.");
  return publicJob(job);
}
export async function getProductJob(ctx, jobId) {
  const job = await ProductJob.findOne({ _id: jobId, userId: ctx.userId }).lean();
  if (!job) throw fail("کار پیدا نشد.");
  authorize(ctx, job.input);
  return publicJob(job);
}
export async function resumeProductJob(ctx, jobId, clarification) {
  const job = await ProductJob.findOne({ _id: jobId, userId: ctx.userId }).lean();
  if (!job) throw fail("کار پیدا نشد.");
  authorize(ctx, job.input);
  if (!["needs_input", "failed"].includes(job.status) || job.stage === "commit") throw fail("این کار در وضعیت قابل شروع مجدد نیست.");
  const rawContent = `${job.data.rawContent || job.input.rawContent || ""}\nاطلاعات تکمیلی ادمین:\n${clarification}`;
  if (rawContent.length > 60000) throw fail("متن تکمیلی از سقف مجاز فراتر می‌رود؛ کار تازه‌ای با منبع کوتاه‌تر بسازید.");
  const updated = await ProductJob.findOneAndUpdate({ _id: job._id, status: job.status, updatedAt: job.updatedAt }, {
    $set: { status: "queued", stage: "prepare", "input.rawContent": rawContent, attempts: 0, revisions: 0,
      error: null, questions: [], leaseUntil: new Date(0), nextRunAt: new Date(),
      data: { reservedProductId: job.data.reservedProductId, images: job.data.images || [] } },
    $push: { history: { stage: "clarification", at: new Date() } },
  }, { returnDocument: "after" }).lean();
  if (!updated) throw fail("وضعیت کار تغییر کرد؛ دوباره وضعیت را دریافت کنید.");
  return publicJob(updated);
}

function leaseFilter(job) { return { _id: job._id, lease: job.lease, status: "running", leaseUntil: { $gt: new Date() } }; }
async function checkpoint(job, set, event) {
  const result = await ProductJob.updateOne(leaseFilter(job), { $set: set, ...(event ? { $push: { history: { ...event, at: new Date() } } } : {}) });
  if (!result.matchedCount) throw new Error("JOB_LEASE_LOST");
}
async function next(job, stage, data = {}, event = {}) {
  await checkpoint(job, { ...data, stage, status: "queued", attempts: 0, error: null, leaseUntil: new Date(0), nextRunAt: new Date() }, { stage: job.stage, ...event });
}
const cleanHtml = value => sanitizeHtml(value, {
  allowedTags: ["h2", "h3", "h4", "p", "ul", "ol", "li", "strong", "em", "br", "span"],
  allowedAttributes: { "*": ["style", "dir"] },
  allowedStyles: { "*": { "font-size": [/^\d+(?:px|rem|em)$/], "font-weight": [/^(?:normal|bold|[1-9]00)$/],
    "line-height": [/^[\d.]+$/], margin: [/^[\d .pxrem%\-]+$/], "text-align": [/^(?:right|left|center|justify)$/] } },
});
async function generateStage(job, instruction, payload, schema, writing = false) {
  const env = { ...process.env, PRODUCT_AI_PROVIDER: job.data.provider, PRODUCT_AI_MODEL: job.data.model };
  const result = await generateJson({ system: `${SYSTEM}\n${instruction}`, prompt: JSON.stringify(payload),
    maxTokens: Number(process.env.PRODUCT_AI_MAX_TOKENS) || 16000, timeoutMs: 110000, temperature: writing ? 0.3 : 0.1 }, { env: modelEnv(env) });
  const parsed = schema.safeParse(result.value);
  if (!parsed.success) throw fail("ساختار پاسخ مدل معتبر نبود؛ هیچ محصولی ثبت نشد.");
  return { value: parsed.data, metadata: { provider: result.provider, model: result.model, tokens: result.tokens } };
}
async function targetFor(job) {
  const target = checked(await loadRegenerationTarget(job.input.productId));
  if (target.product.updatedAt.toISOString() !== job.data.originalVersion) throw fail("محصول در طول پردازش تغییر کرده است؛ برای جلوگیری از بازنویسی تغییرات، کار تازه بسازید.");
  const variants = await Variant.find({ productId: target.product._id }).select("attributes price images").sort({ _id: 1 }).lean();
  if (digest(JSON.stringify(variants)) !== digest(JSON.stringify(job.data.variants))) throw fail("واریانت‌ها در طول پردازش تغییر کرده‌اند؛ کار تازه‌ای با اطلاعات جاری بسازید.");
  return target;
}
async function assertCurrentRules(job) {
  const built = checked(await buildProductDraftPrompt({ categoryId: job.data.categoryId, rawContent: job.data.rawContent }));
  if (digest(built.prompt) !== job.data.promptHash) throw fail("قواعد پنل در طول پردازش تغییر کرده‌اند؛ کار را با قواعد جدید دوباره آغاز کنید.");
  return built;
}
async function effectiveProduct(job, draft) {
  if (!job.input.productId) {
    const built = await assertCurrentRules(job);
    const missing = ["name", "shortDescription", "longDescription", "brand", "mainImage"].filter(k => !draft[k]);
    if (missing.length) throw fail("فیلدهای الزامی کامل نیستند.", missing.map(k => `مقدار ${k} را مشخص کنید.`));
    const fields = validateProductFields(built.category, draft);
    const variants = validateProductVariants(built.category.variantAttributes, draft.variantOptions, draft.selectedCombos);
    if (fields.error || variants.error) throw fail("مشخصات محصول برای ثبت معتبر نیستند.", [fields.error, variants.error].filter(Boolean));
    checked(await previewRegeneration({ product: { _id: job.data.reservedProductId, category: built.category._id,
      sport: built.meta.sport.id, attributes: {}, technicalStats: {}, athlete: [], tag: [], customTabItems: [] }, category: built.category, draft }));
    return draft;
  }
  const target = await targetFor(job);
  const { plan } = checked(await previewRegeneration({ ...target, draft }));
  return { ...job.data.original, ...plan.update, variants: job.data.variants };
}
async function importImages(job) {
  if (job.input.productId) return job.data.images || [];
  const selected = job.data.analysis.imageUrls;
  if (!selected.length) throw fail("تصویر قابل تطبیق با محصول پیدا نشد.", ["لینک مستقیم تصویر همین مدل را مشخص کنید و کار جدیدی بسازید."]);
  const images = [...(job.data.images || [])];
  // Two bounded upload lanes run alongside writing; six images take at most
  // three download/upload rounds. Completed uploads survive stage retries.
  const pending = selected.filter(url => !images.some(i => i.sourceUrl === url));
  const lane = async () => { while (pending.length) {
    const url = pending.shift();
    if (images.some(i => i.sourceUrl === url)) continue;
    const fetched = await downloadPublic(url, { image: true, maxBytes: 5 * 1024 * 1024 });
    const uploaded = await uploadJobImage({ ...fetched, fileName: `job-${job._id}-${digest(url).slice(0, 12)}.${fetched.mime.split("/")[1]}` });
    const image = { sourceUrl: url, url: uploaded.url, fileId: uploaded.fileId };
    const saved = await ProductJob.updateOne(leaseFilter(job), { $push: { "data.images": image } });
    if (!saved.matchedCount) throw new Error("JOB_LEASE_LOST");
    images.push(image);
  } };
  const outcomes = await Promise.allSettled([lane(), lane()]);
  const failed = outcomes.find(r => r.status === "rejected");
  if (failed) throw failed.reason;
  return selected.map(url => images.find(i => i.sourceUrl === url));
}

async function execute(job) {
  if (job.stage === "prepare") {
    const target = job.input.productId ? checked(await loadRegenerationTarget(job.input.productId)) : null;
    const categoryId = target ? String(target.category._id) : job.input.categoryId;
    let source = null;
    if (job.input.sourceUrl) {
      const fetched = await downloadPublic(job.input.sourceUrl);
      source = extractSource(fetched.buffer.toString("utf8"), fetched.url);
    }
    if (source?.truncated && !job.input.rawContent) throw fail("منبع بیش از حد طولانی است؛ متن اختصاصی محصول لازم است.", ["متن کامل بخش همین محصول را ارسال کنید."]);
    const rawContent = job.input.rawContent || source?.rawContent;
    const built = checked(await buildProductDraftPrompt({ categoryId, rawContent }));
    const provider = getAiProvider({ env: modelEnv() });
    const original = target ? Object.fromEntries([...Object.keys(REGENERATED_FIELDS), "_id", "category", "sport", "mainImage", "gallery", "variantMeta"].map(k => [k, target.product[k]])) : null;
    const variants = target ? await Variant.find({ productId: target.product._id }).select("attributes price images").sort({ _id: 1 }).lean() : [];
    await next(job, "analyse", { "data.categoryId": categoryId, "data.sportId": built.meta.sport.id,
      "data.rawContent": rawContent, "data.prompt": built.prompt, "data.writingPrompt": built.writingPrompt,
      "data.promptHash": digest(built.prompt), "data.original": original,
      "data.originalVersion": target?.product.updatedAt?.toISOString(), "data.variants": variants,
      "data.candidates": [...new Set([...job.input.imageUrls, ...(source?.images || [])])],
      "data.provider": provider.name, "data.model": provider.model,
    });
  } else if (job.stage === "analyse") {
    const result = await generateStage(job, ANALYSE, { adminPrompt: job.data.prompt, original: job.data.original,
      preservedVariants: job.data.variants, imageCandidates: job.data.candidates }, analysisSchema);
    const analysis = result.value;
    if (analysis.missing.length) throw fail("اطلاعات لازم برای تولید قابل اعتماد کامل نیست.", analysis.missing);
    if (!validateEvidence(analysis.facts, job.data.rawContent)) throw fail("مدرک استخراج‌شده با متن مرجع تطبیق ندارد.");
    if (analysis.imageUrls.some(url => !job.data.candidates.includes(url))) throw fail("مدل تصویر خارج از منبع انتخاب کرده است.");
    let draft = { ...analysis.draft, category: job.data.categoryId, sport: job.data.sportId };
    // No generated URLs or arbitrary metadata can reach persistence.
    for (const key of ["mainImage", "gallery", "variantMeta", "variants", "_id", "sku", "isActive"]) delete draft[key];
    if (job.input.productId) {
      draft = Object.fromEntries(Object.entries(draft).filter(([k]) => Object.hasOwn(REGENERATED_FIELDS, k) || ["category", "sport"].includes(k)));
      draft.basePrice = job.data.original.basePrice;
      analysis.imageUrls = [];
    } else {
      assertVariantLimit(draft);
      for (const detail of Object.values(draft.variantDetails || {})) { if (detail && typeof detail === "object") detail.images = []; }
    }
    analysis.draft = draft;
    await next(job, "write", { "data.analysis": analysis }, { ...result.metadata, output: analysis });
  } else if (job.stage === "write" || job.stage === "revise") {
    const write = async () => {
      if (job.data.writing && job.data.writingRevision === job.revisions) return { value: job.data.writing, metadata: { reused: true } };
      const result = await generateStage(job, WRITE, { adminRules: job.data.writingPrompt,
        source: job.data.rawContent, canonicalRecord: job.data.analysis.draft, evidence: job.data.analysis.facts,
        original: job.data.original, preservedVariants: job.data.variants,
        previous: job.data.writing, feedback: job.data.review?.issues || [] }, writingSchema, true);
      result.value = { shortDescription: cleanHtml(result.value.shortDescription), longDescription: cleanHtml(result.value.longDescription) };
      writingSchema.parse(result.value);
      await checkpoint(job, { "data.writing": result.value, "data.writingRevision": job.revisions }, { stage: "writing-output", ...result.metadata, output: result.value });
      return result;
    };
    const [written, uploaded] = await Promise.allSettled([write(), importImages(job)]);
    if (written.status === "rejected") throw written.reason;
    if (uploaded.status === "rejected") throw uploaded.reason;
    const draft = { ...job.data.analysis.draft, ...written.value.value };
    if (!job.input.productId) {
      draft.mainImage = uploaded.value[0].url; draft.gallery = uploaded.value.slice(1).map(i => i.url);
      draft.isActive = false; draft.variantMeta = {};
    }
    await next(job, "review", { "data.draft": draft }, written.value.metadata);
  } else if (job.stage === "review") {
    await assertCurrentRules(job);
    const effective = await effectiveProduct(job, job.data.draft);
    const result = await generateStage(job, REVIEW, { adminPrompt: job.data.prompt, effectiveProduct: effective,
      facts: job.data.analysis.facts, selectedImages: job.data.images || [],
      imageCandidates: job.data.candidates, mode: job.input.productId ? "regenerate" : "create" }, reviewSchema);
    const review = result.value;
    await checkpoint(job, { "data.review": review }, { stage: "review-output", ...result.metadata, output: review });
    if (approvedReview(review)) await next(job, "commit", { "data.approvedHash": digest(JSON.stringify(job.data.draft)) }, result.metadata);
    else if (review.issues.some(i => i.requiresInput || !["shortDescription", "longDescription"].includes(i.field))) {
      throw fail("بازبین ناسازگاری اطلاعات پیدا کرد؛ محصول ذخیره نشد.", review.issues.map(i => `${i.field}: ${i.problem} — ${i.fix}`));
    } else if (job.revisions >= 2 || !review.issues.length) {
      throw fail("متن پس از بازبینی به کیفیت لازم نرسید؛ محصول ذخیره نشد.", review.issues.map(i => i.problem));
    } else await next(job, "revise", { revisions: job.revisions + 1 }, result.metadata);
  } else if (job.stage === "commit") {
    const built = await assertCurrentRules(job);
    if (!approvedReview(job.data.review) || digest(JSON.stringify(job.data.draft)) !== job.data.approvedHash) throw fail("نسخهٔ تأییدشده با محصول نهایی یکسان نیست.");
    const ctx = await resolveAdminContextForUser(job.userId); authorize(ctx, job.input);
    const onCommitted = async (session, product) => {
      const result = await ProductJob.updateOne(leaseFilter(job), { $set: { status: "completed", leaseUntil: new Date(0),
        result: { productId: String(product._id), slug: product.slug, isActive: product.isActive, saved: true } },
        $push: { history: { stage: "commit", at: new Date() } } }, { session });
      if (!result.matchedCount) throw new Error("JOB_LEASE_LOST");
    };
    if (job.input.productId) {
      const target = await targetFor(job);
      const planned = checked(await previewRegeneration({ ...target, draft: job.data.draft }));
      checked(await applyRegeneration({ ...planned, productId: job.input.productId, expectedUpdatedAt: job.data.originalVersion, onCommitted }));
      revalidateContent(["products", "navbar"]);
    } else {
      const draft = job.data.draft;
      assertVariantLimit(draft);
      checked(await previewRegeneration({ product: { _id: job.data.reservedProductId, category: built.category._id,
        sport: built.meta.sport.id, attributes: {}, technicalStats: {}, athlete: [], tag: [], customTabItems: [] }, category: built.category, draft }));
      const response = await createProduct(draft, { reservedProductId: job.data.reservedProductId, onCommitted });
      if (!response.ok) throw fail("اعتبارسنجی نهایی محصول رد شد؛ مشخصات و فیلدهای الزامی را بررسی کنید.");
    }
  }
}

// One bounded stage per HTTP invocation. The durable worker calls this until idle.
export async function runProductJobStage() {
  const scope = openAuditScope();
  const now = new Date();
  const job = await ProductJob.findOneAndUpdate({ status: { $in: ["queued", "running"] }, nextRunAt: { $lte: now }, leaseUntil: { $lte: now } },
    { $set: { status: "running", lease: secret(), leaseUntil: new Date(Date.now() + LEASE_MS) }, $inc: { attempts: 1 } },
    { sort: { nextRunAt: 1, createdAt: 1 }, returnDocument: "after" }).lean();
  if (!job) return { idle: true };
  try {
    const ctx = await resolveAdminContextForUser(job.userId); authorize(ctx, job.input);
    activateAuditScope(scope, { ctx, permissions: permissionsFor(job.input) });
    if (job.attempts > 3) throw fail("این مرحله چند بار قطع شد؛ کار متوقف شد تا هزینه و اجرای تکراری ایجاد نشود.");
    await execute(job);
  } catch (error) {
    const retry = !error.jobPublic && job.attempts < 3;
    await ProductJob.updateOne(leaseFilter(job), { $set: {
      status: retry ? "queued" : error.questions?.length ? "needs_input" : "failed",
      error: error.jobPublic ? error.message : "اجرای مرحله کامل نشد؛ تنظیمات مدل، شبکه و سرویس تصویر را بررسی کنید.",
      questions: error.questions || [], leaseUntil: new Date(0), nextRunAt: new Date(Date.now() + 30000),
    } });
  } finally { await flushAuditScope(scope); }
  return { idle: false, jobId: String(job._id) };
}
