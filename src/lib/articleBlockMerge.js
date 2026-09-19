/**
 * ادغام / جداسازیِ بلوک‌ها. خالص و بدونِ وابستگی به React تا مستقیم تست شود.
 *
 * بلوک‌ها عیناً (با شناسه، داده، استایل و عرضِ خودشان) داخلِ data.blocks می‌روند،
 * پس جداسازی دقیقاً همان بلوک‌ها و همان ترتیب را برمی‌گرداند. بلوکِ ادغام‌شده هم
 * یک بلوکِ عادی است و می‌تواند دوباره ادغام شود؛ جداسازی فقط یک سطح را باز می‌کند.
 */
import { MAX_MERGED_CHILDREN, MAX_MERGE_DEPTH, MERGED_BLOCK_TYPE, isMergedBlock, mergeDepth, mergedChildren } from "./articleBlockTypes.js";

/** دلیلِ ادغام‌ناپذیریِ انتخاب (برای پیامِ نوارِ ادغام)، یا null اگر قابلِ ادغام است. */
export function mergeBlocker(blocks, selectedIds) {
  const indices = selectedIds.map((id) => blocks.findIndex((block) => block.id === id)).filter((index) => index >= 0).sort((a, b) => a - b);
  if (indices.length < 2) return "few";
  if (indices.length > MAX_MERGED_CHILDREN) return "many";
  // فقط بلوک‌های پشتِ‌سرِ‌هم؛ ادغامِ بلوک‌های دور از هم ترتیبِ مقاله را عوض می‌کرد.
  if (indices.some((index, i) => i > 0 && index !== indices[i - 1] + 1)) return "gap";
  if (1 + Math.max(...indices.map((index) => mergeDepth(blocks[index]))) > MAX_MERGE_DEPTH) return "deep";
  return null;
}

/** بلوک‌های انتخاب‌شده را ادغام می‌کند، یا null اگر انتخاب قابلِ ادغام نیست. */
export function mergeBlocks(blocks, selectedIds) {
  if (mergeBlocker(blocks, selectedIds)) return null;
  const indices = selectedIds.map((id) => blocks.findIndex((block) => block.id === id)).sort((a, b) => a - b);
  const first = indices[0];
  const last = indices.at(-1);
  const merged = { id: crypto.randomUUID(), type: MERGED_BLOCK_TYPE, version: 1, data: { blocks: blocks.slice(first, last + 1) } };
  return [...blocks.slice(0, first), merged, ...blocks.slice(last + 1)];
}

/** بلوکِ ادغام‌شده را با فرزندانش، در همان جا، جایگزین می‌کند (فقط یک سطح). */
export function unmergeBlock(blocks, mergedId) {
  return blocks.flatMap((block) => (block.id === mergedId && isMergedBlock(block) ? mergedChildren(block) : [block]));
}

const reId = (block) => {
  const copy = { ...block, id: crypto.randomUUID() };
  if (isMergedBlock(copy)) copy.data = { ...copy.data, blocks: mergedChildren(copy).map(reId) };
  return copy;
};

/**
 * رونوشت با شناسه‌ی تازه برای خودش و همه‌ی بلوک‌های داخلش (در هر عمقی)، چون
 * شناسه در کلِ درخت یکتاست (سرور همین را می‌خواهد و شناسه‌ی DOMِ ویرایشگر از آن ساخته می‌شود).
 */
export function cloneWithFreshIds(block) {
  return reId(structuredClone(block));
}
