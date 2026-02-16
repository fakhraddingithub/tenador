'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  FiSave
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
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-neutral-500 font-mono">{attr.name}</span>
            <span className="text-xs text-neutral-400">•</span>
            <span className="text-xs text-neutral-500">{attr.type === "string" ? "جدول ویژگی ها " : attr.type === "select" ? "لیست انتخابی" : "نمودار شاخص"}</span>
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
  const [categories, setCategories] = useState([]);
  const [showPromptSection, setShowPromptSection] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const productFields = [
    'name',
    'label',
    'shortDescription',
    'longDescription',
    'suitableFor',
    'basePrice',
    'tag',
  ];

  const [productPrompts, setProductPrompts] = useState(
    productFields.map((field) => ({ field, context: '' }))
  );

  const [formData, setFormData] = useState({
    title: '',
    name: '',
    parent: '',
    attributes: [],
  });

  const [currentAttribute, setCurrentAttribute] = useState({
    name: '',
    label: '',
    type: 'string',
    required: true,
    options: '',
    prompt: '',
  });

  const [technicalStats, setTechnicalStats] = useState([]);
  const [currentStat, setCurrentStat] = useState({ name: '', label: '', description: '' });
  const [technicalStatsPrompt, setTechnicalStatsPrompt] = useState('');
  const [editingStatId, setEditingStatId] = useState(null);

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
      // Fetch all categories for the parent dropdown
      const catsRes = await fetch('/api/categories');
      const catsData = await catsRes.json();
      setCategories(catsData.categories || []);

      // Fetch the specific category to edit
      const res = await fetch(`/api/categories/${categoryId}`);
      const data = await res.json();

      if (res.ok && data.category) {
        const cat = data.category;

        setTechnicalStatsPrompt(cat.technicalStatsPrompt || '');

        setFormData({
          title: cat.title || '',
          name: cat.name || '',
          parent: cat.parent?._id || cat.parent || '',
          // Ensure every attribute has a unique ID for DnD-Kit even if DB doesn't provide one
          attributes: (cat.attributes || []).map(attr => ({
            ...attr,
            id: attr.id || attr._id || `attr-${Math.random().toString(36).substr(2, 9)}`,
            options: Array.isArray(attr.options) ? attr.options : []
          })),
          technicalStatsPrompt: cat.technicalStatsPrompt
        });

        setTechnicalStats((cat.technicalStats || []).map(stat => ({
          ...stat,
          id: stat.id || stat._id || `stat-${Math.random().toString(36).substr(2, 9)}`
        })));

        // Fill prompts
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

  const handleParentChange = (parentId) => {
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

      // ۳. بروزرسانی formData (ترکیب اتریبیوت‌های قدیمی و جدید)
      setFormData(prev => ({
        ...prev,
        parent: '', // طبق درخواست شما والد ذخیره نمی‌شود
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
      type: currentAttribute.type,
      required: currentAttribute.required,
      options: currentAttribute.type === 'select'
        ? (typeof currentAttribute.options === 'string' ? currentAttribute.options.split(',').map(o => o.trim()).filter(Boolean) : currentAttribute.options)
        : [],
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
    setCurrentAttribute({ name: '', label: '', type: 'string', required: true, options: '', prompt: '' });
    setEditingId(null);
  };

  const handleEditInit = (attr) => {
    setEditingId(attr.id);
    setCurrentAttribute({
      name: attr.name,
      label: attr.label,
      type: attr.type,
      required: attr.required,
      options: Array.isArray(attr.options) ? attr.options.join(', ') : '',
      prompt: attr.prompt || '',
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        title: formData.title,
        name: formData.name,
        parent: formData.parent || null,
        attributes: formData.attributes,
        technicalStats: technicalStats,
        technicalStatsPrompt: technicalStatsPrompt,
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

  if (fetching) return <div className="flex items-center justify-center min-h-screen">در حال بارگذاری...</div>;

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
              onChange={(e) => handleParentChange(e.target.value)}
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
                  <Select
                    label="محل نمایش ویژگی"
                    value={currentAttribute.type}
                    onChange={(e) => setCurrentAttribute(p => ({ ...p, type: e.target.value }))}
                    options={[
                      { value: 'string', label: 'جدول ویژگی ها' },
                      { value: 'select', label: 'لیست انتخابی' }
                    ]}
                  />
                  <div className="mt-8">
                    <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                      <input type="checkbox" checked={currentAttribute.required} onChange={(e) => setCurrentAttribute(p => ({ ...p, required: e.target.checked }))} className="w-5 h-5 accent-[var(--color-primary)]" /> الزامی
                    </label>
                  </div>
                </div>
                <Textarea label="پرامپت ویژگی" value={currentAttribute.prompt} onChange={(e) => setCurrentAttribute(p => ({ ...p, prompt: e.target.value }))} />
                {currentAttribute.type === 'select' && (
                  <Input label="گزینه‌ها (کاما ,)" value={currentAttribute.options} onChange={(e) => setCurrentAttribute(p => ({ ...p, options: e.target.value }))} />
                )}
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

            {/* Technical Stats Section (Chart) */}
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
                    <Button type="button" variant="secondary" onClick={() => { setEditingStatId(null); setCurrentStat({ name: '', label: '', prompt: '', description: '' }) }}>
                      انصراف
                    </Button>
                  )}
                </div>
              </div>

              {/* لیست شاخص‌ها */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {technicalStats.map((stat) => (
                  <div key={stat.id} className="flex items-center justify-between p-3 bg-white border border-neutral-200 rounded-lg shadow-sm group">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-neutral-800">{stat.label}</span>
                      <span className="text-[10px] text-neutral-400 font-mono">{stat.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => handleEditStat(stat)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-md transition">
                        <FiEdit3 size={14} />
                      </button>
                      <button type="button" onClick={() => removeStat(stat.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-md transition">
                        <FiTrash2 size={14} />
                      </button>
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