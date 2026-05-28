'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { showToast } from '@/lib/toast';
import { confirmDelete, showError } from '@/lib/swal';
import {
  FaPlus, FaFolderOpen, FaTrash,
  FaBoxOpen, FaSearch, FaArrowRight, FaShapes
} from 'react-icons/fa';
import { FiEdit3, FiTrash2 } from 'react-icons/fi';

export default function AdminCategories() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchCategories(); fetchProducts(); }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data.categories || []);
    } catch { showToast.error('خطا در بارگذاری'); } finally { setLoading(false); }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/product');
      const data = await res.json();
      setProducts(data.products || []);
    } catch { console.error('products fetch error'); }
  };

  const getProductCount = (categoryId) => products.filter(p => p.category?._id === categoryId).length;

  const handleDelete = async (category) => {
    const confirmed = await confirmDelete('حذف دسته‌بندی', `آیا مطمئن هستید که می‌خواهید "${category.title}" را حذف کنید؟`);
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/categories/${category._id}`, { method: 'DELETE' });
      if (res.ok) { showToast.success('دسته‌بندی حذف شد'); fetchCategories(); fetchProducts(); }
      else { const data = await res.json(); showError('خطا', data.error || 'خطا در حذف'); }
    } catch { showError('خطا', 'خطا در ارتباط با سرور'); }
  };

  const filtered = categories.filter(c => c.title?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <Link href="/p-admin" className="inline-flex items-center gap-1.5 text-xs font-bold mb-2 hover:gap-2.5 transition-all" style={{ color: 'var(--color-primary)' }}>
            <FaArrowRight size={11} /> بازگشت
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FaShapes style={{ color: 'var(--color-secondary)' }} size={18} />
            مدیریت <span style={{ color: 'var(--color-primary)' }}>دسته‌ها</span>
          </h1>
          <p className="text-sm font-bold text-gray-400 mt-0.5">{categories.length} دسته‌بندی ثبت‌شده</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              type="text"
              placeholder="جستجوی دسته‌بندی..."
              className="pr-9 pl-4 py-2.5 text-sm font-bold bg-white border-2 border-gray-200 rounded-[var(--radius)] w-56 focus:outline-none focus:border-[var(--color-primary)] transition-all"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => router.push('/p-admin/admin-categories/add')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold text-white hover:shadow-lg hover:shadow-[var(--color-primary)]/25 hover:-translate-y-0.5 active:scale-95 transition-all"
            style={{ background: 'var(--color-primary)' }}
          >
            <FaPlus size={14} /> افزودن دسته
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 bg-white rounded-2xl animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-200">
            <FaFolderOpen size={28} />
          </div>
          <p className="text-gray-400 font-bold">هیچ دسته‌بندی‌ای یافت نشد</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((category, i) => {
            const count = getProductCount(category._id);
            return (
              <motion.div
                key={category._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                onClick={() => router.push(`/p-admin/admin-categories/category-products/${category._id}`)}
                className="group cursor-pointer bg-white rounded-2xl border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                style={{ borderColor: '#e8e4df' }}
              >
                {/* Image */}
                <div className="relative h-40 bg-gray-100 overflow-hidden">
                  {category.image ? (
                    <img
                      src={category.image}
                      alt={category.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-200">
                      <FaShapes size={36} />
                    </div>
                  )}
                  {/* Product count badge */}
                  <div className="absolute top-3 left-3">
                    <span
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold"
                      style={{
                        background: count > 0 ? 'rgba(170,71,37,0.9)' : 'rgba(0,0,0,0.5)',
                        color: 'white',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      <FaBoxOpen size={9} /> {count} محصول
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-[var(--radius)] overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0 flex items-center justify-center">
                      {category.icon ? (
                        <img src={category.icon} alt="icon" className="w-full h-full object-contain" />
                      ) : (
                        <FaFolderOpen size={14} style={{ color: 'var(--color-primary)' }} />
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-gray-800 group-hover:text-[var(--color-primary)] transition-colors truncate">
                      {category.title}
                    </h3>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-50">
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/p-admin/admin-categories/edit/${category._id}`); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[var(--radius)] bg-gray-50 text-gray-700 hover:bg-gray-900 hover:text-white font-bold text-xs transition-all"
                    >
                      <FiEdit3 size={13} /> ویرایش
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(category); }}
                      className="w-9 h-9 flex items-center justify-center rounded-[var(--radius)] bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-100"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}