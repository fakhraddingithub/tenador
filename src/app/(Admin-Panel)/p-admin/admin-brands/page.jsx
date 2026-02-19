'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FaPlus, FaEdit, FaTrash, FaGlobeAmericas,
  FaCalendarCheck, FaSearch, FaArrowRight, FaShieldAlt
} from 'react-icons/fa';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';

export default function AdminBrands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      const res = await fetch('/api/brands');
      const data = await res.json();
      setBrands(data.brands || []);
    } catch (error) {
      toast.error('خطا در بارگذاری برندها');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (brand) => {
    const result = await Swal.fire({
      title: 'حذف برند؟',
      text: `آیا از حذف برند "${brand.name}" اطمینان دارید؟`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'بله، حذف کن',
      cancelButtonText: 'انصراف'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/brands/${brand._id}`, { method: 'DELETE' });
        if (res.ok) {
          toast.success('برند با موفقیت حذف شد');
          fetchBrands();
        }
      } catch (error) {
        toast.error('خطای سیستمی در حذف');
      }
    }
  };

  const filteredBrands = brands.filter(b =>
    b.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f8faff] pb-20">
      {/* --- Sticky Minimal Header --- */}
      <div className="sticky top-0 z-30 bg-white/70 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <Link href="/p-admin" className="flex items-center gap-2 text-[var(--color-primary)] text-sm font-bold mb-1">
                <FaArrowRight size={12} /> بازگشت به داشبورد
              </Link>
              <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
                مرکز <span className="text-[var(--color-primary)]">برندها</span>
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative group">
                <FaSearch className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[var(--color-primary)] transition-colors" />
                <input
                  type="text"
                  placeholder="جستجوی برند..."
                  className="bg-white border-2 border-gray-50 pr-11 pl-4 py-3 rounded-2xl w-64 focus:border-[var(--color-secondary)] outline-none transition-all shadow-sm text-sm"
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Link
                href="/p-admin/admin-brands/add"
                className="bg-gray-900 text-white px-6 py-3 rounded-2xl hover:bg-[var(--color-primary)] transition-all flex items-center gap-2 font-bold shadow-lg shadow-gray-200"
              >
                <FaPlus /> افزودن برند
              </Link>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-64 bg-white rounded-3xl animate-pulse border border-gray-50"></div>
            ))}
          </div>
        ) : filteredBrands.length === 0 ? (
          <div className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-gray-100">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-200">
              <FaShieldAlt size={40} />
            </div>
            <p className="text-gray-400 font-bold text-lg">هنوز هیچ برندی در سیستم ثبت نشده است</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredBrands.map((brand) => (
              <div key={brand._id} className="group relative bg-white rounded-[2.5rem] p-6 border border-gray-50 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 overflow-hidden">

                {/* Background Pattern */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)]/5 rounded-bl-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />

                {/* Logo Display */}
                <Link href={`admin-brands/${brand._id}`}>
                  <div className="relative mb-8 flex justify-center mt-4">
                    <div className="w-24 h-24 bg-white rounded-3xl shadow-inner border border-gray-50 flex items-center justify-center overflow-hidden p-4 group-hover:scale-110 transition-transform">
                      {brand.logo ? (
                        <img src={brand.logo} alt={brand.name} className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-3xl font-bold text-gray-200">{brand.name?.[0]}</span>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Brand Info */}
                <div className="text-center mb-8 relative z-10">
                  <h2 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-[var(--color-primary)] transition-colors">{brand.name}</h2>
                  <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <span className="flex items-center gap-1"><FaGlobeAmericas className="text-[var(--color-secondary)]" /> {brand.country || 'Global'}</span>
                    <span className="w-1.5 h-1.5 bg-gray-200 rounded-full" />
                    <span className="flex items-center gap-1"><FaCalendarCheck className="text-[var(--color-secondary)]" /> {brand.foundedYear || '---'}</span>
                  </div>
                </div>

                {/* Action Floating Buttons */}
                <div className="flex gap-2">
                  <Link
                    href={`/p-admin/admin-brands/edit/${brand._id}`}
                    className="flex-1 bg-gray-50 text-gray-700 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-gray-900 hover:text-white transition-all"
                  >
                    <FaEdit /> ویرایش
                  </Link>
                  <button
                    onClick={() => handleDelete(brand)}
                    className="w-12 h-12 flex items-center justify-center rounded-2xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all"
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