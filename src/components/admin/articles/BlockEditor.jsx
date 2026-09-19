"use client";

import { matchesSearch } from "@/lib/search";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FiChevronDown, FiChevronUp, FiColumns, FiCopy, FiDroplet, FiGrid, FiMenu, FiPlus, FiScissors, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import ImageUpload from "@/components/admin/ImageUpload";
import ArticleEntityPicker from "./ArticleEntityPicker";
import RichTextField from "./RichTextField";
import { ARTICLE_BLOCKS, BLOCK_ACCENT_HINTS, BLOCK_GROUPS, BLOCK_SPACING_LABELS, BLOCK_STYLE_LABELS, BLOCK_TABLE_VARIANT_LABELS, createArticleBlock } from "./blockRegistry";
import { BLOCK_WIDTHS, blockWidth, insertBlockAt } from "@/lib/articleBlockLayout";
import { confirmDelete } from "@/lib/swal";
import { IMAGE_DISPLAY_HEIGHT, MAX_IMAGE_BLOCK_ITEMS, mirrorFirstImage, normalizeImageHref } from "@/lib/articleImageBlock";
import { MAX_MERGED_CHILDREN, MAX_MERGE_DEPTH, MERGED_GRID_LIMITS, MERGED_GRID_REFERENCE, defaultMergedGrid, isMergedBlock, mergedChildren, mergedGridColumnsAt, sanitizeMergedGrid } from "@/lib/articleBlockTypes";
import { cloneWithFreshIds, mergeBlocker, mergeBlocks, unmergeBlock } from "@/lib/articleBlockMerge";

const BLOCK_WIDTH_LABELS = { full: "تمام عرض", "1/2": "نصف عرض", "1/3": "یک‌سوم عرض", "2/3": "دو‌سوم عرض" };

const inputClass = "w-full px-3 py-2.5 border bg-gray-50 text-sm outline-none focus:bg-white focus:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/20";

// <button> عنصری «برچسب‌پذیر» است، پس <label> بدونِ for اولین دکمه‌ی داخلش را
// برچسب می‌زند و مرورگر هاور و کلیکِ کلِ ناحیه را به همان دکمه می‌فرستد. فیلدِ
// متنِ غنی یک نوارِ دکمه دارد (اولینش «پررنگ») و ناحیه‌ی ویرایشش contentEditable
// است که اصلاً برچسب‌پذیر نیست — پس باید در یک wrapper ساده بنشیند.
// همین دلیل برای فیلدهای چندکنترلیِ تصویر (چند input و دکمه) هم صادق است.
const fieldWrapper = (kind) => (["rich", "imageList", "imageOverlay", "mergedBlocks"].includes(kind) ? "div" : "label");
// این نوع‌ها کلِ data را می‌خوانند و وصله‌ی چندکلیدی برمی‌گردانند.
const WHOLE_DATA_KINDS = ["table", "rich", "imageList"];
const PATCH_KINDS = ["table", "image", "rich", "imageList"];

// مودال‌ها به body می‌روند: هر نیایی با transform یا backdrop-filter (مثلِ کارتِ
// مینی‌مقاله با backdrop-blur) بلوکِ دربرگیرنده‌ی position:fixed می‌شود و مودال را
// در خودش حبس می‌کند. متغیرهای تمِ ادمین روی .admin-scope تعریف شده‌اند، پس
// پورتال هم داخلِ همان کلاس می‌نشیند؛ `contents` نمی‌گذارد پس‌زمینه‌ی آن رنگ شود.
const AdminPortal = ({ children }) => createPortal(<div className="admin-scope contents" dir="rtl">{children}</div>, document.body);

function FaqEditor({ value = [], onChange }) {
  const items = value.length ? value : [{ question: "", answer: "" }];
  const update = (index, key, next) => onChange(items.map((item, i) => i === index ? { ...item, [key]: next } : item));
  return <div className="space-y-3">{items.map((item, index) => <div key={index} className="p-3 border space-y-2" style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}><input className={inputClass} value={item.question} onChange={(e) => update(index, "question", e.target.value)} placeholder="پرسش" /><textarea className={inputClass} rows={3} value={item.answer} onChange={(e) => update(index, "answer", e.target.value)} placeholder="پاسخ" /><button type="button" onClick={() => onChange(items.filter((_, i) => i !== index))} className="text-xs text-red-600">حذف پرسش</button></div>)}<button type="button" onClick={() => onChange([...items, { question: "", answer: "" }])} className="text-xs font-bold text-[var(--color-primary)]">+ افزودن پرسش</button></div>;
}

function TableEditor({ value, onChange }) {
  const headers = value?.headers?.length ? value.headers : ["ستون ۱", "ستون ۲"];
  const rows = value?.rows?.length ? value.rows : [["", ""]];
  const emit = (nextHeaders, nextRows) => onChange({ headers: nextHeaders, rows: nextRows });
  return <div className="overflow-x-auto space-y-2"><table className="w-full text-xs border-collapse"><thead><tr>{headers.map((header, col) => <th key={col} className="border p-1" style={{ borderColor: "var(--admin-border)" }}><input className={inputClass} value={header} onChange={(e) => emit(headers.map((x, i) => i === col ? e.target.value : x), rows)} /></th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, col) => <td key={col} className="border p-1" style={{ borderColor: "var(--admin-border)" }}><input className={inputClass} value={row[col] || ""} onChange={(e) => emit(headers, rows.map((r, i) => i === rowIndex ? headers.map((__, c) => c === col ? e.target.value : (r[c] || "")) : r))} /></td>)}</tr>)}</tbody></table><div className="flex gap-3"><button type="button" className="text-xs font-bold text-[var(--color-primary)]" onClick={() => emit(headers, [...rows, headers.map(() => "")])}>+ سطر</button><button type="button" className="text-xs font-bold text-[var(--color-primary)]" onClick={() => emit([...headers, `ستون ${headers.length + 1}`], rows.map((row) => [...row, ""]))}>+ ستون</button></div></div>;
}

// ابعادِ واقعیِ تصویر را کنارِ آدرس ذخیره می‌کند تا رندرِ عمومی بتواند پیش از
// بارگذاری، جای درست را رزرو کند و پرش چیدمان (CLS) رخ ندهد.
function ImageFieldWithSize({ value, onChange }) {
  const emit = (url) => {
    if (!url) return onChange({ url: "", width: undefined, height: undefined });
    const probe = new window.Image();
    probe.onload = () => onChange({ url, width: probe.naturalWidth || undefined, height: probe.naturalHeight || undefined });
    probe.onerror = () => onChange({ url, width: undefined, height: undefined });
    probe.src = url;
  };
  return <ImageUpload value={value || ""} onChange={emit} folder="articles" className="mb-0" />;
}

// در ویرایشگر اسلاتِ خالی هم باید دیده شود، پس برخلافِ imageBlockItems چیزی
// فیلتر نمی‌شود. بلوکِ قدیمی (بدونِ images) به‌صورتِ یک آیتم خوانده می‌شود و
// تا ادمین به فهرست دست نزند، به همان شکلِ قدیمی باقی می‌ماند.
const editorImageItems = (data) => (Array.isArray(data?.images) && data.images.length
  ? data.images
  : [{ url: data?.url || "", alt: data?.alt || "", width: data?.width, height: data?.height }]);

function ImageListEditor({ data, onChange }) {
  // ابعادِ تصویر نامتقارن می‌رسد (پس از بارگذاریِ probe)؛ مبنای هر تغییر آخرین
  // داده است، نه closure کهنه — وگرنه متنِ تایپ‌شده در همان فاصله پاک می‌شد.
  const latest = useRef(data);
  useEffect(() => { latest.current = data; });
  const items = editorImageItems(data);
  const emit = (images) => onChange({ images, ...mirrorFirstImage(images.filter((image) => image.url)) });
  const update = (index, patch) => emit(editorImageItems(latest.current).map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const remove = (index) => emit(editorImageItems(latest.current).filter((_, i) => i !== index));
  const add = () => emit([...editorImageItems(latest.current), { url: "", alt: "" }]);
  const small = "block text-[11px] font-bold text-gray-500";
  return <div className="space-y-3">
    {items.map((item, index) => <div key={index} className="space-y-2 border p-3" style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}>
      <div className="flex items-center justify-between text-[11px] font-bold text-gray-500">
        <span>تصویر {(index + 1).toLocaleString("fa-IR")}</span>
        {items.length > 1 ? <button type="button" onClick={() => remove(index)} className="text-red-600">حذف تصویر</button> : null}
      </div>
      {/* ImageUpload پیش‌نمایش را فقط یک‌بار از value می‌خواند؛ key بر اساسِ آدرس
          باعث می‌شود پس از حذفِ یک تصویر، اسلاتِ جابه‌جاشده پیش‌نمایشِ درست را نشان دهد. */}
      <ImageFieldWithSize key={item.url || `empty-${index}`} value={item.url} onChange={(patch) => update(index, patch)} />
      <label className="block"><span className={small}>متن جایگزین</span><input value={item.alt || ""} onChange={(e) => update(index, { alt: e.target.value })} className={inputClass} /></label>
      <label className="block"><span className={small}>پیوند (اختیاری — در همین زبانه باز می‌شود)</span><input dir="ltr" value={item.href || ""} onChange={(e) => update(index, { href: e.target.value })} placeholder="/tennis/racket یا https://…" aria-invalid={normalizeImageHref(item.href) === null} className={inputClass} />
        {normalizeImageHref(item.href) === null ? <span role="alert" className="mt-1 block text-[11px] font-bold text-red-600">این پیوند معتبر نیست و ذخیره‌ی برند را رد می‌کند. آن را اصلاح یا پاک کنید.</span> : null}
      </label>
      <label className="block"><span className={small}>متن روی تصویر (اختیاری)</span><textarea rows={2} value={item.overlayText || ""} onChange={(e) => update(index, { overlayText: e.target.value })} className={`${inputClass} font-sans`} /></label>
      {!item.url && (item.overlayText || item.href) ? <p className="text-[11px] text-amber-600">تا تصویری بارگذاری نشود، متن و پیوندِ این مورد ذخیره نمی‌شوند.</p> : null}
    </div>)}
    <button type="button" onClick={add} disabled={items.length >= MAX_IMAGE_BLOCK_ITEMS} className="text-xs font-bold text-[var(--color-primary)] disabled:opacity-40">+ افزودن تصویر</button>
  </div>;
}

function ImageHeightField({ value, onChange }) {
  return <div className="flex flex-wrap items-center gap-2">
    <input type="number" min={IMAGE_DISPLAY_HEIGHT.min} max={IMAGE_DISPLAY_HEIGHT.max} step={10} value={value ?? ""} placeholder="خودکار" onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} className={`${inputClass} w-32`} />
    <span className="text-[11px] text-gray-400">پیکسل ({IMAGE_DISPLAY_HEIGHT.min.toLocaleString("fa-IR")} تا {IMAGE_DISPLAY_HEIGHT.max.toLocaleString("fa-IR")}). خالی = اندازه‌ی اصلیِ تصویر. در موبایل متناسب کوچک می‌شود.</span>
  </div>;
}

const OVERLAY_OPTION_LABELS = {
  size: { sm: "کوچک", md: "متوسط", lg: "بزرگ", xl: "خیلی بزرگ" },
  align: { right: "راست", center: "وسط", left: "چپ" },
  position: { top: "بالا", center: "وسط", bottom: "پایین" },
  dir: { rtl: "راست به چپ", ltr: "چپ به راست" },
};
const OVERLAY_DEFAULTS = { size: "md", align: "center", position: "center", dir: "rtl" };
const OVERLAY_FIELD_LABELS = { size: "اندازه متن", align: "چینش افقی", position: "جای عمودی", dir: "جهت متن" };

/** ظاهرِ متنِ روی تصویر؛ مقدارِ پیش‌فرض ذخیره نمی‌شود (همان قراردادِ BlockStylePanel). */
function ImageOverlayField({ value, onChange }) {
  const current = value || {};
  const set = (key, next) => {
    const overlay = { ...current };
    if (next === undefined) delete overlay[key]; else overlay[key] = next;
    onChange(Object.keys(overlay).length ? overlay : undefined);
  };
  return <div className="space-y-3 border p-3" style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}>
    <p className="text-[11px] text-gray-400">متنِ هر تصویر در کارتِ همان تصویر نوشته می‌شود؛ این تنظیمات برای همه‌ی تصاویرِ این بلوک است.</p>
    <ColorControl label="رنگ متن" hint="پیش‌فرض سفید" value={current.color} onChange={(next) => set("color", next)} />
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Object.keys(OVERLAY_DEFAULTS).map((key) => <label key={key} className="block"><span className="mb-1 block text-[11px] font-bold text-gray-600">{OVERLAY_FIELD_LABELS[key]}</span>
        <select value={current[key] || OVERLAY_DEFAULTS[key]} onChange={(e) => set(key, e.target.value === OVERLAY_DEFAULTS[key] ? undefined : e.target.value)} className={inputClass}>
          {Object.entries(OVERLAY_OPTION_LABELS[key]).map(([option, text]) => <option key={option} value={option}>{text}</option>)}
        </select>
      </label>)}
    </div>
    <label className="flex items-center gap-2 text-[11px] font-bold text-gray-600"><input type="checkbox" checked={current.shade !== false} onChange={(e) => set("shade", e.target.checked ? undefined : false)} />سایه‌ی تیره پشت متن (برای خوانایی)</label>
  </div>;
}

/** رنگ سه‌حالته: تنظیم‌نشده (پیش‌فرضِ قالب) یا یک هگزِ مشخص. */
function ColorControl({ label, hint, value, onChange }) {
  return <div className="flex items-center gap-2">
    <input type="color" aria-label={label} value={value || "#aa4725"} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 shrink-0 cursor-pointer border p-0.5" style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }} />
    <span className="text-[11px] text-gray-600">{label}{hint ? <em className="not-italic text-gray-400"> ({hint})</em> : null}</span>
    {value
      ? <button type="button" onClick={() => onChange(undefined)} className="mr-auto text-[11px] font-bold text-red-600">حذف رنگ</button>
      : <span className="mr-auto text-[11px] text-gray-400">پیش‌فرض</span>}
  </div>;
}

/**
 * کنترل‌های ظاهرِ بلوک. حذفِ آخرین مقدار، کلِ style را undefined می‌کند تا بلوک
 * دقیقاً به حالتِ «بدونِ استایل» برگردد و مثل قبل رندر شود.
 */
function BlockStylePanel({ type, style, layout, onChange, onLayout }) {
  const keys = ARTICLE_BLOCKS[type]?.styleKeys || [];
  const current = style || {};
  const width = blockWidth({ layout });
  const set = (key, value) => {
    const next = { ...current };
    if (value === undefined) delete next[key];
    else next[key] = value;
    onChange(Object.keys(next).length ? next : undefined);
  };
  const customised = Object.keys(current).length + (width === "full" ? 0 : 1);
  // بالای بلوک می‌نشیند، پس خطِ جداکننده زیرِ آن است نه بالایش.
  return <details className="border-b pb-3" style={{ borderColor: "var(--admin-border)" }}>
    <summary className="flex cursor-pointer items-center gap-2 text-xs font-bold text-gray-600"><FiDroplet className="text-[var(--color-primary)]" />ظاهر و چیدمان بلوک{customised ? <span className="rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[10px] text-[var(--color-primary)]">{customised.toLocaleString("fa-IR")} تنظیم</span> : null}</summary>
    <div className="mt-3 space-y-3">
      <label className="block"><span className="mb-1 block text-[11px] font-bold text-gray-600">عرض بلوک</span><select value={width} onChange={(e) => onLayout(e.target.value === "full" ? undefined : { width: e.target.value })} className={inputClass}>{BLOCK_WIDTHS.map((value) => <option key={value} value={value}>{BLOCK_WIDTH_LABELS[value]}</option>)}</select><span className="mt-1 block text-[10px] text-gray-400">بلوک‌های کنارِ هم در دسکتاپ یک ردیف می‌شوند و در موبایل زیر هم قرار می‌گیرند.</span></label>
      {keys.includes("spacing") ? <label className="block"><span className="mb-1 block text-[11px] font-bold text-gray-600">{BLOCK_STYLE_LABELS.spacing}</span><select value={current.spacing || "md"} onChange={(e) => set("spacing", e.target.value === "md" ? undefined : e.target.value)} className={inputClass}>{Object.entries(BLOCK_SPACING_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label> : null}
      {keys.includes("tableVariant") ? <label className="block"><span className="mb-1 block text-[11px] font-bold text-gray-600">{BLOCK_STYLE_LABELS.tableVariant}</span><select value={current.tableVariant || "default"} onChange={(e) => set("tableVariant", e.target.value === "default" ? undefined : e.target.value)} className={inputClass}>{Object.entries(BLOCK_TABLE_VARIANT_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label> : null}
      {["textColor", "background", "accent"].filter((key) => keys.includes(key)).map((key) => <ColorControl key={key} label={BLOCK_STYLE_LABELS[key]} hint={key === "accent" ? BLOCK_ACCENT_HINTS[type] : null} value={current[key]} onChange={(value) => set(key, value)} />)}
      {customised ? <button type="button" onClick={() => { onChange(undefined); onLayout(undefined); }} className="text-[11px] font-bold text-gray-500 hover:text-red-600">بازگشت به حالت پیش‌فرض</button> : null}
    </div>
  </details>;
}

const blockDomId = (id) => `article-block-${id}`;

function BlockField({ field, value, onChange, align, onAlign }) {
  if (field.kind === "rich") return <RichTextField value={value} onChange={onChange} align={align} onAlign={onAlign} singleLine={field.singleLine} />;
  if (field.kind === "textarea" || field.kind === "html") return <textarea dir={field.kind === "html" ? "ltr" : "rtl"} rows={field.kind === "html" ? 9 : 4} value={value || ""} onChange={(e) => onChange(e.target.value)} className={`${inputClass} ${field.kind === "html" ? "font-mono" : "font-sans"}`} />;
  if (field.kind === "select") return <select value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputClass}>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  if (field.kind === "image") return <ImageFieldWithSize value={value} onChange={onChange} />;
  if (field.kind === "imageList") return <ImageListEditor data={value} onChange={onChange} />;
  if (field.kind === "imageHeight") return <ImageHeightField value={value} onChange={onChange} />;
  if (field.kind === "imageOverlay") return <ImageOverlayField value={value} onChange={onChange} />;
  // فرزندانِ بلوکِ ادغام‌شده با همین ویرایشگر ویرایش می‌شوند — ادغامِ دوباره هم داخلش کار می‌کند.
  if (field.kind === "mergedBlocks") return <BlockEditor value={Array.isArray(value) ? value : []} onChange={onChange} />;
  if (field.kind === "gallery") return <ImageUpload value={value || []} onChange={onChange} folder="articles" multiple className="mb-0" />;
  if (field.kind === "entity" || field.kind === "entities") return <ArticleEntityPicker type={field.entityType} value={value} onChange={onChange} multiple={field.kind === "entities"} />;
  if (field.kind === "faq") return <FaqEditor value={value} onChange={onChange} />;
  if (field.kind === "table") return <TableEditor value={value} onChange={onChange} />;
  return <input type={field.kind === "number" ? "number" : field.kind === "url" ? "url" : "text"} value={value ?? ""} onChange={(e) => onChange(field.kind === "number" ? Number(e.target.value) : e.target.value)} className={inputClass} />;
}

// شماره‌ی بلوک هم موقعیتِ فعلی را نشان می‌دهد هم میان‌بُرِ جابه‌جایی است؛ در
// مقاله‌ی بلند، کشیدنِ بلوک از موقعیتِ ۱۰۰ به ۳ عملاً شدنی نیست.
function MoveDialog({ index, total, onMove, onClose }) {
  const [target, setTarget] = useState(String(index + 1));
  const submit = (event) => {
    event.preventDefault();
    // رویدادِ React از پورتال هم در درختِ React بالا می‌رود؛ ویرایشگر داخلِ فرمِ
    // برند/سری است و بدونِ این، «انتقال» آن فرم را هم ثبت می‌کرد.
    event.stopPropagation();
    const position = Number(target);
    if (!Number.isInteger(position) || position < 1 || position > total) return;
    // onMove همان arrayMove است: شناسه‌ها دست‌نخورده می‌مانند و فقط ترتیب عوض می‌شود.
    onMove(index, position - 1);
    onClose();
  };
  return <AdminPortal><div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4" onMouseDown={onClose}>
    <form role="dialog" aria-modal="true" aria-label="جابجایی بلوک" onSubmit={submit} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }} onMouseDown={(e) => e.stopPropagation()} className="a-card w-full max-w-xs p-4 space-y-3 shadow-xl">
      <p className="text-sm">موقعیت فعلی: <strong>{index + 1}</strong> از {total}</p>
      <label className="block text-xs font-bold text-gray-600">انتقال به موقعیت
        <input autoFocus type="number" min={1} max={total} value={target} onChange={(e) => setTarget(e.target.value)} className={`${inputClass} mt-1.5`} />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="flex-1 py-2 text-xs font-bold text-white bg-[var(--color-primary)]" style={{ borderRadius: "var(--admin-radius)" }}>انتقال</button>
        <button type="button" onClick={onClose} className="flex-1 py-2 text-xs font-bold border" style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}>انصراف</button>
      </div>
    </form>
  </div></AdminPortal>;
}

const BREAKPOINT_LABELS = { desktop: "دسکتاپ", mobile: "موبایل" };

/**
 * شمای کوچکِ نتیجه در عرضِ مرجعِ هر breakpoint (همان فرمولِ رندر): ستون‌هایی که
 * واقعاً در دید هستند پررنگ، بقیه (اسلایدر) کم‌رنگ. کمینه‌ی عرض در محاسبه هست —
 * «۲ ستون» با کمینه‌ی ۳۰۰px در گوشی عملاً ۱ ستون است و پیش‌نمایش همین را نشان می‌دهد.
 */
function GridPreview({ breakpoint, settings, count }) {
  const fa = (value) => Math.round(value).toLocaleString("fa-IR");
  const reference = MERGED_GRID_REFERENCE[breakpoint];
  const { columnWidth, visible, requiredWidth } = mergedGridColumnsAt(settings, reference);
  const columns = settings.fit ? settings.columns : Math.max(settings.columns, Math.ceil(count / settings.rows));
  const rows = Math.ceil(count / columns);
  const place = breakpoint === "mobile" ? `گوشیِ ${fa(reference.viewport)}px` : `عرضِ ${fa(reference.width)}px`;
  return <div className="space-y-1.5">
    <div className="overflow-hidden">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${columns}, 14px)` }} aria-hidden="true">
        {Array.from({ length: count }, (_, index) => <span key={index} className={`h-3.5 rounded-sm ${index % columns < visible ? "bg-[var(--color-primary)]" : "bg-[var(--color-primary)]/25"}`} />)}
      </div>
    </div>
    <p className="text-[11px] text-gray-500">{settings.fit
      ? `${fa(settings.columns)} ستون × ${fa(rows)} ردیف — بدونِ اسکرولِ افقی`
      : `در ${place}: ${fa(visible)} ستونِ کامل در دید، هر ستون ≈ ${fa(columnWidth)}px${columns > visible ? "؛ بقیه با کشیدنِ افقی" : ""}`}</p>
    {!settings.fit && visible < settings.columns ? <p role="alert" className="text-[11px] font-bold leading-5 text-amber-700">
      {`با کمینه‌ی عرضِ ${fa(settings.minWidth)}px، ${fa(settings.columns)} ستون دست‌کم ${fa(requiredWidth)}px جا می‌خواهد؛ در ${place} فقط ${fa(visible)} ستون دیده می‌شود. کمینه‌ی عرض را کم کنید یا تعدادِ ستون را ${fa(visible)} بگذارید.`}
    </p> : null}
  </div>;
}

/**
 * تنظیماتِ چیدمانِ بلوکِ ادغام‌شده (data.grid)، جدا برای دسکتاپ و موبایل. در
 * مودال است تا جای دائمی در ویرایشگر نگیرد. «چیدمانِ ردیفیِ پیش‌فرض» grid را
 * برمی‌دارد و بلوک دقیقاً مثلِ قبل (یک ردیفِ افقی) رندر می‌شود.
 */
function MergedLayoutModal({ grid, count, onApply, onClose }) {
  const [draft, setDraft] = useState(() => sanitizeMergedGrid(grid) || defaultMergedGrid(count));
  const set = (breakpoint, key, value) => setDraft((current) => ({ ...current, [breakpoint]: { ...current[breakpoint], [key]: value } }));
  const number = (breakpoint, key, disabled) => {
    const [min, max] = MERGED_GRID_LIMITS[key];
    return <input type="number" min={min} max={max} disabled={disabled} value={draft[breakpoint][key]} onChange={(e) => set(breakpoint, key, e.target.value === "" ? min : Number(e.target.value))} className={`${inputClass} disabled:opacity-40`} />;
  };
  const apply = () => onApply(sanitizeMergedGrid(draft));
  return <AdminPortal><div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-[8vh]" onMouseDown={onClose}>
    <div role="dialog" aria-modal="true" aria-labelledby="merged-layout-title" onMouseDown={(e) => e.stopPropagation()}
      // داخلِ فرمِ برند/سری/مقاله است: Enter در یک کادر نباید آن فرم را ثبت کند؛
      // روی دکمه‌ها Enter همان کارِ خودِ دکمه را می‌کند.
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); apply(); } }}
      className="a-card w-full max-w-2xl space-y-4 p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <h2 id="merged-layout-title" className="flex items-center gap-2 text-sm font-black"><FiGrid className="text-[var(--color-primary)]" />چیدمانِ بلوکِ ادغام‌شده ({count.toLocaleString("fa-IR")} بلوک)</h2>
        <button type="button" onClick={onClose} aria-label="بستن" className="p-1 text-gray-400 hover:text-gray-700"><FiX /></button>
      </div>
      <p className="text-[11px] leading-6 text-gray-500">هر بلوکِ داخلی یک خانه است. «هم‌اندازه‌ی صفحه» ستون‌ها را کوچک می‌کند تا همه جا شوند (بدونِ اسکرول). بدونِ آن، چیدمان همان‌طور می‌ماند و آنچه جا نشود با کشیدنِ افقی دیده می‌شود.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {Object.keys(BREAKPOINT_LABELS).map((breakpoint) => {
          const settings = draft[breakpoint];
          return <fieldset key={breakpoint} className="space-y-3 border p-3" style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}>
            <legend className="px-1 text-xs font-black">{BREAKPOINT_LABELS[breakpoint]}</legend>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-700"><input type="checkbox" checked={settings.fit} onChange={(e) => set(breakpoint, "fit", e.target.checked)} className="size-4 accent-[var(--color-primary)]" />هم‌اندازه‌ی صفحه (بدونِ اسکرولِ افقی)</label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block"><span className="mb-1 block text-[11px] font-bold text-gray-600">ستون</span>{number(breakpoint, "columns", false)}</label>
              <label className="block"><span className="mb-1 block text-[11px] font-bold text-gray-600">ردیف</span>{number(breakpoint, "rows", settings.fit)}</label>
            </div>
            <label className="block"><span className="mb-1 block text-[11px] font-bold text-gray-600">کمینه‌ی عرضِ هر ستون (px، ۰ = بدونِ کمینه)</span>{number(breakpoint, "minWidth", settings.fit)}</label>
            {settings.fit ? <p className="text-[10px] text-gray-400">در این حالت تعداد ردیف‌ها خودکار است.</p> : null}
            <GridPreview breakpoint={breakpoint} settings={sanitizeMergedGrid(draft)?.[breakpoint] || settings} count={count} />
          </fieldset>;
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "var(--admin-border)" }}>
        <button type="button" onClick={apply} className="px-4 py-2 text-xs font-bold text-white bg-[var(--color-primary)]" style={{ borderRadius: "var(--admin-radius)" }}>اعمال</button>
        <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold border" style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}>انصراف</button>
        <button type="button" onClick={() => onApply(undefined)} className="mr-auto text-[11px] font-bold text-gray-500 hover:text-red-600">بازگشت به چیدمانِ ردیفیِ پیش‌فرض</button>
      </div>
    </div>
  </div></AdminPortal>;
}

// خلاصه‌ی یک‌خطیِ بلوکِ بسته‌شده، تا بلوک‌ها بدونِ باز کردن از هم تشخیص داده شوند.
const plainText = (value) => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
function blockSummary(block) {
  const data = block.data || {};
  if (isMergedBlock(block)) return `${mergedChildren(block).length.toLocaleString("fa-IR")} بلوک`;
  const text = plainText(data.text || data.title || data.label || data.caption || data.question || data.author || data.html);
  if (text) return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  const list = Object.values(data).find((item) => Array.isArray(item) && item.length);
  if (list) return `${list.length.toLocaleString("fa-IR")} ${block.type === "image" || block.type === "gallery" ? "تصویر" : "مورد"}`;
  if (data.url) return data.url.split("/").pop();
  return "";
}

function SortableBlock({ block, index, total, onUpdate, onStyle, onLayout, onRemove, onDuplicate, onMove, selectable = false, selected = false, onSelect, onUnmerge, open = true, onToggle }) {
  const [gridOpen, setGridOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const definition = ARTICLE_BLOCKS[block.type];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const Icon = definition?.icon || FiMenu;
  // چینش از نوارِ ابزارِ متن تنظیم می‌شود ولی جایش همان style بلوک است (خاصیتی
  // سطحِ خط است، نه سطحِ کاراکتر)؛ حذفِ آخرین کلید، کلِ style را برمی‌دارد.
  const setAlign = (align) => {
    const next = { ...(block.style || {}) };
    if (align) next.align = align; else delete next.align;
    onStyle(Object.keys(next).length ? next : undefined);
  };
  // شناسه‌ی DOM از id پایدارِ بلوک ساخته می‌شود نه از اندیس — اندیس با هر درج و
  // جابه‌جایی عوض می‌شود. tabIndex هم هست تا بشود بعد از ساخت، فوکوس را واقعاً
  // داخلِ بلوکِ تازه برد (نه فقط اسکرول).
  return <section ref={setNodeRef} id={blockDomId(block.id)} tabIndex={-1} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .55 : 1 }} className="a-card group overflow-hidden outline-none">
    <header className={`flex items-center gap-2 bg-gray-50 px-3 py-2.5 ${open ? "border-b" : ""}`} style={{ borderColor: "var(--admin-border)" }}>
      {/* بلوکِ ادغام‌شده هم مثلِ هر بلوکِ دیگری قابلِ انتخاب و ادغامِ دوباره است. */}
      {selectable ? <input type="checkbox" checked={selected} onChange={onSelect} title="انتخاب برای ادغام" aria-label={`انتخاب بلوک ${index + 1} برای ادغام`} className="size-4 shrink-0 cursor-pointer accent-[var(--color-primary)]" /> : null}
      <button type="button" onClick={() => setMoveOpen(true)} className="min-w-6 h-6 px-1.5 border text-[11px] font-black text-gray-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]" style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }} aria-label={`بلوک ${index + 1} از ${total} — تغییر موقعیت`}>{index + 1}</button>
      {/* touch-none لازم است: بدونِ آن مرورگر لمسِ روی دستگیره را برای اسکرول
          برمی‌دارد و pointercancel می‌دهد؛ dnd-kit خودش این را ست نمی‌کند و
          همین علتِ نامطمئن بودنِ کشیدن در موبایل بود. */}
      <button type="button" {...attributes} {...listeners} className="touch-none p-2 cursor-grab text-gray-400 hover:text-[var(--color-primary)]" aria-label="جابجایی بلوک"><FiMenu /></button>
      {/* کلِ عنوان بلوک را باز و بسته می‌کند (آکاردئون)؛ بسته که باشد، خلاصه‌اش دیده می‌شود. */}
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`${blockDomId(block.id)}-body`} className="flex min-w-0 flex-1 items-center gap-2 text-right focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">
        <Icon className="shrink-0 text-[var(--color-primary)]" /><strong className="shrink-0 text-sm">{definition?.label || block.type}</strong>
        {!open && blockSummary(block) ? <span className="min-w-0 truncate text-xs text-gray-400">{blockSummary(block)}</span> : null}
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={() => onMove(index, index - 1)} disabled={index === 0} className="p-1.5 text-gray-400 disabled:opacity-20" aria-label="انتقال به بالا"><FiChevronUp /></button>
        <button type="button" onClick={() => onMove(index, index + 1)} disabled={index === total - 1} className="p-1.5 text-gray-400" aria-label="انتقال به پایین"><FiChevronDown /></button>
        {onUnmerge ? <button type="button" onClick={() => setGridOpen(true)} className="flex items-center gap-1 px-1.5 py-1 text-[11px] font-bold text-gray-500 hover:text-[var(--color-primary)]" aria-label="تنظیمات چیدمان بلوک ادغام‌شده"><FiGrid />چیدمان</button> : null}
        {onUnmerge ? <button type="button" onClick={onUnmerge} className="flex items-center gap-1 px-1.5 py-1 text-[11px] font-bold text-gray-500 hover:text-[var(--color-primary)]" aria-label="جداسازی بلوک‌های ادغام‌شده"><FiScissors />جداسازی</button> : null}
        <button type="button" onClick={onDuplicate} className="p-1.5 text-gray-400 hover:text-[var(--color-primary)]" aria-label="تکثیر بلوک"><FiCopy /></button>
        <button type="button" onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-600" aria-label="حذف بلوک"><FiTrash2 /></button>
        <button type="button" onClick={onToggle} aria-expanded={open} className="p-1.5 text-gray-400 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]" aria-label="باز و بسته کردن">{open ? <FiChevronUp /> : <FiChevronDown />}</button>
      </div>
    </header>
    {open ? <div id={`${blockDomId(block.id)}-body`} className="p-4 space-y-4"><BlockStylePanel type={block.type} style={block.style} layout={block.layout} onChange={onStyle} onLayout={onLayout} />{definition?.fields.length ? definition.fields.map((field) => { const Wrapper = fieldWrapper(field.kind); return <Wrapper key={field.key} className="block"><span className="block text-xs font-bold mb-1.5 text-gray-600">{field.label}</span><BlockField field={field} value={WHOLE_DATA_KINDS.includes(field.kind) ? block.data : block.data?.[field.key]} onChange={(next) => onUpdate(PATCH_KINDS.includes(field.kind) ? next : { [field.key]: next })} align={block.style?.align} onAlign={setAlign} /></Wrapper>; }) : <p className="text-xs text-gray-400 text-center py-3">این بلوک تنظیمات دیگری ندارد.</p>}</div> : null}
    {moveOpen ? <MoveDialog index={index} total={total} onMove={onMove} onClose={() => setMoveOpen(false)} /> : null}
    {gridOpen ? <MergedLayoutModal grid={block.data?.grid} count={mergedChildren(block).length} onApply={(grid) => { onUpdate({ grid }); setGridOpen(false); }} onClose={() => setGridOpen(false)} /> : null}
  </section>;
}

function BlockLibrary({ total, onAdd, onClose }) {
  const [query, setQuery] = useState("");
  // موقعیتِ بلوکِ تازه، ۱-پایه. پیش‌فرض انتهای مقاله است ولی قابلِ ویرایش، تا
  // بتوان مثلاً مستقیم بینِ بلوکِ ۴ و ۵ بلوک ساخت — نه اینکه اول در انتها
  // ساخته و بعد دستی جابه‌جا شود.
  const [position, setPosition] = useState(String(total + 1));
  const groups = useMemo(() => BLOCK_GROUPS.map((group) => ({ group, blocks: Object.entries(ARTICLE_BLOCKS).filter(([, item]) => !item.hidden && item.group === group && matchesSearch(query, item.label)) })).filter((item) => item.blocks.length), [query]);
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return <AdminPortal><div className="fixed inset-0 z-[100] bg-black/30 flex items-start justify-center p-4 pt-[10vh]" onMouseDown={onClose}><div role="dialog" aria-modal="true" aria-labelledby="block-library-title" className="w-full max-w-2xl max-h-[76vh] overflow-hidden a-card shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
    <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: "var(--admin-border)" }}><FiSearch aria-hidden="true" className="text-gray-400" /><h2 id="block-library-title" className="sr-only">Block library</h2><input aria-label="Search blocks" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی نوع بلوک..." className="flex-1 outline-none text-sm" /><button type="button" onClick={onClose} aria-label="Close block library" className="rounded p-1 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"><FiX aria-hidden="true" /></button></div>
    <label className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b text-xs font-bold text-gray-600" style={{ borderColor: "var(--admin-border)" }}>
      <span>موقعیت بلوک جدید</span>
      <input type="number" min={1} max={total + 1} value={position} onChange={(e) => setPosition(e.target.value)} className={`${inputClass} w-20`} />
      <span className="text-[11px] font-normal text-gray-400">از {total + 1} — بلوک‌های بعدی یک شماره جلو می‌روند.</span>
    </label>
    <div className="p-4 overflow-y-auto max-h-[65vh] space-y-5">{groups.map(({ group, blocks }) => <section key={group}><h3 className="text-[11px] font-black text-gray-400 mb-2">{group}</h3><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{blocks.map(([type, item]) => { const Icon = item.icon; return <button key={type} type="button" onClick={() => onAdd(type, position)} className="flex items-center gap-2.5 p-3 border text-right hover:bg-[var(--color-primary-soft)] hover:border-[var(--color-primary)] transition-colors" style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}><Icon className="text-[var(--color-primary)]" /><span className="text-xs font-bold">{item.label}</span></button>; })}</div></section>)}</div>
  </div></div></AdminPortal>;
}

export default function BlockEditor({ value = [], onChange, libraryOpen: openProp, onLibraryOpen }) {
  // انتخاب برای ادغام؛ فقط شناسه‌هایی که هنوز در فهرست هستند حساب می‌شوند.
  const [selection, setSelection] = useState([]);
  const selectedIds = selection.filter((id) => value.some((block) => block.id === id));
  // یک صفحه چند ویرایشگر دارد (مقاله‌ی برند، هر دسته، بلوک‌های ادغام‌شده‌ی تودرتو)؛
  // فقط یکی در هر لحظه انتخاب دارد، وگرنه چند نوارِ ثابتِ پایین روی هم می‌افتادند.
  const editorId = useId();
  useEffect(() => {
    const onOtherSelection = (event) => { if (event.detail !== editorId) setSelection([]); };
    window.addEventListener("article-block-selection", onOtherSelection);
    return () => window.removeEventListener("article-block-selection", onOtherSelection);
  }, [editorId]);
  // بلوک‌های بسته (آکاردئون). بلوکِ تازه همیشه باز است چون شناسه‌اش اینجا نیست.
  const [collapsed, setCollapsed] = useState(() => new Set());
  const toggleOpen = (id) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allCollapsed = value.length > 0 && value.every((block) => collapsed.has(block.id));
  const toggleSelected = (id) => {
    window.dispatchEvent(new CustomEvent("article-block-selection", { detail: editorId }));
    setSelection((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };
  // کتابخانه‌ی بلوک از نوارِ شناورِ پایینِ ویرایشگرِ مقاله هم باز می‌شود؛ اگر
  // والد آن را کنترل نکند (مثلِ مینی‌مقاله‌ی برند) همان حالتِ داخلی کار می‌کند.
  const [ownOpen, setOwnOpen] = useState(false);
  const libraryOpen = onLibraryOpen ? openProp : ownOpen;
  const setLibraryOpen = onLibraryOpen || setOwnOpen;
  // به‌روزرسانیِ دادهٔ بلوک می‌تواند نامتقارن باشد (مثلاً پس از خواندنِ ابعادِ
  // تصویر)؛ در آن لحظه `value`ی بسته‌شده در closure کهنه است. مرجعِ زیر همیشه
  // آخرین آرایه را دارد تا ویرایشِ هم‌زمانِ فیلدهای دیگر بازنویسی نشود.
  const latest = useRef(value);
  useEffect(() => { latest.current = value; });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  // مقدارِ خالی کلید را کاملاً حذف می‌کند (نه اینکه شیءِ خالی بگذارد) تا بلوک
  // واقعاً به حالتِ «بدونِ استایل/چیدمان» برگردد و مثل قبل رندر شود.
  const setBlockKey = (id, key, value_) => onChange(latest.current.map((item) => {
    if (item.id !== id) return item;
    const next = { ...item };
    if (value_) next[key] = value_; else delete next[key];
    return next;
  }));
  const move = (from, to) => { if (to < 0 || to >= value.length) return; onChange(arrayMove(value, from, to)); };
  // بلوکِ تازه ممکن است وسطِ مقاله درج شود، پس باید به خودِ عنصرِ رندرشده رفت.
  // شناسه در ref می‌ماند (نه state) تا رندرِ اضافه‌ای تحمیل نشود.
  const pendingScroll = useRef(null);
  const add = (type, position) => {
    const block = createArticleBlock(type);
    pendingScroll.current = block.id;
    onChange(insertBlockAt(value, block, position));
    setLibraryOpen(false);
  };
  // پس از کامیتِ رندری که بلوکِ تازه در آن آمده اجرا می‌شود. اگر والد به‌روزرسانی
  // را عقب انداخته باشد و عنصر هنوز نباشد، شناسه نگه داشته می‌شود تا رندرِ بعدی
  // دوباره تلاش کند — بدونِ تایمر و بدونِ حدسِ زمان.
  useEffect(() => {
    const id = pendingScroll.current;
    if (!id) return;
    const node = document.getElementById(blockDomId(id));
    if (!node) return;
    pendingScroll.current = null;
    // preventScroll لازم است وگرنه پرشِ آنیِ فوکوس با اسکرولِ نرم می‌جنگد.
    node.focus({ preventScroll: true });
    // center یعنی بلوک وسطِ صفحه می‌نشیند، پس نوارِ شناورِ پایین رویش نمی‌افتد.
    node.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [value]);
  // بینِ کلیک و تأیید یک await هست، پس مبنای حذف آرایه‌ی تازه است نه closure کهنه.
  const remove = async (block) => {
    const label = ARTICLE_BLOCKS[block.type]?.label || block.type;
    if (!(await confirmDelete(`حذف بلوک «${label}»؟`, "محتوای این بلوک از ویرایشگر برداشته می‌شود."))) return;
    onChange(latest.current.filter((item) => item.id !== block.id));
  };
  const merge = () => {
    const next = mergeBlocks(latest.current, selectedIds);
    if (!next) return;
    setSelection([]);
    onChange(next);
  };
  const blocker = mergeBlocker(value, selectedIds);
  const blockerText = {
    few: "دست‌کم دو بلوکِ کنارِ هم را انتخاب کنید.",
    gap: "فقط بلوک‌های پشتِ‌سرِ‌هم (بدونِ فاصله) ادغام می‌شوند.",
    many: `حداکثر ${MAX_MERGED_CHILDREN.toLocaleString("fa-IR")} بلوک در یک ادغام.`,
    deep: `ادغامِ تودرتو حداکثر ${MAX_MERGE_DEPTH.toLocaleString("fa-IR")} سطح.`,
  };
  return <div className="space-y-3">
    {/* نوارِ ادغام به body می‌رود و به پایینِ صفحه ثابت می‌شود: کارتِ مینی‌مقاله
        backdrop-blur دارد و position:fixed را در خودش حبس می‌کرد. روی موبایل بالاتر
        می‌نشیند تا نوارِ شناورِ ویرایشگرِ مقاله (پایین-چپ) را نپوشاند. */}
    {selectedIds.length > 0 ? <AdminPortal><div role="toolbar" aria-label="ادغام بلوک‌ها" className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex w-[calc(100%-2rem)] max-w-2xl flex-wrap items-center gap-2 border bg-white p-2.5 text-xs shadow-xl md:bottom-[calc(1rem+env(safe-area-inset-bottom))]" style={{ borderColor: "var(--color-primary)", borderRadius: "var(--admin-radius)" }}>
      <span className="font-bold">{selectedIds.length.toLocaleString("fa-IR")} بلوک انتخاب شده</span>
      <button type="button" onClick={merge} disabled={Boolean(blocker)} className="inline-flex items-center gap-1.5 px-3 py-1.5 font-bold text-white bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40" style={{ borderRadius: "var(--admin-radius)" }}><FiColumns />ادغام در یک بلوک</button>
      <button type="button" onClick={() => setSelection([])} className="px-2 py-1.5 font-bold text-gray-500 hover:text-red-600">لغو انتخاب</button>
      <span className="text-[11px] text-gray-500">{blocker ? blockerText[blocker] : "چیدمانِ بلوکِ ادغام‌شده از دکمه‌ی «چیدمان» روی خودش تنظیم می‌شود."}</span>
    </div></AdminPortal> : null}
    {value.length > 1 ? <div className="flex justify-end">
      <button type="button" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(value.map((block) => block.id)))} className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-[var(--color-primary)]">
        {allCollapsed ? <><FiChevronDown />باز کردنِ همه</> : <><FiChevronUp />بستنِ همه</>}
      </button>
    </div> : null}
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => { if (!over || active.id === over.id) return; move(value.findIndex((item) => item.id === active.id), value.findIndex((item) => item.id === over.id)); }}>
      <SortableContext items={value.map((item) => item.id)} strategy={verticalListSortingStrategy}>{value.map((block, index) => <SortableBlock key={block.id} block={block} index={index} total={value.length} onUpdate={(patch) => onChange(latest.current.map((item) => item.id === block.id ? { ...item, data: { ...item.data, ...patch } } : item))} onStyle={(style) => setBlockKey(block.id, "style", style)} onLayout={(layout) => setBlockKey(block.id, "layout", layout)} onRemove={() => remove(block)} onDuplicate={() => onChange([...value.slice(0, index + 1), cloneWithFreshIds(block), ...value.slice(index + 1)])} onMove={move} open={!collapsed.has(block.id)} onToggle={() => toggleOpen(block.id)} selectable selected={selectedIds.includes(block.id)} onSelect={() => toggleSelected(block.id)} onUnmerge={isMergedBlock(block) ? () => onChange(unmergeBlock(latest.current, block.id)) : undefined} />)}</SortableContext>
    </DndContext>
    <button type="button" onClick={() => setLibraryOpen(true)} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed text-sm font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]" style={{ borderColor: "var(--color-primary)", borderRadius: "var(--admin-radius)" }}><FiPlus /> افزودن بلوک</button>
    {value.length === 0 ? <p className="text-center text-xs text-gray-400">برای شروع اولین بلوک را اضافه کنید.</p> : null}
    {libraryOpen ? <BlockLibrary total={value.length} onAdd={add} onClose={() => setLibraryOpen(false)} /> : null}
  </div>;
}
