'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FaPlus, FaSearch, FaArrowRight, FaShieldAlt
} from 'react-icons/fa';
import Swal from 'sweetalert2';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, rectSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import SortableBrandCard from "@/components/admin/SortableBrandCard";
import AdminLoader from "@/components/admin/AdminLoader";

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

export default function AdminBrands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchBrands(); }, []);

  const fetchBrands = async () => {
    try {
      const res = await fetch('/api/brands');
      const data = await res.json();
      setBrands(data.brands || []);
    } catch {
      /* handle silently */
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (brand) => {
    const result = await Swal.fire({
      ...swalTheme,
      title: 'حذف برند؟',
      text: `آیا از حذف برند "${brand.name}" اطمینان دارید؟`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'بله، حذف کن',
      cancelButtonText: 'انصراف',
    });
    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/brands/${brand._id}`, { method: 'DELETE' });
        if (res.ok) {
          Swal.fire({ ...swalTheme, title: 'برند حذف شد', icon: 'success' });
          fetchBrands();
        }
      } catch { /* handle */ }
    }
  };

  const filteredBrands = brands.filter(b =>
    b.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = brands.findIndex((item) => item._id === active.id);
    const newIndex = brands.findIndex((item) => item._id === over.id);
    const reordered = arrayMove(brands, oldIndex, newIndex);
    const updated = reordered.map((item, index) => ({ ...item, order: index }));
    setBrands(updated);
    try {
      await fetch("/api/brands/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brands: updated.map((b) => ({ id: b._id, order: b.order })) }),
      });
    } catch (error) { console.error(error); }
  };

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
            <FaArrowRight size={11} /> بازگشت به داشبورد
          </Link>
          <h1 className="text-xl font-bold text-gray-900">
            مرکز <span style={{ color: 'var(--color-primary)' }}>برندها</span>
          </h1>
          <p className="text-sm font-bold text-gray-400 mt-0.5">{brands.length} برند ثبت‌شده</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              type="text"
              placeholder="جستجوی برند..."
              className="pr-9 pl-4 py-2.5 text-sm font-bold bg-white border-2 border-gray-200 rounded-[var(--radius)] w-56 focus:outline-none focus:border-[var(--color-primary)] transition-all"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Link
            href="/p-admin/admin-brands/add"
            className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold text-white hover:shadow-lg hover:shadow-[var(--color-primary)]/25 hover:-translate-y-0.5 active:scale-95 transition-all"
            style={{ background: 'var(--color-primary)' }}
          >
            <FaPlus size={14} /> افزودن برند
          </Link>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <AdminLoader />
      ) : filteredBrands.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-200">
            <FaShieldAlt size={28} />
          </div>
          <p className="text-gray-400 font-bold">هیچ برندی ثبت نشده</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredBrands.map((b) => b._id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredBrands.map((brand, i) => (
                <motion.div
                  key={brand._id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                >
                  <SortableBrandCard brand={brand} handleDelete={handleDelete} />
                </motion.div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}