'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '@/components/admin/Layout';
import AdminLoader from '@/components/admin/AdminLoader';
import Button from '@/components/admin/Button';
import Input from '@/components/admin/Input';
import ImageUpload from '@/components/admin/ImageUpload';
import { showToast } from '@/lib/toast';
import { showError } from '@/lib/swal';

export default function AddVariant() {
  const router = useRouter();
  const params = useParams();
  const productId = params.productId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState(null);
  const [category, setCategory] = useState(null);
  const [formData, setFormData] = useState({
    sku: '',
    price: '',
    images: [],
    attributes: {},
  });

  useEffect(() => {
    fetchProduct();
  }, [productId]);

  const fetchProduct = async () => {
    try {
      const res = await fetch(`/api/product/${productId}`);
      const data = await res.json();
      if (res.ok && data.product) {
        setProduct(data.product);
        
        // Fetch category details
        if (data.product.category) {
          const catRes = await fetch(`/api/categories/${data.product.category._id || data.product.category}`);
          const catData = await catRes.json();
          if (catRes.ok) {
            setCategory(catData.category);
            // Initialize attributes based on category
            const initialAttributes = {};
            catData.category.attributes?.forEach(attr => {
              if (attr.required) {
                initialAttributes[attr.name] = '';
              }
            });
            setFormData(prev => ({ ...prev, attributes: initialAttributes }));
          }
        }
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      showError('خطا', 'خطا در بارگذاری محصول');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        sku: formData.sku,
        price: parseFloat(formData.price) || 0,
        images: formData.images || [],
        attributes: formData.attributes,
      };

      const res = await fetch(`/api/product/${productId}/variants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        showToast.success('واریانت با موفقیت ایجاد شد');
        router.push(`/p-admin/admin-products/${productId}/variants`);
      } else {
        showError('خطا', data.error || 'خطا در ایجاد واریانت');
      }
    } catch (error) {
      console.error('Error:', error);
      showError('خطا', 'خطا در ایجاد واریانت');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="افزودن واریانت">
        <AdminLoader />
      </AdminLayout>
    );
  }

  const categoryAttributes = category?.attributes || [];

  return (
    <AdminLayout title={`افزودن واریانت - ${product?.name || ''}`}>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">محصول:</span> {product?.name}
            </p>
            <p className="text-sm text-gray-700 mt-1">
              <span className="font-semibold">دسته‌بندی:</span> {category?.title || '-'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Input
                label="SKU"
                name="sku"
                value={formData.sku}
                onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                required
                placeholder="مثال: PROD-001"
              />
              <Input
                label="قیمت (یورو)"
                name="price"
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                required
              />
            </div>

            {categoryAttributes.length > 0 && (
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">ویژگی‌های واریانت</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {categoryAttributes.map((attr) => (
                    <div key={attr.name}>
                      {attr.type === 'select' && attr.options ? (
                        <select
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-gray-900"
                          value={formData.attributes[attr.name] || ''}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              attributes: {
                                ...prev.attributes,
                                [attr.name]: e.target.value,
                              },
                            }))
                          }
                          required={attr.required}
                        >
                          <option value="">انتخاب {attr.label}</option>
                          {attr.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          label={attr.label}
                          name={attr.name}
                          type={attr.type === 'number' ? 'number' : 'text'}
                          value={formData.attributes[attr.name] || ''}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              attributes: {
                                ...prev.attributes,
                                [attr.name]: e.target.value,
                              },
                            }))
                          }
                          required={attr.required}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ImageUpload
              label="تصاویر واریانت"
              value={formData.images}
              onChange={(value) => setFormData((prev) => ({ ...prev, images: value }))}
              folder="products/variants"
              multiple
            />

            <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
              <Button type="submit" loading={saving}>
                ذخیره
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(`/p-admin/admin-products/${productId}/variants`)}
              >
                انصراف
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}