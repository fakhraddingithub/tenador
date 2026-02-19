'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FaRunning, FaBold, FaUserAstronaut,
  FaFolderOpen, FaBoxOpen, FaArrowUp,
  FaChartLine, FaRegBell, FaBolt
} from 'react-icons/fa';

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
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 border-4 border-[var(--color-primary)]/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-gray-400 font-bold animate-pulse">در حال تجزیه و تحلیل داده‌ها...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Welcome Section */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 tracking-tight mb-2">
            سلام، <span className="text-[var(--color-primary)]">مدیر عزیز!</span> 👋
          </h1>
          <p className="text-gray-400 font-bold flex items-center gap-2">
            <FaChartLine className="text-[var(--color-secondary)]" /> وضعیت امروز پلتفرم را بررسی کنید.
          </p>
        </div>
        <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-white flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-gray-400 font-bold uppercase">آخرین آپدیت</p>
            <p className="text-xs font-bold text-gray-700">همین الان</p>
          </div>
          <div className="w-10 h-10 bg-green-50 text-green-500 rounded-xl flex items-center justify-center animate-pulse">
            <FaBolt />
          </div>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-6">

        {/* Big Card: Products */}
        <Link href="/p-admin/admin-products" className="md:col-span-2 lg:col-span-3 group relative overflow-hidden bg-gray-900 rounded-[2.5rem] p-8 transition-all hover:shadow-2xl hover:shadow-orange-900/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary)] opacity-20 blur-[100px] -mr-20 -mt-20 group-hover:opacity-40 transition-opacity" />
          <div className="relative z-10 h-full flex flex-col justify-between text-white">
            <div className="flex justify-between items-start">
              <div className="p-4 bg-white/10 backdrop-blur-xl rounded-2xl">
                <FaBoxOpen size={30} className="text-[var(--color-secondary)]" />
              </div>
              <span className="bg-green-500 text-white text-[10px] px-3 py-1 rounded-full font-bold flex items-center gap-1">
                <FaArrowUp />
              </span>
            </div>
            <div>
              <p className="text-6xl font-bold mb-2">{stats.products}</p>
              <h3 className="text-xl font-bold opacity-80">محصولات ثبت شده</h3>
            </div>
          </div>
        </Link>

        {/* Medium Card: Athletes */}
        <Link href="/p-admin/admin-athletes" className="md:col-span-2 lg:col-span-3 group bg-white rounded-[2.5rem] p-8 border border-white shadow-sm hover:shadow-xl transition-all flex items-center gap-8">
          <div className="w-32 h-32 bg-orange-50 rounded-[2rem] flex items-center justify-center text-[var(--color-primary)] group-hover:rotate-6 transition-transform">
            <FaUserAstronaut size={50} />
          </div>
          <div>
            <p className="text-5xl font-bold text-gray-800 mb-1">{stats.athletes}</p>
            <h3 className="text-lg font-bold text-gray-400 uppercase tracking-widest">قهرمانان</h3>
            <div className="mt-4 flex -space-x-3 space-x-reverse">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 overflow-hidden">
                  <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="user" />
                </div>
              ))}
              <div className="w-8 h-8 rounded-full border-2 border-white bg-[var(--color-primary)] text-white text-[10px] flex items-center justify-center font-bold">
                +{stats.athletes}
              </div>
            </div>
          </div>
        </Link>

        {/* Small Card: Sports */}
        <Link href="/p-admin/admin-sports" className="md:col-span-2 group bg-white rounded-[2.5rem] p-6 border border-white shadow-sm hover:border-[var(--color-primary)] transition-all">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <FaRunning size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.sports}</p>
              <h3 className="text-sm font-bold text-gray-400">رشته ورزشی</h3>
            </div>
          </div>
        </Link>

        {/* Small Card: Categories */}
        <Link href="/p-admin/admin-categories" className="md:col-span-2 group bg-white rounded-[2.5rem] p-6 border border-white shadow-sm hover:border-[var(--color-primary)] transition-all">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <FaFolderOpen size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.categories}</p>
              <h3 className="text-sm font-bold text-gray-400">دسته‌بندی</h3>
            </div>
          </div>
        </Link>

        {/* Small Card: Brands */}
        <Link href="/p-admin/admin-brands" className="md:col-span-2 group bg-white rounded-[2.5rem] p-6 border border-white shadow-sm hover:border-[var(--color-primary)] transition-all">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-pink-50 text-pink-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <FaBold size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.brands}</p>
              <h3 className="text-sm font-bold text-gray-400">برند همکار</h3>
            </div>
          </div>
        </Link>

      </div>

      {/* Analytics Visualization Placeholder */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 border border-white shadow-sm relative overflow-hidden h-64">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-bold text-gray-800">تحلیل بازدیدها</h3>
            <select className="bg-gray-50 border-none rounded-xl text-xs font-bold p-2 outline-none">
              <option>۷ روز اخیر</option>
              <option>۳۰ روز اخیر</option>
            </select>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-32 px-4 flex items-end justify-between">
            {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
              <div key={i} className="w-10 bg-orange-100 rounded-t-xl hover:bg-[var(--color-primary)] transition-all cursor-pointer relative group/bar" style={{ height: `${h}%` }}>
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity">%{h}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] rounded-[2.5rem] p-8 text-white flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <FaRegBell size={24} className="animate-bounce" />
            <button className="text-[10px] font-bold uppercase bg-white/20 px-3 py-1 rounded-full">مشاهده همه</button>
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-2">اعلان‌های سیستم</h3>
            <p className="text-sm opacity-80 leading-relaxed font-bold">۳ محصول جدید برای تایید نهایی در صف انتظار هستند. بررسی کنید!</p>
          </div>
        </div>
      </div>
    </div>
  );
}