'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaGlobeAmericas, FaCalendarAlt, FaCheckCircle, FaRocket, FaMagic, FaParagraph } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { getApiErrorMessage } from '@/lib/apiClientError';
import { invalidateAdminCache } from '@/lib/adminCache';
import BrandMiniArticleEditor from '@/components/admin/brands/BrandMiniArticleEditor';
import BrandCategoryArticlesEditor from '@/components/admin/brands/BrandCategoryArticlesEditor';
import BrandUploadField from '@/components/admin/brands/BrandUploadField';
import { AccordionBox, Field, TextInput, TextareaInput, textareaClass } from '@/components/admin/SerieFormLayout';

// هم‌ظاهر با کارتِ مینی‌مقاله در فرمِ سری.
const SECTION_CLASS = 'rounded-[6px] border border-gray-200 bg-white p-4 shadow-sm md:p-6';

export default function AddBrand() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState({ logo: false, icon: false, monochromeLogo: false, image: false });
  // فقط نما: باز/بسته بودنِ بخش‌ها (هم‌شکلِ فرمِ سری). داده‌ی فرم به آن وابسته نیست.
  const [openBoxes, setOpenBoxes] = useState({ main: true, ai: true });
  const toggleBox = (key) => setOpenBoxes((prev) => ({ ...prev, [key]: !prev[key] }));

  const initialPrompts = [
    { field: 'name', context: `Identify the exact technical name of the model/series. Remove any Persian characters. Format it as a URL-friendly string if possible.` },
    { field: 'title', context: `Create a compelling Persian title. (e.g., "ایر مکس").` },
    { field: 'description', context: `Write a high-conversion marketing description (at least 3-4 sentences). Focus on:
      - The core technology (e.g., cushioning, material).
      - The target use case (e.g., professional running, lifestyle).
      - The unique selling point (USP) of this specific serie.` },
  ];

  const handlePromptChange = (index, value) => {
    const updatedPrompts = [...formData.prompts];
    updatedPrompts[index].context = value;
    setFormData({ ...formData, prompts: updatedPrompts });
  };

  const [formData, setFormData] = useState({
    name: '', title: '', country: '', foundedYear: '', description: '',
    logo: '', icon: '', monochromeLogo: '', image: '',
    prompts: initialPrompts,
    articleBlocks: [],
    categoryArticles: [],
  });

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
      toast.success(`${field} با موفقیت آپلود شد`);
    } catch (err) {
      toast.error('آپلود تصویر ناموفق بود');
    } finally {
      setUploading((p) => ({ ...p, [field]: false }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        foundedYear: formData.foundedYear ? Number(formData.foundedYear) : null,
        prompts: formData.prompts.filter(p => p.context.trim() !== '')
      };
      const res = await fetch('/api/brands/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getApiErrorMessage(data, 'خطا در ثبت برند'));
      invalidateAdminCache('/api/brands');
      toast.success('برند با موفقیت ثبت شد!');
      router.push('/p-admin/admin-brands');
    } catch (err) {
      toast.error(err.message || 'خطا در ثبت برند');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center">
      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-7xl pb-16" dir="rtl">
        <div className="space-y-4">
          {/* --- Header (هم‌شکلِ فرمِ سری) --- */}
          <div className="flex flex-col gap-3 rounded-[6px] border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] bg-black text-[var(--color-primary)]">
                <FaRocket />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-extrabold text-gray-950">ثبت برند جدید</h2>
                <p className="truncate text-xs font-bold text-gray-500">
                  برند: <span className="text-gray-900">{formData.title || formData.name || "-"}</span>
                </p>
              </div>
            </div>
          </div>

          <AccordionBox
            title="اطلاعات اصلی برند"
            eyebrow="هویت بصری، نام‌ها و داستان برند"
            icon={FaRocket}
            open={openBoxes.main}
            onToggle={() => toggleBox("main")}
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(240px,33%)_minmax(0,1fr)]" dir="rtl">
              <div className="min-w-0 space-y-3">
                <BrandUploadField
                  label="تصویر هدر برند"
                  url={formData.image}
                  loading={uploading.image}
                  onSelect={(f) => uploadImage(f, 'image')}
                  aspect="aspect-[21/9]"
                />
                <div className="grid grid-cols-2 items-end gap-3 xl:grid-cols-3">
                  <BrandUploadField
                    label="لوگوی اصلی"
                    url={formData.logo}
                    loading={uploading.logo}
                    onSelect={(f) => uploadImage(f, 'logo')}
                    square
                  />
                  <BrandUploadField
                    label="آیکن (Favicon)"
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
                    label="نام سیستمی (English)"
                    required
                    placeholder="e.g. Nike"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                  <TextInput
                    label="عنوان نمایشی (Persian)"
                    required
                    placeholder="مثلاً نایکی"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                  <TextInput
                    label="کشور سازنده"
                    icon={FaGlobeAmericas}
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                  <TextInput
                    label="سال تأسیس"
                    icon={FaCalendarAlt}
                    type="number"
                    value={formData.foundedYear}
                    onChange={(e) => setFormData({ ...formData, foundedYear: e.target.value })}
                  />
                </div>
                <TextareaInput
                  label="داستان برند (توضیحات)"
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
          </AccordionBox>

          <AccordionBox
            title="دستورالعمل‌های هوش مصنوعی (سری‌ها)"
            eyebrow="مقادیرِ سری‌های این برند"
            icon={FaMagic}
            open={openBoxes.ai}
            onToggle={() => toggleBox("ai")}
          >
            <div className="space-y-3">
              <p className="text-[11px] font-bold leading-6 text-gray-500">در این بخش مشخص کنید AI چگونه باید مقادیر فیلدهای مربوط به &quot;سری‌های&quot; این برند را تولید کند.</p>
              {formData.prompts.map((item, index) => (
                <Field key={item.field} label={`دستورالعمل برای فیلد ${item.field}`} icon={FaParagraph}>
                  <textarea
                    dir='ltr'
                    rows={3}
                    placeholder={`توضیح دهید AI چگونه باید مقدار ${item.field} را برای سری‌های ${formData.title || 'این برند'} تولید کند...`}
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
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-[6px] bg-black px-5 py-4 text-base font-extrabold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="h-6 w-6 rounded-full border-4 border-white/20 border-t-white animate-spin" />
            ) : (
              <>تأیید و ثبت نهایی <FaCheckCircle className="text-[var(--color-primary)]" /></>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
