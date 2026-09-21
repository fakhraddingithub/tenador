"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { FiEye, FiGrid, FiMonitor, FiPlus, FiRotateCcw, FiSave, FiSmartphone, FiX } from "react-icons/fi";
import ArticleBlockRenderer from "@/components/features/articles/ArticleBlockRenderer";
import { getApiErrorMessage } from "@/lib/apiClientError";
import { isMergedBlock, mergedChildren } from "@/lib/articleBlockTypes";
import { insertBlockAt } from "@/lib/articleBlockLayout";
import { ARTICLE_BLOCKS, createArticleBlock } from "./blockRegistry";
import BlockLayoutModal from "./BlockLayoutModal";
// همان مودال‌هایی که ویرایشگرِ کارتی باز می‌کند — نه نسخه‌ی دومی از آن‌ها.
import { BlockFields, BlockLibrary, MergedLayoutModal } from "./BlockEditor";
import { AdminPortal } from "./blockUi";

/**
 * پیش‌نمایشِ *قابلِ ویرایش*.
 *
 * همان ArticleBlockRenderer صفحه‌ی عمومی را رندر می‌کند — نه یک رندرِ موازی — و
 * فقط با پرچمِ interactive از آن می‌خواهد دورِ هر بلوکِ سطحِ‌اول یک wrapper با
 * data-block-id بگذارد. تمامِ تعامل از همان یک شناسه می‌آید:
 *
 * - انتخاب/ویرایش با closest بالا می‌رود، پس کلیک روی هر *فرزندِ* یک بلوکِ
 *   ادغام‌شده به خودِ بلوکِ ادغام‌شده می‌رسد و هرگز فرزندش را جدا باز نمی‌کند.
 * - بازخوردِ دیداری (هاور، انتخاب، خطِ درج) با data-attribute و CSS انجام می‌شود،
 *   نه با اندازه‌گیری و لایه‌ی شناور؛ پس با هر تغییرِ چیدمان خودبه‌خود درست است.
 *
 * وضعیت اینجا یک آرایه‌ی بلوک است، دقیقاً همان چیزی که ذخیره می‌شود؛ ویرایشگرِ
 * کارتی هم روی همان ساختار کار می‌کند، پس هیچ‌کدام «حالتِ خودشان» را ندارند.
 */

const DRAG_THRESHOLD = 6;

/** فقط ترتیب عوض می‌شود؛ خودِ شیءِ بلوک (و شناسه‌اش) دست‌نخورده جابه‌جا می‌شود. */
function moveBlock(blocks, fromId, toId, after) {
  const from = blocks.findIndex((block) => block.id === fromId);
  const target = blocks.findIndex((block) => block.id === toId);
  if (from < 0 || target < 0 || fromId === toId) return blocks;
  const next = [...blocks];
  const [moved] = next.splice(from, 1);
  // اندیسِ مقصد بعد از برداشتن باید دوباره پیدا شود، وگرنه جابه‌جاییِ رو به پایین
  // همیشه یک خانه کم می‌آورد.
  const at = next.findIndex((block) => block.id === toId);
  next.splice(after ? at + 1 : at, 0, moved);
  return next;
}

function EditModal({ block, onChange, onClose }) {
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);
  const definition = ARTICLE_BLOCKS[block.type];
  const merged = isMergedBlock(block);

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape" && !layoutOpen && !gridOpen) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, layoutOpen, gridOpen]);

  // هر تغییر مستقیم روی وضعیتِ بوم می‌نشیند، پس نتیجه بی‌درنگ در پیش‌نمایش
  // دیده می‌شود و «ذخیره» فقط کارِ ماندگارکردن را می‌کند.
  const update = (patch) => onChange({ ...block, data: { ...block.data, ...patch } });
  const setStyle = (style) => onChange({ ...block, style });

  return <AdminPortal>
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[6vh]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`ویرایش بلوک ${definition?.label || block.type}`} onMouseDown={(event) => event.stopPropagation()} className="a-card w-full max-w-3xl shadow-xl">
        <header className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--admin-border)" }}>
          <strong className="text-sm">{definition?.label || block.type}</strong>
          {merged ? (
            <span className="rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[10px] font-black text-[var(--color-primary)]">
              بلوک ادغام‌شده · {mergedChildren(block).length.toLocaleString("fa-IR")} بلوک
            </span>
          ) : null}
          {/* چیدمانِ شبکه‌ی ادغام (ستون/ردیف/فاصله‌ی دسکتاپ و موبایل) فقط روی
              *خودِ* بلوکِ ادغام‌شده می‌نشیند؛ تنظیماتِ فرزندها در فهرستِ پایین
              دست‌نخورده می‌ماند. */}
          {merged ? (
            <button type="button" onClick={() => setGridOpen(true)} className="mr-auto flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-[var(--color-primary)]">
              <FiGrid aria-hidden="true" />چیدمان دسکتاپ و موبایل
            </button>
          ) : null}
          <button type="button" onClick={() => setLayoutOpen(true)} className={`${merged ? "" : "mr-auto "}text-[11px] font-bold text-gray-500 hover:text-[var(--color-primary)]`}>ظاهر و چیدمان</button>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-red-600" aria-label="بستن"><FiX /></button>
        </header>
        <div className="max-h-[68vh] space-y-4 overflow-y-auto p-4">
          <BlockFields block={block} onUpdate={update} onStyle={setStyle} />
        </div>
        <footer className="border-t p-3" style={{ borderColor: "var(--admin-border)" }}>
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-white bg-[var(--color-primary)]" style={{ borderRadius: "var(--admin-radius)" }}>تمام</button>
          <span className="mr-3 text-[11px] text-gray-400">تغییرها بی‌درنگ در پیش‌نمایش دیده می‌شوند؛ برای ماندگار شدن «ذخیره» را بزنید.</span>
        </footer>
      </div>
    </div>
    {gridOpen ? (
      <MergedLayoutModal
        grid={block.data?.grid}
        count={mergedChildren(block).length}
        onApply={(grid) => { onChange({ ...block, data: { ...block.data, grid } }); setGridOpen(false); }}
        onClose={() => setGridOpen(false)}
      />
    ) : null}
    {layoutOpen ? (
      <BlockLayoutModal
        type={block.type}
        style={block.style}
        layout={block.layout}
        onApply={(next) => onChange({ ...block, layout: next.layout, style: next.style })}
        onClose={() => setLayoutOpen(false)}
      />
    ) : null}
  </AdminPortal>;
}

export default function PreviewCanvas({ blocks: saved = [], entities, endpoint, canEdit = true }) {
  const router = useRouter();
  const [blocks, setBlocks] = useState(saved);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [viewport, setViewport] = useState("desktop");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const canvas = useRef(null);
  const drag = useRef(null);

  // وضعیتِ ذخیره‌شده تنها منبعِ حقیقت است: بعد از هر ذخیره (و هر refresh سروری)
  // بوم دوباره از همان چیزی پر می‌شود که واقعاً در دیتابیس است. اما refreshِ پس
  // از ذخیره نباید ویرایش‌های بعدیِ کاربر را پاک کند، پس وقتی سرور دقیقاً همان
  // چیزی را برمی‌گرداند که فرستادیم، دست به وضعیت نمی‌زنیم.
  const justSaved = useRef(null);
  useEffect(() => {
    if (justSaved.current && JSON.stringify(saved) === justSaved.current) { justSaved.current = null; return; }
    setBlocks(saved);
    setDirty(false);
  }, [saved]);

  useEffect(() => {
    const warn = (event) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const apply = (next) => { setBlocks(next); setDirty(true); };
  const updateBlock = (block) => apply(blocks.map((item) => (item.id === block.id ? block : item)));

  // بازخوردِ دیداری روی همان wrapperهای رندرشده می‌نشیند. React این صفت‌ها را
  // مدیریت نمی‌کند، پس نوشتنِ مستقیمشان با رندرِ بعدی تداخل ندارد — و همین effect
  // بعد از هر رندر دوباره اعمالشان می‌کند.
  useEffect(() => {
    const root = canvas.current;
    if (!root) return;
    for (const element of root.querySelectorAll("[data-block-id]")) {
      element.dataset.selected = element.dataset.blockId === selected ? "true" : "false";
    }
  });

  const blockAt = (x, y) => document.elementFromPoint(x, y)?.closest?.("[data-block-id]") || null;
  const clearDropHints = () => {
    for (const element of canvas.current?.querySelectorAll("[data-drop]") || []) delete element.dataset.drop;
  };

  const onPointerDown = (event) => {
    if (!canEdit || event.button !== 0) return;
    const handle = event.target.closest?.("[data-drag-handle]");
    if (!handle) return;
    const element = handle.closest("[data-block-id]");
    if (!element) return;
    event.preventDefault();
    drag.current = { id: element.dataset.blockId, startX: event.clientX, startY: event.clientY, active: false, element };
    handle.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    const state = drag.current;
    if (!state) return;
    // تا وقتی انگشت/ماوس از آستانه رد نشده، هیچ کشیدنی شروع نمی‌شود؛ همین است که
    // دابل‌کلیک و کلیکِ ساده هرگز به‌اشتباه تبدیل به drag نمی‌شوند.
    if (!state.active) {
      if (Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < DRAG_THRESHOLD) return;
      state.active = true;
      state.element.style.opacity = "0.45";
      document.body.style.cursor = "grabbing";
    }
    const over = blockAt(event.clientX, event.clientY);
    clearDropHints();
    if (!over || over.dataset.blockId === state.id) { state.target = null; return; }
    const rect = over.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    over.dataset.drop = after ? "after" : "before";
    state.target = { id: over.dataset.blockId, after };
  };

  const endDrag = () => {
    const state = drag.current;
    drag.current = null;
    if (!state) return;
    state.element.style.opacity = "";
    document.body.style.cursor = "";
    clearDropHints();
    if (!state.active || !state.target) return;
    const next = moveBlock(blocks, state.id, state.target.id, state.target.after);
    if (next !== blocks) apply(next);
  };

  const onClick = (event) => {
    const element = event.target.closest?.("[data-block-id]");
    setSelected(element ? element.dataset.blockId : null);
  };

  const onDoubleClick = (event) => {
    if (!canEdit) return;
    const element = event.target.closest?.("[data-block-id]");
    if (!element) return;
    // closest یعنی بیرونی‌ترین بلوکِ سطحِ‌اول — برای بلوکِ ادغام‌شده، خودِ آن.
    const block = blocks.find((item) => item.id === element.dataset.blockId);
    if (block) { setSelected(block.id); setEditing(block.id); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(endpoint.extra || {}), blocks }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getApiErrorMessage(data, "ذخیره تغییرات انجام نشد"));
      justSaved.current = JSON.stringify(blocks);
      setDirty(false);
      toast.success("تغییرات ذخیره شد");
      // داده‌های وابسته (محصول، مقاله، …) سمتِ سرور حل می‌شوند؛ refresh آن‌ها را
      // بدونِ بارگذاریِ دوباره‌ی صفحه تازه می‌کند و وضعیتِ همین بوم هم می‌ماند.
      router.refresh();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  // بلوکِ تازه در همان موقعیتی که کاربر خواسته درج می‌شود (همان insertBlockAt
  // ویرایشگر) و بی‌درنگ برای ویرایش باز می‌شود.
  const addBlock = (type, position) => {
    const block = createArticleBlock(type);
    apply(insertBlockAt(blocks, block, position));
    setLibraryOpen(false);
    setSelected(block.id);
    setEditing(block.id);
  };

  const editingBlock = editing ? blocks.find((item) => item.id === editing) : null;

  return (
    <>
      {canEdit ? (
        <div className="a-card sticky top-[132px] z-30 mb-4 flex flex-wrap items-center gap-2 p-2.5">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500"><FiEye aria-hidden="true" />ویرایش در پیش‌نمایش</span>
          <span className="text-[11px] text-gray-400">دوبار کلیک = ویرایش · کشیدن دستگیره = جابه‌جایی</span>
          <div className="mr-auto flex items-center gap-2">
            <div role="group" aria-label="اندازه‌ی نمایش" className="flex overflow-hidden border" style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}>
              {[["desktop", FiMonitor, "دسکتاپ"], ["mobile", FiSmartphone, "موبایل"]].map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setViewport(value)}
                  aria-pressed={viewport === value}
                  title={value === "mobile" ? "عرض ۳۹۰ پیکسل — نمای تقریبی گوشی" : "عرض کامل"}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold ${viewport === value ? "bg-[var(--color-primary)] text-white" : "text-gray-500"}`}
                >
                  <Icon aria-hidden="true" />{label}
                </button>
              ))}
            </div>
            {dirty ? (
              <button type="button" onClick={() => { setBlocks(saved); setDirty(false); setSelected(null); }} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-gray-500 hover:text-red-600">
                <FiRotateCcw aria-hidden="true" />بازگردانی
              </button>
            ) : null}
            <span className="text-[11px] text-gray-400">{dirty ? "تغییرات ذخیره‌نشده" : "بدون تغییر"}</span>
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--color-primary)] disabled:opacity-40"
              style={{ borderRadius: "var(--admin-radius)" }}
            >
              <FiSave aria-hidden="true" />{saving ? "در حال ذخیره…" : "ذخیره"}
            </button>
          </div>
        </div>
      ) : null}

      {/* حالتِ موبایل عرضِ ظرف را به ۳۹۰px می‌برد و قاعده‌ی جعبه‌ی چیدمان را به
          حالتِ گوشی برمی‌گرداند. توجه: media queryهای خودِ بلوک‌ها (کلاس‌های md:)
          با عرضِ *پنجره* سنجیده می‌شوند، پس این نما تقریبی است — برای آزمایشِ
          دقیق باید پنجره را واقعاً کوچک کرد. */}
      <div className={`${viewport === "mobile" ? "mx-auto w-[390px] max-w-full" : ""}${canEdit ? " pb-24" : ""}`}>
        <div
          ref={canvas}
          className={canEdit ? "preview-canvas" : undefined}
          data-viewport={viewport}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
        >
          <ArticleBlockRenderer blocks={blocks} entities={entities} preview interactive={canEdit} />
        </div>
      </div>

      {canEdit ? (
        <div className="a-card fixed bottom-4 left-4 z-40 flex gap-2 p-2 shadow-lg" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}>
          <button type="button" onClick={() => setLibraryOpen(true)} className="flex items-center gap-1.5 border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}>
            <FiPlus aria-hidden="true" />افزودن بلوک
          </button>
          <button type="button" onClick={save} disabled={saving || !dirty} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--color-primary)] disabled:opacity-40" style={{ borderRadius: "var(--admin-radius)" }}>
            <FiSave aria-hidden="true" />{saving ? "در حال ذخیره…" : "ذخیره"}
          </button>
        </div>
      ) : null}

      {libraryOpen ? <BlockLibrary total={blocks.length} onAdd={addBlock} onClose={() => setLibraryOpen(false)} /> : null}

      {editingBlock ? (
        // key = شناسه‌ی بلوک: جابه‌جا شدن بینِ دو بلوک، مودال را از نو می‌سازد و
        // هیچ وضعیتِ کهنه‌ای از بلوکِ قبلی باقی نمی‌ماند.
        <EditModal key={editingBlock.id} block={editingBlock} onChange={updateBlock} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}

