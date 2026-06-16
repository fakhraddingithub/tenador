"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Multi-select for existing DiscountRules. Instead of typing a discount value,
 * the admin picks one or more rules from the database; the event then includes
 * every product those rules apply to (resolved server-side via the same
 * priceEngine target logic). A live, debounced count shows how many products
 * the current selection will add before saving.
 *
 * value    → array of DiscountRule ids
 * onChange → (ids: string[]) => void
 */

const TYPE_LABELS = {
  global: "همه محصولات",
  product: "محصول",
  category: "دسته‌بندی",
  serie: "سری",
  brand: "برند",
  variant: "واریانت",
  userRole: "نقش کاربر",
  userLevel: "سطح کاربر",
  cartValue: "حداقل سبد",
};

// Rule types that don't map to a product set on their own.
const NON_PRODUCT_TYPES = new Set(["userRole", "userLevel", "cartValue", "variant"]);

function discountLabel(rule) {
  const d = rule.discount || {};
  if (d.kind === "percent") return `${d.value}٪`;
  return `${Number(d.value || 0).toLocaleString("fa-IR")} ت`;
}

export default function DiscountRulePicker({ value = [], onChange }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [count, setCount] = useState(null);
  const [counting, setCounting] = useState(false);

  const wrapRef = useRef(null);
  const timer = useRef(null);

  // Load active discount rules once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/discounts?active=true&limit=100");
        const data = await res.json();
        if (!cancelled) setRules(data.rules || []);
      } catch {
        if (!cancelled) setRules([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close on outside click.
  useEffect(() => {
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Live product count for the current selection (debounced). All setState runs
  // inside the timeout callback so nothing fires synchronously in the effect.
  useEffect(() => {
    const ids = (value || []).map(String).filter(Boolean);
    let cancelled = false;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (cancelled) return;
      if (!ids.length) {
        setCount(null);
        setCounting(false);
        return;
      }
      setCounting(true);
      try {
        const res = await fetch("/api/admin/events/preview-products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productSelection: {
              rules: [{ type: "discountRule", operator: "include", value: ids }],
              limit: 200,
            },
          }),
        });
        const data = await res.json();
        if (!cancelled) setCount(data.total ?? 0);
      } catch {
        if (!cancelled) setCount(null);
      } finally {
        if (!cancelled) setCounting(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
  }, [value]);

  const selectedIds = (value || []).map(String);
  const selectedRules = rules.filter((r) => selectedIds.includes(String(r._id)));

  const toggle = (id) => {
    const sid = String(id);
    const next = selectedIds.includes(sid)
      ? selectedIds.filter((x) => x !== sid)
      : [...selectedIds, sid];
    onChange(next);
  };

  const filtered = rules.filter((r) =>
    r.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-2" ref={wrapRef}>
      {/* Selected chips */}
      {selectedRules.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedRules.map((r) => (
            <span
              key={r._id}
              className="inline-flex items-center gap-1.5 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 text-[var(--color-primary)] text-xs font-bold px-2.5 py-1 rounded-full"
            >
              {r.title}
              <span className="text-[10px] opacity-70">({discountLabel(r)})</span>
              <button
                type="button"
                onClick={() => toggle(r._id)}
                className="text-[var(--color-primary)]/60 hover:text-[var(--color-primary)] font-black leading-none"
                aria-label={`حذف ${r.title}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-[var(--radius)] text-sm font-bold text-gray-600 hover:border-[var(--color-primary)] focus:outline-none focus:border-[var(--color-primary)] transition-all"
        >
          <span>
            {selectedRules.length
              ? `${selectedRules.length.toLocaleString("fa-IR")} قانون انتخاب شده`
              : "انتخاب قانون تخفیف..."}
          </span>
          <svg
            className={`w-3.5 h-3.5 shrink-0 opacity-50 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-gray-100">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجوی قانون تخفیف..."
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>

            <ul role="listbox" className="max-h-56 overflow-y-auto">
              {loading ? (
                <li className="px-4 py-6 text-center text-xs text-gray-400 font-bold">
                  در حال بارگذاری قوانین...
                </li>
              ) : filtered.length === 0 ? (
                <li className="px-4 py-6 text-center text-xs text-gray-400 font-bold">
                  قانون تخفیف فعالی یافت نشد
                </li>
              ) : (
                filtered.map((r) => {
                  const checked = selectedIds.includes(String(r._id));
                  const nonProduct = NON_PRODUCT_TYPES.has(r.type);
                  return (
                    <li key={r._id} role="option" aria-selected={checked}>
                      <button
                        type="button"
                        onClick={() => toggle(r._id)}
                        disabled={nonProduct}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-right transition-colors border-b border-gray-50 last:border-none ${
                          nonProduct
                            ? "opacity-40 cursor-not-allowed"
                            : checked
                            ? "bg-[var(--color-primary)]/10"
                            : "hover:bg-gray-50"
                        }`}
                        title={nonProduct ? "این نوع قانون به محصول خاصی محدود نمی‌شود" : ""}
                      >
                        <span
                          className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${
                            checked
                              ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white"
                              : "border-gray-300"
                          }`}
                          aria-hidden="true"
                        >
                          {checked && (
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-bold text-gray-800 truncate">
                            {r.title}
                          </span>
                          <span className="block text-[10px] text-gray-400 font-bold">
                            {TYPE_LABELS[r.type] || r.type}
                            {nonProduct && " — بدون هدف محصولی"}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] font-black text-[var(--color-primary)]">
                          {discountLabel(r)}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Live count */}
      {selectedRules.length > 0 && (
        <p className="text-[11px] font-bold" aria-live="polite">
          {counting ? (
            <span className="text-gray-400">در حال شمارش محصولات...</span>
          ) : count !== null ? (
            <span className="text-gray-500">
              <span className="text-[var(--color-primary)] font-black">
                {count.toLocaleString("fa-IR")} محصول
              </span>{" "}
              با این قوانین به رویداد اضافه می‌شود
            </span>
          ) : null}
        </p>
      )}
    </div>
  );
}
