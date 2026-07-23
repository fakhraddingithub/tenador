'use client';

import AdminInput from "@/components/admin/AdminInput";
import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { FaEdit, FaBox, FaImages, FaTags, FaCogs, FaPalette, FaRunning, FaLayerGroup } from 'react-icons/fa';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { AnimatePresence, motion } from 'framer-motion';
import Button from '@/components/admin/Button';
import AdminLoader from '@/components/admin/AdminLoader';
import Input from '@/components/admin/Input';
import Textarea from '@/components/admin/Textarea';
import Select from '@/components/admin/Select';
import ImageUpload from '@/components/admin/ImageUpload';
import VariantValueImageUpload from '@/components/admin/VariantValueImageUpload';
import VariantValuesEditor from '@/components/admin/VariantValuesEditor';
import { showToast } from '@/lib/toast';
import { showError } from '@/lib/swal';
import { makeComboKey } from '@/lib/variantKey';
import { renameVariantValue } from '@/lib/variantValueOps';

// ---------------------------
// Helpers
// ---------------------------
function normalizeInitialAttributes(attributes = {}, categoryAttributes = []) {
  const result = {};
  for (const attr of categoryAttributes) {
    const value = attributes[attr.name];
    if (attr.type === 'select') {
      result[attr.name] = Array.isArray(value) ? value.join(', ') : (value ?? '');
    } else {
      result[attr.name] = value ?? '';
    }
  }
  return result;
}

/** Cartesian product — identical to POST/PUT backend logic */
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

function makeValueImagePanelKey(attrName, value) {
  return JSON.stringify([attrName, value]);
}

function makeSafeDomId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '-');
}

function AnimatedCollapse({ id, isOpen, children, className = '' }) {
  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          id={id}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.24, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div className={className}>{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CollapsibleSection({
  id,
  title,
  icon,
  isOpen,
  onToggle,
  children,
  className = 'bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100',
  titleClassName = 'font-bold text-gray-800',
  headerExtra = null,
  bodyClassName = '',
}) {
  const contentId = `${id}-content`;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className={`flex items-center gap-2 border-b pb-4 w-full text-right transition-colors hover:text-gray-900 ${
          isOpen ? 'mb-6' : 'mb-0'
        }`}
      >
        {icon}
        <h2 className={titleClassName}>{title}</h2>
        {headerExtra}
        <span className="mr-auto text-gray-400 transition-transform duration-200">
          {isOpen ? <FiChevronUp /> : <FiChevronDown />}
        </span>
      </button>
      <AnimatedCollapse id={contentId} isOpen={isOpen} className={bodyClassName}>
        {children}
      </AnimatedCollapse>
    </div>
  );
}
// کلید ترکیب از util مشترک ساخته می‌شود (makeComboKey) — هم‌خوان با سرور و فرمِ ساخت.

/**
 * Reconstruct variantOptions & variantDetails from an existing variants array.
 * variants[] come from GET /api/product/[id] populated.
 *
 * نکته: کلیدِ variantDetails دقیقاً با همان makeComboKey ساخته می‌شود که
 * generateCombinations استفاده می‌کند تا قیمت/تصویرِ ترکیب‌های موجود هنگام
 * ویرایش گم نشوند (رفع باگِ عدم‌تطابقِ ترتیب).
 */
function rebuildVariantState(variants = [], basePrice = null) {
  if (!variants.length) return { variantOptions: {}, variantDetails: {} };

  const variantOptions = {};
  const variantDetails = {};

  for (const v of variants) {
    const attrs = v.attributes || {};

    // Collect unique values per attribute key
    for (const [attrKey, attrVal] of Object.entries(attrs)) {
      if (!variantOptions[attrKey]) variantOptions[attrKey] = [];
      if (!variantOptions[attrKey].includes(attrVal)) {
        variantOptions[attrKey].push(attrVal);
      }
    }

    // قیمت ویژه فقط وقتی «سفارشی» است که با قیمت پایه فرق داشته باشد. واریانت‌های
    // بدون قیمت سفارشی در دیتابیس با قیمت پایه ذخیره می‌شوند؛ اگر همان مقدار را به
    // عنوان قیمت ویژه بارگذاری کنیم، (الف) فیلد قیمت بی‌جهت پر و الزامی به نظر می‌رسد
    // و (ب) آن واریانت‌ها روی قیمت پایه‌ی قدیمی «منجمد» می‌شوند. پس برابر با پایه = خالی.
    const isCustomPrice =
      v.price != null && (basePrice == null || Number(v.price) !== Number(basePrice));

    variantDetails[makeComboKey(attrs)] = {
      price: isCustomPrice ? v.price : '',
      images: v.images || [],
    };
  }

  return { variantOptions, variantDetails };
}

// ---------------------------
// Main Component
// ---------------------------
export default function ProductEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.productId;

  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [sports, setSports] = useState([]);
  const [brands, setBrands] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [limitedEditions, setLimitedEditions] = useState([]);

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
    athlete: [],   // always array
    attributes: {},
    technicalStats: {},
    customTabItems: [],
    label: 'none',
    isActive: true, // ✨ اضافه شد: مقدار اولیه وضعیت فعال بودن
  });

  // Variant state — separate for clarity
  const [variantOptions, setVariantOptions] = useState({});
  const [variantInputBuffer, setVariantInputBuffer] = useState({});
  const [variantDetails, setVariantDetails] = useState({});

  // مجموعه‌ی استثناها: ترکیب‌هایی که نباید ساخته شوند. «انتخاب‌شده» در رندر مشتق
  // می‌شود. هنگام بارگذاری، استثناها = ترکیب‌های کارتزینی که هم‌اکنون واریانت ندارند
  // (پشتیبانی از زیرمجموعه‌ی انتخابیِ ذخیره‌شده). ترکیب‌های تازه خودبه‌خود انتخاب‌اند.
  const [deselectedCombos, setDeselectedCombos] = useState(() => new Set());

  // متادیتای سطحِ مقدار: تصاویرِ مشترکِ هر مقدار { [attr]: { [value]: { images: [] } } }
  const [variantMeta, setVariantMeta] = useState({});

  const [openSections, setOpenSections] = useState({});
  const [expandedValueImagePanels, setExpandedValueImagePanels] = useState({});

  const isSectionOpen = (sectionKey) => Boolean(openSections[sectionKey]);
  const toggleSection = (sectionKey) => {
    setOpenSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };
  // ترکیب‌هایی که ادمین «قیمت ویژه» را برایشان باز کرده. قیمت اختیاری است؛ خالی
  // بودنش یعنی قیمت پایه‌ی محصول اعمال می‌شود (هیچ‌جا الزامی نیست).
  const [expandedPrices, setExpandedPrices] = useState(() => new Set());

  // ---------------------------
  // Fetch all data on mount
  // ---------------------------
  useEffect(() => {
    if (!id) return;

    async function fetchData() {
      try {
        const [sportsRes, brandsRes, categoriesRes, limitedEditionsRes, productRes] = await Promise.all([
          fetch('/api/sports'),
          fetch('/api/brands'),
          fetch('/api/categories'),
          fetch('/api/limited-editions'),
          fetch(`/api/product/${id}`),
        ]);

        const [sportsData, brandsData, categoriesData, limitedEditionsData, productData] = await Promise.all([
          sportsRes.json(),
          brandsRes.json(),
          categoriesRes.json(),
          limitedEditionsRes.json(),
          productRes.json(),
        ]);

        setSports(sportsData.sports || []);
        setBrands(brandsData.brands || []);
        setCategories(categoriesData.categories || []);
        setLimitedEditions(limitedEditionsData.limitedEditions || []);

        if (productData.product) {
          const p = productData.product;

          // Normalize athlete to always be an array of IDs
          let athleteIds = [];
          if (Array.isArray(p.athlete)) {
            athleteIds = p.athlete.map(a => (typeof a === 'object' ? a._id : a));
          } else if (p.athlete) {
            athleteIds = [typeof p.athlete === 'object' ? p.athlete._id : p.athlete];
          }
          const matchedCategory =
            categoriesData.categories?.find(
              c => c._id === (p.category?._id || p.category)
            );
          const customTabItemTitles = (p.customTabItems || [])
            .map((itemId) =>
              matchedCategory?.customTab?.items?.find(
                (it) => String(it._id) === String(itemId)
              )?.title
            )
            .filter(Boolean);

          setFormData({
            name: p.name || '',
            shortDescription: p.shortDescription || '',
            longDescription: p.longDescription || '',
            color: p.color || '',
            basePrice: p.basePrice ?? '',
            category: p.category?._id || p.category || '',
            tag: Array.isArray(p.tag)
              ? p.tag.join(', ')
              : (p.tag || ''),
            mainImage: p.mainImage || '',
            gallery: p.gallery || [],
            brand: p.brand?._id || p.brand || '',
            serie: p.serie?._id || p.serie || '',
            limitedEdition: p.limitedEdition?._id || p.limitedEdition || '',
            sport: p.sport?._id || p.sport || '',
            athlete: athleteIds,

            attributes: normalizeInitialAttributes(
              p.attributes || {},
              matchedCategory?.attributes || []
            ),

            technicalStats: p.technicalStats || {},
            customTabItems: customTabItemTitles,

            label: p.label || 'none',
            isActive: p.isActive ?? true, // ✨ اضافه شد: دریافت وضعیت فعلی محصول از دیتابیس
          });

          // Rebuild variant state from populated variants array (قیمتِ برابر با
          // پایه به‌عنوان «بدون قیمت ویژه» بارگذاری می‌شود)
          const { variantOptions: vOpts, variantDetails: vDetails } =
            rebuildVariantState(p.variants || [], p.basePrice);
          setVariantOptions(vOpts);
          setVariantDetails(vDetails);

          // استثناها = ترکیب‌های کارتزینی که هم‌اکنون واریانت ندارند
          const existingKeys = new Set(Object.keys(vDetails));
          setDeselectedCombos(
            new Set(
              generateCombinations(vOpts)
                .map(makeComboKey)
                .filter((k) => !existingKeys.has(k))
            )
          );

          // متادیتای سطحِ مقدار (تصاویرِ مشترکِ هر مقدار)
          setVariantMeta(p.variantMeta || {});
        }
      } catch (err) {
        showError('خطا', 'عدم موفقیت در بارگذاری اطلاعات');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  // Fetch athletes when sport changes
  useEffect(() => {
    if (formData.sport) fetchAthletes(formData.sport);
    else setAthletes([]);
  }, [formData.sport]);

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
  const categoryCustomTab = selectedCategory?.customTab;

  // ---------------------------
  // Variant combinations (memoized)
  // ---------------------------
  const combinations = useMemo(() => generateCombinations(variantOptions), [variantOptions]);

  // Sync variantDetails when combinations change (add new keys, keep existing)
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
    setDeselectedCombos(prev => {
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

  const getValueImages = (attrName, value) =>
    (variantMeta[attrName]?.[value]?.images || []).filter(Boolean);

  const isValueImagePanelOpen = (attrName, value) => {
    const panelKey = makeValueImagePanelKey(attrName, value);
    return expandedValueImagePanels[panelKey] ?? getValueImages(attrName, value).length > 0;
  };

  const toggleValueImagePanel = (attrName, value) => {
    const panelKey = makeValueImagePanelKey(attrName, value);
    setExpandedValueImagePanels((prev) => ({
      ...prev,
      [panelKey]: !(prev[panelKey] ?? getValueImages(attrName, value).length > 0),
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

  // تعداد ترکیب‌های انتخاب‌شده (مشتق در رندر)
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

  function toggleAthlete(athleteId) {
    setFormData(prev => {
      const current = Array.isArray(prev.athlete) ? prev.athlete : [];
      const exists = current.includes(athleteId);
      return {
        ...prev,
        athlete: exists
          ? current.filter(aid => aid !== athleteId)
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

  // جابه‌جایی (drag & drop) — فقط ترتیبِ آرایه‌ی مقادیر عوض می‌شود؛ کلیدهای ترکیب
  // (makeComboKey) به مقدار وابسته‌اند نه ترتیب، پس قیمت/تصویر/انتخابِ ترکیب‌ها دست‌نخورده می‌ماند.
  function reorderVariantValue(attrName, newValues) {
    setVariantOptions(prev => ({ ...prev, [attrName]: newValues }));
  }

  // ویرایشِ نامِ یک مقدار — استیت‌های وابسته یک‌جا و هماهنگ مهاجرت می‌کنند.
  function handleRenameVariantValue(attrName, oldVal, newVal, newUnits) {
    const res = renameVariantValue({
      attrName, oldVal, newVal, newUnits,
      variantOptions, variantMeta, variantDetails,
      deselectedCombos, expandedPrices,
    });
    setVariantOptions(res.variantOptions);
    setVariantMeta(res.variantMeta);
    setVariantDetails(res.variantDetails);
    setDeselectedCombos(res.deselectedCombos);
    setExpandedPrices(res.expandedPrices);
  }

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
  // Submit (PUT)
  // ---------------------------
  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitLoading(true);

    try {
      // Normalize category attributes
      const normalizedAttributes = {};
      for (const attr of categoryAttributes) {
        const rawValue = formData.attributes?.[attr.name];
        if (rawValue === undefined || rawValue === null || rawValue === '') continue;

        if (attr.type === 'select') {
          normalizedAttributes[attr.name] = String(rawValue)
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

      // Normalize variant details
      const normalizedVariantDetails = {};
      for (const [key, detail] of Object.entries(variantDetails)) {
        normalizedVariantDetails[key] = {
          price: Number(detail.price) || 0,
          images: detail.images || [],
        };
      }

      // Normalize tags
      const normalizedTag =
        typeof formData.tag === 'string'
          ? formData.tag.split(',').map(t => t.trim()).filter(Boolean)
          : formData.tag;

      const payload = {
        name: formData.name,
        shortDescription: formData.shortDescription,
        longDescription: formData.longDescription,
        color: formData.color,
        basePrice: Number(formData.basePrice) || 0,
        category: formData.category,
        tag: normalizedTag,
        mainImage: formData.mainImage,
        gallery: formData.gallery,
        brand: formData.brand,
        serie: formData.serie,
        limitedEdition: formData.limitedEdition,
        sport: formData.sport,
        athlete: Array.isArray(formData.athlete) ? formData.athlete : [],
        attributes: normalizedAttributes,
        technicalStats: normalizedStats,
        customTabItems: formData.customTabItems || [],
        label: formData.label,
        isActive: formData.isActive, // ✨ اضافه شد: ارسال وضعیت محصول در ریکوئست آپدیت
        // Always send variantOptions so backend can sync
        variantOptions,
        variantDetails: normalizedVariantDetails,
        // فقط ترکیب‌های انتخاب‌شده (غیرِ استثناشده) ساخته می‌شوند
        selectedCombos: combinations
          .map(makeComboKey)
          .filter((k) => !deselectedCombos.has(k)),
        // تصاویرِ سطحِ مقدار (مشترک بین واریانت‌ها)
        variantMeta: buildCleanVariantMeta(),
      };

      const res = await fetch(`/api/product/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast.success('تغییرات با موفقیت ذخیره شد');
      router.push(
        `/p-admin/admin-categories/category-products/${selectedCategory?._id || formData.category}`
      );
      router.refresh();
    } catch (err) {
      showError('خطا', err.message || 'خطا در ویرایش محصول');
    } finally {
      setSubmitLoading(false);
    }
  }

  // ---------------------------
  // Loading state
  // ---------------------------
  if (loading) {
    return <AdminLoader />;
  }

  // ---------------------------
  // Render
  // ---------------------------
  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-8 pb-20">

      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="bg-blue-50 p-4 rounded-2xl text-blue-600">
            <FaEdit size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">ویرایش محصول</h1>
            <p className="text-gray-400 text-xs mt-1">شناسه: {id}</p>
          </div>
        </div>
        <Button type="submit" loading={submitLoading} className="px-10 rounded-2xl">
          ذخیره تغییرات
        </Button>
      </div>

      {/* General Info */}
      <CollapsibleSection
        id="basic-info"
        title="اطلاعات پایه"
        icon={<FaBox className="text-gray-400" />}
        isOpen={isSectionOpen('basicInfo')}
        onToggle={() => toggleSection('basicInfo')}
        bodyClassName="space-y-6"
      >
        <Input
          label="نام محصول"
          value={formData.name}
          onChange={e => updateField('name', e.target.value)}
        />
        <Textarea
          label="توضیح کوتاه"
          rows={3}
          value={formData.shortDescription}
          onChange={e => updateField('shortDescription', e.target.value)}
        />
        <Textarea
          label="توضیح کامل"
          rows={5}
          value={formData.longDescription}
          onChange={e => updateField('longDescription', e.target.value)}
        />
      </CollapsibleSection>

      {/* Color Picker */}
      <CollapsibleSection
        id="product-color"
        title="رنگ محصول"
        icon={<FaPalette className="text-gray-400" />}
        isOpen={isSectionOpen('color')}
        onToggle={() => toggleSection('color')}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <input
            type="color"
            value={formData.color || '#000000'}
            onChange={e => updateField('color', e.target.value)}
            className="w-12 h-10 rounded cursor-pointer border border-gray-300 p-0.5"
            title="انتخاب رنگ"
          />
          <div className="w-40">
            <Input
              placeholder="#000000"
              value={formData.color || ''}
              onChange={e => updateField('color', e.target.value)}
            />
          </div>
          {formData.color && (
            <>
              <span
                className="inline-block w-10 h-10 rounded-full border-2 border-gray-300 shadow-sm"
                style={{ backgroundColor: formData.color }}
                title={formData.color}
              />
              <span className="text-sm text-gray-500">{formData.color}</span>
            </>
          )}
        </div>
      </CollapsibleSection>

      {/* Relations & Pricing */}
      <CollapsibleSection
        id="relations-pricing"
        title="ارتباطات و قیمت"
        icon={<FaCogs className="text-gray-400" />}
        isOpen={isSectionOpen('relations')}
        onToggle={() => toggleSection('relations')}
      >
        <div className="grid md:grid-cols-3 gap-6">
          <Select
            label="برند"
            value={formData.brand}
            onChange={e => {
              updateField('brand', e.target.value);
              updateField('serie', '');
              updateField('limitedEdition', '');
            }}
            options={brands.map(b => ({ value: b._id, label: b.name }))}
          />
          {formData.brand && (
            <Select
              label="سری"
              value={formData.serie}
              onChange={e => updateField('serie', e.target.value)}
              options={
                brands
                  .find(b => b._id === formData.brand)
                  ?.series?.map(s => ({ value: s._id, label: s.name })) || []
              }
            />
          )}
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
          <Select
            label="دسته‌بندی"
            value={formData.category}
            onChange={e => updateField('category', e.target.value)}
            options={categories.map(c => ({ value: c._id, label: c.title }))}
          />
          <Input
            label="قیمت پایه"
            type="number"
            formatNumber
            value={formData.basePrice}
            onChange={e => updateField('basePrice', e.target.value)}
          />
          <Select
            label="ورزش"
            value={formData.sport}
            onChange={e => updateField('sport', e.target.value)}
            options={sports.map(s => ({ value: s._id, label: s.name }))}
          />
          <Select
            label="برچسب محصول"
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
      </CollapsibleSection>

      {/* Athletes */}
      {athletes.length > 0 && (
        <CollapsibleSection
          id="athletes"
          title="ورزشکاران"
          icon={<FaRunning className="text-gray-400" />}
          isOpen={isSectionOpen('athletes')}
          onToggle={() => toggleSection('athletes')}
          headerExtra={Array.isArray(formData.athlete) && formData.athlete.length > 0 ? (
            <span className="text-xs text-[var(--color-primary)] font-medium">
              {formData.athlete.length} نفر انتخاب شده
            </span>
          ) : null}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
            {athletes.map(a => {
              const selected =
                Array.isArray(formData.athlete) && formData.athlete.includes(a._id);
              return (
                <label
                  key={a._id}
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors select-none ${selected
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
        </CollapsibleSection>
      )}

      {/* Category Attributes */}
      {categoryAttributes.length > 0 && (
        <CollapsibleSection
          id="fixed-attributes"
          title="ویژگی‌های ثابت"
          icon={<FaTags className="text-gray-400" />}
          isOpen={isSectionOpen('fixedAttributes')}
          onToggle={() => toggleSection('fixedAttributes')}
        >
          <div className="overflow-hidden border rounded-2xl">
            <table className="w-full">
              <tbody className="divide-y divide-gray-100">
                {categoryAttributes.map(attr => (
                  <tr key={attr.name}>
                    <td className="p-4 bg-gray-50/50 font-bold text-gray-600 text-sm w-1/3">
                      {attr.label}
                      {attr.required && <span className="text-red-500 mr-1">*</span>}
                    </td>
                    <td className="p-2">
                      <Input
                        type={attr.type === 'number' ? 'number' : 'text'}
                        value={formData.attributes?.[attr.name] || ''}
                        onChange={e => updateAttribute(attr.name, e.target.value)}
                        placeholder={attr.type === 'select' ? 'مقادیر با کاما جدا شوند' : ''}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {/* Variant Attributes */}
      {categoryVariantAttributes.length > 0 && (
        <CollapsibleSection
          id="variant-attributes"
          title="ویژگی‌های متغیر (واریانت‌ها)"
          icon={<FaLayerGroup className="text-gray-400" />}
          isOpen={isSectionOpen('variants')}
          onToggle={() => toggleSection('variants')}
        >
          <p className="text-xs text-gray-400 mb-6">
            برای هر ویژگی مقادیر موجود را اضافه یا حذف کنید. تصاویر در بخش «تصاویر هر مقدار» بارگذاری می‌شوند؛ تعیین قیمت برای هر ترکیب اختیاری است (خالی = قیمت پایه).
          </p>

          <div className="space-y-4 mb-8">
            {categoryVariantAttributes.map(attr => (
              <div key={attr.name} className="border rounded-2xl p-4 bg-purple-50/30">
                <label className="block font-medium text-gray-700 mb-2">
                  {attr.label}
                  {attr.prompt && (
                    <span className="text-xs text-gray-400 mr-2 font-normal">({attr.prompt})</span>
                  )}
                </label>
                {attr.multiUnit ? (
                  <div className="mb-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(attr.units || []).map((unit, ui) => (
                        <input
                          key={unit}
                          type="text"
                          dir="ltr"
                          style={{ direction: 'ltr', unicodeBidi: 'isolate' }}
                          className="border rounded-[var(--radius)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
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
                      className="px-4 py-2 bg-purple-600 text-white rounded-[var(--radius)] text-sm hover:bg-purple-700 transition-colors"
                    >
                      + افزودن مقدار
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      dir="ltr"
                      style={{ direction: 'ltr', unicodeBidi: 'isolate' }}
                      className="flex-1 border rounded-[var(--radius)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                      placeholder={`مقدار جدید برای ${attr.label}...`}
                      value={variantInputBuffer[attr.name] || ''}
                      onChange={e =>
                        setVariantInputBuffer(prev => ({ ...prev, [attr.name]: e.target.value }))
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
                      className="px-4 py-2 bg-purple-600 text-white rounded-[var(--radius)] text-sm hover:bg-purple-700 transition-colors"
                    >
                      + افزودن
                    </button>
                  </div>
                )}
                {/* Value tags — قابلِ ویرایش و جابه‌جایی (drag & drop) */}
                <VariantValuesEditor
                  attr={attr}
                  values={variantOptions[attr.name] || []}
                  variantMeta={variantMeta}
                  onReorder={reorderVariantValue}
                  onRename={handleRenameVariantValue}
                  onRemove={removeVariantValue}
                />
              </div>
            ))}
          </div>

          {categoryVariantAttributes.some(
            (attr) => (variantOptions[attr.name] || []).length > 0
          ) && (
            <div className="mb-8 border rounded-2xl p-4 bg-blue-50/30">
              <h4 className="font-semibold mb-1 text-blue-800">تصاویر هر مقدار</h4>
              <p className="text-xs text-gray-500 mb-4">
                تصاویری که برای هر مقدار (مثلا هر رنگ) بارگذاری می‌کنید بین همه واریانت‌هایی که آن مقدار را دارند مشترک است؛ لازم نیست برای هر سایز جدا آپلود کنید.
              </p>
              <div className="space-y-5">
                {categoryVariantAttributes.map((attr) => {
                  const values = variantOptions[attr.name] || [];
                  if (!values.length) return null;
                  return (
                    <div key={attr.name}>
                      <p className="text-sm font-bold text-gray-700 mb-2">{attr.label}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {values.map((val, valueIndex) => {
                          const valueImages = getValueImages(attr.name, val);
                          const isValueOpen = isValueImagePanelOpen(attr.name, val);
                          const contentId = `variant-value-image-${makeSafeDomId(attr.name)}-${valueIndex}`;

                          return (
                            <div key={val} className="border rounded-2xl p-3 bg-white">
                              <button
                                type="button"
                                onClick={() => toggleValueImagePanel(attr.name, val)}
                                aria-expanded={isValueOpen}
                                aria-controls={contentId}
                                className="flex w-full items-center gap-2 text-right"
                              >
                                <span className="text-xs font-semibold text-gray-600 truncate">{val}</span>
                                {valueImages.length > 0 && (
                                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                                    {valueImages.length} عکس
                                  </span>
                                )}
                                <span className="mr-auto text-gray-400">
                                  {isValueOpen ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                                </span>
                              </button>
                              <AnimatedCollapse id={contentId} isOpen={isValueOpen} className="pt-3">
                                <VariantValueImageUpload
                                  value={valueImages}
                                  onChange={(imgs) => setValueImages(attr.name, val, imgs)}
                                  folder="product/variant-values"
                                />
                              </AnimatedCollapse>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                فقط ترکیب‌هایی که تیک دارند ساخته می‌شوند؛ برداشتن تیک یک ترکیب موجود باعث حذف آن واریانت هنگام ذخیره می‌شود.
              </p>

              <div className="space-y-4">
                {combinations.map(combo => {
                  const key = makeComboKey(combo);
                  const detail = variantDetails[key] || { price: '', images: [] };
                  const isSelected = !deselectedCombos.has(key);

                  return (
                    <div
                      key={key}
                      className={`border rounded-2xl p-5 bg-white shadow-sm transition-opacity ${
                        isSelected ? 'border-purple-200' : 'border-gray-200 opacity-60'
                      }`}
                    >
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
                            <span className="text-purple-700 font-semibold">{v}</span>
                          </span>
                        ))}
                        {!isSelected && (
                          <span className="text-[11px] font-bold text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full mr-auto">
                            ساخته نمی‌شود
                          </span>
                        )}
                      </div>

                      {isPriceVisible(key, detail) ? (
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1 font-medium">
                              قیمت ویژه (یورو){' '}
                              <span className="text-gray-400 font-normal">— خالی = قیمت پایه</span>
                            </label>
                            <AdminInput
                              type="number"
                              min="0"
                              className="w-full border rounded-[var(--radius)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                              placeholder="قیمت پایه‌ی محصول"
                              value={detail.price}
                              onChange={e => updateVariantDetail(key, 'price', e.target.value)}
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
        </CollapsibleSection>
      )}

      {/* Technical Stats */}
      {categoryTechnicalStats.length > 0 && (
        <CollapsibleSection
          id="technical-stats"
          title="تحلیل فنی (نمودار رادار)"
          icon={(
            <div className="bg-orange-50 p-2 rounded-lg text-orange-500">
              <FaCogs size={20} />
            </div>
          )}
          isOpen={isSectionOpen('technicalStats')}
          onToggle={() => toggleSection('technicalStats')}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categoryTechnicalStats.map(stat => (
              <div
                key={stat.name}
                className="space-y-2 p-4 bg-gray-50 rounded-2xl border border-gray-100"
              >
                <label className="text-sm font-bold text-gray-600 flex justify-between">
                  {stat.label}
                  <span className="text-blue-600">
                    {formData.technicalStats?.[stat.name] || 0}%
                  </span>
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  className="bg-white"
                  value={formData.technicalStats?.[stat.name] || ''}
                  onChange={e => updateTechnicalStat(stat.name, e.target.value)}
                  placeholder="نمره از ۱۰۰"
                />
                {stat.prompt && (
                  <p className="text-[10px] text-gray-400 italic leading-tight">
                    {stat.prompt}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {categoryCustomTab?.enabled && categoryCustomTab.items?.length > 0 && (
        <CollapsibleSection
          id="custom-tab"
          title={categoryCustomTab.name || 'تب سفارشی'}
          icon={null}
          isOpen={isSectionOpen('customTab')}
          onToggle={() => toggleSection('customTab')}
          className="space-y-3 border-t pt-6 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100"
          titleClassName="text-sm font-bold text-neutral-700"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {categoryCustomTab.items.map((item) => {
              const checked = (formData.customTabItems || []).includes(item.title);
              return (
                <label
                  key={item._id}
                  className="flex items-center gap-2 p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        customTabItems: e.target.checked
                          ? [...(prev.customTabItems || []), item.title]
                          : (prev.customTabItems || []).filter((t) => t !== item.title),
                      }))
                    }
                  />
                  <span className="font-bold truncate">{item.title}</span>
                </label>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {/* Media & Tags */}
      <CollapsibleSection
        id="media-tags"
        title="رسانه و تگ‌ها"
        icon={<FaImages className="text-gray-400" />}
        isOpen={isSectionOpen('media')}
        onToggle={() => toggleSection('media')}
      >
        <div className="grid md:grid-cols-2 gap-8">
          <ImageUpload
            label="تصویر اصلی محصول"
            value={formData.mainImage}
            onChange={v => updateField('mainImage', v)}
            folder="product"
          />
          <ImageUpload
            label="گالری تصاویر"
            multiple
            value={formData.gallery}
            onChange={v => updateField('gallery', v)}
            folder="product"
          />
        </div>
        <div className="mt-8">
          <Input
            label="تگ‌ها (با کاما جدا کنید)"
            value={formData.tag}
            onChange={e => updateField('tag', e.target.value)}
          />
        </div>
      </CollapsibleSection>

    </form>
  );
}
