'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Swal from 'sweetalert2';
import {
  FaPlus, FaEdit, FaTrash, FaArrowRight,
  FaUserCircle, FaGlobe, FaSearch,
  FaCalendarAlt, FaTextHeight, FaWeightHanging, FaAward
} from 'react-icons/fa';

const swalTheme = {
  confirmButtonColor: 'var(--color-primary)',
  cancelButtonColor: '#9ca3af',
  customClass: {
    popup: 'rounded-2xl font-[Vazirmatn] text-right',
    confirmButton: 'rounded-[var(--radius)] font-bold',
    cancelButton: 'rounded-[var(--radius)] font-bold',
  },
  rtl: true,
};

export default function AdminAthletes() {
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchAthletes(); }, []);

  const fetchAthletes = async () => {
    try {
      const res = await fetch('/api/athletes');
      const data = await res.json();
      setAthletes(data.athletes || []);
    } catch { /* handle */ } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      ...swalTheme,
      title: 'حذف ورزشکار؟',
      text: 'این عمل پروفایل ورزشکار را کاملاً حذف می‌کند!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'بله، حذف کن',
      cancelButtonText: 'انصراف',
    });
    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/athletes/${id}`, { method: 'DELETE' });
        if (res.ok) {
          Swal.fire({ ...swalTheme, title: 'حذف شد', icon: 'success' });
          fetchAthletes();
        }
      } catch { /* handle */ }
    }
  };

  const filteredAthletes = athletes.filter(a =>
    a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <Link
            href="/p-admin"
            className="inline-flex items-center gap-1.5 text-xs font-bold mb-2 hover:gap-2.5 transition-all"
            style={{ color: 'var(--color-primary)' }}
          >
            <FaArrowRight size={11} /> بازگشت
          </Link>
          <h1 className="text-xl font-bold text-gray-900">
            مدیریت <span style={{ color: 'var(--color-primary)' }}>قهرمانان</span>
          </h1>
          <p className="text-sm font-bold text-gray-400 mt-0.5">{athletes.length} ورزشکار ثبت‌شده</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              type="text"
              placeholder="جستجوی سریع..."
              className="pr-9 pl-4 py-2.5 text-sm font-bold bg-white border-2 border-gray-200 rounded-[var(--radius)] w-56 focus:outline-none focus:border-[var(--color-primary)] transition-all"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Link
            href="/p-admin/admin-athletes/add"
            className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold text-white hover:shadow-lg hover:shadow-[var(--color-primary)]/25 hover:-translate-y-0.5 active:scale-95 transition-all"
            style={{ background: 'var(--color-primary)' }}
          >
            <FaPlus size={14} /> افزودن قهرمان
          </Link>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-72 bg-white rounded-2xl animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : filteredAthletes.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
          <p className="text-gray-400 font-bold">لیست قهرمانان خالی است</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAthletes.map((athlete, i) => (
            <motion.div
              key={athlete._id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="group bg-white rounded-2xl border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
              style={{ borderColor: '#e8e4df' }}
            >
              {/* Sport badge */}
              <div className="relative h-48 overflow-hidden bg-gray-900">
                {athlete.photo ? (
                  <img
                    src={athlete.photo}
                    alt={athlete.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600 bg-gradient-to-br from-gray-800 to-gray-900">
                    <FaUserCircle size={56} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                {/* Sport tag */}
                <div className="absolute top-3 right-3">
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-black/50 text-white backdrop-blur-sm border border-white/10">
                    {athlete.sport?.name || 'بدون رشته'}
                  </span>
                </div>

                <div className="absolute bottom-4 right-4 left-4">
                  <h2 className="text-white font-bold text-lg mb-0.5 leading-tight">{athlete.title}</h2>
                  <p className="text-gray-300 text-xs flex items-center gap-1 font-bold">
                    <FaGlobe style={{ color: 'var(--color-secondary)' }} size={10} />
                    {athlete.nationality || 'ملیت نامشخص'}
                  </p>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 flex-1 space-y-3">
                <div className="grid grid-cols-3 gap-2 py-2 border-b border-gray-50">
                  {[
                    { icon: FaTextHeight, label: 'قد', value: `${athlete.height || '-'} CM` },
                    { icon: FaWeightHanging, label: 'وزن', value: `${athlete.weight || '-'} KG` },
                    { icon: FaAward, label: 'مدال', value: athlete.honors?.length || 0 },
                  ].map((item, idx) => (
                    <div key={idx} className={`text-center ${idx === 1 ? 'border-x border-gray-50' : ''}`}>
                      <p className="text-[10px] text-gray-400 uppercase font-bold mb-1 flex items-center justify-center gap-1">
                        <item.icon size={9} /> {item.label}
                      </p>
                      <p className="text-xs font-bold text-gray-700">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-[var(--radius)]">
                  <FaCalendarAlt style={{ color: 'var(--color-primary)' }} size={11} />
                  <span className="font-bold">
                    متولد: {athlete.birthDate ? new Date(athlete.birthDate).toLocaleDateString('fa-IR') : 'نامشخص'}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 pb-4 flex gap-2">
                <Link
                  href={`/p-admin/admin-athletes/edit/${athlete._id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[var(--radius)] text-xs font-bold bg-gray-50 text-gray-700 hover:bg-gray-900 hover:text-white transition-all border border-gray-100"
                >
                  <FaEdit size={12} /> ویرایش پروفایل
                </Link>
                <button
                  onClick={() => handleDelete(athlete._id)}
                  className="w-10 h-10 flex items-center justify-center rounded-[var(--radius)] bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-100"
                >
                  <FaTrash size={12} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}