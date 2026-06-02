'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FiPlus, FiX, FiSave, FiUploadCloud, FiLoader, FiCheck } from 'react-icons/fi';
import { showToast } from '@/lib/toast';
import { showError } from '@/lib/swal';
import StarRating from './StarRating';

function calcScore(healthScores, customFields) {
  const all = [...healthScores, ...customFields];
  if (all.length === 0) return null;
  const avg = all.reduce((s, i) => s + i.rating, 0) / all.length;
  return Math.round(((avg - 1) / 4) * 9 + 1);
}

// نمایش خلاصه attributes یه واریانت
function formatVariantAttrs(attributes) {
  if (!attributes) return '—';
  const entries = Object.entries(attributes);
  return entries.map(([k, v]) => `${k}: ${v}`).join(' / ');
}

export default function UsedProductForm({ initialData }) {
  const router = useRouter();
  const isEdit = !!initialData?._id;

  const [loading, setLoading] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState(null);

  // Product search
  const [productQuery, setProductQuery] = useState(initialData?.baseProduct?.name || '');
  const [productResults, setProductResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(initialData?.baseProduct || null);

  // Variant
  const [variants, setVariants] = useState([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(initialData?.baseVariant || null);

  // Name
  const [name, setName] = useState(initialData?.name || '');

  // HealthCard template
  const [template, setTemplate] = useState(null);
  const [templateLoading, setTemplateLoading] = useState(false);

  // Scores
  const [healthScores, setHealthScores] = useState(initialData?.healthScores || []);
  const [customFields, setCustomFields] = useState(
    initialData?.customFields?.map(f => ({ ...f, _id: crypto.randomUUID() })) || []
  );
  const [newCustom, setNewCustom] = useState({ label: '', rating: 3, note: '' });

  // Other fields
  const [price, setPrice] = useState(initialData?.price || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [images, setImages] = useState(initialData?.images || []);
  const [status, setStatus] = useState(initialData?.status || 'available');

  const overallScore = useMemo(() => calcScore(healthScores, customFields), [healthScores, customFields]);

  // Product search debounce
  useEffect(() => {
    if (!productQuery || productQuery.length < 2 || selectedProduct) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/compare/search?q=${encodeURIComponent(productQuery)}`);
        const d = await res.json();
        setProductResults(d.products || []);
      } catch {}
    }, 350);
    return () => clearTimeout(t);
  }, [productQuery, selectedProduct]);

  // Fetch variants when product selected
  useEffect(() => {
    if (!selectedProduct?._id) return;
    setVariantsLoading(true);
    setVariants([]);
    // اگه isEdit نباشه، واریانت قبلی رو پاک کن
    if (!isEdit) setSelectedVariant(null);

    fetch(`/api/admin/variants?productId=${selectedProduct._id}`)
      .then(r => r.json())
      .then(d => setVariants(d.variants || []))
      .catch(() => setVariants([]))
      .finally(() => setVariantsLoading(false));
  }, [selectedProduct?._id]);

  // Fetch HealthCard template when product selected
  useEffect(() => {
    if (!selectedProduct?.category?._id && !selectedProduct?.category) return;
    const catId = selectedProduct.category?._id || selectedProduct.category;

    setTemplateLoading(true);
    fetch(`/api/admin/healthcards?category=${catId}`)
      .then(r => r.json())
      .then(d => {
        const card = d.cards?.find(c => (c.category?._id || c.category) === catId);
        setTemplate(card || null);
        if (card && !isEdit) {
          setHealthScores(card.fields.map(f => ({ key: f.key, rating: 3, note: '' })));
        }
      })
      .catch(() => setTemplate(null))
      .finally(() => setTemplateLoading(false));
  }, [selectedProduct]);

  const selectProduct = (product) => {
    setSelectedProduct(product);
    setProductQuery(product.name);
    setName(product.name);
    setProductResults([]);
    setHealthScores([]);
    setTemplate(null);
    setSelectedVariant(null);
  };

  const clearProduct = () => {
    setSelectedProduct(null);
    setProductQuery('');
    setName('');
    setHealthScores([]);
    setTemplate(null);
    setVariants([]);
    setSelectedVariant(null);
  };

  const updateHealthScore = (key, field, value) => {
    setHealthScores(prev => prev.map(s => s.key === key ? { ...s, [field]: value } : s));
  };

  const addCustomField = () => {
    if (!newCustom.label.trim()) return showToast.warning('برچسب الزامی است');
    setCustomFields(prev => [...prev, { ...newCustom, _id: crypto.randomUUID() }]);
    setNewCustom({ label: '', rating: 3, note: '' });
  };

  const removeCustomField = (id) => {
    setCustomFields(prev => prev.filter(f => f._id !== id));
  };

  const uploadImage = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'used-products');
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error);
    return d.url;
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    for (let i = 0; i < files.length; i++) {
      setUploadingIdx(i);
      try {
        const url = await uploadImage(files[i]);
        setImages(prev => [...prev, url]);
      } catch {
        showToast.error('خطا در آپلود تصویر');
      }
    }
    setUploadingIdx(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return showToast.warning('محصول را انتخاب کنید');
    if (!name.trim()) return showToast.warning('نام محصول الزامی است');
    if (!price || Number(price) < 0) return showToast.warning('قیمت معتبر وارد کنید');

    setLoading(true);

    const payload = {
      baseProduct: selectedProduct._id,
      baseVariant: selectedVariant?._id || null,
      name,
      healthScores,
      customFields: customFields.map(({ _id, ...f }) => f),
      price: Number(price),
      description,
      images,
      status,
    };

    const url = isEdit ? `/api/admin/used-products/${initialData._id}` : '/api/admin/used-products';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        showToast.success(isEdit ? 'بروزرسانی شد' : 'ثبت شد');
        router.push('/p-admin/admin-secondHands/used-products');
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
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-10 space-y-10">
      <h1 className="text-2xl font-bold">{isEdit ? 'ویرایش محصول دست‌دوم' : 'ثبت محصول دست‌دوم'}</h1>

      {/* ─── Product Selector ─── */}
      <section className="space-y-3">
        <label className="text-sm font-bold text-neutral-600">محصول پایه</label>
        {selectedProduct ? (
          <div className="flex items-center gap-3 bg-white border border-neutral-200 rounded-[var(--radius)] px-4 py-3">
            {selectedProduct.mainImage && (
              <img src={selectedProduct.mainImage} alt="" className="w-12 h-12 rounded-lg object-cover" />
            )}
            <div className="flex-grow">
              <p className="font-bold text-sm">{selectedProduct.name}</p>
              <p className="text-xs text-neutral-400">{selectedProduct.category?.title}</p>
            </div>
            {!isEdit && (
              <button type="button" onClick={clearProduct} className="text-neutral-400 hover:text-red-500 transition-colors">
                <FiX size={18} />
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            <input
              value={productQuery}
              onChange={e => setProductQuery(e.target.value)}
              placeholder="نام محصول را جستجو کنید..."
              className="w-full bg-neutral-50 border border-neutral-200 rounded-[var(--radius)] px-4 py-3 text-sm outline-none focus:ring-2 ring-[var(--color-primary)]/20"
            />
            {productResults.length > 0 && (
              <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-neutral-200 rounded-[var(--radius)] shadow-xl z-20 max-h-60 overflow-y-auto">
                {productResults.map(p => (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => selectProduct(p)}
                    className="flex items-center gap-3 w-full px-4 py-3 hover:bg-neutral-50 text-right transition-colors"
                  >
                    {p.mainImage && <img src={p.mainImage} alt="" className="w-10 h-10 rounded object-cover" />}
                    <div>
                      <p className="text-sm font-bold">{p.name}</p>
                      <p className="text-xs text-neutral-400">{p.category?.title}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ─── Variant Selector ─── */}
      {selectedProduct && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-neutral-600">واریانت</label>
            {selectedVariant && (
              <button
                type="button"
                onClick={() => setSelectedVariant(null)}
                className="text-xs text-neutral-400 hover:text-red-500 transition-colors flex items-center gap-1"
              >
                <FiX size={13} /> حذف انتخاب
              </button>
            )}
          </div>

          {variantsLoading ? (
            <div className="text-center py-4 text-neutral-400 text-sm">
              <FiLoader className="animate-spin inline ml-2" />
              در حال بارگذاری واریانت‌ها...
            </div>
          ) : variants.length === 0 ? (
            <p className="text-sm text-neutral-400 bg-neutral-50 px-4 py-3 rounded-[var(--radius)] border border-neutral-100">
              این محصول واریانتی ندارد.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {variants.map(v => {
                const isSelected = selectedVariant?._id === v._id;
                // attributes ممکنه Object یا Map باشه — هر دو رو هندل می‌کنیم
                const attrs = v.attributes instanceof Map
                  ? Object.fromEntries(v.attributes)
                  : v.attributes || {};

                return (
                  <button
                    key={v._id}
                    type="button"
                    onClick={() => setSelectedVariant(isSelected ? null : v)}
                    className={`flex items-center justify-between px-4 py-3 rounded-[var(--radius)] border text-right transition-all text-sm ${
                      isSelected
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
                        : 'border-neutral-200 bg-white hover:border-neutral-300'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <p className="font-bold text-xs text-neutral-400 font-mono">{v.sku}</p>
                      <p className="text-sm">{formatVariantAttrs(attrs)}</p>
                      <p className="text-xs text-neutral-400">
                        موجودی: {v.stock} · قیمت پایه: {v.price?.toLocaleString('fa-IR')} ت
                      </p>
                    </div>
                    {isSelected && <FiCheck size={16} className="shrink-0 mr-2" />}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ─── Editable Name Field ─── */}
      {selectedProduct && (
        <section className="space-y-2">
          <label className="text-sm font-bold text-neutral-600">نام نمایشی محصول</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="نامی که کاربر می‌بیند..."
            className="w-full bg-neutral-50 border border-neutral-200 rounded-[var(--radius)] px-4 py-3 text-sm outline-none focus:ring-2 ring-[var(--color-primary)]/20"
          />
        </section>
      )}

      {/* ─── HealthCard Scores ─── */}
      {selectedProduct && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-neutral-600">ارزیابی وضعیت (کارت سلامت)</label>
            {overallScore != null && (
              <span className="text-sm font-bold bg-orange-50 text-orange-600 px-3 py-1 rounded-full">
                امتیاز کل: {overallScore}/10
              </span>
            )}
          </div>

          {templateLoading ? (
            <div className="text-center py-6 text-neutral-400 text-sm">
              <FiLoader className="animate-spin inline ml-2" />
              در حال بارگذاری قالب...
            </div>
          ) : template?.fields?.length > 0 ? (
            <div className="space-y-3">
              {template.fields.map(field => {
                const score = healthScores.find(s => s.key === field.key);
                return (
                  <div key={field.key} className="bg-white border border-neutral-200 rounded-[var(--radius)] px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm">{field.label}</span>
                      <StarRating
                        value={score?.rating || 0}
                        onChange={v => updateHealthScore(field.key, 'rating', v)}
                      />
                    </div>
                    <input
                      placeholder="یادداشت (اختیاری)"
                      value={score?.note || ''}
                      onChange={e => updateHealthScore(field.key, 'note', e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-100 rounded-lg px-3 py-2 text-xs outline-none"
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-neutral-400 bg-neutral-50 px-4 py-3 rounded-[var(--radius)] border border-neutral-100">
              این دسته‌بندی HealthCard ندارد. فقط فیلدهای سفارشی قابل تعریف‌اند.
            </div>
          )}
        </section>
      )}

      {/* ─── Custom Fields ─── */}
      <section className="space-y-3">
        <label className="text-sm font-bold text-neutral-600">فیلدهای سفارشی</label>

        {customFields.map(field => (
          <div key={field._id} className="bg-white border border-neutral-200 rounded-[var(--radius)] px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm">{field.label}</span>
              <div className="flex items-center gap-3">
                <StarRating
                  value={field.rating}
                  onChange={v => setCustomFields(prev => prev.map(f => f._id === field._id ? { ...f, rating: v } : f))}
                />
                <button type="button" onClick={() => removeCustomField(field._id)} className="text-red-400 hover:text-red-600 transition-colors">
                  <FiX size={16} />
                </button>
              </div>
            </div>
            <input
              placeholder="یادداشت (اختیاری)"
              value={field.note}
              onChange={e => setCustomFields(prev => prev.map(f => f._id === field._id ? { ...f, note: e.target.value } : f))}
              className="w-full bg-neutral-50 border border-neutral-100 rounded-lg px-3 py-2 text-xs outline-none"
            />
          </div>
        ))}

        <div className="flex gap-2 items-center">
          <input
            placeholder="نام فیلد سفارشی"
            value={newCustom.label}
            onChange={e => setNewCustom(p => ({ ...p, label: e.target.value }))}
            className="flex-grow bg-neutral-50 border border-neutral-200 rounded-[var(--radius)] px-3 py-2.5 text-sm outline-none focus:ring-2 ring-[var(--color-primary)]/20"
          />
          <StarRating value={newCustom.rating} onChange={v => setNewCustom(p => ({ ...p, rating: v }))} />
          <button
            type="button"
            onClick={addCustomField}
            className="bg-neutral-800 text-white px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold hover:bg-neutral-700 transition-all"
          >
            <FiPlus size={15} />
          </button>
        </div>
      </section>

      {/* ─── Price + Status ─── */}
      <section className="grid grid-cols-2 gap-5">
        <div className="space-y-2">
          <label className="text-sm font-bold text-neutral-600">قیمت</label>
          <input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="مثال: 2500000"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-[var(--radius)] px-4 py-3 text-sm outline-none focus:ring-2 ring-[var(--color-primary)]/20"
            dir="ltr"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-neutral-600">وضعیت</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-[var(--radius)] px-4 py-3 text-sm outline-none focus:ring-2 ring-[var(--color-primary)]/20"
          >
            <option value="available">موجود</option>
            <option value="sold">فروخته شده</option>
          </select>
        </div>
      </section>

      {/* ─── Description ─── */}
      <section className="space-y-2">
        <label className="text-sm font-bold text-neutral-600">توضیحات</label>
        <textarea
          rows={4}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="وضعیت کلی، نقص‌ها یا ویژگی‌های خاص را شرح دهید..."
          className="w-full bg-neutral-50 border border-neutral-200 rounded-[var(--radius)] px-4 py-3 text-sm outline-none focus:ring-2 ring-[var(--color-primary)]/20 resize-none"
        />
      </section>

      {/* ─── Images ─── */}
      <section className="space-y-3">
        <label className="text-sm font-bold text-neutral-600">تصاویر</label>
        <div className="flex flex-wrap gap-3">
          {images.map((url, idx) => (
            <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border border-neutral-200 group">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
              >
                <FiX size={18} />
              </button>
            </div>
          ))}

          <label className="w-24 h-24 rounded-lg border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--color-primary)]/50 transition-all text-neutral-400">
            {uploadingIdx !== null ? (
              <FiLoader className="animate-spin" size={20} />
            ) : (
              <>
                <FiUploadCloud size={20} />
                <span className="text-[10px] mt-1">آپلود</span>
              </>
            )}
            <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
        </div>
      </section>

      {/* ─── Submit ─── */}
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
          onClick={() => router.push('/p-admin/admin-secondHands/used-products')}
          className="px-6 py-3 rounded-[var(--radius)] border border-neutral-200 text-sm font-bold hover:bg-neutral-50 transition-all"
        >
          انصراف
        </button>
      </div>
    </form>
  );
}