"use client";

/**
 * فاز ۳ — بازطراحی صفحه‌ی «مدیریت مالی»
 * - جایگزینی تب‌های قدیمی با «Segmented Control» مشترک (SectionTabs)
 * - استفاده از PageHeader مشترک (عنوان + توضیح + آیکن)
 * - لینک‌های بیرونی (تحلیل، اقساط، تخفیف‌ها) به‌صورت چیپ‌های ثانویه‌ی هماهنگ
 * - بدون هیچ تغییر در منطق یا API — فقط لایه‌ی نمایشی
 */

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MdAccountBalance, MdOutlineCurrencyExchange, MdPercent } from "react-icons/md";
import { FiTag, FiArrowLeft, FiCalendar, FiBarChart2 } from "react-icons/fi";
import { FaMoneyBillWave } from "react-icons/fa";
import BankAccountManager from "@/components/admin/financial/BankAccountManager";
import ExchangeRateManager from "@/components/admin/financial/ExchangeRateManager";
import FinancingSettingsManager from "@/components/admin/financial/FinancingSettingsManager";
import PageHeader from "@/components/admin/PageHeader";
import SectionTabs from "@/components/admin/SectionTabs";

const TABS = [
  { value: "bank", label: "حساب بانکی", icon: MdAccountBalance },
  { value: "exchange", label: "نرخ تبدیل ارز", icon: MdOutlineCurrencyExchange },
  { value: "financing", label: "تنظیمات اقساط", icon: MdPercent },
];

const EXTERNAL_LINKS = [
  { href: "/p-admin/financial/analytics", label: "تحلیل و هوش فروش", icon: FiBarChart2 },
  { href: "/p-admin/financial/installments", label: "مدیریت اقساط", icon: FiCalendar },
  { href: "/p-admin/discounts", label: "تخفیف‌ها", icon: FiTag },
];

export default function FinancialManagementPage() {
  const [active, setActive] = useState("bank");

  return (
    <div dir="rtl" className="space-y-5">
      <PageHeader
        icon={<FaMoneyBillWave size={16} />}
        title="مدیریت مالی"
        subtitle="نرخ تبدیل ارز، تخفیف‌ها و اطلاعات حساب بانکی"
      />

      {/* Segmented Control — بخش‌های اصلی مالی */}
      <div className="flex flex-wrap items-center gap-3">
        <SectionTabs tabs={TABS} value={active} onChange={setActive} />

        {/* لینک‌های بیرونی هماهنگ با تم — چیپ ثانویه */}
        <div className="flex flex-wrap items-center gap-2">
          {EXTERNAL_LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className="group inline-flex items-center gap-2 px-3 py-2 text-xs font-bold transition-colors border"
                style={{
                  color: "var(--admin-text-muted)",
                  background: "var(--admin-card)",
                  borderColor: "var(--admin-border)",
                  borderRadius: "var(--admin-radius)",
                }}
              >
                <Icon size={13} />
                <span>{l.label}</span>
                <FiArrowLeft
                  size={12}
                  className="opacity-50 group-hover:-translate-x-0.5 transition-transform"
                />
              </Link>
            );
          })}
        </div>
      </div>

      {/* محتوای تب فعال */}
      <motion.div
        key={active}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        {active === "bank" && <BankAccountManager />}
        {active === "exchange" && <ExchangeRateManager />}
        {active === "financing" && <FinancingSettingsManager />}
      </motion.div>
    </div>
  );
}
