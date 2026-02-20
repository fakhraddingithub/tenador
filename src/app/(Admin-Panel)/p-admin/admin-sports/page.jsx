'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FiArrowRight, FiPlus, FiEdit3, FiTrash2, FiActivity, FiSearch } from 'react-icons/fi';
import Swal from 'sweetalert2';

export default function AdminSports() {
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSports();
  }, []);

  const fetchSports = async () => {
    try {
      const res = await fetch('/api/sports');
      const data = await res.json();
      setSports(data.sports || []);
    } catch (error) {
      console.error('Error fetching sports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'حذف ورزش؟',
      text: "تمام داده‌های مربوط به این ورزش پاک خواهد شد!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#aa4725',
      cancelButtonColor: '#d33',
      confirmButtonText: 'بله، حذف کن',
      cancelButtonText: 'لغو',
      rtl: true,
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/sports/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setSports(prev => prev.filter(s => s._id !== id));
          Swal.fire({ title: 'حذف شد!', icon: 'success', confirmButtonColor: '#aa4725' });
        }
      } catch (error) {
        Swal.fire('خطا در حذف!', '', 'error');
      }
    }
  };

  const filteredSports = sports.filter(s => s.name.includes(searchTerm));

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-[var(--color-text)]" dir="rtl">
      
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <Link href="/p-admin" className="text-[var(--color-primary)] hover:gap-2 flex items-center gap-1 transition-all text-sm font-bold mb-2">
                <FiArrowRight /> بازگشت به پنل مدیریت
              </Link>
              <h1 className="text-3xl font-bold tracking-tight">مدیریت ورزش‌ها</h1>
            </div>
            
            <div className="flex items-center gap-3">
               <div className="relative hidden sm:block">
                  <FiSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text"
                    placeholder="جستجوی ورزش..."
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 pl-4 py-2.5 bg-gray-100 rounded-[var(--radius)] border-none focus:ring-2 ring-[var(--color-primary)]/20 transition-all outline-none w-64 text-sm"
                  />
               </div>
               <Link
                href="/p-admin/admin-sports/add"
                className="bg-[var(--color-primary)] text-white px-6 py-3 rounded-[var(--radius)] font-bold flex items-center gap-2 hover:shadow-lg hover:shadow-[var(--color-primary)]/30 transition-all active:scale-95"
              >
                <FiPlus size={20} /> افزودن ورزش
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
            <p className="text-gray-500 font-bold">در حال بارگذاری...</p>
          </div>
        ) : filteredSports.length === 0 ? (
          <div className="bg-white rounded-[var(--radius)] border-2 border-dashed border-gray-200 p-20 text-center">
            <FiActivity size={60} className="mx-auto text-gray-200 mb-4" />
            <p className="text-gray-400 font-bold text-xl">هیچ ورزشی یافت نشد!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredSports.map((sport) => (
              <div 
                key={sport._id} 
                className="group bg-white rounded-[var(--radius)] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
              >
                {/* بخش عکس اصلی ورزش (بزرگ) */}
                <div className="relative h-44 bg-gray-200 overflow-hidden">
                  {sport.image ? (
                    <img
                      src={sport.image}
                      alt={sport.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <FiActivity size={40} />
                    </div>
                  )}
                </div>

                {/* محتوای کارت */}
                <div className="p-5">
                  {/* ردیف آیکون و نام ورزش */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0 flex items-center justify-center">
                      {sport.icon ? (
                        <img src={sport.icon} alt="icon" className="w-full h-full object-contain" />
                      ) : (
                        <FiActivity className="text-[var(--color-primary)]" />
                      )}
                    </div>
                    <h3 className="text-xl font-bold group-hover:text-[var(--color-primary)] transition-colors truncate">
                      {sport.name}
                    </h3>
                  </div>

                  <p className="text-gray-500 text-sm leading-relaxed line-clamp-2 min-h-[40px] mb-6 font-medium">
                    {sport.description || 'توضیحاتی برای این ورزش ثبت نشده است.'}
                  </p>

                  {/* دکمه‌ها */}
                  <div className="flex items-center gap-2 border-t border-gray-50 pt-4">
                    <Link
                      href={`/p-admin/admin-sports/edit/${sport._id}`}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-[var(--radius)] bg-gray-50 text-gray-700 hover:bg-[var(--color-secondary)] hover:text-black font-bold text-sm transition-all"
                    >
                      <FiEdit3 size={16} /> ویرایش
                    </Link>
                    <button
                      onClick={() => handleDelete(sport._id)}
                      className="w-10 h-10 flex items-center justify-center rounded-[var(--radius)] bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                    >
                      <FiTrash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}