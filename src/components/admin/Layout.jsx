'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  FaChartPie, FaRunning, FaBold, FaUserAstronaut, 
  FaFolderOpen, FaBoxOpen, FaUsersCog, FaBars, FaTimes, 
  FaHome
} from 'react-icons/fa';
import { HiOutlineLogout } from "react-icons/hi";
const menuItems = [
  { title: 'داشبورد', href: '/p-admin', icon: <FaChartPie /> },
  { title: 'صفحه اصلی', href: '/p-admin/admin-home', icon: <FaHome  /> },
  { title: 'ورزش‌ها', href: '/p-admin/admin-sports', icon: <FaRunning /> },
  { title: 'برندها', href: '/p-admin/admin-brands', icon: <FaBold /> },
  { title: 'ورزشکاران', href: '/p-admin/admin-athletes', icon: <FaUserAstronaut /> },
  // اینجا تغییر کرد:
  { title: 'دسته‌بندی‌ها', href: '/p-admin/admin-categories', icon: <FaFolderOpen /> }, 
  { title: 'محصولات', href: '/p-admin/admin-products', icon: <FaBoxOpen /> },
  { title: 'کاربران', href: '/p-admin/users', icon: <FaUsersCog /> },
];

export default function   AdminLayout({ children, title = 'داشبورد مدیریت' }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const sidebarWidth = sidebarOpen ? '280px' : '90px';

  return (
    <div className="min-h-screen bg-[#F4F7FE] flex" dir="rtl">
      
      {/* --- Sidebar --- */}
      <aside
        className={`fixed right-0 top-0 h-screen z-50 transition-all duration-500 ease-in-out p-4`}
        style={{ width: sidebarWidth }}
      >
        <div className="h-full bg-white/70 backdrop-blur-xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2.5rem] flex flex-col overflow-hidden relative group">
          
          {/* Decorative Gradient Background */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-[var(--color-primary)]/5 blur-[80px] rounded-full" />
          
          {/* Logo Section */}
          <div className="h-24 flex items-center justify-between px-6 relative z-10">
            {sidebarOpen && (
              <div className="flex flex-col">
                <span className="text-xl font-bold text-gray-800 tracking-tighter">TENADOR <span className="text-[var(--color-primary)]">ADMIN</span></span>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 text-gray-600 hover:bg-[var(--color-primary)] hover:text-white transition-all duration-300 shadow-sm"
            >
              {sidebarOpen ? <FaTimes /> : <FaBars />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 space-y-2 mt-4 relative z-10 overflow-y-auto no-scrollbar">
            {menuItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300 group/item ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-[#aa472533]'
                      : 'text-gray-500 hover:bg-gray-50'
                  } ${!sidebarOpen ? 'justify-center' : ''}`}
                  title={!sidebarOpen ? item.title : ''}
                >
                  <span className={`text-xl transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover/item:scale-120'}`}>
                    {item.icon}
                  </span>
                  
                  {sidebarOpen && (
                    <span className="font-bold text-sm whitespace-nowrap">{item.title}</span>
                  )}

                  {/* Active Indicator Light */}
                  {isActive && (
                    <div className="absolute left-2 w-1.5 h-6 bg-white/40 rounded-full blur-[1px]" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Logout Section */}
          <div className="p-4 border-t border-gray-50 relative z-10">
             <button className="w-full flex items-center gap-4 px-4 py-4 text-red-400 hover:bg-red-50 rounded-2xl transition-all font-bold">
                <HiOutlineLogout size={22} />
                {sidebarOpen && <span>خروج از پنل</span>}
             </button>
          </div>
        </div>
      </aside>

      {/* --- Main Content --- */}
      <div
        className="flex-1 transition-all duration-500 ease-in-out"
        style={{
          marginRight: sidebarWidth,
        }}
      >
        {/* Modern Header */}
        <header className="h-24 flex items-center justify-between px-8 sticky top-0 z-40">
           <div className="flex flex-col">
           </div>

           {/* Top Actions */}
           <div className="flex items-center gap-4 p-2  bg-white/60 backdrop-blur-md p-2 rounded-[1.5rem] border border-white shadow-sm">
              <div className="flex items-center gap-3 px-3">
                 <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-secondary)] p-[2px]">
                    <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center overflow-hidden">
                       <img src="https://ui-avatars.com/api/?name=Admin&background=random" alt="Admin" />
                    </div>
                 </div>
                 <div className="hidden md:block">
                    <p className="text-xs font-bold text-gray-800">مدیریت کل</p>
                    <p className="text-[10px] text-gray-400 font-bold">خوش آمدید</p>
                 </div>
              </div>
           </div>
        </header>

        {/* Page Container */}
        <main className="px-8 pb-12">
          <div className="animate-fadeIn transition-opacity duration-700">
            {children}
          </div>
        </main>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.6s ease-out forwards; }
      `}</style>
    </div>
  );
}