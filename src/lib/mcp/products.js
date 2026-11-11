import "base/models/registerModels";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import ImageKit from "imagekit";
import Product from "base/models/Product";
import Category from "base/models/Category";
import McpGrant from "base/models/McpGrant";
import ProductJob from "base/models/ProductJob";
import Variant from "base/models/Variant";
import { CHAT_WORKFLOW, normalizeDraftHtml } from "./chatWorkflow.js";
import { reviewSchema, approvedReview } from "@/lib/productJobs/policy";
import { buildProductDraftPrompt } from "@/lib/productDraftPrompt";
import { createProduct } from "@/lib/productCreationService";
import { parseRegenerationDraft, REGENERATED_FIELDS } from "@/lib/productRegeneration";
import { loadRegenerationTarget, previewRegeneration, applyRegeneration } from "@/lib/productRegenerationService";
import { revalidateContent } from "@/lib/revalidate";
import { consumeAssistantQuota } from "@/lib/assistant/quota";
import { openAuditScope, activateAuditScope } from "@/lib/adminAuditScope";
import { flushAuditScope } from "@/lib/adminAuditFlush";
import { config, digest, secret } from "./security.js";
import { downloadPublic, extractSource } from "./source.js";

const id = z.string().regex(/^[a-f\d]{24}$/i);
const preparationId = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const json = z.string().min(2).max(500000);
const output = value => ({ content: [{ type: "text", text: JSON.stringify(value) }] });
// Only the admin rules and the category decide whether a preparation is stale. The full prompt
// also lists every brand, serie, athlete and edition, so hashing it let any unrelated catalog edit
// invalidate every open preparation; references are validated again at save anyway.
const rulesHash = built => digest(built.rulesPrompt);
// The source is already returned once as `rawContent`; the prompt points at it instead of carrying a second copy.
const SOURCE_MARKER = "[SOURCE TEXT: identical to the rawContent field of this preparation; read it there, unchanged.]";
const withoutSource = (prompt, rawContent) => {
  const source = rawContent.trim(), at = prompt.lastIndexOf(source);
  return at < 0 ? prompt : prompt.slice(0, at) + SOURCE_MARKER + prompt.slice(at + source.length);
};
// Reads only touch Tenador's database; writes and anything that fetches the open web share the tighter budget.
const QUOTA = {
  read: { scope: "mcp-read:", perMinute: 60, perDay: 1000 },
  write: { scope: "mcp:", perMinute: 20, perDay: 300 },
};
const safeProduct = p => Object.fromEntries([...Object.keys(REGENERATED_FIELDS), "_id", "slug", "category", "sport", "mainImage", "gallery", "variantMeta", "updatedAt", "isActive"].map(k => [k, p[k]]));

export function productServer(ctx) {
  const server = new McpServer({ name: "tenador-products", version: "3.0.0" }, {
    instructions: "Tenador product authoring runs in Codex with native subagents. Start every create/regenerate request with start_product_job and follow preparation.workflow exactly; it is the authoritative workflow.",
  });
  // Hints tell the host which calls need the user's confirmation. Only overwriting an existing
  // product is destructive; creation is inactive and idempotent, bookkeeping writes are internal.
  const register = (name, description, inputSchema, permissions, write, fn, hints = {}) => server.registerTool(name, {
    description, inputSchema,
    annotations: { readOnlyHint: !write, destructiveHint: false, idempotentHint: true, openWorldHint: false, ...hints },
    _meta: { securitySchemes: [{ type: "oauth2", scopes: ["products"] }] },
  }, async args => {
    if (!ctx) return {
      ...output({ error: "برای استفاده از تنادور ابتدا حساب ادمین خود را متصل کنید." }),
      isError: true,
      _meta: { "mcp/www_authenticate": [
        `Bearer resource_metadata="${config().origin}/.well-known/oauth-protected-resource/api/mcp", error="insufficient_scope", error_description="Connect your Tenador admin account to continue", scope="products"`,
      ] },
    };
    const scope = openAuditScope();
    try {
      if (!ctx.isAdmin || !ctx.can(permissions)) return { ...output({ error: "دسترسی لازم برای این ابزار را ندارید" }), isError: true };
      if (write) activateAuditScope(scope, { ctx, permissions: [permissions].flat() });
      await consumeAssistantQuota(ctx.userId, Date.now(), { ...QUOTA[write || hints.openWorldHint ? "write" : "read"], message: "سقف درخواست‌های MCP رسیده است؛ کمی بعد دوباره تلاش کنید." });
      return output(await fn(args));
    } catch (error) {
      // Do not expose database/SDK messages, credentials, or stack traces.
      return { ...output({ error: error.status === 429 ? "سقف درخواست‌های MCP رسیده است؛ کمی بعد دوباره تلاش کنید." : error.mcpPublic || error.jobPublic ? error.message : "عملیات انجام نشد؛ ورودی‌ها، دسترسی و وضعیت اتصال را بررسی کنید." }), isError: true };
    } finally { if (write) await flushAuditScope(scope); }
  });
  const publicError = message => { const e = new Error(message); e.mcpPublic = true; throw e; };
  // Sliding expiry: a long analyse → write → review loop stays alive while it keeps using the preparation.
  const prep = async key => {
    const record = await McpGrant.findOneAndUpdate({ key: digest(key), kind: "preparation", userId: ctx.userId, expiresAt: { $gt: new Date() } },
      { $set: { expiresAt: new Date(Date.now() + 3600000) } }, { returnDocument: "after" }).lean();
    if (!record) publicError("آماده‌سازی منقضی شده؛ همان کار را با resume_product_job و بدون clarification تمدید کنید؛ کار تازه نسازید.");
    return record;
  };
  const checkedPublic = value => { if (value.error) publicError(typeof value.error === "string" ? value.error : value.error.message); return value; };
  const parsePublic = value => checkedPublic(parseRegenerationDraft(value)).draft;

  register("start_product_job", "آماده‌سازی پایدار برای ایجنت‌های داخل Codex؛ هیچ مدل یا ورکری روی سرور اجرا نمی‌شود. preparation.workflow را با زیرایجنت‌های واقعی اجرا کنید. requestKey ثابت بماند؛ awaiting_chat منتظر کار شماست نه صف سرور.", {
    requestKey: z.string().min(8).max(100), categoryId: id.optional(), productId: id.optional(),
    rawContent: z.string().min(50).max(60000).optional(), sourceUrl: z.string().url().max(2048).optional(),
    imageUrls: z.array(z.string().url().max(2048)).max(6).optional(),
  }, ["products.view", "ai.productDraft"], true, async args => (await import("@/lib/productJobs/service")).startProductJob(ctx, args, prepareProduct), { openWorldHint: true });
  register("get_product_job", "اطلاعات کار و نتیجه ذخیره‌سازی را برمی‌گرداند. awaiting_chat یعنی ایجنت‌های Codex باید کار کنند؛ ورکر یا مدل سروری وجود ندارد. برای ثبت موفق result.saved لازم است.",
    { jobId: id }, ["products.view", "ai.productDraft"], false, async args => (await import("@/lib/productJobs/service")).getProductJob(ctx, args.jobId));
  register("resume_product_job", "همان کار را برای ادامه داخل Codex بازیابی یا تمدید می‌کند؛ بدون clarification منبع تغییر نمی‌کند. فقط پاسخ واقعی کاربر را در clarification بدهید. کار تکمیل‌شده دوباره اجرا نمی‌شود.",
    { jobId: id, clarification: z.string().min(10).max(10000).optional() }, ["products.view", "ai.productDraft"], true,
    async args => (await import("@/lib/productJobs/service")).resumeProductJob(ctx, args.jobId, args.clarification, prepareProduct), { openWorldHint: true });

  register("list_product_categories", "فهرست دسته‌ها به همراه ورزش؛ دستهٔ مناسب محصول را انتخاب کنید.", { query: z.string().max(100).optional(), offset: z.number().int().min(0).default(0) }, "products.view", false, async ({ query, offset }) => {
    const filter = query ? { $or: ["name", "title"].map(k => ({ [k]: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } })) } : {};
    return { categories: await Category.find(filter).select("name title sport").populate("sport", "name title").sort({ _id: 1 }).skip(offset).limit(50).lean(), nextOffset: offset + 50 };
  });
  register("search_products", "جستجوی محصول موجود برای بازسازی؛ نام یا بخشی از نام را بدهید.", { query: z.string().min(1).max(100) }, "products.view", false, async ({ query }) => ({
    products: await Product.find({ name: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }).select("name slug category updatedAt isActive").limit(20).lean(),
  }));
  const prepareProduct = async (args, job = {}) => {
    let categoryId = args.categoryId, original = null;
    if (args.productId) {
      const target = checkedPublic(await loadRegenerationTarget(args.productId));
      categoryId = String(target.category._id); original = safeProduct(target.product);
      original.variants = await Variant.find({ productId: args.productId }).select("attributes price images").sort({ _id: 1 }).lean();
    }
    if (!categoryId || (!args.rawContent && !args.sourceUrl)) publicError("دسته یا محصول و متن یا لینک مرجع لازم است.");
    let source = null;
    if (args.sourceUrl) {
      try { const fetched = await downloadPublic(args.sourceUrl); source = extractSource(fetched.buffer.toString("utf8"), fetched.url); }
      catch { if (!args.rawContent) publicError("دریافت صفحهٔ مرجع ممکن نشد؛ متن محصول را با rawContent ارسال کنید."); }
    }
    const rawContent = (args.rawContent || source.rawContent) + (args.clarification ? `\nاطلاعات تکمیلی ادمین:\n${args.clarification}` : "");
    if (rawContent.length > 60000) publicError("متن از سقف ۶۰۰۰۰ نویسه بیشتر است.");
    const built = checkedPublic(await buildProductDraftPrompt({ categoryId, rawContent }));
    const key = job.key || secret();
    // A job keeps one preparation key for its whole life. Re-preparing it keeps the imported
    // images; the review survives only when nothing it judged (rules, source, original) changed.
    const fields = { categoryId, productId: args.productId || null, rawContent, promptHash: rulesHash(built),
      jobId: job.jobId, reservedProductId: job.reservedProductId, preparationKey: key,
      originalVersion: original?.updatedAt, variantsHash: original ? digest(JSON.stringify(original.variants)) : null };
    const stateHash = digest(JSON.stringify(fields)), expiresAt = new Date(Date.now() + 3600000);
    const old = await McpGrant.findOne({ key: digest(key), kind: "preparation", userId: ctx.userId }).lean();
    if (!old) {
      const images = [...new Map((job.images || []).map(i => [i.sourceUrl || i.url, i])).values()];
      await McpGrant.create({ key: digest(key), kind: "preparation", userId: ctx.userId, expiresAt, data: { ...fields, stateHash, images, requiresReview: true } });
    } else if (old.data.stateHash === stateHash) await McpGrant.updateOne({ _id: old._id }, { $set: { expiresAt } });
    else await McpGrant.updateOne({ _id: old._id }, {
      $set: { expiresAt, "data.stateHash": stateHash, ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [`data.${k}`, v])) },
      $unset: { "data.reviewHash": 1, "data.review": 1, "data.reviewAgents": 1, "data.previewHash": 1, "data.previewVersion": 1 } });
    return { preparationId: key, executionMode: "codex_agents", workflow: CHAT_WORKFLOW,
      prompt: withoutSource(built.prompt, rawContent), writingPrompt: built.writingPrompt, rawContent, meta: built.meta, original,
      imageCandidates: [...new Set([...(args.imageUrls || []), ...(source?.images || [])])], sourceWarning: source?.warning,
      truncated: source?.truncated || false, expiresIn: 3600 };
  };
  register("import_product_images", "تصاویر انتخاب‌شدهٔ همان محصول مرجع را دانلود و در ImageKit آپلود می‌کند؛ URLهای خروجی را در mainImage/gallery به کار ببرید. هر بار حداکثر ۶ تصویر.", {
    preparationId, urls: z.array(z.string().url().max(2048)).min(1).max(6),
  }, "ai.productDraft", true, async args => {
    const record = await prep(args.preparationId);
    if (!ctx.can(record.data.productId ? "products.edit" : "products.create")) publicError("اجازهٔ تغییر این محصول را ندارید.");
    const imagekit = new ImageKit({ publicKey: process.env.IMAGEKIT_PUBLIC_KEY, privateKey: process.env.IMAGEKIT_PRIVATE_KEY, urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT });
    const results = [];
    for (const url of [...new Set(args.urls)]) {
      const existing = record.data.images.find(i => i.sourceUrl === url);
      if (existing) { results.push(existing); continue; }
      try {
        const fetched = await downloadPublic(url, { image: true, maxBytes: 5 * 1024 * 1024 });
        const result = await imagekit.upload({ file: fetched.buffer, fileName: `reference-${secret().slice(0, 12)}.${fetched.mime.split("/")[1]}`, folder: "/product", useUniqueFileName: true });
        if (!result.url || !result.fileId) throw new Error("upload");
        const image = { sourceUrl: url, url: result.url, fileId: result.fileId };
        await McpGrant.updateOne({ _id: record._id }, { $push: { "data.images": image } });
        // The job outlives its preparation record (TTL); a renewed preparation re-adopts these.
        if (record.data.jobId) await ProductJob.updateOne({ _id: record.data.jobId, userId: ctx.userId }, { $push: { "data.images": image } });
        results.push(image);
      } catch { results.push({ sourceUrl: url, error: "دریافت یا بارگذاری این تصویر ناموفق بود" }); }
    }
    return { images: results };
  }, { openWorldHint: true });
  const contextDraft = async args => {
    const record = await prep(args.preparationId);
    const built = checkedPublic(await buildProductDraftPrompt({ categoryId: record.data.categoryId, rawContent: record.data.rawContent }));
    if (rulesHash(built) !== record.data.promptHash) publicError("قواعد پنل تغییر کرده؛ همان کار را با resume_product_job و بدون clarification ادامه دهید، سپس دوباره بازبینی کنید.");
    const draft = { ...parsePublic(args.json), category: record.data.categoryId, sport: built.meta.sport.id };
    if (record.data.productId && Object.hasOwn(draft, "basePrice")) {
      const target = checkedPublic(await loadRegenerationTarget(record.data.productId));
      if (Number(draft.basePrice) !== Number(target.product.basePrice)) publicError("در بازسازی قیمت موجود حفظ می‌شود؛ basePrice را از JSON حذف کنید و دوباره بازبینی کنید.");
    }
    return { record, draft, category: built.category };
  };
  const assertReviewed = (record, value) => {
    if (record.data.reviewHash !== digest(value)) publicError("بازبین مستقل Codex باید همین JSON نهایی را بررسی کند؛ ابتدا review_product_draft را اجرا کنید.");
  };
  const assertOriginal = async record => {
    if (!record.data.productId) return;
    const target = checkedPublic(await loadRegenerationTarget(record.data.productId));
    const variants = await Variant.find({ productId: record.data.productId }).select("attributes price images").sort({ _id: 1 }).lean();
    if (new Date(target.product.updatedAt).getTime() !== new Date(record.data.originalVersion).getTime() || digest(JSON.stringify(variants)) !== record.data.variantsHash)
      publicError("محصول یا واریانت‌ها از زمان آماده‌سازی تغییر کرده‌اند؛ دوباره آماده‌سازی و بازبینی کنید.");
    return target;
  };
  const invalid = (message, fieldErrors) => ({ error: { message, extra: { fieldErrors } } });
  // The exact checks create/apply run, shared so a reviewer is never asked to approve JSON that
  // the save would then reject. Returns { error } or { plan, preview, target }; mutates `draft`
  // into the shape that is saved (inactive).
  const validateDraft = async (record, draft, category) => {
    if (record.data.productId) {
      const target = await assertOriginal(record);
      const result = await previewRegeneration({ ...target, draft });
      return result.error ? result : { ...result, target };
    }
    const allowed = new Set(record.data.images.map(i => i.url));
    const urls = [draft.mainImage, ...(Array.isArray(draft.gallery) ? draft.gallery : [])];
    for (const detail of Object.values(draft.variantDetails || {})) urls.push(...(detail.images || []));
    // The prompt asks for variantMeta (unit conversions, value images), so it is kept — but only
    // in its documented shape, for values that exist, and with images from this preparation.
    const meta = draft.variantMeta ?? {}, plain = v => v && typeof v === "object" && !Array.isArray(v);
    if (!plain(meta)) return invalid("variantMeta باید شیء باشد.", { variantMeta: "باید شیء باشد" });
    for (const [attr, values] of Object.entries(meta)) {
      const options = draft.variantOptions?.[attr];
      if (!Array.isArray(options) || !plain(values)) return invalid(`variantMeta.${attr} به ویژگی واریانتی در variantOptions اشاره نمی‌کند.`, { variantMeta: `کلید ناشناخته: ${attr}` });
      for (const [value, entry] of Object.entries(values)) {
        if (!options.map(String).includes(value)) return invalid(`variantMeta.${attr}.${value} در variantOptions نیست.`, { variantMeta: `مقدار ناشناخته: ${attr} → ${value}` });
        if (!plain(entry) || Object.keys(entry).some(k => k !== "units" && k !== "images")
          || (entry.units !== undefined && (!plain(entry.units) || Object.values(entry.units).some(u => typeof u !== "string")))
          || (entry.images !== undefined && (!Array.isArray(entry.images) || entry.images.some(u => typeof u !== "string"))))
          return invalid(`variantMeta.${attr}.${value} فقط units (رشته‌ها) و images (URL) می‌پذیرد.`, { variantMeta: `ساختار نامعتبر: ${attr} → ${value}` });
        urls.push(...(entry.images || []));
      }
    }
    if (!draft.mainImage || urls.some(u => !allowed.has(u))) return invalid("تصویر اصلی، گالری و تصاویر واریانت باید از خروجی بارگذاری تصاویر همین آماده‌سازی باشند.", { mainImage: "فقط URLهای خروجی import_product_images" });
    draft.isActive = false;
    let combinationCount = 1;
    for (const values of Object.values(draft.variantOptions || {})) {
      if (!Array.isArray(values) || values.length > 100) return invalid("مقادیر واریانت نامعتبر یا بیش از حد مجاز است.", { variantOptions: "نامعتبر" });
      combinationCount *= Math.max(1, values.length);
      if (combinationCount > 500) return invalid("ساخت بیش از ۵۰۰ ترکیب واریانت در یک محصول مجاز نیست.", { variantOptions: "بیش از ۵۰۰ ترکیب" });
    }
    // Validate catalog references and content with the existing regeneration planner, too.
    return previewRegeneration({ product: { _id: record._id, category: category._id, sport: category.sport._id, attributes: {}, technicalStats: {}, athlete: [], tag: [], customTabItems: [] }, category, draft });
  };
  const failure = result => ({ error: result.error.message, fieldErrors: result.error.extra?.fieldErrors, missing: result.error.extra?.missing });
  const normalizedJsonOf = value => {
    const parsed = parsePublic(value), normalized = normalizeDraftHtml(parsed);
    return JSON.stringify(parsed) === JSON.stringify(normalized) ? null : JSON.stringify(normalized);
  };
  register("validate_product_draft", "پیش از فرستادن JSON به بازبین مستقل، همان اعتبارسنجی ذخیره (فیلدها، ارجاع‌ها، تصاویر، پاک‌سازی HTML) را بدون ثبت چیزی اجرا می‌کند. فقط JSON با valid:true را به بازبین بدهید.", { preparationId, json }, ["products.view", "ai.productDraft"], false, async args => {
    const { record, draft, category } = await contextDraft(args);
    const normalizedJson = normalizedJsonOf(args.json);
    const checked = await validateDraft(record, draft, category);
    if (checked.error) return { valid: false, ...failure(checked), ...(normalizedJson && { normalizedJson }),
      nextAction: "Route each fieldErrors entry to the responsible agent, merge the fix, and validate again before review." };
    if (normalizedJson) return { valid: false, normalizedJson, nextAction: "HTML is outside the allowed tags/styles. Use normalizedJson (or fix the HTML) and validate again." };
    return { valid: true, missing: checked.preview.missing, ...(record.data.productId && { changes: checked.preview.changes }),
      nextAction: "Give this exact JSON to the independent reviewer, then call review_product_draft with it." };
  });
  const committed = (record, value) => async (session, product) => {
    const grant = await McpGrant.updateOne({ _id: record._id, "data.reviewHash": digest(value), expiresAt: { $gt: new Date() } },
      { $set: { "data.createdProductId": String(product._id) } }, { session });
    if (!grant.matchedCount) throw new Error("REVIEW_CHANGED");
    if (record.data.jobId) {
      const job = await ProductJob.updateOne({ _id: record.data.jobId, userId: ctx.userId, status: "awaiting_chat", "data.preparingLock": { $exists: false },
        "data.preparation.preparationId": record.data.preparationKey },
        // The preparation record expires within the hour; the job keeps the review evidence for good.
        { $set: { status: "completed", result: { saved: true, productId: String(product._id),
          review: { report: record.data.review, agents: record.data.reviewAgents, reviewedAt: record.data.reviewedAt, jsonHash: record.data.reviewHash } } } }, { session });
      if (!job.matchedCount) throw new Error("JOB_CHANGED");
    }
  };
  register("review_product_draft", "گزارش واقعی بازبین مستقل Codex را برای JSON نهایی ثبت می‌کند؛ این ابزار مدل اجرا نمی‌کند. شناسه واقعی سه ایجنت متفاوت را بدهید. تأیید فقط برای همین JSON معتبر است؛ پس از اصلاح دوباره بازبینی کنید.", {
    preparationId, json, analystId: z.string().trim().min(1).max(200), writerId: z.string().trim().min(1).max(200), reviewerId: z.string().trim().min(1).max(200), review: reviewSchema,
  }, ["products.view", "ai.productDraft"], true, async args => {
    const { record, draft, category } = await contextDraft(args);
    if (!ctx.can(record.data.productId ? "products.edit" : "products.create")) publicError("اجازهٔ تغییر این محصول را ندارید.");
    if (new Set([args.analystId, args.writerId, args.reviewerId].map(s => s.trim())).size !== 3) publicError("تحلیلگر، نویسنده و بازبین باید ایجنت‌های مستقل باشند.");
    // Never record an approval for JSON the save would reject.
    const checked = await validateDraft(record, draft, category);
    if (checked.error) {
      await McpGrant.updateOne({ _id: record._id }, { $unset: { "data.reviewHash": 1 } });
      return { approved: false, valid: false, ...failure(checked), nextAction: "This JSON fails save validation. Fix it, run validate_product_draft until valid, then get a fresh independent review." };
    }
    const normalizedJson = normalizedJsonOf(args.json);
    if (normalizedJson) {
      await McpGrant.updateOne({ _id: record._id }, { $unset: { "data.reviewHash": 1 } });
      return { approved: false, normalizedJson, nextAction: "HTML was normalized to the allowed tags/styles. Have the independent reviewer inspect normalizedJson and submit a fresh review of that exact JSON before saving." };
    }
    const approved = approvedReview(args.review);
    await McpGrant.updateOne({ _id: record._id }, { $set: { "data.review": args.review,
      "data.reviewAgents": { analyst: args.analystId, writer: args.writerId, reviewer: args.reviewerId },
      "data.reviewedAt": new Date(), "data.reviewHash": approved ? digest(args.json) : null } });
    return { approved, nextAction: approved ? "Create product, or preview then apply regeneration with this exact JSON." : "Revise with the writer and obtain a fresh independent review.",
      verification: "Agent identity and semantic review are host attestations; server verifies schema, distinct IDs and exact JSON binding only." };
  });
  register("create_product", "JSON تولیدشده را با قواعد سایت ذخیره می‌کند. فقط محصول غیرفعال ساخته می‌شود. تصاویر باید قبلاً از import_product_images گرفته شده باشند. واریانت‌ها و قیمت نامعلوم را حدس نزنید.", { preparationId, json }, ["products.create", "ai.productDraft"], true, async args => {
    const { record, draft, category } = await contextDraft(args);
    if (record.data.productId) publicError("برای بازسازی از ابزار بازتولید استفاده کنید.");
    if (record.data.createdProductId) return { productId: record.data.createdProductId, alreadyCreated: true };
    assertReviewed(record, args.json);
    checkedPublic(await validateDraft(record, draft, category));
    const lock = await McpGrant.findOneAndUpdate({ _id: record._id, "data.creating": { $ne: true }, "data.createdProductId": { $exists: false } }, { $set: { "data.creating": true } });
    if (!lock) publicError("ساخت این محصول قبلاً شروع شده؛ دوباره اجرا نکنید و فهرست محصولات را بررسی کنید.");
    const response = await createProduct(draft, { reservedProductId: record.data.reservedProductId, onCommitted: committed(record, args.json) });
    const result = await response.json();
    if (!response.ok) {
      await McpGrant.updateOne({ _id: record._id }, { $unset: { "data.creating": 1 } });
      return { error: result, saved: false };
    }
    await McpGrant.updateOne({ _id: record._id }, { $set: { "data.createdProductId": String(result.product._id) } });
    return { product: safeProduct(result.product), saved: true, message: "محصول غیرفعال ساخته شد؛ در پنل ادمین قابل بررسی است." };
  });
  const regeneration = async args => {
    const { record, draft, category } = await contextDraft(args);
    if (!record.data.productId) publicError("برای بازسازی، start_product_job را با productId اجرا کنید.");
    const { target, ...result } = checkedPublic(await validateDraft(record, draft, category));
    return { ...target, ...result, record, productId: record.data.productId };
  };
  register("preview_product_regeneration", "تغییرات JSON روی محصول موجود را نشان می‌دهد؛ تصاویر و واریانت‌ها حفظ می‌شوند. updatedAt را برای اعمال نگه دارید.", { preparationId, json }, "products.edit", false, async args => {
    const result = await regeneration(args);
    await McpGrant.updateOne({ _id: result.record._id }, { $set: { "data.previewHash": digest(args.json), "data.previewVersion": result.preview.updatedAt } });
    return result.preview;
  });
  register("apply_product_regeneration", "تغییرات بازتولید را با کنترل نسخه اعمال می‌کند. JSON باید همان JSON پیش‌نمایش باشد. تصاویر و واریانت‌ها حفظ می‌شوند.", { preparationId, json, expectedUpdatedAt: z.string().datetime() }, "products.edit", true, async args => {
    const result = await regeneration(args);
    assertReviewed(result.record, args.json);
    if (result.record.data.previewHash !== digest(args.json) || result.record.data.previewVersion !== args.expectedUpdatedAt) publicError("ابتدا پیش‌نمایش همین JSON را بگیرید.");
    checkedPublic(await applyRegeneration({ ...result, expectedUpdatedAt: args.expectedUpdatedAt, onCommitted: committed(result.record, args.json) }));
    revalidateContent(["products", "navbar"]);
    return { saved: true, productId: result.productId };
  }, { destructiveHint: true, idempotentHint: false });
  register("replace_product_images", "فقط به درخواست صریح کاربر تصاویر محصول موجود را با تصاویر بارگذاری‌شده جایگزین می‌کند. mainImage و gallery مجموعهٔ نهایی هستند. expectedUpdatedAt را از آماده‌سازی جدید بگیرید.", {
    preparationId, mainImage: z.string().url(), gallery: z.array(z.string().url()).max(30), expectedUpdatedAt: z.string().datetime(),
  }, "products.edit", true, async args => {
    const record = await prep(args.preparationId);
    if (!record.data.productId) publicError("این آماده‌سازی مربوط به محصول موجود نیست.");
    const allowed = new Set(record.data.images.map(i => i.url));
    if ([args.mainImage, ...args.gallery].some(u => !allowed.has(u))) publicError("تصاویر باید خروجی بارگذاری همین آماده‌سازی باشند.");
    const updated = await Product.findOneAndUpdate({ _id: record.data.productId, updatedAt: new Date(args.expectedUpdatedAt) }, { $set: { mainImage: args.mainImage, gallery: args.gallery } }, { returnDocument: "after", runValidators: true });
    if (!updated) publicError("محصول تغییر کرده؛ دوباره آماده‌سازی کنید.");
    revalidateContent(["products", "navbar"]);
    return { saved: true, product: safeProduct(updated) };
  }, { destructiveHint: true, idempotentHint: false });
  return server;
}
