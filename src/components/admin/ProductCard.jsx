'use client';

import { FaEdit, FaTrash, FaLayerGroup, FaTags, FaRunning, FaMoneyBillWave, FaImage } from 'react-icons/fa';

export default function ProductCard({ product, onEdit, onDelete, onViewVariants }) {
  return (
    <div className="group bg-white rounded-[var(--radius)] border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden flex flex-col h-full">
      
      {/* Product Image Section */}
      <div className="relative h-52 overflow-hidden bg-gray-50">
        {product.mainImage ? (
          <img
            src={product.mainImage}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
            <FaImage size={40} />
            <span className="text-xs font-bold">بدون تصویر</span>
          </div>
        )}
        
        {/* Overlay Badges */}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <span className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-[var(--color-primary)] shadow-sm border border-orange-50 uppercase tracking-tighter">
            {product.brand?.name || 'بدون برند'}
          </span>
        </div>

        {/* Base Price Badge */}
        <div className="absolute bottom-3 left-3">
          <div className="bg-[var(--color-primary)] text-white px-3 py-1.5 rounded-lg shadow-lg text-sm font-bold flex items-center gap-1.5">
            <FaMoneyBillWave size={12} className="text-[var(--color-secondary)]" />
            {(product.basePrice || 0).toLocaleString('fa-IR')} 
            <span className="text-[10px] opacity-80 font-medium">تومان</span>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-5 flex flex-col flex-1">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-[var(--color-text)] mb-1 group-hover:text-[var(--color-primary)] transition-colors line-clamp-1">
            {product.name}
          </h3>
          <p className="text-xs text-gray-400 font-bold flex items-center gap-1">
             {product.modelName || 'مدل نامشخص'}
          </p>
        </div>

        {/* Info Grid */}
        <div className="space-y-2.5 mb-6 flex-1">
          <div className="flex items-center justify-between text-[11px] font-bold py-2 border-b border-gray-50">
            <span className="text-gray-400 flex items-center gap-1.5 uppercase">
              <FaLayerGroup size={12} className="text-[var(--color-secondary)]" /> دسته‌بندی
            </span>
            <span className="text-gray-700">{product.category?.title || '-'}</span>
          </div>
          
          <div className="flex items-center justify-between text-[11px] font-bold py-2 border-b border-gray-50">
            <span className="text-gray-400 flex items-center gap-1.5 uppercase">
              <FaRunning size={12} className="text-[var(--color-secondary)]" /> ورزش
            </span>
            <span className="text-gray-700">{product.sport?.name || '-'}</span>
          </div>
        </div>

        {/* Modern Action Buttons */}
        <div className="flex gap-2 mt-auto">
          <button
            onClick={() => onEdit(product)}
            className="flex-[1.5] bg-gray-900 text-white py-2.5 rounded-[var(--radius)] text-xs font-bold flex items-center justify-center gap-2 hover:bg-[var(--color-primary)] transition-all shadow-md active:scale-95"
          >
            <FaEdit /> ویرایش
          </button>
          
          <button
            onClick={() => onViewVariants(product)}
            className="flex-1 bg-white border border-gray-200 text-gray-700 py-2.5 rounded-[var(--radius)] text-xs font-bold flex items-center justify-center gap-2 hover:border-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-all active:scale-95"
            title="مشاهده واریانت‌ها"
          >
            <FaTags /> واریانت
          </button>

          <button
            onClick={() => onDelete(product)}
            className="w-10 h-10 bg-red-50 text-red-500 rounded-[var(--radius)] flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-95 border border-red-100"
            title="حذف محصول"
          >
            <FaTrash size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}