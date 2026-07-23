'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowRight, FiGrid, FiPlus, FiEdit3, FiTrash2, FiEye, FiEyeOff } from 'react-icons/fi';
import Link from 'next/link';
import BannerEditor from '@/components/admin/banners/BannerEditor';
import BannerRenderer from '@/components/banners/BannerRenderer';
import StripBannerRenderer from '@/components/banners/StripBannerRenderer';
import Swal from 'sweetalert2';

const swalTheme = {
  confirmButtonColor: 'var(--color-primary)',
  cancelButtonColor: '#9ca3af',
  customClass: {
    popup: 'rounded-2xl font-[Vazirmatn] text-right',
    confirmButton: 'rounded-xl font-bold',
    cancelButton: 'rounded-xl font-bold',
  },
  rtl: true,
};

const POSITIONS = [
  { key: 'wide', label: 'بنر افقی بزرگ', desc: 'بنر عریض سمت راست گرید', cols: 2 },
  { key: 'tall-1', label: 'بنر عمودی ۱', desc: 'بنر عمودی وسط', cols: 1 },
  { key: 'tall-2', label: 'بنر عمودی ۲', desc: 'بنر عمودی چپ', cols: 1 },
  { key: 'strip', label: 'نوار بنر (Strip)', desc: 'نوار باریک زیر بنرها', cols: 3 },
];

export default function AdminBannersPage() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingBanner, setEditingBanner] = useState(null);
  const [creatingPosition, setCreatingPosition] = useState(null);

  useEffect(() => { fetchBanners(); }, []);

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/banners?admin=true');
      const data = await res.json();
      if (data.success) setBanners(data.banners);
    } catch { /* handle */ } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      ...swalTheme,
      title: 'حذف بنر؟',
      text: 'این عملیات قابل بازگشت نیست.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'بله، حذف کن',
      cancelButtonText: 'انصراف',
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/banners/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) setBanners((p) => p.filter((b) => b._id !== id));
    } catch { /* handle */ }
  };

  const handleToggleActive = async (banner) => {
    try {
      const res = await fetch(`/api/banners/${banner._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !banner.isActive }),
      });
      const data = await res.json();
      if (data.success) setBanners((p) => p.map((b) => (b._id === banner._id ? data.banner : b)));
    } catch { /* handle */ }
  };

  const getAllForPosition = (pos) => banners.filter((b) => b.position === pos);
  const getActiveForPosition = (pos) => banners.find((b) => b.position === pos && b.isActive);

  if (editingBanner || creatingPosition) {
    return (
      <BannerEditor
        banner={editingBanner}
        position={creatingPosition || editingBanner?.position}
        onClose={() => { setEditingBanner(null); setCreatingPosition(null); }}
        onSave={() => { setEditingBanner(null); setCreatingPosition(null); fetchBanners(); }}
      />
    );
  }

  return (
    <div dir="rtl" className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(170,71,37,0.1)' }}>
            <FiGrid size={17} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">مدیریت بنرها</h1>
            <p className="text-xs font-bold text-gray-400">بنرهای صفحه اصلی را ویرایش کنید</p>
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#e8e4df' }}>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">پیش‌نمایش زنده</h2>
        <div className="grid grid-cols-4 gap-2 h-40 rounded-xl overflow-hidden">
          {['wide', 'tall-1', 'tall-2'].map((pos, i) => {
            const b = getActiveForPosition(pos);
            return (
              <div
                key={pos}
                className={`rounded-xl overflow-hidden bg-gray-100 border border-gray-200 ${i === 0 ? 'col-span-2' : 'col-span-1'}`}
              >
                {b ? (
                  <BannerRenderer banner={b} preview />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-300 font-bold">
                    {POSITIONS.find((p) => p.key === pos)?.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {getActiveForPosition('strip') && (
          <div className="mt-2 h-12 rounded-xl overflow-hidden border border-gray-100">
            <StripBannerRenderer banner={getActiveForPosition('strip')} />
          </div>
        )}
      </div>

      {/* Positions */}
      <div className="space-y-4">
        {POSITIONS.map((pos) => {
          const items = getAllForPosition(pos.key);
          return (
            <motion.div
              key={pos.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border overflow-hidden"
              style={{ borderColor: '#e8e4df' }}
            >
              {/* Position header */}
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#f0ede9', background: '#faf9f8' }}>
                <div>
                  <p className="text-sm font-bold text-gray-800">{pos.label}</p>
                  <p className="text-xs font-bold text-gray-400">{pos.desc}</p>
                </div>
                <button
                  onClick={() => setCreatingPosition(pos.key)}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all hover:-translate-y-0.5 active:scale-95"
                  style={{ borderColor: 'rgba(170,71,37,0.3)', color: 'var(--color-primary)', background: 'rgba(170,71,37,0.05)' }}
                >
                  <FiPlus size={12} /> بنر جدید
                </button>
              </div>

              {/* Items */}
              {items.length === 0 ? (
                <div className="py-10 text-center text-xs font-bold text-gray-400">
                  هنوز بنری برای این موقعیت ثبت نشده
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: '#f5f3f0' }}>
                  {items.map((b) => (
                    <div
                      key={b._id}
                      className={`flex items-center gap-4 px-5 py-3.5 transition-opacity ${b.isActive ? '' : 'opacity-60'}`}
                    >
                      {/* mini preview */}
                      <div className={`flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-100 ${pos.key === 'strip' ? 'h-8 w-32' : 'h-14 w-24'}`}>
                        {pos.key === 'strip' ? (
                          <StripBannerRenderer banner={b} />
                        ) : (
                          <BannerRenderer banner={b} preview />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-800 truncate">{b.title || '(بدون عنوان)'}</p>
                        <p className="text-[10px] font-mono text-gray-400 mt-0.5">تمپلیت: {b.template}</p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          {b.isActive ? 'فعال' : 'غیرفعال'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleToggleActive(b)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-[var(--color-primary)] hover:text-white transition-all"
                          title={b.isActive ? 'غیرفعال کن' : 'فعال کن'}
                        >
                          {b.isActive ? <FiEyeOff size={13} /> : <FiEye size={13} />}
                        </button>
                        <button
                          onClick={() => setEditingBanner(b)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-[var(--color-primary)] hover:text-white transition-all"
                        >
                          <FiEdit3 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(b._id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                        >
                          <FiTrash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}