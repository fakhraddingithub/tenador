/**
 * navbarCategoryTree — منطقِ خالصِ «دسته‌های ساختاری» نوبار.
 *
 * navData از روی محصول ساخته می‌شود، پس والدهایی مثل «پوشاک» یا «اکسسوری» که
 * محصولِ مستقیم ندارند اصلاً در لیست نمی‌آیند و زیردسته‌هایشان یتیم شده و به‌جای
 * والد، خودشان به‌عنوان ریشه نمایش داده می‌شوند. این ماژول آن والدها را (تا هر
 * تعداد سطح) با پرچمِ hasProducts:false برمی‌گرداند تا UI نمایششان بدهد ولی
 * لینکشان نکند.
 *
 * بدونِ وابستگی به mongoose/next تا با `node --test` قابلِ آزمون باشد.
 */

const id = (v) => (v == null ? null : String(v));

/** شناسه‌ی والدهایی که خودشان در لیستِ هیچ ورزشی نیستند (سطحِ اول). */
export function missingParentIds(sports) {
  const missing = new Set();
  for (const sport of sports) {
    const present = new Set((sport.categories || []).map((c) => id(c._id)));
    for (const c of sport.categories || []) {
      if (c.parent && !present.has(id(c.parent))) missing.add(id(c.parent));
    }
  }
  return Array.from(missing);
}

/**
 * والدهای گم‌شده را به لیستِ هر ورزش اضافه می‌کند (بالا رفتن تا ریشه).
 * docsById: Map از شناسه‌ی دسته → سندِ lean دسته.
 */
export function insertStructuralParents(sports, docsById) {
  for (const sport of sports) {
    const categories = sport.categories || [];
    const present = new Set(categories.map((c) => id(c._id)));
    const queue = categories.map((c) => c.parent).filter(Boolean);
    while (queue.length > 0) {
      const parentId = id(queue.shift());
      if (present.has(parentId)) continue;
      const doc = docsById.get(parentId);
      if (!doc) continue;
      present.add(parentId);
      categories.push({
        _id: doc._id,
        title: doc.title,
        slug: doc.slug,
        icon: doc.icon,
        order: doc.order,
        parent: doc.parent,
        brands: [],
        hasProducts: false,
      });
      if (doc.parent) queue.push(doc.parent);
    }
  }
  return sports;
}

/**
 * دسته‌ی ساختاری خودش محصول (و در نتیجه مخاطب) ندارد؛ اگر مخاطبش خالی بماند با
 * انتخابِ هر جنسیت از نوبار حذف می‌شود و فرزندانش دوباره یتیم می‌شوند. پس
 * مخاطبش = اجتماعِ مخاطبِ کلِ زیردرختش. دسته‌های محصول‌دار دست‌نخورده می‌مانند.
 */
export function fillStructuralAudiences(categories) {
  const kidsOf = (parentId) =>
    categories.filter((c) => c.parent && id(c.parent) === parentId);
  const done = new Set();

  const subtree = (category) => {
    const key = id(category._id);
    const set = new Set(category.audiences || []);
    if (done.has(key)) return set;
    done.add(key);
    for (const kid of kidsOf(key)) {
      for (const v of subtree(kid)) set.add(v);
    }
    if (category.hasProducts === false) category.audiences = Array.from(set);
    return set;
  };

  for (const category of categories) subtree(category);
  return categories;
}
