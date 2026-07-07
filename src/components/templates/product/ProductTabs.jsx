"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiFileText, FiSettings, FiMessageSquare } from "react-icons/fi";
import ProductDescription from "./ProductDescription";
import ProductAttributesTable from "./ProductAttributesTable";
import ProductReviews from "./ProductReviews";
import ReviewForm from "@/components/reviews/ReviewForm";

const normalizeId = (id) => id?.toString?.() || String(id);

const getItemLinkProps = (link) => {
  const href = (link || "").trim();
  if (!href) return null;

  const isExternal = /^https?:\/\//i.test(href);
  return {
    href,
    ...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {}),
  };
};

const CustomTabItemLogo = ({ item, linkProps }) => {
  const className =
    "group flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden p-1 sm:h-[72px] sm:w-[72px]";

  const logo = item.image ? (
    <img
      src={item.image}
      alt={item.title || ""}
      className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
    />
  ) : (
    <FiFileText className="text-xl text-gray-300 transition-transform duration-300 group-hover:scale-105" />
  );

  if (linkProps) {
    return (
      <a {...linkProps} aria-label={item.title || "مشاهده آیتم"} className={className}>
        {logo}
      </a>
    );
  }

  return <div className={className}>{logo}</div>;
};

const CustomTabItemCard = ({ item }) => {
  const linkProps = getItemLinkProps(item.link);
  const title = item.title || "";
  const titleClass =
    "text-base font-extrabold leading-7 text-[#1a1a1a] transition-colors duration-200 hover:text-[#aa4725]";

  return (
    <article className="flex h-full items-start gap-4 p-2 text-right sm:p-3">
      <CustomTabItemLogo item={item} linkProps={linkProps} />
      <div className="min-w-0 flex-1 pt-1">
        <div className="relative inline-flex max-w-full pr-3 before:absolute before:right-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-[#aa4725] before:content-['']">
          {linkProps ? (
            <a {...linkProps} className={titleClass}>
              {title}
            </a>
          ) : (
            <h4 className={titleClass}>{title}</h4>
          )}
        </div>
        {item.description && (
          <p className="mt-2 pr-3 text-sm leading-7 text-gray-500">
            {item.description}
          </p>
        )}
      </div>
    </article>
  );
};

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

  const matchingCustomItems = useMemo(() => {
    if (!customTab?.enabled || !Array.isArray(customTab?.items)) return [];

    const customTabItemIdSet = new Set(
      customTabItemIds.filter(Boolean).map((id) => normalizeId(id))
    );

    return customTab.items.filter((item) =>
      customTabItemIdSet.has(normalizeId(item._id))
    );
  }, [customTab, customTabItemIds]);

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
      <div className="relative flex items-center gap-8 overflow-x-auto border-b border-gray-100 pb-px no-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative shrink-0 px-2 py-4 text-sm outline-none transition-all duration-300
                ${isActive ? "font-bold text-[#1a1a1a]" : "font-bold text-gray-400 hover:text-gray-600"}
              `}
            >
              <div className="flex items-center gap-2">
                <span className={`${isActive ? "opacity-100" : "opacity-40"}`}>
                  {tab.isCustom ? (
                    tab.iconUrl ? (
                      <img src={tab.iconUrl} alt="" className="inline-block h-4 w-4 object-contain" />
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

              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full bg-[#aa4725]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="relative min-h-[300px] py-10">
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
              <div className="rounded-[6px] border border-gray-100 bg-gray-50/50 p-1">
                <ProductAttributesTable attributes={attributes} technicalStats={technicalStats} />
              </div>
            )}
            {activeTab === "customTab" && (
              <div className="grid grid-cols-1 gap-4 px-2 md:grid-cols-2">
                {matchingCustomItems.map((item) => (
                  <CustomTabItemCard key={item._id || item.title} item={item} />
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
