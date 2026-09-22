"use client";

import AttributeFilters from "@/components/features/filters/AttributeFilters";
import FilterGroup from "@/components/features/filters/FilterGroup";
import { mergeAttributeMeta } from "@/lib/attributeFilters";

/**
 * «نوع محصول + ویژگی‌هایش» — آخرین بخشِ سایدبارِ صفحه‌های سری/برند.
 *
 * انتخابِ دسته چندتایی و چک‌باکسی است (دقیقاً همان FilterGroupِ صفحه‌ی ورزش).
 * تا وقتی هیچ دسته‌ای انتخاب نشده، ویژگی‌های «همه‌ی» دسته‌هایی که در این صفحه
 * محصول دارند نشان داده می‌شوند؛ با انتخابِ دسته، فقط ویژگی‌های همان دسته‌ها
 * می‌مانند. ویژگی‌های هم‌نامِ چند دسته در یک بخش ادغام می‌شوند.
 *
 * fixedCategory یعنی دسته از خودِ مسیر می‌آید (صفحه‌ی برند+دسته): نه انتخابگری
 * رندر می‌شود و نه — وقتی مسیر هیچ دسته‌ای ندارد — ویژگی‌ای.
 *
 * کارت ندارد: والد آن را داخلِ کارتِ خودش می‌گذارد (همان الگوی FilterGroup).
 */
export default function CategoryAttributeFilters({
  categories = [],
  selected = [],
  fixedCategory = false,
  attributes = {},
  onCategoryChange,
  onAttributesChange,
}) {
  return (
    <>
      {!fixedCategory && categories.length > 0 && (
        <FilterGroup
          title="نوع محصول"
          items={categories}
          type="categories"
          filters={{ categories: selected }}
          setFilters={(next) => onCategoryChange(next.categories)}
        />
      )}
      <AttributeFilters
        attrMeta={mergeAttributeMeta(activeCategories(categories, selected, fixedCategory))}
        attrFilters={attributes}
        setAttrFilters={onAttributesChange}
      />
    </>
  );
}

/**
 * دسته‌هایی که ویژگی‌هایشان باید دیده شود. بدونِ انتخاب: همه (مگر در حالتِ
 * fixedCategory که «بدونِ انتخاب» یعنی مسیر دسته ندارد، پس هیچ‌کدام).
 * export شده تا والدها بتوانند همین مجموعه را برای هرس‌کردنِ فیلترهای
 * ناپیدا بخوانند — نمایش و فیلتر نباید از هم جدا شوند.
 */
export function activeCategories(categories, selected = [], fixedCategory = false) {
  if (selected.length === 0) return fixedCategory ? [] : categories;
  return categories.filter((c) => selected.includes(String(c._id)));
}

/** فیلترهای ویژگیِ دیگر نامرئی را دور می‌ریزد (پس از تغییرِ انتخابِ دسته). */
export function pruneAttributes(attributes, categories, selected, fixedCategory = false) {
  const visible = new Set(
    mergeAttributeMeta(activeCategories(categories, selected, fixedCategory)).map((m) => m.name),
  );
  return Object.fromEntries(Object.entries(attributes || {}).filter(([name]) => visible.has(name)));
}
