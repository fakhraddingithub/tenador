"use client";

/**
 * صفحه‌ی پشتیبانی — یکپارچه.
 * سه تب: «تیکت‌ها» (پیش‌فرض)، «نظرات»، «پیام‌های تماس».
 * کامپوننت‌های موجود بدون تغییرِ منطق در بدنه‌ی هر تب لود می‌شوند.
 * URL-sync سبک: ?tab=tickets|comments|messages
 */
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FaCommentDots, FaEnvelopeOpenText, FaTicketAlt, FaHeadset } from "react-icons/fa";

import SectionTabs from "@/components/admin/SectionTabs";
import CommentsModeration from "@/components/admin/comments/CommentsModeration";
import ContactMessagesInbox from "@/components/admin/support/ContactMessagesInbox";
import TicketsBoard from "@/components/admin/support/TicketsBoard";
import { useNotifications } from "@/components/admin/NotificationProvider";

const VALID = new Set(["tickets", "comments", "messages"]);

function SupportPageContent() {
  const router = useRouter();
  const search = useSearchParams();
  const initial = search.get("tab");
  const [tab, setTab] = useState(VALID.has(initial) ? initial : "tickets");

  // بَج‌ها از لایه‌ی متمرکز (همان اعداد سایدبار و زنگوله — بدون polling جداگانه)
  const { byType, contactNew } = useNotifications();
  const ticketsUnread = byType?.new_ticket || 0;

  const handleChange = (v) => {
    setTab(v);
    const params = new URLSearchParams(Array.from(search.entries()));
    params.set("tab", v);
    router.replace(`/p-admin/support?${params.toString()}`, { scroll: false });
  };

  const tabs = useMemo(
    () => [
      { value: "tickets", label: "تیکت‌ها", icon: FaTicketAlt, badge: ticketsUnread },
      { value: "comments", label: "نظرات", icon: FaCommentDots },
      { value: "messages", label: "پیام‌های تماس", icon: FaEnvelopeOpenText, badge: contactNew },
    ],
    [contactNew, ticketsUnread]
  );

  return (
    <div dir="rtl">
      {/* Page header — الگوی مشترک (اکشن‌ها/تبِ سرصفحه بالا-چپ کنار عنوان) */}
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
            <FaHeadset size={16} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "var(--admin-text)" }}>
              مرکز پشتیبانی
            </h1>
            <p className="text-xs font-bold mt-0.5" style={{ color: "var(--admin-text-muted)" }}>
              مدیریت یکپارچه‌ی تیکت‌ها، نظرات و پیام‌های تماس
            </p>
          </div>
        </div>
        <SectionTabs tabs={tabs} value={tab} onChange={handleChange} />
      </div>

      {/* Body — تنها یک تب در هر لحظه mount می‌شود تا polling چند-برابر نشود */}
      <div className="min-w-0">
        {tab === "tickets" && <TicketsBoard />}
        {tab === "comments" && <CommentsModeration />}
        {tab === "messages" && <ContactMessagesInbox />}
      </div>
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={null}>
      <SupportPageContent />
    </Suspense>
  );
}
