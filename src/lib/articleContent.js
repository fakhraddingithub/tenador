const WORD_PATTERN = /[\p{L}\p{N}]+/gu;

function collectText(value, output, seen) {
  if (typeof value === "string") {
    output.push(value.replace(/<[^>]*>/g, " "));
    return;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return;
    seen.add(value);
    for (const item of value) collectText(item, output, seen);
    return;
  }
  if (value && typeof value === "object") {
    // اسناد Mongoose (ساب‌داکیومنت‌های blocks) ارجاع چرخه‌ای به والد دارند؛
    // seen جلوی پیمایش بی‌نهایت را می‌گیرد و toJSON دادهٔ خالص را می‌دهد.
    if (seen.has(value)) return;
    seen.add(value);
    const plain = typeof value.toObject === "function" ? value.toObject() : value;
    if (plain !== value && plain && typeof plain === "object") {
      collectText(plain, output, seen);
      return;
    }
    for (const item of Object.values(plain)) collectText(item, output, seen);
  }
}

export function countArticleWords(value) {
  const text = [];
  collectText(value, text, new WeakSet());
  return text.join(" ").match(WORD_PATTERN)?.length || 0;
}

export function calculateReadingTime(blocks, wordsPerMinute = 200) {
  const words = countArticleWords(blocks);
  return words === 0 ? 0 : Math.max(1, Math.ceil(words / wordsPerMinute));
}

