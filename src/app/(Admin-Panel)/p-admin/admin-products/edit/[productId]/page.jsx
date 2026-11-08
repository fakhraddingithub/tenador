'use client';

import { getCategoryLabel } from "base/utils/categoryLabel";
import AdminInput from "@/components/admin/AdminInput";
import styles from './ProductEdit.module.css';
import ProductSectionJsonModal from '@/components/admin/ProductSectionJsonModal';
import { BASIC_PRODUCT_FIELDS, normalizeInitialAttributes, productAttributeType } from '@/lib/productSectionJson';
import {
  REGENERATED_FIELDS,
  clearRegenerationDraft,
  draftToFormPatch,
  loadRegenerationDraft,
  pickRegeneratedFields,
} from '@/lib/productRegeneration';
import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { FaEdit, FaBox, FaImages, FaTags, FaCogs, FaRunning, FaLayerGroup, FaMagic, FaLock } from 'react-icons/fa';
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
import { getApiErrorMessage } from '@/lib/apiClientError';
import { makeComboKey } from '@/lib/variantKey';
import { validateProductVariants } from '@/lib/productVariantValidation';
import { renameVariantValue } from '@/lib/variantValueOps';
import { invalidateAdminCache } from '@/lib/adminCache';
import {
  TARGET_AUDIENCE_SELECT_OPTIONS,
  filterAttributesByAudience,
  normalizeTargetAudience,
} from 'base/utils/targetAudience';

// ---------------------------
// Helpers
// ---------------------------
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
  className = 'rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-card)]',
  titleClassName = 'text-sm font-bold text-[var(--admin-text)]',
  headerExtra = null,
  onEditJson,
  bodyClassName = '',
}) {
  const contentId = `${id}-content`;

  return (
    <div className={className}>
      <div className={`flex flex-wrap items-center gap-2 px-4 py-2 sm:px-5 ${isOpen ? 'border-b border-[var(--admin-border)]' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-[var(--admin-radius)] text-right transition-colors hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
      >
        {icon && <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-bg)]" aria-hidden="true">{icon}</span>}
        <h2 className={titleClassName}>{title}</h2>
        {headerExtra}
      </button>
      {onEditJson && (
        <button type="button" onClick={onEditJson}
          className="min-h-11 rounded-[var(--admin-radius)] border border-transparent px-3 py-2 text-sm font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">
          ویرایش جیسون
        </button>
      )}
      <button type="button" onClick={onToggle} aria-expanded={isOpen} aria-controls={contentId}
        aria-label={`${isOpen ? 'بستن' : 'باز کردن'} بخش ${title}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[var(--admin-text-muted)] transition-colors hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">
        {isOpen ? <FiChevronUp aria-hidden="true" /> : <FiChevronDown aria-hidden="true" />}
      </button>
      </div>
      <AnimatedCollapse id={contentId} isOpen={isOpen} className={`${styles.fields} p-4 sm:p-5 ${bodyClassName}`}>
        {children}
      </AnimatedCollapse>
    </div>
  );
}
// کلید ترکیب از util مشترک ساخته می‌شود (makeComboKey) — هم‌خوان با سرور و فرمِ ساخت.

// وقتی سرور خطای فیلدی برمی‌گرداند همهٔ بخش‌ها باز می‌شوند؛ وگرنه پیام به فیلدی
// اشاره می‌کند که داخلِ یک بخشِ جمع‌شده پنهان است.
const ALL_SECTIONS_OPEN = Object.fromEntries(
  ['basicInfo', 'relations', 'athletes', 'fixedAttributes', 'variants',
    'technicalStats', 'customTab', 'media'].map((key) => [key, true]),
);

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

  // خطاهای فیلدیِ سرور — پیش‌تر فقط در یک مودالِ خلاصه دیده می‌شدند و در فرمی
  // با بخش‌های جمع‌شونده، ادمین نمی‌دانست کدام بخش را باید باز کند.
  const [fieldErrors, setFieldErrors] = useState({});
  const [jsonSection, setJsonSection] = useState(null);

  // حالتِ بازتولید (?regenerate=1): JSONِ تأییدشده در صفحه‌ی بازتولید روی فرم
  // نشسته است. { applied, warnings, source, updatedAt } — updatedAt نسخه‌ای است که
  // فرم رویش ساخته شد و ذخیره فقط روی همان نسخه انجام می‌شود (۴۰۹ در غیر این صورت).
  const [regen, setRegen] = useState(null);

  // تعدادِ واریانتِ محصول هنگام بارگذاری — «هیچ واریانتی» فقط برای محصولی
  // مجاز است که از قبل هم واریانت نداشته (سرور همین قاعده را دارد).
  const [loadedVariantCount, setLoadedVariantCount] = useState(0);

  // شمارنده‌ی آپلودهای در جریان — ثبت وسطِ آپلود، تصویر را جا می‌انداخت
  const [uploadsInFlight, setUploadsInFlight] = useState(0);
  const trackUpload = (busy) =>
    setUploadsInFlight((count) => Math.max(0, count + (busy ? 1 : -1)));

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
    targetAudience: '',
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
        // useSearchParams نه: خواندنِ مستقیم، فقط یک بار و فقط در مرورگر
        const regenerating = new URLSearchParams(window.location.search).has('regenerate');
        const regenDraft = regenerating ? loadRegenerationDraft(id) : null;
        if (regenerating && !regenDraft) {
          showError('پیش‌نویسِ بازتولید پیدا نشد', 'ممکن است در تبِ دیگری باز شده یا قبلاً ذخیره شده باشد؛ فرم با اطلاعاتِ فعلیِ محصول باز شد.');
        }

        const [sportsRes, brandsRes, categoriesRes, limitedEditionsRes, productRes, athletesRes] = await Promise.all([
          fetch('/api/sports'),
          fetch('/api/brands'),
          fetch('/api/categories'),
          fetch('/api/limited-editions'),
          fetch(`/api/product/${id}`),
          // ورزشکارانِ پیش‌نویس فقط وقتی در فرم می‌نشینند که در فهرستِ همین ورزش باشند
          regenDraft ? fetch('/api/athletes') : null,
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

          const loaded = {
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
            targetAudience: normalizeTargetAudience(p.targetAudience) || '',
            isActive: p.isActive ?? true, // ✨ اضافه شد: دریافت وضعیت فعلی محصول از دیتابیس
          };

          if (regenDraft) {
            // همان نگاشتی که بارگذاریِ عادی دارد (normalizeInitialAttributes و ...)، فقط
            // روی کلیدهایی که JSON آورده. ورزشکاران از همان ورزشِ فرم (فیلترِ fetchAthletes).
            const allAthletes = (await athletesRes?.json().catch(() => ({})))?.athletes || [];
            const { patch, applied, warnings } = draftToFormPatch(regenDraft.draft, {
              form: loaded,
              category: matchedCategory,
              brands: brandsData.brands || [],
              limitedEditions: limitedEditionsData.limitedEditions || [],
              athletes: allAthletes.filter((a) => (a.sport?._id || a.sport) === loaded.sport),
            });
            setFormData({ ...loaded, ...patch });
            setRegen({ applied, warnings, source: regenDraft.source, updatedAt: p.updatedAt });
            // همه‌ی بخش‌ها باز تا مقادیرِ تازه دیده شوند
            setOpenSections(ALL_SECTIONS_OPEN);
          } else {
            setFormData(loaded);
          }

          // Rebuild variant state from populated variants array (قیمتِ برابر با
          // پایه به‌عنوان «بدون قیمت ویژه» بارگذاری می‌شود)
          const { variantOptions: vOpts, variantDetails: vDetails } =
            rebuildVariantState(p.variants || [], p.basePrice);
          setLoadedVariantCount((p.variants || []).length);
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
  // فقط ویژگی‌هایی که دسته برای مخاطبِ هدفِ این محصول مجازشان کرده نمایش داده می‌شوند.
  // حلقه‌ی ساختِ payload عمداً روی categoryAttributes کامل می‌ماند: مقدارِ ویژگیِ
  // پنهان در استیت باقی است و دوباره فرستاده می‌شود، پس تغییرِ مخاطب هدف (یا قاعده‌ی
  // دسته) هیچ داده‌ای را بی‌صدا پاک نمی‌کند.
  const visibleCategoryAttributes = filterAttributesByAudience(
    categoryAttributes,
    formData.targetAudience,
  );
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

  // یک لیمیتد ادیشن فقط زیرِ برندِ مالکِ خودش انتخاب‌شدنی است (سرور هم همین را
  // اعتبارسنجی می‌کند). هر مقدارِ خارج از این فهرست کهنه است و به "" می‌افتد.
  const limitedEditionOptions = limitedEditions
    .filter(c => (c.brand?._id || c.brand) === formData.brand)
    .map(c => ({ value: c._id, label: getCategoryLabel(c) }));
  const selectedLimitedEdition = limitedEditionOptions.some(
    o => o.value === formData.limitedEdition
  )
    ? formData.limitedEdition
    : '';

  // ---------------------------
  // Submit (PUT)
  // ---------------------------
  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitLoading(true);
    setFieldErrors({});

    try {
      // بدونِ دسته‌بندیِ حل‌شده، categoryAttributes خالی است و normalizedAttributes
      // خالی ساخته می‌شود — یعنی ذخیره‌کردن، همهٔ ویژگی‌های محصول و آیتم‌های تبِ
      // اختصاصی را بی‌صدا پاک می‌کرد. این حالت واقعی است: دستهٔ حذف‌شده، یا
      // شکستِ واکشیِ /api/categories.
      if (!selectedCategory) {
        throw new Error(
          'دسته‌بندی این محصول پیدا نشد؛ تا وقتی دسته‌بندیِ معتبر انتخاب نشود امکان ذخیره نیست',
        );
      }

      // همان اعتبارسنجی‌ای که سرور اجرا می‌کند — تا خطا پیش از رفت‌وبرگشت دیده شود.
      // در بازتولید واریانت‌ها فرستاده نمی‌شوند، پس چیزی برای بررسی نیست.
      const variantValidation = regen ? {} : validateProductVariants(
        categoryVariantAttributes,
        variantOptions,
        combinations.map(makeComboKey).filter((key) => !deselectedCombos.has(key)),
        { allowEmpty: loadedVariantCount === 0 },
      );
      if (variantValidation.error) {
        setFieldErrors(variantValidation.fieldErrors || {});
        throw new Error(variantValidation.error);
      }

      // Normalize category attributes
      const normalizedAttributes = {};
      for (const attr of categoryAttributes) {
        const rawValue = formData.attributes?.[attr.name];
        if (rawValue === undefined || rawValue === null || rawValue === '') continue;

        if (productAttributeType(attr) === 'select') {
          normalizedAttributes[attr.name] = String(rawValue)
            .split(',')
            .map(v => v.trim())
            .filter(Boolean);
        } else if (productAttributeType(attr) === 'number') {
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
        limitedEdition: selectedLimitedEdition,
        sport: formData.sport,
        athlete: Array.isArray(formData.athlete) ? formData.athlete : [],
        attributes: normalizedAttributes,
        technicalStats: normalizedStats,
        customTabItems: formData.customTabItems || [],
        label: formData.label,
        targetAudience: formData.targetAudience,
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

      // بازتولید: همان مقادیرِ فرم، ولی فقط فیلدهای بازتولیدی و از مسیرِ بازتولید —
      // که تصاویر/واریانت‌ها را در سطحِ داده قفل می‌کند، فیلدهای الزامی را با قواعدِ
      // ساختِ محصول می‌سنجد و روی نسخه‌ی تغییرکرده ۴۰۹ می‌دهد.
      const res = regen
        ? await fetch(`/api/product/${id}/regenerate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            json: JSON.stringify(pickRegeneratedFields(payload)),
            expectedUpdatedAt: regen.updatedAt,
          }),
        })
        : await fetch(`/api/product/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFieldErrors(data?.fieldErrors || {});
        // بخش‌های جمع‌شده باز می‌شوند تا فیلدِ خطادار واقعاً دیده شود
        if (data?.fieldErrors) setOpenSections((prev) => ({ ...prev, ...ALL_SECTIONS_OPEN }));
        throw new Error(getApiErrorMessage(data, regen ? 'خطا در اعمالِ بازتولید' : 'خطا در ویرایش محصول'));
      }

      invalidateAdminCache('/api/product');
      if (regen) clearRegenerationDraft(id);

      showToast.success(regen ? 'بازتولید اعمال شد؛ تصاویر و واریانت‌ها دست‌نخورده ماندند' : 'تغییرات با موفقیت ذخیره شد');
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

  function discardRegeneration() {
    clearRegenerationDraft(id);
    // بارگذاریِ کامل: فرم دوباره از اطلاعاتِ ذخیره‌شده‌ی محصول ساخته می‌شود
    window.location.assign(`/p-admin/admin-products/edit/${id}`);
  }

  const lockedNote = (text) => (
    <div className="flex items-start gap-2 rounded-[var(--admin-radius)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <FaLock className="mt-1 shrink-0" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );

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
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-5xl space-y-4 pb-12" dir="rtl">
      {jsonSection && (
        <ProductSectionJsonModal
          section={jsonSection}
          form={formData}
          category={selectedCategory}
          onClose={() => setJsonSection(null)}
          onApply={(patch) => {
            setFormData(prev => ({ ...prev, ...patch }));
            const keys = jsonSection === 'basicInfo' ? Object.keys(BASIC_PRODUCT_FIELDS)
              : jsonSection === 'fixedAttributes' ? visibleCategoryAttributes.map(attr => attr.name)
              : categoryTechnicalStats.map(stat => stat.name);
            setFieldErrors(prev => Object.fromEntries(Object.entries(prev).filter(([key]) => !keys.includes(key))));
            setOpenSections(prev => ({ ...prev, [jsonSection]: true }));
            setJsonSection(null);
            showToast.success('تغییرات جیسون روی فرم اعمال شد؛ برای ثبت نهایی محصول را ذخیره کنید');
          }}
        />
      )}

      {/* Header */}
      <div className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-card)] px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--admin-radius)] bg-black text-[var(--color-primary)]">
            <FaEdit size={18} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-[var(--admin-text)]">{regen ? 'بازتولید محصول — بررسی و تأیید' : 'ویرایش محصول'}</h1>
            <p className="mt-1 break-all text-xs text-[var(--admin-text-muted)]">شناسه: <bdi>{id}</bdi></p>
          </div>
        </div>
      </div>

      {regen && (
        <div role="status" className="space-y-2 rounded-[var(--admin-radius)] border border-purple-200 bg-purple-50 px-4 py-4 text-sm text-purple-950 sm:px-5">
          <p className="flex items-center gap-2 font-bold">
            <FaMagic aria-hidden="true" />
            مقادیرِ تولیدشده ({regen.source === 'auto' ? 'خودکار با AI' : 'JSONِ دستی'}) در فرم قرار گرفت — هنوز چیزی ذخیره نشده است.
          </p>
          {regen.applied.length > 0 && (
            <p>پر شده از JSON: {regen.applied.map((k) => REGENERATED_FIELDS[k]).join('، ')}</p>
          )}
          <p>
            بررسی و در صورتِ نیاز اصلاح کنید؛ فیلدهای الزامی هنگامِ «تأیید و اعمال» بررسی می‌شوند. تصاویر و واریانت‌ها
            قفل‌اند و تغییر نمی‌کنند؛ دسته‌بندی، ورزش و وضعیتِ نمایش هم بخشی از بازتولید نیستند.
          </p>
          {regen.warnings.length > 0 && (
            <ul className="list-disc space-y-1 pr-5 text-amber-800">
              {regen.warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}
          <button type="button" onClick={discardRegeneration} className="text-xs font-bold text-purple-700 underline">
            انصراف از بازتولید و بازگشت به اطلاعاتِ ذخیره‌شده
          </button>
        </div>
      )}

      {/* General Info */}
      <CollapsibleSection
        id="basic-info"
        title="اطلاعات پایه"
        onEditJson={() => setJsonSection('basicInfo')}
        icon={<FaBox className="text-gray-400" />}
        isOpen={isSectionOpen('basicInfo')}
        onToggle={() => toggleSection('basicInfo')}
        bodyClassName={styles.basicInfo}
      >
        <Input
          name="product-name"
          label="نام محصول"
          error={fieldErrors.name}
          value={formData.name}
          onChange={e => updateField('name', e.target.value)}
        />
        <Textarea
          name="product-shortDescription"
          label="توضیح کوتاه"
          rows={3}
          error={fieldErrors.shortDescription}
          value={formData.shortDescription}
          onChange={e => updateField('shortDescription', e.target.value)}
        />
        <Textarea
          name="product-longDescription"
          label="توضیح کامل"
          rows={5}
          error={fieldErrors.longDescription}
          value={formData.longDescription}
          onChange={e => updateField('longDescription', e.target.value)}
        />
        <div className={styles.colorField}>
          <label htmlFor="product-color" className="mb-3 block text-sm font-bold text-[var(--admin-text)]">رنگ محصول</label>
          <div className={styles.colorControls}>
            <input
              id="product-color"
              type="color"
              value={formData.color || '#000000'}
              onChange={e => updateField('color', e.target.value)}
              className="w-12 h-10 rounded cursor-pointer border border-gray-300 p-0.5"
              title="انتخاب رنگ"
            />
            <div className="w-40 [&>div]:mb-0">
              <Input
                aria-label="کد رنگ محصول"
                dir="ltr"
                error={fieldErrors.color}
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
        <div className={styles.relationsGrid}>
          <Select
            name="product-brand"
            label="برند"
            error={fieldErrors.brand}
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
              name="product-serie"
              label="سری"
              error={fieldErrors.serie}
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
              name="product-limitedEdition"
              label="لیمیتد ادیشن (Limited Edition)"
              // محصولاتِ قدیمیِ مدلِ سراسریِ Collaboration می‌توانند ادیشنی از
              // برندِ دیگری داشته باشند. آن مقدار در گزینه‌های این برند نیست، پس
              // اگر عیناً نمایش/ارسال شود، select «بدون لیمیتد ادیشن» نشان می‌دهد
              // ولی مقدارِ کهنه submit می‌شود و سرور ۴۲۲ می‌دهد. با fallback به ""
              // آنچه دیده می‌شود همان چیزی است که ذخیره می‌شود و ذخیره‌ی محصول
              // خودش تگِ ناسازگار را پاک می‌کند.
              value={selectedLimitedEdition}
              error={fieldErrors.limitedEdition}
              onChange={e => updateField('limitedEdition', e.target.value)}
              options={[
                { value: '', label: 'بدون لیمیتد ادیشن' },
                ...limitedEditionOptions,
              ]}
            />
          )}
          <Select
            name="product-category"
            label="دسته‌بندی"
            error={fieldErrors.category}
            disabled={!!regen}
            hint={regen ? 'در بازتولید ثابت است' : undefined}
            value={formData.category}
            onChange={e => updateField('category', e.target.value)}
            options={categories.map(c => ({ value: c._id, label: getCategoryLabel(c) }))}
          />
          <Input
            name="product-basePrice"
            label="قیمت پایه"
            type="number"
            formatNumber
            error={fieldErrors.basePrice}
            value={formData.basePrice}
            onChange={e => updateField('basePrice', e.target.value)}
          />
          <Select
            name="product-sport"
            label="ورزش"
            error={fieldErrors.sport}
            disabled={!!regen}
            value={formData.sport}
            onChange={e => updateField('sport', e.target.value)}
            options={sports.map(s => ({ value: s._id, label: s.name }))}
          />
          <Select
            name="product-label"
            label="برچسب محصول"
            error={fieldErrors.label}
            value={formData.label}
            onChange={e => updateField('label', e.target.value)}
            options={[
              { value: 'none', label: 'بدون برچسب' },
              { value: 'new', label: 'جدید' },
              { value: 'hot', label: 'پرطرفدار' },
              { value: 'discount', label: 'تخفیف‌دار' },
              { value: 'limited', label: 'تعداد محدود' },
            ]}
          />
          <Select
            name="product-targetAudience"
            label="مخاطب هدف"
            error={fieldErrors.targetAudience}
            value={formData.targetAudience}
            onChange={e => updateField('targetAudience', e.target.value)}
            options={TARGET_AUDIENCE_SELECT_OPTIONS}
          />
          <Select
            name="product-isActive"
            label="وضعیت نمایش محصول"
            disabled={!!regen}
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
          <div className={styles.choiceGrid}>
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
          {fieldErrors.athlete && <p className="mt-2 text-xs font-bold text-red-500">! {fieldErrors.athlete}</p>}
        </CollapsibleSection>
      )}

      {/* Category Attributes */}
      {visibleCategoryAttributes.length > 0 && (
        <CollapsibleSection
          id="fixed-attributes"
          title="ویژگی‌های ثابت"
          onEditJson={() => setJsonSection('fixedAttributes')}
          icon={<FaTags className="text-gray-400" />}
          isOpen={isSectionOpen('fixedAttributes')}
          onToggle={() => toggleSection('fixedAttributes')}
        >
          <div className={styles.attributeGrid}>
            {visibleCategoryAttributes.map(attr => (
              <div key={attr.name} className={styles.attributeField}>
                <label htmlFor={`fixed-${attr.name}`} className={styles.fieldLabel}>
                  {attr.label}
                  {attr.required && <span className="text-red-500 mr-1">*</span>}
                </label>
                <Input
                  name={`fixed-${attr.name}`}
                  type={productAttributeType(attr) === 'number' ? 'number' : 'text'}
                  error={fieldErrors[attr.name]}
                  value={formData.attributes?.[attr.name] ?? ''}
                  onChange={e => updateAttribute(attr.name, e.target.value)}
                  placeholder={productAttributeType(attr) === 'select' ? 'مقادیر با کاما جدا شوند' : ''}
                />
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Variant Attributes — در بازتولید قفل؛ سرور هم آن‌ها را نمی‌پذیرد */}
      {regen && (categoryVariantAttributes.length > 0 || loadedVariantCount > 0) && lockedNote(
        `واریانت‌ها (${loadedVariantCount} واریانت، با قیمت، تصاویر و بارکدها) در بازتولید دست‌نخورده می‌مانند و اینجا قابلِ ویرایش نیستند.`,
      )}
      {!regen && categoryVariantAttributes.length > 0 && (
        <CollapsibleSection
          id="variant-attributes"
          title="ویژگی‌های متغیر (واریانت‌ها)"
          icon={<FaLayerGroup className="text-gray-400" />}
          isOpen={isSectionOpen('variants')}
          onToggle={() => toggleSection('variants')}
        >
          <p className={styles.sectionHint}>
            برای هر ویژگی مقادیر موجود را اضافه یا حذف کنید. تصاویر در بخش «تصاویر هر مقدار» بارگذاری می‌شوند؛ تعیین قیمت برای هر ترکیب اختیاری است (خالی = قیمت پایه).
          </p>

          <div className={styles.variantGrid}>
            {categoryVariantAttributes.map(attr => (
              <div key={attr.name} className={styles.variantCard}>
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
                          className="border rounded-[var(--radius)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
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
                      className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-[var(--radius)] text-sm hover:bg-[var(--color-primary-hover)] transition-colors"
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
                      className="min-w-0 flex-1 border rounded-[var(--radius)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
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
                      className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-[var(--radius)] text-sm hover:bg-[var(--color-primary-hover)] transition-colors"
                    >
                      + افزودن
                    </button>
                  </div>
                )}
                {fieldErrors[attr.name] && (
                  <p className="mb-2 text-xs text-red-500 font-bold">! {fieldErrors[attr.name]}</p>
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
            <div className={styles.valueMedia}>
              <h4 className="text-sm font-semibold mb-1 text-[var(--admin-text)]">تصاویر هر مقدار</h4>
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
                            <div key={val} className={styles.valueMediaCard}>
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
                                  onUploadingChange={trackUpload}
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
                    className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--admin-border-strong)] text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] transition-colors"
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

              <div className={styles.combinationGrid}>
                {combinations.map(combo => {
                  const key = makeComboKey(combo);
                  const detail = variantDetails[key] || { price: '', images: [] };
                  const isSelected = !deselectedCombos.has(key);

                  return (
                    <div
                      key={key}
                      className={styles.combinationCard}
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <label className="flex items-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCombo(key)}
                            className="w-5 h-5 rounded accent-[var(--color-primary)] shrink-0"
                          />
                          <span className="sr-only">ساخت این ترکیب</span>
                        </label>
                        {Object.entries(combo).map(([k, v]) => (
                          <span
                            key={k}
                            className="px-2 py-0.5 bg-gray-100 rounded text-sm font-medium text-gray-700"
                          >
                            {k}:{' '}
                            <span className="text-[var(--color-primary)] font-semibold">{v}</span>
                          </span>
                        ))}
                        {!isSelected && (
                          <span className="mr-auto text-xs font-medium text-[var(--admin-text-muted)]">
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
          onEditJson={() => setJsonSection('technicalStats')}
          icon={<FaCogs className="text-gray-400" />}
          isOpen={isSectionOpen('technicalStats')}
          onToggle={() => toggleSection('technicalStats')}
        >
          <div className={styles.statsGrid}>
            {categoryTechnicalStats.map(stat => (
              <div
                key={stat.name}
                className={styles.statCard}
              >
                <label className="text-sm font-bold text-gray-600 flex justify-between">
                  {stat.label}
                  <span className={styles.statValue}>
                    {formData.technicalStats?.[stat.name] || 0}%
                  </span>
                </label>
                <Input
                  aria-label={stat.label}
                  type="number"
                  min="0"
                  max="100"
                  className="bg-white"
                  error={fieldErrors[stat.name]}
                  value={formData.technicalStats?.[stat.name] ?? ''}
                  onChange={e => updateTechnicalStat(stat.name, e.target.value)}
                  placeholder="نمره از ۱۰۰"
                />
                {stat.prompt && (
                  <p className={styles.statHint}>
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
        >
          <div className={styles.choiceGrid}>
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
          {fieldErrors.customTabItems && <p className="mt-2 text-xs font-bold text-red-500">! {fieldErrors.customTabItems}</p>}
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
        {regen && lockedNote(
          `تصاویر (${(formData.mainImage ? 1 : 0) + (formData.gallery?.length || 0)} تصویر، با همان ترتیب) در بازتولید دست‌نخورده می‌مانند و اینجا قابلِ ویرایش نیستند.`,
        )}
        {!regen && <div className={styles.mediaGrid}>
          <div className={styles.mediaCard}>
            <ImageUpload
              label="تصویر اصلی محصول"
              required
              value={formData.mainImage}
              onChange={v => updateField('mainImage', v)}
              onUploadingChange={trackUpload}
              folder="product"
            />
            {fieldErrors.mainImage && (
              <p className="-mt-4 mb-4 text-xs text-red-500 font-bold">! {fieldErrors.mainImage}</p>
            )}
          </div>
          <ImageUpload
            className={styles.mediaCard}
            label="گالری تصاویر"
            multiple
            value={formData.gallery}
            onChange={v => updateField('gallery', v)}
            onUploadingChange={trackUpload}
            folder="product"
          />
        </div>}
        <div className={styles.tagsField}>
          <Input
            name="product-tag"
            label="تگ‌ها (با کاما جدا کنید)"
            error={fieldErrors.tag}
            value={formData.tag}
            onChange={e => updateField('tag', e.target.value)}
          />
        </div>
      </CollapsibleSection>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--admin-border)] pt-5">
        <Button
          type="submit"
          loading={submitLoading}
          disabled={uploadsInFlight > 0}
          className="px-10 rounded-2xl"
        >
          {uploadsInFlight > 0 ? 'در حال بارگذاری تصویر…' : regen ? 'تأیید و اعمالِ بازتولید' : 'ذخیره تغییرات'}
        </Button>
        {!regen && <Link
          href={`/p-admin/admin-products/${id}/regenerate`}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--admin-radius)] border border-purple-100 bg-purple-50 px-5 py-2.5 text-sm font-bold text-purple-600 transition-colors hover:border-purple-200 hover:bg-purple-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600"
        >
          <FaMagic size={20} aria-hidden="true" />
          بازتولید محصول
        </Link>}
        {regen && (
          <Button type="button" variant="outline" onClick={discardRegeneration} disabled={submitLoading} className="rounded-2xl">
            انصراف از بازتولید
          </Button>
        )}
      </div>
    </form>
  );
}
