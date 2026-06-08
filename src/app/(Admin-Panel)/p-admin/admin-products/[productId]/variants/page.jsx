'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '@/components/admin/Layout';
import DataTable from '@/components/admin/DataTable';
import Button from '@/components/admin/Button';
import { showToast } from '@/lib/toast';
import { confirmDelete, showError } from '@/lib/swal';

export default function ProductVariants() {
  const router = useRouter();
  const params = useParams();
  const productId = params.productId;
  const [variants, setVariants] = useState([]);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [productId]);

  const fetchData = async () => {
    try {
      const [variantsRes, productRes] = await Promise.all([
        fetch(`/api/product/${productId}/variants`),
        fetch(`/api/product/${productId}`),
      ]);

      const [variantsData, productData] = await Promise.all([
        variantsRes.json(),
        productRes.json(),
      ]);

      setVariants(variantsData.variants || []);
      setProduct(productData.product);
    } catch (error) {
      console.error('Error fetching data:', error);
      showToast.error('خطا در بارگذاری واریانت‌ها');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (variant) => {
    const confirmed = await confirmDelete(
      'حذف واریانت',
      `آیا مطمئن هستید که می‌خواهید واریانت "${variant.sku}" را حذف کنید؟`
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/variants/${variant._id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        showToast.success('واریانت با موفقیت حذف شد');
        fetchData();
      } else {
        const data = await res.json();
        showError('خطا', data.error || 'خطا در حذف واریانت');
      }
    } catch (error) {
      console.error('Error deleting variant:', error);
      showError('خطا', 'خطا در حذف واریانت');
    }
  };

  const columns = [
    {
      header: 'SKU',
      accessor: 'sku',
    },
    {
      header: 'قیمت',
      accessor: 'price',
      render: (value) => `${(value || 0).toLocaleString('fa-IR')} تومان`,
    },
    {
      header: 'ویژگی‌ها',
      accessor: 'attributes',
      render: (value) => {
        if (!value || typeof value !== 'object') return '-';
        const attrs = Object.entries(value).map(([key, val]) => `${key}: ${val}`);
        return attrs.join(', ') || '-';
      },
    },
  ];

  return (
    <AdminLayout title={`واریانت‌های ${product?.name || 'محصول'}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/p-admin/admin-products')}
            >
              ← بازگشت به لیست محصولات
            </Button>
            <h2 className="text-xl font-semibold text-gray-800 mt-4">
              واریانت‌های محصول: {product?.name || ''}
            </h2>
          </div>
          <Button onClick={() => router.push(`/p-admin/admin-products/${productId}/variants/add`)}>
            + افزودن واریانت جدید
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={variants}
          onDelete={handleDelete}
          loading={loading}
          emptyMessage="هیچ واریانتی ثبت نشده است"
        />
      </div>
    </AdminLayout>
  );
}