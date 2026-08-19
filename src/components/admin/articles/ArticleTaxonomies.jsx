"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { FiArchive, FiFolder, FiPlus, FiTag, FiTrash2 } from "react-icons/fi";
import Button from "@/components/admin/Button";
import PageHeader from "@/components/admin/PageHeader";
import { normalizeArticleSlug } from "base/utils/articleSlug";
import { useAdminPermissions } from "@/components/admin/AdminPermissionProvider";
import { showError, showSuccess } from "@/lib/swal";

const fieldClass = "w-full px-3 py-2.5 border bg-gray-50 text-sm outline-none focus:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/20";

function TaxonomyPanel({ kind, title, icon }) {
  // ماژولِ تاکسونومی فقط view/manage دارد؛ ساخت و آرشیو هر دو manage اند
  // (همان چیزی که /api/admin/article-categories و -tags اعمال می‌کنند).
  const { can } = useAdminPermissions();
  const canManage = can("articleTaxonomy.manage");
  const isCategory = kind === "category-categories";
  const endpoint = isCategory ? "/api/admin/article-categories" : "/api/admin/article-tags";
  const key = isCategory ? "categories" : "tags";
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const load = () => fetch(endpoint).then((r) => r.json()).then((data) => setItems(data[key] || []));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body = isCategory ? { name, slug: slug || normalizeArticleSlug(name), status: "active", description: "", order: 0 } : { name, slug: slug || normalizeArticleSlug(name), status: "active", description: "" };
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "ثبت انجام نشد");
      setName(""); setSlug(""); toast.success(`${title} ثبت شد`); load();
    } catch (error) { showError("ثبت انجام نشد", error.message); } finally { setSaving(false); }
  };
  const archive = async (id, itemName) => {
    const confirmed = await Swal.fire({
      title: `«${itemName}» آرشیو شود؟`,
      text: "آرشیو قابل بازگشت است؛ داده‌ای حذف نمی‌شود.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#aa4725",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "بله، آرشیو کن",
      cancelButtonText: "انصراف",
      reverseButtons: true,
    });
    if (!confirmed.isConfirmed) return;
    try {
      const res = await fetch(`${endpoint}/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "آرشیو انجام نشد");
      await load();
      showSuccess("آرشیو شد", `«${itemName}» به آرشیو رفت.`);
    } catch (error) { showError("آرشیو انجام نشد", error.message); }
  };

  // حذفِ دائمی فقط برای دسته‌بندیِ آرشیوشده. شرطِ «صفر مقاله» سمتِ سرور دوباره
  // چک می‌شود؛ اینجا فقط تأیید گرفته می‌شود و پیامِ خطای سرور نمایش داده می‌شود.
  const destroy = async (id, itemName) => {
    const confirmed = await Swal.fire({
      title: `حذف دائمی «${itemName}»؟`,
      text: "این دسته‌بندی برای همیشه از دیتابیس حذف می‌شود و این عمل قابل بازگشت نیست.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "بله، برای همیشه حذف کن",
      cancelButtonText: "انصراف",
      reverseButtons: true,
    });
    if (!confirmed.isConfirmed) return;
    try {
      const res = await fetch(`${endpoint}/${id}?permanent=true`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "حذف دائمی انجام نشد");
      await load();
      showSuccess("حذف شد", `«${itemName}» برای همیشه حذف شد.`);
    } catch (error) { showError("حذف دائمی انجام نشد", error.message); }
  };

  return <section className="a-card"><header className="flex items-center gap-2 p-4 border-b font-black" style={{ borderColor: "var(--admin-border)" }}>{icon}{title}</header>{canManage ? <div className="p-4 border-b space-y-3" style={{ borderColor: "var(--admin-border)" }}><label className="block"><span className="mb-1 block text-xs font-bold">{"\u0646\u0627\u0645"}</span><input name={`${key}-name`} autoComplete="off" value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(normalizeArticleSlug(e.target.value)); }} placeholder="نام" className={fieldClass} style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }} /></label><label className="block"><span className="mb-1 block text-xs font-bold">{"\u0646\u0627\u0645\u06a9"}</span><input name={`${key}-slug`} autoComplete="off" dir="ltr" value={slug} onChange={(e) => setSlug(normalizeArticleSlug(e.target.value))} placeholder="slug" className={fieldClass} style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }} /></label><Button size="sm" loading={saving} onClick={create} icon={<FiPlus />}>افزودن</Button></div> : null}<div className="divide-y" style={{ borderColor: "var(--admin-border)" }}>{items.map((item) => <div key={item._id} className="flex items-center gap-3 p-4"><div><strong className="block text-sm">{item.name}</strong><small dir="ltr" className="text-gray-400">{item.slug}</small></div><span className="mr-auto text-[10px] text-gray-400">{item.status}</span>{item.status !== "archived" && canManage ? <button type="button" aria-label={`Archive ${item.name}`} title="آرشیو" onClick={() => archive(item._id, item.name)} className="p-2 text-gray-400 hover:text-[var(--admin-warning)]"><FiArchive /></button> : null}{isCategory && item.status === "archived" && canManage ? <button type="button" aria-label={`Delete ${item.name} permanently`} title="حذف دائمی" onClick={() => destroy(item._id, item.name)} className="p-2 text-gray-400 hover:text-red-600"><FiTrash2 /></button> : null}</div>)}{items.length === 0 ? <p className="p-8 text-center text-xs text-gray-400">هنوز موردی ثبت نشده است.</p> : null}</div></section>;
}

export default function ArticleTaxonomies() {
  return <div><PageHeader title="دسته‌ها و برچسب‌های مقاله" subtitle="ساختار دسته‌بندی مستقل بخش مقالات" icon={<FiFolder />} /><div className="grid md:grid-cols-2 gap-5"><TaxonomyPanel kind="category-categories" title="دسته‌بندی‌ها" icon={<FiFolder className="text-[var(--color-primary)]" />} /><TaxonomyPanel kind="tags" title="برچسب‌ها" icon={<FiTag className="text-[var(--color-primary)]" />} /></div></div>;
}
