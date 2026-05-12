'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FiArrowRight, FiPlus, FiEdit3, FiTrash2, FiActivity, FiSearch } from 'react-icons/fi';
import Swal from 'sweetalert2';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

import SortableSportCard from "@/components/templates/sports/SortableSportCard";

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
  
  const sensors = useSensors(
    useSensor(PointerSensor)
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;
  
    if (!over || active.id === over.id) return;
  
    const oldIndex = sports.findIndex(
      (item) => item._id === active.id
    );
  
    const newIndex = sports.findIndex(
      (item) => item._id === over.id
    );
  
    const reordered = arrayMove(
      sports,
      oldIndex,
      newIndex
    );
  
    const updated = reordered.map((item, index) => ({
      ...item,
      order: index,
    }));
  
    setSports(updated);
  
    try {
      await fetch("/api/sports/reorder", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sports: updated.map((s) => ({
            id: s._id,
            order: s.order,
          })),
        }),
      });
    } catch (error) {
      console.error(error);
    }
  };
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
          <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredSports.map((s) => s._id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredSports.map((sport) => (
                <SortableSportCard
                  key={sport._id}
                  sport={sport}
                  handleDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        )}
      </main>
    </div>
  );
}