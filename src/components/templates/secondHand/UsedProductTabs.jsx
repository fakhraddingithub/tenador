"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProductDescription from "@/components/templates/product/ProductDescription";
import ProductAttributesTable from "@/components/templates/product/ProductAttributesTable";
import ProductReviews from "@/components/templates/product/ProductReviews";
import { FiCheckCircle, FiInfo, FiStar } from 'react-icons/fi';

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
    ...(customFields || []).map((f) => ({
      key: f.label,
      label: f.label,
      rating: f.rating,
      note: f.note,
    })),
  ];

  if (allFields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-neutral-50/50 rounded-3xl border-2 border-dashed border-neutral-200">
        <FiInfo className="text-neutral-300 mb-4" size={40} />
        <p className="text-neutral-500 font-medium">هنوز ارزیابی فنی برای این محصول ثبت نشده است.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10" dir="rtl">
      {/* ─── Hero Score Section ─── */}
      {overallScore != null && (
        <div className="relative overflow-hidden bg-[#20232ae6] rounded-[6px] p-8 text-white shadow-2xl">
          {/* دکوراسیون پس‌زمینه */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-[var(--color-primary)] opacity-20 blur-[80px] -translate-x-1/2 -translate-y-1/2" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="flex flex-col items-center">
              <div className="relative flex items-center justify-center w-32 h-32">
                <div className="text-center">
                  <span className="block text-5xl font-black leading-none">{overallScore}</span>
                  <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">از 10</span>
                </div>
                {/* حلقه پیشرفت تزئینی */}
                <svg className="absolute inset-[-4px] w-[136px] h-[136px] -rotate-90">
  {/* حلقه پس‌زمینه (کم‌رنگ) - برای نشان دادن کل مسیر */}
  <circle
    cx="68"
    cy="68"
    r="66"
    fill="none"
    stroke="currentColor"
    strokeWidth="4"
    className="text-white/10" // یا خاکستری خیلی روشن اگر پس‌زمینه روشن است
  />
  
  {/* حلقه اصلی (پررنگ) */}
  <circle
    cx="68"
    cy="68"
    r="66"
    fill="none"
    stroke="var(--color-primary)"
    strokeWidth="4"
    strokeDasharray={414}
    strokeDashoffset={414 - (414 * overallScore) / 10}
    strokeLinecap="round"
    className="transition-all duration-1000 ease-out"
  />
</svg>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-xl font-black mb-1">گزارش سلامت فنی</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">
                  این امتیاز بر اساس بررسی دقیق کارشناسان ما در بخش‌های فنی، ظاهری و عملکردی محاسبه شده است.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Badge icon={<FiCheckCircle />} text="تضمین اصالت" />
                <Badge icon={<FiCheckCircle />} text="تست فیزیکی" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Detailed Metrics Grid ─── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {allFields.map((field, i) => (
          <div
            key={i}
            className="group relative bg-white border border-neutral-100 rounded-[6px] p-5 hover:border-[var(--color-primary)]/30 hover:shadow-xl hover:shadow-neutral-500/5 transition-all duration-300"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="space-y-1">
                <p className="text-[15px] font-extrabold text-neutral-800 group-hover:text-[var(--color-primary)] transition-colors">
                  {field.label || field.key}
                </p>
                <div className="flex gap-0.5">
                    {[...Array(5)].map((_, index) => (
                        <FiStar 
                            key={index} 
                            size={12} 
                            className={`${index < field.rating ? 'fill-orange-400 text-orange-400' : 'text-neutral-200'}`}
                        />
                    ))}
                </div>
              </div>
              <span className="text-xs font-black text-neutral-300">0{field.rating} / 05</span>
            </div>

            {/* نوار وضعیت مدرن */}
            <div className="relative h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="absolute top-0 right-0 h-full bg-gradient-to-l from-[var(--color-primary)] to-[var(--color-primary)]/60 rounded-full transition-all duration-700"
                style={{ width: `${(field.rating / 5) * 100}%` }}
              />
            </div>

            {field.note && (
              <div className="mt-4 flex gap-2 items-start bg-neutral-50 p-3 rounded-[6px]">
                <FiInfo className="text-neutral-400 shrink-0 mt-0.5" size={14} />
                <p className="text-[11px] text-neutral-500 leading-5">{field.note}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Badge({ icon, text }) {
  return (
    <div className="flex items-center gap-1.5 py-1.5 px-3 bg-white/10 backdrop-blur-md border border-white/10 rounded-[6px] text-[10px] font-bold">
      <span className="text-[var(--color-primary)]">{icon}</span>
      {text}
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