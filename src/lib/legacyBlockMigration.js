/**
 * مهاجرتِ بلوک‌های حذف‌شده — هسته‌ی scripts/migrateLegacyBlocks.mjs، جدا از پایگاه‌داده
 * تا آزمون‌پذیر باشد. قاعده‌ی تبدیل همان legacyArticleBlocks.js است؛ تنها کاری که
 * فقط اینجا شدنی است، ثبتِ محصولاتِ امروزِ بلوک‌های پویاست:
 *
 *   latestProducts / bestSellers / amazingOffers → productSlider با همان عنوان و
 *   همان محصولاتی که الان نشان می‌دهند (snapshot، با همان کوئریِ رندرِ قبلی).
 *
 * بقیه (گالری، محصولاتِ دست‌دوم، اسلایدرِ برند) با upgradeLegacyBlocks تبدیل
 * می‌شوند و بی‌جانشین‌ها (اسلایدرِ کالکشن/دسته/ورزش) حذف و *گزارش* می‌شوند تا
 * ادمین بداند کجا بوده‌اند.
 *
 * آرایه درجا عوض می‌شود (همان الگوی مهاجرت‌های دیگر: updateOf همان مسیرها را می‌نویسد).
 */
import { DYNAMIC_PRODUCT_BLOCK_TYPES, LEGACY_BLOCK_TYPES, upgradeLegacyBlocks } from "./legacyArticleBlocks.js";

const DYNAMIC = new Set(DYNAMIC_PRODUCT_BLOCK_TYPES);

async function snapshotDynamic(blocks, snapshot, report) {
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (DYNAMIC.has(block?.type)) {
      const products = (await snapshot(block)).map(String);
      blocks[index] = { ...block, type: "productSlider", data: { title: block.data?.title || "", products, usedProducts: [] } };
      report.converted.push({ from: block.type, to: "productSlider", title: block.data?.title || "", products: products.length });
    } else if (Array.isArray(block?.data?.blocks)) {
      await snapshotDynamic(block.data.blocks, snapshot, report);
    }
  }
}

function collect(blocks, report) {
  for (const block of Array.isArray(blocks) ? blocks : []) {
    if (LEGACY_BLOCK_TYPES.has(block?.type)) {
      const successor = { gallery: "image", usedProducts: "productSlider", brandSlider: "brandBar" }[block.type];
      if (successor) report.converted.push({ from: block.type, to: successor, title: block.data?.title || "" });
      else report.removed.push({ type: block.type, title: block.data?.title || "" });
    }
    collect(block?.data?.blocks, report);
  }
}

/**
 * یک آرایه‌ی بلوک. برمی‌گرداند { converted, removed } (هر کدام فهرستی برای گزارش)؛
 * آرایه‌ی بی‌بلوکِ قدیمی دست‌نخورده می‌ماند. snapshot(block) → شناسه‌ی محصولات.
 */
export async function migrateLegacyBlocks(blocks, snapshot) {
  const report = { converted: [], removed: [] };
  if (!Array.isArray(blocks)) return report;
  await snapshotDynamic(blocks, snapshot, report);
  collect(blocks, report);
  if (!report.converted.length && !report.removed.length) return report;
  blocks.splice(0, blocks.length, ...upgradeLegacyBlocks(blocks));
  return report;
}
