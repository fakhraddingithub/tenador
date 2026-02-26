"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProductDescription from "@/components/templates/product/ProductDescription";
import ProductAttributesTable from "@/components/templates/product/ProductAttributesTable";
import ProductReviews from "@/components/templates/product/ProductReviews";

/* ── ستاره‌ی رنگ پریمری ── */
function StarRow({ rating, max = 5 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className={`w-4 h-4 transition-colors ${
            i < rating ? "fill-[var(--color-primary)]" : "fill-gray-200"
          }`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

/* ── تب کارت سلامت ── */
function HealthCardTab({ healthScores, customFields, overallScore }) {
  const allFields = [
    ...(healthScores || []),
    ...(customFields || []).map((f) => ({ key: f.label, label: f.label, rating: f.rating, note: f.note })),
  ];

  if (allFields.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-sm">ارزیابی وضعیت برای این محصول ثبت نشده</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* امتیاز کلی */}
      {overallScore != null && (
        <div className="flex items-center gap-4 bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15 rounded-xl px-5 py-4">
          <div className="text-center">
            <p className="text-3xl font-black text-[var(--color-primary)]">{overallScore}</p>
            <p className="text-xs text-gray-400 font-bold">از ۱۰</p>
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-gray-700 mb-2">امتیاز کلی سلامت</p>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className="h-3 rounded-full bg-[var(--color-primary)] transition-all"
                style={{ width: `${(overallScore / 10) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* فیلدها */}
      <div className="grid gap-4 sm:grid-cols-2">
        {allFields.map((field, i) => (
          <div
            key={i}
            className="bg-white border border-gray-100 rounded-xl px-5 py-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-gray-700">{field.label || field.key}</p>
              <StarRow rating={field.rating} />
            </div>

            {/* progress bar فیلد */}
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
              <div
                className="h-1.5 rounded-full bg-[var(--color-primary)] transition-all"
                style={{ width: `${(field.rating / 5) * 100}%` }}
              />
            </div>

            {/* یادداشت */}
            {field.note && (
              <p className="text-xs text-gray-400 leading-relaxed mt-1">{field.note}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── تب‌های اصلی ── */
const tabs = [
  { id: "health",      label: "کارت سلامت",      icon: "🛡️" },
  { id: "description", label: "توضیحات تخصصی",   icon: "📄" },
  { id: "attributes",  label: "مشخصات فنی",       icon: "⚙️" },
  { id: "reviews",     label: "نظرات کاربران",    icon: "💬" },
];

const UsedProductTabs = ({
  healthScores,
  customFields,
  overallScore,
  description,
  attributes=[],
  technicalStats=[],
}) => {
  const [activeTab, setActiveTab] = useState("health");

  return (
    <div className="mt-24 w-full rtl text-right" dir="rtl">
      {/* هدر تب‌ها */}
      <div className="relative flex items-center gap-8 border-b border-gray-100 pb-px overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative px-2 py-4 text-sm transition-all duration-300 outline-none shrink-0
                ${isActive ? "font-bold text-[#1a1a1a]" : "font-bold text-gray-400 hover:text-gray-600"}
              `}
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs ${isActive ? "opacity-100" : "opacity-40"}`}>{tab.icon}</span>
                <span>{tab.label}</span>
              </div>
              {isActive && (
                <motion.div
                  layoutId="usedTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-[3px] bg-[var(--color-primary)] rounded-t-full"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* محتوا */}
      <div className="relative py-10 min-h-[300px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {activeTab === "health" && (
              <HealthCardTab
                healthScores={healthScores}
                customFields={customFields}
                overallScore={overallScore}
              />
            )}
            {activeTab === "description" && (
              <div className="prose prose-gray max-w-none leading-8">
                <ProductDescription description={description} />
              </div>
            )}
            {activeTab === "attributes" && (
              <div className="bg-gray-50/50 rounded-[6px] p-1 border border-gray-100">
                <ProductAttributesTable attributes={attributes} technicalStats={technicalStats} />
              </div>
            )}
            {activeTab === "reviews" && (
              <div className="px-2">
                <ProductReviews reviews={[]} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default UsedProductTabs;