/**
 * کپیِ بلوک بینِ *سندهای مختلف* — مقاله، بروشور، مینی‌مقاله.
 *
 * هر سند ویرایشگرِ خودش را روی صفحه‌ی خودش دارد، پس وضعیتِ React نمی‌تواند بینِ
 * آن‌ها مشترک باشد. localStorage همان‌جایی است که بینِ تب‌ها و ناوبری‌ها می‌ماند
 * و هیچ درخواستِ سروری لازم ندارد — بلوک خودش فقط JSON است.
 *
 * قاعده‌ها:
 *  - **چسباندن همیشه شناسه‌ی تازه می‌دهد** (cloneWithFreshIds، در هر عمقی).
 *    شناسه در کلِ درختِ یک سند یکتاست و سرور همین را می‌خواهد؛ بدونِ آن،
 *    چسباندن در همان سند ذخیره را با ۴۰۰ رد می‌کرد.
 *  - **نوعِ ناشناخته چسبانده نمی‌شود.** کلیپ‌بورد ممکن است از نسخه‌ی قدیمی‌ترِ
 *    سایت مانده باشد؛ یک نوعِ حذف‌شده، کلِ ذخیره را رد می‌کند.
 *  - خواندن و نوشتن هرگز استثنا نمی‌دهند: در پنجره‌ی خصوصی یا با ذخیره‌سازیِ
 *    بسته، دکمه‌ها فقط کاری نمی‌کنند.
 */
import { ARTICLE_BLOCK_TYPE_SET } from "@/lib/articleBlockTypes";
import { cloneWithFreshIds } from "@/lib/articleBlockMerge";

const KEY = "tenador:block-clipboard:v1";
/** هر تغییری در کلیپ‌بورد را به همه‌ی ویرایشگرهای همین تب هم خبر می‌دهد. */
export const BLOCK_CLIPBOARD_EVENT = "tenador-block-clipboard";

const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** بلوک را در کلیپ‌بورد می‌گذارد. true یعنی واقعاً نوشته شد. */
export function copyBlockToClipboard(block, label = "") {
  if (!block?.type) return false;
  try {
    storage()?.setItem(KEY, JSON.stringify({ at: Date.now(), label, block }));
  } catch {
    return false;
  }
  window.dispatchEvent(new CustomEvent(BLOCK_CLIPBOARD_EVENT));
  return true;
}

/** محتوای کلیپ‌بورد، یا null. فقط خوانده می‌شود — شناسه‌ها اینجا عوض نمی‌شوند. */
export function readBlockClipboard() {
  let raw = null;
  try {
    raw = storage()?.getItem(KEY) || null;
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const type = parsed?.block?.type;
    return type && ARTICLE_BLOCK_TYPE_SET.has(type) ? parsed : null;
  } catch {
    return null;
  }
}

/** نسخه‌ی آماده‌ی چسباندن: همان بلوک با شناسه‌های تازه در هر عمقی. */
export function takeBlockFromClipboard() {
  const entry = readBlockClipboard();
  return entry ? cloneWithFreshIds(entry.block) : null;
}

export function clearBlockClipboard() {
  try {
    storage()?.removeItem(KEY);
  } catch {
    return;
  }
  window.dispatchEvent(new CustomEvent(BLOCK_CLIPBOARD_EVENT));
}
