'use client';

import { FaEdit, FaTrash, FaLayerGroup, FaTags, FaRunning, FaMoneyBillWave, FaImage } from 'react-icons/fa';

export default function ProductCard({ product, onEdit, onDelete, onViewVariants }) {
  return (
    <div className="group bg-white rounded-2xl border overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col h-full" style={{ borderColor: '#e8e4df' }}>

      {/* Image */}
      <div className="relative h-48 overflow-hidden bg-gray-50">
        {product.mainImage ? (
          <img
            src={product.mainImage}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-200 gap-2">
            <FaImage size={32} />
            <span className="text-xs font-bold">بدون تصویر</span>
          </div>
        )}

        {/* Brand badge */}
        <div className="absolute top-3 right-3">
          <span className="bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-black text-gray-700 shadow-sm border border-gray-100/50">
            {product.brand?.name || 'بدون برند'}
          </span>
        </div>

        {/* Price badge */}
        <div className="absolute bottom-3 left-3">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shadow-lg text-xs font-black text-white"
            style={{ background: 'var(--color-primary)' }}
          >
            <FaMoneyBillWave size={10} style={{ color: 'var(--color-secondary)' }} />
            {(product.basePrice || 0).toLocaleString('fa-IR')}
            <span className="text-[9px] opacity-70 font-bold">تومان</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-sm font-black text-gray-800 mb-0.5 line-clamp-1 group-hover:text-[var(--color-primary)] transition-colors">
          {product.name}
        </h3>
        <p className="text-xs font-bold text-gray-400 mb-4">{product.modelName || 'مدل نامشخص'}</p>

        <div className="space-y-2 mb-4 flex-1">
          <div className="flex items-center justify-between text-[11px] font-bold py-1.5 border-b border-gray-50">
            <span className="text-gray-400 flex items-center gap-1.5">
              <FaLayerGroup size={10} style={{ color: 'var(--color-secondary)' }} /> دسته‌بندی
            </span>
            <span className="text-gray-700">{product.category?.title || '-'}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold py-1.5">
            <span className="text-gray-400 flex items-center gap-1.5">
              <FaRunning size={10} style={{ color: 'var(--color-secondary)' }} /> ورزش
            </span>
            <span className="text-gray-700">{product.sport?.name || '-'}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-auto">
          <button
            onClick={() => onEdit(product)}
            className="flex-[1.5] flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black bg-gray-900 text-white hover:bg-[var(--color-primary)] transition-all active:scale-95"
          >
            <FaEdit size={11} /> ویرایش
          </button>
          <button
            onClick={() => onViewVariants(product)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black bg-gray-50 text-gray-700 border border-gray-100 hover:border-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-all active:scale-95"
          >
            <FaTags size={11} /> واریانت
          </button>
          <button
            onClick={() => onDelete(product)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all active:scale-95 border border-red-100 flex-shrink-0"
          >
            <FaTrash size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}