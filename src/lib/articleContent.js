const WORD_PATTERN = /[\p{L}\p{N}]+/gu;

function collectText(value, output) {
  if (typeof value === "string") {
    output.push(value.replace(/<[^>]*>/g, " "));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, output);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectText(item, output);
  }
}

export function countArticleWords(value) {
  const text = [];
  collectText(value, text);
  return text.join(" ").match(WORD_PATTERN)?.length || 0;
}

export function calculateReadingTime(blocks, wordsPerMinute = 200) {
  const words = countArticleWords(blocks);
  return words === 0 ? 0 : Math.max(1, Math.ceil(words / wordsPerMinute));
}

