'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FiArrowRight, FiUploadCloud, FiLoader,
  FiSave, FiLink, FiType, FiLayers, FiImage,
} from 'react-icons/fi';
import Swal from 'sweetalert2';

const swalTheme = {
  confirmButtonColor: 'var(--color-primary)',
  customClass: {
    popup: 'rounded-2xl font-[Vazirmatn] text-right',
    confirmButton: 'rounded-xl font-bold',
  },
  rtl: true,
};

export default function SlideForm({ initialData = {}, mode = 'create', slideId }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(initialData.image || null);
  const [file, setFile] = useState(null);
  const [formData, setFormData] = useState({
    title: initialData.title || '',
    subtitle: initialData.subtitle || '',
    link: initialData.link || '',
    position: initialData.position || 'home',
    isActive: initialData.isActive !== false,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleImageChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      Swal.fire({ ...swalTheme, title: 'حجم فایل بیشتر از ۲ مگابایت است', icon: 'warning' });
      return;
    }
    setFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'create' && !file) {
      Swal.fire({ ...swalTheme, title: 'تصویر الزامی است', icon: 'warning' });
      return;
    }
    setLoading(true);
    try {
      let imageUrl = initialData.image || '';

      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder', 'slides');
        const upRes = await fetch('/api/upload', { method: 'POST', body: fd });
        const upData = await upRes.json();
        if (!upRes.ok) throw new Error(upData.error || 'خطا در آپلود');
        imageUrl = upData.url;
      }

      const endpoint = mode === 'edit' ? `/api/slides/${slideId}` : '/api/slides';
      const method = mode === 'edit' ? 'PUT' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, image: imageUrl }),
      });

      if (res.ok) {
        Swal.fire({
          ...swalTheme,
          title: mode === 'edit' ? 'تغییرات ذخیره شد' : 'اسلاید ایجاد شد',
          icon: 'success',
        });
        setTimeout(() => router.push('/p-admin/admin-home/slider'), 1200);
      } else {
        const d = await res.json();
        throw new Error(d.message || 'خطا در ثبت');
      }
    } catch (err) {
      Swal.fire({ ...swalTheme, title: err.message, icon: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-base font-bold text-gray-900">
          {mode === 'edit' ? 'ویرایش اسلاید' : 'اسلاید جدید'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-5">
        {/* Image upload */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border p-5"
          style={{ borderColor: '#e8e4df' }}
        >
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <FiImage size={12} style={{ color: 'var(--color-primary)' }} />
            تصویر اسلاید {mode === 'create' && <span className="text-red-400">*</span>}
          </p>
          <div
            className={`relative h-56 rounded-xl border-2 border-dashed overflow-hidden flex flex-col items-center justify-center transition-all cursor-pointer group ${
              imagePreview ? 'border-[var(--color-primary)]/30' : 'border-gray-200 hover:border-[var(--color-primary)]/40'
            }`}
          >
            {imagePreview ? (
              <>
                <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <label htmlFor="slide-img" className="cursor-pointer text-white font-bold text-sm flex items-center gap-2">
                    <FiUploadCloud size={18} /> تغییر تصویر
                  </label>
                </div>
              </>
            ) : (
              <label htmlFor="slide-img" className="flex flex-col items-center cursor-pointer text-gray-400 hover:text-[var(--color-primary)] transition-colors p-8">
                <FiUploadCloud size={38} className="mb-3" />
                <span className="text-sm font-bold">فایل را اینجا بکشید یا کلیک کنید</span>
                <span className="text-xs mt-1 text-gray-300">حداکثر ۲ مگابایت — WebP، JPG، PNG</span>
              </label>
            )}
            <input id="slide-img" type="file" className="hidden" onChange={handleImageChange} accept="image/*" />
          </div>
        </motion.div>

        {/* Text fields */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="bg-white rounded-2xl border p-5 space-y-4"
          style={{ borderColor: '#e8e4df' }}
        >
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">محتوای متنی</p>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 mb-1.5">
                <FiType size={11} style={{ color: 'var(--color-primary)' }} /> عنوان اصلی
              </label>
              <input
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="مثلاً: تخفیف‌های پایان فصل"
                className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-[var(--color-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 transition-all"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 mb-1.5">
                <FiLayers size={11} style={{ color: 'var(--color-primary)' }} /> زیرعنوان
              </label>
              <input
                name="subtitle"
                value={formData.subtitle}
                onChange={handleChange}
                placeholder="توضیح کوتاه..."
                className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-[var(--color-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 mb-1.5">
              <FiLink size={11} style={{ color: 'var(--color-primary)' }} /> لینک هدایت‌کننده
            </label>
            <input
              name="link"
              value={formData.link}
              onChange={handleChange}
              placeholder="https://tenador.com/..."
              dir="ltr"
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-left outline-none focus:border-[var(--color-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 transition-all"
            />
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex items-center justify-between bg-white rounded-2xl border p-4"
          style={{ borderColor: '#e8e4df' }}
        >
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-gray-200 rounded-full peer peer-checked:bg-[var(--color-primary)] transition-all after:content-[''] after:absolute after:top-0.5 after:right-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-all peer-checked:after:right-auto peer-checked:after:left-0.5" />
            </div>
            <span className="text-sm font-bold text-gray-700">نمایش در سایت فعال باشد</span>
          </label>

          <div className="flex items-center gap-3">
            <Link
              href="/p-admin/admin-home/slider"
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-gray-600 transition-all"
            >
              انصراف
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:shadow-lg hover:shadow-[var(--color-primary)]/25 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              style={{ background: 'var(--color-primary)' }}
            >
              {loading ? <FiLoader className="animate-spin" size={14} /> : <FiSave size={14} />}
              {loading ? 'در حال پردازش...' : mode === 'edit' ? 'ذخیره تغییرات' : 'ثبت اسلاید'}
            </button>
          </div>
        </motion.div>
      </form>
    </div>
  );
}