'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaCalendarAlt, FaArrowRight, FaChevronLeft } from 'react-icons/fa';

// بخش Collection — هر زیربخش یک کارت دارد تا در آینده
// بخش‌های دیگری نیز به همین صفحه اضافه شوند
export default function AdminEvents() {
  const sections = [
    {
      title: 'کالکشن ها',
      subtitle: 'کالکشن ها',
      description:
        'Collectionهای فصلی، فروش ویژه و تجربه‌های تعاملی با هویت بصری مستقل و موتور انتخاب محصول.',
      href: '/p-admin/admin-events/campaigns',
      icon: FaCalendarAlt,
      count: null,
    },
  ];

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/p-admin"
          className="inline-flex items-center gap-1.5 text-xs font-bold mb-2 hover:gap-2.5 transition-all"
          style={{ color: 'var(--color-primary)' }}
        >
          <FaArrowRight size={11} /> بازگشت به داشبورد
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FaCalendarAlt style={{ color: 'var(--color-secondary)' }} size={18} />
          مدیریت <span style={{ color: 'var(--color-primary)' }}>Collection</span>
        </h1>
        <p className="text-sm font-bold text-gray-400 mt-0.5">
          Collectionهای فروشگاه را از اینجا مدیریت کنید
        </p>
      </div>

      {/* Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {sections.map((section, i) => {
          const Icon = section.icon;
          return (
            <motion.div
              key={section.href}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              <Link
                href={section.href}
                className="group block bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-5">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg"
                    style={{ background: 'var(--color-primary)' }}
                  >
                    <Icon size={24} />
                  </div>
                  {section.count !== null && (
                    <span className="text-xs font-bold text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full">
                      {section.count} مورد
                    </span>
                  )}
                </div>

                <h2 className="text-lg font-bold text-gray-900 group-hover:text-[var(--color-primary)] transition-colors">
                  {section.title}
                </h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-3">
                  {section.subtitle}
                </p>
                <p className="text-xs text-gray-500 leading-6 mb-5">
                  {section.description}
                </p>

                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary)] group-hover:gap-3 transition-all">
                  مدیریت {section.title}
                  <FaChevronLeft size={10} />
                </span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
