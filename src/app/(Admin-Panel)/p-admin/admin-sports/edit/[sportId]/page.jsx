'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { FiArrowRight, FiUploadCloud, FiSave, FiLoader, FiType, FiFileText, FiImage, FiGrid, FiActivity } from 'react-icons/fi';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function EditSport() {
  const router = useRouter();
  const { sportId } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingType, setUploadingType] = useState(null); // 'icon' or 'image'

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    image: '',
  });

  useEffect(() => {
    fetchSport();
  }, [sportId]);

  const fetchSport = async () => {
    try {
      const res = await fetch(`/api/sports/${sportId}`);
      const data = await res.json();
      if (res.ok) {
        const s = data.sport;
        setFormData({
          name: s.name || '',
          description: s.description || '',
          icon: s.icon || '',
          image: s.image || '',
        });
      }
    } catch (error) {
      toast.error('خطا در بارگذاری اطلاعات ورزش');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      return toast.warn("حجم فایل نباید بیشتر از ۲ مگابایت باشد");
    }

    setUploadingType(type);
    const upData = new FormData();
    upData.append('file', file);
    upData.append('folder', 'sports');

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: upData,
      });

      const data = await res.json();
      if (res.ok) {
        setFormData((prev) => ({ ...prev, [type]: data.url }));
        toast.success(`${type === 'icon' ? 'آیکون' : 'تصویر'} با موفقیت آپلود شد`);
      } else {
        throw new Error(data.error || 'خطا در آپلود');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploadingType(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.warn("نام ورزش الزامی است");

    setSaving(true);
    try {
      const res = await fetch(`/api/sports/${sportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success("تغییرات با موفقیت ذخیره شد");
        setTimeout(() => router.push('/p-admin/admin-sports'), 1500);
      } else {
        const data = await res.json();
        throw new Error(data.error || 'خطا در ویرایش');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-4 border-gray-200 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
      <p className="text-gray-500 font-bold">در حال فراخوانی اطلاعات...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-[var(--color-text)] pb-20" dir="rtl">
      <ToastContainer rtl />
      
      {/* هدر */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/p-admin/admin-sports" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <FiArrowRight size={24} className="text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">ویرایش ورزش</h1>
              <p className="text-xs text-gray-400 mt-1 uppercase font-bold tracking-widest">{formData.name}</p>
            </div>
          </div>
          <FiGrid className="text-gray-200" size={30} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-10">
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* بخش تصاویر (آیکون و تصویر اصلی) */}
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* آپلود تصویر اصلی */}
            <div className="bg-white p-6 rounded-[var(--radius)] border border-gray-100 shadow-sm">
              <label className="flex items-center gap-2 text-sm font-bold mb-4 text-gray-600">
                <FiImage className="text-[var(--color-primary)]" /> تصویر اصلی ورزش
              </label>
              <div className="relative h-48 bg-gray-50 rounded-[var(--radius)] overflow-hidden border-2 border-dashed border-gray-100 flex items-center justify-center group">
                {formData.image ? (
                  <>
                    <img src={formData.image} alt="Cover" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <label htmlFor="image-up" className="cursor-pointer text-white font-bold text-sm">تغییر تصویر</label>
                    </div>
                  </>
                ) : (
                  <label htmlFor="image-up" className="flex flex-col items-center cursor-pointer text-gray-400">
                    <FiUploadCloud size={40} className="mb-2" />
                    <span className="text-xs font-bold">آپلود عکس اصلی</span>
                  </label>
                )}
                <input type="file" id="image-up" className="hidden" onChange={(e) => handleFileUpload(e, 'image')} />
                {uploadingType === 'image' && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <FiLoader className="animate-spin text-[var(--color-primary)]" size={30} />
                  </div>
                )}
              </div>
            </div>

            {/* آپلود آیکون */}
            <div className="bg-white p-6 rounded-[var(--radius)] border border-gray-100 shadow-sm">
              <label className="flex items-center gap-2 text-sm font-bold mb-4 text-gray-600">
                <FiActivity className="text-[var(--color-primary)]" /> آیکون ورزش (PNG/SVG)
              </label>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0 relative group">
                   {formData.icon ? (
                     <img src={formData.icon} alt="Icon" className="w-full h-full object-contain p-2" />
                   ) : (
                     <FiActivity size={30} className="text-gray-200" />
                   )}
                   {uploadingType === 'icon' && (
                     <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                        <FiLoader className="animate-spin text-[var(--color-primary)]" />
                     </div>
                   )}
                </div>
                <div className="flex-1">
                   <p className="text-xs text-gray-400 mb-3 leading-relaxed">آیکون در کنار نام ورزش در کارت‌ها نمایش داده می‌شود.</p>
                   <label htmlFor="icon-up" className="inline-block bg-gray-100 hover:bg-[var(--color-secondary)] px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all">
                      انتخاب آیکون جدید
                   </label>
                   <input type="file" id="icon-up" className="hidden" onChange={(e) => handleFileUpload(e, 'icon')} />
                </div>
              </div>
            </div>

          </div>

          {/* فیلدهای متنی */}
          <div className="bg-white p-8 rounded-[var(--radius)] border border-gray-100 shadow-sm space-y-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-gray-600">
                <FiType className="text-[var(--color-primary)]" /> نام ورزش
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-gray-50 border-none rounded-[var(--radius)] px-5 py-4 outline-none focus:ring-2 ring-[var(--color-primary)]/20 transition-all font-bold"
                placeholder="مثال: تنیس روی میز"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-gray-600">
                <FiFileText className="text-[var(--color-primary)]" /> توضیحات کامل
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={5}
                className="w-full bg-gray-50 border-none rounded-[var(--radius)] px-5 py-4 outline-none focus:ring-2 ring-[var(--color-primary)]/20 transition-all leading-relaxed"
                placeholder="در مورد این رشته ورزشی توضیح دهید..."
              />
            </div>
          </div>

          {/* دکمه‌های عملیاتی */}
          <div className="flex items-center justify-end gap-4">
            <Link
              href="/p-admin/admin-sports"
              className="px-8 py-4 rounded-[var(--radius)] font-bold text-gray-400 hover:text-gray-600 transition-all"
            >
              انصراف
            </Link>
            <button
              type="submit"
              disabled={saving || uploadingType}
              className="bg-[var(--color-text)] text-white px-10 py-4 rounded-[var(--radius)] font-bold flex items-center gap-3 hover:bg-[var(--color-primary)] transition-all disabled:opacity-50 shadow-xl shadow-black/10"
            >
              {saving ? <FiLoader className="animate-spin" /> : <FiSave size={20} />}
              {saving ? 'در حال ثبت تغییرات...' : 'ذخیره نهایی اطلاعات'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}