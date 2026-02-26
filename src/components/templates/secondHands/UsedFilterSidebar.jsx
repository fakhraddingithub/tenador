'use client';

import { useMemo, useState } from 'react';
import { FiChevronDown, FiChevronUp, FiShield } from 'react-icons/fi';

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 py-4">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="flex items-center justify-between w-full text-sm font-bold text-gray-700 mb-1"
      >
        {title}
        {open ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

const SCORE_RANGES = [
  { label: 'عالی (۸ تا ۱۰)', min: 8, max: 10 },
  { label: 'خوب (۵ تا ۷)',   min: 5, max: 7  },
  { label: 'متوسط (۱ تا ۴)', min: 1, max: 4  },
];

export default function UsedFilterSidebar({ products, filters, setFilters }) {
  const brands     = useMemo(() => [...new Map(products.map(p => p.baseProduct?.brand).filter(Boolean).map(b => [b._id, b])).values()], [products]);
  const categories = useMemo(() => [...new Map(products.map(p => p.baseProduct?.category).filter(Boolean).map(c => [c._id, c])).values()], [products]);
  const maxPrice   = useMemo(() => Math.max(...products.map(p => p.price || 0), 50_000_000), [products]);

  const toggleArr = (key, id) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key].includes(id) ? prev[key].filter(x => x !== id) : [...prev[key], id],
    }));
  };

  const activeCount = [
    filters.brands.length,
    filters.categories.length,
    filters.scoreRange ? 1 : 0,
    filters.maxPrice < maxPrice ? 1 : 0,
    filters.onlyInStock ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const reset = () => setFilters({ brands: [], categories: [], maxPrice, scoreRange: null, onlyInStock: false });

  return (
    <div className="bg-white rounded-[var(--radius)] border border-gray-100 shadow-sm p-5">
      {/* عنوان */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-black text-gray-800">فیلترها</h2>
        {activeCount > 0 && (
          <button onClick={reset} className="text-xs text-[var(--color-primary)] font-bold hover:underline">
            پاک کردن ({activeCount})
          </button>
        )}
      </div>

      {/* برند */}
      {brands.length > 0 && (
        <Section title="برند">
          <div className="space-y-2 max-h-48 overflow-y-auto pl-1">
            {brands.map(b => (
              <label key={b._id} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.brands.includes(b._id)}
                  onChange={() => toggleArr('brands', b._id)}
                  className="accent-[var(--color-primary)] w-4 h-4 rounded"
                />
                {b.logo && <img src={b.logo} alt={b.title} className="w-4 h-4 object-contain" />}
                <span className="text-sm text-gray-600 group-hover:text-[var(--color-primary)] transition-colors">
                  {b.title}
                </span>
              </label>
            ))}
          </div>
        </Section>
      )}

      {/* دسته‌بندی */}
      {categories.length > 0 && (
        <Section title="دسته‌بندی">
          <div className="space-y-2 max-h-48 overflow-y-auto pl-1">
            {categories.map(c => (
              <label key={c._id} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.categories.includes(c._id)}
                  onChange={() => toggleArr('categories', c._id)}
                  className="accent-[var(--color-primary)] w-4 h-4 rounded"
                />
                <span className="text-sm text-gray-600 group-hover:text-[var(--color-primary)] transition-colors">
                  {c.title}
                </span>
              </label>
            ))}
          </div>
        </Section>
      )}

      {/* امتیاز سلامت */}
      <Section title={<span className="flex items-center gap-1.5"><FiShield size={13} /> امتیاز سلامت</span>}>
        <div className="space-y-2">
          {SCORE_RANGES.map(r => {
            const active = filters.scoreRange?.min === r.min;
            return (
              <button
                key={r.min}
                type="button"
                onClick={() => setFilters(prev => ({ ...prev, scoreRange: active ? null : r }))}
                className={`w-full text-right text-sm px-3 py-2 rounded-lg border transition-all ${
                  active
                    ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30 text-[var(--color-primary)] font-bold'
                    : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-[var(--color-primary)]/20'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* حداکثر قیمت */}
      <Section title="حداکثر قیمت">
        <div className="space-y-2">
          <input
            type="range"
            min={0}
            max={maxPrice}
            step={500000}
            value={filters.maxPrice}
            onChange={e => setFilters(prev => ({ ...prev, maxPrice: Number(e.target.value) }))}
            className="w-full accent-[var(--color-primary)]"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>۰</span>
            <span className="font-bold text-[var(--color-primary)]">
              {filters.maxPrice?.toLocaleString('fa-IR')} تومان
            </span>
          </div>
        </div>
      </Section>
    </div>
  );
}