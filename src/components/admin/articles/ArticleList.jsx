"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { FiArchive, FiCopy, FiEdit3, FiEye, FiFileText, FiPlus, FiRotateCcw, FiSearch, FiSettings, FiTrash2 } from "react-icons/fi";
import Button from "@/components/admin/Button";
import PageHeader from "@/components/admin/PageHeader";
import SectionTabs from "@/components/admin/SectionTabs";

const VIEWS = [
  ["all", "همه"], ["draft", "پیش‌نویس"], ["published", "منتشرشده"],
  ["scheduled", "زمان‌بندی‌شده"], ["archived", "آرشیو"], ["trash", "زباله‌دان"],
];
const STATUS = { draft: ["پیش‌نویس", "#6b7a70"], review: ["بازبینی", "#205a7a"], scheduled: ["زمان‌بندی", "#c48a1a"], published: ["منتشرشده", "#0a5c37"], archived: ["آرشیو", "#6b7a70"] };

export default function ArticleList() {
  const router = useRouter();
  const [view, setView] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ articles: [], counts: {}, pagination: {} });
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/article-cms?view=${view}&q=${encodeURIComponent(query)}&page=${page}`);
      const next = await res.json();
      if (!res.ok) throw new Error(next.error);
      setData(next);
    } catch { toast.error("فهرست مقالات بارگذاری نشد"); } finally { setLoading(false); }
  }, [view, query, page]);
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [load]);

  const action = async (url, method, success) => {
    try {
      const res = await fetch(url, { method }); const result = await res.json();
      if (!res.ok) throw new Error(result.error || "عملیات انجام نشد");
      toast.success(success); await load(); return result;
    } catch (error) { toast.error(error.message); return null; }
  };
  const duplicate = async (id) => { const result = await action(`/api/admin/article-cms/${id}/duplicate`, "POST", "نسخه کپی ساخته شد"); if (result?.article) router.push(`/p-admin/admin-articles/${result.article._id}`); };
  const trash = (id) => confirm("مقاله به زباله‌دان منتقل شود؟") && action(`/api/admin/articles/${id}`, "DELETE", "مقاله به زباله‌دان منتقل شد");
  const tabs = VIEWS.map(([value, label]) => ({ value, label, badge: data.counts?.[value] || 0 }));

  return <div className="space-y-4">
    <PageHeader title="مدیریت مقالات" subtitle="پیش‌نویس، انتشار، زمان‌بندی و نسخه‌های مقالات تنادور" icon={<FiFileText />} actions={<><Link href="/p-admin/admin-articles/settings"><Button variant="secondary" icon={<FiSettings />}>دسته‌ها و برچسب‌ها</Button></Link><Link href="/p-admin/admin-articles/new"><Button icon={<FiPlus />}>مقاله جدید</Button></Link></>} />
    <div className="a-card p-3 flex flex-col lg:flex-row gap-3 lg:items-center"><SectionTabs tabs={tabs} value={view} onChange={(next) => { setView(next); setPage(1); }} className="flex-1" /><div className="relative lg:w-72"><FiSearch className="absolute right-3 top-3 text-gray-400" /><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="جستجوی عنوان یا نامک..." className="w-full pr-9 pl-3 py-2.5 border bg-gray-50 text-sm outline-none focus:border-[var(--color-primary)]" style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }} /></div></div>
    <div className="a-card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-right"><thead><tr className="border-b bg-gray-50" style={{ borderColor: "var(--admin-border)" }}><th className="p-4 text-xs">مقاله</th><th className="p-4 text-xs">دسته</th><th className="p-4 text-xs">وضعیت</th><th className="p-4 text-xs">آخرین تغییر</th><th className="p-4 text-xs">آمار</th><th className="p-4 text-xs w-44">عملیات</th></tr></thead><tbody className="divide-y" style={{ borderColor: "var(--admin-border)" }}>{loading ? <tr><td colSpan={6} className="p-12 text-center text-sm text-gray-400">در حال بارگذاری...</td></tr> : data.articles.map((article) => { const status = STATUS[article.status] || [article.status, "#6b7a70"]; return <tr key={article._id} className="hover:bg-gray-50/70"><td className="p-4"><div className="flex items-center gap-3 min-w-[280px]">{article.cover?.url ? <Image src={article.cover.url} alt="" width={56} height={44} className="h-11 w-14 object-cover" style={{ borderRadius: "var(--admin-radius)" }} /> : <span className="w-14 h-11 bg-gray-100 flex items-center justify-center text-gray-300"><FiFileText /></span>}<div><strong className="block text-sm max-w-sm truncate">{article.title}</strong><span dir="ltr" className="text-[10px] text-gray-400">{article.slug}</span><div className="flex gap-1 mt-1">{article.featured ? <small className="text-[var(--admin-warning)]">ویژه</small> : null}{article.pinned ? <small className="text-[var(--color-primary)]">سنجاق‌شده</small> : null}</div></div></div></td><td className="p-4 text-xs">{article.category?.name || "—"}</td><td className="p-4"><span className="px-2 py-1 text-[11px] font-bold text-white" style={{ background: status[1], borderRadius: "var(--admin-radius)" }}>{view === "trash" ? "زباله‌دان" : status[0]}</span>{article.status === "scheduled" && article.publishedAt ? <small className="block mt-1 text-gray-400">{new Date(article.publishedAt).toLocaleString("fa-IR")}</small> : null}</td><td className="p-4 text-xs text-gray-500">{new Date(article.updatedAt).toLocaleString("fa-IR")}</td><td className="p-4 text-xs"><span>{article.readingTime || 0} دقیقه</span><span className="block text-gray-400">نسخه {article.currentRevision}</span></td><td className="p-4"><div className="flex items-center gap-1">{view === "trash" ? <button onClick={() => action(`/api/admin/article-cms/${article._id}/restore`, "POST", "مقاله بازیابی شد")} title="بازیابی" className="p-2 text-[var(--color-primary)]"><FiRotateCcw /></button> : <><Link href={`/p-admin/admin-articles/${article._id}`} title="ویرایش" className="p-2 text-gray-500 hover:text-[var(--color-primary)]"><FiEdit3 /></Link><Link href={`/p-admin/admin-articles/${article._id}/preview`} target="_blank" title="پیش‌نمایش" className="p-2 text-gray-500 hover:text-[var(--color-primary)]"><FiEye /></Link><button onClick={() => duplicate(article._id)} title="کپی" className="p-2 text-gray-500 hover:text-[var(--color-primary)]"><FiCopy /></button>{article.status !== "archived" ? <button onClick={async () => { try { const res = await fetch(`/api/admin/articles/${article._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "archived" }) }); const result = await res.json(); if (!res.ok) throw new Error(result.error); toast.success("Article archived"); await load(); } catch (error) { toast.error(error.message || "Unable to archive article"); } }} title="آرشیو" className="p-2 text-gray-500 hover:text-[var(--admin-warning)]"><FiArchive /></button> : null}<button onClick={() => trash(article._id)} title="زباله‌دان" className="p-2 text-gray-500 hover:text-red-600"><FiTrash2 /></button></>}</div></td></tr>; })}{!loading && data.articles.length === 0 ? <tr><td colSpan={6} className="p-14 text-center text-sm text-gray-400">مقاله‌ای در این بخش وجود ندارد.</td></tr> : null}</tbody></table></div></div>
    {data.pagination?.pages > 1 ? <nav aria-label="Article pages" className="flex items-center justify-center gap-3"><Button variant="secondary" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} aria-label="Previous page">&lsaquo;</Button><span className="text-xs text-gray-500">{page.toLocaleString("fa-IR")} / {data.pagination.pages.toLocaleString("fa-IR")}</span><Button variant="secondary" size="sm" disabled={page >= data.pagination.pages || loading} onClick={() => setPage((current) => current + 1)} aria-label="Next page">&rsaquo;</Button></nav> : null}
  </div>;
}
