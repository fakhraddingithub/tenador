'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiPlus, FiX, FiSave } from 'react-icons/fi';
import { showToast } from '@/lib/toast';
import { showError } from '@/lib/swal';

// props: initialData (for edit), onSubmit(payload) → Promise<{ok, error}>
export default function HealthCardForm({ initialData, categoryLocked }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(initialData?.category?._id || initialData?.category || '');
  const [fields, setFields] = useState(
    initialData?.fields || []
  );
  const [newField, setNewField] = useState({ key: '', label: '' });

  useEffect(() => {
    if (!categoryLocked) {
      fetch('/api/categories')
        .then(r => r.json())
        .then(d => setCategories(d.categories || []))
        .catch(() => {});
    }
  }, [categoryLocked]);

  const addField = () => {
    const key = newField.key.trim().toLowerCase().replace(/\s+/g, '_');
    const label = newField.label.trim();
    if (!key || !label) return showToast.warning('کلید و برچسب الزامی است');
    if (fields.find(f => f.key === key)) return showToast.warning('کلید تکراری است');
    setFields(prev => [...prev, { key, label }]);
    setNewField({ key: '', label: '' });
  };

  const removeField = (key) => {
    setFields(prev => prev.filter(f => f.key !== key));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!categoryId) return showToast.warning('دسته‌بندی را انتخاب کنید');
    setLoading(true);

    const payload = { category: categoryId, fields };
    const isEdit = !!initialData?._id;
    const url = isEdit ? `/api/admin/healthcards/${initialData._id}` : '/api/admin/healthcards';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { fields } : payload),
      });
      const data = await res.json();
      if (res.ok) {
        showToast.success(isEdit ? 'بروزرسانی شد' : 'ایجاد شد');
        router.push('/p-admin/admin-secondHands/healthcards');
      } else {
        showError('خطا', data.error);
      }
    } catch {
      showError('خطا', 'خطای ارتباط با سرور');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <h1 className="text-2xl font-bold">{initialData ? 'ویرایش HealthCard' : 'ایجاد HealthCard جدید'}</h1>

      {/* Category Select */}
      {!categoryLocked ? (
        <div className="space-y-2">
          <label className="text-sm font-bold text-neutral-600">دسته‌بندی</label>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-[var(--radius)] px-4 py-3 text-sm outline-none focus:ring-2 ring-[var(--color-primary)]/20"
          >
            <option value="">انتخاب دسته‌بندی</option>
            {categories.map(c => (
              <option key={c._id} value={c._id}>{c.title}</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="bg-neutral-50 border border-neutral-200 rounded-[var(--radius)] px-4 py-3 text-sm font-bold text-neutral-600">
          دسته‌بندی: {initialData?.category?.title}
        </div>
      )}

      {/* Fields List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-neutral-600">فیلدهای ارزیابی</label>
          <span className="text-xs text-neutral-400">{fields.length} فیلد</span>
        </div>

        {fields.length === 0 && (
          <div className="text-center py-6 border-2 border-dashed border-neutral-100 rounded-[var(--radius)] text-neutral-400 text-sm">
            فیلدی تعریف نشده
          </div>
        )}

        {fields.map((field) => (
          <div key={field.key} className="flex items-center gap-3 bg-white border border-neutral-200 rounded-[var(--radius)] px-4 py-3">
            <span className="font-mono text-xs bg-neutral-100 px-2 py-1 rounded text-neutral-500">{field.key}</span>
            <span className="flex-grow text-sm font-bold text-neutral-700">{field.label}</span>
            <button type="button" onClick={() => removeField(field.key)} className="text-red-400 hover:text-red-600 transition-colors">
              <FiX size={16} />
            </button>
          </div>
        ))}

        {/* Add new field */}
        <div className="flex gap-2 pt-2">
          <input
            placeholder="key (انگلیسی)"
            value={newField.key}
            onChange={e => setNewField(p => ({ ...p, key: e.target.value }))}
            className="flex-1 bg-neutral-50 border border-neutral-200 rounded-[var(--radius)] px-3 py-2.5 text-sm outline-none focus:ring-2 ring-[var(--color-primary)]/20 font-mono"
            dir="ltr"
          />
          <input
            placeholder="برچسب (فارسی)"
            value={newField.label}
            onChange={e => setNewField(p => ({ ...p, label: e.target.value }))}
            className="flex-1 bg-neutral-50 border border-neutral-200 rounded-[var(--radius)] px-3 py-2.5 text-sm outline-none focus:ring-2 ring-[var(--color-primary)]/20"
          />
          <button
            type="button"
            onClick={addField}
            className="flex items-center gap-1 bg-neutral-800 text-white px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold hover:bg-neutral-700 transition-all"
          >
            <FiPlus size={15} />
          </button>
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-3 pt-4 border-t border-neutral-100">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 bg-[var(--color-primary)] text-white px-8 py-3 rounded-[var(--radius)] font-bold hover:opacity-90 transition-all disabled:opacity-50"
        >
          <FiSave size={16} />
          {loading ? 'در حال ذخیره...' : 'ذخیره'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/healthcards')}
          className="px-6 py-3 rounded-[var(--radius)] border border-neutral-200 text-sm font-bold hover:bg-neutral-50 transition-all"
        >
          انصراف
        </button>
      </div>
    </form>
  );
}