'use client';

import { useState, useEffect } from 'react';
import { FiImage, FiUploadCloud, FiLoader, FiTrash2, FiSave } from 'react-icons/fi';
import { showToast } from '@/lib/toast';
import { showError } from '@/lib/swal';

const SETTING_KEY = 'secondhand_header_image';

/**
 * بخش آپلود تصویر هدر صفحه‌ی /second-hand در پنل ادمین.
 * تصویر در SiteSetting با کلید secondhand_header_image ذخیره می‌شود
 * و در فرانت‌اند به‌عنوان هدر صفحه استفاده می‌شود.
 */
export default function SecondHandHeaderUploader() {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/site-settings?key=${SETTING_KEY}`)
      .then(r => r.json())
      .then(d => setImage(d.value || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'second-hand');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setImage(d.url);
      setDirty(true);
    } catch {
      showToast.error('خطا در آپلود تصویر');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = () => {
    setImage(null);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: SETTING_KEY, value: image }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setDirty(false);
      showToast.success('تصویر هدر ذخیره شد');
    } catch (err) {
      showError('خطا', err.message || 'خطای ارتباط با سرور');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-neutral-100 rounded-[var(--radius)] shadow-sm overflow-hidden">
      <div className="h-1 w-full bg-[var(--color-primary)]" />
      <div className="p-7 space-y-5">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-orange-50 rounded-[var(--radius)]">
            <FiImage size={22} className="text-[var(--color-primary)]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-800">تصویر هدر صفحه دست‌دوم</h2>
            <p className="text-sm text-neutral-400 leading-relaxed mt-0.5">
              این تصویر به‌عنوان هدر بالای صفحه‌ی <span className="font-mono text-xs">/second-hand</span> نمایش داده می‌شود
            </p>
          </div>
        </div>

        {/* پیش‌نمایش */}
        <div className="relative w-full h-44 rounded-[var(--radius)] overflow-hidden border border-neutral-200 bg-neutral-50">
          {loading ? (
            <div className="w-full h-full animate-pulse bg-neutral-100" />
          ) : image ? (
            <>
              <img src={image} alt="هدر دست‌دوم" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/90 backdrop-blur text-red-500 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-red-50 transition-all"
              >
                <FiTrash2 size={13} /> حذف
              </button>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-neutral-300">
              <FiImage size={32} />
              <span className="text-xs mt-2 font-bold">تصویری انتخاب نشده</span>
            </div>
          )}
        </div>

        {/* اکشن‌ها */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer bg-neutral-800 text-white px-5 py-2.5 rounded-[var(--radius)] text-sm font-bold hover:bg-neutral-700 transition-all">
            {uploading ? <FiLoader className="animate-spin" size={15} /> : <FiUploadCloud size={15} />}
            {uploading ? 'در حال آپلود...' : 'انتخاب تصویر'}
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-2 bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-[var(--radius)] text-sm font-bold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FiSave size={15} />
            {saving ? 'در حال ذخیره...' : 'ذخیره تصویر هدر'}
          </button>
        </div>
      </div>
    </div>
  );
}
