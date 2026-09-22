import { useMemo } from "react";
import { FaFilter, FaHistory } from "react-icons/fa";
import MobileFilterDrawer from "@/components/features/filters/MobileFilterDrawer";
import AttributeFilters from "@/components/features/filters/AttributeFilters";
import FilterGroup from "@/components/features/filters/FilterGroup";
import PriceRangeFilter, {
  getListingPriceToman,
} from "@/components/features/filters/PriceRangeFilter";
import { countActiveAttrFilters } from "@/lib/attributeFilters";

export default function FilterSidebar({
  initialProducts,
  filters,
  setFilters,
  hideSportFilter = false,
  categoryFilter = null,
  // اگر پاس داده شود، به‌جای استخراج سری‌ها از محصولات، همین لیست (مثلاً فقط
  // سری‌های ریشه) به‌عنوان گزینه‌های فیلتر «سری» نمایش داده می‌شود.
  seriesOptions = null,
  // فیلترهای ویژگیِ پویای دسته‌بندی (دکمه‌های انتخابی + گریدِ رنگ) — کامپوننتِ
  // مشترکِ AttributeFilters همه‌جا از همین props استفاده می‌کند.
  attributeMeta = [],
  attrFilters = {},
  setAttrFilters = () => {},
}) {
  // استخراج داده‌های یکتا برای فیلترها
  const getUniqueItems = (products, key) => {
    const items = products.map((p) => p[key]).filter(Boolean);
    // استفاده از Map برای حذف تکراری‌ها بر اساس _id
    // و مرتب‌سازی بر اساس ترتیب دستی ادمین (order)
    return Array.from(
      new Map(
        items.map((item) => [item._id?.toString() || item, item]),
      ).values(),
    ).sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) -
        (b.order ?? Number.MAX_SAFE_INTEGER),
    );
  };

  const brands = getUniqueItems(initialProducts, "brand");
  const sports = getUniqueItems(initialProducts, "sport");
  const categories = getUniqueItems(initialProducts, "category");
  const series = seriesOptions ?? getUniqueItems(initialProducts, "serie");

  // دامنه‌ی اسلایدرِ قیمت از روی قیمتِ نمایشیِ (تومان) محصولاتِ همین صفحه
  const priceBounds = useMemo(() => {
    let maxSeen = 0;
    for (const p of initialProducts) {
      const v = getListingPriceToman(p);
      if (v > maxSeen) maxSeen = v;
    }
    return { min: 0, max: maxSeen };
  }, [initialProducts]);

  const resetFilters = () => {
    setFilters({
      brands: [],
      categories: [],
      sports: [],
      series: [],
      minPrice: 0,
      maxPrice: 0, // 0 = بدون سقف
    });
    setAttrFilters({});
  };

  // تعداد فیلترهای فعال — فقط برای نمایش بج روی دکمه‌ی موبایل (منطق فیلتر تغییر نمی‌کند)
  const activeCount =
    (filters.brands?.length || 0) +
    (filters.categories?.length || 0) +
    (filters.sports?.length || 0) +
    (filters.series?.length || 0) +
    (filters.minPrice > 0 ? 1 : 0) +
    (filters.maxPrice > 0 ? 1 : 0) +
    countActiveAttrFilters(attrFilters);

  return (
    <MobileFilterDrawer activeCount={activeCount} onReset={resetFilters}>
    <div className="flex flex-col gap-5 sticky top-24">
      {/* هدر فیلتر */}
      <div className="flex items-center justify-between bg-white p-4 rounded-[6px] border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 font-bold text-[#1a1a1a]">
          <FaFilter className="text-[#aa4725]" size={14} />
          <span>فیلترهای پیشرفته</span>
        </div>
        <button
          onClick={resetFilters}
          className="text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
        >
          <FaHistory /> حذف فیلترها
        </button>
      </div>

      <div className="bg-white rounded-[6px] border border-gray-100 shadow-sm overflow-hidden">
        {/* فیلتر ورزش (Sport) */}
        {!hideSportFilter && (
          <FilterGroup
            title="ورزش تخصصی"
            items={sports}
            type="sports"
            filters={filters}
            setFilters={setFilters}
          />
        )}

        {/* فیلتر دسته‌بندی (Category) — اگر slotِ سفارشی داده شده باشد، همان
            slot در انتهای سایدبار رندر می‌شود، نه اینجا. */}
        {!categoryFilter && <FilterGroup
          title="نوع محصول"
          items={categories}
          type="categories"
          filters={filters}
          setFilters={setFilters}
        />}

        {/* فیلتر برند (Brand) */}
        <FilterGroup
          title="برندهای معتبر"
          items={brands}
          type="brands"
          filters={filters}
          setFilters={setFilters}
        />

        <FilterGroup
          title="سری محصولات"
          items={series}
          type="series"
          filters={filters}
          setFilters={setFilters}
        />
        {/* فیلتر قیمت — کامپوننتِ مشترکِ اسلایدرِ دوسَره + اینپوت‌های هزارگان‌دار */}
        <PriceRangeFilter
          className="p-5 border-b border-gray-50"
          bounds={priceBounds}
          value={{ min: filters.minPrice || 0, max: filters.maxPrice || 0 }}
          onChange={({ min, max }) =>
            setFilters({ ...filters, minPrice: min, maxPrice: max })
          }
        />

        {/* ویژگی‌های پویای دسته‌بندی (رنگ، وزن، اندازه صفحه و ...) —
            کامپوننتِ مشترکِ دکمه‌ایِ AttributeFilters (شاملِ گریدِ ۱۶ رنگ). */}
        <AttributeFilters
          attrMeta={attributeMeta}
          attrFilters={attrFilters}
          setAttrFilters={setAttrFilters}
        />

        {/* slotِ «نوع محصول + ویژگی‌هایش» — آخرین بخشِ فیلترها (صفحه‌ی سری) */}
        {categoryFilter}
      </div>
    </div>
    </MobileFilterDrawer>
  );
}
