/**
 * ادغام / جداسازیِ بلوک‌ها. خالص و بدونِ وابستگی به React تا مستقیم تست شود.
 *
 * بلوک‌ها عیناً (با شناسه، داده، استایل و عرضِ خودشان) داخلِ data.blocks می‌روند،
 * پس جداسازی دقیقاً همان بلوک‌ها و همان ترتیب را برمی‌گرداند.
 */
import { MAX_MERGED_CHILDREN, MERGED_BLOCK_TYPE, isMergedBlock, mergedChildren } from "./articleBlockTypes.js";

/** بلوک‌های انتخاب‌شده را ادغام می‌کند، یا null اگر انتخاب قابلِ ادغام نیست. */
export function mergeBlocks(blocks, selectedIds) {
  const indices = selectedIds.map((id) => blocks.findIndex((block) => block.id === id)).filter((index) => index >= 0).sort((a, b) => a - b);
  if (indices.length < 2 || indices.length > MAX_MERGED_CHILDREN) return null;
  // فقط بلوک‌های پشتِ‌سرِ‌هم؛ ادغامِ بلوک‌های دور از هم ترتیبِ مقاله را عوض می‌کرد.
  if (indices.some((index, i) => i > 0 && index !== indices[i - 1] + 1)) return null;
  // فقط یک سطح: بلوکِ ادغام‌شده داخلِ بلوکِ ادغام‌شده نمی‌رود.
  if (indices.some((index) => isMergedBlock(blocks[index]))) return null;
  const first = indices[0];
  const last = indices.at(-1);
  const merged = { id: crypto.randomUUID(), type: MERGED_BLOCK_TYPE, version: 1, data: { blocks: blocks.slice(first, last + 1) } };
  return [...blocks.slice(0, first), merged, ...blocks.slice(last + 1)];
}

/** بلوکِ ادغام‌شده را با فرزندانش، در همان جا، جایگزین می‌کند. */
export function unmergeBlock(blocks, mergedId) {
  return blocks.flatMap((block) => (block.id === mergedId && isMergedBlock(block) ? mergedChildren(block) : [block]));
}

/**
 * رونوشت با شناسه‌ی تازه — فرزندانِ بلوکِ ادغام‌شده هم، چون شناسه در کلِ درخت
 * یکتاست (سرور همین را می‌خواهد و شناسه‌ی DOMِ ویرایشگر از آن ساخته می‌شود).
 */
export function cloneWithFreshIds(block) {
  const copy = { ...structuredClone(block), id: crypto.randomUUID() };
  if (isMergedBlock(copy)) copy.data = { ...copy.data, blocks: mergedChildren(copy).map((child) => ({ ...child, id: crypto.randomUUID() })) };
  return copy;
}
