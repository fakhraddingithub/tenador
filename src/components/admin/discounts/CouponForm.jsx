"use client";
// src/components/admin/discounts/CouponForm.jsx
//
// فرم ساخت/ویرایش کد تخفیف — هم‌خانواده با DiscountRuleForm.
// اعتبارسنجی و اعمال کد هنگام خرید از قبل در priceEngine انجام می‌شود.

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { formatIranDateTimeLocal } from "@/lib/iranDateTime";

const APPLICABLE_OPTIONS = [
  { value: "all",      label: "همه محصولات",  hasTargets: false },
  { value: "product",  label: "محصولات خاص",  hasTargets: true, searchType: "product" },
  { value: "brand",    label: "برندهای خاص",  hasTargets: true, searchType: "brand" },
  { value: "category", label: "دسته‌بندی‌های خاص", hasTargets: true },
];

const defaultForm = {
  code: "",
  discount: { kind: "percent", value: "" },
  startAt: "",
  endAt: "",
  usageLimit: "",
  perUserLimit: 1,
  minCartValue: 0,
  active: true,
  applicableTo: "all",
};

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#aa4725] focus:ring-1 focus:ring-[#aa4725]/20 transition-colors bg-white";

// ─── Autocomplete (مشابه DiscountRuleForm) ───────────────────────────────────
function useSearchDropdown(searchType) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  const search = useCallback(
    async (q) => {
      if (!q || !searchType) { setResults([]); setOpen(false); return; }
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/discounts/search?type=${searchType}&q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.items || []);
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    },
    [searchType]
  );

  const handleQueryChange = (val) => {
    setQuery(val);
    clearTimeout(timer.current);
    if (!val.trim()) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(() => search(val), 300);
  };

  const reset = () => { setQuery(""); setResults([]); setOpen(false); };
  return { query, handleQueryChange, results, loading, open, setOpen, reset };
}

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
          type="text"
          value={dd.query}
          onChange={(e) => dd.handleQueryChange(e.target.value)}
          onFocus={() => dd.query && dd.results.length && dd.setOpen(true)}
          className={inputCls}
          placeholder="نام را تایپ کنید..."
          autoComplete="off"
        />
        {dd.loading && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">جستجو...</span>}
        {dd.open && (
          <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
            {dd.results.length === 0 ? (
              <li className="px-4 py-3 text-sm text-gray-400 text-right">همچین آیتمی وجود ندارد</li>
            ) : (
              dd.results.map((item) => (
                <li
                  key={String(item._id)}
                  onMouseDown={() => handleSelect(item)}
                  className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-50 last:border-none"
                >
                  {item.image
                    ? <img src={item.image} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    : <div className="w-8 h-8 rounded bg-gray-100 flex-shrink-0" />}
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
    </div>
  );
}

// ─── انتخاب دسته‌بندی‌ها (لیست کامل با چک‌باکس) ────────────────────────────────
function CategoryTargetField({ selectedIds, onChange }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories || []))
      .catch(() => toast.error("خطا در دریافت دسته‌بندی‌ها"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-xs text-gray-400 py-2">در حال بارگذاری دسته‌بندی‌ها...</p>;

  return (
    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-100 rounded-lg p-3 bg-gray-50/50">
      {categories.map((cat) => {
        const id = String(cat._id);
        const checked = selectedIds.includes(id);
        return (
          <label key={id} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) =>
                onChange(e.target.checked ? [...selectedIds, id] : selectedIds.filter((x) => x !== id))
              }
              className="accent-[#aa4725]"
            />
            <span className="truncate">{cat.title}</span>
          </label>
        );
      })}
      {categories.length === 0 && (
        <p className="text-xs text-gray-400 col-span-2">دسته‌بندی‌ای یافت نشد</p>
      )}
    </div>
  );
}

// ─── تبدیل آی‌دی هدف‌ها به اسم هنگام ویرایش (product/brand) ───────────────────
async function resolveTargetLabels(searchType, ids) {
  if (!ids?.length) return [];
  try {
    const res = await fetch(`/api/admin/discounts/search?type=${searchType}&ids=${ids.join(",")}`);
    const data = await res.json();
    if (data.items?.length) {
      return ids.map((id) => {
        const found = data.items.find((i) => String(i._id) === String(id));
        return found
          ? { _id: String(id), label: found.label, image: found.image || null }
          : { _id: String(id), label: String(id), image: null };
      });
    }
  } catch { /* fallback */ }
  return ids.map((id) => ({ _id: String(id), label: String(id), image: null }));
}

const toLocalInput = (date) => (date ? formatIranDateTimeLocal(date) : "");

// ─── Main Form ────────────────────────────────────────────────────────────────
export default function CouponForm({ initial, onSuccess, onCancel }) {
  const [form, setForm] = useState(defaultForm);
  const [selectedTargets, setSelectedTargets] = useState([]); // برای product/brand
  const [categoryTargets, setCategoryTargets] = useState([]); // برای category
  const [saving, setSaving] = useState(false);
  const [resolvingTargets, setResolvingTargets] = useState(false);

  useEffect(() => {
    if (!initial) {
      setForm(defaultForm);
      setSelectedTargets([]);
      setCategoryTargets([]);
      return;
    }

    setForm({
      code: initial.code || "",
      discount: initial.discount || defaultForm.discount,
      startAt: toLocalInput(initial.startAt),
      endAt: toLocalInput(initial.endAt),
      usageLimit: initial.usageLimit ?? "",
      perUserLimit: initial.perUserLimit ?? "",
      minCartValue: initial.minCartValue ?? 0,
      active: initial.active ?? true,
      applicableTo: initial.applicableTo || "all",
    });

    const targetIds = (initial.targets || []).map((t) => String(t));

    if (initial.applicableTo === "category") {
      setCategoryTargets(targetIds);
      setSelectedTargets([]);
    } else if (initial.applicableTo === "product" || initial.applicableTo === "brand") {
      setResolvingTargets(true);
      resolveTargetLabels(initial.applicableTo, targetIds)
        .then((resolved) => setSelectedTargets(resolved))
        .finally(() => setResolvingTargets(false));
      setCategoryTargets([]);
    } else {
      setSelectedTargets([]);
      setCategoryTargets([]);
    }
  }, [initial]);

  const set = (path, value) =>
    setForm((prev) => {
      const parts = path.split(".");
      if (parts.length === 1) return { ...prev, [path]: value };
      return { ...prev, [parts[0]]: { ...prev[parts[0]], [parts[1]]: value } };
    });

  const handleApplicableChange = (value) => {
    set("applicableTo", value);
    setSelectedTargets([]);
    setCategoryTargets([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const targets =
      form.applicableTo === "category"
        ? categoryTargets
        : selectedTargets.map((t) => t._id);

    if (form.applicableTo !== "all" && targets.length === 0) {
      return toast.error("برای محدوده انتخاب‌شده حداقل یک هدف انتخاب کنید");
    }

    setSaving(true);

    const payload = {
      code: form.code.trim().toUpperCase(),
      discount: { kind: form.discount.kind, value: Number(form.discount.value) },
      startAt: form.startAt,
      endAt: form.endAt,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      perUserLimit: form.perUserLimit === "" ? null : Number(form.perUserLimit),
      minCartValue: Number(form.minCartValue) || 0,
      active: form.active,
      applicableTo: form.applicableTo,
      targets,
    };

    const url = initial ? `/api/admin/coupons/${initial._id}` : "/api/admin/coupons";
    const method = initial ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا");
      toast.success(initial ? "کد تخفیف ویرایش شد" : "کد تخفیف ایجاد شد");
      onSuccess();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedOption = APPLICABLE_OPTIONS.find((o) => o.value === form.applicableTo);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* کد */}
      <Field label="کد تخفیف * (انگلیسی — کاربر همین کد را هنگام خرید وارد می‌کند)">
        <input
          value={form.code}
          onChange={(e) => set("code", e.target.value.toUpperCase())}
          required
          dir="ltr"
          className={`${inputCls} font-mono tracking-widest text-left`}
          placeholder="SUMMER1404"
        />
      </Field>

      {/* مقدار تخفیف */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="نوع محاسبه *">
          <select value={form.discount.kind} onChange={(e) => set("discount.kind", e.target.value)} className={inputCls}>
            <option value="percent">درصد (%)</option>
            <option value="amount">مبلغ ثابت (تومان)</option>
          </select>
        </Field>
        <Field label="مقدار تخفیف *">
          <input
            type="number"
            min={1}
            max={form.discount.kind === "percent" ? 100 : undefined}
            value={form.discount.value}
            onChange={(e) => set("discount.value", e.target.value)}
            required
            className={inputCls}
            placeholder={form.discount.kind === "percent" ? "مثلاً: ۲۰" : "مثلاً: ۵۰۰۰۰۰"}
          />
        </Field>
      </div>

      {/* بازه زمانی */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="تاریخ شروع *">
          <input type="datetime-local" value={form.startAt} onChange={(e) => set("startAt", e.target.value)} required className={inputCls} />
        </Field>
        <Field label="تاریخ پایان *">
          <input type="datetime-local" value={form.endAt} onChange={(e) => set("endAt", e.target.value)} required className={inputCls} />
        </Field>
      </div>

      {/* محدوده اعمال */}
      <Field label="محدوده اعمال کد *">
        <select value={form.applicableTo} onChange={(e) => handleApplicableChange(e.target.value)} className={inputCls}>
          {APPLICABLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Field>

      {selectedOption?.hasTargets && (
        <Field label="انتخاب هدف">
          {resolvingTargets ? (
            <div className="text-xs text-gray-400 py-2">در حال بارگذاری...</div>
          ) : form.applicableTo === "category" ? (
            <CategoryTargetField selectedIds={categoryTargets} onChange={setCategoryTargets} />
          ) : (
            <TargetSearchField
              searchType={selectedOption.searchType}
              selectedItems={selectedTargets}
              onAdd={(item) =>
                setSelectedTargets((prev) => prev.find((t) => t._id === item._id) ? prev : [...prev, item])
              }
              onRemove={(id) => setSelectedTargets((prev) => prev.filter((t) => t._id !== id))}
            />
          )}
        </Field>
      )}

      {/* محدودیت‌ها */}
      <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
        <p className="text-sm font-medium text-gray-700">شرایط و محدودیت‌ها</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="حداکثر استفاده کل">
            <input
              type="number"
              min={1}
              value={form.usageLimit}
              onChange={(e) => set("usageLimit", e.target.value)}
              className={inputCls}
              placeholder="بدون محدودیت"
            />
          </Field>
          <Field label="سقف استفاده هر کاربر">
            <input
              type="number"
              min={1}
              value={form.perUserLimit}
              onChange={(e) => set("perUserLimit", e.target.value)}
              className={inputCls}
              placeholder="بدون محدودیت"
            />
          </Field>
          <Field label="حداقل سبد خرید (تومان)">
            <input
              type="number"
              min={0}
              value={form.minCartValue}
              onChange={(e) => set("minCartValue", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      </div>

      {/* وضعیت */}
      <Field label="وضعیت">
        <select value={form.active ? "true" : "false"} onChange={(e) => set("active", e.target.value === "true")} className={inputCls}>
          <option value="true">فعال</option>
          <option value="false">غیرفعال</option>
        </select>
      </Field>

      {/* دکمه‌ها */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-[#aa4725] text-white py-2.5 rounded-xl font-medium hover:bg-[#8f3a1e] transition-colors disabled:opacity-60"
        >
          {saving ? "در حال ذخیره..." : initial ? "ذخیره تغییرات" : "ایجاد کد تخفیف"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-medium hover:bg-gray-200 transition-colors"
        >
          انصراف
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
