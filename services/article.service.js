import mongoose from "mongoose";
import Article from "base/models/Article";
import ArticleCategory from "base/models/ArticleCategory";
import ArticleRedirect from "base/models/ArticleRedirect";
import ArticleRevision from "base/models/ArticleRevision";
import ArticleTag from "base/models/ArticleTag";
import User from "base/models/User";
import Brand from "base/models/Brand";
import Sport from "base/models/Sport";
import { buildArticlePath, normalizeArticleSlug } from "base/utils/articleSlug";
import { isReservedArticleRoot, publicArticleFilter } from "base/utils/articleRoutes";

function snapshot(article) {
  const value = article.toObject({ depopulate: true, versionKey: false });
  delete value._id;
  delete value.createdAt;
  delete value.updatedAt;
  return value;
}

async function inTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    const unsupported = error?.code === 20 || /Transaction numbers are only allowed/.test(error?.message || "");
    if (!unsupported) throw error;
    return work(null);
  } finally {
    await session.endSession();
  }
}

function withSession(query, session) {
  return session ? query.session(session) : query;
}
function validationError(field, message) {
  const error = new Error(message);
  error.name = "ValidationError";
  error.errors = { [field]: { message } };
  return error;
}

export async function assertArticleCategoryRouteAvailable(slug, session = null) {
  const normalized = normalizeArticleSlug(slug);
  if (isReservedArticleRoot(normalized)) {
    throw validationError("slug", "This category slug is reserved by an existing Tenador route");
  }
  const [sport, brand] = await Promise.all([
    withSession(Sport.exists({ slug: normalized }), session),
    withSession(Brand.exists({ slug: normalized }), session),
  ]);
  if (sport || brand) {
    throw validationError("slug", "This category slug is already used by a sport or brand");
  }
}

async function assertCategoryParent(categoryId, parentId, session) {
  if (!parentId) return;
  const seen = new Set([String(categoryId)]);
  let current = parentId;
  for (let depth = 0; current && depth < 100; depth += 1) {
    const key = String(current);
    if (seen.has(key)) throw validationError("parent", "Article category hierarchy cannot contain a cycle");
    seen.add(key);
    const parent = await withSession(ArticleCategory.findById(current).select("parent"), session);
    if (!parent) throw validationError("parent", "Parent category not found");
    current = parent.parent;
  }
  if (current) throw validationError("parent", "Article category hierarchy is too deep");
}

async function assertPublishable(article, session) {
  if (!["published", "scheduled"].includes(article.status)) return;
  const activeCategory = await withSession(ArticleCategory.exists({ _id: article.category, status: "active" }), session);
  if (!activeCategory) throw validationError("category", "Published and scheduled articles require an active category");
}

async function assertRelationships(value, session) {
  const checks = [];
  if (value.category) {
    checks.push(withSession(ArticleCategory.exists({ _id: value.category, status: { $ne: "archived" } }), session).then((found) => ["category", Boolean(found)]));
  }
  if (value.author) {
    checks.push(withSession(User.exists({ _id: value.author }), session).then((found) => ["author", Boolean(found)]));
  }
  if (value.tags) {
    checks.push(withSession(ArticleTag.countDocuments({ _id: { $in: value.tags }, status: { $ne: "archived" } }), session).then((count) => ["tags", count === value.tags.length]));
  }
  const invalid = (await Promise.all(checks)).find(([, valid]) => !valid);
  if (invalid) {
    const error = new Error(`${invalid[0]} contains a missing or archived record`);
    error.name = "ValidationError";
    error.errors = { [invalid[0]]: { message: error.message } };
    throw error;
  }
}

async function saveRevision(article, actorId, reason, session) {
  const revision = new ArticleRevision({
    article: article._id,
    revision: article.currentRevision,
    snapshot: snapshot(article),
    reason: String(reason || "").trim().slice(0, 500),
    createdBy: actorId,
  });
  await revision.save({ session: session || undefined });
}

export async function createArticle(value, actorId, reason = "Article created") {
  return inTransaction(async (session) => {
    await assertRelationships(value, session);
    const article = new Article({ ...value, updatedBy: actorId, currentRevision: 1 });
    await assertPublishable(article, session);
    await article.save({ session: session || undefined });
    await saveRevision(article, actorId, reason, session);
    return article;
  });
}

export async function updateArticle(id, value, actorId, reason = "Article updated") {
  return inTransaction(async (session) => {
    const article = await withSession(Article.findOne({ _id: id, deletedAt: null }), session);
    if (!article) return null;

    const oldCategory = await withSession(ArticleCategory.findById(article.category).select("slug"), session);
    const oldArticleSlug = article.slug;
    await assertRelationships(value, session);
    Object.assign(article, value, { updatedBy: actorId, currentRevision: article.currentRevision + 1 });
    await assertPublishable(article, session);
    await article.save({ session: session || undefined });

    const newCategory = await withSession(ArticleCategory.findById(article.category).select("slug"), session);
    const pathChanged = oldCategory?.slug !== newCategory?.slug || oldArticleSlug !== article.slug;
    if (pathChanged && oldCategory?.slug) {
      await ArticleRedirect.updateOne(
        { fromCategorySlug: oldCategory.slug, fromArticleSlug: oldArticleSlug, article: article._id },
        { $set: { active: true, statusCode: 308, createdBy: actorId } },
        { upsert: true, session: session || undefined },
      );
    }
    if (newCategory?.slug) {
      await withSession(ArticleRedirect.deleteOne({ fromCategorySlug: newCategory.slug, fromArticleSlug: article.slug, article: article._id }), session);
    }
    await saveRevision(article, actorId, reason, session);
    return article;
  });
}

export async function trashArticle(id, actorId) {
  return inTransaction(async (session) => {
    const article = await withSession(Article.findOne({ _id: id, deletedAt: null }), session);
    if (!article) return null;
    article.status = "archived";
    article.deletedAt = new Date();
    article.updatedBy = actorId;
    article.currentRevision += 1;
    await article.save({ session: session || undefined });
    await saveRevision(article, actorId, "Article archived", session);
    return article;
  });
}

export async function listArticles({ filter, page, limit }) {
  const [articles, total] = await Promise.all([
    Article.find(filter).populate("category", "name slug status").populate("author", "name lastName avatar").populate("tags", "name slug").sort({ pinned: -1, updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Article.countDocuments(filter),
  ]);
  return { articles, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getArticleForAdmin(id) {
  return Article.findOne({ _id: id, deletedAt: null }).populate("category", "name slug status").populate("author", "name lastName avatar").populate("tags", "name slug status").lean();
}

export async function updateArticleCategory(category, value, actorId) {
  return inTransaction(async (session) => {
    const oldSlug = category.slug;
    const nextSlug = value.slug || oldSlug;
    await assertArticleCategoryRouteAvailable(nextSlug, session);
    await assertCategoryParent(category._id, value.parent === undefined ? category.parent : value.parent, session);
    if (value.status === "archived" && await withSession(Article.exists({ category: category._id, deletedAt: null }), session)) {
      throw validationError("status", "Category is used by articles and cannot be archived");
    }
    Object.assign(category, value, { updatedBy: actorId });
    if (category.parent && String(category.parent) === String(category._id)) {
      const error = new Error("A category cannot be its own parent");
      error.name = "ValidationError";
      error.errors = { parent: { message: error.message } };
      throw error;
    }
    await category.save({ session: session || undefined });
    if (oldSlug !== category.slug) {
      const articles = await withSession(Article.find({ category: category._id, deletedAt: null }).select("_id slug"), session);
      if (articles.length) {
        await ArticleRedirect.bulkWrite(articles.map((article) => ({
          updateOne: {
            filter: { fromCategorySlug: oldSlug, fromArticleSlug: article.slug, article: article._id },
            update: { $set: { active: true, statusCode: 308, createdBy: actorId } },
            upsert: true,
          },
        })), { session: session || undefined, ordered: true });
      }
    }
    return category;
  });
}

export async function resolvePublishedArticle(categorySlug, articleSlug) {
  const normalizedCategory = normalizeArticleSlug(categorySlug);
  const normalizedArticle = normalizeArticleSlug(articleSlug);
  const category = await ArticleCategory.findOne({ slug: normalizedCategory, status: "active" }).select("_id slug").lean();
  if (category) {
    const now = new Date();
    const article = await Article.findOne({
      category: category._id,
      slug: normalizedArticle,
      ...publicArticleFilter(now),
    })
      .populate("category", "name slug description seo cover").populate("author", "name lastName avatar").populate("tags", "name slug").lean();
    if (article) return { kind: "article", article };
  }

  const redirect = await ArticleRedirect.findOne({ fromCategorySlug: normalizedCategory, fromArticleSlug: normalizedArticle, active: true }).lean();
  if (!redirect) return null;
  const target = await Article.findOne({
    _id: redirect.article,
    ...publicArticleFilter(),
  }).populate("category", "slug status").lean();
  if (!target || target.category?.status !== "active") return null;
  return { kind: "redirect", statusCode: redirect.statusCode, location: buildArticlePath(target.category.slug, target.slug) };
}

export async function listArticleRevisions(articleId, page = 1, limit = 20) {
  const safeLimit = Math.min(100, Math.max(1, limit));
  const [revisions, total] = await Promise.all([
    ArticleRevision.find({ article: articleId }).select("article revision schemaVersion reason createdBy createdAt").populate("createdBy", "name lastName avatar").sort({ revision: -1 }).skip((page - 1) * safeLimit).limit(safeLimit).lean(),
    ArticleRevision.countDocuments({ article: articleId }),
  ]);
  return { revisions, pagination: { page, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) } };
}
