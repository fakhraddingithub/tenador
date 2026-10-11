/**
 * navbarCategoryTree — منطقِ خالصِ «دسته‌های ساختاری» نوبار.
 *
 * navData از روی محصول ساخته می‌شود، پس والدهایی مثل «پوشاک» یا «اکسسوری» که
 * محصولِ مستقیم ندارند اصلاً در لیست نمی‌آیند و زیردسته‌هایشان یتیم شده و به‌جای
 * والد، خودشان به‌عنوان ریشه نمایش داده می‌شوند. این ماژول آن والدها را (تا هر
 * تعداد سطح) با پرچمِ hasProducts:false برمی‌گرداند. صفحه‌ی والد محصولات کل
 * زیر‌درخت را نمایش می‌دهد، بنابراین والد هم قابل لینک‌کردن است.
 *
 * بدونِ وابستگی به mongoose/next تا با `node --test` قابلِ آزمون باشد.
 */

import { categorySupportsSport } from "./categorySportVisibility.js";

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
      if (!doc || !categorySupportsSport(doc, sport._id)) continue;
      present.add(parentId);
      categories.push({
        _id: doc._id,
        title: doc.title,
        sport: doc.sport,
        additionalSports: doc.additionalSports,
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
 * مخاطب و برند هر والد = اجتماع داده‌های خودش و کل زیر‌درختش.
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
    category.audiences = Array.from(set);
    const brands = new Map();
    for (const brand of [
      ...(category.brands || []),
      ...kidsOf(key).flatMap((kid) => kid.brands || []),
    ]) {
      const previous = brands.get(id(brand._id));
      brands.set(id(brand._id), {
        ...brand,
        audiences: [...new Set([...(previous?.audiences || []), ...(brand.audiences || [])])],
        filterValues: [...new Set([...(previous?.filterValues || []), ...(brand.filterValues || [])])],
      });
    }
    category.brands = [...brands.values()].sort((a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
    return set;
  };

  for (const category of categories) subtree(category);
  return categories;
}
