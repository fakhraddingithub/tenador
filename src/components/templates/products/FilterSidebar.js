import { useState } from "react";
import { FaChevronDown, FaFilter, FaHistory } from "react-icons/fa";
import MobileFilterDrawer from "@/components/features/filters/MobileFilterDrawer";
import AttributeFilters from "@/components/features/filters/AttributeFilters";
import { countActiveAttrFilters } from "@/lib/attributeFilters";

export default function FilterSidebar({
  initialProducts,
  filters,
  setFilters,
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

  const resetFilters = () => {
    setFilters({
      brands: [],
      categories: [],
      sports: [],
      minPrice: 0,
      maxPrice: 50000000,
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
    (filters.maxPrice < 50000000 ? 1 : 0) +
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
        <FilterGroup
          title="ورزش تخصصی"
          items={sports}
          type="sports"
          filters={filters}
          setFilters={setFilters}
        />

        {/* فیلتر دسته‌بندی (Category) */}
        <FilterGroup
          title="نوع محصول"
          items={categories}
          type="categories"
          filters={filters}
          setFilters={setFilters}
        />

        {/* فیلتر برند (Brand) */}
        <FilterGroup
          title="برندهای معتبر"
          items={brands}
          type="brands"
          filters={filters}
          setFilters={setFilters}
        />

        {/* فیلتر قیمت عددی */}
        <div className="p-5 border-b border-gray-50">
          <h4 className="text-sm font-bold text-[#1a1a1a] mb-4">
            محدوده قیمت (تومان)
          </h4>
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="از"
                value={filters.minPrice}
                onChange={(e) =>
                  setFilters({ ...filters, minPrice: Number(e.target.value) })
                }
                className="w-1/2 h-10 bg-gray-50 border border-gray-100 rounded-[6px] text-xs px-2 focus:border-[#aa4725] outline-none font-bold"
              />
              <input
                type="number"
                placeholder="تا"
                value={filters.maxPrice}
                onChange={(e) =>
                  setFilters({ ...filters, maxPrice: Number(e.target.value) })
                }
                className="w-1/2 h-10 bg-gray-50 border border-gray-100 rounded-[6px] text-xs px-2 focus:border-[#aa4725] outline-none font-bold"
              />
            </div>
            {/* اسلایدر بصری */}
            <input
              type="range"
              min="0"
              max="50000000"
              step="500000"
              value={filters.maxPrice}
              onChange={(e) =>
                setFilters({ ...filters, maxPrice: Number(e.target.value) })
              }
              className="w-full accent-[#aa4725] h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* ویژگی‌های پویای دسته‌بندی (رنگ، وزن، اندازه صفحه و ...) —
            کامپوننتِ مشترکِ دکمه‌ایِ AttributeFilters (شاملِ گریدِ ۱۶ رنگ). */}
        <AttributeFilters
          attrMeta={attributeMeta}
          attrFilters={attrFilters}
          setAttrFilters={setAttrFilters}
        />
      </div>
    </div>
    </MobileFilterDrawer>
  );
}

// کامپوننت کمکی برای گروه‌های فیلتر
function FilterGroup({ title, items, type, filters, setFilters }) {
  const [isOpen, setIsOpen] = useState(true);

  const toggleItem = (id) => {
    // تبدیل ID به رشته برای اطمینان از مقایسه درست
    const stringId = id.toString();
    const currentItems = filters[type] || [];

    const isAlreadySelected = currentItems.includes(stringId);

    const nextItems = isAlreadySelected
      ? currentItems.filter((i) => i !== stringId) // حذف اگر قبلاً بود
      : [...currentItems, stringId]; // اضافه کردن اگر نبود

    setFilters({
      ...filters,
      [type]: nextItems,
    });
  };

  return (
    <div className="border-b border-gray-50 last:border-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
      >
        <span className="text-sm font-bold text-[#1a1a1a]">{title}</span>
        <FaChevronDown
          size={10}
          className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="px-5 pb-5 flex flex-col gap-3 max-h-52 overflow-y-auto custom-scrollbar">
          {items.map((item) => {
            // استخراج ID به صورت رشته
            const id = (item._id || item).toString();
            const label = item.title || item.name || item;
            const isActive = filters[type]?.includes(id);

            return (
              <div
                key={id}
                onClick={() => toggleItem(id)} // اینجا مستقیم روی دیو کلیک می‌کنیم
                className="flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center transition-all 
                      ${isActive ? "bg-[#aa4725] border-[#aa4725]" : "border-gray-200 group-hover:border-[#aa4725]"}`}
                  >
                    {isActive && (
                      <div className="w-1.5 h-1.5 bg-white rounded-full shadow-sm" />
                    )}
                  </div>
                  <span
                    className={`text-xs font-bold transition-colors ${isActive ? "text-[#aa4725]" : "text-gray-500 group-hover:text-gray-800"}`}
                  >
                    {label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
