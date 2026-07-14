"use client";

import { useEffect, useRef, useState } from "react";
import { FiClock, FiRotateCcw, FiX } from "react-icons/fi";
import Button from "@/components/admin/Button";

export default function RevisionHistory({ articleId, open, onClose, onRestored }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const closeRef = useRef(null);
  useEffect(() => {
    if (!open || !articleId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/admin/articles/${articleId}/revisions?limit=100`);
      const data = await res.json();
      if (!cancelled) { setItems(data.revisions || []); setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [open, articleId]);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);
  if (!open) return null;
  const restore = async (revision) => {
    if (!confirm(`نسخه ${revision} بازیابی شود؟ یک نسخه جدید از وضعیت بازیابی‌شده ساخته می‌شود.`)) return;
    setRestoring(revision);
    try {
      const res = await fetch(`/api/admin/article-cms/${articleId}/revisions/${revision}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "بازیابی انجام نشد");
      onRestored?.(data.article);
      onClose();
    } catch (error) { alert(error.message); } finally { setRestoring(null); }
  };
  return <div className="fixed inset-0 z-[110] bg-black/30" onMouseDown={onClose}><aside role="dialog" aria-modal="true" aria-labelledby="revision-history-title" className="absolute top-0 bottom-0 left-0 w-full max-w-md bg-white shadow-2xl flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
    <header className="flex items-center gap-3 p-5 border-b" style={{ borderColor: "var(--admin-border)" }}><FiClock className="text-[var(--color-primary)]" /><div><h2 id="revision-history-title" className="font-black">تاریخچه نسخه‌ها</h2><p className="text-xs text-gray-400">هر ذخیره دستی یک نسخه قابل بازیابی می‌سازد.</p></div><button ref={closeRef} type="button" aria-label="Close revision history" className="mr-auto rounded p-2 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]" onClick={onClose}><FiX aria-hidden="true" /></button></header>
    <div className="flex-1 overflow-y-auto p-4 space-y-2">{loading ? <p className="text-sm text-gray-400">در حال بارگذاری...</p> : items.map((item) => <div key={item._id} className="a-card p-3 flex items-center gap-3"><div className="w-10 h-10 flex items-center justify-center font-black text-sm" style={{ background: "var(--color-primary-soft)", color: "var(--color-primary)", borderRadius: "var(--admin-radius)" }}>{item.revision}</div><div className="min-w-0"><strong className="block text-sm truncate">{item.reason || "ذخیره مقاله"}</strong><span className="text-[11px] text-gray-400">{new Date(item.createdAt).toLocaleString("fa-IR")}</span></div><Button size="xs" variant="ghost" loading={restoring === item.revision} onClick={() => restore(item.revision)} icon={<FiRotateCcw />}>بازیابی</Button></div>)}{!loading && items.length === 0 ? <p className="text-sm text-gray-400 text-center py-10">نسخه‌ای ثبت نشده است.</p> : null}</div>
  </aside></div>;
}
