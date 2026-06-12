"use client";
// src/components/admin/discounts/QuantityDiscountForm.jsx
//
// فرم ساخت/ویرایش تخفیف تعدادی — هم‌خانواده با CouponForm.
// ادمین یک محصول را انتخاب می‌کند و پله‌های تخفیف (حداقل تعداد + درصد/مبلغ)
// را تعریف می‌کند. اعمال تخفیف هنگام خرید در priceEngine انجام می‌شود.

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#aa4725] focus:ring-1 focus:ring-[#aa4725]/20 transition-colors bg-white";

const emptyTier = () => ({ minQty: 2, discount: { kind: "percent", value: "" } });

// ─── انتخاب محصول (جستجوی تکی) ───────────────────────────────────────────────
function ProductSearchField({ selected, onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const search = useCallback(async (q) => {
    if (!q) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/discounts/search?type=product&q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      setResults(data.items || []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (val) => {
    setQuery(val);
    clearTimeout(timer.current);
    if (!val.trim()) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(() => search(val), 300);
  };

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 border border-[#aa4725]/30 bg-[#aa4725]/5 rounded-lg px-3 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {selected.image ? (
            <img src={selected.image} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded bg-gray-100 flex-shrink-0" />
          )}
          <p className="text-sm font-medium text-gray-800 truncate">{selected.label}</p>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="text-xs font-bold text-[#aa4725]/70 hover:text-[#aa4725] flex-shrink-0"
        >
          تغییر محصول
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={wrapRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onFocus={() => query && results.length && setOpen(true)}
        className={inputCls}
        placeholder="نام محصول را تایپ کنید..."
        autoComplete="off"
      />
      {loading && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          جستجو...
        </span>
      )}
      {open && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {results.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-400 text-right">محصولی یافت نشد</li>
          ) : (
            results.map((item) => (
              <li
                key={String(item._id)}
                onMouseDown={() => {
                  onSelect({ _id: String(item._id), label: item.label, image: item.image || null });
                  setQuery("");
                  setResults([]);
                  setOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-50 last:border-none"
              >
                {item.image ? (
                  <img src={item.image} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded bg-gray-100 flex-shrink-0" />
                )}
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-800">{item.label}</p>
                  {item.sub && <p className="text-xs text-gray-400">{item.sub}</p>}
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
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
  const [product, setProduct] = useState(
    initial?.product
      ? {
          _id: String(initial.product._id || initial.product),
          label: initial.product.name || "محصول انتخاب‌شده",
          image: initial.product.mainImage || null,
        }
      : null
  );
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

  const updateTier = (index, patch) => {
    setTiers((prev) =>
      prev.map((t, i) =>
        i === index
          ? {
              ...t,
              ...patch,
              discount: { ...t.discount, ...(patch.discount || {}) },
            }
          : t
      )
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!product?._id) {
      toast.error("ابتدا محصول را انتخاب کنید");
      return;
    }
    if (!tiers.length) {
      toast.error("حداقل یک پله تخفیف تعریف کنید");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        product: product._id,
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* محصول */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">محصول هدف *</label>
        <ProductSearchField selected={product} onSelect={setProduct} />
      </div>

      {/* عنوان */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">عنوان (اختیاری)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputCls}
          placeholder="مثلاً: تخفیف خرید عمده راکت"
        />
      </div>

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
                  onChange={(e) =>
                    updateTier(index, { discount: { kind: e.target.value } })
                  }
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
                  onChange={(e) =>
                    updateTier(index, { discount: { value: e.target.value } })
                  }
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
