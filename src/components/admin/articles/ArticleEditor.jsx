"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { FiClock, FiEye, FiFileText, FiRotateCcw, FiLink, FiSave, FiSearch, FiSettings } from "react-icons/fi";
import Button from "@/components/admin/Button";
import ImageUpload from "@/components/admin/ImageUpload";
import PageHeader from "@/components/admin/PageHeader";
import BlockEditor from "./BlockEditor";
import RevisionHistory from "./RevisionHistory";
import { countArticleWords } from "@/lib/articleContent";
import { buildArticlePath, normalizeArticleSlug } from "base/utils/articleSlug";

const EMPTY = { title: "", slug: "", category: "", excerpt: "", cover: { url: "", alt: "" }, blocks: [], seo: { title: "", description: "", keywords: [], canonicalUrl: "", noIndex: false, ogTitle: "", ogDescription: "", ogImage: "" }, status: "draft", publishedAt: "", tags: [], featured: false, pinned: false };
const fieldClass = "w-full px-3 py-2.5 border bg-gray-50 text-sm outline-none focus:bg-white focus:border-[var(--color-primary)]";

function isoLocal(value) {
  if (!value) return "";
  const date = new Date(value); const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}
function Counter({ value, max }) { const length = String(value || "").length; return <span className={`text-[10px] tabular-nums ${length > max ? "text-red-600" : "text-gray-400"}`}>{length.toLocaleString("fa-IR")} / {max.toLocaleString("fa-IR")}</span>; }
function Panel({ title, icon, children }) { return <section className="a-card"><header className="flex items-center gap-2 px-4 py-3 border-b text-sm font-black" style={{ borderColor: "var(--admin-border)" }}>{icon}{title}</header><div className="p-4">{children}</div></section>; }

export default function ArticleEditor({ articleId = null }) {
  const router = useRouter();
  const [article, setArticle] = useState(EMPTY);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(Boolean(articleId));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [autosave, setAutosave] = useState("idle");
  const [history, setHistory] = useState(false);
  const hydrated = useRef(false);
  const editVersion = useRef(0);
  const autosaveController = useRef(null);

  useEffect(() => {
    const requests = [fetch("/api/admin/article-categories").then((r) => r.json()), fetch("/api/admin/article-tags").then((r) => r.json())];
    if (articleId) requests.push(fetch(`/api/admin/articles/${articleId}`).then((r) => r.json()));
    Promise.all(requests).then(([categoryData, tagData, articleData]) => {
      setCategories((categoryData.categories || []).filter((item) => item.status !== "archived"));
      setTags((tagData.tags || []).filter((item) => item.status !== "archived"));
      if (articleData?.article) {
        const item = articleData.article;
        setArticle({ ...EMPTY, ...item, category: item.category?._id || item.category || "", author: item.author?._id || item.author, tags: (item.tags || []).map((tag) => tag._id || tag), publishedAt: isoLocal(item.publishedAt) });
      }
      hydrated.current = true; setLoading(false);
    }).catch(() => { toast.error("بارگذاری اطلاعات مقاله انجام نشد"); setLoading(false); });
  }, [articleId]);

  const update = useCallback((patch) => { setArticle((current) => ({ ...current, ...patch })); if (hydrated.current) { editVersion.current += 1; setDirty(true); setAutosave("waiting"); } }, []);
  const category = categories.find((item) => String(item._id) === String(article.category));
  const wordCount = useMemo(() => countArticleWords([article.title, article.excerpt, article.blocks]), [article.title, article.excerpt, article.blocks]);
  const readingTime = wordCount ? Math.max(1, Math.ceil(wordCount / 200)) : 0;
  const livePath = buildArticlePath(category?.slug, article.slug) || "/category/article";

  useEffect(() => {
    if (!articleId || !dirty || !article.title || !article.category) return;
    const timer = setTimeout(async () => {
      const version = editVersion.current;
      autosaveController.current?.abort();
      const controller = new AbortController();
      autosaveController.current = controller;
      setAutosave("saving");
      try {
        const res = await fetch(`/api/admin/article-cms/${articleId}/autosave`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(article), signal: controller.signal });
        if (!res.ok) throw new Error();
        if (editVersion.current === version) { setAutosave("saved"); setDirty(false); }
      } catch (error) { if (error.name !== "AbortError") setAutosave("error"); }
    }, 1800);
    return () => clearTimeout(timer);
  }, [article, articleId, dirty]);

  useEffect(() => {
    const warn = (event) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async (overrides = {}) => {
    const payload = { ...article, ...overrides, publishedAt: (overrides.publishedAt ?? article.publishedAt) || null, revisionReason: overrides.revisionReason || "ذخیره دستی مقاله" };
    if (!payload.title.trim() || !payload.category) return toast.error("عنوان و دسته‌بندی مقاله الزامی است");
    if (!payload.slug) payload.slug = normalizeArticleSlug(payload.title);
    autosaveController.current?.abort();
    const version = editVersion.current;
    setSaving(true);
    try {
      const res = await fetch(articleId ? `/api/admin/articles/${articleId}` : "/api/admin/articles", { method: articleId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details ? Object.values(data.details)[0] : data.error || "ذخیره انجام نشد");
      if (editVersion.current === version) { setDirty(false); setAutosave("saved"); } toast.success(overrides.status === "published" ? "مقاله منتشر شد" : "مقاله ذخیره شد");
      if (!articleId) router.replace(`/p-admin/admin-articles/${data.article._id}`);
      else setArticle((current) => ({ ...current, ...overrides, currentRevision: data.article.currentRevision }));
    } catch (error) { toast.error(error.message); } finally { setSaving(false); }
  };

  if (loading) return <div className="a-card p-12 text-center text-sm text-gray-400">در حال بارگذاری ویرایشگر...</div>;
  return <>
    <PageHeader title={articleId ? "ویرایش مقاله" : "مقاله جدید"} subtitle="محتوا را با بلوک‌های مستقل بسازید؛ تغییرات به‌صورت خودکار ذخیره می‌شوند." icon={<FiFileText />} actions={<div className="flex gap-2 flex-wrap"><Button variant="secondary" disabled={!articleId} onClick={() => setHistory(true)} icon={<FiRotateCcw />}>نسخه‌ها</Button><Button variant="secondary" disabled={!articleId} onClick={() => window.open(`/p-admin/admin-articles/${articleId}/preview`, "_blank")} icon={<FiEye />}>پیش‌نمایش</Button><Button loading={saving} onClick={() => save()} icon={<FiSave />}>ذخیره</Button></div>} />
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_330px] gap-5 items-start">
      <main className="space-y-4 min-w-0">
        <section className="a-card p-5 sm:p-8">
          <textarea rows={2} value={article.title} onChange={(e) => update({ title: e.target.value, ...(!articleId && !article.slug ? { slug: normalizeArticleSlug(e.target.value) } : {}) })} placeholder="عنوان مقاله" className="w-full resize-none text-2xl sm:text-3xl font-black leading-relaxed outline-none bg-transparent" />
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-400"><FiLink /><span dir="ltr" className="truncate">{livePath}</span><span className="mr-auto"><Counter value={article.title} max={300} /></span></div>
          <textarea rows={3} value={article.excerpt} onChange={(e) => update({ excerpt: e.target.value })} placeholder="خلاصه کوتاه مقاله..." className={`${fieldClass} mt-6 resize-y`} style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }} /><div className="text-left mt-1"><Counter value={article.excerpt} max={1000} /></div>
        </section>
        <BlockEditor value={article.blocks} onChange={(blocks) => update({ blocks })} />
      </main>
      <aside className="space-y-4 xl:sticky xl:top-36">
        <Panel title="وضعیت انتشار" icon={<FiSettings className="text-[var(--color-primary)]" />}>
          <label className="block text-xs font-bold mb-1.5">وضعیت</label><select value={article.status} onChange={(e) => update({ status: e.target.value })} className={fieldClass} style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}><option value="draft">پیش‌نویس</option><option value="review">در انتظار بازبینی</option><option value="scheduled">زمان‌بندی‌شده</option><option value="published">منتشرشده</option><option value="archived">آرشیو</option></select>
          {(article.status === "scheduled" || article.publishedAt) ? <label className="block mt-4"><span className="block text-xs font-bold mb-1.5">زمان انتشار</span><input type="datetime-local" value={article.publishedAt} onChange={(e) => update({ publishedAt: e.target.value })} className={fieldClass} style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }} /></label> : null}
          <div className="grid grid-cols-2 gap-2 mt-4"><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={article.featured} onChange={(e) => update({ featured: e.target.checked })} /> ویژه</label><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={article.pinned} onChange={(e) => update({ pinned: e.target.checked })} /> سنجاق‌شده</label></div>
          <div className="flex gap-2 mt-5"><Button size="sm" className="flex-1" loading={saving} onClick={() => save(article.status === "scheduled" ? { status: "scheduled" } : { status: "published", publishedAt: article.publishedAt || new Date().toISOString() })}>{article.status === "scheduled" ? "زمان‌بندی" : "انتشار"}</Button></div>
          <div className="mt-4 pt-3 border-t flex items-center justify-between text-[11px]" style={{ borderColor: "var(--admin-border)" }}><span className="flex items-center gap-1"><FiClock />{autosave === "saving" ? "در حال ذخیره..." : autosave === "error" ? "خطا در ذخیره خودکار" : autosave === "saved" ? "ذخیره شد" : dirty ? "تغییرات ذخیره‌نشده" : "بدون تغییر"}</span><span>{article.currentRevision ? `نسخه ${article.currentRevision}` : "جدید"}</span></div>
        </Panel>
        <Panel title="دسته‌بندی و برچسب" icon={<FiSearch className="text-[var(--color-primary)]" />}>
          <label className="block text-xs font-bold mb-1.5">دسته‌بندی</label><select value={article.category} onChange={(e) => update({ category: e.target.value })} className={fieldClass} style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}><option value="">انتخاب کنید</option>{categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select>
          <div className="mt-4 max-h-36 overflow-y-auto space-y-2">{tags.map((tag) => <label key={tag._id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={article.tags.includes(tag._id)} onChange={(e) => update({ tags: e.target.checked ? [...article.tags, tag._id] : article.tags.filter((id) => id !== tag._id) })} />{tag.name}</label>)}</div>
        </Panel>
        <Panel title="تصویر شاخص" icon={<FiFileText className="text-[var(--color-primary)]" />}><ImageUpload value={article.cover?.url || ""} onChange={(url) => update({ cover: { ...article.cover, url } })} folder="articles" className="mb-2" /><input value={article.cover?.alt || ""} onChange={(e) => update({ cover: { ...article.cover, alt: e.target.value } })} placeholder="متن جایگزین تصویر" className={fieldClass} style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }} /></Panel>
        <Panel title="آدرس و آمار" icon={<FiLink className="text-[var(--color-primary)]" />}>
          <label className="block text-xs font-bold mb-1.5">نامک</label><input dir="ltr" value={article.slug} onChange={(e) => update({ slug: normalizeArticleSlug(e.target.value) })} className={fieldClass} style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }} /><p dir="ltr" className="mt-2 text-[10px] text-gray-400 break-all">{livePath}</p>
          <div className="grid grid-cols-2 gap-2 mt-4"><div className="p-2 text-center bg-gray-50"><strong className="block">{wordCount.toLocaleString("fa-IR")}</strong><small className="text-gray-400">کلمه</small></div><div className="p-2 text-center bg-gray-50"><strong className="block">{readingTime.toLocaleString("fa-IR")}</strong><small className="text-gray-400">دقیقه مطالعه</small></div></div>
        </Panel>
        <Panel title="تنظیمات سئو" icon={<FiSearch className="text-[var(--color-primary)]" />}>
          <label className="block text-xs font-bold mb-1.5">عنوان سئو</label><input value={article.seo.title} onChange={(e) => update({ seo: { ...article.seo, title: e.target.value } })} className={fieldClass} style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }} /><div className="text-left"><Counter value={article.seo.title} max={70} /></div>
          <label className="block text-xs font-bold mb-1.5 mt-3">توضیحات متا</label><textarea rows={4} value={article.seo.description} onChange={(e) => update({ seo: { ...article.seo, description: e.target.value } })} className={fieldClass} style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }} /><div className="text-left"><Counter value={article.seo.description} max={320} /></div>
          <label className="block text-xs font-bold mb-1.5 mt-3">کلمات کلیدی</label><input value={(article.seo.keywords || []).join("، ")} onChange={(e) => update({ seo: { ...article.seo, keywords: e.target.value.split(/[،,]/).map((x) => x.trim()).filter(Boolean) } })} className={fieldClass} style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }} />
          <label className="flex items-center gap-2 text-xs font-bold mt-4"><input type="checkbox" checked={article.seo.noIndex} onChange={(e) => update({ seo: { ...article.seo, noIndex: e.target.checked } })} />عدم ایندکس توسط موتور جستجو</label>
        </Panel>
      </aside>
    </div>
    <RevisionHistory articleId={articleId} open={history} onClose={() => setHistory(false)} onRestored={(item) => setArticle((current) => ({ ...current, ...item, category: item.category?._id || item.category, tags: (item.tags || []).map((tag) => tag._id || tag), publishedAt: isoLocal(item.publishedAt) }))} />
  </>;
}
