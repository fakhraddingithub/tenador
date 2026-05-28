'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ProductCard } from '@/components/admin';
import { showToast } from '@/lib/toast';
import { confirmDelete, showError } from '@/lib/swal';
import { FiPlus, FiBox, FiSearch } from 'react-icons/fi';

export default function AdminProducts() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/product');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const text = await res.text();
      if (!text) { setProducts([]); return; }
      const data = JSON.parse(text);
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      showToast.error('خطا در بارگذاری محصولات');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

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

  const filtered = products.filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase())
  );

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
              onChange={(e) => setSearch(e.target.value)}
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
          <span className="font-bold text-gray-900">{products.length}</span>
        </div>
        {search && (
          <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-[var(--radius)] border border-orange-100 text-sm">
            <span className="font-bold text-gray-500">نتایج جستجو:</span>
            <span className="font-bold" style={{ color: 'var(--color-primary)' }}>{filtered.length}</span>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <div className="w-10 h-10 border-2 border-gray-200 border-t-[var(--color-primary)] rounded-full animate-spin" />
          <span className="text-sm font-bold text-gray-400">در حال بارگذاری...</span>
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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
      )}
    </div>
  );
}