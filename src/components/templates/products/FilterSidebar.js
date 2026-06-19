import { useState } from "react";
import { FaChevronDown, FaFilter, FaHistory } from "react-icons/fa";
import MobileFilterDrawer from "@/components/features/filters/MobileFilterDrawer";
import { countActiveAttrFilters } from "@/lib/attributeFilters";

export default function FilterSidebar({
  initialProducts,
  filters,
  setFilters,
  // فیلترهای ویژگیِ پویای دسته‌بندی (چیپ/بازه) — فقط روی صفحه‌ی دسته پاس داده می‌شوند
  attributeMeta = [],
  attrFilters = {},
  setAttrFilters = () => {},
  // فیلترهای متنیِ آزاد بر اساس ویژگی‌های «قابل فیلتر» — فقط روی صفحه‌ی محصولات
  freeTextAttributes = [],
  attrInputs = {},
  onAttrInput = () => {},
  onResetFreeText = () => {},
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
    onResetFreeText();
  };

  const activeFreeTextCount = Object.values(attrInputs).filter(
    (v) => v && String(v).trim() !== "",
  ).length;

  // تعداد فیلترهای فعال — فقط برای نمایش بج روی دکمه‌ی موبایل (منطق فیلتر تغییر نمی‌کند)
  const activeCount =
    (filters.brands?.length || 0) +
    (filters.categories?.length || 0) +
    (filters.sports?.length || 0) +
    (filters.series?.length || 0) +
    (filters.minPrice > 0 ? 1 : 0) +
    (filters.maxPrice < 50000000 ? 1 : 0) +
    countActiveAttrFilters(attrFilters) +
    activeFreeTextCount;

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

        {/* ویژگی‌های پویای دسته‌بندی (رنگ، وزن، اندازه صفحه و ...) */}
        {attributeMeta.map((attr) =>
          attr.type === "number" ? (
            <NumericAttributeFilter
              key={attr.name}
              attr={attr}
              attrFilters={attrFilters}
              setAttrFilters={setAttrFilters}
            />
          ) : (
            <TextAttributeFilter
              key={attr.name}
              attr={attr}
              attrFilters={attrFilters}
              setAttrFilters={setAttrFilters}
            />
          ),
        )}

        {/* فیلترهای متنیِ آزاد (صفحه‌ی محصولات) — یک اینپوت متنی برای هر ویژگیِ
            «قابل فیلتر». ماچینگ = substring (همان منطق مشترک)، با debounce در والد. */}
        {freeTextAttributes.length > 0 && (
          <div className="p-5 border-b border-gray-50 last:border-0">
            <h4 className="text-sm font-bold text-[#1a1a1a] mb-4">
              فیلتر بر اساس مشخصات
            </h4>
            <div className="flex flex-col gap-3">
              {freeTextAttributes.map((attr) => (
                <div key={attr.name}>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">
                    {attr.label}
                  </label>
                  <input
                    type="text"
                    value={attrInputs[attr.name] || ""}
                    onChange={(e) => onAttrInput(attr.name, e.target.value)}
                    placeholder={`جستجو در ${attr.label}...`}
                    className="w-full h-10 bg-gray-50 border border-gray-100 rounded-[6px] text-xs px-2 focus:border-[#aa4725] outline-none font-bold"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </MobileFilterDrawer>
  );
}

// فیلتر ویژگیِ متنی — تطبیق substring (شاملِ). چند گزینه = OR
function TextAttributeFilter({ attr, attrFilters, setAttrFilters }) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = attrFilters[attr.name] || [];

  const toggleValue = (value) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];

    const all = { ...attrFilters };
    if (next.length) all[attr.name] = next;
    else delete all[attr.name];
    setAttrFilters(all);
  };

  return (
    <div className="border-b border-gray-50 last:border-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
      >
        <span className="text-sm font-bold text-[#1a1a1a] flex items-center gap-2">
          {attr.label}
          {selected.length > 0 && (
            <span className="bg-[#aa4725] text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
              {selected.length}
            </span>
          )}
        </span>
        <FaChevronDown
          size={10}
          className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="px-5 pb-5 flex flex-wrap gap-2 max-h-52 overflow-y-auto custom-scrollbar">
          {attr.options.map((opt) => {
            const isActive = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleValue(opt.value)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all
                  ${
                    isActive
                      ? "bg-[#aa4725] border-[#aa4725] text-white"
                      : "bg-gray-50 border-gray-200 text-gray-600 hover:border-[#aa4725]"
                  }`}
              >
                {opt.value}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// فیلتر ویژگیِ عددی — بازه‌ی از/تا
function NumericAttributeFilter({ attr, attrFilters, setAttrFilters }) {
  const [isOpen, setIsOpen] = useState(false);
  const sel = attrFilters[attr.name] || { min: null, max: null };
  const isActive = sel.min != null || sel.max != null;

  const setBound = (key, raw) => {
    const value = raw === "" ? null : Number(raw);
    const next = { ...sel, [key]: value };
    const all = { ...attrFilters };
    if (next.min != null || next.max != null) all[attr.name] = next;
    else delete all[attr.name];
    setAttrFilters(all);
  };

  return (
    <div className="border-b border-gray-50 last:border-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
      >
        <span className="text-sm font-bold text-[#1a1a1a] flex items-center gap-2">
          {attr.label}
          {isActive && (
            <span className="w-2 h-2 rounded-full bg-[#aa4725]" />
          )}
        </span>
        <FaChevronDown
          size={10}
          className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="px-5 pb-5 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="number"
              placeholder={`از ${attr.min}`}
              value={sel.min ?? ""}
              onChange={(e) => setBound("min", e.target.value)}
              className="w-1/2 h-10 bg-gray-50 border border-gray-100 rounded-[6px] text-xs px-2 focus:border-[#aa4725] outline-none font-bold"
            />
            <input
              type="number"
              placeholder={`تا ${attr.max}`}
              value={sel.max ?? ""}
              onChange={(e) => setBound("max", e.target.value)}
              className="w-1/2 h-10 bg-gray-50 border border-gray-100 rounded-[6px] text-xs px-2 focus:border-[#aa4725] outline-none font-bold"
            />
          </div>
        </div>
      )}
    </div>
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
