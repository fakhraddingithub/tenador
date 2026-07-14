import { createSlug } from "base/utils/slugify";

const ARTICLE_SLUG_PATTERN = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

export function normalizeArticleSlug(value) {
  return createSlug(String(value || ""));
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

