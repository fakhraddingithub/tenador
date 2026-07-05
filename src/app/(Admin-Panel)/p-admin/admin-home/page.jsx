'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FiLayout, FiImage, FiChevronLeft, FiLayers,
  FiGrid, FiTrendingUp, FiAward,
} from 'react-icons/fi';
import { FaArrowRight } from 'react-icons/fa';

const sections = [
  {
    href: '/p-admin/admin-home/slider',
    icon: FiImage,
    title: 'اسلایدر اصلی',
    desc: 'مدیریت تصاویر، متون، لینک‌ها و ترتیب نمایش اسلایدهای صفحه اول سایت.',
    badge: 'فعال',
    badgeColor: 'bg-green-50 text-green-600',
  },
  {
    href: '/p-admin/admin-home/banners',
    icon: FiGrid,
    title: 'بنرهای گرید',
    desc: 'ویرایش بنر افقی بزرگ، بنرهای عمودی کناری و نوار پایین صفحه.',
    badge: 'فعال',
    badgeColor: 'bg-green-50 text-green-600',
  },
  {
    href: '/p-admin/admin-home/product-sliders',
    icon: FiTrendingUp,
    title: 'اسلایدرهای محصول',
    desc: 'انتخاب و چیدمان محصولات اسلایدرهای «پرفروش‌ها» و «شگفت‌انگیزها» با جستجو و کشیدن و رها کردن.',
    badge: 'فعال',
    badgeColor: 'bg-green-50 text-green-600',
  },
  {
    href: '/p-admin/admin-home/roland-garros',
    icon: FiAward,
    title: 'بنر رولند گاروس',
    desc: 'ویرایش تمام متن‌ها، تصویر و لینک دکمه بنر رولند گاروس صفحه اصلی.',
    badge: 'فعال',
    badgeColor: 'bg-green-50 text-green-600',
  },
  {
    href: '#',
    icon: FiLayers,
    title: 'سایر بخش‌ها',
    desc: 'بلوک‌های اضافی قابل پیکربندی برای صفحه اصلی.',
    badge: 'به‌زودی',
    badgeColor: 'bg-amber-50 text-amber-600',
    disabled: true,
  },
];

export default function AdminHomeManager() {
  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/p-admin"
          className="inline-flex items-center gap-1.5 text-xs font-bold hover:gap-2.5 transition-all"
          style={{ color: 'var(--color-primary)' }}
        >
          <FaArrowRight size={11} /> بازگشت
        </Link>
        <div className="h-4 w-px bg-gray-200" />
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(170,71,37,0.1)' }}
          >
            <FiLayout size={17} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">مدیریت ویترین</h1>
            <p className="text-xs font-bold text-gray-400">بخش موردنظر را برای ویرایش انتخاب کنید</p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid md:grid-cols-2 gap-5 max-w-3xl">
        {sections.map((sec, i) => (
          <motion.div
            key={sec.href + i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
          >
            <Link
              href={sec.disabled ? '#' : sec.href}
              className={`group block bg-white rounded-2xl border overflow-hidden transition-all duration-300 ${
                sec.disabled
                  ? 'opacity-60 cursor-not-allowed'
                  : 'hover:shadow-xl hover:-translate-y-1'
              }`}
              style={{ borderColor: '#e8e4df' }}
              onClick={sec.disabled ? (e) => e.preventDefault() : undefined}
            >
              {/* top accent */}
              <div
                className="h-1 w-full transition-all duration-300"
                style={{
                  background: sec.disabled
                    ? '#e5e7eb'
                    : 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))',
                }}
              />

              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                    style={{
                      background: sec.disabled ? '#f3f4f6' : 'rgba(170,71,37,0.08)',
                      color: sec.disabled ? '#9ca3af' : 'var(--color-primary)',
                    }}
                  >
                    <sec.icon size={20} />
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${sec.badgeColor} border-transparent`}>
                    {sec.badge}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-gray-800 mb-2 group-hover:text-[var(--color-primary)] transition-colors">
                  {sec.title}
                </h3>
                <p className="text-xs font-bold text-gray-400 leading-relaxed mb-4">
                  {sec.desc}
                </p>

                {!sec.disabled && (
                  <div
                    className="flex items-center gap-1.5 text-xs font-bold group-hover:gap-3 transition-all"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    ورود به بخش
                    <FiChevronLeft size={13} />
                  </div>
                )}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
