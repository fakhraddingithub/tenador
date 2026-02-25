'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { showToast } from '@/lib/toast';
import { confirmDelete, showError } from '@/lib/swal';
import { 
  FaPlus, FaFolderOpen, FaTrash, FaEdit, 
  FaBoxOpen, FaSearch, FaArrowRight, FaShapes 
} from 'react-icons/fa';
import { FiEdit3, FiTrash2 } from 'react-icons/fi';

export default function AdminCategories() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (error) {
      showToast.error('خطا در بارگذاری دسته‌بندی‌ها');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/product');
      const data = await res.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const getProductCount = (categoryId) => {
    return products.filter(product => product.category?._id === categoryId).length;
  };

  const handleDelete = async (category) => {
    const confirmed = await confirmDelete(
      'حذف دسته‌بندی',
      `آیا مطمئن هستید که می‌خواهید "${category.title}" را حذف کنید؟ این عمل می‌تواند روی محصولات متصل تاثیر بگذارد.`
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/categories/${category._id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        showToast.success('دسته‌بندی با موفقیت حذف شد');
        fetchCategories();
        fetchProducts();
      } else {
        const data = await res.json();
        showError('خطا', data.error || 'خطا در حذف دسته‌بندی');
      }
    } catch (error) {
      showError('خطا', 'خطا در ارتباط با سرور');
    }
  };

  const filteredCategories = categories.filter(c => 
    c.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-20">
      {/* Modern Glassmorphism Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <Link href="/p-admin" className="flex items-center gap-2 text-[var(--color-primary)] text-sm font-bold group">
                <FaArrowRight className="group-hover:translate-x-1 transition-transform" /> بازگشت به داشبورد
              </Link>
              <h1 className="text-3xl font-bold text-[var(--color-text)] tracking-tight flex items-center gap-3">
                <FaShapes className="text-[var(--color-secondary)]" /> مدیریت <span className="text-[var(--color-primary)]">دسته‌ها</span>
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <FaSearch className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text"
                  placeholder="جستجوی دسته‌بندی..."
                  className="bg-gray-100 border-none pr-11 pl-4 py-3 rounded-[var(--radius)] w-full md:w-72 outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/50 transition-all text-sm"
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                onClick={() => router.push('/p-admin/admin-categories/add')}
                className="bg-[var(--color-primary)] text-white px-6 py-3 rounded-[var(--radius)] hover:shadow-lg hover:shadow-[#aa472544] transition-all flex items-center justify-center gap-2 font-bold whitespace-nowrap"
              >
                <FaPlus /> افزودن دسته
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-10">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-40 bg-gray-100 animate-pulse rounded-[var(--radius)]"></div>
            ))}
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="bg-white rounded-[var(--radius)] border-2 border-dashed border-gray-200 p-20 text-center animate-fadeIn">
            <FaFolderOpen size={50} className="mx-auto text-gray-200 mb-4" />
            <p className="text-gray-400 font-bold text-lg">هیچ دسته‌بندی‌ای یافت نشد</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fadeIn">
            {filteredCategories.map((category) => {
              const count = getProductCount(category._id);
              return (
                <div
                  key={category._id}
                  onClick={() => router.push(`/p-admin/admin-categories/category-products/${category._id}`)}
                  className="group cursor-pointer bg-white rounded-[var(--radius)] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                >
                  {/* تصویر اصلی دسته‌بندی */}
                  <div className="relative h-44 bg-gray-200 overflow-hidden">
                    {category.image ? (
                      <img
                        src={category.image}
                        alt={category.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <FaShapes size={40} />
                      </div>
                    )}
                  </div>

                  {/* محتوای کارت */}
                  <div className="p-5">
                    {/* ردیف آیکون و نام دسته‌بندی */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0 flex items-center justify-center">
                        {category.icon ? (
                          <img src={category.icon} alt="icon" className="w-full h-full object-contain" />
                        ) : (
                          <FaFolderOpen className="text-[var(--color-primary)]" />
                        )}
                      </div>
                      <h3 className="text-xl font-bold group-hover:text-[var(--color-primary)] transition-colors truncate">
                        {category.title}
                      </h3>
                    </div>

                    {/* تعداد محصولات */}
                    <div className="flex items-center gap-2 text-sm text-gray-500 font-medium mb-6 min-h-[40px]">
                      <FaBoxOpen className={count > 0 ? "text-[var(--color-secondary)]" : "text-gray-300"} />
                      <span>{count} محصول ثبت شده</span>
                    </div>

                    {/* دکمه‌ها */}
                    <div className="flex items-center gap-2 border-t border-gray-50 pt-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/p-admin/admin-categories/edit/${category._id}`);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-[var(--radius)] bg-gray-50 text-gray-700 hover:bg-[var(--color-secondary)] hover:text-black font-bold text-sm transition-all"
                      >
                        <FiEdit3 size={16} /> ویرایش
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(category);
                        }}
                        className="w-10 h-10 flex items-center justify-center rounded-[var(--radius)] bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                      >
                        <FiTrash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}