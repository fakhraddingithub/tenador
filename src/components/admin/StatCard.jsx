'use client';

import Link from 'next/link';

export default function StatCard({ title, count, icon, color, href, trend }) {
  const card = (
    <div className="group bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-gray-200/60 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer">
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-transform duration-300 group-hover:scale-110 ${color}`}
        >
          {icon}
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className="text-3xl font-black text-gray-900 mb-1 tabular-nums">{count}</p>
      <p className="text-sm font-bold text-gray-400">{title}</p>
    </div>
  );

  if (href) {
    return <Link href={href}>{card}</Link>;
  }
  return card;
}