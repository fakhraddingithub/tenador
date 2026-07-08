"use client";
// src/components/admin/discounts/DiscountRuleForm.jsx

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { formatIranDateTimeLocal } from "@/lib/iranDateTime";

const TYPES = [
  { value: "global",    label: "همه محصولات",      hasTargets: false },
  { value: "product",   label: "محصول خاص",        hasTargets: true, searchType: "product" },
  { value: "category",  label: "دسته‌بندی",         hasTargets: true, searchType: "category" },
  { value: "variant",   label: "واریانت خاص",       hasTargets: true, searchType: "variant" },
  { value: "serie",     label: "سری محصولات",       hasTargets: true, searchType: "serie" },
  { value: "brand",     label: "برند",              hasTargets: true, searchType: "brand" },
  { value: "userRole",  label: "نقش کاربر",         hasTargets: false },
  { value: "userLevel", label: "سطح کاربر",         hasTargets: false },
  { value: "cartValue", label: "حداقل سبد خرید",    hasTargets: false },
];

const USER_ROLES = [
  { value: "coach",           label: "مربی" },
  { value: "national_player", label: "ملی‌پوش" },
  { value: "seller",          label: "فروشنده" },
  { value: "user",            label: "کاربر عادی" },
];

const USER_LEVELS = [
  { value: 1, label: "نقره‌ای" },
  { value: 2, label: "طلایی" },
  { value: 3, label: "پلاتینیوم" },
];

const defaultForm = {
  title: "", type: "global", targets: [], targetRoles: [], targetLevels: [],
  discount: { kind: "percent", value: "" },
  conditions: { minCartValue: 0, onlyFirstOrders: false, maxUsagePerUser: "" },
  startAt: "", endAt: "", priority: 1000, combinable: false, active: true,
  usageLimit: "", note: "",
};

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#aa4725] focus:ring-1 focus:ring-[#aa4725]/20 transition-colors bg-white";

// ─── Autocomplete Hook ────────────────────────────────────────────────────────
function useSearchDropdown(searchType) {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const timer = useRef(null);

  const search = useCallback(async (q) => {
    if (!q || !searchType) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/discounts/search?type=${searchType}&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.items || []);
      setOpen(true);
    } catch { setResults([]); }
    finally  { setLoading(false); }
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

// ─── TargetSearchField (product / brand / serie) ──────────────────────────────
function TargetSearchField({ searchType, selectedItems, onAdd, onRemove }) {
  const dd      = useSearchDropdown(searchType);
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

// ─── VariantSearchField ───────────────────────────────────────────────────────
function VariantSearchField({ selectedItems, onAdd, onRemove }) {
  const productSearch  = useSearchDropdown("variant");
  const wrapRef        = useRef(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [variants, setVariants]               = useState([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) productSearch.setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [productSearch]);

  const handleSelectProduct = async (item) => {
    setSelectedProduct(item);
    productSearch.reset();
    setLoadingVariants(true);
    try {
      const res  = await fetch(`/api/admin/discounts/search?type=variant&productId=${item._id}`);
      const data = await res.json();
      setVariants(data.items || []);
    } catch { toast.error("خطا در دریافت واریانت‌ها"); }
    finally  { setLoadingVariants(false); }
  };

  return (
    <div className="space-y-3">
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
      <div>
        <p className="text-xs text-gray-500 mb-1">ابتدا محصول مورد نظر را جستجو کنید:</p>
        <div className="relative" ref={wrapRef}>
          <input type="text" value={productSearch.query}
            onChange={(e) => productSearch.handleQueryChange(e.target.value)}
            onFocus={() => productSearch.query && productSearch.results.length && productSearch.setOpen(true)}
            className={inputCls} placeholder="نام محصول را تایپ کنید..." autoComplete="off"
          />
          {productSearch.loading && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">جستجو...</span>}
          {productSearch.open && (
            <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
              {productSearch.results.length === 0
                ? <li className="px-4 py-3 text-sm text-gray-400 text-right">همچین آیتمی وجود ندارد</li>
                : productSearch.results.map((item) => (
                  <li key={String(item._id)} onMouseDown={() => handleSelectProduct(item)}
                    className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-50 last:border-none">
                    {item.image ? <img src={item.image} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" /> : <div className="w-8 h-8 rounded bg-gray-100 flex-shrink-0" />}
                    <p className="text-sm font-medium text-gray-800 text-right">{item.label}</p>
                  </li>
                ))
              }
            </ul>
          )}
        </div>
      </div>
      {selectedProduct && (
        <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-700">
              واریانت‌های <span className="text-[#aa4725]">{selectedProduct.label}</span>:
            </p>
            <button type="button" onClick={() => { setSelectedProduct(null); setVariants([]); }} className="text-xs text-gray-400 hover:text-gray-600">× بستن</button>
          </div>
          {loadingVariants ? (
            <p className="text-xs text-gray-400 text-center py-2">در حال بارگذاری...</p>
          ) : variants.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">واریانتی برای این محصول یافت نشد</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {variants.map((variant) => {
                const isSelected = selectedItems.some((s) => s._id === String(variant._id));
                return (
                  <label key={String(variant._id)}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? "bg-[#aa4725]/10 border border-[#aa4725]/30" : "bg-white border border-gray-100 hover:border-[#aa4725]/30"}`}>
                    <input type="checkbox" checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) onAdd({ _id: String(variant._id), label: `${selectedProduct.label} | ${variant.label}`, image: variant.image || null });
                        else onRemove(String(variant._id));
                      }}
                      className="accent-[#aa4725]"
                    />
                    <div className="text-right flex-1">
                      <p className="text-xs font-medium text-gray-800">{variant.label}</p>
                      <p className="text-[10px] text-gray-400">{variant.sub}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── تبدیل آی‌دی به اسم هنگام ویرایش ────────────────────────────────────────
async function resolveTargetLabels(type, ids) {
  if (!ids?.length) return [];
  const searchTypeMap = { product: "product", brand: "brand", serie: "serie", category: "category" };
  const searchType = searchTypeMap[type];

  // برای واریانت: از API variant با productId نمی‌توانیم مستقیم بگیریم
  // یک endpoint ساده می‌زنیم با q خالی و targetIds
  if (!searchType && type !== "variant") {
    return ids.map((id) => ({ _id: String(id), label: String(id), image: null }));
  }

  try {
    // برای product/brand/serie: با آی‌دی‌ها در یک batch call
    const res  = await fetch(`/api/admin/discounts/search?type=${searchType || "variant"}&ids=${ids.join(",")}`);
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

// ─── Main Form ────────────────────────────────────────────────────────────────
export default function DiscountRuleForm({ initial, onSuccess, onCancel }) {
  const [form, setForm]                   = useState(defaultForm);
  const [selectedTargets, setSelectedTargets] = useState([]);
  const [selectedBrands, setSelectedBrands]   = useState([]); // زیرفیلتر برند برای نوع category
  const [saving, setSaving]               = useState(false);
  const [resolvingTargets, setResolvingTargets] = useState(false);

  useEffect(() => {
    if (!initial) { setForm(defaultForm); setSelectedTargets([]); setSelectedBrands([]); return; }

    setForm({
      ...defaultForm, ...initial,
      discount:   initial.discount   || defaultForm.discount,
      conditions: { ...defaultForm.conditions, ...initial.conditions },
      startAt:    initial.startAt ? formatIranDateTimeLocal(initial.startAt) : "",
      endAt:      initial.endAt   ? formatIranDateTimeLocal(initial.endAt)   : "",
      usageLimit: initial.usageLimit ?? "",
    });

    // resolve targets به اسم
    if (initial.targets?.length) {
      setResolvingTargets(true);
      resolveTargetLabels(initial.type, initial.targets)
        .then((resolved) => setSelectedTargets(resolved))
        .finally(() => setResolvingTargets(false));
    } else {
      setSelectedTargets([]);
    }

    // resolve زیرفیلتر برند (فقط برای نوع category)
    if (initial.type === "category" && initial.targetBrands?.length) {
      resolveTargetLabels("brand", initial.targetBrands)
        .then((resolved) => setSelectedBrands(resolved));
    } else {
      setSelectedBrands([]);
    }
  }, [initial]);

  const set = (path, value) =>
    setForm((prev) => {
      const parts = path.split(".");
      if (parts.length === 1) return { ...prev, [path]: value };
      return { ...prev, [parts[0]]: { ...prev[parts[0]], [parts[1]]: value } };
    });

  const addTarget    = (item) => setSelectedTargets((prev) => prev.find((t) => t._id === item._id) ? prev : [...prev, item]);
  const removeTarget = (id)   => setSelectedTargets((prev) => prev.filter((t) => t._id !== id));

  const addBrand    = (item) => setSelectedBrands((prev) => prev.find((b) => b._id === item._id) ? prev : [...prev, item]);
  const removeBrand = (id)   => setSelectedBrands((prev) => prev.filter((b) => b._id !== id));

  const handleTypeChange = (newType) => {
    set("type", newType);
    setSelectedTargets([]); // ریست targets
    setSelectedBrands([]);  // ریست زیرفیلتر برند
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      targets:    selectedTargets.map((t) => t._id),
      targetBrands: form.type === "category" ? selectedBrands.map((b) => b._id) : [],
      discount:   { ...form.discount, value: Number(form.discount.value) },
      conditions: { ...form.conditions, minCartValue: Number(form.conditions.minCartValue) || 0, maxUsagePerUser: form.conditions.maxUsagePerUser ? Number(form.conditions.maxUsagePerUser) : null },
      priority:   Number(form.priority),
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
    };
    const url    = initial ? `/api/admin/discounts/${initial._id}` : "/api/admin/discounts";
    const method = initial ? "PATCH" : "POST";
    try {
      const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا");
      toast.success(initial ? "ویرایش شد" : "ایجاد شد");
      onSuccess();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const selectedType = TYPES.find((t) => t.value === form.type);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* عنوان */}
      <Field label="عنوان قانون *">
        <input value={form.title} onChange={(e) => set("title", e.target.value)} required className={inputCls} placeholder="مثلاً: تخفیف ویژه مربیان" />
      </Field>

      {/* نوع */}
      <Field label="نوع تخفیف *">
        <select value={form.type} onChange={(e) => handleTypeChange(e.target.value)} className={inputCls} required>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </Field>

      {/* Targets - با Autocomplete و نمایش اسم */}
      {selectedType?.hasTargets && selectedType.searchType && (
        <Field label="انتخاب هدف">
          {resolvingTargets ? (
            <div className="text-xs text-gray-400 py-2">در حال بارگذاری...</div>
          ) : form.type === "variant" ? (
            <VariantSearchField selectedItems={selectedTargets} onAdd={addTarget} onRemove={removeTarget} />
          ) : (
            <TargetSearchField searchType={selectedType.searchType} selectedItems={selectedTargets} onAdd={addTarget} onRemove={removeTarget} />
          )}
        </Field>
      )}

      {/* زیرفیلتر برند — فقط برای نوع دسته‌بندی، پس از انتخاب دسته */}
      {form.type === "category" && selectedTargets.length > 0 && (
        <Field label="فیلتر برند (اختیاری)">
          <p className="text-xs text-gray-500 mb-2">
            در صورت انتخاب برند، تخفیف فقط روی محصولاتی اعمال می‌شود که هم در دسته‌ی بالا و هم در این برند(ها) باشند. خالی بگذارید تا همه‌ی برندهای این دسته شامل شوند.
          </p>
          <TargetSearchField searchType="brand" selectedItems={selectedBrands} onAdd={addBrand} onRemove={removeBrand} />
        </Field>
      )}

      {/* نقش کاربر */}
      {form.type === "userRole" && (
        <Field label="نقش‌های هدف">
          <div className="flex flex-wrap gap-2">
            {USER_ROLES.map((r) => (
              <label key={r.value} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={form.targetRoles.includes(r.value)}
                  onChange={(e) => set("targetRoles", e.target.checked ? [...form.targetRoles, r.value] : form.targetRoles.filter((x) => x !== r.value))}
                  className="accent-[#aa4725]" />
                <span className="text-sm">{r.label}</span>
              </label>
            ))}
          </div>
        </Field>
      )}

      {/* سطح کاربر */}
      {form.type === "userLevel" && (
        <Field label="سطوح هدف">
          <div className="flex flex-wrap gap-2">
            {USER_LEVELS.map((l) => (
              <label key={l.value} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={form.targetLevels.includes(l.value)}
                  onChange={(e) => set("targetLevels", e.target.checked ? [...form.targetLevels, l.value] : form.targetLevels.filter((x) => x !== l.value))}
                  className="accent-[#aa4725]" />
                <span className="text-sm">{l.label}</span>
              </label>
            ))}
          </div>
        </Field>
      )}

      {/* مقدار تخفیف */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="نوع محاسبه *">
          <select value={form.discount.kind} onChange={(e) => set("discount.kind", e.target.value)} className={inputCls}>
            <option value="percent">درصد (%)</option>
            <option value="amount">مبلغ ثابت (تومان)</option>
          </select>
        </Field>
        <Field label="مقدار تخفیف *">
          <input type="number" min={0} max={form.discount.kind === "percent" ? 100 : undefined}
            value={form.discount.value} onChange={(e) => set("discount.value", e.target.value)}
            required className={inputCls} placeholder={form.discount.kind === "percent" ? "مثلاً: ۲۰" : "مثلاً: ۵۰۰۰۰"} />
        </Field>
      </div>

      {/* تاریخ */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="تاریخ شروع *">
          <input type="datetime-local" value={form.startAt} onChange={(e) => set("startAt", e.target.value)} required className={inputCls} />
        </Field>
        <Field label="تاریخ پایان *">
          <input type="datetime-local" value={form.endAt} onChange={(e) => set("endAt", e.target.value)} required className={inputCls} />
        </Field>
      </div>

      {/* شرایط */}
      <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
        <p className="text-sm font-medium text-gray-700">شرایط اعمال</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="حداقل سبد خرید (تومان)">
            <input type="number" min={0} value={form.conditions.minCartValue}
              onChange={(e) => set("conditions.minCartValue", e.target.value)} className={inputCls} />
          </Field>
          <Field label="حداکثر استفاده کل">
            <input type="number" min={1} value={form.usageLimit}
              onChange={(e) => set("usageLimit", e.target.value)} className={inputCls} placeholder="بدون محدودیت" />
          </Field>
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.conditions.onlyFirstOrders}
              onChange={(e) => set("conditions.onlyFirstOrders", e.target.checked)} className="accent-[#aa4725]" />
            فقط اولین سفارش
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.combinable}
              onChange={(e) => set("combinable", e.target.checked)} className="accent-[#aa4725]" />
            قابل ترکیب با سایر تخفیف‌ها
          </label>
        </div>
      </div>

      {/* اولویت + وضعیت */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="اولویت (عدد کمتر = اولویت بیشتر)">
          <input type="number" min={1} value={form.priority} onChange={(e) => set("priority", e.target.value)} className={inputCls} />
        </Field>
        <Field label="وضعیت">
          <select value={form.active ? "true" : "false"} onChange={(e) => set("active", e.target.value === "true")} className={inputCls}>
            <option value="true">فعال</option>
            <option value="false">غیرفعال</option>
          </select>
        </Field>
      </div>

      {/* یادداشت */}
      <Field label="یادداشت داخلی">
        <textarea value={form.note} onChange={(e) => set("note", e.target.value)} className={`${inputCls} h-20 resize-none`} placeholder="توضیح برای خودت..." />
      </Field>

      {/* دکمه‌ها */}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="flex-1 bg-[#aa4725] text-white py-2.5 rounded-xl font-medium hover:bg-[#8f3a1e] transition-colors disabled:opacity-60">
          {saving ? "در حال ذخیره..." : initial ? "ذخیره تغییرات" : "ایجاد تخفیف"}
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-medium hover:bg-gray-200 transition-colors">
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
