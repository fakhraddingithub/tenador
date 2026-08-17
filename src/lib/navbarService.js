import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import Sport from "base/models/Sport";
import Product from "base/models/Product";
import Category from "base/models/Category";
import { getEffectiveTargetAudienceFilters } from "base/utils/targetAudience";
import {
  fillStructuralAudiences,
  insertStructuralParents,
  missingParentIds,
} from "base/utils/navbarCategoryTree";
// Variant فقط برای ثبتِ مدل (side-effect) لازم است تا lookup روی کالکشنِ variants کار کند
import "base/models/Variant";

// ترتیب دستی ادمین؛ آیتم‌های بدون order در انتها قرار می‌گیرند
const byOrder = (a, b) =>
  (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);

function visibleSportsExpression(categoryPath) {
  const ownerSport = `${categoryPath}.sport`;
  const additionalSports = `${categoryPath}.additionalSports`;
  return {
    $cond: [
      { $gt: [{ $size: { $ifNull: [additionalSports, []] } }, 0] },
      {
        $setUnion: [
          [ownerSport],
          { $ifNull: [additionalSports, []] },
        ],
      },
      {
        $cond: [
          { $eq: ["$sport", ownerSport] },
          ["$sport"],
          [],
        ],
      },
    ],
  };
}

/**
 * والدهای «ساختاری» (بدونِ محصولِ مستقیم) را به لیستِ دسته‌های هر ورزش برمی‌گرداند.
 * اجداد سطح‌به‌سطح واکشی می‌شوند چون والدِ والد هم ممکن است محصولِ مستقیم نداشته باشد.
 */
async function attachStructuralParents(sports) {
  const docsById = new Map();
  let frontier = missingParentIds(sports);
  while (frontier.length > 0) {
    const rows = await Category.find({ _id: { $in: frontier } })
      .select("_id title slug icon order parent")
      .lean();
    const next = [];
    for (const row of rows) {
      docsById.set(String(row._id), row);
      if (row.parent && !docsById.has(String(row.parent))) next.push(row.parent);
    }
    frontier = next;
  }
  if (docsById.size > 0) insertStructuralParents(sports, docsById);
}

async function buildNavbarData() {
  await connectToDB();

  // ───────────────────────────────────────────────────────────────────────
  // ۱) ورزش‌ها + دسته‌بندی‌ها (به همراه برندهای هر دسته) + فیلدِ parent برای
  //    ساختِ درختِ والد/فرزندِ ستونِ دوم. برندهای هر دسته از روی محصول استنتاج
  //    می‌شوند (برندهایی که در آن دسته دستِ‌کم یک محصول دارند).
  // ───────────────────────────────────────────────────────────────────────
  const [sports, categoryRows] = await Promise.all([
    Sport.find({})
      .select("_id title slug icon order")
      .sort({ order: 1 })
      .lean(),
    Product.aggregate([
      {
        $match: {
          isActive: true,
          sport: { $ne: null },
          category: { $ne: null },
          brand: { $ne: null },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      { $addFields: { _visibleSports: visibleSportsExpression("$category") } },
      { $unwind: "$_visibleSports" },
      {
        $lookup: {
          from: "brands",
          localField: "brand",
          foreignField: "_id",
          as: "brand",
        },
      },
      { $unwind: "$brand" },
      {
        $group: {
          _id: { sport: "$_visibleSports", category: "$category._id" },
          title: { $first: "$category.title" },
          slug: { $first: "$category.slug" },
          icon: { $first: "$category.icon" },
          order: { $first: "$category.order" },
          parent: { $first: "$category.parent" },
          brands: {
            $addToSet: {
              _id: "$brand._id",
              title: "$brand.title",
              slug: "$brand.slug",
              icon: "$brand.icon",
              order: "$brand.order",
            },
          },
        },
      },
    ]),
  ]);

  const sportMap = new Map();
  for (const sport of sports) {
    sport.categories = [];
    sportMap.set(sport._id.toString(), sport);
  }
  for (const row of categoryRows) {
    const sport = sportMap.get(row._id.sport.toString());
    if (!sport) continue;
    sport.categories.push({
      _id: row._id.category,
      title: row.title,
      slug: row.slug,
      icon: row.icon,
      order: row.order,
      parent: row.parent,
      brands: row.brands,
    });
  }

  await attachStructuralParents(sports);

  // ───────────────────────────────────────────────────────────────────────
  // ۲) فراداده‌ی «ویژگیِ فیلترِ مگامنو» هر دسته: نام، برچسب و گزینه‌های تعریف‌شده.
  //    ویژگی می‌تواند ثابت (attributes) یا متغیر (variantAttributes) باشد.
  // ───────────────────────────────────────────────────────────────────────
  const catDocs = await Category.find({
    megaMenuFilterAttribute: { $type: "string", $ne: "" },
  })
    .select("_id megaMenuFilterAttribute attributes variantAttributes")
    .lean();

  // categoryId → { name, label, options }
  const catFilterMeta = new Map();
  for (const c of catDocs) {
    const name = c.megaMenuFilterAttribute;
    const def = [...(c.attributes || []), ...(c.variantAttributes || [])].find(
      (a) => a.name === name,
    );
    if (!def) continue;
    catFilterMeta.set(c._id.toString(), {
      name,
      label: def.label || name,
      options: Array.isArray(def.options) ? def.options : [],
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // ۳) مقادیرِ موجودِ ویژگیِ فیلتر، به تفکیکِ (ورزش، دسته، برند). یک aggregation
  //    که هم ویژگی‌های ثابت (product.attributes) و هم متغیر (variant.attributes)
  //    را پوشش می‌دهد. فقط دسته‌هایی که megaMenuFilterAttribute دارند درگیر می‌شوند.
  // ───────────────────────────────────────────────────────────────────────
  let attrBrandAgg = [];
  if (catFilterMeta.size > 0) {
    attrBrandAgg = await Product.aggregate([
      {
        $match: {
          isActive: true,
          sport: { $ne: null },
          category: { $ne: null },
          brand: { $ne: null },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "cat",
        },
      },
      { $unwind: "$cat" },
      { $addFields: { _visibleSports: visibleSportsExpression("$cat") } },
      { $unwind: "$_visibleSports" },
      { $match: { "cat.megaMenuFilterAttribute": { $type: "string", $ne: "" } } },
      {
        $lookup: {
          from: "variants",
          localField: "_id",
          foreignField: "productId",
          as: "vars",
        },
      },
      {
        $addFields: {
          _attr: "$cat.megaMenuFilterAttribute",
          _prodPairs: { $objectToArray: { $ifNull: ["$attributes", {}] } },
          _varPairs: {
            $reduce: {
              input: { $ifNull: ["$vars", []] },
              initialValue: [],
              in: {
                $concatArrays: [
                  "$$value",
                  { $objectToArray: { $ifNull: ["$$this.attributes", {}] } },
                ],
              },
            },
          },
        },
      },
      {
        $addFields: {
          _vals: {
            $map: {
              input: {
                $filter: {
                  input: { $concatArrays: ["$_prodPairs", "$_varPairs"] },
                  as: "p",
                  cond: { $eq: ["$$p.k", "$_attr"] },
                },
              },
              as: "m",
              in: "$$m.v",
            },
          },
        },
      },
      { $unwind: "$_vals" },
      { $match: { _vals: { $nin: [null, ""] } } },
      {
        $group: {
          _id: { sport: "$_visibleSports", category: "$category", brand: "$brand" },
          values: { $addToSet: "$_vals" },
        },
      },
    ]);
  }

  // نگاشت‌ها: مقادیرِ هر برند در هر دسته + اجتماعِ مقادیرِ هر دسته (برای تب‌ها)
  const valuesByCatBrand = new Map(); // `${sport}|${category}` → Map(brandId → Set(values))
  const valuesByCat = new Map(); // categoryId → Set(values)
  // هر مقداری که شاملِ کاما فارسی «،» باشد را بدون قید و شرط به تکه‌های جداگانه می‌شکند
  // (مثلاً «خانم‌ها،آقایان» → «خانم‌ها» و «آقایان»)، تا محصولی که برای چند گروه مناسب است
  // زیرِ همان گزینه‌های واقعی دیده شود، نه به‌عنوان یک گزینه‌ی ترکیبیِ جداگانه.
  function expandCompositeValues(values) {
    const out = [];
    for (const raw of values) {
      const v = String(raw);
      if (v.includes("،")) {
        const parts = v
          .split("،")
          .map((p) => p.trim())
          .filter(Boolean);
        if (parts.length > 0) {
          out.push(...parts);
        }
        continue;
      }
      out.push(v);
    }
    return out;
  }

  for (const row of attrBrandAgg) {
    const catKey = row._id.category.toString();
    const expanded = expandCompositeValues(row.values.map(String));

    const sCatKey = `${row._id.sport}|${row._id.category}`;
    let inner = valuesByCatBrand.get(sCatKey);
    if (!inner) {
      inner = new Map();
      valuesByCatBrand.set(sCatKey, inner);
    }
    inner.set(row._id.brand.toString(), new Set(expanded));

    let cu = valuesByCat.get(catKey);
    if (!cu) {
      cu = new Set();
      valuesByCat.set(catKey, cu);
    }
    for (const v of expanded) cu.add(v);
  }

  // ───────────────────────────────────────────────────────────────────────
  // ۴) مخاطبِ هدف (targetAudience) — مستقل از مکانیزمِ megaMenuFilterAttribute
  //    بالا (Stage 0: عمداً بدونِ ادغام). فیلدِ ثابتِ محصول است، نه یک ویژگیِ
  //    پویا؛ پس فقط یک aggregation ساده به تفکیکِ (ورزش، دسته، برند) لازم است.
  // ───────────────────────────────────────────────────────────────────────
  const audienceAgg = await Product.aggregate([
    {
      $match: {
        isActive: true,
        sport: { $ne: null },
        category: { $ne: null },
        brand: { $ne: null },
        targetAudience: { $nin: [null, ""] },
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "category",
        foreignField: "_id",
        as: "cat",
      },
    },
    { $unwind: "$cat" },
    { $addFields: { _visibleSports: visibleSportsExpression("$cat") } },
    { $unwind: "$_visibleSports" },
    {
      $group: {
        _id: { sport: "$_visibleSports", category: "$category", brand: "$brand" },
        values: { $addToSet: "$targetAudience" },
      },
    },
  ]);

  const audienceByCatBrand = new Map(); // `${sport}|${category}` → Map(brandId → Set(values))
  const audienceByCategory = new Map(); // categoryId → Set(values)
  const audienceBySport = new Map(); // sportId → Set(values)

  for (const row of audienceAgg) {
    const { sport: sportId, category: categoryId, brand: brandId } = row._id;
    const sKey = sportId.toString();
    const cKey = categoryId.toString();
    const bKey = brandId.toString();
    // دادهٔ قدیمی «همه» نیز اینجا به مردانه+زنانه گسترش می‌یابد؛ بچگانه فقط
    // با محصولی که صریحاً بچگانه است در navData ثبت می‌شود.
    const values = getEffectiveTargetAudienceFilters(row.values.map(String));

    const scKey = `${sKey}|${cKey}`;
    let inner = audienceByCatBrand.get(scKey);
    if (!inner) {
      inner = new Map();
      audienceByCatBrand.set(scKey, inner);
    }
    inner.set(bKey, new Set(values));

    let catSet = audienceByCategory.get(cKey);
    if (!catSet) {
      catSet = new Set();
      audienceByCategory.set(cKey, catSet);
    }
    for (const v of values) catSet.add(v);

    let sportSet = audienceBySport.get(sKey);
    if (!sportSet) {
      sportSet = new Set();
      audienceBySport.set(sKey, sportSet);
    }
    for (const v of values) sportSet.add(v);
  }

  // ───────────────────────────────────────────────────────────────────────
  // ۵) چسباندنِ فیلترِ ویژگی به هر دسته: تب‌های مقدار (megaMenuFilter) و
  //    مقادیرِ هر برند (brand.filterValues) — برای فیلترِ category→brand در مگامنو.
  // ───────────────────────────────────────────────────────────────────────
  for (const sport of sports) {
    sport.categories.sort(byOrder);
    sport.audiences = Array.from(audienceBySport.get(sport._id.toString()) || []);

    for (const category of sport.categories) {
      category.brands?.sort(byOrder);
      category.audiences = Array.from(
        audienceByCategory.get(category._id.toString()) || [],
      );

      const fm = catFilterMeta.get(category._id.toString());
      const present = fm ? valuesByCat.get(category._id.toString()) : null;

      if (fm && present && present.size > 0) {
        // ترتیبِ تب‌ها: ابتدا به‌ترتیبِ گزینه‌های تعریف‌شده، سپس سایرِ مقادیرِ موجود
        const ordered = [];
        for (const o of fm.options) {
          const v = String(o);
          if (present.has(v) && !ordered.includes(v)) ordered.push(v);
        }
        for (const v of present) {
          if (!ordered.includes(v)) ordered.push(v);
        }

        category.megaMenuFilter = {
          name: fm.name,
          label: fm.label,
          values: ordered,
        };
      } else {
        category.megaMenuFilter = null;
      }

      const brandVals = valuesByCatBrand.get(`${sport._id}|${category._id}`);
      const catAudienceVals = audienceByCatBrand.get(`${sport._id}|${category._id}`);
      for (const brand of category.brands || []) {
        const set = brandVals?.get(brand._id.toString());
        brand.filterValues = set ? Array.from(set) : [];
        brand.audiences = Array.from(
          catAudienceVals?.get(brand._id.toString()) || [],
        );
      }
    }

    fillStructuralAudiences(sport.categories);
  }

  return sports;
}

export const getCachedNavbar = unstable_cache(
  async () => {
    const data = await buildNavbarData();
    return JSON.parse(JSON.stringify(data));
  },
  // کلید با اضافه‌شدنِ دسته‌های ساختاری (hasProducts) بامپ شد تا کشِ قدیمی سرو نشود
  ["navbar-data", "target-audience-unisex-v1", "structural-parents-v1"],
  { revalidate: 10800, tags: ["navbar"] },
);
