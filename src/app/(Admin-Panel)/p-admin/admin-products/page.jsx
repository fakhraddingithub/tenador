'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ProductCard } from '@/components/admin';
import AdminLoader from '@/components/admin/AdminLoader';
import { showToast } from '@/lib/toast';
import { confirmDelete, showError } from '@/lib/swal';
import { FiPlus, FiBox, FiSearch } from 'react-icons/fi';

export default function AdminProducts() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  const fetchProducts = useCallback(async (signal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        isAdmin: 'true',
        page: String(page),
        limit: '25',
      });
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/product?${params}`, { signal });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const text = await res.text();
      if (!text) { setProducts([]); return; }
      const data = JSON.parse(text);
      setProducts(data.products || []);
      setPagination(data.pagination || { page: 1, total: 0, totalPages: 1 });
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('Error fetching products:', error);
      showToast.error('خطا در بارگذاری محصولات');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => fetchProducts(controller.signal), 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [fetchProducts]);

  const handleDelete = async (product) => {
    const confirmed = await confirmDelete('حذف محصول', `آیا مطمئن هستید که می‌خواهید "${product.name}" را حذف کنید؟`);
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/product/${product._id}`, { method: 'DELETE' });
      if (res.ok) { showToast.success('محصول با موفقیت حذف شد'); fetchProducts(); }
      else { const data = await res.json(); showError('خطا', data.error || 'خطا در حذف'); }
    } catch { showError('خطا', 'خطا در حذف محصول'); }
  };

  const handleEdit = (product) => router.push(`/p-admin/admin-products/edit/${product._id}`);
  const handleViewVariants = (product) => router.push(`/p-admin/admin-products/${product._id}/variants`);

  const filtered = products;

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
            style={{ background: '#0d0d0d' }}
          >
            <FiBox size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-0.5" style={{ color: 'var(--color-primary)' }}>
              مدیریت انبار
            </p>
            <h1 className="text-xl font-bold text-gray-900">لیست محصولات</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden md:block">
            <FiSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="جستجو در انبار..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pr-9 pl-4 py-2.5 text-sm font-bold bg-white border-2 border-gray-200 rounded-[var(--radius)] w-56 focus:outline-none focus:border-[var(--color-primary)] transition-all"
            />
          </div>
          <button
            onClick={() => router.push('/p-admin/admin-products/add')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold text-white hover:shadow-lg hover:shadow-[var(--color-primary)]/25 hover:-translate-y-0.5 active:scale-95 transition-all"
            style={{ background: 'var(--color-primary)' }}
          >
            <FiPlus size={16} /> افزودن محصول
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-[var(--radius)] border border-gray-100 text-sm">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="font-bold text-gray-500">کل محصولات:</span>
          <span className="font-bold text-gray-900">{pagination.total}</span>
        </div>
        {search && (
          <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-[var(--radius)] border border-orange-100 text-sm">
            <span className="font-bold text-gray-500">نتایج جستجو:</span>
            <span className="font-bold" style={{ color: 'var(--color-primary)' }}>{pagination.total}</span>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <AdminLoader />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300">
            <FiBox size={28} />
          </div>
          <h3 className="text-base font-bold text-gray-700 mb-1">
            {search ? 'محصولی یافت نشد' : 'انبار خالی است'}
          </h3>
          <p className="text-sm text-gray-400 font-bold mb-5">
            {search ? 'عبارت جستجو را تغییر دهید' : 'هنوز هیچ محصولی اضافه نشده'}
          </p>
          {!search && (
            <button
              onClick={() => router.push('/p-admin/admin-products/add')}
              className="text-sm font-bold px-5 py-2.5 rounded-[var(--radius)] text-white transition-all"
              style={{ background: 'var(--color-primary)' }}
            >
              افزودن اولین محصول
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            {filtered.map((product, index) => (
            <motion.div
              key={product._id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.3 }}
              className="hover:-translate-y-1 transition-transform duration-300"
            >
              <ProductCard
                product={product}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onViewVariants={handleViewVariants}
              />
            </motion.div>
            ))}
          </div>
          {pagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="px-4 py-2 rounded-[var(--radius)] border border-gray-200 bg-white text-sm font-bold disabled:opacity-40"
              >
                قبلی
              </button>
              <span className="text-sm font-bold text-gray-600">
                صفحه {pagination.page.toLocaleString('fa-IR')} از {pagination.totalPages.toLocaleString('fa-IR')}
              </span>
              <button
                type="button"
                disabled={page >= pagination.totalPages || loading}
                onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
                className="px-4 py-2 rounded-[var(--radius)] border border-gray-200 bg-white text-sm font-bold disabled:opacity-40"
              >
                بعدی
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
