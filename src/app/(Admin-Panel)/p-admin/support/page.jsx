"use client";

/**
 * صفحه‌ی پشتیبانی — یکپارچه (فاز ۲).
 * سه تب: «نظرات»، «پیام‌های تماس»، «اینستاگرام».
 * کامپوننت‌های موجود بدون تغییرِ منطق در بدنه‌ی هر تب لود می‌شوند.
 * URL-sync سبک: ?tab=comments|messages|instagram
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FaCommentDots, FaEnvelopeOpenText, FaInstagram, FaHeadset } from "react-icons/fa";

import SectionTabs from "@/components/admin/SectionTabs";
import CommentsModeration from "@/components/admin/comments/CommentsModeration";
import ContactMessagesInbox from "@/components/admin/support/ContactMessagesInbox";
import InstagramInbox from "@/components/admin/support/InstagramInbox";

const VALID = new Set(["comments", "messages", "instagram"]);

export default function SupportPage() {
  const router = useRouter();
  const search = useSearchParams();
  const initial = search.get("tab");
  const [tab, setTab] = useState(VALID.has(initial) ? initial : "comments");

  const [contactNew, setContactNew] = useState(0);
  const [igUnread, setIgUnread] = useState(0);

  const syncBadges = useCallback(async () => {
    try {
      const [c, ig] = await Promise.all([
        fetch("/api/admin/contact-messages?status=new&limit=1").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/admin/instagram/unread").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (c) setContactNew(Number(c?.counts?.new || 0));
      if (ig) setIgUnread(Number(ig?.unread || 0));
    } catch {}
  }, []);

  useEffect(() => {
    syncBadges();
    const id = setInterval(syncBadges, 45000);
    return () => clearInterval(id);
  }, [syncBadges]);

  const handleChange = (v) => {
    setTab(v);
    const params = new URLSearchParams(Array.from(search.entries()));
    params.set("tab", v);
    router.replace(`/p-admin/support?${params.toString()}`, { scroll: false });
  };

  const tabs = useMemo(
    () => [
      { value: "comments", label: "نظرات", icon: FaCommentDots },
      { value: "messages", label: "پیام‌های تماس", icon: FaEnvelopeOpenText, badge: contactNew },
      { value: "instagram", label: "اینستاگرام", icon: FaInstagram, badge: igUnread },
    ],
    [contactNew, igUnread]
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
              مدیریت یکپارچه‌ی نظرات، پیام‌های تماس و دایرکت‌های اینستاگرام
            </p>
          </div>
        </div>
        <SectionTabs tabs={tabs} value={tab} onChange={handleChange} />
      </div>

      {/* Body — تنها یک تب در هر لحظه mount می‌شود تا polling چند-برابر نشود */}
      <div className="min-w-0">
        {tab === "comments" && <CommentsModeration />}
        {tab === "messages" && <ContactMessagesInbox />}
        {tab === "instagram" && <InstagramInbox />}
      </div>
    </div>
  );
}