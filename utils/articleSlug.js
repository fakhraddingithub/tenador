import { createSlug } from "base/utils/slugify";

const ARTICLE_SLUG_PATTERN = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

export function normalizeArticleSlug(value) {
  return createSlug(String(value || ""));
}

// پارامترهای داینامیک روت در App Router به‌صورت percent-encoded می‌رسند
// (اسلاگ‌های فارسی). createSlug کاراکترِ % را حذف می‌کند، پس قبل از
// نرمال‌سازی باید decode شود — همان قراردادِ getProductBySlug.
export function decodeSlugParam(value) {
  const raw = String(value || "");
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function isValidArticleSlug(value) {
  const slug = String(value || "");
  return slug.length <= 180 && ARTICLE_SLUG_PATTERN.test(slug);
}

export function buildArticlePath(categorySlug, articleSlug) {
  const category = normalizeArticleSlug(categorySlug);
  const article = normalizeArticleSlug(articleSlug);
  if (!category || !article) return null;
  return `/articles/${encodeURIComponent(category)}/${encodeURIComponent(article)}`;
}

