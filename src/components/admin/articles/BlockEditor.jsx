"use client";

import { matchesSearch } from "@/lib/search";
import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FiChevronDown, FiChevronUp, FiCopy, FiDroplet, FiMenu, FiPlus, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import ImageUpload from "@/components/admin/ImageUpload";
import ArticleEntityPicker from "./ArticleEntityPicker";
import RichTextField from "./RichTextField";
import { ARTICLE_BLOCKS, BLOCK_ACCENT_HINTS, BLOCK_GROUPS, BLOCK_SPACING_LABELS, BLOCK_STYLE_LABELS, BLOCK_TABLE_VARIANT_LABELS, createArticleBlock } from "./blockRegistry";
import { BLOCK_WIDTHS, blockWidth, insertBlockAt } from "@/lib/articleBlockLayout";
import { confirmDelete } from "@/lib/swal";

const BLOCK_WIDTH_LABELS = { full: "تمام عرض", "1/2": "نصف عرض", "1/3": "یک‌سوم عرض", "2/3": "دو‌سوم عرض" };

const inputClass = "w-full px-3 py-2.5 border bg-gray-50 text-sm outline-none focus:bg-white focus:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/20";

// <button> عنصری «برچسب‌پذیر» است، پس <label> بدونِ for اولین دکمه‌ی داخلش را
// برچسب می‌زند و مرورگر هاور و کلیکِ کلِ ناحیه را به همان دکمه می‌فرستد. فیلدِ
// متنِ غنی یک نوارِ دکمه دارد (اولینش «پررنگ») و ناحیه‌ی ویرایشش contentEditable
// است که اصلاً برچسب‌پذیر نیست — پس باید در یک wrapper ساده بنشیند.
const fieldWrapper = (kind) => (kind === "rich" ? "div" : "label");

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
    const position = Number(target);
    if (!Number.isInteger(position) || position < 1 || position > total) return;
    // onMove همان arrayMove است: شناسه‌ها دست‌نخورده می‌مانند و فقط ترتیب عوض می‌شود.
    onMove(index, position - 1);
    onClose();
  };
  return <div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4" onMouseDown={onClose}>
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
  </div>;
}

function SortableBlock({ block, index, total, onUpdate, onStyle, onLayout, onRemove, onDuplicate, onMove }) {
  const [open, setOpen] = useState(true);
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
  return <section ref={setNodeRef} id={blockDomId(block.id)} tabIndex={-1} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .55 : 1 }} className="a-card group outline-none">
    <header className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: "var(--admin-border)" }}>
      <button type="button" onClick={() => setMoveOpen(true)} className="min-w-6 h-6 px-1.5 border text-[11px] font-black text-gray-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]" style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }} aria-label={`بلوک ${index + 1} از ${total} — تغییر موقعیت`}>{index + 1}</button>
      {/* touch-none لازم است: بدونِ آن مرورگر لمسِ روی دستگیره را برای اسکرول
          برمی‌دارد و pointercancel می‌دهد؛ dnd-kit خودش این را ست نمی‌کند و
          همین علتِ نامطمئن بودنِ کشیدن در موبایل بود. */}
      <button type="button" {...attributes} {...listeners} className="touch-none p-2 cursor-grab text-gray-400 hover:text-[var(--color-primary)]" aria-label="جابجایی بلوک"><FiMenu /></button>
      <Icon className="text-[var(--color-primary)]" /><strong className="text-sm">{definition?.label || block.type}</strong>
      <div className="mr-auto flex items-center gap-1">
        <button type="button" onClick={() => onMove(index, index - 1)} disabled={index === 0} className="p-1.5 text-gray-400 disabled:opacity-20" aria-label="انتقال به بالا"><FiChevronUp /></button>
        <button type="button" onClick={() => onMove(index, index + 1)} disabled={index === total - 1} className="p-1.5 text-gray-400" aria-label="انتقال به پایین"><FiChevronDown /></button>
        <button type="button" onClick={onDuplicate} className="p-1.5 text-gray-400 hover:text-[var(--color-primary)]" aria-label="تکثیر بلوک"><FiCopy /></button>
        <button type="button" onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-600" aria-label="حذف بلوک"><FiTrash2 /></button>
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="p-1.5 text-gray-400 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]" aria-label="باز و بسته کردن">{open ? <FiChevronUp /> : <FiChevronDown />}</button>
      </div>
    </header>
    {open ? <div className="p-4 space-y-4"><BlockStylePanel type={block.type} style={block.style} layout={block.layout} onChange={onStyle} onLayout={onLayout} />{definition?.fields.length ? definition.fields.map((field) => { const Wrapper = fieldWrapper(field.kind); return <Wrapper key={field.key} className="block"><span className="block text-xs font-bold mb-1.5 text-gray-600">{field.label}</span><BlockField field={field} value={field.kind === "table" || field.kind === "rich" ? block.data : block.data?.[field.key]} onChange={(next) => onUpdate(field.kind === "table" || field.kind === "image" || field.kind === "rich" ? next : { [field.key]: next })} align={block.style?.align} onAlign={setAlign} /></Wrapper>; }) : <p className="text-xs text-gray-400 text-center py-3">این بلوک تنظیمات دیگری ندارد.</p>}</div> : null}
    {moveOpen ? <MoveDialog index={index} total={total} onMove={onMove} onClose={() => setMoveOpen(false)} /> : null}
  </section>;
}

function BlockLibrary({ total, onAdd, onClose }) {
  const [query, setQuery] = useState("");
  // موقعیتِ بلوکِ تازه، ۱-پایه. پیش‌فرض انتهای مقاله است ولی قابلِ ویرایش، تا
  // بتوان مثلاً مستقیم بینِ بلوکِ ۴ و ۵ بلوک ساخت — نه اینکه اول در انتها
  // ساخته و بعد دستی جابه‌جا شود.
  const [position, setPosition] = useState(String(total + 1));
  const groups = useMemo(() => BLOCK_GROUPS.map((group) => ({ group, blocks: Object.entries(ARTICLE_BLOCKS).filter(([, item]) => item.group === group && matchesSearch(query, item.label)) })).filter((item) => item.blocks.length), [query]);
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return <div className="fixed inset-0 z-[100] bg-black/30 flex items-start justify-center p-4 pt-[10vh]" onMouseDown={onClose}><div role="dialog" aria-modal="true" aria-labelledby="block-library-title" className="w-full max-w-2xl max-h-[76vh] overflow-hidden a-card shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
    <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: "var(--admin-border)" }}><FiSearch aria-hidden="true" className="text-gray-400" /><h2 id="block-library-title" className="sr-only">Block library</h2><input aria-label="Search blocks" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی نوع بلوک..." className="flex-1 outline-none text-sm" /><button type="button" onClick={onClose} aria-label="Close block library" className="rounded p-1 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"><FiX aria-hidden="true" /></button></div>
    <label className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b text-xs font-bold text-gray-600" style={{ borderColor: "var(--admin-border)" }}>
      <span>موقعیت بلوک جدید</span>
      <input type="number" min={1} max={total + 1} value={position} onChange={(e) => setPosition(e.target.value)} className={`${inputClass} w-20`} />
      <span className="text-[11px] font-normal text-gray-400">از {total + 1} — بلوک‌های بعدی یک شماره جلو می‌روند.</span>
    </label>
    <div className="p-4 overflow-y-auto max-h-[65vh] space-y-5">{groups.map(({ group, blocks }) => <section key={group}><h3 className="text-[11px] font-black text-gray-400 mb-2">{group}</h3><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{blocks.map(([type, item]) => { const Icon = item.icon; return <button key={type} type="button" onClick={() => onAdd(type, position)} className="flex items-center gap-2.5 p-3 border text-right hover:bg-[var(--color-primary-soft)] hover:border-[var(--color-primary)] transition-colors" style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}><Icon className="text-[var(--color-primary)]" /><span className="text-xs font-bold">{item.label}</span></button>; })}</div></section>)}</div>
  </div></div>;
}

export default function BlockEditor({ value = [], onChange, libraryOpen: openProp, onLibraryOpen }) {
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
  return <div className="space-y-3">
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => { if (!over || active.id === over.id) return; move(value.findIndex((item) => item.id === active.id), value.findIndex((item) => item.id === over.id)); }}>
      <SortableContext items={value.map((item) => item.id)} strategy={verticalListSortingStrategy}>{value.map((block, index) => <SortableBlock key={block.id} block={block} index={index} total={value.length} onUpdate={(patch) => onChange(latest.current.map((item) => item.id === block.id ? { ...item, data: { ...item.data, ...patch } } : item))} onStyle={(style) => setBlockKey(block.id, "style", style)} onLayout={(layout) => setBlockKey(block.id, "layout", layout)} onRemove={() => remove(block)} onDuplicate={() => onChange([...value.slice(0, index + 1), { ...structuredClone(block), id: crypto.randomUUID() }, ...value.slice(index + 1)])} onMove={move} />)}</SortableContext>
    </DndContext>
    <button type="button" onClick={() => setLibraryOpen(true)} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed text-sm font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]" style={{ borderColor: "var(--color-primary)", borderRadius: "var(--admin-radius)" }}><FiPlus /> افزودن بلوک</button>
    {value.length === 0 ? <p className="text-center text-xs text-gray-400">برای شروع اولین بلوک را اضافه کنید.</p> : null}
    {libraryOpen ? <BlockLibrary total={value.length} onAdd={add} onClose={() => setLibraryOpen(false)} /> : null}
  </div>;
}
