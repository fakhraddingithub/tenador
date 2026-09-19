'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { FaGlobeAmericas, FaCalendarAlt, FaRocket, FaEdit, FaParagraph, FaMagic, FaSync } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { getApiErrorMessage } from '@/lib/apiClientError';
import { invalidateAdminCache } from '@/lib/adminCache';
import BrandMiniArticleEditor from '@/components/admin/brands/BrandMiniArticleEditor';
import BrandCategoryArticlesEditor from '@/components/admin/brands/BrandCategoryArticlesEditor';
import BrandUploadField from '@/components/admin/brands/BrandUploadField';
import { AccordionBox, Field, TextInput, TextareaInput, textareaClass } from '@/components/admin/SerieFormLayout';

// هم‌ظاهر با کارتِ مینی‌مقاله در فرمِ سری.
const SECTION_CLASS = 'rounded-[6px] border border-gray-200 bg-white p-4 shadow-sm md:p-6';

const DEFAULT_PROMPT_FIELDS = ['name', 'title', 'description'];

export default function EditBrand() {
  const router = useRouter();
  const { brandId } = useParams(); // دریافت ID از URL

  const [loading, setLoading] = useState(true); // لودینگ اولیه صفحه
  const [saving, setSaving] = useState(false); // لودینگ دکمه ثبت
  const [uploading, setUploading] = useState({ logo: false, icon: false, monochromeLogo: false, image: false });
  // فقط نما: باز/بسته بودنِ بخش‌ها (هم‌شکلِ فرمِ سری). داده‌ی فرم به آن وابسته نیست.
  const [openBoxes, setOpenBoxes] = useState({ main: true, ai: true });
  const toggleBox = (key) => setOpenBoxes((prev) => ({ ...prev, [key]: !prev[key] }));

  const [formData, setFormData] = useState({
    name: '', title: '', country: '', foundedYear: '', description: '',
    logo: '', icon: '', monochromeLogo: '', image: '', prompts: [], articleBlocks: [], categoryArticles: [],
  });

  // ۱. دریافت اطلاعات برند برای ویرایش
  useEffect(() => {
    const fetchBrandData = async () => {
      try {
        const res = await fetch(`/api/brands/${brandId}`);
        const data = await res.json();
        if (!res.ok) throw new Error();

        const existingPrompts = data.brand.prompts || [];
        const mergedPrompts = DEFAULT_PROMPT_FIELDS.map(field => {
          const found = existingPrompts.find(p => p.field === field);
          return found ? found : { field, context: '' };
        });

        setFormData({
          name: data.brand.name || '',
          title: data.brand.title || '',
          country: data.brand.country || '',
          foundedYear: data.brand.foundedYear || '',
          description: data.brand.description || '',
          logo: data.brand.logo || '',
          icon: data.brand.icon || '',
          monochromeLogo: data.brand.monochromeLogo || '',
          image: data.brand.image || '',
          prompts: mergedPrompts,
          articleBlocks: data.brand.articleBlocks || [],
          categoryArticles: data.brand.categoryArticles || [],
        });
      } catch (err) {
        toast.error('خطا در بارگذاری اطلاعات برند');
        router.push('/p-admin/admin-brands');
      } finally {
        setLoading(false);
      }
    };

    if (brandId) fetchBrandData();
  }, [brandId, router]);

  const handlePromptChange = (index, value) => {
    const updatedPrompts = [...formData.prompts];
    updatedPrompts[index].context = value;
    setFormData({ ...formData, prompts: updatedPrompts });
  };

  const uploadImage = async (file, field) => {
    if (!file) return;
    setUploading((p) => ({ ...p, [field]: true }));
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'brands');

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFormData((p) => ({ ...p, [field]: data.url }));
      toast.success('تصویر جدید جایگزین شد');
    } catch (err) {
      toast.error('آپلود تصویر ناموفق بود');
    } finally {
      setUploading((p) => ({ ...p, [field]: false }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { 
        ...formData, 
        foundedYear: formData.foundedYear ? Number(formData.foundedYear) : null,
        prompts: formData.prompts.filter(p => p.context.trim() !== '')
      };

      // ۲. تغییر متد به PUT برای ویرایش
      const res = await fetch(`/api/brands/${brandId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getApiErrorMessage(data, 'خطا در به‌روزرسانی برند'));
      invalidateAdminCache('/api/brands');
      toast.success('تغییرات با موفقیت در منظومه ثبت شد! ✨');
      router.push('/p-admin/admin-brands');
    } catch (err) {
      toast.error(err.message || 'خطا در به‌روزرسانی برند');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex h-96 flex-col items-center justify-center gap-4">
      <FaSync className="animate-spin text-4xl" />
      <p className="text-xs font-bold">در حال فراخوانی هویت برند...</p>
    </div>
  );

  return (
    <div className="flex justify-center">
      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-7xl pb-16" dir="rtl">
        <div className="space-y-4">
          {/* --- Header (هم‌شکلِ فرمِ سری) --- */}
          <div className="flex flex-col gap-3 rounded-[6px] border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] bg-black text-[var(--color-primary)]">
                <FaEdit />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-extrabold text-gray-950">ویرایش برند</h2>
                <p className="truncate text-xs font-bold text-gray-500">
                  برند: <span className="text-gray-900">{formData.title || formData.name || "-"}</span>
                </p>
              </div>
            </div>
          </div>

          <AccordionBox
            title="ویرایش شناسنامه برند"
            eyebrow="هویت بصری، نام‌ها و توضیحات برند"
            icon={FaEdit}
            open={openBoxes.main}
            onToggle={() => toggleBox("main")}
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(240px,33%)_minmax(0,1fr)]" dir="rtl">
              <div className="min-w-0 space-y-3">
                <BrandUploadField
                  label="تصویر کاور برند"
                  badge={formData.image ? <span className="rounded-[6px] bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-600">تصویر فعلی موجود است</span> : null}
                  url={formData.image}
                  loading={uploading.image}
                  onSelect={(f) => uploadImage(f, 'image')}
                  aspect="aspect-[21/9]"
                />
                <div className="grid grid-cols-2 items-end gap-3 xl:grid-cols-3">
                  <BrandUploadField
                    label="Main Brand Logo"
                    url={formData.logo}
                    loading={uploading.logo}
                    onSelect={(f) => uploadImage(f, 'logo')}
                    square
                  />
                  <BrandUploadField
                    label="Favicon / Icon"
                    url={formData.icon}
                    loading={uploading.icon}
                    onSelect={(f) => uploadImage(f, 'icon')}
                    square
                  />
                  <BrandUploadField
                    label="لوگوی مونوکروم (Monochrome Logo)"
                    url={formData.monochromeLogo}
                    loading={uploading.monochromeLogo}
                    onSelect={(f) => uploadImage(f, 'monochromeLogo')}
                    square
                  />
                </div>
              </div>

              <div className="min-w-0 space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <TextInput
                    label="نام سیستمی"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                  <TextInput
                    label="عنوان نمایشی"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                  <TextInput
                    label="کشور"
                    icon={FaGlobeAmericas}
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                  <TextInput
                    label="سال پایه گذاری"
                    icon={FaCalendarAlt}
                    type="number"
                    value={formData.foundedYear}
                    onChange={(e) => setFormData({ ...formData, foundedYear: e.target.value })}
                  />
                </div>
                <TextareaInput
                  label="توضیحات و بیوگرافی"
                  rows={5}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
          </AccordionBox>

          <AccordionBox
            title="ویرایش دستورالعمل‌های هوش مصنوعی"
            eyebrow="مقادیرِ سری‌های این برند"
            icon={FaMagic}
            open={openBoxes.ai}
            onToggle={() => toggleBox("ai")}
          >
            <div className="space-y-3">
              <p className="text-[11px] font-bold leading-6 text-gray-500">این دستورالعمل‌ها به AI کمک می‌کنند تا مقادیر &quot;سری‌های&quot; زیرمجموعه این برند را دقیق‌تر تولید کند.</p>
              {formData.prompts.map((item, index) => (
                <Field key={item.field} label={`دستورالعمل تولید ${item.field}`} icon={FaParagraph}>
                  <textarea
                    dir='ltr'
                    rows={3}
                    placeholder={`مثلاً: نام سری‌های ${formData.title} باید کوتاه و ورزشی باشد...`}
                    className={`${textareaClass} text-left [direction:ltr]`}
                    value={item.context}
                    onChange={(e) => handlePromptChange(index, e.target.value)}
                  />
                </Field>
              ))}
            </div>
          </AccordionBox>

          <BrandMiniArticleEditor
            className={SECTION_CLASS}
            value={formData.articleBlocks}
            onChange={(articleBlocks) => setFormData((current) => ({ ...current, articleBlocks }))}
          />

          <BrandCategoryArticlesEditor
            className={SECTION_CLASS}
            value={formData.categoryArticles}
            onChange={(update) => setFormData((current) => ({ ...current, categoryArticles: update(current.categoryArticles) }))}
          />

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-3 rounded-[6px] bg-black px-5 py-4 text-base font-extrabold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <span className="h-6 w-6 rounded-full border-4 border-white/20 border-t-white animate-spin" />
            ) : (
              <>ذخیره تغییرات برند <FaRocket className="text-[var(--color-primary)]" /></>
            )}
          </button>

          <p className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
            آخرین ویرایش توسط سیستم در: {new Date().toLocaleDateString('fa-IR')}
          </p>
        </div>
      </form>
    </div>
  );
}
