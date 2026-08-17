"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiArrowRight, FiBookOpen, FiSave } from "react-icons/fi";
import { toast } from "react-toastify";
import PageHeader from "@/components/admin/PageHeader";
import { useAdminPermissions } from "@/components/admin/AdminPermissionProvider";

const SETTING_KEY = "home_featured_article_ids";
const EMPTY_POSITIONS = Array(8).fill("");

export default function FeaturedArticlesManager() {
  const { can } = useAdminPermissions();
  const canEdit = can("homeFeaturedArticles.edit");
  const [articles, setArticles] = useState([]);
  const [positions, setPositions] = useState(EMPTY_POSITIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/articles?status=published&limit=100", { credentials: "include" }).then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      }),
      fetch(`/api/admin/site-settings?key=${SETTING_KEY}`, { credentials: "include" }).then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      }),
    ])
      .then(([articleData, settingData]) => {
        setArticles((articleData.articles || []).filter((article) => article.cover?.url));
        if (Array.isArray(settingData.value)) {
          setPositions(EMPTY_POSITIONS.map((_, index) => String(settingData.value[index] || "")));
        }
      })
      .catch(() => toast.error("بارگذاری مقالات منتخب ناموفق بود"))
      .finally(() => setLoading(false));
  }, []);

  const updatePosition = (index, value) => {
    setPositions((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  };

  const save = async () => {
    if (positions.some((id) => !id)) return toast.error("هر ۸ جایگاه را انتخاب کنید");
    if (new Set(positions).size !== 8) return toast.error("یک مقاله را در چند جایگاه انتخاب نکنید");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key: SETTING_KEY, value: positions }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success("چیدمان مقالات منتخب ذخیره شد");
    } catch (error) {
      toast.error(error.message || "ذخیره چیدمان ناموفق بود");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl" dir="rtl">
      <PageHeader
        title="مقالات منتخب صفحه اصلی"
        subtitle="برای هر قطعه از پازل یک مقاله منتشرشده انتخاب کنید. چیدمان قطعات ثابت است."
        icon={<FiBookOpen size={17} />}
        actions={(
          <div className="flex gap-2">
            <Link href="/p-admin/admin-pages?tab=home" className="inline-flex items-center gap-2 border px-4 py-2 text-xs font-bold" style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}>
              <FiArrowRight /> بازگشت
            </Link>
            {canEdit ? (
            <button type="button" onClick={save} disabled={saving || loading} className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white disabled:opacity-50" style={{ background: "var(--color-primary)", borderRadius: "var(--admin-radius)" }}>
              <FiSave /> {saving ? "در حال ذخیره…" : "ذخیره چیدمان"}
            </button>
            ) : (
              <p className="text-xs font-bold text-gray-400">دسترسی ویرایش این بخش را ندارید — مقادیر فقط برای مشاهده‌اند.</p>
            )}
          </div>
        )}
      />

      {loading ? (
        <div className="a-card py-20 text-center text-sm font-bold" style={{ color: "var(--admin-text-muted)" }}>در حال بارگذاری…</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {positions.map((articleId, index) => (
            <label key={index} className="a-card block p-5">
              <span className="mb-1.5 block text-sm font-bold" style={{ color: "var(--admin-text)" }}>جایگاه پازل {index + 1}</span>
              <span className="mb-3 block text-[11px] font-medium" style={{ color: "var(--admin-text-muted)" }}>قطعه {index + 1} از ۸ — ترتیب نمایش ثابت</span>
              <select
                value={articleId}
                onChange={(event) => updatePosition(index, event.target.value)}
                className="w-full border bg-white px-3 py-3 text-sm font-bold outline-none transition focus:ring-2 focus:ring-[var(--color-primary)]/20"
                style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}
              >
                <option value="">انتخاب مقاله منتشرشده</option>
                {articles.map((article) => (
                  <option key={article._id} value={article._id} disabled={positions.includes(String(article._id)) && articleId !== String(article._id)}>
                    {article.title} — {article.category?.name || "بدون دسته‌بندی"}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
