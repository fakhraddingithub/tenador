'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  FaPlus, FaSearch, FaArrowRight, FaHandshake, FaEdit, FaTrash,
} from 'react-icons/fa';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import AdminLoader from '@/components/admin/AdminLoader';

export default function AdminCollaborations() {
  const router = useRouter();
  const [collaborations, setCollaborations] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCollaborations = useCallback(async () => {
    try {
      const res = await fetch('/api/collaborations');
      const data = await res.json();
      setCollaborations(data.collaborations || []);
    } catch {
      toast.error('خطا در بارگذاری همکاری‌ها');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/product');
      const data = await res.json();
      setProducts(data.products || []);
    } catch { /* شمارش محصولات اختیاری است */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      fetchCollaborations();
      fetchProducts();
    });
    return () => {
      cancelled = true;
    };
  }, [fetchCollaborations, fetchProducts]);

  const getProductCount = (collaborationId) =>
    products.filter(
      (p) => (p.collaboration?._id || p.collaboration) === collaborationId
    ).length;

  const handleDelete = async (collaboration) => {
    const result = await Swal.fire({
      title: 'حذف همکاری؟',
      text: `محصولات حذف نمی‌شوند؛ فقط ارتباطشان با «${collaboration.title}» برداشته می‌شود.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'بله، حذف کن',
      cancelButtonText: 'انصراف',
    });
    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/collaborations/${collaboration._id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('همکاری حذف شد');
        fetchCollaborations();
        fetchProducts();
      } else {
        const data = await res.json();
        toast.error(data.error || 'خطا در حذف');
      }
    } catch {
      toast.error('خطا در ارتباط با سرور');
    }
  };

  const filtered = collaborations.filter(
    (c) =>
      c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <Link
            href="/p-admin/admin-events"
            className="inline-flex items-center gap-1.5 text-xs font-bold mb-2 hover:gap-2.5 transition-all"
            style={{ color: 'var(--color-primary)' }}
          >
            <FaArrowRight size={11} /> بازگشت به رویدادها
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FaHandshake style={{ color: 'var(--color-secondary)' }} size={18} />
            مدیریت <span style={{ color: 'var(--color-primary)' }}>همکاری‌ها</span>
          </h1>
          <p className="text-sm font-bold text-gray-400 mt-0.5">{collaborations.length} همکاری ثبت‌شده</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              type="text"
              placeholder="جستجوی همکاری..."
              className="pr-9 pl-4 py-2.5 text-sm font-bold bg-white border-2 border-gray-200 rounded-[var(--radius)] w-56 focus:outline-none focus:border-[var(--color-primary)] transition-all"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Link
            href="/p-admin/admin-events/collaborations/add"
            className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold text-white hover:shadow-lg hover:shadow-[var(--color-primary)]/25 hover:-translate-y-0.5 active:scale-95 transition-all"
            style={{ background: 'var(--color-primary)' }}
          >
            <FaPlus size={14} /> افزودن همکاری
          </Link>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <AdminLoader />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-200">
            <FaHandshake size={28} />
          </div>
          <p className="text-gray-400 font-bold">هیچ همکاری‌ای ثبت نشده</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((collaboration, i) => (
            <motion.div
              key={collaboration._id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              <div
                className="group relative bg-white rounded-2xl border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                style={{ borderColor: '#e8e4df' }}
                onClick={() =>
                  router.push(`/p-admin/admin-events/collaborations/${collaboration._id}`)
                }
              >
                {/* نوار رنگی همکاری */}
                <div
                  className="h-1.5 w-full"
                  style={{
                    background: `linear-gradient(to left, ${collaboration.colors?.primary || 'var(--color-primary)'}, ${collaboration.colors?.secondary || 'var(--color-secondary)'})`,
                  }}
                />

                {/* تصویر/لوگو */}
                <div className="px-6 pt-7 pb-4 flex justify-center">
                  <div className="w-20 h-20 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center overflow-hidden p-3 group-hover:scale-105 transition-transform">
                    {collaboration.logo || collaboration.image ? (
                      <img
                        src={collaboration.logo || collaboration.image}
                        alt={collaboration.name}
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-gray-200">
                        {collaboration.name?.[0]}
                      </span>
                    )}
                  </div>
                </div>

                {/* اطلاعات */}
                <div className="px-6 pb-5">
                  <h2 className="text-base font-bold text-gray-800 text-center group-hover:text-[var(--color-primary)] transition-colors">
                    {collaboration.title}
                  </h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 text-center mb-3">
                    {collaboration.name}
                  </p>

                  <div className="flex items-center justify-center mb-4">
                    <span className="text-[11px] font-bold text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full">
                      {getProductCount(collaboration._id)} محصول
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link
                      href={`/p-admin/admin-events/collaborations/edit/${collaboration._id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[var(--radius)] text-xs font-bold bg-gray-50 text-gray-700 hover:bg-gray-900 hover:text-white transition-all"
                    >
                      <FaEdit size={12} /> ویرایش
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(collaboration);
                      }}
                      className="w-10 h-10 flex items-center justify-center rounded-[var(--radius)] bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-100"
                    >
                      <FaTrash size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
