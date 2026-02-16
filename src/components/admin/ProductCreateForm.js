'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/admin/Button';
import Input from '@/components/admin/Input';
import Textarea from '@/components/admin/Textarea';
import Select from '@/components/admin/Select';
import ImageUpload from '@/components/admin/ImageUpload';
import { showToast } from '@/lib/toast';
import { showError } from '@/lib/swal';

// ---------------------------
// Helpers
// ---------------------------
function normalizeInitialAttributes(attributes = {}, categoryAttributes = []) {
  const result = {};

  for (const attr of categoryAttributes) {
    const value = attributes[attr.name];

    if (attr.type === 'select') {
      // array -> string (for UI)
      result[attr.name] = Array.isArray(value) ? value.join(', ') : '';
    } else {
      result[attr.name] = value ?? '';
    }
  }

  return result;
}

export default function ProductCreateForm({ initialData = {} }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [sports, setSports] = useState([]);
  const [brands, setBrands] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [categories, setCategories] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    shortDescription: '',
    longDescription: '',
    suitableFor: '',
    basePrice: '',
    category: '',
    tag: '',
    mainImage: '',
    gallery: [],
    brand: '',
    serie: '',
    athlete: '',
    sport: '',
    attributes: {},
    technicalStats: {},
    label: 'none',
    ...initialData,
  });

  // ---------------------------
  // Fetch base data
  // ---------------------------
  useEffect(() => {
    fetchBaseData();
  }, []);

  useEffect(() => {
    if (formData.sport) fetchAthletes(formData.sport);
  }, [formData.sport]);

  async function fetchBaseData() {
    const [sportsRes, brandsRes, categoriesRes] = await Promise.all([
      fetch('/api/sports'),
      fetch('/api/brands'),
      fetch('/api/categories'),
    ]);

    const sportsData = await sportsRes.json();
    const brandsData = await brandsRes.json();
    const categoriesData = await categoriesRes.json();
    if (brandsData.series) {
      updateField('serie', brandsData.series);
    }
    setSports(sportsData.sports || []);
    setBrands(brandsData.brands || []);
    setCategories(categoriesData.categories || []);
  }

  async function fetchAthletes(sportId) {
    const res = await fetch('/api/athletes');
    const data = await res.json();
    setAthletes(
      (data.athletes || []).filter(
        a => a.sport?._id === sportId || a.sport === sportId
      )
    );
  }

  // ---------------------------
  // Category attributes
  // ---------------------------
  const selectedCategory = categories.find(c => c._id === formData.category);
  const categoryAttributes = selectedCategory?.attributes || [];
  const categoryTechnicalStats = selectedCategory?.technicalStats || [];

  // normalize AI attributes when category loads
  useEffect(() => {
    if (!selectedCategory || !initialData.attributes) return;

    setFormData(prev => ({
      ...prev,
      attributes: normalizeInitialAttributes(
        initialData.attributes,
        selectedCategory.attributes
      ),
    }));
  }, [selectedCategory]);

  function updateField(key, value) {
    setFormData(prev => ({ ...prev, [key]: value }));
  }

  function updateAttribute(key, value) {
    setFormData(prev => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [key]: value,
      },
    }));
  }

  function updateTechnicalStat(key, value) {
    setFormData(prev => ({
      ...prev,
      technicalStats: {
        ...prev.technicalStats,
        [key]: value, // مقدار در Input استرینگ است، موقع سابمیت عدد می‌شود
      },
    }));
  }

  // ---------------------------
  // Submit
  // ---------------------------
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedAttributes = {};

      for (const attr of categoryAttributes) {
        const rawValue = formData.attributes?.[attr.name];
        if (!rawValue) continue;

        if (attr.type === 'select') {
          normalizedAttributes[attr.name] = rawValue
            .split(',')
            .map(v => v.trim())
            .filter(Boolean);
        } else if (attr.type === 'number') {
          normalizedAttributes[attr.name] = Number(rawValue);
        } else {
          normalizedAttributes[attr.name] = rawValue;
        }
      }

      const normalizedStats = {};
      for (const stat of categoryTechnicalStats) {
        const val = formData.technicalStats?.[stat.name];
        if (val !== undefined && val !== '') {
          normalizedStats[stat.name] = Number(val);
        }
      }

      const payload = {
        ...formData,
        attributes: normalizedAttributes,
        technicalStats: normalizedStats,
        basePrice: Number(formData.basePrice) || 0,
        tag: formData.tag || [],
        athlete: formData.athlete || null,
        label: formData.label,
      };

      const res = await fetch('/api/product/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast.success('محصول ساخته شد');
      router.push(
        `/p-admin/admin-categories/category-products/${selectedCategory._id}`
      );
    } catch (err) {
      showError('خطا', err.message || 'خطا در ایجاد محصول');
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------
  // Render
  // ---------------------------
  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 bg-white p-8 rounded-lg shadow"
    >
      <div className="grid md:grid-cols-2 gap-6">
        <Input
          label="نام محصول"
          value={formData.name}
          onChange={e => updateField('name', e.target.value)}
        />
      </div>

      <Textarea
        label="توضیح کوتاه"
        rows={3}
        value={formData.shortDescription}
        onChange={e => updateField('shortDescription', e.target.value)}
      />
      <Textarea
        label="توضیح کامل"
        rows={6}
        value={formData.longDescription}
        onChange={e => updateField('longDescription', e.target.value)}
      />

      <div className="grid md:grid-cols-3 gap-6">
        <Select
          label="برند"
          value={formData.brand}
          onChange={e => updateField('brand', e.target.value)}
          options={brands.map(b => ({ value: b._id, label: b.name }))}
        />
        {formData.brand && (
          <Select
            label="سری (Series)"
            value={formData.serie}
            onChange={e => updateField('serie', e.target.value)}
            options={
              brands
                .find(b => b._id === formData.brand) // پیدا کردن برند انتخاب شده
                ?.series?.map(s => ({ value: s._id, label: s.name })) || [] // نقشه زدن روی سری‌های آن برند
            }
          />
        )}

        <Select
          label="ورزش"
          value={formData.sport}
          onChange={e => updateField('sport', e.target.value)}
          options={sports.map(s => ({ value: s._id, label: s.name }))}
        />

        <Select
          label="ورزشکار"
          value={formData.athlete}
          onChange={e => updateField('athlete', e.target.value)}
          options={athletes.map(a => ({ value: a._id, label: a.name }))}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Select
          label="دسته‌بندی"
          value={formData.category}
          onChange={e => updateField('category', e.target.value)}
          options={categories.map(c => ({
            value: c._id,
            label: c.title,
          }))}
        />

        <Input
          label="قیمت پایه"
          type="number"
          value={formData.basePrice}
          onChange={e => updateField('basePrice', e.target.value)}
        />

        <Select
          label="برچسب محصول (Label)"
          value={formData.label}
          onChange={e => updateField('label', e.target.value)}
          options={[
            { value: 'none', label: 'بدون برچسب' },
            { value: 'new', label: 'جدید' },
            { value: 'hot', label: 'پرطرفدار' },
            { value: 'discount', label: 'تخفیف ویژه' },
            { value: 'limited', label: 'تعداد محدود' },
          ]}
        />
      </div>

      {/* ATTRIBUTES */}
      {categoryAttributes.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="font-bold mb-4">ویژگی‌ها</h3>

          <table className="w-full border rounded-lg">
            <tbody>
              {categoryAttributes.map(attr => (
                <tr key={attr.name} className="border-b">
                  <td className="p-3 font-medium bg-gray-50 whitespace-nowrap">
                    {attr.label}
                    {attr.required && (
                      <span className="text-red-500 mr-1">*</span>
                    )}
                  </td>
                  <td className="p-3">
                    <Input
                      type={attr.type === 'number' ? 'number' : 'text'}
                      value={formData.attributes?.[attr.name] || ''}
                      onChange={e =>
                        updateAttribute(attr.name, e.target.value)
                      }
                      placeholder={
                        attr.type === 'select'
                          ? 'مثال: L2, L3, L4'
                          : `مقدار ${attr.label}`
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TECHNICAL STATS (RADAR CHART) */}
      {categoryTechnicalStats.length > 0 && (
        <div className="border-t pt-6 bg-blue-50/30 p-4 rounded-lg">
          <h3 className="font-bold mb-4 text-blue-800">شاخص‌های فنی (نمودار رادار)</h3>
          <p className="text-xs text-gray-500 mb-4">نمره‌ای بین 0 تا 100 وارد کنید.</p>

          <div className="grid md:grid-cols-2 gap-4">
            {categoryTechnicalStats.map(stat => (
              <div key={stat.name} className="flex items-center space-x-reverse space-x-3 bg-white p-2 border rounded shadow-sm">
                <label className="w-1/2 text-sm font-medium text-gray-700">
                  {stat.label}
                </label>
                <div className="w-1/2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0-100"
                    value={formData.technicalStats?.[stat.name] || ''}
                    onChange={e => updateTechnicalStat(stat.name, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Input
        label="مناسب برای"
        value={formData.suitableFor}
        onChange={e => updateField('suitableFor', e.target.value)}
      />

      <Input
        label="تگ‌ها"
        value={formData.tag}
        onChange={e => updateField('tag', e.target.value)}
      />

      <ImageUpload
        label="تصویر اصلی"
        value={formData.mainImage}
        onChange={v => updateField('mainImage', v)}
        folder="product"
      />

      <ImageUpload
        label="گالری"
        multiple
        value={formData.gallery}
        onChange={v => updateField('gallery', v)}
        folder="product"
      />

      <Button type="submit" loading={loading}>
        ایجاد محصول
      </Button>
    </form>
  );
}
