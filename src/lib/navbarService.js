import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import Sport from "base/models/Sport";
import Product from "base/models/Product";
import Category from "base/models/Category";
// Variant فقط برای ثبتِ مدل (side-effect) لازم است تا lookup روی کالکشنِ variants کار کند
import "base/models/Variant";

// ترتیب دستی ادمین؛ آیتم‌های بدون order در انتها قرار می‌گیرند
const byOrder = (a, b) =>
  (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);

async function buildNavbarData() {
  await connectToDB();

  // ───────────────────────────────────────────────────────────────────────
  // ۱) ورزش‌ها + دسته‌بندی‌ها (به همراه برندهای هر دسته) + فیلدِ parent برای
  //    ساختِ درختِ والد/فرزندِ ستونِ دوم. برندهای هر دسته از روی محصول استنتاج
  //    می‌شوند (برندهایی که در آن دسته دستِ‌کم یک محصول دارند).
  // ───────────────────────────────────────────────────────────────────────
  const sports = await Sport.aggregate([
    {
      $project: { _id: 1, title: 1, slug: 1, icon: 1, order: 1 },
    },
    {
      $lookup: {
        from: "products",
        let: { sportId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$sport", "$$sportId"] } } },
          {
            $lookup: {
              from: "categories",
              localField: "category",
              foreignField: "_id",
              as: "category",
            },
          },
          { $unwind: "$category" },
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
              _id: "$category._id",
              title: { $first: "$category.title" },
              slug: { $first: "$category.slug" },
              icon: { $first: "$category.icon" },
              order: { $first: "$category.order" },
              parent: { $first: "$category.parent" }, // برای درختِ والد/فرزند
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
        ],
        as: "categories",
      },
    },
    { $addFields: { categories: { $ifNull: ["$categories", []] } } },
    { $sort: { order: 1 } },
  ]);

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
          _id: { sport: "$sport", category: "$category", brand: "$brand" },
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
  // ۴) چسباندنِ فیلترِ ویژگی به هر دسته: تب‌های مقدار (megaMenuFilter) و
  //    مقادیرِ هر برند (brand.filterValues) — برای فیلترِ category→brand در مگامنو.
  // ───────────────────────────────────────────────────────────────────────
  for (const sport of sports) {
    sport.categories.sort(byOrder);

    for (const category of sport.categories) {
      category.brands?.sort(byOrder);

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

        const brandVals = valuesByCatBrand.get(`${sport._id}|${category._id}`);
        for (const brand of category.brands || []) {
          const set = brandVals?.get(brand._id.toString());
          brand.filterValues = set ? Array.from(set) : [];
        }
      } else {
        category.megaMenuFilter = null;
      }
    }
  }

  return sports;
}

export const getCachedNavbar = unstable_cache(
  async () => {
    const data = await buildNavbarData();
    return JSON.parse(JSON.stringify(data));
  },
  ["navbar-data"],
  { revalidate: 600, tags: ["navbar"] },
);
