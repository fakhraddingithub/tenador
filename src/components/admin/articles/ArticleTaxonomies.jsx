"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FiFolder, FiPlus, FiTag, FiTrash2 } from "react-icons/fi";
import Button from "@/components/admin/Button";
import PageHeader from "@/components/admin/PageHeader";
import { normalizeArticleSlug } from "base/utils/articleSlug";

const fieldClass = "w-full px-3 py-2.5 border bg-gray-50 text-sm outline-none focus:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/20";

function TaxonomyPanel({ kind, title, icon }) {
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
    } catch (error) { toast.error(error.message); } finally { setSaving(false); }
  };
  const archive = async (id) => { if (!confirm("این مورد آرشیو شود؟")) return; try { const res = await fetch(`${endpoint}/${id}`, { method: "DELETE" }); const data = await res.json(); if (!res.ok) throw new Error(data.error || "\u0622\u0631\u0634\u06cc\u0648 \u0627\u0646\u062c\u0627\u0645 \u0646\u0634\u062f"); await load(); } catch (error) { toast.error(error.message); } };
  return <section className="a-card"><header className="flex items-center gap-2 p-4 border-b font-black" style={{ borderColor: "var(--admin-border)" }}>{icon}{title}</header><div className="p-4 border-b space-y-3" style={{ borderColor: "var(--admin-border)" }}><label className="block"><span className="mb-1 block text-xs font-bold">{"\u0646\u0627\u0645"}</span><input name={`${key}-name`} autoComplete="off" value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(normalizeArticleSlug(e.target.value)); }} placeholder="نام" className={fieldClass} style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }} /></label><label className="block"><span className="mb-1 block text-xs font-bold">{"\u0646\u0627\u0645\u06a9"}</span><input name={`${key}-slug`} autoComplete="off" dir="ltr" value={slug} onChange={(e) => setSlug(normalizeArticleSlug(e.target.value))} placeholder="slug" className={fieldClass} style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }} /></label><Button size="sm" loading={saving} onClick={create} icon={<FiPlus />}>افزودن</Button></div><div className="divide-y" style={{ borderColor: "var(--admin-border)" }}>{items.map((item) => <div key={item._id} className="flex items-center gap-3 p-4"><div><strong className="block text-sm">{item.name}</strong><small dir="ltr" className="text-gray-400">{item.slug}</small></div><span className="mr-auto text-[10px] text-gray-400">{item.status}</span>{item.status !== "archived" ? <button type="button" aria-label={`Archive ${item.name}`} onClick={() => archive(item._id)} className="p-2 text-gray-400 hover:text-red-600"><FiTrash2 /></button> : null}</div>)}{items.length === 0 ? <p className="p-8 text-center text-xs text-gray-400">هنوز موردی ثبت نشده است.</p> : null}</div></section>;
}

export default function ArticleTaxonomies() {
  return <div><PageHeader title="دسته‌ها و برچسب‌های مقاله" subtitle="ساختار دسته‌بندی مستقل بخش مقالات" icon={<FiFolder />} /><div className="grid md:grid-cols-2 gap-5"><TaxonomyPanel kind="category-categories" title="دسته‌بندی‌ها" icon={<FiFolder className="text-[var(--color-primary)]" />} /><TaxonomyPanel kind="tags" title="برچسب‌ها" icon={<FiTag className="text-[var(--color-primary)]" />} /></div></div>;
}
