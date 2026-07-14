"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FiChevronDown, FiChevronUp, FiCopy, FiMenu, FiPlus, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import ImageUpload from "@/components/admin/ImageUpload";
import ArticleEntityPicker from "./ArticleEntityPicker";
import { ARTICLE_BLOCKS, BLOCK_GROUPS, createArticleBlock } from "./blockRegistry";

const inputClass = "w-full px-3 py-2.5 border bg-gray-50 text-sm outline-none focus:bg-white focus:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/20";

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

function BlockField({ field, value, onChange }) {
  if (field.kind === "textarea" || field.kind === "html") return <textarea dir={field.kind === "html" ? "ltr" : "rtl"} rows={field.kind === "html" ? 9 : 4} value={value || ""} onChange={(e) => onChange(e.target.value)} className={`${inputClass} ${field.kind === "html" ? "font-mono" : "font-sans"}`} />;
  if (field.kind === "select") return <select value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputClass}>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  if (field.kind === "image") return <ImageUpload value={value || ""} onChange={onChange} folder="articles" className="mb-0" />;
  if (field.kind === "gallery") return <ImageUpload value={value || []} onChange={onChange} folder="articles" multiple className="mb-0" />;
  if (field.kind === "entity" || field.kind === "entities") return <ArticleEntityPicker type={field.entityType} value={value} onChange={onChange} multiple={field.kind === "entities"} />;
  if (field.kind === "faq") return <FaqEditor value={value} onChange={onChange} />;
  if (field.kind === "table") return <TableEditor value={value} onChange={onChange} />;
  return <input type={field.kind === "number" ? "number" : field.kind === "url" ? "url" : "text"} value={value ?? ""} onChange={(e) => onChange(field.kind === "number" ? Number(e.target.value) : e.target.value)} className={inputClass} />;
}

function SortableBlock({ block, index, total, onUpdate, onRemove, onDuplicate, onMove }) {
  const [open, setOpen] = useState(true);
  const definition = ARTICLE_BLOCKS[block.type];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const Icon = definition?.icon || FiMenu;
  return <section ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .55 : 1 }} className="a-card group">
    <header className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: "var(--admin-border)" }}>
      <button type="button" {...attributes} {...listeners} className="p-1.5 cursor-grab text-gray-400 hover:text-[var(--color-primary)]" aria-label="جابجایی بلوک"><FiMenu /></button>
      <Icon className="text-[var(--color-primary)]" /><strong className="text-sm">{definition?.label || block.type}</strong>
      <div className="mr-auto flex items-center gap-1">
        <button type="button" onClick={() => onMove(index, index - 1)} disabled={index === 0} className="p-1.5 text-gray-400 disabled:opacity-20" aria-label="انتقال به بالا"><FiChevronUp /></button>
        <button type="button" onClick={() => onMove(index, index + 1)} disabled={index === total - 1} className="p-1.5 text-gray-400" aria-label="انتقال به پایین"><FiChevronDown /></button>
        <button type="button" onClick={onDuplicate} className="p-1.5 text-gray-400 hover:text-[var(--color-primary)]" aria-label="تکثیر بلوک"><FiCopy /></button>
        <button type="button" onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-600" aria-label="حذف بلوک"><FiTrash2 /></button>
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="p-1.5 text-gray-400 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]" aria-label="باز و بسته کردن">{open ? <FiChevronUp /> : <FiChevronDown />}</button>
      </div>
    </header>
    {open ? <div className="p-4 space-y-4">{definition?.fields.length ? definition.fields.map((field) => <label key={field.key} className="block"><span className="block text-xs font-bold mb-1.5 text-gray-600">{field.label}</span><BlockField field={field} value={field.kind === "table" ? block.data : block.data?.[field.key]} onChange={(next) => onUpdate(field.kind === "table" ? next : { ...block.data, [field.key]: next })} /></label>) : <p className="text-xs text-gray-400 text-center py-3">این بلوک تنظیمات دیگری ندارد.</p>}</div> : null}
  </section>;
}

function BlockLibrary({ onAdd, onClose }) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => BLOCK_GROUPS.map((group) => ({ group, blocks: Object.entries(ARTICLE_BLOCKS).filter(([, item]) => item.group === group && item.label.includes(query.trim())) })).filter((item) => item.blocks.length), [query]);
  return <div className="fixed inset-0 z-[100] bg-black/30 flex items-start justify-center p-4 pt-[10vh]" onMouseDown={onClose}><div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="block-library-title" className="w-full max-w-2xl max-h-[76vh] overflow-hidden a-card shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
    <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: "var(--admin-border)" }}><FiSearch aria-hidden="true" className="text-gray-400" /><h2 id="block-library-title" className="sr-only">Block library</h2><input aria-label="Search blocks" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی نوع بلوک..." className="flex-1 outline-none text-sm" /><button type="button" onClick={onClose} aria-label="Close block library" className="rounded p-1 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"><FiX aria-hidden="true" /></button></div>
    <div className="p-4 overflow-y-auto max-h-[65vh] space-y-5">{groups.map(({ group, blocks }) => <section key={group}><h3 className="text-[11px] font-black text-gray-400 mb-2">{group}</h3><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{blocks.map(([type, item]) => { const Icon = item.icon; return <button key={type} type="button" onClick={() => onAdd(type)} className="flex items-center gap-2.5 p-3 border text-right hover:bg-[var(--color-primary-soft)] hover:border-[var(--color-primary)] transition-colors" style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}><Icon className="text-[var(--color-primary)]" /><span className="text-xs font-bold">{item.label}</span></button>; })}</div></section>)}</div>
  </div></div>;
}

export default function BlockEditor({ value = [], onChange }) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const move = (from, to) => { if (to < 0 || to >= value.length) return; onChange(arrayMove(value, from, to)); };
  const add = (type) => { onChange([...value, createArticleBlock(type)]); setLibraryOpen(false); };
  return <div className="space-y-3">
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => { if (!over || active.id === over.id) return; move(value.findIndex((item) => item.id === active.id), value.findIndex((item) => item.id === over.id)); }}>
      <SortableContext items={value.map((item) => item.id)} strategy={verticalListSortingStrategy}>{value.map((block, index) => <SortableBlock key={block.id} block={block} index={index} total={value.length} onUpdate={(data) => onChange(value.map((item) => item.id === block.id ? { ...item, data } : item))} onRemove={() => onChange(value.filter((item) => item.id !== block.id))} onDuplicate={() => onChange([...value.slice(0, index + 1), { ...structuredClone(block), id: crypto.randomUUID() }, ...value.slice(index + 1)])} onMove={move} />)}</SortableContext>
    </DndContext>
    <button type="button" onClick={() => setLibraryOpen(true)} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed text-sm font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]" style={{ borderColor: "var(--color-primary)", borderRadius: "var(--admin-radius)" }}><FiPlus /> افزودن بلوک</button>
    {value.length === 0 ? <p className="text-center text-xs text-gray-400">برای شروع اولین بلوک را اضافه کنید.</p> : null}
    {libraryOpen ? <BlockLibrary onAdd={add} onClose={() => setLibraryOpen(false)} /> : null}
  </div>;
}
