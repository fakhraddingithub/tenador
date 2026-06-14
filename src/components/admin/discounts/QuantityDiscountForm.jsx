"use client";
// src/components/admin/discounts/QuantityDiscountForm.jsx
//
// فرم ساخت/ویرایش قانون تخفیف تعدادی.
// مانند قوانین تخفیف معمولی، قابل اعمال روی همه محصولات، محصول خاص،
// برند، سری یا دسته‌بندی است.

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#aa4725] focus:ring-1 focus:ring-[#aa4725]/20 transition-colors bg-white";

const QTY_TYPES = [
  { value: "global",   label: "همه محصولات",   hasTargets: false },
  { value: "product",  label: "محصول خاص",     hasTargets: true, searchType: "product" },
  { value: "brand",    label: "برند",           hasTargets: true, searchType: "brand" },
  { value: "serie",    label: "سری محصولات",    hasTargets: true, searchType: "serie" },
  { value: "category", label: "دسته‌بندی",      hasTargets: true, searchType: "category" },
];

const emptyTier = () => ({ minQty: 2, discount: { kind: "percent", value: "" } });

// ─── Autocomplete hook ────────────────────────────────────────────────────────
function useSearchDropdown(searchType) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  const search = useCallback(async (q) => {
    if (!q || !searchType) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/discounts/search?type=${searchType}&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.items || []);
      setOpen(true);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, [searchType]);

  const handleQueryChange = (val) => {
    setQuery(val);
    clearTimeout(timer.current);
    if (!val.trim()) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(() => search(val), 300);
  };

  const reset = () => { setQuery(""); setResults([]); setOpen(false); };
  return { query, handleQueryChange, results, loading, open, setOpen, reset };
}

// ─── انتخاب چند هدف با Autocomplete ─────────────────────────────────────────
function TargetSearchField({ searchType, selectedItems, onAdd, onRemove }) {
  const dd = useSearchDropdown(searchType);
  const wrapRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) dd.setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [dd]);

  const handleSelect = (item) => {
    if (!selectedItems.find((s) => s._id === String(item._id)))
      onAdd({ _id: String(item._id), label: item.label, image: item.image || null });
    dd.reset();
  };

  return (
    <div className="space-y-2">
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedItems.map((item) => (
            <span key={item._id} className="inline-flex items-center gap-1 bg-[#aa4725]/10 border border-[#aa4725]/30 text-[#aa4725] text-xs px-2.5 py-1 rounded-full">
              {item.image && <img src={item.image} alt="" className="w-4 h-4 rounded-full object-cover" />}
              {item.label}
              <button type="button" onClick={() => onRemove(item._id)} className="text-[#aa4725]/60 hover:text-[#aa4725] font-bold leading-none">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="relative" ref={wrapRef}>
        <input
          type="text" value={dd.query}
          onChange={(e) => dd.handleQueryChange(e.target.value)}
          onFocus={() => dd.query && dd.results.length && dd.setOpen(true)}
          className={inputCls} placeholder="نام را تایپ کنید..." autoComplete="off"
        />
        {dd.loading && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">جستجو...</span>}
        {dd.open && (
          <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
            {dd.results.length === 0
              ? <li className="px-4 py-3 text-sm text-gray-400 text-right">همچین آیتمی وجود ندارد</li>
              : dd.results.map((item) => (
                <li key={String(item._id)} onMouseDown={() => handleSelect(item)}
                  className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-50 last:border-none">
                  {item.image
                    ? <img src={item.image} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    : <div className="w-8 h-8 rounded bg-gray-100 flex-shrink-0" />}
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-800">{item.label}</p>
                    {item.sub && <p className="text-xs text-gray-400">{item.sub}</p>}
                  </div>
                </li>
              ))
            }
          </ul>
        )}
      </div>
    </div>
  );
}

// resolve کردن اسم اهداف هنگام ویرایش
async function resolveTargetLabels(searchType, ids) {
  if (!ids?.length || !searchType) return [];
  try {
    const res = await fetch(`/api/admin/discounts/search?type=${searchType}&ids=${ids.join(",")}`);
    const data = await res.json();
    if (data.items?.length) {
      return ids.map((id) => {
        const found = data.items.find((i) => String(i._id) === String(id));
        return found ? { _id: String(id), label: found.label, image: found.image || null } : { _id: String(id), label: String(id), image: null };
      });
    }
  } catch { /* fallback */ }
  return ids.map((id) => ({ _id: String(id), label: String(id), image: null }));
}

// تبدیل Date → مقدار input[type=datetime-local]
function toLocalInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function QuantityDiscountForm({ initial, onSuccess, onCancel }) {
  const [type, setType] = useState(initial?.type || "global");
  const [selectedTargets, setSelectedTargets] = useState([]);
  const [resolvingTargets, setResolvingTargets] = useState(false);
  const [title, setTitle] = useState(initial?.title || "");
  const [tiers, setTiers] = useState(
    initial?.tiers?.length
      ? initial.tiers.map((t) => ({
          minQty: t.minQty,
          discount: { kind: t.discount.kind, value: t.discount.value },
        }))
      : [
          { minQty: 2, discount: { kind: "percent", value: 10 } },
          { minQty: 3, discount: { kind: "percent", value: 15 } },
        ]
  );
  const [active, setActive] = useState(initial ? initial.active : true);
  const [startAt, setStartAt] = useState(toLocalInput(initial?.startAt));
  const [endAt, setEndAt] = useState(toLocalInput(initial?.endAt));
  const [submitting, setSubmitting] = useState(false);

  // resolve اهداف هنگام ویرایش
  useEffect(() => {
    if (!initial) return;
    const selectedType = QTY_TYPES.find((t) => t.value === initial.type);
    if (selectedType?.hasTargets && initial.targets?.length) {
      setResolvingTargets(true);
      resolveTargetLabels(selectedType.searchType, initial.targets.map(String))
        .then(setSelectedTargets)
        .finally(() => setResolvingTargets(false));
    }
  }, [initial]);

  const handleTypeChange = (newType) => {
    setType(newType);
    setSelectedTargets([]);
  };

  const addTarget    = (item) => setSelectedTargets((prev) => prev.find((t) => t._id === item._id) ? prev : [...prev, item]);
  const removeTarget = (id)   => setSelectedTargets((prev) => prev.filter((t) => t._id !== id));

  const updateTier = (index, patch) => {
    setTiers((prev) =>
      prev.map((t, i) =>
        i === index
          ? { ...t, ...patch, discount: { ...t.discount, ...(patch.discount || {}) } }
          : t
      )
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const selectedTypeDef = QTY_TYPES.find((t) => t.value === type);
    if (selectedTypeDef?.hasTargets && selectedTargets.length === 0) {
      toast.error("حداقل یک هدف انتخاب کنید");
      return;
    }
    if (!tiers.length) {
      toast.error("حداقل یک پله تخفیف تعریف کنید");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        type,
        targets: type !== "global" ? selectedTargets.map((t) => t._id) : [],
        title: title.trim(),
        tiers: tiers.map((t) => ({
          minQty: Number(t.minQty),
          discount: { kind: t.discount.kind, value: Number(t.discount.value) },
        })),
        active,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        endAt: endAt ? new Date(endAt).toISOString() : null,
      };

      const res = await fetch(
        initial?._id
          ? `/api/admin/quantity-discounts/${initial._id}`
          : "/api/admin/quantity-discounts",
        {
          method: initial?._id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "خطا در ذخیره تخفیف تعدادی");
        return;
      }

      toast.success(initial?._id ? "تخفیف تعدادی ویرایش شد" : "تخفیف تعدادی ایجاد شد");
      onSuccess?.();
    } catch {
      toast.error("خطا در ارتباط با سرور");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTypeDef = QTY_TYPES.find((t) => t.value === type);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* عنوان */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">عنوان (اختیاری)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputCls}
          placeholder="مثلاً: تخفیف عمده برند ویلسون"
        />
      </div>

      {/* نوع */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">نوع هدف *</label>
        <select
          value={type}
          onChange={(e) => handleTypeChange(e.target.value)}
          className={inputCls}
          required
        >
          {QTY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* انتخاب هدف */}
      {selectedTypeDef?.hasTargets && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">انتخاب هدف *</label>
          {resolvingTargets ? (
            <div className="text-xs text-gray-400 py-2">در حال بارگذاری...</div>
          ) : (
            <TargetSearchField
              searchType={selectedTypeDef.searchType}
              selectedItems={selectedTargets}
              onAdd={addTarget}
              onRemove={removeTarget}
            />
          )}
        </div>
      )}

      {/* پله‌ها */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">پله‌های تخفیف *</label>
          <button
            type="button"
            onClick={() => setTiers((prev) => [...prev, emptyTier()])}
            className="text-xs font-bold text-[#aa4725] hover:underline"
          >
            + افزودن پله
          </button>
        </div>

        <div className="space-y-2">
          {tiers.map((tier, index) => (
            <div
              key={index}
              className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2 border border-gray-100 bg-gray-50/60 rounded-lg p-3"
            >
              <div className="space-y-1">
                <span className="text-[11px] text-gray-500">حداقل تعداد</span>
                <input
                  type="number"
                  min={2}
                  value={tier.minQty}
                  onChange={(e) => updateTier(index, { minQty: e.target.value })}
                  className={inputCls}
                  required
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-gray-500">نوع تخفیف</span>
                <select
                  value={tier.discount.kind}
                  onChange={(e) => updateTier(index, { discount: { kind: e.target.value } })}
                  className={inputCls}
                >
                  <option value="percent">درصد</option>
                  <option value="amount">مبلغ ثابت (تومان)</option>
                </select>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-gray-500">
                  {tier.discount.kind === "percent" ? "درصد تخفیف" : "مبلغ تخفیف هر واحد"}
                </span>
                <input
                  type="number"
                  min={1}
                  max={tier.discount.kind === "percent" ? 100 : undefined}
                  value={tier.discount.value}
                  onChange={(e) => updateTier(index, { discount: { value: e.target.value } })}
                  className={inputCls}
                  required
                />
              </div>
              <button
                type="button"
                onClick={() => setTiers((prev) => prev.filter((_, i) => i !== index))}
                disabled={tiers.length === 1}
                className="h-9 px-3 rounded-lg text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                حذف
              </button>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 leading-5">
          بهترین پله‌ای که تعداد سبد خرید به آن برسد اعمال می‌شود؛ مثلاً «۲+ → ۱۰٪» و «۳+ → ۱۵٪».
        </p>
      </div>

      {/* بازه زمانی */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">شروع (اختیاری)</label>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">پایان (اختیاری)</label>
          <input
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {/* وضعیت */}
      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="w-4 h-4 accent-[#aa4725]"
        />
        فعال باشد
      </label>

      {/* اکشن‌ها */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          انصراف
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-[#aa4725] hover:bg-[#8f3a1e] disabled:opacity-60 transition-colors"
        >
          {submitting ? "در حال ذخیره..." : initial?._id ? "ذخیره تغییرات" : "ایجاد تخفیف"}
        </button>
      </div>
    </form>
  );
}
