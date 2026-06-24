"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import {
  FaSave, FaRocket, FaCalendarAlt,
  FaInfo, FaPalette, FaBoxOpen,
  FaSearch, FaCreditCard, FaImage,
} from "react-icons/fa";
import ImageUpload from "@/components/admin/ImageUpload";
import EventEntityPicker from "./EventEntityPicker";
import DiscountRulePicker from "./DiscountRulePicker";
import AttributeFilters from "@/components/features/filters/AttributeFilters";

// ─── helpers ────────────────────────────────────────────────────────────────

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

// Maps each product-rule type to how its value is captured in the UI.
// "entity" rules pick real records via EventEntityPicker (stored as id arrays);
// "number"/"tags" use plain inputs; "none" rules take no value.
const RULE_INPUT = {
  manual: { input: "entity", searchType: "product", hint: "محصولات را جستجو و انتخاب کنید" },
  category: { input: "entity", searchType: "category", hint: "دسته‌بندی‌ها را انتخاب کنید" },
  brand: { input: "entity", searchType: "brand", hint: "برندها را انتخاب کنید" },
  serie: { input: "entity", searchType: "serie", hint: "سری‌ها را انتخاب کنید" },
  sport: { input: "entity", searchType: "sport", hint: "ورزش‌ها را انتخاب کنید" },
  new: { input: "number", placeholder: "تعداد روز (پیش‌فرض ۳۰)" },
  bestseller: { input: "number", placeholder: "تعداد (پیش‌فرض ۵۰)" },
  tag: { input: "tags", placeholder: "تگ‌ها را با کاما جدا کنید" },
  discountRule: { input: "discountRules" },
  color: { input: "color" },
  attribute: { input: "attribute" },
  featured: { input: "none" },
  discount: { input: "none" },
};

// Default value for an "attribute" rule — the shared button filter state.
const DEFAULT_ATTRIBUTE_VALUE = { filters: {} };

// Default value object for a "By Color" rule. The admin only picks a color; hue
// tolerance / min-saturation are hardcoded in the resolver. `excludedIds` holds
// products the admin removed from the matched results during review.
const DEFAULT_COLOR_VALUE = { hex: "#ff0080", excludedIds: [] };

const EMPTY_FORM = {
  name: "",
  nameEn: "",
  slug: "",
  shortDescription: "",
  description: "",
  status: "draft",
  startDate: "",
  endDate: "",
  priority: 0,
  visualIdentity: { headerImage: "", icon: "" },
  theme: {
    primaryColor: "#aa4725",
    secondaryColor: "#ffbf00",
    accentColor: "#ffffff",
    backgroundColor: "#0d0d0d",
    textPrimary: "#ffffff",
    // hex (not rgba) so the <input type="color"> body-text picker works
    textSecondary: "#b3b3b3",
    headingFont: "Vazirmatn",
    bodyFont: "Vazirmatn",
    borderRadius: "8px",
    gradient: "",
    effect: { type: "none", intensity: "medium" },
    customCss: "",
  },
  productSelection: {
    rules: [],
    limit: 24,
    sortBy: "createdAt",
    sortOrder: "desc",
  },
  cardCustomization: {
    badge: { enabled: false, text: "", bgColor: "#ef4444", textColor: "#ffffff" },
    ribbon: { enabled: false, text: "", bgColor: "#ef4444", textColor: "#ffffff", position: "top-right" },
    sticker: { enabled: false, image: "", position: "top-left", size: "md" },
    priceHighlight: false,
  },
  seo: { title: "", description: "", keywords: "" },
  social: { ogTitle: "", ogDescription: "", ogImage: "", twitterTitle: "", twitterDescription: "" },
};

const TABS = [
  { id: "basic", label: "اطلاعات پایه", icon: FaInfo },
  { id: "visual", label: "هویت بصری", icon: FaImage },
  { id: "theme", label: "تم", icon: FaPalette },
  { id: "products", label: "محصولات", icon: FaBoxOpen },
  { id: "cards", label: "کارت‌ها", icon: FaCreditCard },
  { id: "seo", label: "SEO", icon: FaSearch },
];

// ─── sub-forms ───────────────────────────────────────────────────────────────

function InputRow({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-[var(--radius)] text-sm font-bold focus:outline-none focus:border-[var(--color-primary)] transition-all ${className}`}
      {...props}
    />
  );
}

function Textarea({ className = "", ...props }) {
  return (
    <textarea
      className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-[var(--radius)] text-sm leading-7 focus:outline-none focus:border-[var(--color-primary)] transition-all resize-none ${className}`}
      {...props}
    />
  );
}

function Select({ className = "", children, ...props }) {
  return (
    <div className={`relative ${className}`}>
      <select
        className="appearance-none w-full pr-4 pl-9 py-2.5 bg-gray-50 border border-gray-200 rounded-[var(--radius)] text-sm font-bold focus:outline-none focus:border-[var(--color-primary)] transition-all"
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
        aria-hidden="true"
      >
        <path strokeLinecap="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

function ColorRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
      <span className="text-xs font-bold text-gray-300">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 font-mono">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-lg cursor-pointer border-none bg-transparent"
        />
      </div>
    </div>
  );
}

// ─── Tab: Basic Info ─────────────────────────────────────────────────────────
function BasicTab({ form, setField }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <InputRow label="نام Collection (فارسی) *">
          <Input
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="مثلاً جشنواره پاییزه"
            required
          />
        </InputRow>
        <InputRow label="نام انگلیسی *">
          <Input
            value={form.nameEn}
            onChange={(e) => {
              const v = e.target.value;
              setField("nameEn", v);
              // شناسه URL به‌صورت خودکار از نام انگلیسی ساخته می‌شود
              setField("slug", slugify(v));
            }}
            placeholder="Autumn Festival"
            dir="ltr"
            required
          />
          {form.slug && (
            <p className="text-[10px] text-gray-400 font-bold mt-1" dir="ltr">
              /collection/{form.slug}
            </p>
          )}
        </InputRow>
      </div>

      <InputRow label="توضیح کوتاه">
        <Input
          value={form.shortDescription}
          onChange={(e) => setField("shortDescription", e.target.value)}
          placeholder="یک جمله توضیح برای کارت Collection"
        />
      </InputRow>

      <InputRow label="توضیحات کامل">
        <Textarea
          rows={4}
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
          placeholder="توضیحات کامل Collection..."
        />
      </InputRow>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <InputRow label="وضعیت">
          <Select
            value={form.status}
            onChange={(e) => setField("status", e.target.value)}
          >
            <option value="draft">پیش‌نویس</option>
            <option value="scheduled">زمان‌بندی‌شده</option>
            <option value="active">فعال</option>
            <option value="paused">متوقف</option>
            <option value="ended">پایان‌یافت</option>
            <option value="archived">بایگانی</option>
          </Select>
        </InputRow>

        <InputRow label="اولویت">
          <Input
            type="number"
            value={form.priority}
            onChange={(e) => setField("priority", parseInt(e.target.value) || 0)}
            min={0}
            max={100}
          />
        </InputRow>

        <InputRow label="تاریخ شروع">
          <Input
            type="datetime-local"
            value={form.startDate}
            onChange={(e) => setField("startDate", e.target.value)}
          />
        </InputRow>

        <InputRow label="تاریخ پایان">
          <Input
            type="datetime-local"
            value={form.endDate}
            onChange={(e) => setField("endDate", e.target.value)}
          />
        </InputRow>
      </div>
    </div>
  );
}

// ─── Tab: Visual Identity ────────────────────────────────────────────────────
// A single header image (used everywhere the event needs a cover/hero visual)
// plus an event icon. The old multi-image fields were removed.
function VisualTab({ form, setField }) {
  const set = (key, val) =>
    setField("visualIdentity", { ...form.visualIdentity, [key]: val });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ImageUpload
          label="تصویر هدر (در همه‌جای Collection استفاده می‌شود)"
          value={form.visualIdentity.headerImage}
          onChange={(url) => set("headerImage", url)}
          folder="events/headers"
        />
        <ImageUpload
          label="آیکون Collection"
          value={form.visualIdentity.icon}
          onChange={(url) => set("icon", url)}
          folder="events/icons"
        />
      </div>
      <p className="text-[11px] text-gray-400 font-bold leading-6">
        تصویر هدر به‌عنوان کاور کارت Collection، هدر صفحه و تصویر اشتراک‌گذاری در شبکه‌های اجتماعی به‌کار می‌رود.
      </p>
    </div>
  );
}

// ─── Tab: Theme ───────────────────────────────────────────────────────────────
// Colors only — typography, gradient, ambient effect and custom CSS were removed.
function ThemeTab({ form, setField }) {
  const t = form.theme;
  const setT = (key, val) => setField("theme", { ...t, [key]: val });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Live preview (colors only) */}
      <div
        className="rounded-2xl overflow-hidden border border-white/10"
        style={{ background: t.backgroundColor }}
      >
        <div
          className="h-1"
          style={{ background: `linear-gradient(to right, ${t.primaryColor}, ${t.secondaryColor})` }}
        />
        <div className="p-6 space-y-3">
          <p
            className="text-xs font-black uppercase tracking-[0.25em] opacity-50"
            style={{ color: t.textPrimary }}
          >
            PREVIEW
          </p>
          {/* Title (uses Title Color = textPrimary) */}
          <h2 className="text-2xl font-black" style={{ color: t.textPrimary }}>
            {form.name || "نام Collection"}
          </h2>
          {/* Description (uses Body Text Color = textSecondary) — mirrors the
              full description shown on the campaign page. */}
          <p className="text-sm leading-7 line-clamp-3" style={{ color: t.textSecondary }}>
            {form.description || "توضیحات کامل Collection در این بخش از صفحه نمایش داده می‌شود."}
          </p>
        </div>
      </div>

      {/* Color controls */}
      <div className="bg-[#111] rounded-2xl p-6 space-y-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
          <FaPalette className="text-[var(--color-primary)]" /> رنگ‌ها
        </p>

        <ColorRow label="رنگ اصلی" value={t.primaryColor} onChange={(v) => setT("primaryColor", v)} />
        <ColorRow label="رنگ ثانویه" value={t.secondaryColor} onChange={(v) => setT("secondaryColor", v)} />
        <ColorRow label="پس‌زمینه" value={t.backgroundColor} onChange={(v) => setT("backgroundColor", v)} />
        <ColorRow label="رنگ متن (عنوان‌ها)" value={t.textPrimary} onChange={(v) => setT("textPrimary", v)} />
        <ColorRow label="رنگ متن (بدنه)" value={t.textSecondary} onChange={(v) => setT("textSecondary", v)} />
      </div>
    </div>
  );
}

// "By Color" rule input — pick a target color + perceptual match thresholds.
// Matching is HSL hue-based on the backend (groups all shades of a color); the
// product count is shown by the shared live preview below the rules list.
const isValidHex = (hex) => typeof hex === "string" && /^#[0-9A-Fa-f]{6}$/.test(hex);

function ColorRuleInput({ value, onChange }) {
  const v = value && typeof value === "object" ? value : DEFAULT_COLOR_VALUE;
  const set = (patch) => onChange({ ...DEFAULT_COLOR_VALUE, ...v, ...patch });
  const hex = isValidHex(v.hex) ? v.hex : "#ff0080";
  const excludedIds = Array.isArray(v.excludedIds) ? v.excludedIds : [];

  const toggleExclude = (id) => {
    const sid = String(id);
    const next = excludedIds.includes(sid)
      ? excludedIds.filter((x) => x !== sid)
      : [...excludedIds, sid];
    set({ excludedIds: next });
  };

  // Per-rule preview: resolve the products matching ONLY this color so the admin
  // can review them and remove individual products before confirming. We send
  // just the hex (no excludedIds) so removed products stay visible (dimmed) and
  // can be restored. Debounced on the picked color.
  const [matches, setMatches] = useState({ loading: false, items: null });

  useEffect(() => {
    if (!isValidHex(hex)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setMatches((m) => ({ ...m, loading: true }));
      try {
        const res = await fetch("/api/admin/events/preview-products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productSelection: {
              rules: [{ type: "color", operator: "include", value: { hex } }],
              limit: 200,
            },
          }),
        });
        const data = await res.json();
        if (!cancelled) setMatches({ loading: false, items: data.products || [] });
      } catch {
        if (!cancelled) setMatches({ loading: false, items: [] });
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [hex]);

  const items = matches.items || [];
  const remaining = items.filter((p) => !excludedIds.includes(String(p._id))).length;

  return (
    <div className="space-y-4 bg-white rounded-lg border border-gray-100 p-4">
      {/* Target color — the only control the admin sets */}
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={hex}
          onChange={(e) => set({ hex: e.target.value })}
          className="w-12 h-10 p-1 border rounded bg-white cursor-pointer shadow-sm shrink-0"
          aria-label="رنگ هدف"
        />
        <Input
          value={v.hex || ""}
          onChange={(e) => set({ hex: e.target.value })}
          placeholder="#ff0080"
          dir="ltr"
          className="font-mono"
        />
        <div
          className="w-10 h-10 rounded-lg border border-gray-200 shrink-0"
          style={{ background: hex }}
          title="پیش‌نمایش رنگ"
        />
      </div>
      <p className="text-[11px] text-gray-400 font-bold leading-5">
        یک رنگ هدف انتخاب کنید — همهٔ محصولاتی که رنگشان در محدودهٔ این رنگ قرار می‌گیرد
        انتخاب می‌شوند (همهٔ طیف‌های صورتی، آبی و … با هم گروه می‌شوند). محصولات ناخواسته را
        می‌توانید از نتایج زیر حذف کنید.
      </p>

      {/* Matched products — review & remove before confirming */}
      <div className="border-t border-gray-100 pt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-black text-gray-600">محصولات منطبق با این رنگ</p>
          {matches.items !== null && (
            <span className="text-[11px] font-bold text-gray-400">
              {remaining.toLocaleString("fa-IR")} انتخاب‌شده
              {excludedIds.length > 0 &&
                ` — ${excludedIds.length.toLocaleString("fa-IR")} حذف‌شده`}
            </span>
          )}
        </div>

        {matches.loading && (
          <p className="text-[11px] text-gray-400 font-bold py-2">در حال بررسی…</p>
        )}

        {!matches.loading && matches.items !== null && items.length === 0 && (
          <p className="text-[11px] text-gray-400 font-bold py-2">
            هیچ محصولی با این رنگ یافت نشد.
          </p>
        )}

        {items.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {items.map((p) => {
              const isExcluded = excludedIds.includes(String(p._id));
              return (
                <div
                  key={p._id}
                  className={`relative bg-white rounded-lg border p-1.5 flex flex-col items-center text-center transition-opacity ${
                    isExcluded ? "border-red-100 opacity-40" : "border-gray-100"
                  }`}
                  title={p.name}
                >
                  <button
                    type="button"
                    onClick={() => toggleExclude(p._id)}
                    className={`absolute top-1 right-1 z-10 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black shadow-sm transition-all ${
                      isExcluded
                        ? "bg-gray-200 text-gray-600 hover:bg-gray-300"
                        : "bg-red-500 text-white hover:bg-red-600"
                    }`}
                    aria-label={isExcluded ? "بازگرداندن محصول" : "حذف محصول"}
                    title={isExcluded ? "بازگرداندن" : "حذف از نتایج"}
                  >
                    {isExcluded ? "↺" : "✕"}
                  </button>
                  <div className="w-full aspect-square rounded-md overflow-hidden bg-gray-50 flex items-center justify-center">
                    {p.mainImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.mainImage} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-gray-200 text-lg">▪</span>
                    )}
                  </div>
                  <p className="text-[9px] font-bold text-gray-500 mt-1 line-clamp-1 w-full">
                    {p.name}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// "By Attribute" rule input — the SAME button filter UI the storefront uses
// (incl. the 16-color swatch grid). Options come from /attribute-options, which
// builds them from the filterable attributes' existing product values. The value
// shape is { filters: { [name]: [values] } }, resolved server-side by
// resolveAttributeRule via the shared productMatchesAttrFilters.
function AttributeRuleInput({ value, onChange }) {
  const v = value && typeof value === "object" ? value : DEFAULT_ATTRIBUTE_VALUE;
  const filters = v.filters && typeof v.filters === "object" ? v.filters : {};
  const [meta, setMeta] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/events/attribute-options");
        const data = await res.json();
        if (!cancelled) setMeta(data.meta || []);
      } catch {
        if (!cancelled) setMeta([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
      {loading && (
        <p className="text-[11px] text-gray-400 font-bold p-4">در حال بارگذاری مشخصات…</p>
      )}
      {!loading && meta.length === 0 && (
        <p className="text-[11px] text-gray-400 font-bold p-4">
          هیچ ویژگیِ «قابل فیلتر» تعریف نشده — از تنظیماتِ دسته‌بندی فعالش کنید.
        </p>
      )}
      {!loading && meta.length > 0 && (
        <AttributeFilters
          attrMeta={meta}
          attrFilters={filters}
          setAttrFilters={(next) => onChange({ filters: next })}
          defaultOpen
        />
      )}
    </div>
  );
}

// ─── Tab: Product Selection ───────────────────────────────────────────────────
function ProductsTab({ form, setField }) {
  const rules = form.productSelection.rules;
  const setPs = (key, val) =>
    setField("productSelection", { ...form.productSelection, [key]: val });

  const addRule = () => {
    setPs("rules", [...rules, { type: "category", operator: "include", value: [], label: "" }]);
  };

  const updateRule = (i, patch) => {
    const next = rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    setPs("rules", next);
  };

  // Reset the value to the right shape when the rule type changes.
  const changeRuleType = (i, type) => {
    const kind = RULE_INPUT[type]?.input;
    const arrayKinds = ["entity", "tags", "discountRules"];
    const value = arrayKinds.includes(kind)
      ? []
      : kind === "color"
      ? { ...DEFAULT_COLOR_VALUE }
      : kind === "attribute"
      ? { filters: {} }
      : kind === "number"
      ? ""
      : "";
    updateRule(i, { type, value });
  };

  const removeRule = (i) => {
    setPs("rules", rules.filter((_, idx) => idx !== i));
  };

  // Live preview — resolves the current rules to real products so the admin can
  // confirm the selection works before saving (works for unsaved drafts too).
  const [preview, setPreview] = useState({ loading: false, items: null, total: 0 });

  const runPreview = async () => {
    setPreview((p) => ({ ...p, loading: true }));
    try {
      const res = await fetch("/api/admin/events/preview-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSelection: form.productSelection }),
      });
      const data = await res.json();
      setPreview({ loading: false, items: data.products || [], total: data.total || 0 });
    } catch {
      toast.error("خطا در دریافت پیش‌نمایش");
      setPreview((p) => ({ ...p, loading: false }));
    }
  };

  // After the first manual preview, keep it in sync with rule edits (debounced),
  // so picking a discount rule updates the product list without re-clicking.
  // Keyed on a stable serialization of the selection (primitive dependency).
  const selectionKey = JSON.stringify(form.productSelection);
  const hasPreviewed = preview.items !== null;
  useEffect(() => {
    if (!hasPreviewed) return;
    const t = setTimeout(() => runPreview(), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey, hasPreviewed]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-gray-400 uppercase">حداکثر محصولات</p>
          <Input
            type="number"
            min={1}
            max={200}
            value={form.productSelection.limit}
            onChange={(e) => setPs("limit", parseInt(e.target.value) || 24)}
          />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black text-gray-400 uppercase">مرتب‌سازی</p>
          <Select value={form.productSelection.sortBy} onChange={(e) => setPs("sortBy", e.target.value)}>
            <option value="createdAt">جدیدترین</option>
            <option value="score">پرفروش‌ترین</option>
            <option value="basePrice">قیمت</option>
            <option value="name">نام</option>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black text-gray-400 uppercase">ترتیب</p>
          <Select value={form.productSelection.sortOrder} onChange={(e) => setPs("sortOrder", e.target.value)}>
            <option value="desc">نزولی</option>
            <option value="asc">صعودی</option>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-black text-gray-700">قوانین انتخاب محصول</p>
          <button
            type="button"
            onClick={addRule}
            className="text-xs font-black px-3 py-1.5 rounded-lg text-white transition-all"
            style={{ background: "var(--color-primary)" }}
          >
            + افزودن قانون
          </button>
        </div>

        {rules.length === 0 && (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-xs font-bold">
            هنوز قانونی تعریف نشده — همه محصولات فعال نمایش داده می‌شوند
          </div>
        )}

        {rules.map((rule, i) => {
          const meta = RULE_INPUT[rule.type] || {};
          return (
            <div key={i} className="bg-gray-50 rounded-xl p-4 space-y-3">
              {/* Row 1: operator + type + remove */}
              <div className="flex items-center gap-3">
                <Select
                  value={rule.operator}
                  onChange={(e) => updateRule(i, { operator: e.target.value })}
                  className="w-28 shrink-0"
                >
                  <option value="include">شامل</option>
                  <option value="exclude">استثنا</option>
                </Select>

                <Select
                  value={rule.type}
                  onChange={(e) => changeRuleType(i, e.target.value)}
                  className="flex-1"
                >
                  <option value="manual">محصولات مشخص</option>
                  <option value="category">دسته‌بندی</option>
                  <option value="brand">برند</option>
                  <option value="serie">سری</option>
                  <option value="sport">ورزش</option>
                  <option value="featured">ویژه‌شده</option>
                  <option value="bestseller">پرفروش‌ها</option>
                  <option value="new">محصولات جدید</option>
                  <option value="discountRule">بر اساس قانون تخفیف</option>
                  <option value="color">بر اساس رنگ</option>
                  <option value="attribute">بر اساس مشخصات</option>
                  <option value="tag">تگ</option>
                </Select>

                <button
                  type="button"
                  onClick={() => removeRule(i)}
                  className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all text-xs border border-red-100"
                  aria-label="حذف قانون"
                >
                  ✕
                </button>
              </div>

              {/* Row 2: value input (depends on rule type) */}
              {meta.input === "entity" && (
                <EventEntityPicker
                  searchType={meta.searchType}
                  value={Array.isArray(rule.value) ? rule.value : []}
                  onChange={(ids) => updateRule(i, { value: ids })}
                  placeholder={meta.hint}
                />
              )}

              {meta.input === "number" && (
                <Input
                  type="number"
                  min={1}
                  value={rule.value ?? ""}
                  onChange={(e) => updateRule(i, { value: e.target.value })}
                  placeholder={meta.placeholder}
                />
              )}

              {meta.input === "tags" && (
                <Input
                  value={Array.isArray(rule.value) ? rule.value.join(", ") : rule.value || ""}
                  onChange={(e) =>
                    updateRule(i, {
                      value: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder={meta.placeholder}
                />
              )}

              {meta.input === "discountRules" && (
                <DiscountRulePicker
                  value={Array.isArray(rule.value) ? rule.value : []}
                  onChange={(ids) => updateRule(i, { value: ids })}
                />
              )}

              {meta.input === "color" && (
                <ColorRuleInput
                  value={rule.value}
                  onChange={(val) => updateRule(i, { value: val })}
                />
              )}

              {meta.input === "attribute" && (
                <AttributeRuleInput
                  value={rule.value}
                  onChange={(val) => updateRule(i, { value: val })}
                />
              )}

              {meta.input === "none" && (
                <p className="text-[11px] text-gray-400 font-bold">
                  این قانون نیازی به مقدار ندارد — به‌صورت خودکار اعمال می‌شود.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Live preview */}
      <div className="border-t border-gray-100 pt-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-black text-gray-700">پیش‌نمایش محصولات</p>
          <button
            type="button"
            onClick={runPreview}
            disabled={preview.loading}
            className="text-xs font-black px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-all disabled:opacity-50"
          >
            {preview.loading ? "در حال بررسی..." : "بررسی نتیجه قوانین"}
          </button>
        </div>

        {preview.items !== null && (
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-bold text-gray-500 mb-3">
              {preview.total > 0
                ? `${preview.total.toLocaleString("fa-IR")} محصول با این قوانین یافت شد`
                : "هیچ محصولی با این قوانین یافت نشد — قوانین را بازبینی کنید"}
            </p>
            {preview.items.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {preview.items.map((p) => (
                  <div
                    key={p._id}
                    className="bg-white rounded-lg border border-gray-100 p-1.5 flex flex-col items-center text-center"
                    title={p.name}
                  >
                    <div className="w-full aspect-square rounded-md overflow-hidden bg-gray-50 flex items-center justify-center">
                      {p.mainImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.mainImage} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-gray-200 text-lg">▪</span>
                      )}
                    </div>
                    <p className="text-[9px] font-bold text-gray-500 mt-1 line-clamp-1 w-full">
                      {p.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Card Customization ──────────────────────────────────────────────────
function CardsTab({ form, setField }) {
  const c = form.cardCustomization;
  const setC = (key, val) => setField("cardCustomization", { ...c, [key]: val });
  const setNested = (group, key, val) =>
    setField("cardCustomization", { ...c, [group]: { ...c[group], [key]: val } });

  return (
    <div className="space-y-6">
      {/* Badge */}
      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="badge-enabled"
            checked={c.badge.enabled}
            onChange={(e) => setNested("badge", "enabled", e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor="badge-enabled" className="text-sm font-black text-gray-700">
            نشان (Badge)
          </label>
        </div>
        {c.badge.enabled && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Input value={c.badge.text} onChange={(e) => setNested("badge", "text", e.target.value)} placeholder="متن نشان" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">رنگ پس‌زمینه</span>
              <input type="color" value={c.badge.bgColor} onChange={(e) => setNested("badge", "bgColor", e.target.value)} className="w-9 h-9 cursor-pointer" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">رنگ متن</span>
              <input type="color" value={c.badge.textColor} onChange={(e) => setNested("badge", "textColor", e.target.value)} className="w-9 h-9 cursor-pointer" />
            </div>
            <div
              className="rounded-full px-3 py-1 text-xs font-black w-fit"
              style={{ background: c.badge.bgColor, color: c.badge.textColor }}
            >
              {c.badge.text || "پیش‌نمایش"}
            </div>
          </div>
        )}
      </div>

      {/* Ribbon */}
      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="ribbon-enabled"
            checked={c.ribbon.enabled}
            onChange={(e) => setNested("ribbon", "enabled", e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor="ribbon-enabled" className="text-sm font-black text-gray-700">
            روبان (Ribbon)
          </label>
        </div>
        {c.ribbon.enabled && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Input value={c.ribbon.text} onChange={(e) => setNested("ribbon", "text", e.target.value)} placeholder="متن روبان" />
            <Select value={c.ribbon.position} onChange={(e) => setNested("ribbon", "position", e.target.value)}>
              <option value="top-right">بالا راست</option>
              <option value="top-left">بالا چپ</option>
            </Select>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">رنگ</span>
              <input type="color" value={c.ribbon.bgColor} onChange={(e) => setNested("ribbon", "bgColor", e.target.value)} className="w-9 h-9 cursor-pointer" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">متن</span>
              <input type="color" value={c.ribbon.textColor} onChange={(e) => setNested("ribbon", "textColor", e.target.value)} className="w-9 h-9 cursor-pointer" />
            </div>
          </div>
        )}
      </div>

      {/* Sticker */}
      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="sticker-enabled"
            checked={c.sticker.enabled}
            onChange={(e) => setNested("sticker", "enabled", e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor="sticker-enabled" className="text-sm font-black text-gray-700">
            استیکر (Sticker)
          </label>
        </div>
        {c.sticker.enabled && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <ImageUpload
              label="تصویر استیکر"
              value={c.sticker.image}
              onChange={(url) => setNested("sticker", "image", url)}
              folder="events/stickers"
            />
            <Select value={c.sticker.position} onChange={(e) => setNested("sticker", "position", e.target.value)}>
              <option value="top-left">بالا چپ</option>
              <option value="top-right">بالا راست</option>
              <option value="bottom-left">پایین چپ</option>
              <option value="bottom-right">پایین راست</option>
            </Select>
            <Select value={c.sticker.size} onChange={(e) => setNested("sticker", "size", e.target.value)}>
              <option value="sm">کوچک</option>
              <option value="md">متوسط</option>
              <option value="lg">بزرگ</option>
            </Select>
          </div>
        )}
      </div>

      {/* Price highlight */}
      <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
        <input
          type="checkbox"
          id="price-highlight"
          checked={c.priceHighlight}
          onChange={(e) => setC("priceHighlight", e.target.checked)}
          className="w-4 h-4"
        />
        <label htmlFor="price-highlight" className="text-sm font-black text-gray-700">
          هایلایت قیمت با رنگ ثانویه Collection
        </label>
      </div>
    </div>
  );
}

// ─── Tab: SEO ─────────────────────────────────────────────────────────────────
function SeoTab({ form, setField }) {
  const setSeo = (key, val) => setField("seo", { ...form.seo, [key]: val });
  const setSocial = (key, val) => setField("social", { ...form.social, [key]: val });

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-sm font-black text-gray-700">متادیتای جستجو</p>
        <InputRow label="عنوان صفحه (SEO Title)">
          <Input value={form.seo.title} onChange={(e) => setSeo("title", e.target.value)} placeholder="عنوان صفحه — پیش‌فرض: نام Collection" />
        </InputRow>
        <InputRow label="توضیحات متا">
          <Textarea rows={2} value={form.seo.description} onChange={(e) => setSeo("description", e.target.value)} placeholder="توضیح کوتاه برای موتور جستجو (۱۵۰–۱۶۰ کاراکتر)" />
        </InputRow>
        <InputRow label="کلیدواژه‌ها (با کاما جدا کنید)">
          <Input value={form.seo.keywords} onChange={(e) => setSeo("keywords", e.target.value)} placeholder="ورزش, تنادور, جشنواره" />
        </InputRow>
      </div>

      <hr />

      <div className="space-y-4">
        <p className="text-sm font-black text-gray-700">Open Graph (شبکه‌های اجتماعی)</p>
        <InputRow label="عنوان OG">
          <Input value={form.social.ogTitle} onChange={(e) => setSocial("ogTitle", e.target.value)} />
        </InputRow>
        <InputRow label="توضیح OG">
          <Textarea rows={2} value={form.social.ogDescription} onChange={(e) => setSocial("ogDescription", e.target.value)} />
        </InputRow>
        <InputRow label="تصویر OG">
          <ImageUpload
            label=""
            value={form.social.ogImage}
            onChange={(url) => setSocial("ogImage", url)}
            folder="events/og"
          />
        </InputRow>
        <div className="grid grid-cols-2 gap-4">
          <InputRow label="عنوان توییتر">
            <Input value={form.social.twitterTitle} onChange={(e) => setSocial("twitterTitle", e.target.value)} />
          </InputRow>
          <InputRow label="توضیح توییتر">
            <Input value={form.social.twitterDescription} onChange={(e) => setSocial("twitterDescription", e.target.value)} />
          </InputRow>
        </div>
      </div>
    </div>
  );
}

// ─── Main EventForm ───────────────────────────────────────────────────────────
export default function EventForm({ eventId = null }) {
  const router = useRouter();
  const isEdit = !!eventId;

  const [activeTab, setActiveTab] = useState("basic");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [form, setForm] = useState(EMPTY_FORM);

  const setField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await fetch(`/api/admin/events/${eventId}`);
        const data = await res.json();
        if (!res.ok) { toast.error(data.error || "خطا"); return; }

        // Normalize date fields to datetime-local format
        const toLocal = (d) =>
          d ? new Date(d).toISOString().slice(0, 16) : "";

        setForm({
          ...EMPTY_FORM,
          ...data,
          startDate: toLocal(data.startDate),
          endDate: toLocal(data.endDate),
          seo: { ...EMPTY_FORM.seo, ...data.seo, keywords: (data.seo?.keywords || []).join(", ") },
          social: { ...EMPTY_FORM.social, ...data.social },
          theme: { ...EMPTY_FORM.theme, ...data.theme, effect: { ...EMPTY_FORM.theme.effect, ...data.theme?.effect } },
          visualIdentity: { ...EMPTY_FORM.visualIdentity, ...data.visualIdentity },
          productSelection: { ...EMPTY_FORM.productSelection, ...data.productSelection },
          cardCustomization: {
            ...EMPTY_FORM.cardCustomization,
            ...data.cardCustomization,
            badge: { ...EMPTY_FORM.cardCustomization.badge, ...data.cardCustomization?.badge },
            ribbon: { ...EMPTY_FORM.cardCustomization.ribbon, ...data.cardCustomization?.ribbon },
            sticker: { ...EMPTY_FORM.cardCustomization.sticker, ...data.cardCustomization?.sticker },
          },
        });
      } catch { toast.error("خطا در بارگذاری"); }
      finally { setFetching(false); }
    })();
  }, [eventId, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("نام Collection الزامی است"); setActiveTab("basic"); return; }
    if (!form.slug.trim()) { toast.error("نام انگلیسی الزامی است (برای ساخت شناسه URL)"); setActiveTab("basic"); return; }

    setLoading(true);
    try {
      const payload = {
        ...form,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        seo: {
          ...form.seo,
          keywords: form.seo.keywords
            ? form.seo.keywords.split(",").map((k) => k.trim()).filter(Boolean)
            : [],
        },
      };

      const res = await fetch(
        isEdit ? `/api/admin/events/${eventId}` : "/api/admin/events",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();

      if (res.ok) {
        await Swal.fire({
          icon: "success",
          title: isEdit ? "Collection به‌روزرسانی شد" : "Collection ساخته شد",
          confirmButtonColor: "var(--color-primary)",
          timer: 2000,
          showConfirmButton: false,
        });
        router.push("/p-admin/admin-events/campaigns");
        router.refresh();
      } else {
        toast.error(data.error || "خطا در ذخیره");
      }
    } catch { toast.error("خطای شبکه"); }
    finally { setLoading(false); }
  };

  if (fetching) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-black/10 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  const tabComponents = {
    basic: <BasicTab form={form} setField={setField} />,
    visual: <VisualTab form={form} setField={setField} />,
    theme: <ThemeTab form={form} setField={setField} />,
    products: <ProductsTab form={form} setField={setField} />,
    cards: <CardsTab form={form} setField={setField} />,
    seo: <SeoTab form={form} setField={setField} />,
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-6xl mx-auto pb-24 space-y-6" dir="rtl">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
            style={{ background: form.theme?.primaryColor || "var(--color-primary)" }}
          >
            <FaCalendarAlt size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900">
              {isEdit ? `ویرایش: ${form.name || "..."}` : "Collection جدید"}
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">
              Collection
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm text-white hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50"
          style={{ background: "var(--color-primary)" }}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : isEdit ? (
            <><FaSave size={14} /> ذخیره تغییرات</>
          ) : (
            <><FaRocket size={14} /> انتشار Collection</>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex overflow-x-auto no-scrollbar border-b border-gray-100">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-4 text-xs font-black whitespace-nowrap border-b-2 transition-all ${
                  activeTab === tab.id
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-transparent text-gray-400 hover:text-gray-700"
                }`}
              >
                <Icon size={13} /> {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">{tabComponents[activeTab]}</div>
      </div>
    </form>
  );
}
