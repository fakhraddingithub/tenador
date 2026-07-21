"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaChartPie,
  FaRunning,
  FaBold,
  FaBoxOpen,
  FaUsersCog,
  FaDollarSign,
  FaEuroSign,
  FaClock,
  FaMoneyBillWave,
  FaCalendarAlt,
  FaHeadset,
  FaFileAlt,
  FaBars,
  FaTimes,
} from "react-icons/fa";
import { HiOutlineLogout } from "react-icons/hi";
import { AiFillProduct } from "react-icons/ai";
import { RiMenuFoldLine, RiMenuUnfoldLine } from "react-icons/ri";
import { FiGitBranch } from "react-icons/fi";
import { ShoppingCart } from "lucide-react";
import NotificationBell from "./NotificationBell";
import { useNotifications } from "./NotificationProvider";

/* ─── منوی ساید‌بار (بازساخته‌شده — فاز ۱)
   حذف: صفحه اصلی، ورزشکاران، دسته‌بندی‌ها، نظرات، پیام‌های تماس، پشتیبانی اینستاگرام
   اضافه: پشتیبانی یکپارچه (نظرات + پیام تماس + اینستاگرام)
   ادغام‌های مرتبط: صفحه‌ی اصلی → داخل «صفحات سایت»؛ ورزشکاران/دسته‌بندی → داخل هر «ورزش»
   ─────────────────────────────────────────────────────────────── */
const menuItems = [
  { title: "داشبورد", href: "/p-admin", icon: FaChartPie },
  { title: "ورزش‌ها", href: "/p-admin/admin-sports", icon: FaRunning },
  { title: "برندها", href: "/p-admin/admin-brands", icon: FaBold },
  { title: "فرایند سفارش", href: "/p-admin/admin-order-flows", icon: FiGitBranch },
  { title: "محصولات", href: "/p-admin/admin-products", icon: AiFillProduct },
  { title: "کالکشن‌ها", href: "/p-admin/admin-events", icon: FaCalendarAlt },
  { title: "بازار دست دوم", href: "/p-admin/admin-secondHands", icon: FaBoxOpen },
  { title: "سفارشات", href: "/p-admin/admin-orders", icon: ShoppingCart },
  { title: "صفحات سایت", href: "/p-admin/admin-pages", icon: FaFileAlt },
  { title: "مدیریت مالی", href: "/p-admin/financial", icon: FaMoneyBillWave },
  { title: "کاربران", href: "/p-admin/users", icon: FaUsersCog },
  { title: "پشتیبانی", href: "/p-admin/support", icon: FaHeadset },
  { title: "\u0645\u0642\u0627\u0644\u0627\u062a", href: "/p-admin/admin-articles", icon: FaFileAlt },
];

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [prices, setPrices] = useState({ usd: "---", eur: "---" });
  const [time, setTime] = useState("");
  const [mounted, setMounted] = useState(false);

  // حالت اعلان‌ها از لایه‌ی متمرکز (تنها منبعِ حقیقت — بدون polling محلی)
  const { badgeFor } = useNotifications();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      const now = new Date();
      setTime(
        new Intl.DateTimeFormat("fa-IR", {
          hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Tehran",
        }).format(now)
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch("https://brsapi.ir/Api/Market/Gold_Currency.php?key=BUjlELnh5HDWl6BDTEEXp5DLf9g9qY7C");
        const data = await res.json();
        setPrices({
          usd: Number(data?.currency?.[1]?.price || 0),
          eur: Number(data?.currency?.[2]?.price || 0),
        });
      } catch (error) { console.error("Error fetching prices:", error); }
    };
    fetchPrices();
    const priceInterval = setInterval(fetchPrices, 600000);
    return () => clearInterval(priceInterval);
  }, []);

  const farsiNumber = new Intl.NumberFormat("fa-IR");
  const sidebarWidth = sidebarOpen ? 260 : 76;

  return (
    <div className="min-h-screen flex" dir="rtl" style={{ background: "var(--admin-bg)", fontFamily: 'var(--font-sans)' }}>
      {/* ─── Sidebar ─── */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        className={`admin-aside-mobile fixed right-0 top-[75px] h-[calc(100vh-75px)] z-50 flex flex-col overflow-hidden
          transition-transform duration-300 ease-in-out
          ${mobileOpen ? "max-lg:translate-x-0" : "max-lg:translate-x-full"}`}
        style={{ background: "var(--admin-sidebar-bg)" }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{ backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`, backgroundSize: "20px 20px" }} />

        <div className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: "linear-gradient(90deg, var(--color-primary), var(--color-secondary))" }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center justify-between px-4 py-5 border-b border-white/[0.06]">
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }} className="flex items-center gap-2.5">
                <div className="w-8 h-8 flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: "var(--color-primary)", borderRadius: "var(--admin-radius)" }}>T</div>
                <div>
                  <p className="text-white font-bold text-sm tracking-wider leading-none">TENADOR</p>
                  <p className="text-[10px] font-bold tracking-[0.2em] mt-0.5" style={{ color: "var(--color-secondary)" }}>ADMIN</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {!sidebarOpen && (
            <div className="w-8 h-8 flex items-center justify-center text-white text-xs font-bold mx-auto"
              style={{ background: "var(--color-primary)", borderRadius: "var(--admin-radius)" }}>T</div>
          )}
          {sidebarOpen && (
            <button onClick={() => setSidebarOpen(false)}
              className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all max-lg:hidden"
              style={{ borderRadius: "var(--admin-radius)" }}>
              <RiMenuFoldLine size={18} />
            </button>
          )}
        </div>

        {!sidebarOpen && (
          <div className="relative z-10 flex justify-center py-3 border-b border-white/[0.06] max-lg:hidden">
            <button onClick={() => setSidebarOpen(true)}
              className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
              style={{ borderRadius: "var(--admin-radius)" }}>
              <RiMenuUnfoldLine size={18} />
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="relative z-10 flex-1 overflow-y-auto admin-scrollbar py-4 px-2 space-y-0.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isDashboard = item.href === "/p-admin";
            const isActive = isDashboard ? pathname === "/p-admin" : pathname.startsWith(item.href);
            const badge = badgeFor(item.href);
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                title={!sidebarOpen ? item.title : ""}
                className={`relative flex items-center gap-3 px-3 py-2.5 transition-all duration-200 group
                  ${isActive ? "nav-item-active" : "text-white/45 hover:text-white/85 hover:bg-white/[0.05]"}`}
                style={{ borderRadius: "var(--admin-radius)" }}>
                <span className={`relative flex-shrink-0 transition-all duration-200 ${isActive ? "text-[var(--color-secondary)]" : "group-hover:scale-110"}`}>
                  <Icon size={16} />
                  {!sidebarOpen && badge > 0 && (
                    <span className="absolute -top-1.5 -left-1.5 w-2 h-2 rounded-full ring-2 ring-[#0f1a15]"
                      style={{ background: "var(--color-secondary)" }} />
                  )}
                </span>
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.2 }}
                      className="text-sm font-bold whitespace-nowrap overflow-hidden">
                      {item.title}
                    </motion.span>
                  )}
                </AnimatePresence>
                {sidebarOpen && badge > 0 && (
                  <motion.span key={`badge-${badge}`} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="mr-auto min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-[10px] font-bold tabular-nums"
                    style={{ background: "var(--color-secondary)", color: "#1a1a1a" }}>
                    {badge > 99 ? "۹۹+" : Number(badge).toLocaleString("fa-IR")}
                  </motion.span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="relative z-10 p-2 border-t border-white/[0.06]">
          <button className={`w-full flex items-center gap-3 px-3 py-2.5 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 ${!sidebarOpen ? "justify-center" : ""}`}
            style={{ borderRadius: "var(--admin-radius)" }}>
            <HiOutlineLogout size={18} />
            <AnimatePresence>
              {sidebarOpen && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm font-bold whitespace-nowrap">
                  خروج از پنل
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* ─── Main ─── */}
      <motion.div animate={{ marginRight: sidebarWidth }} transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        className="admin-main-mobile flex-1 flex flex-col min-h-screen min-w-0">
        {/* Header */}
        <header className="sticky top-[75px] z-40 flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b"
          style={{ background: "rgba(244,245,242,0.9)", backdropFilter: "blur(16px)", borderColor: "var(--admin-border)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="hidden sm:inline text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>پنل مدیریت</span>
            <span className="hidden sm:inline" style={{ color: "var(--admin-border)" }}>/</span>
            <span className="text-xs font-bold truncate" style={{ color: "var(--color-primary)" }}>
              {menuItems.find(m => m.href === "/p-admin" ? pathname === "/p-admin" : pathname.startsWith(m.href))?.title || "داشبورد"}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <NotificationBell />

            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold tabular-nums"
              style={{ background: "var(--color-primary-soft)", color: "var(--color-primary)", borderRadius: "var(--admin-radius)" }}>
              <FaClock size={11} className="animate-pulse" />
              {mounted ? time : "--:--:--"}
            </div>

            <div className="hidden md:flex items-center gap-4 px-4 py-1.5 border text-xs"
              style={{ background: "var(--admin-card)", borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: "var(--color-primary-soft)", color: "var(--color-primary)" }}>
                  <FaDollarSign size={9} />
                </div>
                <div>
                  <p style={{ color: "var(--admin-text-muted)" }} className="text-[10px] font-bold">دلار</p>
                  <p className="font-bold" style={{ color: "var(--admin-text)" }}>{farsiNumber.format(prices.usd)}</p>
                </div>
              </div>
              <div className="w-px h-6" style={{ background: "var(--admin-border)" }} />
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: "var(--color-secondary-soft)", color: "var(--admin-warning)" }}>
                  <FaEuroSign size={9} />
                </div>
                <div>
                  <p style={{ color: "var(--admin-text-muted)" }} className="text-[10px] font-bold">یورو</p>
                  <p className="font-bold" style={{ color: "var(--admin-text)" }}>{farsiNumber.format(prices.eur)}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 border cursor-pointer hover:shadow-sm transition-all"
              style={{ background: "var(--admin-card)", borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}>
              <div className="w-7 h-7 overflow-hidden flex items-center justify-center text-white text-xs font-bold"
                style={{ background: "var(--color-primary)", borderRadius: "var(--admin-radius)" }}>
                <img
                  src="https://ui-avatars.com/api/?name=Admin&background=004225&color=fff&size=56"
                  alt="Admin" className="w-full h-full object-cover" />
              </div>
              <div className="hidden md:block">
                <p className="text-xs font-bold leading-none" style={{ color: "var(--admin-text)" }}>مدیریت</p>
                <p className="text-[10px] font-bold mt-0.5" style={{ color: "var(--admin-text-muted)" }}>خوش آمدید</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 min-w-0">
          <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}>
            {children}
          </motion.div>
        </main>
      </motion.div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] lg:hidden" />
        )}
      </AnimatePresence>

      <motion.button type="button" aria-label={mobileOpen ? "بستن منو" : "باز کردن منو"} aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((v) => !v)} initial={false}
        animate={{ right: mobileOpen ? "280px" : 0 }} transition={{ duration: 0.3, ease: "easeInOut" }}
        className="fixed top-[150px] z-[60] lg:hidden flex items-center justify-center h-16 w-7 rounded-l-[6px] rounded-r-none text-white shadow-lg shadow-black/25 ring-1 ring-white/10 active:scale-95 transition-transform"
        style={{ background: "var(--admin-sidebar-bg)" }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={mobileOpen ? "close" : "menu"}
            initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            className="flex items-center justify-center">
            {mobileOpen ? <FaTimes size={18} /> : <FaBars size={18} />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
