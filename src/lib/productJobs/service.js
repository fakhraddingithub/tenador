import "base/models/registerModels";
import mongoose from "mongoose";
import ProductJob from "base/models/ProductJob";
import McpGrant from "base/models/McpGrant";
import { digest, secret } from "@/lib/mcp/security";
import { jobInput, permissionsFor } from "./policy.js";

const fail = message => Object.assign(new Error(message), { jobPublic: true });
function authorize(ctx, input) {
  if (!ctx?.isAdmin || !ctx.can(permissionsFor(input))) throw fail("دسترسی ساخت یا بازسازی محصول کافی نیست.");
}
function result(job) {
  return { jobId: String(job._id), executionMode: "codex_agents", status: job.status,
    stage: job.stage, updatedAt: job.updatedAt, result: job.result || null,
    preparation: job.status === "awaiting_chat" ? job.data?.preparation : undefined,
    input: job.status !== "completed" ? job.input : undefined,
    nextAction: job.status === "completed" ? "done" : job.status === "awaiting_chat" ? "Run the native Codex agents described in preparation.workflow. No worker or polling will generate content." : "Use resume_product_job to continue this legacy job in Codex; no server model will run.",
    pollAfterSeconds: null };
}
async function owned(ctx, id) {
  const job = await ProductJob.findOne({ _id: id, userId: ctx.userId }).lean();
  if (!job) throw fail("کار پیدا نشد.");
  authorize(ctx, job.input);
  return job;
}
let indexes;
export async function startProductJob(ctx, args, prepare) {
  const input = jobInput.parse(args); authorize(ctx, input);
  await (indexes ||= ProductJob.createIndexes().catch(e => { indexes = null; throw e; }));
  const requestKey = digest(input.requestKey), inputHash = digest(JSON.stringify(input));
  const filter = { userId: ctx.userId, requestKey };
  let job;
  try {
    job = await ProductJob.findOneAndUpdate(filter, { $setOnInsert: { ...filter, inputHash, input,
      status: "awaiting_chat", data: { reservedProductId: String(new mongoose.Types.ObjectId()), preparationId: secret() } } },
      { upsert: true, returnDocument: "after" }).lean();
  } catch (e) { if (e.code !== 11000) throw e; job = await ProductJob.findOne(filter).lean(); }
  if (job.inputHash !== inputHash) throw fail("این requestKey قبلاً برای ورودی متفاوت استفاده شده است.");
  return prepareJob(ctx, job, prepare);
}
async function prepareJob(ctx, job, prepare, clarification, refresh = false) {
  if (job.status === "completed") return result(job);
  if (job.status === "running" && new Date(job.leaseUntil) > new Date()) throw fail("اجرای قدیمی هنوز قفل دارد؛ پس از پایان قفل همین کار را ادامه دهید.");
  if (job.data?.preparation && !clarification && !refresh) {
    const grant = await McpGrant.findOneAndUpdate({ key: digest(job.data.preparationId), userId: ctx.userId, kind: "preparation" },
      { $set: { expiresAt: new Date(Date.now() + 3600000) } });
    if (grant) return result(job);
  }
  const lock = secret();
  const locked = await ProductJob.findOneAndUpdate({ _id: job._id, userId: ctx.userId, updatedAt: job.updatedAt,
    $or: [{ "data.preparingUntil": { $exists: false } }, { "data.preparingUntil": { $lt: new Date() } }] },
    { $set: { status: "awaiting_chat", leaseUntil: new Date(0), "data.preparingUntil": new Date(Date.now() + 120000), "data.preparingLock": lock },
      $unset: { lease: 1 } }, { returnDocument: "after" }).lean();
  if (!locked) throw fail("آماده‌سازی هم‌زمان در حال اجراست؛ همین درخواست را دوباره بررسی کنید.");
  try {
    const input = { ...job.input };
    if (job.data?.rawContent) input.rawContent = job.data.rawContent;
    if (clarification && input.rawContent) input.rawContent += "\nاطلاعات تکمیلی ادمین:\n" + clarification;
    else if (clarification) input.clarification = clarification;
    if (input.rawContent?.length > 60000) throw fail("متن از سقف ۶۰۰۰۰ نویسه بیشتر است.");
    // One key for the job's whole life: renewing it keeps imported images, and the prepare step
    // drops the review itself when the rules, source or original product changed.
    const key = job.data?.preparationId || secret();
    const preparation = await prepare(input, { key, jobId: String(job._id), reservedProductId: job.data?.reservedProductId, images: job.data?.images || [] });
    const updated = await ProductJob.findOneAndUpdate({ _id: job._id, "data.preparingLock": lock },
      { $set: { status: "awaiting_chat", stage: "analyse", input: { ...input, rawContent: preparation.rawContent, clarification: undefined },
        "data.preparationId": key, "data.preparation": preparation, "data.rawContent": preparation.rawContent,
        leaseUntil: new Date(0), error: null, errorCode: null, questions: [] },
        $unset: { "data.preparingUntil": 1, "data.preparingLock": 1, lease: 1 } }, { returnDocument: "after" }).lean();
    if (!updated) throw fail("وضعیت آماده‌سازی تغییر کرده است.");
    return result(updated);
  } catch (e) {
    await ProductJob.updateOne({ _id: job._id, "data.preparingLock": lock }, { $unset: { "data.preparingUntil": 1, "data.preparingLock": 1 } });
    throw e;
  }
}
export async function getProductJob(ctx, jobId) {
  const job = await owned(ctx, jobId);
  const value = result(job);
  if (job.status === "awaiting_chat") {
    const active = job.data?.preparationId && await McpGrant.exists({ key: digest(job.data.preparationId), userId: ctx.userId, expiresAt: { $gt: new Date() } });
    value.preparationExpired = !active;
    if (!active) { delete value.preparation; value.nextAction = "Call resume_product_job with this jobId and no clarification to renew the SAME job. Do not call prepare_product or start a different job."; }
  }
  return value;
}
export async function resumeProductJob(ctx, jobId, clarification, prepare) {
  return prepareJob(ctx, await owned(ctx, jobId), prepare, clarification, true);
}
// Tombstone for stale importers. Never invokes a model.
export async function runProductJobStage() { return { disabled: true, executionMode: "codex_agents" }; }
