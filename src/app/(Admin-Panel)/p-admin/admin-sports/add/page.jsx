'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiArrowRight, FiPlusCircle, FiImage, FiActivity, FiType, FiFileText, FiLoader, FiUploadCloud } from 'react-icons/fi';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const NAME_REGEX = /^[a-zA-Z0-9\s\-_]+$/;

export default function AddSport() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploadingField, setUploadingField] = useState(null); // 'icon' or 'image'

  const [formData, setFormData] = useState({
    name: '',
    title: '',
    description: '',
    icon: '',
    image: '',
  });

  const uploadFile = async (file, field) => {
    if (!file) return;
    setUploadingField(field);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'sports');

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: fd,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'خطا در آپلود');
      }

      setFormData((prev) => ({
        ...prev,
        [field]: data.url,
      }));
      toast.success(`${field === 'icon' ? 'آیکون' : 'تصویر'} با موفقیت آپلود شد`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingField(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!NAME_REGEX.test(formData.name)) {
      toast.warn('نام سیستمی فقط باید شامل حروف انگلیسی، عدد و کاراکترهای مجاز باشد');
      return;
    }

    if (!formData.title.trim()) {
      toast.warn('عنوان نمایشی الزامی است');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/sports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'خطا در ایجاد ورزش');
      }

      toast.success('ورزش جدید با موفقیت ایجاد شد');
      setTimeout(() => router.push('/p-admin/admin-sports'), 1500);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-[var(--color-text)] pb-20" dir="rtl">
      <ToastContainer rtl />
      
      {/* هدر مدرن */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/p-admin/admin-sports" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <FiArrowRight size={24} className="text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">افزودن ورزش جدید</h1>
              <p className="text-xs text-gray-400 mt-1 font-bold">ایجاد رشته ورزشی جدید در سامانه</p>
            </div>
          </div>
          <FiPlusCircle className="text-[var(--color-primary)] opacity-20" size={40} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 mt-10">
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* بخش آپلودها */}
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* باکس آپلود تصویر اصلی */}
            <div className="bg-white p-6 rounded-[var(--radius)] border border-gray-100 shadow-sm">
              <label className="flex items-center gap-2 text-sm font-bold mb-4 text-gray-600">
                <FiImage className="text-[var(--color-primary)]" /> تصویر اصلی ورزش
              </label>
              <div className="relative h-48 bg-gray-50 rounded-[var(--radius)] overflow-hidden border-2 border-dashed border-gray-200 flex flex-col items-center justify-center group transition-all hover:border-[var(--color-primary)]/50">
                {formData.image ? (
                  <>
                    <img src={formData.image} alt="Main" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <label htmlFor="image-add" className="cursor-pointer text-white font-bold text-sm">تغییر تصویر</label>
                    </div>
                  </>
                ) : (
                  <label htmlFor="image-add" className="flex flex-col items-center cursor-pointer text-gray-400 hover:text-[var(--color-primary)] transition-colors">
                    <FiUploadCloud size={40} className="mb-2" />
                    <span className="text-xs font-bold">انتخاب عکس اصلی</span>
                  </label>
                )}
                <input type="file" id="image-add" className="hidden" onChange={(e) => uploadFile(e.target.files[0], 'image')} accept="image/*" />
                {uploadingField === 'image' && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <FiLoader className="animate-spin text-[var(--color-primary)]" size={30} />
                  </div>
                )}
              </div>
            </div>

            {/* باکس آپلود آیکون */}
            <div className="bg-white p-6 rounded-[var(--radius)] border border-gray-100 shadow-sm flex flex-col justify-center">
              <label className="flex items-center gap-2 text-sm font-bold mb-4 text-gray-600">
                <FiActivity className="text-[var(--color-primary)]" /> آیکون کوچک
              </label>
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group">
                  {formData.icon ? (
                    <img src={formData.icon} alt="Icon" className="w-full h-full object-contain p-2" />
                  ) : (
                    <FiPlusCircle size={24} className="text-gray-300" />
                  )}
                  {uploadingField === 'icon' && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                       <FiLoader className="animate-spin text-[var(--color-primary)]" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                   <label htmlFor="icon-add" className="bg-gray-100 hover:bg-[var(--color-secondary)] px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all inline-block">
                      آپلود آیکون
                   </label>
                   <p className="text-[10px] text-gray-400 mt-2 italic">فرمت‌های PNG یا SVG پیشنهاد می‌شود.</p>
                   <input type="file" id="icon-add" className="hidden" onChange={(e) => uploadFile(e.target.files[0], 'icon')} accept="image/*" />
                </div>
              </div>
            </div>
          </div>

          {/* فیلدهای اطلاعاتی */}
          <div className="bg-white p-8 rounded-[var(--radius)] border border-gray-100 shadow-sm space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Name */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-600">
                  <FiType className="text-[var(--color-primary)]" /> نام سیستمی (English)
                </label>
                <input
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  required
                  className="w-full bg-gray-50 border-none rounded-[var(--radius)] px-5 py-4 outline-none focus:ring-2 ring-[var(--color-primary)]/20 transition-all font-bold text-left"
                  placeholder="e.g. basketball"
                  dir="ltr"
                />
              </div>

              {/* Title */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-600">
                  <FiType className="text-[var(--color-primary)]" /> عنوان نمایشی (Persian)
                </label>
                <input
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  required
                  className="w-full bg-gray-50 border-none rounded-[var(--radius)] px-5 py-4 outline-none focus:ring-2 ring-[var(--color-primary)]/20 transition-all font-bold"
                  placeholder="مثال: بسکتبال"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-gray-600">
                <FiFileText className="text-[var(--color-primary)]" /> توضیحات رشته ورزشی
              </label>
              <textarea
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                className="w-full bg-gray-50 border-none rounded-[var(--radius)] px-5 py-4 outline-none focus:ring-2 ring-[var(--color-primary)]/20 transition-all leading-relaxed"
                placeholder="توضیحات کوتاهی درباره این ورزش بنویسید..."
              />
            </div>
          </div>

          {/* دکمه‌ها */}
          <div className="flex items-center justify-end gap-4">
            <Link
              href="/p-admin/admin-sports"
              className="px-8 py-4 rounded-[var(--radius)] font-bold text-gray-400 hover:text-gray-600 transition-all"
            >
              انصراف
            </Link>
            <button
              disabled={loading || uploadingField}
              className="bg-[var(--color-text)] text-white px-12 py-4 rounded-[var(--radius)] font-bold flex items-center gap-3 hover:bg-[var(--color-primary)] transition-all disabled:opacity-50 shadow-xl shadow-black/5"
            >
              {loading ? <FiLoader className="animate-spin" /> : <FiPlusCircle size={20} />}
              {loading ? 'در حال ثبت...' : 'ثبت ورزش جدید'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}