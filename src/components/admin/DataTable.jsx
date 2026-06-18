'use client';

import Button from './Button';
import { FiEdit3, FiTrash2, FiInbox } from 'react-icons/fi';

export default function DataTable({
  columns,
  data,
  onEdit,
  onDelete,
  loading = false,
  emptyMessage = 'داده‌ای وجود ندارد',
}) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-12 text-center">
          <div className="inline-flex items-center gap-3 text-gray-400">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-[var(--color-primary)] rounded-full animate-spin" />
            <span className="text-sm font-bold">در حال بارگذاری...</span>
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
        <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300">
          <FiInbox size={28} />
        </div>
        <p className="text-gray-400 font-bold text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-right">
          <thead>
            <tr style={{ background: '#faf9f8' }} className="border-b border-gray-100">
              {columns.map((column, index) => (
                <th
                  key={index}
                  className="px-5 py-3.5 text-xs font-black text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {column.header}
                </th>
              ))}
              {(onEdit || onDelete) && (
                <th className="px-5 py-3.5 text-xs font-black text-gray-500 uppercase tracking-wider w-28">
                  عملیات
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="hover:bg-gray-50/60 transition-colors duration-150 group"
              >
                {columns.map((column, colIndex) => (
                  <td key={colIndex} className="px-5 py-3.5 text-sm text-gray-700 font-medium whitespace-nowrap">
                    {column.render ? column.render(row[column.accessor], row) : row[column.accessor]}
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(row)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-[var(--color-primary)] hover:text-white transition-all"
                          title="ویرایش"
                        >
                          <FiEdit3 size={14} />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(row)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                          title="حذف"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}