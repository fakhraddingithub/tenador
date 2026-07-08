"use client";

/**
 * صفحات سایت (فاز ۲) — «صفحه‌ی اصلی» به‌عنوان تب داخلی همین صفحه ادغام شد.
 * دو تب: «صفحه اصلی سایت» (ویترین) و «صفحات محتوایی».
 * منطق موجودِ PagesList و بخش‌های admin-home کاملاً حفظ می‌شود.
 * URL-sync سبک: ?tab=home|content
 */
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaFileAlt, FaHome } from "react-icons/fa";
import { FiChevronLeft, FiGrid, FiImage, FiLayers, FiTrendingUp, FiAward } from "react-icons/fi";

import SectionTabs from "@/components/admin/SectionTabs";
import PagesList from "@/components/admin/pages/PagesList";

const VALID = new Set(["home", "content"]);

const HOME_SECTIONS = [
  {
    href: "/p-admin/admin-home/slider",
    icon: FiImage,
    title: "اسلایدر اصلی",
    desc: "مدیریت تصاویر، متون و ترتیب اسلایدهای صفحه اول.",
  },
  {
    href: "/p-admin/admin-home/banners",
    icon: FiGrid,
    title: "بنرهای گرید",
    desc: "بنر افقی بزرگ، بنرهای عمودی کناری و نوار پایین صفحه.",
  },
  {
    href: "/p-admin/admin-home/product-sliders",
    icon: FiTrendingUp,
    title: "اسلایدرهای محصول",
    desc: "چیدمان محصولات «پرفروش‌ها» و «شگفت‌انگیزها».",
  },
  {
    href: "/p-admin/admin-home/roland-garros",
    icon: FiAward,
    title: "بنر رولند گاروس",
    desc: "ویرایش متون، تصویر و لینک دکمه‌ی بنر رولند گاروس.",
  },
  {
    href: "#",
    icon: FiLayers,
    title: "سایر بخش‌ها",
    desc: "بلوک‌های اضافی قابل پیکربندی.",
    disabled: true,
  },
];

function HomeSectionsPanel() {
  return (
    <div className="grid sm:grid-cols-2 gap-4 max-w-4xl">
      {HOME_SECTIONS.map((sec, i) => (
        <motion.div
          key={sec.href + i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.25 }}
        >
          <Link
            href={sec.disabled ? "#" : sec.href}
            onClick={sec.disabled ? (e) => e.preventDefault() : undefined}
            className={`group block border overflow-hidden transition-all duration-200 ${
              sec.disabled ? "opacity-60 cursor-not-allowed" : "hover:-translate-y-0.5 hover:shadow-lg"
            }`}
            style={{
              background: "var(--admin-card)",
              borderColor: "var(--admin-border)",
              borderRadius: "var(--admin-radius)",
            }}
          >
            <div
              className="h-1 w-full"
              style={{
                background: sec.disabled
                  ? "var(--admin-border)"
                  : "linear-gradient(90deg, var(--color-primary), var(--color-secondary))",
              }}
            />
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 flex items-center justify-center transition-transform group-hover:scale-105"
                  style={{
                    background: sec.disabled ? "var(--admin-bg)" : "var(--color-primary-soft)",
                    color: sec.disabled ? "var(--admin-text-muted)" : "var(--color-primary)",
                    borderRadius: "var(--admin-radius)",
                  }}
                >
                  <sec.icon size={17} />
                </div>
                {sec.disabled && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5"
                    style={{
                      background: "var(--color-secondary-soft)",
                      color: "var(--admin-warning)",
                      borderRadius: "999px",
                    }}
                  >
                    به‌زودی
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold mb-1" style={{ color: "var(--admin-text)" }}>
                {sec.title}
              </h3>
              <p className="text-xs font-bold leading-relaxed mb-3" style={{ color: "var(--admin-text-muted)" }}>
                {sec.desc}
              </p>
              {!sec.disabled && (
                <div
                  className="flex items-center gap-1.5 text-xs font-bold group-hover:gap-2 transition-all"
                  style={{ color: "var(--color-primary)" }}
                >
                  ورود به بخش <FiChevronLeft size={13} />
                </div>
              )}
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

export default function AdminPagesRoot() {
  const router = useRouter();
  const search = useSearchParams();
  const initial = search.get("tab");
  const [tab, setTab] = useState(VALID.has(initial) ? initial : "home");

  const tabs = useMemo(
    () => [
      { value: "home", label: "صفحه اصلی سایت", icon: FaHome },
      { value: "content", label: "صفحات محتوایی", icon: FaFileAlt },
    ],
    []
  );

  const handleChange = (v) => {
    setTab(v);
    const params = new URLSearchParams(Array.from(search.entries()));
    params.set("tab", v);
    router.replace(`/p-admin/admin-pages?${params.toString()}`, { scroll: false });
  };

  return (
    <div dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 flex items-center justify-center"
            style={{
              background: "var(--color-primary-soft)",
              color: "var(--color-primary)",
              borderRadius: "var(--admin-radius)",
            }}
          >
            <FaFileAlt size={16} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "var(--admin-text)" }}>
              صفحات سایت
            </h1>
            <p className="text-xs font-bold mt-0.5" style={{ color: "var(--admin-text-muted)" }}>
              مدیریت ویترین صفحه اصلی و محتوای صفحات اطلاع‌رسانی
            </p>
          </div>
        </div>
        <SectionTabs tabs={tabs} value={tab} onChange={handleChange} />
      </div>

      <div className="min-w-0">
        {tab === "home" ? <HomeSectionsPanel /> : <PagesList />}
      </div>
    </div>
  );
}