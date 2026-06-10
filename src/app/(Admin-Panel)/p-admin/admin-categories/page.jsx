'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { showToast } from '@/lib/toast';
import { confirmDelete, showError } from '@/lib/swal';
import {
  FaPlus, FaFolderOpen, FaSearch, FaArrowRight, FaShapes
} from 'react-icons/fa';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, rectSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import SortableCategoryCard from "@/components/admin/SortableCategoryCard";

export default function AdminCategories() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchCategories(); fetchProducts(); }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data.categories || []);
    } catch { showToast.error('خطا در بارگذاری'); } finally { setLoading(false); }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/product');
      const data = await res.json();
      setProducts(data.products || []);
    } catch { console.error('products fetch error'); }
  };

  const getProductCount = (categoryId) => products.filter(p => p.category?._id === categoryId).length;

  const handleDelete = async (category) => {
    const confirmed = await confirmDelete('حذف دسته‌بندی', `آیا مطمئن هستید که می‌خواهید "${category.title}" را حذف کنید؟`);
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/categories/${category._id}`, { method: 'DELETE' });
      if (res.ok) { showToast.success('دسته‌بندی حذف شد'); fetchCategories(); fetchProducts(); }
      else { const data = await res.json(); showError('خطا', data.error || 'خطا در حذف'); }
    } catch { showError('خطا', 'خطا در ارتباط با سرور'); }
  };

  const filtered = categories.filter(c => c.title?.toLowerCase().includes(searchTerm.toLowerCase()));

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex((item) => item._id === active.id);
    const newIndex = categories.findIndex((item) => item._id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex);
    const updated = reordered.map((item, index) => ({ ...item, order: index }));
    setCategories(updated);
    try {
      await fetch("/api/categories/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: updated.map((c) => ({ id: c._id, order: c.order })) }),
      });
    } catch (error) { console.error(error); }
  };

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <Link href="/p-admin" className="inline-flex items-center gap-1.5 text-xs font-bold mb-2 hover:gap-2.5 transition-all" style={{ color: 'var(--color-primary)' }}>
            <FaArrowRight size={11} /> بازگشت
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FaShapes style={{ color: 'var(--color-secondary)' }} size={18} />
            مدیریت <span style={{ color: 'var(--color-primary)' }}>دسته‌ها</span>
          </h1>
          <p className="text-sm font-bold text-gray-400 mt-0.5">{categories.length} دسته‌بندی ثبت‌شده</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              type="text"
              placeholder="جستجوی دسته‌بندی..."
              className="pr-9 pl-4 py-2.5 text-sm font-bold bg-white border-2 border-gray-200 rounded-[var(--radius)] w-56 focus:outline-none focus:border-[var(--color-primary)] transition-all"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => router.push('/p-admin/admin-categories/add')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold text-white hover:shadow-lg hover:shadow-[var(--color-primary)]/25 hover:-translate-y-0.5 active:scale-95 transition-all"
            style={{ background: 'var(--color-primary)' }}
          >
            <FaPlus size={14} /> افزودن دسته
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 bg-white rounded-2xl animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-200">
            <FaFolderOpen size={28} />
          </div>
          <p className="text-gray-400 font-bold">هیچ دسته‌بندی‌ای یافت نشد</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map((c) => c._id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.map((category, i) => (
                <motion.div
                  key={category._id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                >
                  <SortableCategoryCard
                    category={category}
                    count={getProductCount(category._id)}
                    handleDelete={handleDelete}
                  />
                </motion.div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}