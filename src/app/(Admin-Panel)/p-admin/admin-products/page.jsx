'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProductCard } from '@/components/admin';
import { showToast } from '@/lib/toast';
import { confirmDelete, showError } from '@/lib/swal';
import { FiPlus, FiBox, FiActivity, FiSearch, FiLayers, FiZap } from 'react-icons/fi';

export default function AdminProducts() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/product');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const text = await res.text();
      if (!text) {
        setProducts([]);
        return;
      }
      const data = JSON.parse(text);
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      showToast.error('خطا در بارگذاری محصولات');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (product) => {
    const confirmed = await confirmDelete(
      'حذف محصول',
      `آیا مطمئن هستید که می‌خواهید "${product.name}" را حذف کنید؟`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/product/${product._id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast.success('محصول با موفقیت حذف شد');
        fetchProducts();
      } else {
        const data = await res.json();
        showError('خطا', data.error || 'خطا در حذف محصول');
      }
    } catch (error) {
      showError('خطا', 'خطا در حذف محصول');
    }
  };

  const handleEdit = (product) => router.push(`/p-admin/admin-products/edit/${product._id}`);
  const handleViewVariants = (product) => router.push(`/p-admin/admin-products/${product._id}/variants`);

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[5%] right-[10%] w-[30%] h-[30%] bg-blue-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] left-[5%] w-[25%] h-[25%] bg-orange-500/5 blur-[100px] rounded-full" />
      </div>

      <main className="relative max-w-[1600px] mx-auto px-6 pt-10">
        
        {/* Top Action Bar */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 bg-white/70 backdrop-blur-2xl p-8 rounded-[3rem] border border-white shadow-xl shadow-gray-200/40">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-gray-900 rounded-[1.8rem] flex items-center justify-center text-white shadow-2xl shadow-gray-400 rotate-3">
              <FiBox size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[var(--color-primary)] font-bold text-[10px] uppercase tracking-[0.3em] mb-1">
                <FiActivity /> Inventory Management
              </div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                لیست <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-500">محصولات</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-3 px-6 py-4 bg-gray-100/50 rounded-2xl border border-gray-100 group focus-within:bg-white transition-all">
              <FiSearch className="text-gray-400" />
              <input type="text" placeholder="جستجو در انبار..." className="bg-transparent border-none outline-none text-sm font-bold w-48" />
            </div>
            
            <button
              onClick={() => router.push('/p-admin/admin-products/add')}
              className="flex items-center gap-3 bg-gradient-to-r from-[var(--color-primary)] to-orange-500 text-white px-8 py-4 rounded-[1.5rem] font-bold shadow-lg shadow-orange-200 hover:-translate-y-1 transition-all active:scale-95"
            >
              <FiPlus size={20} />
              <span>افزودن محصول جدید</span>
            </button>
          </div>
        </header>

        {/* Stats Strip */}
        <div className="flex gap-4 mb-10 overflow-x-auto no-scrollbar pb-2">
          <div className="flex-none px-6 py-3 bg-white border border-white rounded-2xl shadow-sm flex items-center gap-3">
             <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
             <span className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Total Products:</span>
             <span className="text-sm font-bold text-gray-900">{products.length}</span>
          </div>
          <div className="flex-none px-6 py-3 bg-white border border-white rounded-2xl shadow-sm flex items-center gap-3 text-gray-400">
             <FiLayers size={14} />
             <span className="text-xs font-bold italic">Sorted by Latest</span>
          </div>
        </div>

        {/* Main Content Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-gray-100 border-t-[var(--color-primary)] rounded-full animate-spin" />
              <FiZap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--color-primary)] animate-pulse" size={24} />
            </div>
            <span className="text-gray-400 font-bold text-xs uppercase tracking-[0.4em]">Synchronizing Data...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white/50 backdrop-blur-md rounded-[4rem] border-4 border-dashed border-white p-24 text-center">
            <div className="inline-flex p-8 bg-gray-100 rounded-full mb-6">
              <FiBox size={48} className="text-gray-300" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">انبار خالی است!</h3>
            <p className="text-gray-400 font-medium mb-8">هنوز هیچ محصولی به سیستم اضافه نشده است.</p>
            <button 
              onClick={() => router.push('/p-admin/admin-products/add')}
              className="text-[var(--color-primary)] font-bold uppercase text-sm tracking-widest hover:underline"
            >
              + Create First Product
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {products.map((product, index) => (
              <div 
                key={product._id} 
                className="group transition-all duration-700 hover:-translate-y-2"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <ProductCard
                  product={product}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onViewVariants={handleViewVariants}
                />
              </div>
            ))}
          </div>
        )}
      </main>
      
      {/* Footer Branding */}
      <footer className="mt-20 px-6 py-10 border-t border-gray-200/50 flex flex-col items-center opacity-30 italic">
         <div className="text-4xl font-bold text-gray-200 select-none tracking-tighter uppercase">Product Grid System v3.0</div>
      </footer>
    </div>
  );
}