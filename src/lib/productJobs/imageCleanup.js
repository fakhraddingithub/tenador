import "base/models/registerModels";
import ProductJob from "base/models/ProductJob";
import Preparation from "base/models/ProductPreparation";
import Product from "base/models/Product";
import Variant from "base/models/Variant";
import { digest } from "@/lib/mcp/security";

const DAY = 86400000;
// An unfinished job can still be resumed, and a resume re-adopts its images; give it this long.
export const ABANDONED_AFTER_DAYS = 30;

/**
 * Deletes from ImageKit the images a product job imported but that no product ended up using.
 * A job is settled when it is completed and its preparation is gone (nothing can attach images
 * any more, not even replace_product_images), or when it has been untouched for
 * ABANDONED_AFTER_DAYS. A failed delete stays on the job and is retried on the next run.
 *
 * ponytail: "used" means referenced by the job's own product (anywhere in its document or its
 * variants) or by any product's mainImage/gallery or any variant's images. A URL someone pasted
 * by hand into an article or another product's variantMeta is not checked.
 */
export async function cleanupProductJobImages({ deleteFile, now = new Date(), limit = 100 }) {
  const jobs = await ProductJob.find({ "data.images.0": { $exists: true }, "data.imagesSettled": { $ne: true } })
    .sort({ updatedAt: 1 }).limit(limit).lean();
  const report = { jobs: 0, deleted: 0, kept: 0, failed: 0 };
  for (const job of jobs) {
    if (job.status === "completed") {
      if (await Preparation.exists({ key: digest(job.data.preparationId || ""), expiresAt: { $gt: now } })) continue;
    } else if (new Date(job.updatedAt) > new Date(now - ABANDONED_AFTER_DAYS * DAY)) continue;
    report.jobs++;

    const images = job.data.images, urls = images.map(i => i.url);
    const ids = [job.result?.productId, job.input?.productId, job.data.reservedProductId].filter(Boolean);
    const own = JSON.stringify([
      await Product.find({ _id: { $in: ids } }).lean(),
      await Variant.find({ productId: { $in: ids } }).select("images").lean(),
    ]);
    const used = new Set(urls.filter(u => own.includes(u)));
    const elsewhere = [
      ...await Product.find({ $or: [{ mainImage: { $in: urls } }, { gallery: { $in: urls } }] }).select("mainImage gallery").lean(),
      ...await Variant.find({ images: { $in: urls } }).select("images").lean(),
    ];
    for (const doc of elsewhere) for (const u of [doc.mainImage, ...(doc.gallery || []), ...(doc.images || [])]) if (u) used.add(u);

    const removed = [];
    let failed = 0;
    for (const image of images) {
      if (used.has(image.url)) { report.kept++; continue; }
      try {
        if (image.fileId) await deleteFile(image.fileId);
        removed.push(image.url); report.deleted++;
      } catch { failed++; report.failed++; }
    }
    // Images still in use stay listed; the job is settled unless a delete failed (retried next run).
    await ProductJob.updateOne({ _id: job._id }, {
      $pull: { "data.images": { url: { $in: removed } } },
      ...(failed ? {} : { $set: { "data.imagesSettled": true } }),
    });
  }
  return report;
}
