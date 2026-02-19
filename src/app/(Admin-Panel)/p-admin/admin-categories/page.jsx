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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fadeIn">
            {filteredCategories.map((category) => {
  const count = getProductCount(category._id);
  return (
    <div 
      key={category._id} 
      // اضافه شدن قابلیت کلیک روی کل کارت
      onClick={() => router.push(`/p-admin/admin-categories/category-products/${category._id}`)}
      className="group cursor-pointer bg-white rounded-[var(--radius)] border border-gray-100 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
    >
      
      {/* Decorative Background Icon */}
      <FaShapes className="absolute -bottom-4 -left-4 text-gray-50 text-6xl group-hover:text-[var(--color-secondary)]/10 transition-colors" />

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-3 rounded-2xl ${count > 0 ? 'bg-orange-50 text-[var(--color-primary)]' : 'bg-gray-50 text-gray-400'}`}>
            <FaFolderOpen size={24} />
          </div>
          
          {/* دکمه‌های عملیاتی - توقف انتشار کلیک (stopPropagation) برای اینکه با زدن دکمه حذف، صفحه عوض نشود */}
          <div className="flex gap-1">
            <button 
              onClick={(e) => {
                e.stopPropagation(); // جلوگیری از رفتن به صفحه دسته هنگام کلیک روی ویرایش
                router.push(`/p-admin/admin-categories/edit/${category._id}`);
              }}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all relative z-20"
            >
              <FaEdit size={16} />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation(); // جلوگیری از رفتن به صفحه دسته هنگام کلیک روی حذف
                handleDelete(category);
              }}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all relative z-20"
            >
              <FaTrash size={15} />
            </button>
          </div>
        </div>

        <h3 className="text-lg font-bold text-[var(--color-text)] mb-1 group-hover:text-[var(--color-primary)] transition-colors">
          {category.title}
        </h3>
        
        <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
          <FaBoxOpen className={count > 0 ? "text-[var(--color-secondary)]" : ""} />
          <span>{count} محصول ثبت شده</span>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-[var(--color-primary)] h-full transition-all duration-1000 shadow-[0_0_8px_var(--color-primary)]"
            style={{ width: `${Math.min(count * 10, 100)}%` }}
          ></div>
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