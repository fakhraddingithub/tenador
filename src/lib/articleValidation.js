import mongoose from "mongoose";
import { isValidArticleSlug, normalizeArticleSlug } from "base/utils/articleSlug";
import { ARTICLE_BLOCK_TYPE_SET } from "@/lib/articleBlockTypes";
import { safeArticleUrl, sanitizeArticleBlockData } from "@/lib/articleBlockValidation";

export const ARTICLE_STATUSES = ["draft", "review", "scheduled", "published", "archived"];
export const ARTICLE_CATEGORY_STATUSES = ["draft", "active", "archived"];
export const ARTICLE_TAG_STATUSES = ["active", "archived"];

const MAX_BLOCKS = 500;
const MAX_BLOCK_BYTES = 2 * 1024 * 1024;

function text(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function optionalObjectId(value, field, errors, { required = false } = {}) {
  if (value == null || value === "") {
    if (required) errors[field] = `${field} is required`;
    return null;
  }
  if (!mongoose.isValidObjectId(value)) {
    errors[field] = `${field} is invalid`;
    return null;
  }
  return String(value);
}

function sanitizeSeo(value) {
  const seo = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    title: text(seo.title, 70),
    description: text(seo.description, 320),
    keywords: Array.isArray(seo.keywords)
      ? [...new Set(seo.keywords.map((item) => text(item, 80)).filter(Boolean))].slice(0, 30)
      : [],
    canonicalUrl: safeArticleUrl(seo.canonicalUrl),
    noIndex: seo.noIndex === true,
    ogTitle: text(seo.ogTitle, 95),
    ogDescription: text(seo.ogDescription, 320),
    ogImage: safeArticleUrl(seo.ogImage, { media: true }),
  };
}

function sanitizeCover(value) {
  const cover = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    url: safeArticleUrl(cover.url, { media: true }),
    alt: text(cover.alt, 300),
    width: Number.isInteger(cover.width) && cover.width > 0 ? cover.width : null,
    height: Number.isInteger(cover.height) && cover.height > 0 ? cover.height : null,
    publicId: text(cover.publicId, 500),
    provider: text(cover.provider, 80),
  };
}

function sanitizeBlocks(value, errors) {
  if (!Array.isArray(value)) {
    errors.blocks = "blocks must be an array";
    return [];
  }
  if (value.length > MAX_BLOCKS) errors.blocks = `blocks cannot exceed ${MAX_BLOCKS} items`;

  const ids = new Set();
  const blocks = value.slice(0, MAX_BLOCKS).map((block, index) => {
    const item = block && typeof block === "object" && !Array.isArray(block) ? block : {};
    const id = text(item.id, 120);
    const type = text(item.type, 80);
    if (!id) errors[`blocks.${index}.id`] = "block id is required";
    if (id && ids.has(id)) errors[`blocks.${index}.id`] = "block id must be unique";
    ids.add(id);
    if (!type) errors[`blocks.${index}.type`] = "block type is required";
    if (type && !ARTICLE_BLOCK_TYPE_SET.has(type)) errors[`blocks.${index}.type`] = "block type is not supported";
    return {
      id,
      type,
      data: ARTICLE_BLOCK_TYPE_SET.has(type)
        ? sanitizeArticleBlockData(type, item.data, errors, `blocks.${index}.data`)
        : {},
      version: Number.isInteger(item.version) && item.version > 0 ? item.version : 1,
    };
  });

  try {
    if (Buffer.byteLength(JSON.stringify(blocks), "utf8") > MAX_BLOCK_BYTES) {
      errors.blocks = "blocks payload is too large";
    }
  } catch {
    errors.blocks = "blocks must contain JSON-compatible data";
  }
  return blocks;
}

export function validateArticleInput(input, { partial = false } = {}) {
  const body = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const errors = {};
  const value = {};

  if (!partial || "title" in body) {
    value.title = text(body.title, 300);
    if (!value.title) errors.title = "title is required";
  }
  if (!partial || "slug" in body) {
    value.slug = normalizeArticleSlug(body.slug || body.title);
    if (!isValidArticleSlug(value.slug)) errors.slug = "slug is invalid";
  }
  if (!partial || "category" in body) {
    value.category = optionalObjectId(body.category, "category", errors, { required: true });
  }
  if (!partial || "author" in body) {
    value.author = optionalObjectId(body.author, "author", errors, { required: true });
  }
  if (!partial || "excerpt" in body) value.excerpt = text(body.excerpt, 1000);
  if (!partial || "cover" in body) value.cover = sanitizeCover(body.cover);
  if (!partial || "blocks" in body) value.blocks = sanitizeBlocks(body.blocks ?? [], errors);
  if (!partial || "seo" in body) value.seo = sanitizeSeo(body.seo);
  if (!partial || "status" in body) {
    value.status = body.status || "draft";
    if (!ARTICLE_STATUSES.includes(value.status)) errors.status = "status is invalid";
  }
  if (!partial || "publishedAt" in body) {
    value.publishedAt = body.publishedAt ? new Date(body.publishedAt) : null;
    if (value.publishedAt && Number.isNaN(value.publishedAt.getTime())) {
      errors.publishedAt = "publishedAt is invalid";
    }
  }
  if (!partial || "tags" in body) {
    if (!Array.isArray(body.tags)) {
      errors.tags = "tags must be an array";
      value.tags = [];
    } else {
      value.tags = [...new Set(body.tags.map(String))];
      if (value.tags.length > 50) errors.tags = "tags cannot exceed 50 items";
      if (value.tags.some((id) => !mongoose.isValidObjectId(id))) errors.tags = "tags contains an invalid id";
    }
  }
  if (!partial || "featured" in body) value.featured = body.featured === true;
  if (!partial || "pinned" in body) value.pinned = body.pinned === true;

  return { ok: Object.keys(errors).length === 0, errors, value };
}

export function validateArticleCategoryInput(input, { partial = false } = {}) {
  const body = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const errors = {};
  const value = {};
  if (!partial || "name" in body) {
    value.name = text(body.name, 160);
    if (!value.name) errors.name = "name is required";
  }
  if (!partial || "slug" in body) {
    value.slug = normalizeArticleSlug(body.slug || body.name);
    if (!isValidArticleSlug(value.slug)) errors.slug = "slug is invalid";
  }
  if (!partial || "description" in body) value.description = text(body.description, 3000);
  if (!partial || "seo" in body) value.seo = sanitizeSeo(body.seo);
  if (!partial || "cover" in body) value.cover = sanitizeCover(body.cover);
  if (!partial || "status" in body) {
    value.status = body.status || "draft";
    if (!ARTICLE_CATEGORY_STATUSES.includes(value.status)) errors.status = "status is invalid";
  }
  if (!partial || "order" in body) value.order = Number.isFinite(Number(body.order)) ? Number(body.order) : 0;
  if (!partial || "parent" in body) value.parent = optionalObjectId(body.parent, "parent", errors);
  return { ok: Object.keys(errors).length === 0, errors, value };
}

export function validateArticleTagInput(input, { partial = false } = {}) {
  const body = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const errors = {};
  const value = {};
  if (!partial || "name" in body) {
    value.name = text(body.name, 120);
    if (!value.name) errors.name = "name is required";
  }
  if (!partial || "slug" in body) {
    value.slug = normalizeArticleSlug(body.slug || body.name);
    if (!isValidArticleSlug(value.slug)) errors.slug = "slug is invalid";
  }
  if (!partial || "description" in body) value.description = text(body.description, 1000);
  if (!partial || "status" in body) {
    value.status = body.status || "active";
    if (!ARTICLE_TAG_STATUSES.includes(value.status)) errors.status = "status is invalid";
  }
  return { ok: Object.keys(errors).length === 0, errors, value };
}

export function articleListQuery(searchParams) {
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "20", 10) || 20));
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const query = text(searchParams.get("q"), 200);
  const filter = { deletedAt: null };
  if (ARTICLE_STATUSES.includes(status)) filter.status = status;
  if (mongoose.isValidObjectId(category)) filter.category = category;
  if (query) filter.$text = { $search: query };
  return { page, limit, filter };
}

