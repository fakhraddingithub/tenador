'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  FiPlus, FiEdit2, FiTrash2, FiMove,
  FiArrowRight, FiImage, FiLoader,
} from 'react-icons/fi';
import { MdOutlineDragIndicator } from 'react-icons/md';
import Swal from 'sweetalert2';
import AdminLoader from '@/components/admin/AdminLoader';
import { useAdminPermissions } from '@/components/admin/AdminPermissionProvider';
import { ADMIN_REF_TTL } from '@/hooks/useAdminRefData';
import { optimisticReorder } from '@/lib/adminCache';

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

export default function SliderManagement() {
  // /api/slides و /api/slides/reorder همگی با homeSlider.edit گیت شده‌اند.
  const { can } = useAdminPermissions();
  const canEdit = can('homeSlider.edit');
  const [isSaving, setIsSaving] = useState(false);

  // 🟢 اسلایدهای صفحه‌ی اصلی — پاسخِ این endpoint خودش یک آرایه است، پس شکلِ
  // کش هم آرایه است (نه پوشش‌دار).
  const { data, isLoading: loading, mutate } = useSWR(
    '/api/slides?position=home',
    ADMIN_REF_TTL,
  );
  const slides = Array.isArray(data) ? data : [];

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const items = Array.from(slides);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    setIsSaving(true);
    try {
      await optimisticReorder(mutate, items, () =>
        fetch('/api/slides/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: 'home', orderedIds: items.map((s) => s._id) }),
        }),
      );
    } catch {
      // ترتیب قبلی توسط SWR بازگردانده شده
      Swal.fire({ ...swalTheme, title: 'ترتیب ذخیره نشد', text: 'ترتیب قبلی بازگردانده شد.', icon: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      ...swalTheme,
      title: 'حذف اسلاید؟',
      text: 'این اسلاید برای همیشه پاک خواهد شد و قابل بازیابی نیست.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'بله، حذف کن',
      cancelButtonText: 'انصراف',
    });

    if (!result.isConfirmed) return;

    Swal.fire({ ...swalTheme, title: 'در حال حذف...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const res = await fetch(`/api/slides/${id}`, { method: 'DELETE' });
      if (res.ok) {
        mutate(
          (cur) => (Array.isArray(cur) ? cur.filter((s) => s._id !== id) : cur),
          { revalidate: false },
        );
        Swal.fire({ ...swalTheme, title: 'اسلاید حذف شد', icon: 'success' });
      } else throw new Error();
    } catch {
      Swal.fire({ ...swalTheme, title: 'خطا در حذف', icon: 'error' });
    }
  };

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FiImage style={{ color: 'var(--color-secondary)' }} />
            مدیریت اسلایدر
          </h1>
          <p className="text-xs font-bold text-gray-400 mt-0.5">
            ترتیب نمایش را با کشیدن و رها کردن تغییر دهید
          </p>
        </div>
        {canEdit && (
        <Link
          href="/p-admin/admin-home/slider/create"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:shadow-lg hover:shadow-[var(--color-primary)]/25 hover:-translate-y-0.5 active:scale-95 transition-all"
          style={{ background: 'var(--color-primary)' }}
        >
          <FiPlus size={16} /> افزودن اسلاید
        </Link>
        )}
      </div>

      {/* Slides list */}
      {loading ? (
        <AdminLoader />
      ) : slides.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300">
            <FiImage size={28} />
          </div>
          <p className="text-gray-400 font-bold text-sm">هنوز اسلایدی اضافه نشده</p>
          {canEdit && (
          <Link
            href="/p-admin/admin-home/slider/create"
            className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold hover:underline"
            style={{ color: 'var(--color-primary)' }}
          >
            <FiPlus size={12} /> افزودن اولین اسلاید
          </Link>
          )}
        </div>
      ) : (
        <DragDropContext onDragEnd={canEdit ? onDragEnd : () => {}}>
          <Droppable droppableId="slides">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-2"
              >
                {slides.map((slide, index) => (
                  <Draggable key={slide._id} draggableId={slide._id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`bg-white rounded-2xl border-2 transition-all flex items-center gap-4 p-3 group ${
                          snapshot.isDragging
                            ? 'border-[var(--color-primary)] shadow-2xl scale-[1.01] z-50'
                            : 'border-gray-100 hover:border-gray-200 shadow-sm'
                        }`}
                      >
                        {/* drag handle */}
                        <div
                          {...provided.dragHandleProps}
                          className="text-gray-300 hover:text-gray-500 p-1 cursor-grab active:cursor-grabbing flex-shrink-0"
                        >
                          <MdOutlineDragIndicator size={20} />
                        </div>

                        {/* order number */}
                        <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-gray-50 flex items-center justify-center text-[10px] font-bold text-gray-400">
                          {index + 1}
                        </div>

                        {/* thumbnail */}
                        <div className="relative w-28 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
                          <Image
                            src={slide.image || '/images/placeholder.jpg'}
                            alt={slide.title}
                            fill
                            className="object-cover"
                          />
                        </div>

                        {/* info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm text-gray-800 truncate group-hover:text-[var(--color-primary)] transition-colors">
                            {slide.title || '(بدون عنوان)'}
                          </h3>
                          {slide.subtitle && (
                            <p className="text-xs text-gray-400 font-bold truncate mt-0.5">
                              {slide.subtitle}
                            </p>
                          )}
                          {slide.link && (
                            <p className="text-[10px] text-gray-300 font-mono truncate mt-0.5">
                              {slide.link}
                            </p>
                          )}
                        </div>

                        {/* active badge */}
                        <div className="flex-shrink-0 hidden sm:flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${slide.isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${slide.isActive ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`} />
                            {slide.isActive ? 'فعال' : 'غیرفعال'}
                          </span>
                        </div>

                        {/* actions */}
                        {canEdit && (
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/p-admin/admin-home/slider/edit/${slide._id}`}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-[var(--color-primary)] hover:text-white transition-all"
                          >
                            <FiEdit2 size={13} />
                          </Link>
                          <button
                            onClick={() => handleDelete(slide._id)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                          >
                            <FiTrash2 size={13} />
                          </button>
                        </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* saving indicator */}
      <AnimatePresence>
        {isSaving && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-6 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-xl z-50 text-xs font-bold"
            style={{ background: '#0d0d0d' }}
          >
            <FiLoader className="animate-spin" size={13} style={{ color: 'var(--color-secondary)' }} />
            در حال ذخیره چیدمان...
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}