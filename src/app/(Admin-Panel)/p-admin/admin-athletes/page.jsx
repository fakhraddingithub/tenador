'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { 
  FaPlus, FaEdit, FaTrash, FaArrowRight, 
  FaUserCircle, FaRunning, FaGlobe, FaSearch,
  FaCalendarAlt, FaTextHeight, FaWeightHanging, FaAward
} from 'react-icons/fa';

export default function AdminAthletes() {
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchAthletes();
  }, []);

  const fetchAthletes = async () => {
    try {
      const res = await fetch('/api/athletes');
      const data = await res.json();
      setAthletes(data.athletes || []);
    } catch (error) {
      toast.error('خطا در بارگذاری لیست ورزشکاران');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'حذف ورزشکار؟',
      text: "این عمل پروفایل ورزشکار را کاملاً حذف می‌کند!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--color-primary)',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'بله، حذف کن',
      cancelButtonText: 'انصراف',
      background: '#ffffff',
      customClass: {
        popup: 'rounded-[var(--radius)]',
        confirmButton: 'rounded-[var(--radius)] font-bold',
        cancelButton: 'rounded-[var(--radius)] font-bold'
      }
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/athletes/${id}`, { method: 'DELETE' });
        if (res.ok) {
          Swal.fire({ title: 'حذف شد', icon: 'success', confirmButtonColor: 'var(--color-primary)' });
          fetchAthletes();
        } else {
          toast.error('خطا در حذف');
        }
      } catch (error) {
        toast.error('خطای سرور');
      }
    }
  };

  const filteredAthletes = athletes.filter(a => 
    a.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#fcfcfc] pb-20">
      {/* Top Glassmorphism Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <Link href="/p-admin" className="flex items-center gap-2 text-[var(--color-primary)] text-sm font-bold group">
                <FaArrowRight className="group-hover:translate-x-1 transition-transform" /> بازگشت به داشبورد
              </Link>
              <h1 className="text-3xl font-bold text-[var(--color-text)] tracking-tight">
                مدیریت <span className="text-[var(--color-primary)]">قهرمانان</span>
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative group">
                <FaSearch className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[var(--color-primary)] transition-colors" />
                <input 
                  type="text"
                  placeholder="جستجوی سریع..."
                  className="bg-gray-100/50 border-none pr-11 pl-4 py-3 rounded-[var(--radius)] w-64 md:w-80 outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/50 transition-all text-sm"
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Link
                href="/p-admin/admin-athletes/add"
                className="bg-[var(--color-primary)] text-white w-12 h-12 md:w-auto md:px-6 rounded-[var(--radius)] hover:shadow-xl hover:shadow-[#aa472544] transition-all flex items-center justify-center gap-2 font-bold"
              >
                <FaPlus /> <span className="hidden md:block">افزودن قهرمان</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-10">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-gray-100 animate-pulse rounded-[var(--radius)]"></div>
            ))}
          </div>
        ) : filteredAthletes.length === 0 ? (
          <div className="bg-white rounded-[var(--radius)] border-2 border-dashed border-gray-100 p-20 text-center">
            <p className="text-gray-400 font-bold text-lg">لیست قهرمانان خالی است</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredAthletes.map((athlete) => (
              <div key={athlete._id} className="group bg-white rounded-[var(--radius)] border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden relative flex flex-col">
                
                {/* Status Badge */}
                <div className="absolute top-4 right-4 z-10">
                  <span className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm">
                    {athlete.sport?.name || 'بدون رشته'}
                  </span>
                </div>

                {/* Card Header: Image & Gradient */}
                <div className="relative h-48 overflow-hidden bg-gray-900">
                  {athlete.photo ? (
                    <img
                      src={athlete.photo}
                      alt={athlete.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900 text-gray-500">
                      <FaUserCircle size={60} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-4 right-4 left-4">
                    <h2 className="text-white font-bold text-xl mb-0.5">{athlete.title}</h2>
                    <p className="text-gray-300 text-xs flex items-center gap-1">
                      <FaGlobe className="text-[var(--color-secondary)]" /> {athlete.nationality || 'ملیت نامشخص'}
                    </p>
                  </div>
                </div>

                {/* Card Body: Info Grid */}
                <div className="p-5 flex-1 space-y-4">
                  <div className="grid grid-cols-3 gap-2 py-2 border-b border-gray-50">
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 uppercase font-bold mb-1 flex items-center justify-center gap-1"><FaTextHeight /> قد</p>
                      <p className="text-sm font-bold text-[var(--color-text)]">{athlete.height || '-'} <span className="text-[8px] text-gray-400">CM</span></p>
                    </div>
                    <div className="text-center border-x border-gray-50">
                      <p className="text-[10px] text-gray-400 uppercase font-bold mb-1 flex items-center justify-center gap-1"><FaWeightHanging /> وزن</p>
                      <p className="text-sm font-bold text-[var(--color-text)]">{athlete.weight || '-'} <span className="text-[8px] text-gray-400">KG</span></p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 uppercase font-bold mb-1 flex items-center justify-center gap-1"><FaAward /> مدال</p>
                      <p className="text-sm font-bold text-[var(--color-text)]">{athlete.honors?.length || 0}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-md">
                    <FaCalendarAlt className="text-[var(--color-primary)]" />
                    <span>متولد: {athlete.birthDate ? new Date(athlete.birthDate).toLocaleDateString('fa-IR') : 'نامشخص'}</span>
                  </div>
                </div>

                {/* Card Footer: Action Buttons */}
                <div className="p-4 bg-gray-50/50 flex gap-2 border-t border-gray-50">
                  <Link
                    href={`/p-admin/admin-athletes/edit/${athlete._id}`}
                    className="flex-1 bg-white border border-gray-200 text-gray-700 py-2.5 rounded-[var(--radius)] text-xs font-bold flex items-center justify-center gap-2 hover:bg-gray-900 hover:text-white transition-all"
                  >
                    <FaEdit /> ویرایش پروفایل
                  </Link>
                  <button
                    onClick={() => handleDelete(athlete._id)}
                    className="w-12 h-10 flex items-center justify-center rounded-[var(--radius)] border border-red-100 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                    title="حذف ورزشکار"
                  >
                    <FaTrash size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}