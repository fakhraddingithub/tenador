'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/admin/Button';
import Input from '@/components/admin/Input';
import Textarea from '@/components/admin/Textarea';
import Select from '@/components/admin/Select';
import ImageUpload from '@/components/admin/ImageUpload';
import VariantValueImageUpload from '@/components/admin/VariantValueImageUpload';
import { showToast } from '@/lib/toast';
import { showError } from '@/lib/swal';
import { makeComboKey } from '@/lib/variantKey';

// ---------------------------
// Helpers
// ---------------------------
function normalizeInitialAttributes(attributes = {}, categoryAttributes = []) {
  const result = {};
  for (const attr of categoryAttributes) {
    const value = attributes[attr.name];
    if (attr.type === 'select') {
      result[attr.name] = Array.isArray(value) ? value.join(', ') : '';
    } else {
      result[attr.name] = value ?? '';
    }
  }
  return result;
}

/** Cartesian product of variantOptions — mirrors the backend logic exactly */
function generateCombinations(options) {
  const keys = Object.keys(options).filter(
    k => Array.isArray(options[k]) && options[k].length > 0
  );
  if (keys.length === 0) return [];

  const result = [];
  function helper(index, currentCombo) {
    if (index === keys.length) {
      result.push({ ...currentCombo });
      return;
    }
    const key = keys[index];
    for (const val of options[key]) {
      helper(index + 1, { ...currentCombo, [key]: val });
    }
  }
  helper(0, {});
  return result;
}

// کلید ترکیب از util مشترک ساخته می‌شود (makeComboKey) — هم‌خوان با سرور.

// ---------------------------
// Main Component
// ---------------------------
export default function ProductCreateForm({ initialData = {} }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [sports, setSports] = useState([]);
  const [brands, setBrands] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [limitedEditions, setLimitedEditions] = useState([]);

  // Normalize athlete from initialData to always be an array
  const initialAthletes = Array.isArray(initialData.athlete)
    ? initialData.athlete
    : initialData.athlete
    ? [initialData.athlete]
    : [];

  const [formData, setFormData] = useState({
    name: '',
    shortDescription: '',
    longDescription: '',
    color: '',
    basePrice: '',
    category: '',
    tag: '',
    mainImage: '',
    gallery: [],
    brand: '',
    serie: '',
    limitedEdition: '',
    sport: '',
    attributes: {},
    technicalStats: {},
    label: 'none',
    isActive: true,
    ...initialData,
    // Override athlete to guarantee array form
    athlete: initialAthletes,
  });

  // Variant state — kept outside formData for clarity
  const [variantOptions, setVariantOptions] = useState(
    initialData.variantOptions || {}
  );
  const [variantInputBuffer, setVariantInputBuffer] = useState({});
  // { "color=...&size=...": { price: "", images: [] } }
  const [variantDetails, setVariantDetails] = useState(
    initialData.variantDetails || {}
  );

  // ترکیب‌هایی که ادمین صریحاً تیکشان را برداشته (مجموعه‌ی استثناها). «انتخاب‌شده»
  // در زمان رندر مشتق می‌شود: هر ترکیبی که در این مجموعه نباشد ساخته می‌شود. بنابراین
  // ترکیب‌های تازه‌اضافه‌شده خودبه‌خود انتخاب‌اند و نیازی به effectِ همگام‌سازی نیست.
  const [deselectedCombos, setDeselectedCombos] = useState(() => new Set());

  // متادیتای سطحِ مقدار: تصاویرِ مشترکِ هر مقدار { [attr]: { [value]: { images: [] } } }
  const [variantMeta, setVariantMeta] = useState(initialData.variantMeta || {});

  // ترکیب‌هایی که ادمین «قیمت ویژه» را برایشان باز کرده. قیمت اختیاری است؛ خالی
  // بودنش یعنی قیمت پایه‌ی محصول اعمال می‌شود (هیچ‌جا الزامی نیست).
  const [expandedPrices, setExpandedPrices] = useState(() => new Set());

  // ---------------------------
  // Data Fetching
  // ---------------------------
  useEffect(() => {
    fetchBaseData();
  }, []);

  useEffect(() => {
    if (formData.sport) fetchAthletes(formData.sport);
    else setAthletes([]);
  }, [formData.sport]);

  async function fetchBaseData() {
    try {
      const [sportsRes, brandsRes, categoriesRes, limitedEditionsRes] = await Promise.all([
        fetch('/api/sports'),
        fetch('/api/brands'),
        fetch('/api/categories'),
        fetch('/api/limited-editions'),
      ]);
      const [sportsData, brandsData, categoriesData, limitedEditionsData] = await Promise.all([
        sportsRes.json(),
        brandsRes.json(),
        categoriesRes.json(),
        limitedEditionsRes.json(),
      ]);
      setSports(sportsData.sports || []);
      setBrands(brandsData.brands || []);
      setCategories(categoriesData.categories || []);
      setLimitedEditions(limitedEditionsData.limitedEditions || []);
    } catch (err) {
      showError('خطا', 'خطا در بارگذاری داده‌های پایه');
    }
  }

  async function fetchAthletes(sportId) {
    try {
      const res = await fetch('/api/athletes');
      const data = await res.json();
      setAthletes(
        (data.athletes || []).filter(
          a => (a.sport?._id || a.sport) === sportId
        )
      );
    } catch {
      setAthletes([]);
    }
  }

  // ---------------------------
  // Derived category data
  // ---------------------------
  const selectedCategory = categories.find(c => c._id === formData.category);
  const categoryAttributes = selectedCategory?.attributes || [];
  const categoryVariantAttributes = selectedCategory?.variantAttributes || [];
  const categoryTechnicalStats = selectedCategory?.technicalStats || [];

  /** When category changes, re-normalize attributes from initialData */
  useEffect(() => {
    if (!selectedCategory || !initialData.attributes) return;
    setFormData(prev => ({
      ...prev,
      attributes: normalizeInitialAttributes(
        initialData.attributes,
        selectedCategory.attributes
      ),
    }));
  }, [selectedCategory]);

  // ---------------------------
  // Variant combinations (memoized)
  // ---------------------------
  const combinations = useMemo(
    () => generateCombinations(variantOptions),
    [variantOptions]
  );

  /**
   * When combinations change, keep existing detail entries and
   * initialise any new combo key with empty defaults.
   */
  useEffect(() => {
    setVariantDetails(prev => {
      const next = {};
      for (const combo of combinations) {
        const key = makeComboKey(combo);
        next[key] = prev[key] || { price: '', images: [] };
      }
      return next;
    });
  }, [combinations]);

  const toggleCombo = (key) => {
    setDeselectedCombos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const setAllCombos = (select) => {
    setDeselectedCombos(
      select ? new Set() : new Set(combinations.map(makeComboKey))
    );
  };

  // تنظیم تصاویرِ یک مقدار مشخص (مثلاً تصاویرِ رنگ «قرمز»)
  const setValueImages = (attrName, value, images) => {
    setVariantMeta((prev) => ({
      ...prev,
      [attrName]: {
        ...(prev[attrName] || {}),
        [value]: { ...(prev[attrName]?.[value] || {}), images },
      },
    }));
  };

  // فقط متادیتای مقادیرِ موجود را نگه می‌دارد (هرسِ مقادیرِ حذف‌شده)
  const buildCleanVariantMeta = () => {
    const clean = {};
    for (const attr of categoryVariantAttributes) {
      for (const val of variantOptions[attr.name] || []) {
        const entry = variantMeta[attr.name]?.[val];
        if (!entry) continue;
        const imgs = Array.isArray(entry.images) ? entry.images.filter(Boolean) : [];
        const hasUnits = entry.units && Object.keys(entry.units).length > 0;
        if (imgs.length || hasUnits) {
          if (!clean[attr.name]) clean[attr.name] = {};
          clean[attr.name][val] = { ...entry, images: imgs };
        }
      }
    }
    return clean;
  };

  // تعداد ترکیب‌های انتخاب‌شده (مشتق در رندر، بدون state اضافه)
  const selectedComboCount = combinations.reduce(
    (n, c) => (deselectedCombos.has(makeComboKey(c)) ? n : n + 1),
    0
  );

  // ---------------------------
  // Field updaters
  // ---------------------------
  function updateField(key, value) {
    setFormData(prev => ({ ...prev, [key]: value }));
  }

  // Helper to validate hex color format safely for HTML input[type=color]
  const isValidHex = (hex) => {
    return typeof hex === 'string' && /^#[0-9A-F]{6}$/i.test(hex);
  };

  function updateAttribute(key, value) {
    setFormData(prev => ({
      ...prev,
      attributes: { ...prev.attributes, [key]: value },
    }));
  }

  function updateTechnicalStat(key, value) {
    setFormData(prev => ({
      ...prev,
      technicalStats: { ...prev.technicalStats, [key]: value },
    }));
  }

  /** Toggle a single athlete ID in/out of the athlete array */
  function toggleAthlete(athleteId) {
    setFormData(prev => {
      const current = Array.isArray(prev.athlete) ? prev.athlete : [];
      const exists = current.includes(athleteId);
      return {
        ...prev,
        athlete: exists
          ? current.filter(id => id !== athleteId)
          : [...current, athleteId],
      };
    });
  }

  // ---------------------------
  // Variant option tag-input
  // ---------------------------
  function addVariantValue(attr) {
    const attrName = attr.name;

    if (attr.multiUnit) {
      const units = attr.units || [];
      const buf = variantInputBuffer[attrName] || {};
      const primary = (buf[units[0]] || '').trim();
      if (!primary) return; // مقدارِ واحدِ اصلی الزامی است

      setVariantOptions(prev => {
        const existing = prev[attrName] || [];
        if (existing.includes(primary)) return prev;
        return { ...prev, [attrName]: [...existing, primary] };
      });

      const unitsMap = {};
      for (const u of units) unitsMap[u] = (buf[u] || '').trim();
      setVariantMeta(prev => ({
        ...prev,
        [attrName]: {
          ...(prev[attrName] || {}),
          [primary]: { ...(prev[attrName]?.[primary] || {}), units: unitsMap },
        },
      }));
      setVariantInputBuffer(prev => ({ ...prev, [attrName]: {} }));
      return;
    }

    const value = (variantInputBuffer[attrName] || '').trim();
    if (!value) return;

    setVariantOptions(prev => {
      const existing = prev[attrName] || [];
      if (existing.includes(value)) return prev;
      return { ...prev, [attrName]: [...existing, value] };
    });
    setVariantInputBuffer(prev => ({ ...prev, [attrName]: '' }));
  }

  function removeVariantValue(attrName, value) {
    setVariantOptions(prev => ({
      ...prev,
      [attrName]: (prev[attrName] || []).filter(v => v !== value),
    }));
  }

  // ---------------------------
  // Variant detail updater
  // ---------------------------
  function updateVariantDetail(comboKey, field, value) {
    setVariantDetails(prev => ({
      ...prev,
      [comboKey]: {
        ...(prev[comboKey] || { price: '', images: [] }),
        [field]: value,
      },
    }));
  }

  // ── قیمت ویژه (اختیاری، جمع‌شونده) ──
  // ورودیِ قیمت پیش‌فرض پنهان است؛ فقط وقتی نمایش داده می‌شود که ادمین «قیمت ویژه»
  // را باز کرده باشد یا ترکیب از قبل قیمت سفارشی داشته باشد. خالی = قیمت پایه.
  const isPriceVisible = (key, detail) =>
    expandedPrices.has(key) || (detail.price !== '' && detail.price != null);
  const showPriceInput = (key) =>
    setExpandedPrices(prev => new Set(prev).add(key));
  const clearCustomPrice = (key) => {
    updateVariantDetail(key, 'price', '');
    setExpandedPrices(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  // ---------------------------
  // Submit
  // ---------------------------
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      // Normalize category attributes
      const normalizedAttributes = {};
      for (const attr of categoryAttributes) {
        const rawValue = formData.attributes?.[attr.name];
        if (!rawValue) continue;

        if (attr.type === 'select') {
          normalizedAttributes[attr.name] = rawValue
            .split(',')
            .map(v => v.trim())
            .filter(Boolean);
        } else if (attr.type === 'number') {
          normalizedAttributes[attr.name] = Number(rawValue);
        } else {
          normalizedAttributes[attr.name] = rawValue;
        }
      }

      // Normalize technical stats
      const normalizedStats = {};
      for (const stat of categoryTechnicalStats) {
        const val = formData.technicalStats?.[stat.name];
        if (val !== undefined && val !== '') {
          normalizedStats[stat.name] = Number(val);
        }
      }

      // Normalize variant details (price → number)
      const normalizedVariantDetails = {};
      for (const [key, detail] of Object.entries(variantDetails)) {
        normalizedVariantDetails[key] = {
          price: Number(detail.price) || 0,
          images: detail.images || [],
        };
      }

      // Normalize tags
      const normalizedTag = formData.tag
        ? Array.isArray(formData.tag)
          ? formData.tag
          : formData.tag
              .split(',')
              .map(t => t.trim())
              .filter(Boolean)
        : [];

      const payload = {
        ...formData,
        attributes: normalizedAttributes,
        technicalStats: normalizedStats,
        basePrice: Number(formData.basePrice) || 0,
        tag: normalizedTag,
        athlete: Array.isArray(formData.athlete) ? formData.athlete : [],
        label: formData.label,
        // Only include variant fields if they have data
        ...(Object.keys(variantOptions).length > 0 && {
          variantOptions,
          variantDetails: normalizedVariantDetails,
          // فقط ترکیب‌های انتخاب‌شده (غیرِ استثناشده) ساخته می‌شوند
          selectedCombos: combinations
            .map(makeComboKey)
            .filter((k) => !deselectedCombos.has(k)),
          // تصاویرِ سطحِ مقدار (مشترک بین واریانت‌ها)
          variantMeta: buildCleanVariantMeta(),
        }),
      };

      const res = await fetch('/api/product/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast.success('محصول ساخته شد');
      router.push(
        `/p-admin/admin-categories/category-products/${selectedCategory._id}`
      );
    } catch (err) {
      showError('خطا', err.message || 'خطا در ایجاد محصول');
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------
  // Render
  // ---------------------------
  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 bg-white p-8 rounded-lg shadow"
    >
      {/* ── Name ── */}
      <div className="grid md:grid-cols-2 gap-6">
        <Input
          label="نام محصول"
          value={formData.name}
          onChange={e => updateField('name', e.target.value)}
        />
      </div>

      {/* ── Descriptions ── */}
      <Textarea
        label="توضیح کوتاه"
        rows={3}
        value={formData.shortDescription}
        onChange={e => updateField('shortDescription', e.target.value)}
      />
      <Textarea
        label="توضیح کامل"
        rows={6}
        value={formData.longDescription}
        onChange={e => updateField('longDescription', e.target.value)}
      />

      {/* ── Brand / Serie / Sport ── */}
      <div className="grid md:grid-cols-3 gap-6">
        <Select
          label="برند"
          value={formData.brand}
          onChange={e => {
            setFormData(prev => ({
              ...prev,
              brand: e.target.value,
              serie: '',
              limitedEdition: '',
              color: ''
            }));
          }}
          options={brands.map(b => ({ value: b._id, label: b.name }))}
        />

        {formData.brand && (
          <Select
            label="سری (Series)"
            value={formData.serie}
            onChange={e => {
              const selectedSerieId = e.target.value;
              const currentBrand = brands.find(b => b._id === formData.brand);
              const selectedSerie = currentBrand?.series?.find(s => s._id === selectedSerieId);
              const primaryColor = selectedSerie?.colors?.primary || '';
              
              setFormData(prev => ({
                ...prev,
                serie: selectedSerieId,
                color: primaryColor // Auto-fill on selection change
              }));
            }}
            options={
              brands
                .find(b => b._id === formData.brand)
                ?.series?.map(s => ({ value: s._id, label: s.name })) || []
            }
          />
        )}

        <Select
          label="ورزش"
          value={formData.sport}
          onChange={e => updateField('sport', e.target.value)}
          options={sports.map(s => ({ value: s._id, label: s.name }))}
        />

        {/* لیمیتد ادیشن — مخصوص برند انتخاب‌شده (مثل Roland Garros) */}
        {formData.brand && (
          <Select
            label="لیمیتد ادیشن (Limited Edition)"
            value={formData.limitedEdition}
            onChange={e => updateField('limitedEdition', e.target.value)}
            options={[
              { value: '', label: 'بدون لیمیتد ادیشن' },
              ...limitedEditions
                .filter(c => (c.brand?._id || c.brand) === formData.brand)
                .map(c => ({
                  value: c._id,
                  label: c.title || c.name,
                })),
            ]}
          />
        )}
      </div>

      {/* ── Athletes (multi-select checkboxes) ── */}
      {athletes.length > 0 && (
        <div className="border rounded-lg p-4">
          <h3 className="font-bold mb-1 text-gray-700">ورزشکاران</h3>
          <p className="text-xs text-gray-400 mb-3">
            می‌توانید چند ورزشکار انتخاب کنید.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
            {athletes.map(a => {
              const selected =
                Array.isArray(formData.athlete) &&
                formData.athlete.includes(a._id);
              return (
                <label
                  key={a._id}
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors select-none ${
                    selected
                      ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleAthlete(a._id)}
                    className="accent-[var(--color-primary)] w-4 h-4 shrink-0"
                  />
                  <span className="text-sm truncate">{a.title}</span>
                </label>
              );
            })}
          </div>
          {Array.isArray(formData.athlete) && formData.athlete.length > 0 && (
            <p className="text-xs text-[var(--color-primary)] mt-2 font-medium">
              {formData.athlete.length} ورزشکار انتخاب شده
            </p>
          )}
        </div>
      )}

      {/* ── Category / Price / Label / Color ── */}
      <div className="grid md:grid-cols-2 gap-6">
        <Select
          label="دسته‌بندی"
          value={formData.category}
          onChange={e => updateField('category', e.target.value)}
          options={categories.map(c => ({ value: c._id, label: c.title }))}
        />

        <Input
          label="قیمت پایه"
          type="number"
          value={formData.basePrice}
          onChange={e => updateField('basePrice', e.target.value)}
        />

        {/* Dynamic & Editable Color Field */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input
              label="رنگ محصول (کد Hex)"
              value={formData.color}
              onChange={e => updateField('color', e.target.value)}
              placeholder="مثال: #ff0000"
            />
          </div>
          <input
            type="color"
            value={isValidHex(formData.color) ? formData.color : '#ffffff'}
            onChange={e => updateField('color', e.target.value)}
            className="w-12 h-10 p-1 border rounded bg-white cursor-pointer mb-1 shadow-sm transition-transform hover:scale-105"
            title="انتخابگر رنگ کمکی"
          />
        </div>

        <Select
          label="برچسب محصول (Label)"
          value={formData.label}
          onChange={e => updateField('label', e.target.value)}
          options={[
            { value: 'none', label: 'بدون برچسب' },
            { value: 'new', label: 'جدید' },
            { value: 'hot', label: 'پرطرفدار' },
            { value: 'limited', label: 'تعداد محدود' },
          ]}
        />

        <Select
          label="وضعیت نمایش محصول"
          value={formData.isActive ? 'true' : 'false'}
          onChange={e => updateField('isActive', e.target.value === 'true')}
          options={[
            { value: 'true', label: 'فعال (نمایش در سایت)' },
            { value: 'false', label: 'غیرفعال (مخفی در سایت)' },
          ]}
        />
      </div>

      {/* ── Category Attributes (fixed) ── */}
      {categoryAttributes.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="font-bold mb-4">ویژگی‌های ثابت</h3>
          <table className="w-full border rounded-lg">
            <tbody>
              {categoryAttributes.map(attr => (
                <tr key={attr.name} className="border-b">
                  <td className="p-3 font-medium bg-gray-50 whitespace-nowrap">
                    {attr.label}
                    {attr.required && (
                      <span className="text-red-500 mr-1">*</span>
                    )}
                  </td>
                  <td className="p-3">
                    <Input
                      type={attr.type === 'number' ? 'number' : 'text'}
                      value={formData.attributes?.[attr.name] || ''}
                      onChange={e =>
                        updateAttribute(attr.name, e.target.value)
                      }
                      placeholder={
                        attr.type === 'select'
                          ? 'مثال: L2, L3, L4'
                          : `مقدار ${attr.label}`
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Variant Attributes (dynamic) ── */}
      {categoryVariantAttributes.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="font-bold mb-1 text-purple-800">
            ویژگی‌های متغیر (واریانت‌ها)
          </h3>
          <p className="text-xs text-gray-500 mb-5">
            برای هر ویژگی مقادیر موجود را اضافه کنید. تصاویر در بخش «تصاویر هر مقدار»
            بارگذاری می‌شوند؛ تعیین قیمت برای هر ترکیب اختیاری است (خالی = قیمت پایه).
          </p>

          {/* ── Tag inputs per variantAttribute ── */}
          <div className="space-y-4 mb-6">
            {categoryVariantAttributes.map(attr => (
              <div
                key={attr.name}
                className="border rounded-lg p-4 bg-purple-50/30"
              >
                <label className="block font-medium text-gray-700 mb-2">
                  {attr.label}
                  {attr.prompt && (
                    <span className="text-xs text-gray-400 mr-2 font-normal">
                      ({attr.prompt})
                    </span>
                  )}
                </label>

                {/* Input + Add button */}
                {attr.multiUnit ? (
                  <div className="mb-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(attr.units || []).map((unit, ui) => (
                        <input
                          key={unit}
                          type="text"
                          dir="ltr"
                          style={{ unicodeBidi: "isolate" }}
                          className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                          placeholder={`${attr.label} — ${unit}${ui === 0 ? ' (اصلی)' : ''}`}
                          value={variantInputBuffer[attr.name]?.[unit] || ''}
                          onChange={e =>
                            setVariantInputBuffer(prev => ({
                              ...prev,
                              [attr.name]: { ...(prev[attr.name] || {}), [unit]: e.target.value },
                            }))
                          }
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addVariantValue(attr);
                            }
                          }}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => addVariantValue(attr)}
                      className="px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 transition-colors"
                    >
                      + افزودن مقدار
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      dir="ltr"
                      style={{ unicodeBidi: "isolate" }}
                      className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                      placeholder={`مقدار جدید برای ${attr.label}…`}
                      value={variantInputBuffer[attr.name] || ''}
                      onChange={e =>
                        setVariantInputBuffer(prev => ({
                          ...prev,
                          [attr.name]: e.target.value,
                        }))
                      }
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addVariantValue(attr);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => addVariantValue(attr)}
                      className="px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 transition-colors"
                    >
                      + افزودن
                    </button>
                  </div>
                )}

                {/* Value tags */}
                <div className="flex flex-wrap gap-2 min-h-[2rem]">
                  {(variantOptions[attr.name] || []).map(val => {
                    const u = attr.multiUnit ? variantMeta[attr.name]?.[val]?.units : null;
                    const display = u
                      ? (attr.units || []).map(unit => `${u[unit] ?? '—'} ${unit}`).join(' / ')
                      : val;
                    return (
                      <span
                        key={val}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium"
                      >
                        <span dir="ltr" style={{ unicodeBidi: "isolate" }}>
                          {display}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeVariantValue(attr.name, val)}
                          className="text-purple-400 hover:text-red-600 font-bold leading-none ml-1"
                          title="حذف"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                  {!(variantOptions[attr.name] || []).length && (
                    <span className="text-xs text-gray-400 italic">
                      هنوز مقداری اضافه نشده
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── تصاویرِ هر مقدار (مشترک بین واریانت‌ها) ── */}
          {categoryVariantAttributes.some(
            (attr) => (variantOptions[attr.name] || []).length > 0
          ) && (
            <div className="mb-6 border rounded-lg p-4 bg-blue-50/30">
              <h4 className="font-semibold mb-1 text-blue-800">تصاویر هر مقدار</h4>
              <p className="text-xs text-gray-500 mb-4">
                تصاویری که برای هر مقدار (مثلاً هر رنگ) بارگذاری می‌کنید بین همه‌ی
                واریانت‌هایی که آن مقدار را دارند مشترک است؛ لازم نیست برای هر سایز جدا آپلود کنید.
              </p>
              <div className="space-y-5">
                {categoryVariantAttributes.map((attr) => {
                  const values = variantOptions[attr.name] || [];
                  if (!values.length) return null;
                  return (
                    <div key={attr.name}>
                      <p className="text-sm font-bold text-gray-700 mb-2">{attr.label}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {values.map((val) => (
                          <div key={val} className="border rounded-lg p-3 bg-white">
                            <p className="text-xs font-semibold text-gray-600 mb-2">{val}</p>
                            <VariantValueImageUpload
                              value={variantMeta[attr.name]?.[val]?.images || []}
                              onChange={(imgs) => setValueImages(attr.name, val, imgs)}
                              folder="product/variant-values"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Combination detail cards ── */}
          {combinations.length > 0 && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <h4 className="font-semibold text-gray-700">
                  جزئیات ترکیب‌ها
                  <span className="mr-2 text-xs font-normal text-gray-400">
                    ({selectedComboCount} از {combinations.length} انتخاب‌شده)
                  </span>
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAllCombos(true)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 transition-colors"
                  >
                    انتخاب همه
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllCombos(false)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    حذف همه
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-4">
                فقط ترکیب‌هایی که تیک دارند ساخته می‌شوند؛ ترکیب‌های بدون تیک نادیده گرفته می‌شوند.
              </p>

              <div className="space-y-4">
                {combinations.map(combo => {
                  const key = makeComboKey(combo);
                  const detail = variantDetails[key] || {
                    price: '',
                    images: [],
                  };
                  const isSelected = !deselectedCombos.has(key);

                  return (
                    <div
                      key={key}
                      className={`border rounded-lg p-4 bg-white shadow-sm transition-opacity ${
                        isSelected ? 'border-purple-200' : 'border-gray-200 opacity-60'
                      }`}
                    >
                      {/* Combo label + انتخاب ساخت */}
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <label className="flex items-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCombo(key)}
                            className="w-5 h-5 rounded accent-purple-600 shrink-0"
                          />
                          <span className="sr-only">ساخت این ترکیب</span>
                        </label>
                        {Object.entries(combo).map(([k, v]) => (
                          <span
                            key={k}
                            className="px-2 py-0.5 bg-gray-100 rounded text-sm font-medium text-gray-700"
                          >
                            {k}:{' '}
                            <span className="text-purple-700 font-semibold">
                              {v}
                            </span>
                          </span>
                        ))}
                        {!isSelected && (
                          <span className="text-[11px] font-bold text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full mr-auto">
                            ساخته نمی‌شود
                          </span>
                        )}
                      </div>

                      {/* قیمت ویژه (اختیاری) — تصاویر در بخش «تصاویر هر مقدار» مدیریت می‌شوند */}
                      {isPriceVisible(key, detail) ? (
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1 font-medium">
                              قیمت ویژه (یورو){' '}
                              <span className="text-gray-400 font-normal">— خالی = قیمت پایه</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                              placeholder="قیمت پایه‌ی محصول"
                              value={detail.price}
                              onChange={e =>
                                updateVariantDetail(key, 'price', e.target.value)
                              }
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => clearCustomPrice(key)}
                            className="px-2 py-2 text-xs font-bold text-gray-400 hover:text-red-600 transition-colors"
                            title="حذف قیمت ویژه (استفاده از قیمت پایه)"
                          >
                            حذف
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => showPriceInput(key)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          + قیمت ویژه
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Technical Stats ── */}
      {categoryTechnicalStats.length > 0 && (
        <div className="border-t pt-6 bg-blue-50/30 p-4 rounded-lg">
          <h3 className="font-bold mb-4 text-blue-800">
            شاخص‌های فنی (نمودار رادار)
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            نمره‌ای بین 0 تا 100 وارد کنید.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {categoryTechnicalStats.map(stat => (
              <div
                key={stat.name}
                className="flex items-center space-x-reverse space-x-3 bg-white p-2 border rounded shadow-sm"
              >
                <label className="w-1/2 text-sm font-medium text-gray-700">
                  {stat.label}
                </label>
                <div className="w-1/2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0-100"
                    value={formData.technicalStats?.[stat.name] || ''}
                    onChange={e =>
                      updateTechnicalStat(stat.name, e.target.value)
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tags ── */}
      <Input
        label="تگ‌ها (با کاما جدا کنید)"
        value={formData.tag}
        onChange={e => updateField('tag', e.target.value)}
      />

      {/* ── Images ── */}
      <ImageUpload
        label="تصویر اصلی"
        value={formData.mainImage}
        onChange={v => updateField('mainImage', v)}
        folder="product"
      />

      <ImageUpload
        label="گالری"
        multiple
        value={formData.gallery}
        onChange={v => updateField('gallery', v)}
        folder="product"
      />

      <Button type="submit" loading={loading}>
        ایجاد محصول
      </Button>
    </form>
  );
}
