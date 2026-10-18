"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import { FiArrowRight, FiExternalLink, FiEye, FiFileText, FiPlus, FiSave } from "react-icons/fi";
import Button from "@/components/admin/Button";
import PageHeader from "@/components/admin/PageHeader";
import BlockEditor from "@/components/admin/articles/BlockEditor";
import { getApiErrorMessage } from "@/lib/apiClientError";
import { brochureOwner } from "@/lib/brochureOwners";

/**
 * ویرایشگرِ بروشور (برند، ورزش) — همان تجربه‌ی ویرایشگرِ مقاله (همان BlockEditor،
 * همان چیدمان و نوارِ شناورِ پایین)، ولی بدونِ فیلدهای مخصوصِ مقاله: بروشور دسته،
 * برچسب، تصویرِ شاخص، نامک و سئوی جدا ندارد، چون روی *همان* آدرسِ صاحبش رندر
 * می‌شود و متادیتای همان صفحه را دارد. تنها تنظیمش وضعیتِ انتشار است.
 */
export default function BrochureEditor({ owner, ownerId }) {
  const config = brochureOwner(owner);
  const { noun } = config;
  const [info, setInfo] = useState(null);
  const [status, setStatus] = useState("draft");
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [addBlockOpen, setAddBlockOpen] = useState(false);
  // وضعیتِ *ذخیره‌شده*: لینکِ «مشاهده در سایت» فقط با آن ساخته می‌شود، نه با
  // انتخابِ ذخیره‌نشده — وگرنه لینکی به محتوایی داده می‌شد که هنوز منتشر نشده.
  const [persisted, setPersisted] = useState({ status: "draft", hasBlocks: false });
  const hydrated = useRef(false);

  useEffect(() => {
    fetch(config.api(ownerId))
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(getApiErrorMessage(data, "بارگذاری بروشور انجام نشد"));
        setInfo(data.owner);
        setStatus(data.brochure?.status || "draft");
        setBlocks(Array.isArray(data.brochure?.blocks) ? data.brochure.blocks : []);
        setPersisted({ status: data.brochure?.status || "draft", hasBlocks: (data.brochure?.blocks || []).length > 0 });
        hydrated.current = true;
      })
      .catch((error) => {
        setLoadError(error.message);
        toast.error(error.message);
      })
      .finally(() => setLoading(false));
  }, [config, ownerId]);

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
      const res = await fetch(config.api(ownerId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, blocks }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getApiErrorMessage(data, "ذخیره بروشور انجام نشد"));
      setStatus(nextStatus);
      setPersisted({ status: nextStatus, hasBlocks: blocks.length > 0 });
      setDirty(false);
      toast.success(nextStatus === "published" ? `بروشور منتشر شد و روی صفحه‌ی ${noun} نشسته است` : `بروشور ذخیره شد (پیش‌نویس — صفحه‌ی ${noun} تغییری نکرده)`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="a-card p-12 text-center text-sm text-gray-400">در حال بارگذاری بروشور...</div>;
  // بارگذاری شکست خورد (صاحبِ حذف‌شده، دسترسی، شبکه): ویرایشگرِ خالی نشان داده
  // نمی‌شود، چون «ذخیره» روی آن بروشورِ موجود را با هیچ بازنویسی می‌کرد.
  if (loadError) {
    return <div className="a-card space-y-4 p-12 text-center">
      <p className="text-sm font-bold text-red-600">{loadError}</p>
      <Link href={config.back(ownerId)}><Button variant="secondary" icon={<FiArrowRight />}>بازگشت به {noun}</Button></Link>
    </div>;
  }

  const liveUrl = persisted.status === "published" && persisted.hasBlocks && info?.slug ? `/${info.slug}` : null;
  const ownerName = info?.title || info?.name || "";
  const openPreview = () => window.open(config.preview(ownerId), "_blank");
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
      title={`بروشور ${noun}${ownerName ? ` ${ownerName}` : ""}`}
      subtitle={status === "published"
        ? `پس از ذخیره، این محتوا جای صفحه‌ی ${noun} را می‌گیرد. آدرس ${noun} عوض نمی‌شود.`
        : `پیش‌نویس فقط در پنل دیده می‌شود؛ صفحه‌ی ${noun} مثل قبل باقی می‌ماند.`}
      icon={<FiFileText />}
      actions={<div className="flex flex-wrap items-center gap-2">
        {statusSelect}
        {status === "published"
          ? <Button size="sm" variant="secondary" loading={saving} onClick={() => save("draft")}>لغو انتشار</Button>
          : <Button size="sm" loading={saving} onClick={() => save("published")} disabled={blocks.length === 0} title={blocks.length === 0 ? "برای انتشار دست‌کم یک بلوک لازم است" : undefined}>انتشار</Button>}
        <span className="text-[11px] text-gray-400">{dirty ? "تغییرات ذخیره‌نشده" : "بدون تغییر"} · {blocks.length.toLocaleString("fa-IR")} بلوک</span>
        <Link href={config.back(ownerId)}><Button variant="secondary" icon={<FiArrowRight />}>بازگشت به {noun}</Button></Link>
        <Button variant="secondary" onClick={openPreview} icon={<FiEye />}>پیش‌نمایش</Button>
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
      <Button size="sm" variant="secondary" onClick={openPreview} icon={<FiEye />}>پیش‌نمایش</Button>
      {liveUrl ? <Button size="sm" variant="secondary" onClick={() => window.open(liveUrl, "_blank", "noopener,noreferrer")} icon={<FiExternalLink />}>مشاهده در سایت</Button> : null}
      <Button size="sm" loading={saving} onClick={() => save()} icon={<FiSave />}>ذخیره</Button>
    </div>
  </>;
}
