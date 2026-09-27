"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import { DndContext, KeyboardSensor, PointerSensor, closestCorners, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { FiArrowRight, FiEye, FiPlus, FiSave } from "react-icons/fi";
import Button from "@/components/admin/Button";
import PageHeader from "@/components/admin/PageHeader";
import BlockEditor from "@/components/admin/articles/BlockEditor";
import { getApiErrorMessage } from "@/lib/apiClientError";

/**
 * ویرایشگرِ یک «سندِ بلوکی» روی صفحه‌ی خودش — بروشورِ برند، مینی‌مقاله‌ی سری و
 * مینی‌مقاله‌ی برند+دسته همگی همین هستند: آرایه‌هایی از بلوک که از یک endpoint
 * خوانده و در همان نوشته می‌شوند.
 *
 * یک کامپوننت برای همه، تا «همان امکانات» یک ادعا نباشد بلکه همان کد باشد:
 * همان BlockEditor، همان نوارِ شناورِ پایین، همان پیش‌نمایشِ قابلِ ویرایش.
 *
 * **یک سند می‌تواند چند بخش داشته باشد.** مینی‌مقاله دو بخش دارد — بالای صفحه و
 * پایینِ آن — و هر دو *در همین یک صفحه* ویرایش می‌شوند. چیزی که این را «یک
 * ویرایشگر با دو بخش» می‌کند نه «دو ویرایشگر»، یک DndContext مشترک است: بلوک از
 * بخشی به بخشِ دیگر کشیده می‌شود، چون هر دو SortableContext زیرِ یک context‌اند.
 *
 * چیزی که از بیرون می‌آید:
 *  - `sections`: [{ key, label, hint }] — پیش‌فرض یک بخش با کلیدِ `blocks`، پس
 *    هر استفاده‌ی تک‌بخشی (بروشور) دقیقاً مثلِ قبل است.
 *  - `parse`  : از پاسخِ GET، بلوکِ هر بخش و هر وضعیتِ جانبی را بیرون می‌کشد.
 *  - `toBody` : بدنه‌ی PUT را می‌سازد.
 *  - `actions`: دکمه‌های اختصاصیِ هدر (وضعیتِ انتشارِ بروشور) — اختیاری.
 */
const listOf = (value) => (Array.isArray(value) ? value : []);
const DEFAULT_SECTIONS = [{ key: "blocks" }];

/**
 * دو بخشِ مینی‌مقاله، یک جا — تا هر دو صفحه‌ی مینی‌مقاله (سری، برند+دسته) دقیقاً
 * همان برچسب‌ها و همان کلیدها را داشته باشند. کلیدها همان‌هایی‌اند که API
 * می‌فرستد و می‌پذیرد: `blocks` (بالا، همان فیلدِ قدیمی) و `blocksBottom`.
 */
export const MINI_ARTICLE_SECTIONS = [
  { key: "blocks", label: "مینی‌مقاله بالای صفحه", hint: "زیرِ هدر، بالای فهرستِ محصولات" },
  { key: "blocksBottom", label: "مینی‌مقاله پایین صفحه", hint: "پس از فهرستِ محصولات" },
];

/** محتوای ذخیره‌شده‌ی هر دو بخش؛ نبودِ بخشِ پایینی یعنی خالی (بدونِ مهاجرت). */
export const parseMiniArticle = (data) => ({
  blocks: { blocks: listOf(data?.blocks), blocksBottom: listOf(data?.blocksBottom) },
});

/** هر دو بخش با هم فرستاده می‌شوند، پس ذخیره هیچ‌وقت یکی را جا نمی‌گذارد. */
export const miniArticleBody = (blocks) => ({
  blocks: listOf(blocks?.blocks),
  blocksBottom: listOf(blocks?.blocksBottom),
});
/** ظرفِ هر بخش؛ droppable است تا بشود بلوک را داخلِ بخشِ *خالی* هم رها کرد. */
function SectionDropZone({ id, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div
    ref={setNodeRef}
    className={`rounded-[var(--admin-radius)] transition-colors ${isOver ? "bg-[var(--color-primary-soft)]" : ""}`}
  >{children}</div>;
}

export default function BlockDocumentEditor({
  endpoint,
  title,
  subtitle,
  icon,
  backHref,
  backLabel = "بازگشت",
  previewHref,
  sections = DEFAULT_SECTIONS,
  parse = (data) => ({ blocks: { blocks: listOf(data?.blocks) }, meta: null }),
  toBody = (blocks) => blocks,
  actions = null,
  missingMessage = "محتوا پیدا نشد",
}) {
  const [blocks, setBlocks] = useState(() => Object.fromEntries(sections.map((section) => [section.key, []])));
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [addBlockOpen, setAddBlockOpen] = useState(null);
  const hydrated = useRef(false);
  // آخرین وضعیت، برای onDragEnd که در closure رندرِ قبلی گیر می‌افتد.
  const latest = useRef(blocks);
  useEffect(() => { latest.current = blocks; });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  const update = (key, next) => {
    setBlocks((current) => ({ ...current, [key]: next }));
    if (hydrated.current) setDirty(true);
  };

  /** بخشی که این شناسه در آن است — پایه‌ی جابه‌جایی بینِ دو بخش. */
  const sectionOf = (id) => {
    const direct = sections.find((section) => `section:${section.key}` === id);
    if (direct) return direct.key;
    return sections.find((section) => listOf(latest.current[section.key]).some((block) => block.id === id))?.key || null;
  };

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = sectionOf(active.id);
    const to = sectionOf(over.id);
    if (!from || !to) return;
    const current = latest.current;

    if (from === to) {
      const list = listOf(current[from]);
      const oldIndex = list.findIndex((block) => block.id === active.id);
      const newIndex = list.findIndex((block) => block.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      update(from, arrayMove(list, oldIndex, newIndex));
      return;
    }

    // بینِ دو بخش: بلوک از فهرستِ مبدأ برداشته و در جای درستِ مقصد گذاشته
    // می‌شود. رها روی *خودِ ظرف* (بخشِ خالی) یعنی انتهای آن بخش.
    const source = listOf(current[from]);
    const target = listOf(current[to]);
    const block = source.find((item) => item.id === active.id);
    if (!block) return;
    const at = target.findIndex((item) => item.id === over.id);
    const index = at < 0 ? target.length : at;
    setBlocks({
      ...current,
      [from]: source.filter((item) => item.id !== active.id),
      [to]: [...target.slice(0, index), block, ...target.slice(index)],
    });
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
  const total = sections.reduce((sum, section) => sum + listOf(blocks[section.key]).length, 0);
  const single = sections.length === 1;

  return <>
    <PageHeader
      title={title}
      subtitle={subtitle}
      icon={icon}
      actions={<div className="flex flex-wrap items-center gap-2">
        {actions ? actions({ meta, setMeta, save, saving, blocks }) : null}
        <span className="text-[11px] text-gray-400">
          {dirty ? "تغییرات ذخیره‌نشده" : "بدون تغییر"} · {total.toLocaleString("fa-IR")} بلوک
        </span>
        {backHref ? <Link href={backHref}><Button variant="secondary" icon={<FiArrowRight />}>{backLabel}</Button></Link> : null}
        {previewHref ? <Button variant="secondary" onClick={openPreview} icon={<FiEye />}>پیش‌نمایش</Button> : null}
        <Button loading={saving} onClick={() => save()} icon={<FiSave />}>ذخیره</Button>
      </div>}
    />

    {/* تمامِ عرضِ صفحه برای بلوک‌ها؛ فضای امن تا نوارِ شناورِ پایین. */}
    <div className="min-w-0 space-y-6 pb-24">
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        {sections.map((section) => {
          const list = listOf(blocks[section.key]);
          const body = <BlockEditor
            dnd={false}
            value={list}
            onChange={(next) => update(section.key, next)}
            libraryOpen={addBlockOpen === section.key}
            onLibraryOpen={(open) => setAddBlockOpen(open ? section.key : null)}
          />;
          if (single) return <div key={section.key}>{body}</div>;
          return <section key={section.key} className="a-card overflow-hidden">
            {/* مرزِ بخش‌ها باید بی‌چون‌وچرا دیده شود: عنوان، شماره و شمارشِ بلوک. */}
            <header className="flex flex-wrap items-baseline gap-2 border-b bg-gray-50 px-4 py-3" style={{ borderColor: "var(--admin-border)" }}>
              <strong className="text-sm">{section.label}</strong>
              <span className="text-[11px] text-gray-500">{list.length.toLocaleString("fa-IR")} بلوک</span>
              {section.hint ? <span className="text-[11px] text-gray-400">· {section.hint}</span> : null}
            </header>
            <div className="p-4">
              <SectionDropZone id={`section:${section.key}`}>
                {body}
                {list.length === 0 ? <p className="mt-2 text-center text-[11px] text-gray-400">می‌توانید بلوکی را از بخشِ دیگر به اینجا بکشید.</p> : null}
              </SectionDropZone>
            </div>
          </section>;
        })}
      </DndContext>
      {!single ? <p className="text-center text-[11px] text-gray-400">بینِ این دو بخش، محتوای خودِ صفحه (فهرستِ محصولات) قرار می‌گیرد.</p> : null}
    </div>

    <div className="a-card fixed bottom-4 left-4 z-40 flex gap-2 p-2 shadow-lg" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}>
      {sections.map((section) => <Button
        key={section.key}
        size="sm"
        variant="secondary"
        onClick={() => setAddBlockOpen(section.key)}
        icon={<FiPlus />}
      >{single ? "افزودن بلوک" : `افزودن به ${section.label}`}</Button>)}
      {previewHref ? <Button size="sm" variant="secondary" onClick={openPreview} icon={<FiEye />}>پیش‌نمایش</Button> : null}
      <Button size="sm" loading={saving} onClick={() => save()} icon={<FiSave />}>ذخیره</Button>
    </div>
  </>;
}
