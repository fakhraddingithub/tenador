"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiFileText, FiSettings, FiMessageSquare } from "react-icons/fi";
import ProductDescription from "./ProductDescription";
import ProductAttributesTable from "./ProductAttributesTable";
import ProductReviews from "./ProductReviews";
import ReviewForm from "@/components/reviews/ReviewForm";

const ProductTabs = ({
  description,
  attributes,
  technicalStats,
  customTab,
  customTabItemIds = [],
  productId,
  reviews = [],
  reviewStats = { count: 0, average: 0 },
}) => {
  const [activeTab, setActiveTab] = useState("description");
  const customTabItemIdSet = new Set(
    customTabItemIds.map((id) => id?.toString?.() || String(id))
  );
  const matchingCustomItems =
    customTab?.enabled && Array.isArray(customTab?.items)
      ? customTab.items.filter((item) =>
          customTabItemIdSet.has(item._id?.toString?.() || String(item._id))
        )
      : [];

  const tabs = [
    { id: "description", label: "توضیحات تخصصی", icon: FiFileText },
    { id: "attributes", label: "مشخصات فنی", icon: FiSettings },
    ...(matchingCustomItems.length > 0
      ? [
          {
            id: "customTab",
            label: customTab.name || "اطلاعات بیشتر",
            iconUrl: customTab.icon || null,
            isCustom: true,
          },
        ]
      : []),
    {
      id: "reviews",
      label: "نظرات کاربران",
      icon: FiMessageSquare,
      count: reviewStats.count,
    },
  ];

  return (
    <div className="mt-24 w-full rtl text-right" dir="rtl">
      {/* هدر تب‌ها با استایل مدرن */}
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
                <span className={`${isActive ? "opacity-100" : "opacity-40"}`}>
                  {tab.isCustom ? (
                    tab.iconUrl ? (
                      <img src={tab.iconUrl} alt="" className="w-4 h-4 object-contain inline-block" />
                    ) : (
                      <FiFileText className="text-sm" />
                    )
                  ) : (
                    <tab.icon className="text-sm" />
                  )}
                </span>
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-gray-500">
                    {tab.count.toLocaleString("fa-IR")}
                  </span>
                )}
              </div>

              {/* نشانگر متحرک هوشمند */}
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#aa4725] rounded-t-full"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* محتوای تب‌ها با انیمیشن ورود */}
      <div className="relative py-10 min-h-[300px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
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
            {activeTab === "customTab" && (
              <div className="space-y-4 px-2">
                {matchingCustomItems.map((item) => (
                  <div key={item._id} className="p-4 bg-gray-50/50 rounded-[6px] border border-gray-100">
                    {item.link ? (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-[#1a1a1a] hover:text-[#aa4725] transition-colors inline-flex items-center gap-1"
                      >
                        {item.title}
                      </a>
                    ) : (
                      <h4 className="font-bold text-[#1a1a1a]">{item.title}</h4>
                    )}
                    {item.description && (
                      <p className="mt-1.5 text-sm text-gray-500 leading-7">{item.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {activeTab === "reviews" && (
              <div className="space-y-6 px-2">
                <ReviewForm productId={productId} />
                <ProductReviews reviews={reviews} stats={reviewStats} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ProductTabs;
