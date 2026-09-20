"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import { FiArrowRight, FiExternalLink, FiEye, FiFileText, FiPlus, FiSave } from "react-icons/fi";
import Button from "@/components/admin/Button";
import PageHeader from "@/components/admin/PageHeader";
import BlockEditor from "@/components/admin/articles/BlockEditor";
import { getApiErrorMessage } from "@/lib/apiClientError";

/**
 * ویرایشگرِ بروشورِ برند — همان تجربه‌ی ویرایشگرِ مقاله (همان BlockEditor، همان
 * چیدمان و نوارِ شناورِ پایین)، ولی بدونِ فیلدهای مخصوصِ مقاله: بروشور دسته،
 * برچسب، تصویرِ شاخص، نامک و سئوی جدا ندارد، چون روی *همان* آدرسِ برند رندر
 * می‌شود و متادیتای همان صفحه‌ی برند را دارد. تنها تنظیمش وضعیتِ انتشار است.
 */
export default function BrandBrochureEditor({ brandId }) {
  const [brand, setBrand] = useState(null);
  const [status, setStatus] = useState("draft");
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [addBlockOpen, setAddBlockOpen] = useState(false);
  // وضعیتِ *ذخیره‌شده*: لینکِ «مشاهده در سایت» فقط با آن ساخته می‌شود، نه با
  // انتخابِ ذخیره‌نشده — وگرنه لینکی به محتوایی داده می‌شد که هنوز منتشر نشده.
  const [persisted, setPersisted] = useState({ status: "draft", hasBlocks: false });
  const hydrated = useRef(false);

  useEffect(() => {
    fetch(`/api/brands/${brandId}/brochure`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(getApiErrorMessage(data, "بارگذاری بروشور انجام نشد"));
        setBrand(data.brand);
        setStatus(data.brochure?.status || "draft");
        setBlocks(Array.isArray(data.brochure?.blocks) ? data.brochure.blocks : []);
        setPersisted({ status: data.brochure?.status || "draft", hasBlocks: (data.brochure?.blocks || []).length > 0 });
        hydrated.current = true;
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [brandId]);

  useEffect(() => {
    const warn = (event) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (patch) => {
    if ("blocks" in patch) setBlocks(patch.blocks);
    if ("status" in patch) setStatus(patch.status);
    if (hydrated.current) setDirty(true);
  };

  const save = async (nextStatus = status) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/brands/${brandId}/brochure`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, blocks }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getApiErrorMessage(data, "ذخیره بروشور انجام نشد"));
      setStatus(nextStatus);
      setPersisted({ status: nextStatus, hasBlocks: blocks.length > 0 });
      setDirty(false);
      toast.success(nextStatus === "published" ? "بروشور منتشر شد و روی صفحه‌ی برند نشسته است" : "بروشور ذخیره شد (پیش‌نویس — صفحه‌ی برند تغییری نکرده)");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="a-card p-12 text-center text-sm text-gray-400">در حال بارگذاری بروشور...</div>;

  const liveUrl = persisted.status === "published" && persisted.hasBlocks && brand?.slug ? `/${brand.slug}` : null;
  const brandName = brand?.title || brand?.name || "";
  const statusSelect = <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
    وضعیت
    <select
      id="brochure-status"
      value={status}
      onChange={(e) => update({ status: e.target.value })}
      className="border bg-white px-2 py-1.5 text-xs font-bold outline-none focus:border-[var(--color-primary)]"
      style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}
    >
      <option value="draft">پیش‌نویس</option>
      <option value="published">منتشرشده</option>
    </select>
  </label>;

  return <>
    {/* وضعیتِ انتشار در خودِ هدر می‌نشیند تا ستونِ کناری حذف شود و بلوک‌ها تمامِ
        عرضِ صفحه را بگیرند — بروشور جز همین یک تنظیم چیزی ندارد. */}
    <PageHeader
      title={`بروشور برند${brandName ? ` ${brandName}` : ""}`}
      subtitle={status === "published"
        ? "پس از ذخیره، این محتوا جای صفحه‌ی برند را می‌گیرد. آدرس برند عوض نمی‌شود."
        : "پیش‌نویس فقط در پنل دیده می‌شود؛ صفحه‌ی برند مثل قبل باقی می‌ماند."}
      icon={<FiFileText />}
      actions={<div className="flex flex-wrap items-center gap-2">
        {statusSelect}
        {status === "published"
          ? <Button size="sm" variant="secondary" loading={saving} onClick={() => save("draft")}>لغو انتشار</Button>
          : <Button size="sm" loading={saving} onClick={() => save("published")} disabled={blocks.length === 0} title={blocks.length === 0 ? "برای انتشار دست‌کم یک بلوک لازم است" : undefined}>انتشار</Button>}
        <span className="text-[11px] text-gray-400">{dirty ? "تغییرات ذخیره‌نشده" : "بدون تغییر"} · {blocks.length.toLocaleString("fa-IR")} بلوک</span>
        <Link href={`/p-admin/admin-brands/edit/${brandId}`}><Button variant="secondary" icon={<FiArrowRight />}>بازگشت به برند</Button></Link>
        <Button variant="secondary" onClick={() => window.open(`/p-admin/admin-brands/${brandId}/brochure/preview`, "_blank")} icon={<FiEye />}>پیش‌نمایش</Button>
        {liveUrl ? <Button variant="secondary" onClick={() => window.open(liveUrl, "_blank", "noopener,noreferrer")} icon={<FiExternalLink />}>مشاهده در سایت</Button> : null}
        <Button loading={saving} onClick={() => save()} icon={<FiSave />}>ذخیره</Button>
      </div>}
    />
    {/* تمامِ عرضِ صفحه برای بلوک‌ها؛ فضای امن تا نوارِ شناورِ پایین. */}
    <div className="min-w-0 pb-24">
      <BlockEditor value={blocks} onChange={(next) => update({ blocks: next })} libraryOpen={addBlockOpen} onLibraryOpen={setAddBlockOpen} />
    </div>
    <div className="a-card fixed bottom-4 left-4 z-40 flex gap-2 p-2 shadow-lg" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}>
      <Button size="sm" variant="secondary" onClick={() => setAddBlockOpen(true)} icon={<FiPlus />}>افزودن بلوک</Button>
      <Button size="sm" variant="secondary" onClick={() => window.open(`/p-admin/admin-brands/${brandId}/brochure/preview`, "_blank")} icon={<FiEye />}>پیش‌نمایش</Button>
      {liveUrl ? <Button size="sm" variant="secondary" onClick={() => window.open(liveUrl, "_blank", "noopener,noreferrer")} icon={<FiExternalLink />}>مشاهده در سایت</Button> : null}
      <Button size="sm" loading={saving} onClick={() => save()} icon={<FiSave />}>ذخیره</Button>
    </div>
  </>;
}
