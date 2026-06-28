'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiPlus,
  FiTrash2,
  FiChevronDown,
  FiChevronUp,
  FiLayers,
  FiTag,
  FiEdit3,
  FiMenu,
  FiX,
  FiUploadCloud,
  FiLoader,
  FiImage,
} from 'react-icons/fi';

// DnD Kit Imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

import AdminLayout from '@/components/admin/Layout';
import Button from '@/components/admin/Button';
import Textarea from '@/components/admin/Textarea';
import Input from '@/components/admin/Input';
import Select from '@/components/admin/Select';
import { showToast } from '@/lib/toast';
import { showError } from '@/lib/swal';

// --- Sortable Item Component ---
function SortableAttribute({ attr, onRemove, onEdit }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: attr.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.6 : 1,
  };

  const uiTypeLabel = (() => {
    const t = attr.uiType || attr.type;
    switch (t) {
      case 'text-input': return 'متن';
      case 'number-input': return 'عدد';
      case 'dropdown': return 'لیست انتخابی';
      case 'swatch': return 'سواچ';
      case 'button-toggle': return 'دکمه انتخاب';
      case 'string': return 'جدول ویژگی‌ها';
      case 'select': return 'لیست انتخابی';
      default: return '—';
    }
  })();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white border rounded-[var(--radius)] p-4 hover:shadow-md transition group ${isDragging ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)] shadow-lg' : 'border-neutral-200'}`}
    >
      <div className="flex items-center gap-4">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 p-2 bg-neutral-50 rounded"
        >
          <FiMenu size={18} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-800">{attr.label}</span>
            {attr.required && <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded border border-red-100">الزامی</span>}
            {attr.filterable && <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100">قابل فیلتر</span>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-neutral-500 font-mono">{attr.name}</span>
            <span className="text-xs text-neutral-400">•</span>
            <span className="text-xs text-neutral-500">{uiTypeLabel}</span>
            <span className="text-xs text-neutral-400">•</span>
            <span className="text-xs text-neutral-500 font-bold">Priority: {attr.order}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onEdit(attr)}
          className="flex items-center gap-1 h-9 bg-neutral-50"
        >
          <FiEdit3 size={14} />
          ویرایش
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={() => onRemove(attr.id)}
          className="flex items-center gap-1 h-9"
        >
          <FiTrash2 size={14} />
          حذف
        </Button>
      </div>
    </div>
  );
}

// --- Main Page Component ---
export default function AddCategory() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploadingField, setUploadingField] = useState(null);
  const [categories, setCategories] = useState([]);
  const [sports, setSports] = useState([]);
  // اگر دسته از صفحه‌ی یک ورزش خاص ساخته شود (?sportId=...)، ورزش قفل می‌شود
  const [lockedSportId, setLockedSportId] = useState(null);
  const [showPromptSection, setShowPromptSection] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const productFields = [
    {
      field: 'name',
      context: `- MUST strictly follow this exact pattern:
  "{Persian product type} {Persian brand name} {Exact model name from raw content}"
- Persian product type MUST be inferred from category and content (e.g. راکت تنیس)
- Persian brand name MUST be the Persian transliteration of the brand
  (e.g. Wilson → ویلسون, Nike → نایکی)
- Model name MUST be copied EXACTLY from raw content in English
- Do NOT translate, shorten, reorder, or modify the model name
- This rule overrides any other naming rule
Example:
Raw content: "Wilson Tour Slam Lite Adult Recreational Tennis Racket"
Correct name output:
"راکت تنیس ویلسون Tour Slam Lite"
      `
    },
    {
      field: 'label',
      context: `- Choose ONE value ONLY from: ["none", "new", "hot", "discount", "limited"]
- If the text mentions things like "جدید" or "۲۰۲۴/۲۰۲۵" -> "new"
- If it's a best-seller or "پرفروش" -> "hot"
- If there is a clear discount mentioned in raw text -> "discount"
- If it says "تعداد محدود" or "نسخه محدود" -> "limited"
- DEFAULT is "none" if no specific label is detected.
      `
    },
    {
      field: 'shortDescription',
      context: `- Persian
- 3 line concise sentences
- Marketing-friendly
- No emojis
      `
    },
    {
      field: 'longDescription',
      context: `- Persian
- Detailed, structured
- Explain usage, benefits, materials if possible
- SEO-friendly but natural
      `
    },
    {
      field: 'color',
      context: ` Read the provided product content carefully.
Detect and extract the product color code.
The color code may appear in formats like:
   - Color Code: 1234
   - Code: ABC-567
   - SKU variation with color identifier
   - Hex color format like #FFFFFF
 If multiple codes exist, select the one specifically related to color.
 If no color code exists, return null.`
    },
    {
      field: 'basePrice',
      context: `- Number ONLY
- If price is missing, estimate realistically based on product type
- DO NOT write strings like "نامشخص"
      `
    },
    {
      field: 'tag',
      context: `- Persian keywords
  - Array of short strings
  - Useful for search
      `
    },
  ];

  const [productPrompts, setProductPrompts] = useState(
    productFields.map((item) => ({ field: item.field, context: item.context }))
  );

  const [formData, setFormData] = useState({
    title: '',
    name: '',
    sport: '',
    parent: '',
    attributes: [],
    icon: '',
    image: '',
    // ویژگیِ انتخاب‌شده برای فیلترِ مگامنو (نامِ یکی از ویژگی‌های ثابت/متغیر) — '' = بدون فیلتر
    megaMenuFilterAttribute: '',
  });

  const [currentAttribute, setCurrentAttribute] = useState({
    name: '',
    label: '',
    required: true,
    filterable: false,
    options: '',
    prompt: '',
  });

  const [variantAttributes, setVariantAttributes] = useState([]);
  const [editingVariantId, setEditingVariantId] = useState(null);
  const [currentVariantAttr, setCurrentVariantAttr] = useState({
    name: '',
    label: '',
    uiType: 'dropdown',
    required: true,
    options: '',
    prompt: '',
    multiUnit: false,
    units: '',
  });

  const [technicalStats, setTechnicalStats] = useState([]);
  const [currentStat, setCurrentStat] = useState({ name: '', label: '', description: '' });
  const [technicalStatsPrompt, setTechnicalStatsPrompt] = useState('');
  const [editingStatId, setEditingStatId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchSports();

    // ورزشِ از پیش‌انتخاب‌شده از طریق query param (مثلاً از صفحه‌ی مدیریت ورزش).
    // از window استفاده می‌شود تا نیازی به Suspense boundaryِ useSearchParams نباشد.
    const sportIdFromQuery = new URLSearchParams(window.location.search).get('sportId');
    if (sportIdFromQuery) {
      setLockedSportId(sportIdFromQuery);
      setFormData((prev) => ({ ...prev, sport: sportIdFromQuery }));
    }
  }, []);

  // دسته‌های والد فقط از همان ورزشِ انتخاب‌شده انتخاب می‌شوند
  useEffect(() => {
    fetchCategories(formData.sport);
  }, [formData.sport]);

  const fetchCategories = async (sportId) => {
    try {
      const url = sportId
        ? `/api/categories?sportId=${sportId}`
        : '/api/categories';
      const res = await fetch(url);
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchSports = async () => {
    try {
      const res = await fetch('/api/sports');
      const data = await res.json();
      setSports(data.sports || []);
    } catch (error) {
      console.error('Error fetching sports:', error);
    }
  };

  // ---------- Upload Handler ----------
  const uploadFile = async (file, field) => {
    if (!file) return;
    setUploadingField(field);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'categories');

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'خطا در آپلود');
      setFormData((prev) => ({ ...prev, [field]: data.url }));
      showToast.success(`${field === 'icon' ? 'آیکون' : 'تصویر'} با موفقیت آپلود شد`);
    } catch (err) {
      showError('خطا', err.message);
    } finally {
      setUploadingField(null);
    }
  };

  // ---------- Technical Stats handlers ----------
  const handleAddOrUpdateStat = () => {
    if (!currentStat.name || !currentStat.label) {
      showToast.warning('نام و برچسب شاخص فنی الزامی است');
      return;
    }

    if (editingStatId) {
      setTechnicalStats(prev => prev.map(s =>
        s.id === editingStatId ? { ...currentStat, id: editingStatId } : s
      ));
      setEditingStatId(null);
      showToast.success('شاخص فنی بروزرسانی شد');
    } else {
      const newStat = {
        ...currentStat,
        id: `stat-${Math.random().toString(36).substr(2, 9)}`
      };
      setTechnicalStats(prev => [...prev, newStat]);
      showToast.success('شاخص فنی جدید اضافه شد');
    }

    setCurrentStat({ name: '', label: '', description: '' });
  };

  const handleEditStat = (stat) => {
    setEditingStatId(stat.id);
    setCurrentStat({
      name: stat.name,
      label: stat.label,
      description: stat.description || ''
    });
    document.getElementById('stat-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
  };

  const removeStat = (id) => {
    setTechnicalStats(prev => prev.filter(s => s.id !== id));
  };

  // ---------- Parent handling ----------
  const copyParentFileds = (parentId) => {
    if (!parentId) {
      setFormData(prev => ({ ...prev, parent: '' }));
      return;
    }

    const selectedParent = categories.find(cat => cat._id === parentId);

    if (selectedParent) {
      const inheritedAttributes = (selectedParent.attributes || []).map(attr => ({
        ...attr,
        id: `attr-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`,
      }));

      if (selectedParent.prompts && selectedParent.prompts.length > 0) {
        const newPrompts = productPrompts.map(p => {
          const parentContext = selectedParent.prompts.find(pp => pp.field === p.field);
          return parentContext ? { ...p, context: parentContext.context } : p;
        });
        setProductPrompts(newPrompts);
      }

      setFormData(prev => ({
        ...prev,
        attributes: inheritedAttributes
      }));

      showToast.success(`اطلاعات از دسته "${selectedParent.title}" کپی شد`);
    }
  };

  const normalizeOrders = (attrs) => {
    return attrs.map((attr, index) => ({
      ...attr,
      order: index + 1,
    }));
  };

  // ---------- Global attributes handlers ----------
  const handleAddOrUpdateAttribute = () => {
    if (!currentAttribute.name || !currentAttribute.label) {
      showToast.warning('نام و برچسب ویژگی الزامی است');
      return;
    }

    const attrData = {
      name: currentAttribute.name,
      label: currentAttribute.label,
      required: currentAttribute.required,
      filterable: currentAttribute.filterable,
      options: currentAttribute.options ? currentAttribute.options.split(',').map(o => o.trim()).filter(Boolean) : [],
      prompt: currentAttribute.prompt || '',
    };

    if (editingId) {
      setFormData((prev) => ({
        ...prev,
        attributes: prev.attributes.map((attr) =>
          attr.id === editingId ? { ...attr, ...attrData } : attr
        ),
      }));
      setEditingId(null);
      showToast.success('ویژگی با موفقیت ویرایش شد');
    } else {
      const newAttribute = {
        ...attrData,
        id: `attr-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`,
        order: formData.attributes.length + 1,
      };
      setFormData((prev) => ({
        ...prev,
        attributes: [...prev.attributes, newAttribute],
      }));
      showToast.success('ویژگی جدید اضافه شد');
    }

    resetAttributeForm();
  };

  const resetAttributeForm = () => {
    setCurrentAttribute({
      name: '',
      label: '',
      required: true,
      filterable: false,
      options: '',
      prompt: '',
    });
    setEditingId(null);
  };

  const handleEditInit = (attr) => {
    setEditingId(attr.id);
    setCurrentAttribute({
      name: attr.name,
      label: attr.label,
      required: attr.required,
      filterable: attr.filterable ?? false,
      options: Array.isArray(attr.options) ? attr.options.join(', ') : '',
      prompt: attr.prompt || '',
    });
    document.getElementById('attribute-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
  };

  const removeAttribute = (id) => {
    setFormData((prev) => {
      const filtered = prev.attributes.filter((attr) => attr.id !== id);
      return {
        ...prev,
        attributes: normalizeOrders(filtered),
      };
    });
    if (editingId === id) resetAttributeForm();
  };

  // ---------- Variant attributes handlers ----------
  const handleAddOrUpdateVariant = () => {
    if (!currentVariantAttr.name || !currentVariantAttr.label) {
      showToast.warning('نام و برچسب ویژگی واریانت الزامی است');
      return;
    }

    const variantData = {
      name: currentVariantAttr.name,
      label: currentVariantAttr.label,
      uiType: currentVariantAttr.uiType,
      required: currentVariantAttr.required,
      options: currentVariantAttr.uiType === 'dropdown' ? (currentVariantAttr.options ? currentVariantAttr.options.split(',').map(o => o.trim()).filter(Boolean) : []) : [],
      prompt: currentVariantAttr.prompt || '',
      multiUnit: !!currentVariantAttr.multiUnit,
      units: currentVariantAttr.multiUnit
        ? (currentVariantAttr.units ? currentVariantAttr.units.split(',').map(u => u.trim()).filter(Boolean) : [])
        : [],
    };

    if (editingVariantId) {
      setVariantAttributes(prev => prev.map(v => v.id === editingVariantId ? { ...variantData, id: editingVariantId } : v));
      setEditingVariantId(null);
      showToast.success('ویژگی واریانت بروزرسانی شد');
    } else {
      const newVariant = {
        ...variantData,
        id: `vattr-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`,
        order: variantAttributes.length + 1,
      };
      setVariantAttributes(prev => [...prev, newVariant]);
      showToast.success('ویژگی واریانت جدید اضافه شد');
    }

    resetVariantForm();
  };

  const resetVariantForm = () => {
    setCurrentVariantAttr({
      name: '',
      label: '',
      uiType: 'text-input',
      required: true,
      options: '',
      prompt: '',
      multiUnit: false,
      units: '',
    });
    setEditingVariantId(null);
  };

  const handleEditVariant = (v) => {
    setEditingVariantId(v.id);
    setCurrentVariantAttr({
      name: v.name,
      label: v.label,
      uiType: v.uiType || 'text-input',
      required: v.required ?? true,
      options: Array.isArray(v.options) ? v.options.join(', ') : '',
      prompt: v.prompt || '',
      multiUnit: v.multiUnit ?? false,
      units: Array.isArray(v.units) ? v.units.join(', ') : '',
    });
    document.getElementById('variant-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
  };

  const removeVariant = (id) => {
    setVariantAttributes(prev => prev.filter(v => v.id !== id));
  };

  // ---------- Drag end ----------
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setFormData((prev) => {
        const oldIndex = prev.attributes.findIndex((a) => a.id === active.id);
        const newIndex = prev.attributes.findIndex((a) => a.id === over.id);
        const reordered = arrayMove(prev.attributes, oldIndex, newIndex);
        return {
          ...prev,
          attributes: normalizeOrders(reordered),
        };
      });
    }
  };

  // ---------- Submit ----------
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.sport) {
      showError('خطا', 'انتخاب ورزش برای دسته‌بندی الزامی است');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        title: formData.title,
        name: formData.name,
        sport: formData.sport,
        parent: formData.parent || null,
        icon: formData.icon,
        image: formData.image,
        attributes: formData.attributes,
        variantAttributes: variantAttributes,
        megaMenuFilterAttribute: formData.megaMenuFilterAttribute || null,
        technicalStats: technicalStats,
        technicalStatsPrompt: technicalStatsPrompt,
        prompts: productPrompts.filter((p) => p.context.trim() !== ''),
      };

      const res = await fetch('/api/categories/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        showToast.success('دسته‌بندی با موفقیت ایجاد شد');
        router.push('/p-admin/admin-categories');
      } else {
        showError('خطا', data.error || 'خطا در ایجاد دسته‌بندی');
      }
    } catch (error) {
      console.error('Error:', error);
      showError('خطا', 'خطا در ایجاد دسته‌بندی');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] font-[var(--font-sans)] text-[var(--color-text)]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="bg-white rounded-[var(--radius)] shadow-xl border border-neutral-100 transition-all duration-300 hover:shadow-2xl">
          <form onSubmit={handleSubmit} className="p-8 space-y-10">

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <FiLayers size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-bold">ایجاد دسته‌بندی جدید</h1>
                <p className="text-sm text-neutral-500">فیلدها و ساختار داده‌ای دسته‌بندی را مدیریت کنید</p>
              </div>
            </div>

            {/* Upload Section */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* تصویر اصلی */}
              <div className="bg-neutral-50 p-6 rounded-[var(--radius)] border border-neutral-200">
                <label className="flex items-center gap-2 text-sm font-bold mb-4 text-neutral-600">
                  <FiImage className="text-[var(--color-primary)]" /> تصویر اصلی دسته‌بندی
                </label>
                <div className="relative h-48 bg-white rounded-[var(--radius)] overflow-hidden border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center group transition-all hover:border-[var(--color-primary)]/50">
                  {formData.image ? (
                    <>
                      <img src={formData.image} alt="category" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <label htmlFor="cat-image" className="cursor-pointer text-white font-bold text-sm">تغییر تصویر</label>
                      </div>
                    </>
                  ) : (
                    <label htmlFor="cat-image" className="flex flex-col items-center cursor-pointer text-neutral-400 hover:text-[var(--color-primary)] transition-colors">
                      <FiUploadCloud size={40} className="mb-2" />
                      <span className="text-xs font-bold">انتخاب تصویر</span>
                    </label>
                  )}
                  <input
                    type="file"
                    id="cat-image"
                    className="hidden"
                    onChange={(e) => uploadFile(e.target.files[0], 'image')}
                    accept="image/*"
                  />
                  {uploadingField === 'image' && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                      <FiLoader className="animate-spin text-[var(--color-primary)]" size={28} />
                    </div>
                  )}
                </div>
              </div>

              {/* آیکون */}
              <div className="bg-neutral-50 p-6 rounded-[var(--radius)] border border-neutral-200 flex flex-col justify-center">
                <label className="flex items-center gap-2 text-sm font-bold mb-4 text-neutral-600">
                  <FiTag className="text-[var(--color-primary)]" /> آیکون دسته‌بندی
                </label>
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 rounded-2xl bg-white border-2 border-dashed border-neutral-200 flex items-center justify-center relative overflow-hidden">
                    {formData.icon ? (
                      <img src={formData.icon} alt="icon" className="w-full h-full object-contain p-2" />
                    ) : (
                      <FiLayers size={24} className="text-neutral-300" />
                    )}
                    {uploadingField === 'icon' && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                        <FiLoader className="animate-spin text-[var(--color-primary)]" size={18} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <label
                      htmlFor="cat-icon"
                      className="bg-white border border-neutral-200 hover:border-[var(--color-primary)] px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all inline-block"
                    >
                      آپلود آیکون
                    </label>
                    <p className="text-[10px] text-neutral-400 mt-2 italic">فرمت PNG یا SVG پیشنهاد می‌شود</p>
                    <input
                      type="file"
                      id="cat-icon"
                      className="hidden"
                      onChange={(e) => uploadFile(e.target.files[0], 'icon')}
                      accept="image/*"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* انتخاب ورزش — هنگام ساخت از صفحه‌ی یک ورزش خاص، قفل می‌شود */}
            <Select
              label="ورزش"
              name="sport"
              value={formData.sport}
              onChange={(e) => setFormData((prev) => ({ ...prev, sport: e.target.value }))}
              options={sports.map((s) => ({ value: s._id, label: s.title || s.name }))}
              placeholder="ورزش را انتخاب کنید"
              required
              disabled={!!lockedSportId}
              hint={lockedSportId ? 'این دسته به ورزشِ انتخاب‌شده تعلق دارد و قابل تغییر نیست.' : 'اسلاگ دسته فقط در محدوده‌ی همین ورزش یکتاست.'}
            />

            {/* Basic Info */}
            <div className="grid md:grid-cols-2 gap-6">
              <Input
                label="عنوان دسته‌بندی (فارسی)"
                name="title"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                required
                placeholder="مثال: راکت"
              />

              <Input
                label="نام دسته‌بندی (Slug انگلیسی)"
                name="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
                placeholder="racket"
                pattern="^[a-zA-Z0-9\s\-_]+$"
              />
            </div>

            <Select
              label="دسته والد"
              name="parent"
              value={formData.parent}
              onChange={(e) => setFormData((prev) => ({ ...prev, parent: e.target.value }))}
              options={categories.map((cat) => ({ value: cat._id, label: cat.title }))}
              placeholder="والد را انتخاب کنید"
            />

            <Select
              label="بارگذاری از دسته دیگر"
              onChange={(e) => copyParentFileds(e.target.value)}
              options={categories.map((cat) => ({ value: cat._id, label: cat.title }))}
              placeholder="دسته اصلی"
            />

            {/* AI Prompts Section */}
            <div className="border rounded-[var(--radius)] p-6 bg-neutral-50/50">
              <button
                type="button"
                onClick={() => setShowPromptSection((prev) => !prev)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-2 font-bold text-[var(--color-primary)]">
                  <FiTag />
                  تنظیمات هوش مصنوعی (AI Prompts)
                </div>
                {showPromptSection ? <FiChevronUp /> : <FiChevronDown />}
              </button>

              <div
                className={`overflow-hidden transition-all duration-500 ${showPromptSection ? 'max-h-[2000px] mt-6' : 'max-h-0'}`}
              >
                <div className="grid md:grid-cols-2 gap-5">
                  {productPrompts.map((item, index) => (
                    <Textarea
                      key={item.field}
                      label={`دستورالعمل برای فیلد ${item.field}`}
                      value={item.context}
                      onChange={(e) => {
                        const updated = [...productPrompts];
                        updated[index].context = e.target.value;
                        setProductPrompts(updated);
                      }}
                      placeholder={`توضیح دهید AI چگونه باید مقدار ${item.field} را تولید کند...`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Attributes Section */}
            <div id="attribute-form-anchor" className="border-t pt-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  ساختار ویژگی‌های اختصاصی
                  {editingId && <span className="text-xs font-normal bg-amber-100 text-amber-700 px-2 py-0.5 rounded">در حال ویرایش...</span>}
                </h3>
              </div>

              <div className={`rounded-[var(--radius)] p-6 space-y-5 transition-all duration-300 border-2 ${editingId ? 'bg-amber-50/30 border-amber-200' : 'bg-neutral-50 border-transparent'}`}>
                <div className="grid md:grid-cols-2 gap-4">
                  <Input
                    label="نام سیستمی (انگلیسی)"
                    value={currentAttribute.name}
                    onChange={(e) => setCurrentAttribute((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. size"
                  />
                  <Input
                    label="نام نمایشی (فارسی)"
                    value={currentAttribute.label}
                    onChange={(e) => setCurrentAttribute((p) => ({ ...p, label: e.target.value }))}
                    placeholder="مثال: اندازه"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex flex-col justify-center gap-3 h-full mt-8">
                    <label className="flex items-center gap-2 text-sm font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={currentAttribute.required}
                        onChange={(e) => setCurrentAttribute((p) => ({ ...p, required: e.target.checked }))}
                        className="w-5 h-5 rounded accent-[var(--color-primary)]"
                      />
                      فیلد الزامی است
                    </label>

                    <label className="flex items-center gap-2 text-sm font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={currentAttribute.filterable}
                        onChange={(e) => setCurrentAttribute((p) => ({ ...p, filterable: e.target.checked }))}
                        className="w-5 h-5 rounded accent-[var(--color-primary)]"
                      />
                      قابل فیلتر (نمایش به‌عنوان فیلتر در صفحه محصولات)
                    </label>
                  </div>

                  <Input
                    label="گزینه‌ها (فقط برای نمایش داخلی، با کاما جدا کنید)"
                    value={currentAttribute.options}
                    onChange={(e) => setCurrentAttribute((p) => ({ ...p, options: e.target.value }))}
                    placeholder="گزینه1, گزینه2 (در صورت نیاز)"
                  />
                </div>

                <Textarea
                  label="راهنمای پرامپت ویژگی"
                  value={currentAttribute.prompt}
                  onChange={(e) => setCurrentAttribute((p) => ({ ...p, prompt: e.target.value }))}
                  placeholder="راهنمای اختصاصی برای این ویژگی جهت استفاده در تولید محتوا توسط AI..."
                />

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={handleAddOrUpdateAttribute}
                    className="flex items-center gap-2"
                  >
                    {editingId ? <><FiEdit3 /> بروزرسانی ویژگی</> : <><FiPlus /> افزودن به لیست</>}
                  </Button>

                  {editingId && (
                    <Button type="button" variant="secondary" onClick={resetAttributeForm} className="flex items-center gap-2">
                      <FiX /> انصراف
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <span className="text-sm text-neutral-500 font-medium">لیست ویژگی‌ها ({formData.attributes.length})</span>
                  <span className="text-[10px] text-neutral-400">برای تغییر ترتیب، دستگیره را بکشید</span>
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                  modifiers={[restrictToVerticalAxis]}
                >
                  <div className="space-y-2">
                    <SortableContext
                      items={formData.attributes.map((a) => a.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {formData.attributes.map((attr) => (
                        <SortableAttribute
                          key={attr.id}
                          attr={attr}
                          onRemove={removeAttribute}
                          onEdit={handleEditInit}
                        />
                      ))}
                    </SortableContext>
                  </div>
                </DndContext>

                {formData.attributes.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-neutral-100 rounded-[var(--radius)] text-neutral-400 italic">
                    هیچ ویژگی اختصاصی برای این دسته تعریف نشده است.
                  </div>
                )}
              </div>
            </div>

            {/* Variant Attributes Section */}
            <div id="variant-form-anchor" className="border-t pt-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <FiTag size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">ویژگی‌های متغیر (Variant Attributes)</h3>
                  <p className="text-xs text-neutral-500">برای هر ویژگی واریانت، نوع نمایش (uiType) را انتخاب کنید.</p>
                </div>
              </div>

              <div className={`rounded-[var(--radius)] p-6 space-y-5 transition-all duration-300 border-2 ${editingVariantId ? 'bg-blue-50/30 border-blue-200' : 'bg-neutral-50 border-transparent'}`}>
                <div className="grid md:grid-cols-2 gap-4">
                  <Input
                    label="نام سیستمی (انگلیسی)"
                    value={currentVariantAttr.name}
                    onChange={(e) => setCurrentVariantAttr(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. color"
                  />
                  <Input
                    label="نام نمایشی (فارسی)"
                    value={currentVariantAttr.label}
                    onChange={(e) => setCurrentVariantAttr(p => ({ ...p, label: e.target.value }))}
                    placeholder="مثال: رنگ"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Select
                    label="نوع نمایش (uiType)"
                    value={currentVariantAttr.uiType}
                    onChange={(e) => setCurrentVariantAttr(p => ({ ...p, uiType: e.target.value }))}
                    options={[
                      { value: 'dropdown', label: 'لیست انتخابی (dropdown)' },
                      { value: 'text-input', label: 'متن (text-input)' },
                      { value: 'number-input', label: 'عدد (number-input)' },
                      { value: 'swatch', label: 'سواچ (swatch)' },
                      { value: 'button-toggle', label: 'دکمه انتخاب (button-toggle)' },
                    ]}
                  />

                  <div className="flex items-center gap-3 h-full mt-8">
                    <label className="flex items-center gap-2 text-sm font-bold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={currentVariantAttr.required}
                        onChange={(e) => setCurrentVariantAttr(p => ({ ...p, required: e.target.checked }))}
                        className="w-5 h-5 rounded accent-[var(--color-primary)]"
                      />
                      فیلد الزامی است
                    </label>
                  </div>
                </div>

                {currentVariantAttr.uiType === 'dropdown' && (
                  <Input
                    label="گزینه‌های لیست (جدا شده با کاما , )"
                    value={currentVariantAttr.options}
                    onChange={(e) => setCurrentVariantAttr((p) => ({ ...p, options: e.target.value }))}
                    placeholder="Option 1, Option 2, Option 3"
                  />
                )}

                {/* ویژگیِ چندواحدی (مثلاً سایز با EU و سانتی‌متر) */}
                <div className="space-y-3 border-t pt-4">
                  <label className="flex items-center gap-2 text-sm font-bold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!currentVariantAttr.multiUnit}
                      onChange={(e) => setCurrentVariantAttr((p) => ({ ...p, multiUnit: e.target.checked }))}
                      className="w-5 h-5 rounded accent-[var(--color-primary)]"
                    />
                    ویژگیِ چندواحدی (مقدار در چند واحد وارد می‌شود)
                  </label>
                  {currentVariantAttr.multiUnit && (
                    <Input
                      label="واحدها (با کاما جدا کنید؛ واحدِ اول مقدارِ اصلی است)"
                      value={currentVariantAttr.units}
                      onChange={(e) => setCurrentVariantAttr((p) => ({ ...p, units: e.target.value }))}
                      placeholder="EU, سانتی‌متر"
                    />
                  )}
                </div>

                <Textarea
                  label="راهنمای پرامپت (اختیاری)"
                  value={currentVariantAttr.prompt}
                  onChange={(e) => setCurrentVariantAttr((p) => ({ ...p, prompt: e.target.value }))}
                  placeholder="مثلا: توضیح برای تولید مقدار این ویژگی توسط AI..."
                />

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={handleAddOrUpdateVariant}
                    className="flex items-center gap-2"
                  >
                    {editingVariantId ? <><FiEdit3 /> بروزرسانی واریانت</> : <><FiPlus /> افزودن واریانت</>}
                  </Button>

                  {editingVariantId && (
                    <Button type="button" variant="secondary" onClick={resetVariantForm} className="flex items-center gap-2">
                      <FiX /> انصراف
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {variantAttributes.map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-3 bg-white border border-neutral-200 rounded-lg shadow-sm">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm flex items-center gap-1.5">
                        {v.label}
                        {v.multiUnit && (
                          <span className="text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded">
                            چندواحدی: {(v.units || []).join('/')}
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">{v.name} • {v.uiType}</span>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleEditVariant(v)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-md transition"><FiEdit3 size={14} /></button>
                      <button type="button" onClick={() => removeVariant(v.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-md transition"><FiTrash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mega Menu Filter Attribute */}
            <div className="border-t pt-8 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <FiMenu size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">یک ویژگی برای فیلتر مگامنو</h3>
                  <p className="text-xs text-neutral-500">
                    یک ویژگی (ثابت یا متغیر) را انتخاب کنید تا مقادیر آن به‌صورت تب‌های فیلتر در مگامنوی نوبار نمایش داده شوند.
                  </p>
                </div>
              </div>
              <Select
                label="ویژگی فیلتر مگامنو"
                value={formData.megaMenuFilterAttribute}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, megaMenuFilterAttribute: e.target.value }))
                }
                placeholder="بدون فیلتر مگامنو"
                options={[
                  ...formData.attributes.map((a) => ({ value: a.name, label: `${a.label} (ثابت)` })),
                  ...variantAttributes.map((a) => ({ value: a.name, label: `${a.label} (متغیر)` })),
                ]}
              />
            </div>

            {/* Technical Stats Section */}
            <div id="stat-form-anchor" className="border-t pt-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                  <FiEdit3 size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">شاخص‌های فنی (نمودار رادار)</h3>
                  <p className="text-xs text-neutral-500">ویژگی‌هایی که در نمودار عنکبوتی مقایسه می‌شوند (مثلاً: قدرت، کنترل)</p>
                </div>
              </div>

              <div className={`rounded-[var(--radius)] p-6 space-y-5 border-2 ${editingStatId ? 'bg-orange-50/30 border-orange-200' : 'bg-neutral-50 border-transparent'}`}>
                <div className="grid md:grid-cols-2 gap-4">
                  <Input
                    label="نام سیستمی (انگلیسی)"
                    value={currentStat.name}
                    onChange={(e) => setCurrentStat(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. power"
                  />
                  <Input
                    label="نام نمایشی (فارسی)"
                    value={currentStat.label}
                    onChange={(e) => setCurrentStat(p => ({ ...p, label: e.target.value }))}
                    placeholder="مثال: قدرت ضربه"
                  />
                </div>
                <Textarea
                  label="توضیح کوتاه شاخص (نمایش در فرانت-اند)"
                  value={currentStat.description}
                  onChange={(e) => setCurrentStat(p => ({ ...p, description: e.target.value }))}
                  placeholder="مثال: میزان نیروی انتقالی به توپ در هنگام ضربه"
                />
                <Button type="button" variant="primary" onClick={handleAddOrUpdateStat}>
                  {editingStatId ? 'بروزرسانی شاخص' : 'افزودن به نمودار'}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {technicalStats.map((stat) => (
                  <div key={stat.id} className="flex items-center justify-between p-3 bg-white border border-neutral-200 rounded-lg shadow-sm">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">{stat.label}</span>
                      <span className="text-[10px] text-neutral-400 font-mono">{stat.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleEditStat(stat)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-md transition"><FiEdit3 size={14} /></button>
                      <button type="button" onClick={() => removeStat(stat.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-md transition"><FiTrash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>

              {technicalStats.length > 0 && (
                <div className="mt-6 p-6 bg-orange-50/50 border border-orange-100 rounded-[var(--radius)] space-y-3">
                  <div className="flex items-center gap-2 text-orange-700 font-bold text-sm">
                    <FiTag size={16} />
                    راهنمای واحد هوش مصنوعی برای تحلیل شاخص‌های فنی
                  </div>
                  <Textarea
                    value={technicalStatsPrompt}
                    onChange={(e) => setTechnicalStatsPrompt(e.target.value)}
                    placeholder="به AI توضیح دهید چگونه نمرات (۰ تا ۱۰۰) تمام شاخص‌های فوق را بر اساس دیتای محصول محاسبه کند..."
                    rows={4}
                  />
                  <p className="text-[11px] text-neutral-500 italic">
                    * این پرامپت برای تمامی شاخص‌های تعریف شده در این بخش به صورت یکپارچه عمل می‌کند.
                  </p>
                </div>
              )}
            </div>

            {/* Submit Actions */}
            <div className="flex flex-col sm:flex-row gap-4 pt-8 border-t border-neutral-100">
              <Button type="submit" loading={loading} className="px-12 text-lg">
                ایجاد نهایی دسته‌بندی
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push('/p-admin/admin-categories')}
              >
                بازگشت
              </Button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}