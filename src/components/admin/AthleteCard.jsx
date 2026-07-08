'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FaEdit, FaTrash, FaGlobe, FaUserCircle } from 'react-icons/fa';

/**
 * کارت ورزشکار (پنل ادمین) — نسخهٔ فاز ۱
 * حذف: قد، وزن، تاریخ تولد، افتخارات (مطابق درخواست کاربر)
 * فقط عکس + نام + ورزش + ملیت + دکمه‌های ویرایش/حذف
 */
export default function AthleteCard({ athlete, onDelete }) {
  return (
    <div
      className="group a-card a-card-hover overflow-hidden flex flex-col"
      style={{ borderRadius: 'var(--admin-radius)' }}
    >
      <div className="relative h-48 overflow-hidden" style={{ background: 'var(--admin-sidebar-bg)' }}>
        {athlete.photo ? (
          <Image
            src={athlete.photo}
            alt={athlete.title || athlete.name}
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/40">
            <FaUserCircle size={56} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />

        {/* Sport tag */}
        <div className="absolute top-3 right-3">
          <span
            className="px-2.5 py-1 text-[10px] font-bold bg-black/50 text-white backdrop-blur-sm border border-white/10"
            style={{ borderRadius: 'var(--admin-radius)' }}
          >
            {athlete.sport?.name || 'بدون رشته'}
          </span>
        </div>

        <div className="absolute bottom-4 right-4 left-4">
          <h2 className="text-white font-bold text-lg mb-0.5 leading-tight">{athlete.title || athlete.name}</h2>
          <p className="text-gray-200 text-xs flex items-center gap-1 font-bold">
            <FaGlobe style={{ color: 'var(--color-secondary)' }} size={10} />
            {athlete.nationality || 'ملیت نامشخص'}
          </p>
        </div>
      </div>

      {/* Footer — فقط اکشن‌ها */}
      <div className="p-3 flex gap-2 mt-auto">
        <Link
          href={`/p-admin/admin-athletes/edit/${athlete._id}`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition-all"
          style={{
            borderRadius: 'var(--admin-radius)',
            background: 'var(--admin-card)',
            color: 'var(--admin-text)',
            border: '1px solid var(--admin-border)',
          }}
        >
          <FaEdit size={12} /> ویرایش
        </Link>
        <button
          onClick={() => onDelete?.(athlete._id)}
          className="w-10 h-10 inline-flex items-center justify-center transition-all"
          style={{
            borderRadius: 'var(--admin-radius)',
            background: '#fbe9ea',
            color: 'var(--admin-danger)',
            border: '1px solid #f2c8ca',
          }}
          title="حذف"
        >
          <FaTrash size={12} />
        </button>
      </div>
    </div>
  );
}
