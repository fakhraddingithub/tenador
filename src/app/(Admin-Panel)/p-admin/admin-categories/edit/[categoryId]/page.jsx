'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLoader from '@/components/admin/AdminLoader';
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
  FiSave,
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
      default: return 'متن';
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
export default function EditCategory() {
  const router = useRouter();
  const params = useParams();
  const categoryId = params.categoryId;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [uploadingField, setUploadingField] = useState(null);
  const [categories, setCategories] = useState([]);
  const [sports, setSports] = useState([]);
  const [showPromptSection, setShowPromptSection] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const productFields = [
    'name',
    'label',
    'shortDescription',
    'longDescription',
    'color',
    'basePrice',
    'tag',
  ];

  const [productPrompts, setProductPrompts] = useState(
    productFields.map((field) => ({ field, context: '' }))
  );

  const [formData, setFormData] = useState({
    title: '',
    name: '',
    sport: '',
    parent: '',
    attributes: [],
    icon: '',
    image: '',
    // ویژگیِ فیلترِ مگامنو (نامِ یکی از ویژگی‌های ثابت/متغیر) — '' = بدون فیلتر
    megaMenuFilterAttribute: '',
  });

  const [currentAttribute, setCurrentAttribute] = useState({
    name: '',
    label: '',
    required: true,
    filterable: false,
    options: '',
    prompt: '',
    description: '',
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
  const [customTabEnabled, setCustomTabEnabled] = useState(false);
  const [customTabName, setCustomTabName] = useState('');
  const [customTabIcon, setCustomTabIcon] = useState('');
  const [customTabItems, setCustomTabItems] = useState([]);
  const [currentTabItem, setCurrentTabItem] = useState({ title: '', description: '', link: '', image: '' });
  const [editingTabItemIndex, setEditingTabItemIndex] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (categoryId) {
      fetchInitialData();
    }
  }, [categoryId]);

  const fetchInitialData = async () => {
    setFetching(true);
    try {
      const [catsRes, sportsRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/sports'),
      ]);
      const catsData = await catsRes.json();
      setCategories(catsData.categories || []);
      const sportsData = await sportsRes.json();
      setSports(sportsData.sports || []);

      const res = await fetch(`/api/categories/${categoryId}`);
      const data = await res.json();

      if (res.ok && data.category) {
        const cat = data.category;

        setTechnicalStatsPrompt(cat.technicalStatsPrompt || '');

        setFormData({
          title: cat.title || '',
          name: cat.name || '',
          sport: cat.sport?._id || cat.sport || '',
          parent: cat.parent?._id || cat.parent || '',
          attributes: (cat.attributes || []).map(attr => ({
            ...attr,
            id: attr.id || attr._id || `attr-${Math.random().toString(36).substr(2, 9)}`,
            options: Array.isArray(attr.options) ? attr.options : []
          })),
          icon: cat.icon || '',
          image: cat.image || '',
          megaMenuFilterAttribute: cat.megaMenuFilterAttribute || '',
        });

        setTechnicalStats((cat.technicalStats || []).map(stat => ({
          ...stat,
          id: stat.id || stat._id || `stat-${Math.random().toString(36).substr(2, 9)}`
        })));

        setCustomTabEnabled(cat.customTab?.enabled || false);
        setCustomTabName(cat.customTab?.name || '');
        setCustomTabIcon(cat.customTab?.icon || '');
        setCustomTabItems(
          (cat.customTab?.items || []).map((item) => ({
            _id: item._id,
            title: item.title || '',
            description: item.description || '',
            link: item.link || '',
            image: item.image || '',
          }))
        );

        setVariantAttributes((cat.variantAttributes || []).map(v => ({
          ...v,
          id: v.id || v._id || `vattr-${Math.random().toString(36).substr(2, 9)}`,
          options: Array.isArray(v.options) ? v.options : []
        })));

        if (cat.prompts) {
          const updatedPrompts = productFields.map(field => {
            const found = cat.prompts.find(p => p.field === field);
            return { field, context: found ? found.context : '' };
          });
          setProductPrompts(updatedPrompts);
        }
      } else {
        showError('خطا', 'دسته‌بندی یافت نشد');
        router.push('/p-admin/admin-categories');
      }
    } catch (error) {
      console.error('Error fetching category:', error);
      showError('خطا', 'خطا در دریافت اطلاعات');
    } finally {
      setFetching(false);
    }
  };

  // ---------- Upload Handler ----------
  const uploadFile = async (file, field) => {
    if (!file) return;
    setUploadingField(field);

    const fd = new FormData();
    fd.append('file', file);
    const uploadFolder =
      field === 'customTabIcon'
        ? 'categories/customTabIcons'
        : field === 'customTabItemImage'
          ? 'categories/customTabItems'
          : 'categories';
    fd.append('folder', uploadFolder);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'خطا در آپلود');
      if (field === 'customTabIcon') {
        setCustomTabIcon(data.url);
      } else if (field === 'customTabItemImage') {
        setCurrentTabItem((prev) => ({ ...prev, image: data.url }));
      } else {
        setFormData((prev) => ({ ...prev, [field]: data.url }));
      }
      showToast.success(`${field === 'image' || field === 'customTabItemImage' ? 'تصویر' : 'آیکون'} با موفقیت آپلود شد`);
    } catch (err) {
      showError('خطا', err.message);
    } finally {
      setUploadingField(null);
    }
  };

  const handleAddOrUpdateStat = () => {
    if (!currentStat.name || !currentStat.label) {
      showToast.warning('نام و برچسب شاخص فنی الزامی است');
      return;
    }

    if (editingStatId) {
      setTechnicalStats(prev => prev.map(s => s.id === editingStatId ? { ...currentStat, id: editingStatId } : s));
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
    setCurrentStat({ name: stat.name, label: stat.label, description: stat.description || '' });
    document.getElementById('stat-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
  };

  const removeStat = (id) => {
    setTechnicalStats(prev => prev.filter(s => s.id !== id));
  };

  const handleAddOrUpdateTabItem = () => {
    if (!currentTabItem.title.trim()) return;
    if (editingTabItemIndex !== null) {
      setCustomTabItems((prev) =>
        prev.map((it, i) =>
          i === editingTabItemIndex
            ? { ...(it._id ? { _id: it._id } : {}), ...currentTabItem }
            : it
        )
      );
      setEditingTabItemIndex(null);
    } else {
      setCustomTabItems((prev) => [...prev, { ...currentTabItem }]);
    }
    setCurrentTabItem({ title: '', description: '', link: '', image: '' });
  };

  const handleEditTabItem = (index) => {
    const item = customTabItems[index];
    setCurrentTabItem({
      title: item.title || '',
      description: item.description || '',
      link: item.link || '',
      image: item.image || '',
    });
    setEditingTabItemIndex(index);
  };

  const removeTabItem = (index) => {
    setCustomTabItems((prev) => prev.filter((_, i) => i !== index));
    if (editingTabItemIndex === index) {
      setEditingTabItemIndex(null);
      setCurrentTabItem({ title: '', description: '', link: '', image: '' });
    }
  };

  const copyParentFileds = (parentId) => {
    if (!parentId) {
      setFormData(prev => ({ ...prev, parent: '' }));
      return;
    }

    const selectedParent = categories.find(cat => cat._id === parentId);

    if (selectedParent) {
      const inheritedAttributes = (selectedParent.attributes || []).map((attr, index) => ({
        ...attr,
        id: `attr-child-${Math.random().toString(36).substr(2, 5)}-${Date.now()}-${index}`,
        order: formData.attributes.length + index + 1
      }));

      if (selectedParent.prompts && selectedParent.prompts.length > 0) {
        setProductPrompts(prevPrompts => {
          return prevPrompts.map(currentPrompt => {
            const parentPrompt = selectedParent.prompts.find(p => p.field === currentPrompt.field);
            if (parentPrompt && parentPrompt.context.trim() !== '') {
              const separator = "\n\n------\n";
              if (!currentPrompt.context.includes(parentPrompt.context)) {
                return {
                  ...currentPrompt,
                  context: `${currentPrompt.context}${currentPrompt.context ? separator : ''}${parentPrompt.context}`
                };
              }
            }
            return currentPrompt;
          });
        });
      }

      setFormData(prev => ({
        ...prev,
        attributes: [...prev.attributes, ...inheritedAttributes]
      }));

      showToast.success(`اطلاعات دسته "${selectedParent.title}" به لیست فعلی اضافه شد`);
    }
  };

  const normalizeOrders = (attrs) => {
    return attrs.map((attr, index) => ({
      ...attr,
      order: index + 1,
    }));
  };

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
      description: currentAttribute.description?.trim() || '',
    };

    if (editingId) {
      setFormData((prev) => ({
        ...prev,
        attributes: prev.attributes.map((attr) =>
          attr.id === editingId ? { ...attr, ...attrData } : attr
        ),
      }));
      setEditingId(null);
      showToast.success('ویژگی بروزرسانی شد');
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
    setCurrentAttribute({ name: '', label: '', required: true, filterable: false, options: '', prompt: '', description: '' });
    setEditingId(null);
  };

  const handleEditInit = (attr) => {
    setEditingId(attr.id);
    setCurrentAttribute({
      name: attr.name,
      label: attr.label,
      required: attr.required ?? true,
      filterable: attr.filterable ?? false,
      options: Array.isArray(attr.options) ? attr.options.join(', ') : '',
      prompt: attr.prompt || '',
      description: attr.description || '',
    });
    document.getElementById('attribute-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
  };

  const removeAttribute = (id) => {
    setFormData((prev) => ({
      ...prev,
      attributes: normalizeOrders(prev.attributes.filter((attr) => attr.id !== id)),
    }));
    if (editingId === id) resetAttributeForm();
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setFormData((prev) => {
        const oldIndex = prev.attributes.findIndex((a) => a.id === active.id);
        const newIndex = prev.attributes.findIndex((a) => a.id === over.id);
        return {
          ...prev,
          attributes: normalizeOrders(arrayMove(prev.attributes, oldIndex, newIndex)),
        };
      });
    }
  };

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
        customTab: {
          enabled: customTabEnabled,
          name: customTabName,
          icon: customTabIcon,
          items: customTabItems,
        },
        prompts: productPrompts.filter((p) => p.context.trim() !== ''),
      };

      const res = await fetch(`/api/categories/${categoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        showToast.success('تغییرات با موفقیت ذخیره شد');
        router.push('/p-admin/admin-categories');
      } else {
        showError('خطا', data.error || 'خطا در ویرایش دسته‌بندی');
      }
    } catch (error) {
      showError('خطا', 'خطا در برقراری ارتباط با سرور');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <AdminLoader fullScreen />;

  return (
    <div className="min-h-screen bg-[var(--color-background)] font-[var(--font-sans)] text-[var(--color-text)] pb-20">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="bg-white rounded-[var(--radius)] shadow-xl border border-neutral-100">
          <form onSubmit={handleSubmit} className="p-8 space-y-10">

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
                <FiEdit3 size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-bold">ویرایش دسته‌بندی</h1>
                <p className="text-sm text-neutral-500">شناسه: {categoryId}</p>
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

            {/* انتخاب ورزش — اسلاگ دسته فقط در محدوده‌ی همین ورزش یکتاست */}
            <Select
              label="ورزش"
              name="sport"
              value={formData.sport}
              onChange={(e) => setFormData((prev) => ({ ...prev, sport: e.target.value }))}
              options={sports.map((s) => ({ value: s._id, label: s.title || s.name }))}
              placeholder="ورزش را انتخاب کنید"
              required
            />

            {/* Basic Info */}
            <div className="grid md:grid-cols-2 gap-6">
              <Input
                label="عنوان دسته‌بندی"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
              <Input
                label="نام (Slug)"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <Select
              label="دسته والد"
              value={formData.parent}
              onChange={(e) => setFormData((prev) => ({ ...prev, parent: e.target.value }))}
              options={categories.filter(c => c._id !== categoryId).map((cat) => ({ value: cat._id, label: cat.title }))}
              placeholder="والد را انتخاب کنید"
            />

            <Select
              label="بارگذاری از دسته دیگر"
              onChange={(e) => copyParentFileds(e.target.value)}
              options={categories.filter(c => c._id !== categoryId).map((cat) => ({ value: cat._id, label: cat.title }))}
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
                  <FiTag /> تنظیمات هوش مصنوعی
                </div>
                {showPromptSection ? <FiChevronUp /> : <FiChevronDown />}
              </button>

              <div className={`overflow-hidden transition-all duration-500 ${showPromptSection ? 'max-h-[2000px] mt-6' : 'max-h-0'}`}>
                <div className="grid md:grid-cols-2 gap-5">
                  {productPrompts.map((item, index) => (
                    <Textarea
                      key={item.field}
                      label={`دستورالعمل ${item.field}`}
                      value={item.context}
                      onChange={(e) => {
                        const updated = [...productPrompts];
                        updated[index].context = e.target.value;
                        setProductPrompts(updated);
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Attributes Section */}
            <div id="attribute-form-anchor" className="border-t pt-8 space-y-6">
              <h3 className="text-lg font-bold">مدیریت ویژگی‌ها</h3>

              <div className={`rounded-[var(--radius)] p-6 space-y-5 border-2 transition-all ${editingId ? 'bg-amber-50/30 border-amber-200' : 'bg-neutral-50 border-transparent'}`}>
                <div className="grid md:grid-cols-2 gap-4">
                  <Input label="نام انگلیسی" value={currentAttribute.name} onChange={(e) => setCurrentAttribute(p => ({ ...p, name: e.target.value }))} />
                  <Input label="برچسب فارسی" value={currentAttribute.label} onChange={(e) => setCurrentAttribute(p => ({ ...p, label: e.target.value }))} />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="mt-4 flex flex-col gap-3">
                    <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                      <input type="checkbox" checked={currentAttribute.required} onChange={(e) => setCurrentAttribute(p => ({ ...p, required: e.target.checked }))} className="w-5 h-5 accent-[var(--color-primary)]" /> الزامی
                    </label>
                    <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                      <input type="checkbox" checked={currentAttribute.filterable} onChange={(e) => setCurrentAttribute(p => ({ ...p, filterable: e.target.checked }))} className="w-5 h-5 accent-[var(--color-primary)]" /> قابل فیلتر (نمایش در صفحه محصولات)
                    </label>
                  </div>
                  <Input label="گزینه‌ها (در صورت نیاز، با کاما جدا کنید)" value={currentAttribute.options} onChange={(e) => setCurrentAttribute(p => ({ ...p, options: e.target.value }))} />
                </div>

                <Textarea label="توضیح ویژگی (اختیاری — نمایش به‌صورت تولتیپ راهنما در صفحه‌ی محصول)" value={currentAttribute.description} onChange={(e) => setCurrentAttribute(p => ({ ...p, description: e.target.value }))} placeholder="توضیح کوتاهی که کاربر با کلیک روی آیکون ؟ کنار این ویژگی در تب مشخصات فنی می‌بیند..." />

                <Textarea label="پرامپت ویژگی" value={currentAttribute.prompt} onChange={(e) => setCurrentAttribute(p => ({ ...p, prompt: e.target.value }))} />

                <div className="flex gap-3">
                  <Button type="button" onClick={handleAddOrUpdateAttribute}>{editingId ? 'بروزرسانی ویژگی' : 'افزودن به لیست'}</Button>
                  {editingId && <Button type="button" variant="secondary" onClick={resetAttributeForm}><FiX /> انصراف</Button>}
                </div>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
                <SortableContext items={formData.attributes.map(a => a.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {formData.attributes.map(attr => (
                      <SortableAttribute key={attr.id} attr={attr} onRemove={removeAttribute} onEdit={handleEditInit} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
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

                  <div className="mt-4">
                    <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                      <input type="checkbox" checked={currentVariantAttr.required} onChange={(e) => setCurrentVariantAttr(p => ({ ...p, required: e.target.checked }))} className="w-5 h-5 accent-[var(--color-primary)]" /> الزامی
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
                  <Button type="button" onClick={handleAddOrUpdateVariant} className="flex items-center gap-2">
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
                {variantAttributes.length === 0 && (
                  <div className="col-span-full text-center py-6 text-neutral-400 text-sm italic border-2 border-dashed rounded-lg">
                    هیچ ویژگی واریانتی ثبت نشده است.
                  </div>
                )}
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
                  <FiLayers size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">شاخص‌های فنی (نمودار رادار)</h3>
                  <p className="text-xs text-neutral-500">ویژگی‌های نمره‌ای برای تحلیل هوش مصنوعی و نمایش در نمودار</p>
                </div>
              </div>

              <div className={`rounded-[var(--radius)] p-6 space-y-5 border-2 transition-all ${editingStatId ? 'bg-orange-50/30 border-orange-200' : 'bg-neutral-50 border-transparent'}`}>
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
                  label="توضیح کوتاه شاخص (جهت نمایش به کاربر)"
                  value={currentStat.description}
                  onChange={(e) => setCurrentStat(p => ({ ...p, description: e.target.value }))}
                  placeholder="توضیحی که کاربر در سایت مشاهده می‌کند"
                />
                <div className="flex gap-2">
                  <Button type="button" onClick={handleAddOrUpdateStat}>
                    {editingStatId ? 'بروزرسانی شاخص' : 'افزودن شاخص جدید'}
                  </Button>
                  {editingStatId && (
                    <Button type="button" variant="secondary" onClick={() => { setEditingStatId(null); setCurrentStat({ name: '', label: '', description: '' }); }}>
                      انصراف
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {technicalStats.map((stat) => (
                  <div key={stat.id} className="flex items-center justify-between p-3 bg-white border border-neutral-200 rounded-lg shadow-sm group">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-neutral-800">{stat.label}</span>
                      <span className="text-[10px] text-neutral-400 font-mono">{stat.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => handleEditStat(stat)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-md transition"><FiEdit3 size={14} /></button>
                      <button type="button" onClick={() => removeStat(stat.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-md transition"><FiTrash2 size={14} /></button>
                    </div>
                  </div>
                ))}
                {technicalStats.length === 0 && (
                  <div className="col-span-full text-center py-6 text-neutral-400 text-sm italic border-2 border-dashed rounded-lg">
                    هیچ شاخص فنی برای این دسته ثبت نشده است.
                  </div>
                )}
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

            {/* Custom Tab Section */}
            <div className="border-t pt-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                  <FiLayers size={18} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold">تب سفارشی صفحه محصول (اختیاری)</h3>
                  <p className="text-xs text-neutral-500">
                    مثلا «تکنولوژی‌ها» برای راکت تنیس؛ فقط برای محصولاتی نمایش داده می‌شود که آیتم مرتبط دارند.
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={customTabEnabled}
                    onChange={(e) => setCustomTabEnabled(e.target.checked)}
                    className="w-5 h-5 accent-[var(--color-primary)]"
                  />
                  <span className="text-sm font-bold">فعال</span>
                </label>
              </div>

              {customTabEnabled && (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Input
                      label="نام تب (فارسی)"
                      value={customTabName}
                      onChange={(e) => setCustomTabName(e.target.value)}
                      placeholder="مثال: تکنولوژی‌ها"
                    />
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 mb-2">آیکون تب</label>
                      <div className="flex items-center gap-4 bg-neutral-50 border border-neutral-200 rounded-[var(--radius)] p-4">
                        <div className="w-16 h-16 rounded-2xl bg-white border-2 border-dashed border-neutral-200 flex items-center justify-center relative overflow-hidden">
                          {customTabIcon ? (
                            <img src={customTabIcon} alt="" className="w-full h-full object-contain p-2" />
                          ) : (
                            <FiLayers size={22} className="text-neutral-300" />
                          )}
                          {uploadingField === 'customTabIcon' && (
                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                              <FiLoader className="animate-spin text-[var(--color-primary)]" size={18} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <label
                            htmlFor="custom-tab-edit-icon"
                            className="bg-white border border-neutral-200 hover:border-[var(--color-primary)] px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all inline-block"
                          >
                            آپلود آیکون
                          </label>
                          {customTabIcon && (
                            <button
                              type="button"
                              onClick={() => setCustomTabIcon('')}
                              className="mr-2 text-xs font-bold text-red-500 hover:text-red-600"
                            >
                              حذف
                            </button>
                          )}
                          <p className="text-[10px] text-neutral-400 mt-2 italic">PNG یا SVG پیشنهاد می‌شود</p>
                          <input
                            type="file"
                            id="custom-tab-edit-icon"
                            className="hidden"
                            onChange={(e) => uploadFile(e.target.files[0], 'customTabIcon')}
                            accept="image/*"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`rounded-[var(--radius)] p-6 space-y-5 border-2 ${editingTabItemIndex !== null ? 'bg-purple-50/30 border-purple-200' : 'bg-neutral-50 border-transparent'}`}>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 mb-2">عکس آیتم (لوگو)</label>
                      <div className="flex items-center gap-4 bg-white border border-neutral-200 rounded-lg p-4">
                        <div className="w-20 h-20 rounded-lg bg-neutral-50 border-2 border-dashed border-neutral-200 flex items-center justify-center relative overflow-hidden">
                          {currentTabItem.image ? (
                            <img src={currentTabItem.image} alt="" className="w-full h-full object-contain p-2" />
                          ) : (
                            <FiImage size={24} className="text-neutral-300" />
                          )}
                          {uploadingField === 'customTabItemImage' && (
                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                              <FiLoader className="animate-spin text-[var(--color-primary)]" size={18} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <label
                            htmlFor="custom-tab-edit-item-image"
                            className="bg-white border border-neutral-200 hover:border-[var(--color-primary)] px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all inline-block"
                          >
                            آپلود عکس آیتم
                          </label>
                          {currentTabItem.image && (
                            <button
                              type="button"
                              onClick={() => setCurrentTabItem((p) => ({ ...p, image: '' }))}
                              className="mr-2 text-xs font-bold text-red-500 hover:text-red-600"
                            >
                              حذف
                            </button>
                          )}
                          <p className="text-[10px] text-neutral-400 mt-2 italic">برای لوگو یا نشان آیتم؛ PNG یا SVG پیشنهاد می‌شود</p>
                          <input
                            type="file"
                            id="custom-tab-edit-item-image"
                            className="hidden"
                            onChange={(e) => uploadFile(e.target.files[0], 'customTabItemImage')}
                            accept="image/*"
                          />
                        </div>
                      </div>
                    </div>
                    <Input
                      label="عنوان آیتم"
                      value={currentTabItem.title}
                      onChange={(e) => setCurrentTabItem((p) => ({ ...p, title: e.target.value }))}
                      placeholder="مثال: FORTYFIVE"
                    />
                    <Textarea
                      label="توضیح کوتاه"
                      value={currentTabItem.description}
                      onChange={(e) => setCurrentTabItem((p) => ({ ...p, description: e.target.value }))}
                      placeholder="توضیح کوتاهی درباره این آیتم"
                    />
                    <Input
                      label="لینک (اختیاری)"
                      value={currentTabItem.link}
                      onChange={(e) => setCurrentTabItem((p) => ({ ...p, link: e.target.value }))}
                      placeholder="https://..."
                    />
                    <Button type="button" variant="primary" onClick={handleAddOrUpdateTabItem}>
                      {editingTabItemIndex !== null ? 'بروزرسانی آیتم' : 'افزودن آیتم'}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {customTabItems.map((item, index) => (
                      <div key={item._id || index} className="flex items-center justify-between gap-3 p-3 bg-white border border-neutral-200 rounded-lg shadow-sm">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-md bg-neutral-50 border border-neutral-200 flex items-center justify-center overflow-hidden shrink-0">
                            {item.image ? (
                              <img src={item.image} alt="" className="w-full h-full object-contain p-1.5" />
                            ) : (
                              <FiImage size={16} className="text-neutral-300" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-sm truncate">{item.title}</span>
                            {item.description && (
                              <span className="text-[11px] text-neutral-400 truncate">{item.description}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button type="button" onClick={() => handleEditTabItem(index)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-md transition"><FiEdit3 size={14} /></button>
                          <button type="button" onClick={() => removeTabItem(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-md transition"><FiTrash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 pt-8 border-t">
              <Button type="submit" loading={loading} className="px-12"><FiSave className="ml-2" /> ذخیره تغییرات نهایی</Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/p-admin/admin-categories')}>بازگشت</Button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
