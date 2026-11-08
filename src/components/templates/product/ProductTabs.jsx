"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { isKidsAudience } from "base/utils/targetAudience";
import { hasChartableStats } from "@/lib/technicalStatsChart.mjs";
import { motion, AnimatePresence } from "framer-motion";
import { FiArrowUpLeft, FiFileText, FiSettings, FiMessageSquare } from "react-icons/fi";
import ProductDescription from "./ProductDescription";
import ProductAttributesTable from "./ProductAttributesTable";
import MobileProductTabs, { useMobileProductLayout } from "./MobileProductTabs";

const ProductComparisonGraph = dynamic(
  () => import("@/components/templates/productCompare/ProductComparisonGraph"),
  { ssr: false, loading: () => <div className="min-h-[420px]" aria-hidden="true" /> },
);

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
    "flex h-20 w-[clamp(4rem,22vw,5.5rem)] shrink-0 items-center justify-center focus-visible:outline-none sm:h-[104px] sm:w-32";

  const logo = item.image ? (
    <img
      src={item.image}
      alt={item.title || ""}
      className="h-full w-full object-contain"
    />
  ) : (
    <FiFileText className="text-2xl text-stone-400" />
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
    "text-base font-extrabold leading-7 text-stone-900 [overflow-wrap:anywhere] sm:text-xl sm:leading-8";

  return (
    <article className="group/item flex min-w-0 items-center gap-3 py-3 text-right sm:gap-6 sm:py-4">
      <CustomTabItemLogo item={item} linkProps={linkProps} />
      <div className="min-w-0 flex-1 py-2 sm:py-3">
        <div>
          {linkProps ? (
            <a {...linkProps} className={`${titleClass} inline-flex max-w-full items-baseline gap-2 decoration-[#aa4725] underline-offset-4 hover:text-[#aa4725] group-has-[:focus-visible]/item:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#aa4725] motion-safe:transition-colors`}>
              <span className="min-w-0">{title}</span>
              <FiArrowUpLeft aria-hidden="true" className="size-3.5 shrink-0 self-center text-[#aa4725]" />
            </a>
          ) : (
            <h4 className={titleClass}>{title}</h4>
          )}
        </div>
        <span aria-hidden="true" className="mt-1.5 block h-px w-8 origin-right bg-[#aa4725]/45 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover/item:scale-x-125" />
        {item.description && (
          <p className="mt-1.5 text-sm leading-7 text-stone-600 [overflow-wrap:anywhere] sm:leading-8">
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
  targetAudience,
  customTab,
  customTabItemIds = [],
  reviewsPanel,
  reviewCount,
  mobileReviewCount,
}) => {
  const isMobile = useMobileProductLayout();
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
      countContent: isMobile ? mobileReviewCount : reviewCount,
    },
  ];

  const renderContent = (sectionId, isActive = true) => (
    <>
      {sectionId === "description" && (
        <div className="space-y-8">
          {isActive && !isKidsAudience(targetAudience) && hasChartableStats(technicalStats) && (
            <ProductComparisonGraph technicalStats={technicalStats} showBars />
          )}
          <div className="prose prose-gray max-w-none leading-8">
            <ProductDescription description={description} />
          </div>
        </div>
      )}
      {sectionId === "attributes" && (
        <div className="rounded-[6px] border border-gray-100 bg-gray-50/50 p-1">
          <ProductAttributesTable
            attributes={attributes}
            active={isActive}
            technicalStats={technicalStats}
            targetAudience={targetAudience}
            includeGraph={false}
          />
        </div>
      )}
      {sectionId === "customTab" && (
        <div className="grid min-w-0 grid-cols-1 divide-y divide-stone-200/80">
          {matchingCustomItems.map((item) => (
            <CustomTabItemCard key={item._id || item.title} item={item} />
          ))}
        </div>
      )}
      {sectionId === "reviews" && reviewsPanel}
    </>
  );

  if (isMobile) {
    return (
      <div className="mt-24 w-full rtl text-right" dir="rtl">
        <MobileProductTabs tabs={tabs} preserveOrder renderContent={renderContent} keepMounted={["description", "attributes", "customTab"]} />
      </div>
    );
  }

  return (
    <div className="mt-24 w-full rtl text-right" dir="rtl">
      <div className="relative hidden items-stretch gap-x-1 border-b border-gray-100 pb-px sm:flex sm:gap-x-2 lg:gap-x-8">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative min-w-0 flex-1 basis-0 px-0.5 py-2.5 text-[11px] leading-tight outline-none transition-all duration-300 sm:px-1.5 sm:py-3.5 sm:text-[13px] lg:shrink lg:grow-0 lg:basis-auto lg:px-2 lg:py-4 lg:text-sm
                ${isActive ? "font-bold text-[#1a1a1a]" : "font-bold text-gray-500 hover:text-gray-600"}
              `}
            >
              <div className="flex flex-col items-center justify-center gap-1 sm:flex-row sm:gap-1.5 lg:gap-2">
                <span className={`shrink-0 ${isActive ? "opacity-100" : "opacity-40"}`}>
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
                <span className="flex min-w-0 items-center justify-center gap-1 sm:gap-1.5 lg:justify-start lg:gap-2">
                  <span className="break-words">{tab.label}</span>
                  {tab.countContent ? <span className="inline-flex w-10 shrink-0 justify-center">{tab.countContent}</span> : tab.count > 0 && (
                    <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-gray-500">
                      {tab.count.toLocaleString("fa-IR")}
                    </span>
                  )}
                </span>
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
        {/* Keep searchable text in the document; expensive interactive panels
            still mount only when selected. The visible tab animation is unchanged. */}
        {tabs.filter(tab => tab.id !== activeTab && tab.id !== "reviews").map(tab => (
          <div key={tab.id} hidden>{renderContent(tab.id, false)}</div>
        ))}

        {/* initial={false} فقط رندر اول را بدون انیمیشن نشان می‌دهد تا تبِ توضیحات
            در HTML سرور مرئی باشد؛ initial خودِ فرزند برای تعویض تب فعال می‌ماند. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {renderContent(activeTab)}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ProductTabs;
