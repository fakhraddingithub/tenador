'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaArrowRight, FaCloudUploadAlt, FaGlobeAmericas, FaCalendarAlt, FaCheckCircle, FaRocket, FaMagic, FaParagraph } from 'react-icons/fa';
import { toast } from 'react-toastify';

export default function AddBrand() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState({ logo: false, icon: false, image: false });

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
    logo: '', icon: '', image: '',
    prompts: initialPrompts,
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
      if (!res.ok) throw new Error();
      toast.success('برند با موفقیت ثبت شد!');
      router.push('/p-admin/admin-brands');
    } catch {
      toast.error('خطا در ثبت برند');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 ">
      {/* --- Header Section --- */}
      <header className="max-w-5xl mx-auto px-6 py-10 flex justify-between items-end">
        <div>
          <Link href="/p-admin/admin-brands" className="flex items-center gap-2 text-[var(--color-primary)] text-sm font-bold mb-2 hover:translate-x-1 transition-transform">
            <FaArrowRight size={12} /> بازگشت به برندها
          </Link>
          <h1 className="text-4xl font-bold text-gray-800 tracking-tight">
            ثبت برند <span className="text-[var(--color-primary)]">جدید</span>
          </h1>
        </div>
        <div className="hidden md:block text-left italic font-bold text-gray-100 text-6xl select-none">BRAND</div>
      </header>

      <main className="max-w-5xl mx-auto px-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* --- Right Column: Info --- */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/70 backdrop-blur-xl border border-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/50">
              <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <span className="w-2 h-6 bg-[var(--color-secondary)] rounded-full" /> اطلاعات اصلی برند
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 mr-2 uppercase">نام سیستمی (English)</label>
                  <input
                    required
                    placeholder="e.g. Nike"
                    className="w-full bg-gray-50/50 border-2 border-transparent focus:border-[var(--color-secondary)] focus:bg-white rounded-2xl px-5 py-4 outline-none transition-all font-bold text-gray-700 shadow-sm"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 mr-2 uppercase">عنوان نمایشی (Persian)</label>
                  <input
                    required
                    placeholder="مثلاً نایکی"
                    className="w-full bg-gray-50/50 border-2 border-transparent focus:border-[var(--color-secondary)] focus:bg-white rounded-2xl px-5 py-4 outline-none transition-all font-bold text-gray-700 shadow-sm"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="relative group space-y-2">
                  <label className="text-xs font-bold text-gray-400 mr-2 uppercase flex items-center gap-1"><FaGlobeAmericas /> کشور سازنده</label>
                  <input
                    className="w-full bg-gray-50/50 border-2 border-transparent focus:border-[var(--color-secondary)] focus:bg-white rounded-2xl px-5 py-4 outline-none transition-all font-bold text-gray-700 shadow-sm"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 mr-2 uppercase flex items-center gap-1"><FaCalendarAlt /> سال تأسیس</label>
                  <input
                    type="number"
                    className="w-full bg-gray-50/50 border-2 border-transparent focus:border-[var(--color-secondary)] focus:bg-white rounded-2xl px-5 py-4 outline-none transition-all font-bold text-gray-700 shadow-sm"
                    value={formData.foundedYear}
                    onChange={(e) => setFormData({ ...formData, foundedYear: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <label className="text-xs font-bold text-gray-400 mr-2 uppercase">داستان برند (توضیحات)</label>
                <textarea
                  rows={4}
                  className="w-full bg-gray-50/50 border-2 border-transparent focus:border-[var(--color-secondary)] focus:bg-white rounded-[2rem] px-5 py-4 outline-none transition-all font-medium text-gray-600 shadow-sm"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>

            {/* Banner Upload */}
            <div className="bg-white/70 backdrop-blur-xl border border-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/50">
              <h2 className="text-lg font-bold text-gray-800 mb-6">تصویر هدر برند</h2>
              <UploadField
                url={formData.image}
                loading={uploading.image}
                onSelect={(f) => uploadImage(f, 'image')}
                aspect="aspect-[21/9]"
              />
            </div>

            <div className="bg-white/70 backdrop-blur-xl border border-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/50 mt-8">
              <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <FaMagic className="text-[var(--color-primary)]" /> دستورالعمل‌های هوش مصنوعی (سری‌ها)
              </h2>
              <p className="text-xs text-gray-500 mb-6 font-bold">
                در این بخش مشخص کنید AI چگونه باید مقادیر فیلدهای مربوط به "سری‌های" این برند را تولید کند.
              </p>

              <div className="space-y-6">
                {formData.prompts.map((item, index) => (
                  <div key={item.field} className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 mr-2 uppercase flex items-center gap-1">
                      <FaParagraph size={10} /> دستورالعمل برای فیلد {item.field}
                    </label>
                    <textarea
                      dir='ltr'
                      rows={3}
                      placeholder={`توضیح دهید AI چگونه باید مقدار ${item.field} را برای سری‌های ${formData.title || 'این برند'} تولید کند...`}
                      className="w-full text-left [direction:ltr] bg-gray-50/50 border-2 border-transparent focus:border-[var(--color-primary)] focus:bg-white rounded-2xl px-5 py-4 outline-none transition-all font-medium text-sm text-gray-600 shadow-sm"
                      value={item.context}
                      onChange={(e) => handlePromptChange(index, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* --- Left Column: Assets --- */}
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-[2.5rem] p-8 text-white shadow-2xl">
              <h2 className="text-lg font-bold mb-8 flex items-center justify-between">
                هویت بصری
                <FaRocket className="text-[var(--color-primary)]" />
              </h2>

              <div className="space-y-8">
                <div>
                  <p className="text-[10px] font-bold uppercase text-gray-400 mb-3 tracking-widest text-center">لوگوی اصلی</p>
                  <UploadField
                    url={formData.logo}
                    loading={uploading.logo}
                    onSelect={(f) => uploadImage(f, 'logo')}
                    isSquare
                  />
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase text-gray-400 mb-3 tracking-widest text-center">آیکن (Favicon)</p>
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-6 rounded-[2rem] font-bold text-lg shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95 ${loading ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[var(--color-primary)] text-white hover:shadow-[#aa472555] hover:-translate-y-1'
                }`}
            >
              {loading ? (
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>تأیید و ثبت نهایی <FaCheckCircle /></>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function UploadField({ url, loading, onSelect, isSquare, small, aspect = "aspect-video" }) {
  return (
    <div className={`relative group ${isSquare ? (small ? 'w-24 h-24 mx-auto' : 'w-40 h-40 mx-auto') : 'w-full'} ${!isSquare && aspect}`}>
      <label className={`
        flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-[2rem] 
        cursor-pointer transition-all duration-500 overflow-hidden relative
        ${url ? 'border-transparent shadow-inner' : 'border-gray-200 hover:border-[var(--color-secondary)] bg-gray-50/50 hover:bg-white'}
      `}>
        {url ? (
          <>
            <img src={url} className="w-full h-full object-cover rounded-[2rem]" alt="preview" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <FaCloudUploadAlt className="text-white text-2xl" />
            </div>
          </>
        ) : (
          <div className="text-center p-4">
            {loading ? (
              <div className="w-8 h-8 border-4 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin mx-auto" />
            ) : (
              <>
                <FaCloudUploadAlt className={`mx-auto mb-2 text-gray-300 group-hover:text-[var(--color-primary)] transition-colors ${small ? 'text-xl' : 'text-3xl'}`} />
                {!small && <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Click to Upload</span>}
              </>
            )}
          </div>
        )}
        <input type="file" hidden accept="image/*" disabled={loading} onChange={(e) => onSelect(e.target.files[0])} />
      </label>

      {url && !loading && (
        <div className="absolute -top-2 -right-2 bg-green-500 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-bounce">
          <FaCheckCircle size={10} />
        </div>
      )}
    </div>
  );
}