'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { FaArrowRight, FaCloudUploadAlt, FaGlobeAmericas, FaCalendarAlt, FaCheckCircle, FaRocket, FaEdit, FaParagraph, FaMagic } from 'react-icons/fa';
import { toast } from 'react-toastify';

export default function EditBrand() {
  const router = useRouter();
  const { brandId } = useParams(); // دریافت ID از URL

  const [loading, setLoading] = useState(true); // لودینگ اولیه صفحه
  const [saving, setSaving] = useState(false); // لودینگ دکمه ثبت
  const [uploading, setUploading] = useState({ logo: false, icon: false, image: false });
  const defaultPromptFields = ['name', 'title', 'description'];

  const [formData, setFormData] = useState({
    name: '', title: '', country: '', foundedYear: '', description: '',
    logo: '', icon: '', image: '', prompts: [],
  });

  // ۱. دریافت اطلاعات برند برای ویرایش
  useEffect(() => {
    const fetchBrandData = async () => {
      try {
        const res = await fetch(`/api/brands/${brandId}`);
        const data = await res.json();
        if (!res.ok) throw new Error();

        const existingPrompts = data.brand.prompts || [];
        const mergedPrompts = defaultPromptFields.map(field => {
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
          image: data.brand.image || '',
          prompts: mergedPrompts,
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

      if (!res.ok) throw new Error();
      toast.success('تغییرات با موفقیت در منظومه ثبت شد! ✨');
      router.push('/p-admin/admin-brands');
    } catch {
      toast.error('خطا در به‌روزرسانی برند');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 font-bold animate-pulse">در حال فراخوانی هویت برند...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-20 bg-gray-50/30">
      {/* --- Header Section --- */}
      <header className="max-w-5xl mx-auto px-6 py-10 flex justify-between items-end">
        <div>
          <Link href="/p-admin/admin-brands" className="flex items-center gap-2 text-gray-400 text-sm font-bold mb-2 hover:text-[var(--color-primary)] transition-colors group">
            <FaArrowRight size={12} className="group-hover:-translate-x-1 transition-transform" /> بازگشت به لیست
          </Link>
          <h1 className="text-4xl font-bold text-gray-800 tracking-tight">
            ویرایش برند <span className="text-[var(--color-secondary)]">{formData.title || formData.name}</span>
          </h1>
        </div>
        <div className="hidden md:block text-left italic font-bold text-gray-200/50 text-6xl select-none uppercase tracking-tighter text-outline">Update</div>
      </header>

      <main className="max-w-5xl mx-auto px-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* --- Right Column: Info --- */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/40">
              <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <span className="w-2 h-6 bg-[var(--color-primary)] rounded-full" /> ویرایش شناسنامه برند
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 mr-2 uppercase tracking-widest">نام سیستمی</label>
                  <input
                    required
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-[var(--color-primary)] focus:bg-white rounded-2xl px-5 py-4 outline-none transition-all font-bold text-gray-700"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 mr-2 uppercase tracking-widest">عنوان نمایشی</label>
                  <input
                    required
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-[var(--color-primary)] focus:bg-white rounded-2xl px-5 py-4 outline-none transition-all font-bold text-gray-700"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 mr-2 uppercase flex items-center gap-1"><FaGlobeAmericas size={10} /> کشور</label>
                  <input
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-[var(--color-primary)] focus:bg-white rounded-2xl px-5 py-4 outline-none transition-all font-bold text-gray-700"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 mr-2 uppercase flex items-center gap-1"><FaCalendarAlt size={10} /> سال پایه گذاری</label>
                  <input
                    type="number"
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-[var(--color-primary)] focus:bg-white rounded-2xl px-5 py-4 outline-none transition-all font-bold text-gray-700"
                    value={formData.foundedYear}
                    onChange={(e) => setFormData({ ...formData, foundedYear: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <label className="text-xs font-bold text-gray-400 mr-2 uppercase">توضیحات و بیوگرافی</label>
                <textarea
                  rows={5}
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-[var(--color-primary)] focus:bg-white rounded-[2rem] px-5 py-4 outline-none transition-all font-medium text-gray-600 resize-none"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/40">
                <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <FaMagic className="text-[var(--color-primary)]" /> ویرایش دستورالعمل‌های هوش مصنوعی
                </h2>
                <p className="text-[11px] text-gray-400 mb-6 font-bold leading-relaxed">
                  این دستورالعمل‌ها به AI کمک می‌کنند تا مقادیر "سری‌های" زیرمجموعه این برند را دقیق‌تر تولید کند.
                </p>

                <div className="space-y-6">
                  {formData.prompts.map((item, index) => (
                    <div key={item.field} className="space-y-2 group">
                      <label className="text-[10px] font-bold text-gray-400 mr-2 uppercase flex items-center gap-1 group-focus-within:text-[var(--color-primary)] transition-colors">
                        <FaParagraph size={10} /> دستورالعمل تولید {item.field}
                      </label>
                      <textarea
                        dir='ltr'
                        rows={3}
                        placeholder={`مثلاً: نام سری‌های ${formData.title} باید کوتاه و ورزشی باشد...`}
                        className="w-full text-left [direction:ltr] bg-gray-50 border-2 border-transparent focus:border-[var(--color-primary)] focus:bg-white rounded-2xl px-5 py-4 outline-none transition-all font-medium text-sm text-gray-600 shadow-sm resize-none"
                        value={item.context}
                        onChange={(e) => handlePromptChange(index, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Banner Update */}
            <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/40">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-800">تصویر کاور برند</h2>
                {formData.image && <span className="text-[10px] font-bold text-green-500 bg-green-50 px-3 py-1 rounded-full uppercase">تصویر فعلی موجود است</span>}
              </div>
              <UploadField
                url={formData.image}
                loading={uploading.image}
                onSelect={(f) => uploadImage(f, 'image')}
                aspect="aspect-[21/9]"
              />
            </div>
          </div>

          {/* --- Left Column: Assets & Action --- */}
          <div className="space-y-8">
            <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)] opacity-10 blur-[50px] -mr-16 -mt-16"></div>
              <h2 className="text-lg font-bold mb-8 flex items-center justify-between relative z-10">
                Visual Assets
                <FaEdit className="text-[var(--color-secondary)] opacity-50" />
              </h2>

              <div className="space-y-10 relative z-10">
                <div className="group">
                  <p className="text-[10px] font-bold uppercase text-gray-500 mb-3 tracking-[0.2em] text-center group-hover:text-[var(--color-secondary)] transition-colors">Main Brand Logo</p>
                  <UploadField
                    url={formData.logo}
                    loading={uploading.logo}
                    onSelect={(f) => uploadImage(f, 'logo')}
                    isSquare
                  />
                </div>

                <div className="group">
                  <p className="text-[10px] font-bold uppercase text-gray-500 mb-3 tracking-[0.2em] text-center group-hover:text-[var(--color-secondary)] transition-colors">Favicon / Icon</p>
                  <UploadField
                    url={formData.icon}
                    loading={uploading.icon}
                    onSelect={(f) => uploadImage(f, 'icon')}
                    isSquare
                    small
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={saving}
              className={`w-full py-6 rounded-[2rem] font-bold text-xl shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95 group ${saving ? 'bg-gray-800 text-gray-500' : 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white hover:shadow-[0_20px_40px_rgba(var(--color-primary-rgb),0.3)] hover:-translate-y-1'
                }`}
            >
              {saving ? (
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>ذخیره تغییرات برند <FaRocket className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /></>
              )}
            </button>

            <p className="text-[10px] text-center text-gray-400 font-bold uppercase tracking-widest px-4">
              آخرین ویرایش توسط سیستم در: {new Date().toLocaleDateString('fa-IR')}
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}

// کامپوننت UploadField همان قبلی است اما با کمی استایل ظریف‌تر برای حالت ویرایش
function UploadField({ url, loading, onSelect, isSquare, small, aspect = "aspect-video" }) {
  return (
    <div className={`relative group ${isSquare ? (small ? 'w-24 h-24 mx-auto' : 'w-44 h-44 mx-auto') : 'w-full'} ${!isSquare && aspect}`}>
      <label className={`
        flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-[2.5rem] 
        cursor-pointer transition-all duration-500 overflow-hidden relative group-hover:shadow-lg
        ${url ? 'border-transparent' : 'border-gray-200 bg-gray-50 hover:border-[var(--color-primary)] hover:bg-white'}
      `}>
        {url ? (
          <>
            <img src={url} className="w-full h-full object-cover rounded-[2.5rem] transition-transform duration-700 group-hover:scale-110" alt="preview" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 backdrop-blur-[2px]">
              <FaCloudUploadAlt className="text-white text-3xl animate-bounce" />
              <span className="text-[10px] font-bold text-white uppercase tracking-widest">تغییر تصویر</span>
            </div>
          </>
        ) : (
          <div className="text-center p-4">
            {loading ? (
              <div className="w-8 h-8 border-4 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin mx-auto" />
            ) : (
              <>
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm group-hover:scale-110 transition-transform">
                  <FaCloudUploadAlt className="text-gray-300 group-hover:text-[var(--color-primary)] transition-colors text-2xl" />
                </div>
                {!small && <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">انتخاب فایل جدید</span>}
              </>
            )}
          </div>
        )}
        <input type="file" hidden accept="image/*" disabled={loading} onChange={(e) => onSelect(e.target.files[0])} />
      </label>

      {url && !loading && (
        <div className="absolute -top-2 -right-2 bg-green-500 text-white w-7 h-7 rounded-full flex items-center justify-center shadow-xl border-2 border-white">
          <FaCheckCircle size={12} />
        </div>
      )}
    </div>
  );
}