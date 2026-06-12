'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiArrowRight, FiPlus, FiEdit3, FiTrash2, FiActivity, FiSearch } from 'react-icons/fi';
import Swal from 'sweetalert2';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, rectSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import SortableSportCard from "@/components/templates/sports/SortableSportCard";
import AdminLoader from "@/components/admin/AdminLoader";

/* ─── Page Header pattern (reused across pages) ─── */
function PageHeader({ title, subtitle, backHref = '/p-admin', actions }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-bold mb-2 transition-all hover:gap-2.5"
          style={{ color: 'var(--color-primary)' }}
        >
          <FiArrowRight size={13} /> بازگشت به داشبورد
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm font-bold text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export default function AdminSports() {
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchSports(); }, []);

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
      confirmButtonColor: 'var(--color-primary)',
      cancelButtonColor: '#9ca3af',
      confirmButtonText: 'بله، حذف کن',
      cancelButtonText: 'لغو',
      rtl: true,
      customClass: {
        popup: 'rounded-2xl font-[Vazirmatn]',
        confirmButton: 'rounded-[var(--radius)] font-bold',
        cancelButton: 'rounded-[var(--radius)] font-bold',
      },
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/sports/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setSports(prev => prev.filter(s => s._id !== id));
          Swal.fire({
            title: 'حذف شد!',
            icon: 'success',
            confirmButtonColor: 'var(--color-primary)',
            customClass: { popup: 'rounded-2xl font-[Vazirmatn]', confirmButton: 'rounded-[var(--radius)] font-bold' },
          });
        }
      } catch {
        Swal.fire({
          title: 'خطا در حذف!', icon: 'error',
          customClass: { popup: 'rounded-2xl font-[Vazirmatn]', confirmButton: 'rounded-[var(--radius)] font-bold' },
        });
      }
    }
  };

  const filteredSports = sports.filter(s => s.name.includes(searchTerm));

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sports.findIndex((item) => item._id === active.id);
    const newIndex = sports.findIndex((item) => item._id === over.id);
    const reordered = arrayMove(sports, oldIndex, newIndex);
    const updated = reordered.map((item, index) => ({ ...item, order: index }));
    setSports(updated);
    try {
      await fetch("/api/sports/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sports: updated.map((s) => ({ id: s._id, order: s.order })) }),
      });
    } catch (error) { console.error(error); }
  };

  return (
    <div dir="rtl">
      <PageHeader
        title="مدیریت ورزش‌ها"
        subtitle={`${sports.length} رشته ورزشی در سیستم`}
        actions={
          <>
            <div className="relative">
              <FiSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                type="text"
                placeholder="جستجوی ورزش..."
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-9 pl-4 py-2.5 text-sm font-bold bg-white border-2 border-gray-200 rounded-[var(--radius)] w-56 focus:outline-none focus:border-[var(--color-primary)] transition-all"
              />
            </div>
            <Link
              href="/p-admin/admin-sports/add"
              className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-[var(--color-primary)]/25 hover:-translate-y-0.5 active:scale-95"
              style={{ background: 'var(--color-primary)' }}
            >
              <FiPlus size={16} /> افزودن ورزش
            </Link>
          </>
        }
      />

      {loading ? (
        <AdminLoader />
      ) : filteredSports.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300">
            <FiActivity size={26} />
          </div>
          <p className="text-gray-400 font-bold">هیچ ورزشی یافت نشد</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredSports.map((s) => s._id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredSports.map((sport, i) => (
                <motion.div
                  key={sport._id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                >
                  <SortableSportCard sport={sport} handleDelete={handleDelete} />
                </motion.div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}