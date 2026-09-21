/**
 * هر جایی که بلوکِ مقاله‌ای ذخیره می‌شود، با مسیرِ آرایه در همان داکیومنت.
 *
 * دو مهاجرت (فاصله‌ی بلوک و فاصله‌ی بلوکِ ادغام‌شده) همین فهرست را می‌پیمایند؛
 * یک نسخه بیشتر نباید وجود داشته باشد، وگرنه مهاجرتِ بعدی یک مجموعه را جا
 * می‌اندازد و هیچ‌کس متوجه نمی‌شود.
 */
export const BLOCK_DOCUMENT_TARGETS = [
  { collection: "articles", paths: ["blocks"] },
  { collection: "articlerevisions", paths: ["blocks"] },
  { collection: "brands", paths: ["articleBlocks", "brochure.blocks"], arrayOfObjects: ["categoryArticles"] },
  { collection: "series", paths: ["articleBlocks"] },
];

export const getBlockPath = (doc, path) => path.split(".").reduce((value, key) => (value ? value[key] : undefined), doc);

/** آرایه‌های بلوکِ یک داکیومنت، طبقِ تعریفِ بالا. */
export function blockArraysOf(doc, target) {
  const arrays = [];
  for (const path of target.paths) arrays.push(getBlockPath(doc, path));
  for (const path of target.arrayOfObjects || []) {
    for (const entry of getBlockPath(doc, path) || []) arrays.push(entry?.blocks);
  }
  return arrays;
}

/** وصله‌ی $set برای همان مسیرها؛ کلیدِ غایب اصلاً نوشته نمی‌شود. */
export function updateOf(doc, target) {
  const update = {};
  for (const path of [...target.paths, ...(target.arrayOfObjects || [])]) {
    const value = getBlockPath(doc, path);
    if (value !== undefined) update[path] = value;
  }
  return update;
}
