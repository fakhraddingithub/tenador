'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FiPlus, FiEdit3, FiTrash2, FiPackage } from 'react-icons/fi';
import { showToast } from '@/lib/toast';
import { confirmDelete } from '@/lib/swal';

const STATUS_LABEL = { available: 'موجود', sold: 'فروخته شده' };
const STATUS_COLOR = { available: 'bg-green-50 text-green-600', sold: 'bg-red-50 text-red-500' };

export default function UsedProductsPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchItems(); }, [page, status]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page });
      if (status) params.set('status', status);
      const res = await fetch(`/api/admin/used-products?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch {
      showToast.error('خطا در بارگذاری');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (item) => {
    const ok = await confirmDelete('حذف محصول دست‌دوم', `"${item.baseProduct?.name}" حذف می‌شود`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/used-products/${item._id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems(prev => prev.filter(i => i._id !== item._id));
        setTotal(prev => prev - 1);
        showToast.success('حذف شد');
      }
    } catch {
      showToast.error('خطا در حذف');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <FiPackage size={24} className="text-[var(--color-primary)]" />
          <div>
            <h1 className="text-2xl font-bold">محصولات دست‌دوم</h1>
            <p className="text-sm text-neutral-400">{total} آیتم</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="bg-neutral-50 border border-neutral-200 rounded-[var(--radius)] px-3 py-2 text-sm outline-none"
          >
            <option value="">همه</option>
            <option value="available">موجود</option>
            <option value="sold">فروخته شده</option>
          </select>
          <Link
            href="/p-admin/admin-secondHands/used-products/create"
            className="flex items-center gap-2 bg-[var(--color-primary)] text-white px-5 py-2.5 rounded-[var(--radius)] text-sm font-bold hover:opacity-90 transition-all"
          >
            <FiPlus /> افزودن
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-neutral-100 animate-pulse rounded-[var(--radius)]" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-neutral-200 rounded-[var(--radius)] text-neutral-400">
          آیتمی یافت نشد
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
           <div 
           key={item._id} 
           className="group flex flex-col md:flex-row items-start md:items-center gap-5 bg-white border border-neutral-100 rounded-2xl p-4 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-blue-100 transition-all duration-300 relative overflow-hidden"
         >
           {/* یک لاین تزئینی در لبه کارت که هنگام هاور ظاهر می‌شود */}
           <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity" />
         
           {/* Image Section */}
           <div className="relative w-20 h-20 md:w-16 md:h-16 rounded-xl overflow-hidden bg-neutral-50 flex-shrink-0 border border-neutral-100">
             {item.baseProduct?.mainImage ? (
               <img 
                 src={item.baseProduct.mainImage} 
                 alt={item.baseProduct?.name} 
                 className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
               />
             ) : (
               <FiPackage className="w-full h-full p-4 text-neutral-300" />
             )}
           </div>
         
           {/* Info Section */}
           <div className="flex-grow min-w-0 flex flex-col gap-1">
             <div className="flex flex-wrap items-center gap-2">
               <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-0.5 rounded-md">
                 {item.baseProduct?.category?.title || 'دسته‌بندی'}
               </span>
               <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ring-1 ring-inset ${STATUS_COLOR[item.status]} ring-opacity-20`}>
                 {STATUS_LABEL[item.status]}
               </span>
             </div>
             
             <h3 className="font-bold text-neutral-800 text-base truncate group-hover:text-[var(--color-primary)] transition-colors">
               {item.baseProduct?.name}
             </h3>
         
             <div className="flex items-center gap-4 mt-1">
               {item.overallScore != null && (
                 <div className="flex items-center gap-1">
                   <span className="text-orange-500 text-sm">★</span>
                   <span className="text-xs font-bold text-neutral-600">{item.overallScore}</span>
                   <span className="text-[10px] text-neutral-400">/۱۰</span>
                 </div>
               )}
               <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                 <div className="w-1 h-1 rounded-full bg-neutral-300" />
                 کد محصول: {item._id.slice(-6)}
               </span>
             </div>
           </div>
         
           {/* Price & Actions Section */}
           <div className="flex md:flex-col items-end justify-between w-full md:w-auto gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-neutral-50">
             <div className="text-right">
               <span className="block text-[10px] text-neutral-400 font-medium mb-0.5">قیمت فروش</span>
               <p className="font-bold text-lg text-neutral-900">
                 {item.price?.toLocaleString('fa-IR')} 
                 <span className="text-[10px] mr-1 font-normal text-neutral-500"></span>
               </p>
             </div>
         
             <div className="flex gap-1">
               <Link 
                 href={`/p-admin/admin-secondHands/used-products/${item._id}/edit`} 
                 className="p-2.5 text-neutral-500 hover:text-[var(--color-primary)] hover:bg-blue-50 rounded-xl transition-all"
                 title="ویرایش"
               >
                 <FiEdit3 size={18} />
               </Link>
               <button 
                 onClick={() => handleDelete(item)} 
                 className="p-2.5 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                 title="حذف"
               >
                 <FiTrash2 size={18} />
               </button>
             </div>
           </div>
         </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${
                p === page ? 'bg-[var(--color-primary)] text-white' : 'bg-white border border-neutral-200 hover:border-[var(--color-primary)] text-neutral-600'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}