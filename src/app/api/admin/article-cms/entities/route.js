import { matchesSearch, rankBySearch, withSearch } from "@/lib/search";
import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Article from "base/models/Article";
import Brand from "base/models/Brand";
import Category from "base/models/Category";
import Product from "base/models/Product";
import Serie from "base/models/Serie";
import Sport from "base/models/Sport";
import UsedProduct from "base/models/UsedProduct";
import requireAdminPermission from "@/lib/requireAdminPermission";
import { articleApiError } from "@/lib/articleApi";
import { rankProducts, withProductSearch } from "@/lib/productSearch";
import { getSportSeriesOptions } from "base/services/series.service";
import { getReviewCardsByIds, searchReviewCards } from "base/services/comment.service";

export const runtime = "nodejs";

// چند برابرِ سقفِ نمایش واکشی می‌شود تا رتبه‌بندی روی استخرِ معنادار انجام شود
const RESULT_LIMIT = 20;
const CANDIDATE_LIMIT = 120;

const byTitle = (q) => withSearch({}, q, ["title", "name"]);
const rankByTitle = (q, docs) =>
  rankBySearch(q, docs, (d) => [[d.title, 2], [d.name, 1]]).slice(0, RESULT_LIMIT);

export async function GET(req) {
  const { denied } = await requireAdminPermission("articles.view");
  if (denied) return denied;

  try {
    await connectToDB();
    const params = new URL(req.url).searchParams;
    const type = params.get("type");
    const ids = (params.get("ids") || "").split(",").filter((id) => mongooseId(id));
    const q = params.get("q")?.trim() || "";
    const idFilter = ids.length ? { _id: { $in: ids } } : null;
    // با idFilter رتبه‌بندی بی‌معنی است (resolve با آی‌دی، نه جستجو)
    const rank = (docs, fn) => (idFilter ? docs : fn(docs));
    let items = [];

    if (type === "product") {
      const docs = await Product.find(idFilter || (await withProductSearch({}, q)))
        .select("name sku tag color serie mainImage brand").populate("brand", "title name").limit(CANDIDATE_LIMIT).lean();
      items = rank(docs, (d) => rankProducts(q, d).slice(0, RESULT_LIMIT))
        .map((x) => ({ _id: x._id, label: x.name, sub: x.brand?.title || "", image: x.mainImage || null }));
    } else if (type === "brand") {
      const docs = await Brand.find(idFilter || byTitle(q)).select("title name logo").limit(CANDIDATE_LIMIT).lean();
      items = rank(docs, (d) => rankByTitle(q, d)).map((x) => ({ _id: x._id, label: x.title || x.name, image: x.logo || null }));
    } else if (type === "collection") {
      const docs = await Serie.find(idFilter || byTitle(q)).select("title name logo brand").populate("brand", "title").limit(CANDIDATE_LIMIT).lean();
      items = rank(docs, (d) => rankByTitle(q, d)).map((x) => ({ _id: x._id, label: x.title || x.name, sub: x.brand?.title || "", image: x.logo || null }));
    } else if (type === "sportSerie") {
      // بلوکِ «اسلایدر سری‌های ورزش»: جستجو فقط میانِ سری‌هایی که در ورزشِ
      // انتخاب‌شده محصول دارند (همان pipeline ـِ اسلایدرِ صفحه‌ی ورزش). بدونِ ورزش
      // چیزی برنمی‌گردد. resolve با ids فقط برچسبِ چیپ‌هاست و به ورزش نیازی ندارد.
      const label = (x) => [x.brand?.title, x.title || x.name].filter(Boolean).join(" ");
      if (idFilter) {
        const docs = await Serie.find(idFilter).select("title name logo image brand").populate("brand", "title").lean();
        items = docs.map((x) => ({ _id: x._id, label: label(x), image: x.logo || x.image || null }));
      } else {
        const options = await getSportSeriesOptions(params.get("sport"));
        const ranked = q
          ? rankBySearch(q, options.filter((d) => matchesSearch(q, `${d.title} ${d.name} ${d.brand?.title || ""}`)), (d) => [[d.title, 2], [d.name, 1], [d.brand?.title, 1]])
          : options;
        items = ranked.slice(0, 50).map((x) => ({
          _id: x._id,
          label: label(x),
          sub: `${x.productCount.toLocaleString("fa-IR")} محصول در این ورزش`,
          image: x.logo || x.image || null,
        }));
      }
    } else if (type === "sport") {
      const docs = await Sport.find(idFilter || byTitle(q)).select("title name image icon").limit(CANDIDATE_LIMIT).lean();
      items = rank(docs, (d) => rankByTitle(q, d)).map((x) => ({ _id: x._id, label: x.title || x.name, image: x.image || x.icon || null }));
    } else if (type === "category") {
      const docs = await Category.find(idFilter || byTitle(q)).select("title name image icon").limit(CANDIDATE_LIMIT).lean();
      items = rank(docs, (d) => rankByTitle(q, d)).map((x) => ({ _id: x._id, label: x.title || x.name, image: x.image || x.icon || null }));
    } else if (type === "article") {
      const docs = await Article.find({ ...(idFilter || withSearch({}, q, ["title", "slug"])), deletedAt: null })
        .select("title slug cover status").limit(CANDIDATE_LIMIT).lean();
      items = rank(docs, (d) => rankBySearch(q, d, (x) => [[x.title, 2], [x.slug, 1]]).slice(0, RESULT_LIMIT))
        .map((x) => ({ _id: x._id, label: x.title, sub: x.status, image: x.cover?.url || null }));
    } else if (type === "review") {
      // بلوکِ «اسلایدر نظرات»: فقط نظرهای سطح‌بالای تأییدشده (نو و دست‌دوم). برچسب
      // نویسنده و محصول است و زیرش ابتدای متن، تا نظرهای یک محصول از هم جدا شوند.
      const cards = idFilter ? await getReviewCardsByIds(ids) : await searchReviewCards(q);
      items = cards.map((card) => ({
        _id: card.id,
        label: `${card.author} — ${card.product.name}`,
        sub: `${card.rating ? `${"★".repeat(card.rating)} · ` : ""}${card.product.href ? "" : "دست‌دوم · "}${card.text.slice(0, 80)}`,
        image: card.product.image || null,
      }));
    } else if (type === "usedProduct") {
      const docs = await UsedProduct.find(idFilter || withSearch({}, q, ["name"])).select("name images status").limit(CANDIDATE_LIMIT).lean();
      items = rank(docs, (d) => rankBySearch(q, d, (x) => [[x.name, 1]]).slice(0, RESULT_LIMIT))
        .map((x) => ({ _id: x._id, label: x.name, sub: x.status || "", image: x.images?.[0] || null }));
    } else {
      return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
    }
    return NextResponse.json({ items });
  } catch (error) {
    return articleApiError(error, "[GET /api/admin/article-cms/entities]");
  }
}

function mongooseId(value) {
  return /^[a-f\d]{24}$/i.test(String(value));
}
