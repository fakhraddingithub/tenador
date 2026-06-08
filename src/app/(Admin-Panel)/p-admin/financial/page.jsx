"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MdAccountBalance, MdOutlineCurrencyExchange } from "react-icons/md";
import { FiTag, FiArrowLeft } from "react-icons/fi";
import { FaMoneyBillWave } from "react-icons/fa";
import BankAccountManager from "@/components/admin/financial/BankAccountManager";
import ExchangeRateManager from "@/components/admin/financial/ExchangeRateManager";

const TABS = [
  { key: "bank", title: "حساب بانکی", icon: MdAccountBalance },
  { key: "exchange", title: "نرخ تبدیل ارز", icon: MdOutlineCurrencyExchange },
];

export default function FinancialManagementPage() {
  const [active, setActive] = useState("bank");

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-9 h-9 rounded-[var(--radius)] flex items-center justify-center"
          style={{ background: "rgba(170,71,37,0.1)" }}
        >
          <FaMoneyBillWave size={18} style={{ color: "var(--color-primary)" }} />
        </div>
        <div>
          <h1 className="text-base font-bold text-gray-900">مدیریت مالی</h1>
          <p className="text-xs font-bold text-gray-400">
            نرخ تبدیل ارز، تخفیف‌ها و اطلاعات حساب بانکی
          </p>
        </div>
      </div>

      {/* Tabs / section navigation */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold transition-all border-2
                ${isActive
                  ? "text-white border-transparent shadow-sm"
                  : "bg-white text-gray-500 border-gray-200 hover:border-[var(--color-primary)]/40 hover:text-gray-700"}`}
              style={isActive ? { background: "var(--color-primary)" } : {}}
            >
              <Icon size={16} />
              {tab.title}
            </button>
          );
        })}

        {/* بخش تخفیف‌ها — مستقیماً به صفحه‌ی تخفیف‌ها لینک می‌شود */}
        <Link
          href="/p-admin/discounts"
          className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-bold transition-all border-2
            bg-white text-gray-500 border-gray-200 hover:border-[var(--color-primary)]/40 hover:text-gray-700 group"
        >
          <FiTag size={16} />
          تخفیف‌ها
          <FiArrowLeft size={14} className="opacity-50 group-hover:-translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Section content */}
      <motion.div
        key={active}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {active === "bank" && <BankAccountManager />}
        {active === "exchange" && <ExchangeRateManager />}
      </motion.div>
    </div>
  );
}
