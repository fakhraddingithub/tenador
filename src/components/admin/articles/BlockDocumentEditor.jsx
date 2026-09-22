"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import { FiArrowRight, FiEye, FiPlus, FiSave } from "react-icons/fi";
import Button from "@/components/admin/Button";
import PageHeader from "@/components/admin/PageHeader";
import BlockEditor from "@/components/admin/articles/BlockEditor";
import { getApiErrorMessage } from "@/lib/apiClientError";

/**
 * ویرایشگرِ یک «سندِ بلوکی» روی صفحه‌ی خودش — بروشورِ برند، مینی‌مقاله‌ی سری و
 * مینی‌مقاله‌ی برند+دسته همگی همین هستند: یک آرایه‌ی بلوک که از یک endpoint
 * خوانده و در همان نوشته می‌شود.
 *
 * یک کامپوننت برای هر سه، تا «همان امکانات» یک ادعا نباشد بلکه همان کد باشد:
 * همان BlockEditor، همان نوارِ شناورِ پایین، همان پیش‌نمایشِ قابلِ ویرایش.
 * چیزی که فرق می‌کند از بیرون می‌آید:
 *
 *  - `parse`  : از پاسخِ GET، بلوک‌ها و هر وضعیتِ جانبی را بیرون می‌کشد.
 *  - `toBody` : بدنه‌ی PUT را می‌سازد (بروشور وضعیتِ انتشار هم می‌فرستد).
 *  - `actions`: دکمه‌های اختصاصیِ هدر (وضعیتِ انتشارِ بروشور) — اختیاری.
 */
export default function BlockDocumentEditor({
  endpoint,
  title,
  subtitle,
  icon,
  backHref,
  backLabel = "بازگشت",
  previewHref,
  parse = (data) => ({ blocks: Array.isArray(data?.blocks) ? data.blocks : [], meta: null }),
  toBody = (blocks) => ({ blocks }),
  actions = null,
  missingMessage = "محتوا پیدا نشد",
}) {
  const [blocks, setBlocks] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch(endpoint)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(getApiErrorMessage(data, missingMessage));
        if (cancelled) return;
        const parsed = parse(data);
        setBlocks(parsed.blocks);
        setMeta(parsed.meta ?? null);
        hydrated.current = true;
      })
      .catch((error) => toast.error(error.message))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // endpoint تنها ورودیِ واقعی است؛ parse/missingMessage در هر رندر تازه‌اند.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  useEffect(() => {
    const warn = (event) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (next) => {
    setBlocks(next);
    if (hydrated.current) setDirty(true);
  };

  const save = async (nextMeta = meta) => {
    setSaving(true);
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBody(blocks, nextMeta)),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getApiErrorMessage(data, "ذخیره انجام نشد"));
      setMeta(nextMeta);
      setDirty(false);
      toast.success("ذخیره شد");
      return data;
    } catch (error) {
      toast.error(error.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="a-card p-12 text-center text-sm text-gray-400">در حال بارگذاری…</div>;

  const openPreview = () => window.open(previewHref, "_blank");

  return <>
    <PageHeader
      title={title}
      subtitle={subtitle}
      icon={icon}
      actions={<div className="flex flex-wrap items-center gap-2">
        {actions ? actions({ meta, setMeta, save, saving, blocks }) : null}
        <span className="text-[11px] text-gray-400">
          {dirty ? "تغییرات ذخیره‌نشده" : "بدون تغییر"} · {blocks.length.toLocaleString("fa-IR")} بلوک
        </span>
        {backHref ? <Link href={backHref}><Button variant="secondary" icon={<FiArrowRight />}>{backLabel}</Button></Link> : null}
        {previewHref ? <Button variant="secondary" onClick={openPreview} icon={<FiEye />}>پیش‌نمایش</Button> : null}
        <Button loading={saving} onClick={() => save()} icon={<FiSave />}>ذخیره</Button>
      </div>}
    />

    {/* تمامِ عرضِ صفحه برای بلوک‌ها؛ فضای امن تا نوارِ شناورِ پایین. */}
    <div className="min-w-0 pb-24">
      <BlockEditor value={blocks} onChange={update} libraryOpen={addBlockOpen} onLibraryOpen={setAddBlockOpen} />
    </div>

    <div className="a-card fixed bottom-4 left-4 z-40 flex gap-2 p-2 shadow-lg" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}>
      <Button size="sm" variant="secondary" onClick={() => setAddBlockOpen(true)} icon={<FiPlus />}>افزودن بلوک</Button>
      {previewHref ? <Button size="sm" variant="secondary" onClick={openPreview} icon={<FiEye />}>پیش‌نمایش</Button> : null}
      <Button size="sm" loading={saving} onClick={() => save()} icon={<FiSave />}>ذخیره</Button>
    </div>
  </>;
}
