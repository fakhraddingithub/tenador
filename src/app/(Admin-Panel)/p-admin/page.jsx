'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FaRunning, FaBold, FaUserAstronaut,
  FaFolderOpen, FaBoxOpen, FaArrowUp,
  FaChartLine, FaBolt
} from 'react-icons/fa';
import { FiTrendingUp, FiBell, FiArrowUpRight } from 'react-icons/fi';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: 'easeOut' },
});

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    sports: 0, brands: 0, athletes: 0, products: 0, categories: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const endpoints = ['/api/sports', '/api/brands', '/api/athletes', '/api/product', '/api/categories'];
      const responses = await Promise.all(endpoints.map(url => fetch(url)));
      const [sports, brands, athletes, products, categories] = await Promise.all(responses.map(res => res.json()));
      setStats({
        sports: sports.sports?.length || 0,
        brands: brands.brands?.length || 0,
        athletes: athletes.athletes?.length || 0,
        products: products.products?.length || 0,
        categories: categories.categories?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-3">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-2 border-gray-200 rounded-full" />
          <div className="absolute inset-0 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-sm font-bold text-gray-400 animate-pulse">در حال بارگذاری آمار...</p>
      </div>
    );
  }

  const chartBars = [40, 70, 45, 90, 65, 80, 55];

  return (
    <div className="space-y-6">
      {/* ─── Welcome ─── */}
      <motion.div {...fadeUp(0)} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            سلام، <span style={{ color: 'var(--color-primary)' }}>مدیر عزیز</span>
          </h1>
          <p className="text-sm font-bold text-gray-400 flex items-center gap-2">
            <FiTrendingUp size={14} style={{ color: 'var(--color-secondary)' }} />
            وضعیت امروز پلتفرم را بررسی کنید
          </p>
        </div>
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-[var(--radius)] border text-sm"
          style={{ background: '#fff', borderColor: '#e8e4df' }}
        >
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="font-bold text-gray-700">آخرین بروزرسانی:</span>
          <span className="font-bold text-gray-500">همین الان</span>
        </div>
      </motion.div>

      {/* ─── Bento Grid ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">

        {/* Hero card: Products */}
        <motion.div {...fadeUp(0.05)} className="col-span-2 lg:col-span-3">
          <Link
            href="/p-admin/admin-products"
            className="group relative overflow-hidden rounded-2xl p-7 flex flex-col justify-between min-h-[180px] transition-all duration-300 hover:shadow-2xl hover:shadow-gray-900/20 hover:-translate-y-1 block"
            style={{ background: '#0d0d0d' }}
          >
            <div
              className="absolute top-0 right-0 w-48 h-48 opacity-20 blur-[80px] group-hover:opacity-35 transition-opacity"
              style={{ background: 'var(--color-primary)' }}
            />
            <div className="relative z-10 flex justify-between items-start">
              <div
                className="w-12 h-12 rounded-[var(--radius)] flex items-center justify-center"
                style={{ background: 'rgba(255,191,0,0.12)', color: 'var(--color-secondary)' }}
              >
                <FaBoxOpen size={22} />
              </div>
              <span className="bg-green-500 text-white text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                <FaArrowUp size={8} /> فعال
              </span>
            </div>
            <div className="relative z-10">
              <p className="text-5xl font-bold text-white mb-1 tabular-nums">{stats.products}</p>
              <p className="text-sm font-bold text-white/50">محصول ثبت‌شده</p>
            </div>
          </Link>
        </motion.div>

        {/* Athletes card */}
        <motion.div {...fadeUp(0.1)} className="col-span-2 lg:col-span-3">
          <Link
            href="/p-admin/admin-athletes"
            className="group bg-white rounded-2xl p-7 border flex items-center gap-6 min-h-[180px] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 block"
            style={{ borderColor: '#e8e4df' }}
          >
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 group-hover:rotate-3 transition-transform duration-300"
              style={{ background: 'rgba(170,71,37,0.07)', color: 'var(--color-primary)' }}
            >
              <FaUserAstronaut size={38} />
            </div>
            <div>
              <p className="text-4xl font-bold text-gray-900 mb-1 tabular-nums">{stats.athletes}</p>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">قهرمانان</p>
              <div className="flex -space-x-2 space-x-reverse">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-7 h-7 rounded-full border-2 border-white bg-gray-100 overflow-hidden">
                    <img src={`https://i.pravatar.cc/56?img=${i + 10}`} alt="" />
                  </div>
                ))}
                <div
                  className="w-7 h-7 rounded-full border-2 border-white text-[9px] font-bold text-white flex items-center justify-center"
                  style={{ background: 'var(--color-primary)' }}
                >
                  +{stats.athletes}
                </div>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Small stat cards */}
        {[
          { href: '/p-admin/admin-sports', icon: FaRunning, count: stats.sports, label: 'رشته ورزشی', bg: 'rgba(59,130,246,0.07)', color: '#3b82f6' },
          { href: '/p-admin/admin-categories', icon: FaFolderOpen, count: stats.categories, label: 'دسته‌بندی', bg: 'rgba(168,85,247,0.07)', color: '#a855f7' },
          { href: '/p-admin/admin-brands', icon: FaBold, count: stats.brands, label: 'برند همکار', bg: 'rgba(236,72,153,0.07)', color: '#ec4899' },
        ].map((item, i) => (
          <motion.div key={item.href} {...fadeUp(0.15 + i * 0.05)} className="col-span-2">
            <Link
              href={item.href}
              className="group bg-white rounded-2xl p-5 border hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4 block"
              style={{ borderColor: '#e8e4df' }}
            >
              <div
                className="w-12 h-12 rounded-[var(--radius)] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform"
                style={{ background: item.bg, color: item.color }}
              >
                <item.icon size={22} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">{item.count}</p>
                <p className="text-xs font-bold text-gray-400">{item.label}</p>
              </div>
              <FiArrowUpRight size={16} className="mr-auto text-gray-200 group-hover:text-gray-400 transition-colors" />
            </Link>
          </motion.div>
        ))}
      </div>

      {/* ─── Bottom row: Chart + Notification ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div {...fadeUp(0.3)} className="lg:col-span-2 bg-white rounded-2xl p-6 border relative overflow-hidden" style={{ borderColor: '#e8e4df' }}>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-sm font-bold text-gray-800">تحلیل بازدیدها</h3>
              <p className="text-xs text-gray-400 font-bold mt-0.5">آمار هفت روز گذشته</p>
            </div>
            <select className="text-xs font-bold text-gray-600 bg-gray-50 border-none rounded-lg p-2 outline-none cursor-pointer">
              <option>۷ روز اخیر</option>
              <option>۳۰ روز اخیر</option>
            </select>
          </div>
          <div className="flex items-end justify-between gap-2 h-28">
            {chartBars.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group/bar">
                <div
                  className="w-full rounded-lg transition-all duration-500 hover:opacity-100 cursor-pointer relative"
                  style={{
                    height: `${h}%`,
                    background: h === Math.max(...chartBars)
                      ? 'var(--color-primary)'
                      : 'rgba(170,71,37,0.12)',
                    opacity: 0.8,
                  }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] px-1.5 py-0.5 rounded font-bold opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap">
                    {h}%
                  </div>
                </div>
                <span className="text-[10px] text-gray-300 font-bold">
                  {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'][i]}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          {...fadeUp(0.35)}
          className="rounded-2xl p-6 flex flex-col justify-between text-white min-h-[180px] relative overflow-hidden"
          style={{ background: '#0d0d0d' }}
        >
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,191,0,0.5) 1px, transparent 0)`,
              backgroundSize: '18px 18px',
            }}
          />
          <div className="relative z-10 flex justify-between items-start">
            <FiBell size={20} className="text-white/60 animate-bounce" />
            <button className="text-[10px] font-bold uppercase bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all">
              مشاهده همه
            </button>
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <FaBolt size={12} style={{ color: 'var(--color-secondary)' }} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-secondary)' }}>
                اعلان سیستم
              </span>
            </div>
            <h3 className="text-lg font-bold mb-1">در انتظار تایید</h3>
            <p className="text-xs text-white/50 font-bold leading-relaxed">
              ۳ محصول جدید برای تایید نهایی در صف انتظار هستند.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}